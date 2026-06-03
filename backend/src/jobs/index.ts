import { logger } from '../config/logger.js';
import { getTenantPrisma } from '../core/tenant-prisma.js';
import { createDocumentWorker } from './workers/document.worker.js';
import { createTranscriptionWorker } from './workers/transcription.worker.js';
import { createConsultationFinalizeWorker } from './workers/consultation-finalize.worker.js';
import { createEmbeddingWorker } from './workers/embedding.worker.js';
import { createNotificationWorker } from './workers/notification.worker.js';
import type { ConsultationFinalizeJobData } from './queue.js';
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

  workers = [
    createDocumentWorker(),
    createTranscriptionWorker(),
    finalizeWorker,
    createEmbeddingWorker(),
    createNotificationWorker(),
  ];

  for (const worker of workers) {
    if (worker === finalizeWorker) continue;
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
