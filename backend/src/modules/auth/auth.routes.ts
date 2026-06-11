import { Router } from 'express';
import { asyncHandler } from '../../core/async-handler.js';
import { validate } from '../../lib/middleware/validate.middleware.js';
import { authRateLimiter } from '../../lib/middleware/rate-limit.middleware.js';
import { authenticate } from '../../lib/middleware/auth.middleware.js';
import { resolveTenant } from '../../lib/middleware/tenant.middleware.js';
import * as service from './auth.service.js';
import {
  registerOrgSchema,
  loginSchema,
  refreshTokenSchema,
  mfaVerifySchema,
  mfaSetupVerifySchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  trustedDeviceIdParamSchema,
  registerTrustedDeviceSchema,
} from './auth.schema.js';
import { v4 as uuidv4 } from 'uuid';

export const authRoutes = Router();

authRoutes.post(
  '/register-org',
  authRateLimiter,
  validate({ body: registerOrgSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.registerOrg(req.body);
    res.status(201).json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body, req.headers['user-agent']);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.refreshTokens(req.body.refreshToken);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await service.logout(req.auth.userId);
    res.json({
      data: { success: true },
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.get(
  '/me',
  authenticate,
  resolveTenant,
  asyncHandler(async (req, res) => {
    const result = await service.getMe(req.auth, req.tenantPrisma);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/change-password',
  authenticate,
  authRateLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.changePassword(req.auth.userId, req.body);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.forgotPassword(req.body);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.resetPassword(req.body);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/mfa/setup',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await service.setupMfa(req.auth.userId);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/mfa/verify',
  authRateLimiter,
  validate({ body: mfaVerifySchema }),
  asyncHandler(async (req, res) => {
    const result = await service.verifyMfa(req.body, req.headers['user-agent']);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/trusted-devices',
  authenticate,
  validate({ body: registerTrustedDeviceSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.registerTrustedDevice(
      req.auth.userId,
      req.body.deviceId,
      req.headers['user-agent'],
    );
    res.status(201).json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.get(
  '/trusted-devices',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await service.listTrustedDevices(req.auth.userId);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.delete(
  '/trusted-devices/:id',
  authenticate,
  validate({ params: trustedDeviceIdParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.revokeTrustedDevice(req.auth.userId, req.params.id);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);

authRoutes.post(
  '/mfa/confirm-setup',
  authenticate,
  validate({ body: mfaSetupVerifySchema }),
  asyncHandler(async (req, res) => {
    const result = await service.confirmMfaSetup(req.auth.userId, req.body.code);
    res.json({
      data: result,
      meta: { requestId: uuidv4(), timestamp: new Date().toISOString() },
    });
  }),
);
