import { EventEmitter } from 'events';
import { openDeepgramLiveStream } from '../../adapters/stt/deepgram-live.js';
import type { LiveTranscriptEvent } from '../../adapters/stt/deepgram-live.js';
import type { TranscriptSegment } from '../../types/adapters.js';
import { logger } from '../../config/logger.js';
import {
  type ConsultationSpeakerLabels,
  displayNameForRole,
  formatTranscriptFromLines,
  formatUtteranceLine,
  segmentsFromRoleLines,
  type SpeakerRole,
} from './consultation-speaker-labels.js';

export interface LiveTranscriptLine {
  text: string;
  speaker: string;
  speakerRole: SpeakerRole;
  startSeconds?: number;
  endSeconds?: number;
  isFinal: boolean;
}

type RoleStream = ReturnType<typeof openDeepgramLiveStream>;

export interface LiveTranscriptSession {
  recordingId: string;
  appointmentId: string;
  orgId: string;
  patientId: string;
  tenantDbUrl: string;
  speakerLabels: ConsultationSpeakerLabels;
  startedAt: number;
  lines: LiveTranscriptLine[];
  interimByRole: Partial<Record<SpeakerRole, string>>;
  emitter: EventEmitter;
  roleStreams: Record<SpeakerRole, RoleStream>;
}

const sessions = new Map<string, LiveTranscriptSession>();

export function getLiveSession(recordingId: string): LiveTranscriptSession | undefined {
  return sessions.get(recordingId);
}

export function getLiveSessionByAppointment(appointmentId: string): LiveTranscriptSession | undefined {
  for (const session of sessions.values()) {
    if (session.appointmentId === appointmentId) return session;
  }
  return undefined;
}

function createRoleStream(
  session: LiveTranscriptSession,
  role: SpeakerRole,
): RoleStream {
  return openDeepgramLiveStream({
    diarize: false,
    onTranscript: (event) => applyLiveEvent(session, role, event),
    onError: (message) => {
      logger.warn({ recordingId: session.recordingId, role, message }, 'Live transcription error');
      session.emitter.emit('error', message);
    },
  });
}

export function createLiveSession(params: {
  recordingId: string;
  appointmentId: string;
  orgId: string;
  patientId: string;
  tenantDbUrl: string;
  speakerLabels: ConsultationSpeakerLabels;
}): LiveTranscriptSession {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(30);

  const roleStreams = {
    doctor: null as unknown as RoleStream,
    patient: null as unknown as RoleStream,
  };

  const session: LiveTranscriptSession = {
    ...params,
    startedAt: Date.now(),
    lines: [],
    interimByRole: {},
    emitter,
    roleStreams,
  };

  session.roleStreams.doctor = createRoleStream(session, 'doctor');
  session.roleStreams.patient = createRoleStream(session, 'patient');

  sessions.set(params.recordingId, session);
  return session;
}

export function sendRoleAudio(
  recordingId: string,
  role: SpeakerRole,
  chunk: Buffer,
): boolean {
  const session = sessions.get(recordingId);
  if (!session) return false;
  session.roleStreams[role].sendAudio(chunk);
  return true;
}

function applyLiveEvent(
  session: LiveTranscriptSession,
  role: SpeakerRole,
  event: LiveTranscriptEvent,
): void {
  const speakerName = displayNameForRole(role, session.speakerLabels);

  if (event.isFinal) {
    session.lines.push({
      text: event.text,
      speaker: speakerName,
      speakerRole: role,
      startSeconds: event.startSeconds,
      endSeconds: event.endSeconds,
      isFinal: true,
    });
    delete session.interimByRole[role];
  } else {
    session.interimByRole[role] = event.text;
  }

  session.emitter.emit('transcript', {
    fullText: buildFullText(session),
    interimText: formatInterimBlock(session),
    line: { ...event, role },
  });
}

function formatInterimBlock(session: LiveTranscriptSession): string {
  const parts: string[] = [];
  for (const role of ['doctor', 'patient'] as const) {
    const text = session.interimByRole[role];
    if (text) {
      parts.push(formatUtteranceLine(displayNameForRole(role, session.speakerLabels), text));
    }
  }
  return parts.join('\n\n');
}

export function buildFullText(session: LiveTranscriptSession): string {
  const finals = formatTranscriptFromLines(session.lines);
  const interim = formatInterimBlock(session);
  if (!interim) return finals.trim();
  return finals ? `${finals}\n\n${interim}` : interim;
}

export function getFinalSegments(session: LiveTranscriptSession): TranscriptSegment[] {
  return segmentsFromRoleLines(session.lines);
}

export async function closeLiveSession(recordingId: string): Promise<{
  fullText: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
} | null> {
  const session = sessions.get(recordingId);
  if (!session) return null;

  await Promise.all([
    session.roleStreams.doctor.close(),
    session.roleStreams.patient.close(),
  ]);
  sessions.delete(recordingId);

  const durationSeconds = (Date.now() - session.startedAt) / 1000;
  const fullText = buildFullText(session);
  const segments = getFinalSegments(session);

  return { fullText, segments, durationSeconds };
}
