import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { env } from '../../config/env.js';
import { resolveS3Connection } from '../../config/s3-endpoint.js';
import type { StorageAdapter } from '../../types/adapters.js';
import { AppError } from '../../core/errors.js';

function createS3Client(): S3Client {
  const { endpointUrl } = resolveS3Connection(env);

  return new S3Client({
    endpoint: endpointUrl,
    region: 'us-east-1',
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

async function ensureBucketExists(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
        ACL: 'private',
      }),
    );
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function createMinioAdapter(): StorageAdapter {
  const client = createS3Client();

  return {
    async upload({ bucket, key, body, contentType, metadata }) {
      await ensureBucketExists(client, bucket);

      // MinIO (local MVP) does not support AWS SSE-KMS; omit ServerSideEncryption here.
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
          // ServerSideEncryption: 'AES256',
        }),
      );

      const { endpointUrl } = resolveS3Connection(env);
      return {
        url: `${endpointUrl}/${bucket}/${key}`,
      };
    },

    async download(bucket, key) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      if (!response.Body) {
        throw new AppError(`Empty body for ${bucket}/${key}`, 404, 'STORAGE_EMPTY');
      }

      return streamToBuffer(response.Body as Readable);
    },

    async getSignedUrl(bucket, key, expiresInSeconds) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },

    async delete(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
