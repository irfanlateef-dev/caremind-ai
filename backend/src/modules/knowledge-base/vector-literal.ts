import { AppError } from '../../core/errors.js';

const MAX_VECTOR_DIMENSIONS = 4096;

/** Build a pgvector literal from a numeric embedding (guards against malformed API responses). */
export function toVectorLiteral(embedding: number[]): string {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new AppError('Empty embedding vector', 502, 'EMBEDDING_ERROR');
  }
  if (embedding.length > MAX_VECTOR_DIMENSIONS) {
    throw new AppError(
      `Embedding dimension ${embedding.length} exceeds limit`,
      502,
      'EMBEDDING_ERROR',
    );
  }
  const parts = new Array<string>(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    const n = embedding[i];
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new AppError('Invalid embedding value', 502, 'EMBEDDING_ERROR');
    }
    parts[i] = String(n);
  }
  return `[${parts.join(',')}]`;
}
