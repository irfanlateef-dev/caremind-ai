import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import { getEmbeddingAdapter } from '../../adapters/embedding/index.js';
import { toVectorLiteral } from './vector-literal.js';

const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 50;
const APPROX_CHARS_PER_TOKEN = 4;

function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunkChars = CHUNK_SIZE_TOKENS * APPROX_CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

  if (trimmed.length <= chunkChars) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + chunkChars, trimmed.length);
    const chunk = trimmed.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= trimmed.length) break;
    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

export async function ingestText(params: {
  tenantPrisma: PrismaClient;
  orgId: string;
  patientId: string;
  text: string;
  documentId?: string;
  appointmentId?: string;
  documentType: string;
  fileName?: string;
}): Promise<void> {
  const { tenantPrisma, orgId, patientId, text, documentId, appointmentId, documentType, fileName } =
    params;

  if (!text.trim()) return;

  if (documentId) {
    await tenantPrisma.vectorChunk.deleteMany({ where: { documentId } });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const MAX_CHUNKS = 500;
  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`Text produced too many chunks (${chunks.length}); aborting ingest`);
  }

  const embeddingAdapter = getEmbeddingAdapter();
  const embeddings = await embeddingAdapter.embedBatch(chunks);

  const records = chunks.map((content, i) => ({
    id: uuidv4(),
    orgId,
    patientId,
    documentId: documentId ?? null,
    appointmentId: appointmentId ?? null,
    documentType,
    content,
    metadata: {
      chunkIndex: i,
      totalChunks: chunks.length,
      ...(fileName ? { fileName } : {}),
      ...(appointmentId ? { appointmentId } : {}),
      ...(documentId ? { documentId } : {}),
    },
  }));

  // Insert in batches to avoid exceeding query size limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const record = batch[j]!;
      const embedding = batchEmbeddings[j]!;

      await tenantPrisma.$executeRawUnsafe(
        `INSERT INTO vector_chunks
           (id, "orgId", "patientId", "documentId", "appointmentId", "documentType", content, embedding, metadata, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        record.id,
        record.orgId,
        record.patientId,
        record.documentId,
        record.appointmentId,
        record.documentType,
        record.content,
        toVectorLiteral(embedding),
        JSON.stringify(record.metadata),
      );
    }
  }
}
