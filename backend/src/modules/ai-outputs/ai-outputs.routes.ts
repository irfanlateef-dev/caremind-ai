import { Router } from 'express';
import { asyncHandler } from '../../core/async-handler.js';
import { validate } from '../../lib/middleware/validate.middleware.js';
import * as service from './ai-outputs.service.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const aiOutputRoutes = Router();

aiOutputRoutes.get(
  '/appointment/:appointmentId/generation-status',
  asyncHandler(async (req, res) => {
    const result = await service.getGenerationStatus(
      req.auth,
      req.tenantPrisma,
      req.params['appointmentId']!,
    );
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.post(
  '/appointment/:appointmentId/retry-generation',
  asyncHandler(async (req, res) => {
    const result = await service.retryGeneration(
      req.auth,
      req.tenantPrisma,
      req.params['appointmentId']!,
    );
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.get(
  '/appointment/:appointmentId',
  asyncHandler(async (req, res) => {
    const result = await service.listOutputsForAppointment(
      req.auth,
      req.tenantPrisma,
      req.params['appointmentId']!,
    );
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.patch(
  '/:id/save',
  validate({ body: service.saveOutputSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.saveOutput(
      req.auth,
      req.tenantPrisma,
      req.params['id']!,
      req.body.content,
    );
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.patch(
  '/:id/approve',
  validate({ body: z.object({ editedContent: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await service.approveOutput(
      req.auth,
      req.tenantPrisma,
      req.params['id']!,
      req.body.editedContent,
    );
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const result = await service.rejectOutput(req.auth, req.tenantPrisma, req.params['id']!);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

aiOutputRoutes.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const result = await service.getOutputHistory(req.auth, req.tenantPrisma, req.params['id']!);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);
