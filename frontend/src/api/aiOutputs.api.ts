import { apiClient, unwrap } from './client';
import { mapAiOutput } from './mappers';
import type { AiOutput } from '@/types';

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

export const aiOutputsApi = {
  getGenerationStatus: async (appointmentId: string): Promise<AiGenerationStatusResult> => {
    const res = await apiClient.get(
      `/api/ai-outputs/appointment/${appointmentId}/generation-status`,
    );
    return unwrap(res) as AiGenerationStatusResult;
  },

  retryGeneration: async (
    appointmentId: string,
  ): Promise<{ recordingId: string; status: 'processing' }> => {
    const res = await apiClient.post(
      `/api/ai-outputs/appointment/${appointmentId}/retry-generation`,
    );
    return unwrap(res) as { recordingId: string; status: 'processing' };
  },
  getByAppointment: async (appointmentId: string): Promise<AiOutput[]> => {
    const res = await apiClient.get(`/api/ai-outputs/appointment/${appointmentId}`);
    const raw = unwrap(res) as Record<string, unknown>[];
    return (raw ?? []).map(mapAiOutput);
  },

  save: async (id: string, content: string): Promise<AiOutput> => {
    const res = await apiClient.patch(`/api/ai-outputs/${id}/save`, { content });
    return mapAiOutput(unwrap(res) as Record<string, unknown>);
  },

  approve: async (id: string, editedContent?: string): Promise<AiOutput> => {
    const res = await apiClient.patch(`/api/ai-outputs/${id}/approve`, {
      ...(editedContent ? { editedContent } : {}),
    });
    return mapAiOutput(unwrap(res) as Record<string, unknown>);
  },

  reject: async (id: string): Promise<AiOutput> => {
    const res = await apiClient.patch(`/api/ai-outputs/${id}/reject`);
    return mapAiOutput(unwrap(res) as Record<string, unknown>);
  },

  getHistory: async (id: string): Promise<{
    id: string;
    type: AiOutput['type'];
    originalContent: string;
    currentContent: string;
    status: AiOutput['status'];
    reviewedAt?: string;
  }> => {
    const res = await apiClient.get(`/api/ai-outputs/${id}/history`);
    const raw = unwrap(res) as {
      id: string;
      type: AiOutput['type'];
      originalContent: string;
      currentContent: string;
      status: AiOutput['status'];
      reviewedAt?: string | null;
    };
    return {
      ...raw,
      reviewedAt: raw.reviewedAt ?? undefined,
    };
  },
};

export const aiOutputKeys = {
  all: ['ai-outputs'] as const,
  byAppointment: (appointmentId: string) => [...aiOutputKeys.all, 'appointment', appointmentId] as const,
  generationStatus: (appointmentId: string) =>
    [...aiOutputKeys.all, 'generation-status', appointmentId] as const,
  history: (id: string) => [...aiOutputKeys.all, 'history', id] as const,
};
