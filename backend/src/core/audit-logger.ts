import type { PrismaClient } from '../../node_modules/.prisma/tenant-client/index.js';
import { logger } from '../config/logger.js';

export type AuditAction =
  | 'READ_RECORD'
  | 'WRITE_NOTE'
  | 'APPROVE_OUTPUT'
  | 'REJECT_OUTPUT'
  | 'RETRY_AI_GENERATION'
  | 'EDIT_OUTPUT'
  | 'UPLOAD_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'JOIN_CONSULTATION'
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'RECORD_CONSENT'
  | 'INVITE_USER'
  | 'DELETE_USER'
  | 'REGISTER_ORG'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SETUP_MFA'
  | 'VERIFY_MFA'
  | 'AI_CHAT'
  | 'EXPORT_PDF'
  | 'VIEW_AUDIT_LOG';

export async function auditLog(params: {
  tenantPrisma: PrismaClient;
  userId: string;
  orgId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await params.tenantPrisma.auditLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (params.metadata ?? {}) as any,
      },
    });
  } catch (err) {
    logger.warn({ err, ...params }, 'Audit log write failed — non-blocking');
  }
}
