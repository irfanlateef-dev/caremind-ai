import { Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getTenantPrisma } from '../../core/tenant-prisma.js';
import { ingestText } from '../../modules/knowledge-base/knowledge-base.service.js';
import type { EmbeddingJobData } from '../queue.js';

const MAX_STORED_EXTRACTED_CHARS = 100_000;

export function createEmbeddingWorker(): Worker {
  return new Worker<EmbeddingJobData>(
    'embedding',
    async (job) => {
      const { tenantDbUrl, orgId, patientId, text, documentId, appointmentId, documentType, fileName } =
        job.data;
      logger.info({ jobId: job.id, documentId, appointmentId }, 'Processing embedding job');

      const tenantPrisma = getTenantPrisma(tenantDbUrl);

      try {
        await ingestText({
          tenantPrisma,
          orgId,
          patientId,
          text,
          documentId,
          appointmentId,
          documentType,
          fileName,
        });

        if (documentId) {
          await tenantPrisma.document.update({
            where: { id: documentId },
            data: {
              extractedText: text.slice(0, MAX_STORED_EXTRACTED_CHARS),
              processingStatus: 'ready',
            },
          });
          logger.info({ documentId, fileName }, 'Document processed and vectorized');
        } else {
          logger.info({ jobId: job.id }, 'Embedding ingestion complete');
        }
      } catch (err) {
        if (documentId) {
          await tenantPrisma.document.update({
            where: { id: documentId },
            data: { processingStatus: 'failed' },
          });
        }
        throw err;
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 2,
    },
  );
}
