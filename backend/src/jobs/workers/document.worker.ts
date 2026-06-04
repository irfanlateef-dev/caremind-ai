import { Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getTenantPrisma } from '../../core/tenant-prisma.js';
import { getStorageAdapter } from '../../adapters/storage/index.js';
import { getOcrAdapter } from '../../adapters/ocr/index.js';
import { embeddingQueue } from '../queue.js';
import type { DocumentJobData } from '../queue.js';

const MAX_EXTRACTED_CHARS = 500_000;
const MAX_STORED_EXTRACTED_CHARS = 100_000;

function ocrMimeType(
  mime: string,
): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (mime === 'application/pdf' || mime === 'image/png') return mime;
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  return null;
}

function buildTextForIngest(
  fileName: string,
  documentType: string | null,
  appointmentId: string | null,
  body: string,
): string {
  const header = [
    `File: ${fileName}`,
    documentType ? `Document type: ${documentType}` : null,
    appointmentId ? `Linked to appointment: ${appointmentId}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return `${header}\n\n${body.trim()}`;
}

async function processDocument(data: DocumentJobData): Promise<void> {
  const { tenantDbUrl, orgId, documentId } = data;
  const tenantPrisma = getTenantPrisma(tenantDbUrl);
  const storage = getStorageAdapter();
  const ocr = getOcrAdapter();

  const document = await tenantPrisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    logger.warn({ documentId }, 'Document not found for processing');
    return;
  }

  await tenantPrisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'processing' },
  });

  try {
    const buffer = await storage.download(document.storageBucket, document.storageKey);
    let extractedText = '';

    const mime = ocrMimeType(document.mimeType);
    if (mime) {
      const result = await ocr.extractText({ imageBuffer: buffer, mimeType: mime });
      extractedText = result.text.slice(0, MAX_EXTRACTED_CHARS);
    }

    if (!extractedText.trim()) {
      await tenantPrisma.document.update({
        where: { id: documentId },
        data: { extractedText: null, processingStatus: 'failed' },
      });
      logger.warn(
        {
          documentId,
          mimeType: document.mimeType,
          fileName: document.fileName,
          appointmentId: document.appointmentId,
        },
        'No text extracted from document — not vectorized',
      );
      return;
    }

    const textForIngest = buildTextForIngest(
      document.fileName,
      document.documentType,
      document.appointmentId,
      extractedText,
    );

    await tenantPrisma.document.update({
      where: { id: documentId },
      data: {
        extractedText: textForIngest.slice(0, MAX_STORED_EXTRACTED_CHARS),
      },
    });

    await embeddingQueue.add('document.vectorize', {
      tenantDbUrl,
      orgId,
      patientId: document.patientId,
      text: textForIngest,
      documentId,
      appointmentId: document.appointmentId ?? undefined,
      documentType: document.documentType ?? 'document',
      fileName: document.fileName,
    });

    logger.info(
      { documentId, textLength: textForIngest.length },
      'Document text extracted — embedding job queued',
    );
  } catch (err) {
    logger.error({ err, documentId }, 'Document processing failed');
    await tenantPrisma.document.update({
      where: { id: documentId },
      data: { processingStatus: 'failed' },
    });
    throw err;
  }
}

export function createDocumentWorker(): Worker {
  return new Worker<DocumentJobData>(
    'document',
    async (job) => {
      logger.info({ jobId: job.id, documentId: job.data.documentId }, 'Processing document job');
      await processDocument(job.data);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 1,
    },
  );
}
