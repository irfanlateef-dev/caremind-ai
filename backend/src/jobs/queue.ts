import { Queue } from 'bullmq';
import { env } from '../config/env.js';

const connection = {
  url: env.REDIS_URL,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const documentQueue = new Queue('document', {
  connection,
  defaultJobOptions,
});

export const transcriptionQueue = new Queue('transcription', {
  connection,
  defaultJobOptions,
});

export const consultationFinalizeQueue = new Queue('consultation-finalize', {
  connection,
  defaultJobOptions,
});

export const embeddingQueue = new Queue('embedding', {
  connection,
  defaultJobOptions,
});

export const notificationQueue = new Queue('notification', {
  connection,
  defaultJobOptions,
});

// ─── Job data types ────────────────────────────────────────────────────────

export interface DocumentJobData {
  tenantDbUrl: string;
  orgId: string;
  documentId: string;
}

export interface TranscriptionJobData {
  tenantDbUrl: string;
  orgId: string;
  recordingId: string;
  appointmentId: string;
}

export interface ConsultationFinalizeJobData {
  tenantDbUrl: string;
  orgId: string;
  recordingId: string;
  appointmentId: string;
  fullText: string;
  segments: Array<{
    speaker?: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
  durationSeconds: number;
  /** full: save transcript + generate AI; ai_only: regenerate AI from DB transcript */
  mode?: 'full' | 'ai_only';
}

export interface EmbeddingJobData {
  tenantDbUrl: string;
  orgId: string;
  patientId: string;
  text: string;
  documentId?: string;
  appointmentId?: string;
  documentType: string;
  fileName?: string;
}

export interface NotificationJobData {
  tenantDbUrl: string;
  orgId: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  type: string;
  payload: Record<string, string>;
}
