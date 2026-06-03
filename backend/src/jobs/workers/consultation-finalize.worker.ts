import { Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getTenantPrisma } from '../../core/tenant-prisma.js';
import { getEmailAdapter } from '../../adapters/email/index.js';
import { getCentralPrisma } from '../../core/tenant-registry.js';
import { generateAiOutputsForAppointment } from '../../modules/consultations/consultation-ai-generate.js';
import { mergeTranscriptSessions } from '../../modules/consultations/consultation-transcript.merge.js';
import type { ConsultationFinalizeJobData } from '../queue.js';

async function processFinalize(data: ConsultationFinalizeJobData): Promise<void> {
  const {
    tenantDbUrl,
    orgId,
    recordingId,
    appointmentId,
    fullText,
    segments,
    durationSeconds,
    mode = 'full',
  } = data;
  const tenantPrisma = getTenantPrisma(tenantDbUrl);

  const recording = await tenantPrisma.consultationRecording.findUnique({
    where: { id: recordingId },
  });
  if (!recording) {
    logger.warn({ recordingId }, 'Recording not found for finalize');
    return;
  }

  await tenantPrisma.consultationRecording.update({
    where: { id: recordingId },
    data: { status: 'processing' },
  });

  try {
    const appointment = await tenantPrisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true },
    });
    if (!appointment) throw new Error('Appointment not found');

    let mergedFullText = fullText.trim();

    if (mode === 'full') {
      if (!mergedFullText) throw new Error('Empty transcript');

      const existing = await tenantPrisma.transcript.findFirst({
        where: { appointmentId },
        orderBy: { createdAt: 'desc' },
      });

      const merged = mergeTranscriptSessions({
        existingFullText: existing?.fullText,
        existingSegments: existing?.segments,
        existingDurationSeconds: existing?.durationSeconds,
        sessionFullText: fullText,
        sessionSegments: segments,
        sessionDurationSeconds: durationSeconds,
      });

      mergedFullText = merged.fullText;

      if (existing) {
        await tenantPrisma.transcript.update({
          where: { id: existing.id },
          data: {
            fullText: merged.fullText,
            segments: merged.segments as object,
            durationSeconds: merged.durationSeconds,
          },
        });
      } else {
        await tenantPrisma.transcript.create({
          data: {
            id: uuidv4(),
            appointmentId,
            orgId,
            fullText: merged.fullText,
            segments: merged.segments as object,
            durationSeconds: merged.durationSeconds,
          },
        });
      }

      await tenantPrisma.consultationRecording.update({
        where: { id: recordingId },
        data: { durationSeconds: merged.durationSeconds },
      });
    } else {
      const transcript = await tenantPrisma.transcript.findFirst({
        where: { appointmentId },
        orderBy: { createdAt: 'desc' },
      });
      if (!transcript?.fullText?.trim()) throw new Error('No transcript found for AI retry');
      mergedFullText = transcript.fullText.trim();
    }

    if (appointment.consentStatus !== 'accepted') {
      logger.warn({ appointmentId }, 'Consent not accepted — skipping AI output generation');
      await tenantPrisma.consultationRecording.update({
        where: { id: recordingId },
        data: { status: 'ready' },
      });
      return;
    }

    const { hasApprovedOutputs } = await generateAiOutputsForAppointment({
      tenantPrisma,
      appointmentId,
      orgId,
      fullText: mergedFullText,
    });

    await tenantPrisma.consultationRecording.update({
      where: { id: recordingId },
      data: { status: 'ready' },
    });

    const doctorUser = await getCentralPrisma().user.findUnique({
      where: { id: appointment.doctor.userId },
    });
    if (doctorUser) {
      const subject = hasApprovedOutputs
        ? 'Updated AI Outputs Ready for Review — CareMind AI'
        : 'AI Outputs Ready for Review — CareMind AI';
      getEmailAdapter()
        .send({
          to: doctorUser.email,
          subject,
          html: `<p>Dr. ${appointment.doctor.lastName}, AI outputs for this appointment are ready for review${
            hasApprovedOutputs
              ? ' (includes a new recording session; earlier approved summaries are unchanged).'
              : '.'
          }</p>`,
        })
        .catch(() => undefined);
    }

    logger.info({ recordingId, appointmentId, mode, hasApprovedOutputs }, 'Consultation finalize complete');
  } catch (err) {
    logger.error({ err, recordingId, mode }, 'Consultation finalize failed');
    await tenantPrisma.consultationRecording.update({
      where: { id: recordingId },
      data: { status: 'failed' },
    });
    throw err;
  }
}

export function createConsultationFinalizeWorker(): Worker {
  return new Worker<ConsultationFinalizeJobData>(
    'consultation-finalize',
    async (job) => {
      logger.info(
        { jobId: job.id, appointmentId: job.data.appointmentId, mode: job.data.mode ?? 'full' },
        'Finalizing consultation',
      );
      await processFinalize(job.data);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 1,
      // Four sequential LLM calls can run several minutes — avoid false "stalled" kills
      lockDuration: 600_000,
      stalledInterval: 120_000,
      maxStalledCount: 2,
    },
  );
}
