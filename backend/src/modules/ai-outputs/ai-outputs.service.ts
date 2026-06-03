import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import * as repo from './ai-outputs.repository.js';
import { consultationFinalizeQueue, embeddingQueue } from '../../jobs/queue.js';
import { getEmailAdapter } from '../../adapters/email/index.js';
import { getCentralPrisma, getTenantDbUrl } from '../../core/tenant-registry.js';
import { auditLog } from '../../core/audit-logger.js';
import { buildSpeakerLabelsFromAppointment } from '../consultations/consultation-speaker-labels.js';
import { reconcileStuckProcessingRecording } from '../consultations/consultation-recording-status.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import type { AuthContext } from '../../types/auth.js';
import { z } from 'zod';

const EXPECTED_AI_OUTPUT_COUNT = 4;

export type AiGenerationStatus =
  | 'no_transcript'
  | 'pending_consent'
  | 'processing'
  | 'ready'
  | 'failed';

export interface AiGenerationStatusResult {
  status: AiGenerationStatus;
  canRetry: boolean;
  message: string;
  pendingOutputCount: number;
  totalOutputCount: number;
  recordingStatus?: string;
}

export const approveOutputSchema = z.object({
  editedContent: z.string().optional(),
});

export const rejectOutputSchema = z.object({
  reason: z.string().optional(),
});

export const saveOutputSchema = z.object({
  content: z.string().min(1),
});

export async function listOutputsForAppointment(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
) {
  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment || appointment.orgId !== auth.orgId) throw new NotFoundError('Appointment not found');

  const outputs = await repo.listAiOutputsByAppointment(tenantPrisma, appointmentId);

  if (auth.role === 'patient') {
    return outputs.filter(
      (o) =>
        (o.type === 'patient_summary' || o.type === 'follow_up_instructions') &&
        (o.status === 'approved' || o.status === 'edited'),
    );
  }

  return outputs;
}

export async function approveOutput(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  outputId: string,
  editedContent?: string,
) {
  if (auth.role !== 'doctor') throw new ForbiddenError('Doctor role required');

  const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
  if (!doctor) throw new NotFoundError('Doctor profile not found');

  const output = await repo.findAiOutputById(tenantPrisma, outputId);
  if (!output || output.orgId !== auth.orgId) throw new NotFoundError('AI output not found');

  const appointment = await repo.findAppointmentById(tenantPrisma, output.appointmentId);
  if (!appointment || appointment.doctorId !== doctor.id) {
    throw new ForbiddenError('Not assigned to this appointment');
  }

  const newContent = editedContent ?? output.content;
  const status = editedContent ? 'edited' : 'approved';

  const updated = await repo.updateAiOutput(tenantPrisma, outputId, {
    content: newContent,
    status: status as 'approved' | 'edited',
    reviewedByDoctorId: doctor.id,
    reviewedAt: new Date(),
  });

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  const labels =
    appointment.patient && appointment.doctor
      ? buildSpeakerLabelsFromAppointment({
          patient: appointment.patient,
          doctor: appointment.doctor,
        })
      : null;

  await tenantPrisma.vectorChunk.deleteMany({
    where: {
      appointmentId: output.appointmentId,
      patientId: appointment.patientId,
      documentType: output.type,
    },
  });

  await embeddingQueue.add('knowledge-base.ingest', {
    tenantDbUrl,
    orgId: auth.orgId,
    patientId: appointment.patientId,
    text: labels
      ? [
          `Approved clinical output (${output.type}).`,
          `Doctor: ${labels.doctorName}. Patient: ${labels.patientName}.`,
          'Summaries are based on the labeled consultation transcript.',
          '',
          newContent,
        ].join('\n')
      : newContent,
    appointmentId: output.appointmentId,
    documentType: output.type,
  });

  // Notify patient that summary is ready
  const patientUser = await getCentralPrisma().user.findUnique({
    where: { id: appointment.patient.userId },
  });

  if (patientUser && output.type === 'patient_summary') {
    getEmailAdapter()
      .send({
        to: patientUser.email,
        subject: 'Your Visit Summary Is Ready — CareMind AI',
        html: '<p>Your doctor has reviewed and approved your visit summary. Log in to view it.</p>',
      })
      .catch(() => { /* non-blocking */ });
  }

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'APPROVE_OUTPUT',
    resourceType: 'AiOutput',
    resourceId: outputId,
    metadata: { status },
  });

  return updated;
}

export async function saveOutput(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  outputId: string,
  content: string,
) {
  if (auth.role !== 'doctor' && auth.role !== 'admin') {
    throw new ForbiddenError('Doctor role required');
  }

  const output = await repo.findAiOutputById(tenantPrisma, outputId);
  if (!output || output.orgId !== auth.orgId) throw new NotFoundError('AI output not found');

  const appointment = await repo.findAppointmentById(tenantPrisma, output.appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new ForbiddenError('Not assigned to this appointment');
    }
  }

  if (output.status === 'rejected') {
    throw new ValidationError('Cannot edit a rejected output');
  }

  const updated = await repo.saveAiOutputContent(tenantPrisma, outputId, content);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'EDIT_OUTPUT',
    resourceType: 'AiOutput',
    resourceId: outputId,
  });

  return updated;
}

export async function rejectOutput(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  outputId: string,
) {
  if (auth.role !== 'doctor') throw new ForbiddenError('Doctor role required');

  const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
  if (!doctor) throw new NotFoundError('Doctor profile not found');

  const output = await repo.findAiOutputById(tenantPrisma, outputId);
  if (!output || output.orgId !== auth.orgId) throw new NotFoundError('AI output not found');

  const appointment = await repo.findAppointmentById(tenantPrisma, output.appointmentId);
  if (!appointment || appointment.doctorId !== doctor.id) {
    throw new ForbiddenError('Not assigned to this appointment');
  }

  const updated = await repo.updateAiOutput(tenantPrisma, outputId, {
    status: 'rejected',
    reviewedByDoctorId: doctor.id,
    reviewedAt: new Date(),
  });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'REJECT_OUTPUT',
    resourceType: 'AiOutput',
    resourceId: outputId,
  });

  return updated;
}

export async function getOutputHistory(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  outputId: string,
) {
  const output = await repo.findAiOutputById(tenantPrisma, outputId);
  if (!output || output.orgId !== auth.orgId) throw new NotFoundError('AI output not found');

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'READ_RECORD',
    resourceType: 'AiOutput',
    resourceId: outputId,
  });

  return {
    id: output.id,
    type: output.type,
    originalContent: output.originalContent,
    currentContent: output.content,
    status: output.status,
    reviewedAt: output.reviewedAt,
    reviewedByDoctorId: output.reviewedByDoctorId,
  };
}

export async function getGenerationStatus(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
): Promise<AiGenerationStatusResult> {
  if (auth.role === 'patient') {
    throw new ForbiddenError('Generation status is only available to clinical staff');
  }

  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment || appointment.orgId !== auth.orgId) throw new NotFoundError('Appointment not found');

  const transcript = await repo.findTranscriptByAppointment(tenantPrisma, appointmentId);
  const latestRecording = await repo.findLatestRecordingByAppointment(tenantPrisma, appointmentId);
  const pendingOutputCount = await repo.countPendingOutputsByAppointment(tenantPrisma, appointmentId);
  const totalOutputCount = await repo.countOutputsByAppointment(tenantPrisma, appointmentId);

  let recordingStatus = latestRecording?.status;
  if (latestRecording) {
    recordingStatus = await reconcileStuckProcessingRecording(tenantPrisma, latestRecording);
  }

  const base = {
    pendingOutputCount,
    totalOutputCount,
    recordingStatus,
  };

  if (totalOutputCount >= EXPECTED_AI_OUTPUT_COUNT) {
    return {
      ...base,
      status: 'ready',
      canRetry: false,
      message: 'AI outputs are ready for review.',
    };
  }

  if (!transcript?.fullText?.trim()) {
    return {
      ...base,
      status: 'no_transcript',
      canRetry: false,
      message: 'Complete a consultation recording to generate a transcript first.',
    };
  }

  if (appointment.consentStatus !== 'accepted') {
    return {
      ...base,
      status: 'pending_consent',
      canRetry: false,
      message: 'Patient consent is required before AI outputs can be generated.',
    };
  }

  if (recordingStatus === 'processing') {
    return {
      ...base,
      status: 'processing',
      canRetry: false,
      message: 'AI outputs are being generated. This may take a few minutes.',
    };
  }

  return {
    ...base,
    status: 'failed',
    canRetry: true,
    message:
      recordingStatus === 'failed'
        ? 'AI generation failed or was interrupted. Use Retry to regenerate outputs from the saved transcript.'
        : 'AI outputs were not generated. Use Retry to run generation again.',
  };
}

export async function retryGeneration(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
): Promise<{ recordingId: string; status: 'processing' }> {
  if (auth.role !== 'doctor' && auth.role !== 'admin') {
    throw new ForbiddenError('Only doctors can retry AI generation');
  }

  const status = await getGenerationStatus(auth, tenantPrisma, appointmentId);
  if (!status.canRetry) {
    throw new ValidationError(status.message);
  }

  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment) throw new NotFoundError('Appointment not found');

  if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new ForbiddenError('Not assigned to this appointment');
    }
  }

  const transcript = await repo.findTranscriptByAppointment(tenantPrisma, appointmentId);
  if (!transcript?.fullText?.trim()) throw new NotFoundError('Transcript not found');

  const recording = await repo.findLatestRecordingByAppointment(tenantPrisma, appointmentId);
  if (!recording) throw new NotFoundError('No consultation recording found for this appointment');

  await repo.updateRecordingStatus(tenantPrisma, recording.id, 'processing');

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  await consultationFinalizeQueue.add(
    'consultation.finalize',
    {
      tenantDbUrl,
      orgId: auth.orgId,
      recordingId: recording.id,
      appointmentId,
      fullText: transcript.fullText,
      segments: [],
      durationSeconds: transcript.durationSeconds ?? 0,
      mode: 'ai_only',
    },
    { jobId: `ai-retry-${recording.id}-${Date.now()}` },
  );

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'RETRY_AI_GENERATION',
    resourceType: 'Appointment',
    resourceId: appointmentId,
    metadata: { recordingId: recording.id },
  });

  return { recordingId: recording.id, status: 'processing' };
}
