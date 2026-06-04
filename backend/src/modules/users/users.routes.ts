import { Router } from 'express';
import { asyncHandler } from '../../core/async-handler.js';
import { validate } from '../../lib/middleware/validate.middleware.js';
import { requireRole } from '../../lib/middleware/auth.middleware.js';
import * as service from './users.service.js';
import {
  inviteDoctorSchema,
  invitePatientSchema,
  listUsersSchema,
} from './users.schema.js';
import { v4 as uuidv4 } from 'uuid';

export const usersRoutes = Router();

usersRoutes.post(
  '/invite-doctor',
  requireRole('admin'),
  validate({ body: inviteDoctorSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.inviteDoctor(req.auth, req.tenantPrisma, req.body);
    res.status(201).json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

usersRoutes.post(
  '/invite-patient',
  requireRole('admin', 'doctor'),
  validate({ body: invitePatientSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.invitePatient(req.auth, req.tenantPrisma, req.body);
    res.status(201).json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

usersRoutes.get(
  '/doctor-profiles',
  requireRole('admin', 'doctor'),
  asyncHandler(async (req, res) => {
    const doctors = await service.listDoctorProfiles(req.auth, req.tenantPrisma);
    res.json({
      data: { doctors },
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

usersRoutes.get(
  '/',
  requireRole('admin', 'doctor'),
  validate({ query: listUsersSchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as {
      page: string;
      limit: string;
      role?: string;
      doctorId?: string;
      search?: string;
    };
    const result = await service.listUsers(req.auth, req.tenantPrisma, {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      role: query.role,
      doctorId: query.doctorId,
      search: query.search,
    });
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

usersRoutes.delete(
  '/:id',
  requireRole('admin', 'doctor'),
  asyncHandler(async (req, res) => {
    await service.deleteUser(req.auth, req.tenantPrisma, req.params['id']!);
    res.json({
      data: { success: true },
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);
