import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import * as repo from './consultations.repository.js';
import { env } from '../../config/env.js';
import { getCentralPrisma, getTenantDbUrl } from '../../core/tenant-registry.js';
import { getLiveKitAdapter } from '../../adapters/livekit/index.js';
import { consultationFinalizeQueue } from '../../jobs/queue.js';
import { auditLog } from '../../core/audit-logger.js';
import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import type { AuthContext } from '../../types/auth.js';
import {
  closeLiveSession,
  createLiveSession,
  getLiveSessionByAppointment,
  buildFullText,
  getFinalSegments,
} from './live-transcript.session.js';
import { parseStoredSegments } from './consultation-transcript.merge.js';
import {
  buildSpeakerLabelsFromAppointment,
  enrichSegmentsForApi,
  formatTranscriptFromSegments,
} from './consultation-speaker-labels.js';

type AppointmentWithProfiles = NonNullable<
  Awaited<ReturnType<typeof repo.findAppointmentById>>
>;

async function resolveParticipantDisplayName(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointment: AppointmentWithProfiles,
): Promise<string> {
  if (auth.role === 'patient') {
    const patient =
      appointment.patient ??
      (await repo.findPatientByUserId(tenantPrisma, auth.userId));
    if (patient) return `${patient.firstName} ${patient.lastName}`.trim();
  }

  if (auth.role === 'doctor') {
    const doctor =
      appointment.doctor ??
      (await repo.findDoctorByUserId(tenantPrisma, auth.userId));
    if (doctor) return `Dr. ${doctor.firstName} ${doctor.lastName}`.trim();
  }

  const centralUser = await getCentralPrisma().user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  if (centralUser?.email) {
    const local = centralUser.email.split('@')[0] ?? 'Admin';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return 'Admin';
}

export async function getJoinToken(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
) {
  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment || appointment.orgId !== auth.orgId) {
    throw new NotFoundError('Appointment not found');
  }

  if (auth.role === 'patient') {
    const patient = await repo.findPatientByUserId(tenantPrisma, auth.userId);
    if (!patient || appointment.patientId !== patient.id) {
      throw new ForbiddenError('Not your appointment');
    }

    if (appointment.consentStatus === 'pending') {
      return { requiresConsent: true };
    }
  } else if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new ForbiddenError('Not your appointment');
    }
  }

  const livekit = getLiveKitAdapter();
  const roomName = appointment.livekitRoomName ?? `${auth.orgId}_${appointmentId}`;

  const displayName = await resolveParticipantDisplayName(auth, tenantPrisma, appointment);

  const token = await livekit.createRoomToken({
    roomName,
    participantIdentity: auth.userId,
    participantName: displayName,
    canPublish: true,
    canSubscribe: true,
    metadata: JSON.stringify({
      role: auth.role,
      orgId: auth.orgId,
      displayName,
    }),
  });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'JOIN_CONSULTATION',
    resourceType: 'Appointment',
    resourceId: appointmentId,
  });

  return { token, roomName, livekitUrl: env.LIVEKIT_URL };
}

export async function startRecording(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
) {
  if (auth.role !== 'doctor' && auth.role !== 'admin') {
    throw new ForbiddenError('Only doctors can start recording');
  }

  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment || appointment.orgId !== auth.orgId) throw new NotFoundError('Appointment not found');

  if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new ForbiddenError('Not your appointment');
    }
  }

  if (appointment.consentStatus !== 'accepted') {
    throw new ForbiddenError('Recording requires patient consent');
  }

  if (appointment.noRecording) {
    throw new ForbiddenError('Patient has declined recording');
  }

  const existingLive = getLiveSessionByAppointment(appointmentId);
  if (existingLive) {
    return {
      recordingId: existingLive.recordingId,
      liveAudioWsPath: '/api/consultations/live-audio',
    };
  }

  const orgSlug = auth.orgId.replace(/-/g, '').slice(0, 12);
  const bucket = `${orgSlug}-recordings`;
  const storageKey = `${appointmentId}/${uuidv4()}.live`;
  const recordingId = uuidv4();

  await repo.createRecording(tenantPrisma, {
    id: recordingId,
    appointmentId,
    orgId: auth.orgId,
    storageBucket: bucket,
    storageKey,
  });

  await repo.updateRecordingStatus(tenantPrisma, recordingId, 'processing');

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  createLiveSession({
    recordingId,
    appointmentId,
    orgId: auth.orgId,
    patientId: appointment.patientId,
    tenantDbUrl,
    speakerLabels: buildSpeakerLabelsFromAppointment(appointment),
  });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'START_RECORDING',
    resourceType: 'ConsultationRecording',
    resourceId: recordingId,
  });

  return {
    recordingId,
    liveAudioWsPath: '/api/consultations/live-audio',
  };
}

async function finalizeRecording(
  tenantPrisma: PrismaClient,
  auth: AuthContext,
  appointmentId: string,
  recordingId: string,
) {
  const closed = await closeLiveSession(recordingId);
  const fullText = closed?.fullText?.trim() ?? '';
  const segments = closed?.segments ?? [];
  const durationSeconds = closed?.durationSeconds ?? 0;

  await repo.updateRecordingStatus(tenantPrisma, recordingId, 'processing');

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  await consultationFinalizeQueue.add('consultation.finalize', {
    tenantDbUrl,
    orgId: auth.orgId,
    recordingId,
    appointmentId,
    fullText,
    segments,
    durationSeconds,
  });

  return { recordingId, status: 'processing' as const, fullText };
}

export async function stopRecording(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
) {
  const recording = await repo.findRecordingByAppointment(tenantPrisma, appointmentId);
  if (!recording || recording.orgId !== auth.orgId) throw new NotFoundError('Recording not found');

  const result = await finalizeRecording(tenantPrisma, auth, appointmentId, recording.id);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'STOP_RECORDING',
    resourceType: 'ConsultationRecording',
    resourceId: recording.id,
  });

  return result;
}

export async function getTranscript(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  appointmentId: string,
) {
  const appointment = await repo.findAppointmentById(tenantPrisma, appointmentId);
  if (!appointment || appointment.orgId !== auth.orgId) throw new NotFoundError('Appointment not found');

  const speakerLabels = buildSpeakerLabelsFromAppointment(appointment);

  const live = getLiveSessionByAppointment(appointmentId);
  if (live) {
    return {
      id: 'live',
      appointmentId,
      orgId: auth.orgId,
      content: buildFullText(live),
      segments: enrichSegmentsForApi(getFinalSegments(live), speakerLabels),
      isLive: true,
      createdAt: new Date().toISOString(),
    };
  }

  const transcript = await repo.findTranscriptByAppointment(tenantPrisma, appointmentId);
  if (!transcript) throw new NotFoundError('Transcript not ready yet');

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'READ_RECORD',
    resourceType: 'Transcript',
    resourceId: transcript.id,
  });

  const storedSegments = parseStoredSegments(transcript.segments);
  const content =
    storedSegments.length > 0
      ? formatTranscriptFromSegments(storedSegments, speakerLabels)
      : transcript.fullText;

  return {
    id: transcript.id,
    appointmentId: transcript.appointmentId,
    orgId: transcript.orgId,
    content,
    segments: enrichSegmentsForApi(storedSegments, speakerLabels),
    isLive: false,
    createdAt: transcript.createdAt.toISOString(),
  };
}

export async function getOutputs(
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
