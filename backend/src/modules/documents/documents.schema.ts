import { z } from 'zod';

const optionalUuid = z
  .union([z.string().uuid(), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined));

export const uploadDocumentSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: optionalUuid,
  documentType: z.string().max(100).optional(),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  patientId: optionalUuid,
  doctorId: optionalUuid,
  appointmentId: optionalUuid,
});

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

/** Max files per upload request (each file still ≤ 20MB). */
export const MAX_FILES_PER_UPLOAD = 20;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
