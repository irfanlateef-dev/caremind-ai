import { normalizeAiOutputType } from '@/utils/ai-output-labels';
import type {
  AiOutput,
  Appointment,
  AuditLog,
  AdminDashboardData,
  Document,
  PaginatedResponse,
  User,
} from '@/types';

export function toPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const safeLimit = limit > 0 ? limit : 20;
  return {
    items,
    total,
    page,
    pageSize: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export function listQueryParams(
  params?: Record<string, string | number | undefined>
): Record<string, string | number> {
  const { pageSize, limit, page, ...rest } = params ?? {};
  const out: Record<string, string | number> = { page: page ?? 1, limit: limit ?? pageSize ?? 20 };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function mapAdminDashboard(raw: {
  totalUsers: number;
  doctors: number;
  patients: number;
  appointments: number;
  period: { preset: string; from: string; to: string };
  timeSeries: { date: string; count: number }[];
  statusBreakdown: { status: string; label: string; count: number }[];
}): AdminDashboardData {
  return {
    totalUsers: raw.totalUsers,
    totalDoctors: raw.doctors,
    totalPatients: raw.patients,
    appointmentsInPeriod: raw.appointments,
    period: raw.period,
    timeSeries: raw.timeSeries,
    statusBreakdown: raw.statusBreakdown,
  };
}

export function mapAuditLog(raw: {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  createdAt: string | Date;
  metadata?: unknown;
  ipAddress?: string | null;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  summary?: string;
}): AuditLog {
  const metadata = raw.metadata as Record<string, unknown> | undefined;
  return {
    id: raw.id,
    orgId: raw.orgId,
    userId: raw.userId,
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId ?? undefined,
    details: metadata,
    ipAddress: raw.ipAddress ?? undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt.toISOString(),
    userEmail: raw.userEmail,
    userName: raw.userName,
    userRole: raw.userRole,
    summary: raw.summary,
    user:
      raw.userEmail || raw.userName
        ? {
            id: raw.userId,
            email: raw.userEmail ?? '',
            role: (raw.userRole as User['role']) ?? 'admin',
            orgId: raw.orgId,
            name: raw.userName,
          }
        : undefined,
  };
}

export function mapCentralUser(raw: {
  id: string;
  email: string;
  role: User['role'];
  mfaEnabled: boolean;
  createdAt: Date | string;
  lastLoginAt?: Date | string | null;
  name?: string | null;
  patientProfileId?: string;
  primaryDoctorId?: string | null;
  primaryDoctorName?: string | null;
}): User {
  return {
    id: raw.id,
    email: raw.email,
    role: raw.role,
    orgId: '',
    name: raw.name ?? undefined,
    patientProfileId: raw.patientProfileId,
    primaryDoctorId: raw.primaryDoctorId,
    primaryDoctorName: raw.primaryDoctorName,
    mfaEnabled: raw.mfaEnabled,
    lastLogin: raw.lastLoginAt
      ? typeof raw.lastLoginAt === 'string'
        ? raw.lastLoginAt
        : raw.lastLoginAt.toISOString()
      : undefined,
    createdAt:
      typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt.toISOString(),
  };
}

function toIsoString(value: unknown, fallback?: unknown): string {
  const v = value ?? fallback;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return new Date().toISOString();
}

export function mapAppointment(raw: Record<string, unknown>): Appointment {
  const patient = raw.patient as Appointment['patient'] | undefined;
  const doctor = raw.doctor as Appointment['doctor'] | undefined;
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    patientId: String(raw.patientId),
    doctorId: String(raw.doctorId),
    scheduledAt: toIsoString(raw.scheduledAt),
    status: raw.status as Appointment['status'],
    consentStatus: raw.consentStatus as Appointment['consentStatus'],
    livekitRoomName: raw.livekitRoomName ? String(raw.livekitRoomName) : undefined,
    patient,
    doctor,
    createdAt: toIsoString(raw.createdAt),
    // Tenant schema has no updatedAt on appointments; fall back to createdAt
    updatedAt: toIsoString(raw.updatedAt, raw.createdAt),
  };
}

export function mapAiOutput(raw: Record<string, unknown>): AiOutput {
  const content = String(raw.content ?? '');
  const originalContent = String(raw.originalContent ?? content);
  return {
    id: String(raw.id),
    appointmentId: String(raw.appointmentId),
    orgId: String(raw.orgId),
    patientId: String(raw.patientId ?? ''),
    type: normalizeAiOutputType(String(raw.type)),
    status: raw.status as AiOutput['status'],
    originalContent,
    currentContent: content,
    reviewedAt: raw.reviewedAt
      ? typeof raw.reviewedAt === 'string'
        ? raw.reviewedAt
        : (raw.reviewedAt as Date).toISOString()
      : undefined,
    createdAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : (raw.createdAt as Date).toISOString(),
    updatedAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : (raw.createdAt as Date).toISOString(),
  };
}

function toIsoTimestamp(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value != null) {
    const parsed = new Date(value as string | number);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback ?? new Date().toISOString();
}

export function mapDocument(raw: Record<string, unknown>): Document {
  const createdAt = toIsoTimestamp(raw.createdAt);
  const appt = raw.appointment as Record<string, unknown> | null | undefined;
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    patientId: String(raw.patientId),
    appointmentId: raw.appointmentId != null ? String(raw.appointmentId) : null,
    uploadedBy: String(raw.uploadedBy),
    fileName: String(raw.fileName),
    fileType: String(raw.mimeType ?? raw.fileType ?? ''),
    fileSize: Number(raw.fileSize ?? 0),
    mimeType: String(raw.mimeType ?? ''),
    storagePath: String(raw.storageKey ?? raw.storagePath ?? ''),
    processingStatus: (raw.processingStatus ?? raw.status ?? 'pending') as Document['processingStatus'],
    documentType: raw.documentType ? String(raw.documentType) : undefined,
    createdAt,
    updatedAt: toIsoTimestamp(raw.updatedAt, createdAt),
    appointment: appt
      ? {
          id: String(appt.id),
          scheduledAt: toIsoTimestamp(appt.scheduledAt),
        }
      : null,
  };
}
