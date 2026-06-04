import type { Env } from './env.js';

export type S3ConnectionConfig = {
  /** Full base URL for the AWS S3 client (scheme + host + optional port). */
  endpointUrl: string;
};

export function resolveS3Connection(env: Env): S3ConnectionConfig {
  if (env.S3_ENDPOINT) {
    return { endpointUrl: env.S3_ENDPOINT.replace(/\/$/, '') };
  }

  const protocol = env.MINIO_USE_SSL ? 'https' : 'http';
  return {
    endpointUrl: `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  };
}
