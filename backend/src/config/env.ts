import { z } from 'zod';
import dotenv from 'dotenv';
import { buildPostgresUrl } from './database-url.js';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    // Central DB (components — URL is built at startup)
    CENTRAL_DB_HOST: z.string().min(1),
    CENTRAL_DB_PORT: z.coerce.number().default(5432),
    CENTRAL_DB_USER: z.string().min(1),
    CENTRAL_DB_PASSWORD: z.string().min(1),
    CENTRAL_DB_NAME: z.string().min(1).default('caremind_central'),

    // Tenant DB provisioning (each org DB name = prefix + org UUID)
    TENANT_DB_HOST: z.string().min(1),
    TENANT_DB_PORT: z.coerce.number().default(5433),
    TENANT_DB_USER: z.string().min(1),
    TENANT_DB_PASSWORD: z.string().min(1),
    TENANT_DB_NAME_PREFIX: z.string().default('caremind_tenant_'),

    // Redis
    REDIS_URL: z.string().url(),

    // MinIO
    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),

    // Auth — see .env.example for JWT vs refresh token explanation
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('5d'),

    // AI — OpenRouter (MVP)
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
    OPENROUTER_MODEL: z.string().default('anthropic/claude-3.5-sonnet'),

    // Embeddings — Voyage AI (MVP)
    VOYAGE_API_KEY: z.string().min(1),
    VOYAGE_MODEL: z.string().default('voyage-3'),

    // STT — Deepgram (MVP)
    DEEPGRAM_API_KEY: z.string().min(1),

    // LiveKit
    LIVEKIT_URL: z.string().min(1),
    LIVEKIT_API_KEY: z.string().min(1),
    LIVEKIT_API_SECRET: z.string().min(1),

    // Email — smtp (Mailhog/dev) or resend (production MVP)
    EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
    EMAIL_FROM: z.string().email().default('dev@caremind.local'),
    RESEND_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    // App
    APP_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),
  })
  .superRefine((data, ctx) => {
    if (data.EMAIL_PROVIDER === 'resend') {
      if (!data.RESEND_API_KEY?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
        });
      }
    }
    if (data.EMAIL_PROVIDER === 'smtp') {
      if (!data.SMTP_HOST?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp (e.g. localhost or mailhog)',
        });
      }
      if (data.SMTP_PORT === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_PORT'],
          message: 'SMTP_PORT is required when EMAIL_PROVIDER=smtp (Mailhog default: 1025)',
        });
      }
    }
  });

type EnvInput = z.infer<typeof envSchema>;

export type Env = EnvInput & {
  CENTRAL_DATABASE_URL: string;
};

let _env: Env;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Missing or invalid environment variables:\n${errors}`);
  }

  const centralDatabaseUrl = buildPostgresUrl({
    host: result.data.CENTRAL_DB_HOST,
    port: result.data.CENTRAL_DB_PORT,
    user: result.data.CENTRAL_DB_USER,
    password: result.data.CENTRAL_DB_PASSWORD,
    database: result.data.CENTRAL_DB_NAME,
  });

  process.env['CENTRAL_DATABASE_URL'] = centralDatabaseUrl;

  _env = { ...result.data, CENTRAL_DATABASE_URL: centralDatabaseUrl };
  return _env;
}

export function getEnv(): Env {
  if (!_env) {
    return validateEnv();
  }
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
