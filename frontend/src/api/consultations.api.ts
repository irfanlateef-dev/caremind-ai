import { apiClient, unwrap } from './client';
import type {
  ConsultationRecording,
  LiveKitTokenResponse,
  Transcript,
  TranscriptSegmentView,
} from '@/types';

function mapTranscriptSegments(raw: unknown): TranscriptSegmentView[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const segments = raw
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      speaker: String(s.speaker ?? 'Unknown'),
      speakerRole: (s.speakerRole === 'doctor' || s.speakerRole === 'patient'
        ? s.speakerRole
        : undefined) as 'doctor' | 'patient' | undefined,
      text: String(s.text ?? ''),
      startSeconds: typeof s.startSeconds === 'number' ? s.startSeconds : undefined,
      endSeconds: typeof s.endSeconds === 'number' ? s.endSeconds : undefined,
    }))
    .filter((s) => s.text.length > 0);
  return segments.length > 0 ? segments : undefined;
}

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL ?? 'wss://localhost:7880';

export const consultationsApi = {
  /** POST /api/consultations/:appointmentId/join-token */
  getJoinToken: async (
    appointmentId: string
  ): Promise<LiveKitTokenResponse & { requiresConsent?: boolean }> => {
    const res = await apiClient.post(`/api/consultations/${appointmentId}/join-token`);
    const data = unwrap(res) as
      | { token: string; roomName: string }
      | { requiresConsent: true };

    if ('requiresConsent' in data && data.requiresConsent) {
      return { requiresConsent: true, token: '', roomName: '', livekitUrl: LIVEKIT_URL };
    }

    const tokenData = data as { token: string; roomName: string; livekitUrl?: string };
    const jwt =
      typeof tokenData.token === 'string'
        ? tokenData.token
        : '';
    if (!jwt) {
      throw new Error('Invalid LiveKit token from server');
    }
    return {
      token: jwt,
      roomName: tokenData.roomName,
      livekitUrl: tokenData.livekitUrl ?? LIVEKIT_URL,
    };
  },

  startRecording: async (
    appointmentId: string
  ): Promise<ConsultationRecording & { liveAudioWsPath: string }> => {
    const res = await apiClient.post(`/api/consultations/${appointmentId}/recording/start`);
    const raw = unwrap(res) as { recordingId: string; liveAudioWsPath: string };
    return {
      id: raw.recordingId,
      appointmentId,
      orgId: '',
      startedAt: new Date().toISOString(),
      status: 'recording',
      liveAudioWsPath: raw.liveAudioWsPath,
    };
  },

  stopRecording: async (appointmentId: string): Promise<ConsultationRecording> => {
    const res = await apiClient.post(`/api/consultations/${appointmentId}/recording/stop`);
    const raw = unwrap(res) as { recordingId: string; status: string };
    return {
      id: raw.recordingId,
      appointmentId,
      orgId: '',
      startedAt: new Date().toISOString(),
      status: raw.status === 'processing' ? 'processing' : 'done',
    };
  },

  getTranscript: async (appointmentId: string): Promise<Transcript | null> => {
    try {
      const res = await apiClient.get(`/api/consultations/${appointmentId}/transcript`);
      const raw = unwrap(res) as Record<string, unknown>;
      return {
        id: String(raw.id),
        appointmentId,
        orgId: String(raw.orgId ?? ''),
        content: String(raw.content ?? raw.fullText ?? ''),
        segments: mapTranscriptSegments(raw.segments),
        isLive: Boolean(raw.isLive),
        createdAt:
          typeof raw.createdAt === 'string'
            ? raw.createdAt
            : (raw.createdAt as Date).toISOString(),
      };
    } catch {
      return null;
    }
  },
};

export const consultationKeys = {
  all: ['consultations'] as const,
  joinToken: (appointmentId: string) => [...consultationKeys.all, 'join-token', appointmentId] as const,
  transcript: (appointmentId: string) => [...consultationKeys.all, 'transcript', appointmentId] as const,
};
