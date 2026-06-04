import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import * as repo from './documents.repository.js';
import { getStorageAdapter } from '../../adapters/storage/index.js';
import { documentQueue } from '../../jobs/queue.js';
import { auditLog } from '../../core/audit-logger.js';
import { getTenantDbUrl } from '../../core/tenant-registry.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import type { AuthContext } from '../../types/auth.js';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_UPLOAD,
  type UploadDocumentInput,
} from './documents.schema.js';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type UploadDocumentsResult = {
  documents: Awaited<ReturnType<typeof uploadDocument>>[];
  failed: { fileName: string; message: string }[];
};

type LinkedAppointment = { id: string; scheduledAt: Date };

function fileSizeBytesOf(doc: unknown): number {
  if (typeof doc === 'object' && doc !== null && 'fileSizeBytes' in doc) {
    const bytes = (doc as { fileSizeBytes: unknown }).fileSizeBytes;
    return typeof bytes === 'number' ? bytes : 0;
  }
  return 0;
}

function serializeDocument(doc: repo.DocumentListRow) {
  const linked = doc.appointment as LinkedAppointment | null;
  return {
    ...doc,
    fileSize: fileSizeBytesOf(doc),
    createdAt: doc.createdAt.toISOString(),
    appointment: linked
      ? {
          id: linked.id,
          scheduledAt: linked.scheduledAt.toISOString(),
        }
      : null,
  };
}

async function assertAppointmentForPatient(
  tenantPrisma: PrismaClient,
  orgId: string,
  patientId: string,
  appointmentId: string,
) {
  const appointment = await tenantPrisma.appointment.findFirst({
    where: { id: appointmentId, orgId, patientId },
  });
  if (!appointment) {
    throw new ValidationError('Appointment not found for this patient');
  }
}

export async function uploadDocument(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  file: Express.Multer.File,
  input: UploadDocumentInput,
) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError('File size exceeds 20MB limit');
  }

  const detectedMime = file.mimetype as string;
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(detectedMime)) {
    throw new ValidationError(`Unsupported file type: ${detectedMime}`);
  }

  if (auth.role === 'patient') {
    const patient = await repo.findPatientByUserId(tenantPrisma, auth.userId);
    if (!patient || patient.id !== input.patientId) {
      throw new ForbiddenError('Access denied');
    }
  }

  if (input.appointmentId) {
    await assertAppointmentForPatient(
      tenantPrisma,
      auth.orgId,
      input.patientId,
      input.appointmentId,
    );
  }

  const orgSlug = auth.orgId.replace(/-/g, '').slice(0, 12);
  const bucket = `${orgSlug}-documents`;
  const ext = path.extname(file.originalname) || '';
  const documentId = uuidv4();
  const storageKey = `${input.patientId}/${documentId}${ext}`;

  const storage = getStorageAdapter();
  await storage.upload({
    bucket,
    key: storageKey,
    body: file.buffer,
    contentType: detectedMime,
    metadata: {
      orgId: auth.orgId,
      patientId: input.patientId,
      uploadedBy: auth.userId,
      ...(input.appointmentId && { appointmentId: input.appointmentId }),
    },
  });

  const document = await repo.createDocument(tenantPrisma, {
    id: documentId,
    orgId: auth.orgId,
    patientId: input.patientId,
    appointmentId: input.appointmentId ?? null,
    uploadedBy: auth.userId,
    fileName: file.originalname,
    fileSizeBytes: file.size,
    mimeType: detectedMime,
    storageBucket: bucket,
    storageKey,
    documentType: input.documentType,
  });

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  await documentQueue.add('document.process', {
    tenantDbUrl,
    orgId: auth.orgId,
    documentId,
  });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'UPLOAD_DOCUMENT',
    resourceType: 'Document',
    resourceId: documentId,
    metadata: {
      patientId: input.patientId,
      ...(input.appointmentId && { appointmentId: input.appointmentId }),
    },
  });

  return {
    ...document,
    fileSize: fileSizeBytesOf(document),
    createdAt: document.createdAt.toISOString(),
    appointment: null,
  };
}

export async function uploadDocuments(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  files: Express.Multer.File[],
  input: UploadDocumentInput,
): Promise<UploadDocumentsResult> {
  if (!files.length) {
    throw new ValidationError('At least one file is required');
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw new ValidationError(`You can upload up to ${MAX_FILES_PER_UPLOAD} files at once`);
  }

  const documents: UploadDocumentsResult['documents'] = [];
  const failed: UploadDocumentsResult['failed'] = [];

  for (const file of files) {
    try {
      const doc = await uploadDocument(auth, tenantPrisma, file, input);
      documents.push(doc);
    } catch (err: unknown) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Upload failed';
      failed.push({ fileName: file.originalname, message });
    }
  }

  if (!documents.length) {
    const detail = failed.map((f) => `${f.fileName}: ${f.message}`).join('; ');
    throw new ValidationError(detail || 'All uploads failed');
  }

  return { documents, failed };
}

export async function listDocuments(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  options: {
    page: number;
    limit: number;
    patientId?: string;
    doctorId?: string;
    appointmentId?: string;
  },
) {
  const skip = (options.page - 1) * options.limit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { orgId: auth.orgId };

  if (auth.role === 'patient') {
    const patient = await repo.findPatientByUserId(tenantPrisma, auth.userId);
    if (!patient) {
      return { documents: [], total: 0, page: options.page, limit: options.limit };
    }
    where['patientId'] = patient.id;
    if (!options.doctorId) {
      return { documents: [], total: 0, page: options.page, limit: options.limit };
    }
  } else {
    if (!options.patientId) {
      return { documents: [], total: 0, page: options.page, limit: options.limit };
    }
    where['patientId'] = options.patientId;
  }

  if (options.appointmentId) {
    where['OR'] = [
      { appointmentId: options.appointmentId },
      { appointmentId: null },
    ];
  } else if (options.doctorId) {
    where['OR'] = [
      { appointment: { doctorId: options.doctorId } },
      { appointmentId: null },
    ];
  }

  const [documents, total] = await Promise.all([
    repo.listDocuments(tenantPrisma, where, { skip, take: options.limit }),
    repo.countDocuments(tenantPrisma, where),
  ]);

  return {
    documents: documents.map(serializeDocument),
    total,
    page: options.page,
    limit: options.limit,
  };
}

async function getDocumentForRead(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  documentId: string,
) {
  const document = await repo.findDocumentById(tenantPrisma, documentId);
  if (!document || document.orgId !== auth.orgId) throw new NotFoundError('Document not found');

  if (auth.role === 'patient') {
    const patient = await repo.findPatientByUserId(tenantPrisma, auth.userId);
    if (!patient || document.patientId !== patient.id) {
      throw new ForbiddenError('Access denied');
    }
  }

  return document;
}

export async function getDocument(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  documentId: string,
) {
  const document = await getDocumentForRead(auth, tenantPrisma, documentId);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'READ_RECORD',
    resourceType: 'Document',
    resourceId: documentId,
  });

  return {
    ...document,
    fileSize: fileSizeBytesOf(document),
    createdAt: document.createdAt.toISOString(),
  };
}

export async function getDocumentPreviewContent(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  documentId: string,
) {
  const document = await getDocumentForRead(auth, tenantPrisma, documentId);

  const storage = getStorageAdapter();
  const buffer = await storage.download(document.storageBucket, document.storageKey);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'READ_RECORD',
    resourceType: 'Document',
    resourceId: documentId,
    metadata: { preview: true },
  });

  return {
    buffer,
    mimeType: document.mimeType,
    fileName: document.fileName,
  };
}

export async function reprocessDocument(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  documentId: string,
) {
  const document = await repo.findDocumentById(tenantPrisma, documentId);
  if (!document || document.orgId !== auth.orgId) throw new NotFoundError('Document not found');

  await tenantPrisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'pending', extractedText: null },
  });

  const tenantDbUrl = await getTenantDbUrl(auth.orgId);
  await documentQueue.add('document.process', {
    tenantDbUrl,
    orgId: auth.orgId,
    documentId,
  });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'UPLOAD_DOCUMENT',
    resourceType: 'Document',
    resourceId: documentId,
    metadata: { reprocess: true },
  });

  return { id: documentId, processingStatus: 'pending' as const };
}

export async function deleteDocument(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  documentId: string,
) {
  const document = await repo.findDocumentById(tenantPrisma, documentId);
  if (!document || document.orgId !== auth.orgId) throw new NotFoundError('Document not found');

  const storage = getStorageAdapter();

  await tenantPrisma.vectorChunk.deleteMany({ where: { documentId } });
  await storage.delete(document.storageBucket, document.storageKey);
  await repo.deleteDocument(tenantPrisma, documentId);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'DELETE_DOCUMENT',
    resourceType: 'Document',
    resourceId: documentId,
  });
}
