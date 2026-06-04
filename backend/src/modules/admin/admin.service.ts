import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import { getCentralPrisma } from '../../core/tenant-registry.js';
import { auditLog } from '../../core/audit-logger.js';
import type { AuthContext } from '../../types/auth.js';
import { enrichAuditLogs } from './audit-log-enrichment.js';
import * as userRepo from '../users/users.repository.js';
import {
  buildAppointmentStatusBreakdown,
  buildAppointmentTimeSeries,
} from './admin.analytics.js';
import { resolveAdminDateRange } from './admin.date-range.js';
import type { DashboardQueryInput } from './admin.schema.js';
import { auditLogQuerySchema } from './admin.schema.js';
import type { z } from 'zod';

export { auditLogQuerySchema };

export async function getDashboard(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  query: DashboardQueryInput,
) {
  const central = getCentralPrisma();
  const { from, to, preset } = resolveAdminDateRange(query);

  const orgWhere = { orgId: auth.orgId };
  const periodWhere = {
    ...orgWhere,
    scheduledAt: { gte: from, lte: to },
  };

  const orgId = auth.orgId;

  const [doctors, patients, periodAppointments, appointmentRows] = await Promise.all([
      userRepo.countCentralUsers(central, orgId, 'doctor'),
      userRepo.countCentralUsers(central, orgId, 'patient'),
      tenantPrisma.appointment.count({ where: periodWhere }),
      tenantPrisma.appointment.findMany({
        where: periodWhere,
        select: { scheduledAt: true, status: true },
      }),
    ]);

  const totalUsers = doctors + patients;

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'READ_RECORD',
    resourceType: 'Dashboard',
    resourceId: auth.orgId,
  });

  return {
    totalUsers,
    doctors,
    patients,
    appointments: periodAppointments,
    period: {
      preset,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    timeSeries: buildAppointmentTimeSeries(appointmentRows, from, to),
    statusBreakdown: buildAppointmentStatusBreakdown(appointmentRows),
  };
}

export async function getAuditLogs(
  auth: AuthContext,
  tenantPrisma: PrismaClient,
  query: z.infer<typeof auditLogQuerySchema>,
) {
  const { page, limit, userId, action, resourceType, from, to } = query;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { orgId: auth.orgId };
  if (userId) where['userId'] = userId;
  if (action) where['action'] = action;
  if (resourceType) where['resourceType'] = resourceType;
  if (from || to) {
    where['createdAt'] = {};
    if (from) where['createdAt']['gte'] = new Date(from);
    if (to) where['createdAt']['lte'] = new Date(to);
  }

  const [logs, total] = await Promise.all([
    tenantPrisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    tenantPrisma.auditLog.count({ where }),
  ]);

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'VIEW_AUDIT_LOG',
    resourceType: 'AuditLog',
    resourceId: auth.orgId,
  });

  const enriched = await enrichAuditLogs(auth.orgId, tenantPrisma, logs);
  return { logs: enriched, total, page, limit };
}

export async function getRecentActivity(auth: AuthContext, tenantPrisma: PrismaClient) {
  const recentLogs = await tenantPrisma.auditLog.findMany({
    where: { orgId: auth.orgId },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
  return enrichAuditLogs(auth.orgId, tenantPrisma, recentLogs);
}
