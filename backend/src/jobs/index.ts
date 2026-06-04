import { logger } from '../config/logger.js';
import { getTenantPrisma } from '../core/tenant-prisma.js';
import { createDocumentWorker } from './workers/document.worker.js';
import { createTranscriptionWorker } from './workers/transcription.worker.js';
import { createConsultationFinalizeWorker } from './workers/consultation-finalize.worker.js';
import { createEmbeddingWorker } from './workers/embedding.worker.js';
import { createNotificationWorker } from './workers/notification.worker.js';
import type {
  ConsultationFinalizeJobData,
  DocumentJobData,
  EmbeddingJobData,
} from './queue.js';
import type { Worker } from 'bullmq';

let workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  const finalizeWorker = createConsultationFinalizeWorker();

  finalizeWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, queue: finalizeWorker.name, err }, 'Job failed');
    const data = job?.data as ConsultationFinalizeJobData | undefined;
    if (!data?.tenantDbUrl || !data.recordingId) return;
    try {
      const tenantPrisma = getTenantPrisma(data.tenantDbUrl);
      await tenantPrisma.consultationRecording.update({
        where: { id: data.recordingId },
        data: { status: 'failed' },
      });
    } catch (markErr) {
      logger.error({ markErr, recordingId: data.recordingId }, 'Could not mark recording failed');
    }
  });

  const documentWorker = createDocumentWorker();

  documentWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, queue: documentWorker.name, err }, 'Document job failed');
    if (!job) return;
    const data = job.data as DocumentJobData | undefined;
    if (!data?.tenantDbUrl || !data.documentId) return;
    const maxAttempts = job.opts.attempts ?? 3;
    const unrecoverable = err instanceof Error && err.name === 'UnrecoverableError';
    if (job.attemptsMade < maxAttempts && !unrecoverable) return;
    try {
      const tenantPrisma = getTenantPrisma(data.tenantDbUrl);
      await tenantPrisma.document.update({
        where: { id: data.documentId },
        data: { processingStatus: 'failed' },
      });
    } catch (markErr) {
      logger.error({ markErr, documentId: data.documentId }, 'Could not mark document failed');
    }
  });

  const embeddingWorker = createEmbeddingWorker();

  embeddingWorker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, queue: embeddingWorker.name, err }, 'Embedding job failed');
    if (!job) return;
    const data = job.data as EmbeddingJobData | undefined;
    if (!data?.tenantDbUrl || !data.documentId) return;
    try {
      const tenantPrisma = getTenantPrisma(data.tenantDbUrl);
      await tenantPrisma.document.update({
        where: { id: data.documentId },
        data: { processingStatus: 'failed' },
      });
    } catch (markErr) {
      logger.error({ markErr, documentId: data.documentId }, 'Could not mark document failed');
    }
  });

  workers = [
    documentWorker,
    createTranscriptionWorker(),
    finalizeWorker,
    embeddingWorker,
    createNotificationWorker(),
  ];

  for (const worker of workers) {
    if (worker === finalizeWorker || worker === documentWorker || worker === embeddingWorker) {
      continue;
    }
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed');
    });
    worker.on('error', (err) => {
      logger.error({ queue: worker.name, err }, 'Worker error');
    });
  }

  logger.info(`${workers.length} BullMQ workers started`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.allSettled(workers.map((w) => w.close()));
  logger.info('All workers stopped');
}
