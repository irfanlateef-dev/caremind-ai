import { Router } from 'express';
import { asyncHandler } from '../../core/async-handler.js';
import { validate } from '../../lib/middleware/validate.middleware.js';
import * as service from './admin.service.js';
import { auditLogQuerySchema, dashboardQuerySchema } from './admin.schema.js';
import { v4 as uuidv4 } from 'uuid';

export const adminRoutes = Router();

adminRoutes.get(
  '/dashboard',
  validate({ query: dashboardQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = dashboardQuerySchema.parse(req.query);
    const result = await service.getDashboard(req.auth, req.tenantPrisma, query);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

adminRoutes.get(
  '/audit-logs',
  validate({ query: auditLogQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = auditLogQuerySchema.parse(req.query);
    const result = await service.getAuditLogs(req.auth, req.tenantPrisma, query);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

adminRoutes.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const result = await service.getRecentActivity(req.auth, req.tenantPrisma);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);
