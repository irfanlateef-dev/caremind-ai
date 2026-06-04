import { apiClient, unwrap } from './client';
import {
  listQueryParams,
  mapAdminDashboard,
  mapAuditLog,
  toPaginatedResponse,
} from './mappers';
import type { AdminDashboardData, AuditLog, PaginatedResponse } from '@/types';
import type { AdminDateRangeParams } from '@/features/admin/admin-date-range';
import { buildAdminDateQueryParams } from '@/features/admin/admin-date-range';

export interface ListAuditLogsParams {
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

interface BackendAuditLogRow {
  id: string;
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  createdAt: string;
  metadata?: unknown;
  ipAddress?: string | null;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  summary?: string;
}

interface BackendAuditLogsPage {
  logs: BackendAuditLogRow[];
  total: number;
  page: number;
  limit: number;
}

export const adminApi = {
  /** GET /api/admin/dashboard */
  getDashboard: async (range: AdminDateRangeParams): Promise<AdminDashboardData> => {
    const res = await apiClient.get('/api/admin/dashboard', {
      params: buildAdminDateQueryParams(range),
    });
    const raw = unwrap(res) as Parameters<typeof mapAdminDashboard>[0];
    return mapAdminDashboard(raw);
  },

  /** GET /api/admin/activity — recent audit log entries */
  getRecentActivity: async (): Promise<AuditLog[]> => {
    const res = await apiClient.get('/api/admin/activity');
    const raw = unwrap(res) as BackendAuditLogsPage['logs'];
    return (raw ?? []).map(mapAuditLog);
  },

  /** GET /api/admin/audit-logs */
  listAuditLogs: async (params?: ListAuditLogsParams): Promise<PaginatedResponse<AuditLog>> => {
    const res = await apiClient.get('/api/admin/audit-logs', {
      params: listQueryParams(params as Record<string, string | number | undefined>),
    });
    const data = unwrap(res) as BackendAuditLogsPage;
    return toPaginatedResponse(
      (data.logs ?? []).map(mapAuditLog),
      data.total ?? 0,
      data.page ?? 1,
      data.limit ?? 20
    );
  },
};

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: (range: AdminDateRangeParams) => ['admin', 'dashboard', range] as const,
  activity: ['admin', 'activity'] as const,
  auditLogs: ['admin', 'audit-logs'] as const,
  auditLogsList: (params?: ListAuditLogsParams) => ['admin', 'audit-logs', 'list', params] as const,
};
