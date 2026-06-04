// ─── Enums ────────────────────────────────────────────────────────────────────

export const UserRole = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const ConsentStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
} as const;
export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus];

export const AiOutputType = {
  SOAP_NOTE: 'soap_note',
  CLINICAL_SUMMARY: 'clinical_summary',
  PATIENT_SUMMARY: 'patient_summary',
  FOLLOWUP_INSTRUCTIONS: 'follow_up_instructions',
} as const;
export type AiOutputType = (typeof AiOutputType)[keyof typeof AiOutputType];

export const AiOutputStatus = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EDITED: 'edited',
} as const;
export type AiOutputStatus = (typeof AiOutputStatus)[keyof typeof AiOutputStatus];

export const DocumentProcessingStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
} as const;
export type DocumentProcessingStatus =
  (typeof DocumentProcessingStatus)[keyof typeof DocumentProcessingStatus];

// ─── Core Entities ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  orgId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  mfaEnabled?: boolean;
  /** False for @demo.clinic seed accounts — MFA cannot be enabled. */
  mfaEligible?: boolean;
  lastLogin?: string;
  createdAt?: string;
  patientProfileId?: string;
  primaryDoctorId?: string | null;
  primaryDoctorName?: string | null;
}

export interface AuthContext {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Doctor {
  id: string;
  userId: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  specialty?: string;
  licenseNumber?: string;
  user?: User;
}

export const PatientGender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'prefer_not_to_say',
} as const;
export type PatientGender = (typeof PatientGender)[keyof typeof PatientGender];

export interface Patient {
  id: string;
  userId: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: PatientGender | null;
  dateOfBirth?: string | null;
  phone?: string;
  sessionCount?: number;
  user?: User;
}

export interface PatientSession {
  id: string;
  scheduledAt: string;
  status: AppointmentStatus;
  consentStatus: ConsentStatus;
  doctor: { id: string; firstName: string; lastName: string } | null;
}

export interface Appointment {
  id: string;
  orgId: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  consentStatus: ConsentStatus;
  livekitRoomName?: string;
  patient?: Patient;
  doctor?: Doctor;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationRecording {
  id: string;
  appointmentId: string;
  orgId: string;
  startedAt: string;
  endedAt?: string;
  deepgramJobId?: string;
  status: 'recording' | 'processing' | 'done' | 'failed';
}

export interface TranscriptSegmentView {
  speaker: string;
  speakerRole?: 'doctor' | 'patient';
  text: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface Transcript {
  id: string;
  appointmentId: string;
  orgId: string;
  content: string;
  segments?: TranscriptSegmentView[];
  isLive?: boolean;
  deepgramResponse?: unknown;
  createdAt: string;
}

export interface AiOutput {
  id: string;
  appointmentId: string;
  orgId: string;
  patientId: string;
  type: AiOutputType;
  status: AiOutputStatus;
  originalContent: string;
  currentContent: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAppointmentRef {
  id: string;
  scheduledAt: string;
}

export interface Document {
  id: string;
  orgId: string;
  patientId: string;
  appointmentId?: string | null;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  processingStatus: DocumentProcessingStatus;
  extractedText?: string;
  documentType?: string;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  appointment?: DocumentAppointmentRef | null;
  signedUrl?: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: User;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  summary?: string;
}

export interface AdminDashboardData {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  appointmentsInPeriod: number;
  period: {
    preset: string;
    from: string;
    to: string;
  };
  timeSeries: { date: string; count: number }[];
  statusBreakdown: { status: string; label: string; count: number }[];
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Auth API Types ───────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceId?: string;
}

export interface LoginResponse {
  requiresMfa: boolean;
  mfaToken?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  code: string;
  rememberMe?: boolean;
}

export interface TrustedDevice {
  id: string;
  deviceName: string;
  trustedUntil: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface RegisterOrgRequest {
  orgName: string;
  orgSlug: string;
  adminEmail: string;
  adminPassword: string;
}

export interface InviteUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: 'doctor' | 'patient';
  gender?: PatientGender;
  doctorId?: string;
  specialty?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface LiveKitTokenResponse {
  token: string;
  roomName: string;
  livekitUrl: string;
}

export interface MfaSetupResponse {
  otpAuthUrl: string;
  secret: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  escalated?: boolean;
}
