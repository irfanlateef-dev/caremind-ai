import { z } from 'zod';

export const registerOrgSchema = z.object({
  orgName: z.string().min(2).max(100),
  orgSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});

const deviceIdSchema = z.string().uuid('Invalid device id');

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
  deviceId: deviceIdSchema.optional(),
});

export const loginContextSchema = z.object({
  rememberMe: z.boolean().optional().default(false),
  deviceId: deviceIdSchema.optional(),
  userAgent: z.string().optional(),
});

export const registerTrustedDeviceSchema = z.object({
  deviceId: deviceIdSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const mfaVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
  tempToken: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export const trustedDeviceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const mfaSetupVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8).max(128),
});

export type RegisterOrgInput = z.infer<typeof registerOrgSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginContext = z.infer<typeof loginContextSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type RegisterTrustedDeviceInput = z.infer<typeof registerTrustedDeviceSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
