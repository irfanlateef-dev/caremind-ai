import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';
import { getCentralPrisma } from '../../core/tenant-registry.js';
import { createTenantDatabase } from '../../core/tenant-registry.js';
import * as repo from './auth.repository.js';
import {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from '../../lib/middleware/auth.middleware.js';
import { getEmailAdapter } from '../../adapters/email/index.js';
import {
  AuthError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../core/errors.js';
import type {
  RegisterOrgInput,
  LoginInput,
  LoginContext,
  ChangePasswordInput,
  MfaVerifyInput,
} from './auth.schema.js';
import { resolveUserProfile } from './auth-profile.js';
import type { AuthContext } from '../../types/auth.js';
import type { PrismaClient as TenantPrisma } from '../../../node_modules/.prisma/tenant-client/index.js';
import type { TrustedDevice } from '../../lib/prisma/central-prisma.types.js';
import {
  refreshExpiresAt,
  refreshJwtExpiresIn,
  refreshJwtExpiresInFromDate,
  trustedDeviceExpiresAt,
} from './auth.session.js';
import { deviceNameFromUserAgent, hashDeviceId } from './auth.device.js';
import { isDemoAccountEmail } from '../../core/demo-users.js';

const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function loginContextFromInput(
  input: Pick<LoginInput, 'rememberMe' | 'deviceId'>,
  userAgent?: string,
): LoginContext {
  return {
    rememberMe: input.rememberMe ?? false,
    deviceId: input.deviceId,
    userAgent,
  };
}

async function isDeviceTrusted(
  central: ReturnType<typeof getCentralPrisma>,
  userId: string,
  deviceId: string | undefined,
): Promise<boolean> {
  if (!deviceId) return false;
  const deviceHash = hashDeviceId(deviceId);
  const trusted = await repo.findActiveTrustedDevice(central, userId, deviceHash);
  if (trusted) {
    await repo.touchTrustedDevice(central, trusted.id);
    return true;
  }
  return false;
}

async function registerTrustedDeviceRecord(
  central: ReturnType<typeof getCentralPrisma>,
  userId: string,
  deviceId: string,
  userAgent: string | undefined,
): Promise<void> {
  await repo.upsertTrustedDevice(central, {
    userId,
    deviceHash: hashDeviceId(deviceId),
    deviceName: deviceNameFromUserAgent(userAgent),
    trustedUntil: trustedDeviceExpiresAt(),
  });
}

export async function registerOrg(input: RegisterOrgInput) {
  const central = getCentralPrisma();

  const existing = await repo.findOrgBySlug(central, input.orgSlug);
  if (existing) throw new ConflictError(`Organization slug '${input.orgSlug}' is taken`);

  const orgId = uuidv4();
  const dbUrl = await createTenantDatabase(orgId, input.orgSlug);

  await repo.createOrg(central, { id: orgId, name: input.orgName, slug: input.orgSlug, dbUrl });

  const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS);
  const userId = uuidv4();
  await repo.createUser(central, {
    id: userId,
    email: input.adminEmail,
    passwordHash,
    role: 'admin',
    orgId,
  });

  const emailAdapter = getEmailAdapter();
  await emailAdapter.send({
    to: input.adminEmail,
    subject: 'Welcome to CareMind AI',
    html: `<p>Your organization <strong>${input.orgName}</strong> is ready. Login at your admin portal.</p>`,
  }).catch(() => { /* non-blocking */ });

  return issueTokenPair(userId, orgId, 'admin', central, { rememberMe: true });
}

export async function login(input: LoginInput, userAgent?: string) {
  const central = getCentralPrisma();
  const user = await repo.findUserByEmail(central, input.email);
  const ctx = loginContextFromInput(input, userAgent);

  if (!user || user.deletedAt) throw new AuthError('Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError('Invalid credentials');

  const role = user.role as 'patient' | 'doctor' | 'admin';

  if (user.mfaEnabled && !isDemoAccountEmail(user.email)) {
    const trusted = await isDeviceTrusted(central, user.id, ctx.deviceId);
    if (!trusted) {
      const tempToken = issueAccessToken({
        sub: user.id,
        orgId: user.orgId,
        role: user.role as 'patient' | 'doctor' | 'admin',
      });
      return { requiresMfa: true, tempToken };
    }
  }

  await repo.updateLastLogin(central, user.id);
  return issueTokenPair(user.id, user.orgId, role, central, ctx);
}

export async function verifyMfa(input: MfaVerifyInput, userAgent?: string) {
  const central = getCentralPrisma();
  const ctx = loginContextFromInput(input, userAgent);

  let userId: string;
  try {
    const payload = await import('jsonwebtoken').then((jwt) =>
      jwt.default.verify(input.tempToken, process.env['JWT_SECRET']!) as { sub: string },
    );
    userId = payload.sub;
  } catch {
    throw new AuthError('Invalid or expired temp token');
  }

  const user = await repo.findUserById(central, userId);
  if (!user || !user.mfaSecret) throw new AuthError('MFA not configured');
  if (isDemoAccountEmail(user.email)) {
    throw new ValidationError('Two-factor authentication is not available for demo accounts');
  }

  const valid = authenticator.verify({ token: input.code, secret: user.mfaSecret });
  if (!valid) throw new ValidationError('Invalid MFA code');

  await repo.updateLastLogin(central, userId);
  const tokens = await issueTokenPair(
    userId,
    user.orgId,
    user.role as 'patient' | 'doctor' | 'admin',
    central,
    ctx,
  );
  return { ...tokens, promptTrustDevice: true };
}

export async function registerTrustedDevice(
  userId: string,
  deviceId: string,
  userAgent?: string,
) {
  const central = getCentralPrisma();
  const user = await repo.findUserById(central, userId);
  if (!user || user.deletedAt) throw new NotFoundError('User not found');
  if (isDemoAccountEmail(user.email)) {
    throw new ValidationError('Two-factor authentication is not available for demo accounts');
  }
  if (!user.mfaEnabled) {
    throw new ValidationError('Two-factor authentication must be enabled to trust a device');
  }

  await registerTrustedDeviceRecord(central, userId, deviceId, userAgent);
  return { success: true, trustedUntil: trustedDeviceExpiresAt().toISOString() };
}

export async function setupMfa(userId: string) {
  const central = getCentralPrisma();
  const user = await repo.findUserById(central, userId);
  if (!user) throw new NotFoundError('User not found');
  if (isDemoAccountEmail(user.email)) {
    throw new ValidationError('Two-factor authentication is not available for demo accounts');
  }

  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(user.email, 'CareMind AI', secret);

  await repo.updateUserMfa(central, userId, { mfaEnabled: false, mfaSecret: secret });

  return { secret, otpAuthUrl };
}

export async function confirmMfaSetup(userId: string, code: string) {
  const central = getCentralPrisma();
  const user = await repo.findUserById(central, userId);
  if (!user || !user.mfaSecret) throw new AuthError('MFA setup not initiated');
  if (isDemoAccountEmail(user.email)) {
    throw new ValidationError('Two-factor authentication is not available for demo accounts');
  }

  const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
  if (!valid) throw new ValidationError('Invalid MFA code');

  await repo.updateUserMfa(central, userId, { mfaEnabled: true });
  return { success: true };
}

export async function refreshTokens(rawToken: string) {
  const central = getCentralPrisma();
  const { sub: userId } = verifyRefreshToken(rawToken);
  const tokenHash = hashToken(rawToken);
  const stored = await repo.findRefreshToken(central, tokenHash);

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthError('Invalid refresh token');
  }

  await repo.revokeRefreshToken(central, stored.id);
  return issueTokenPair(
    userId,
    stored.user.orgId,
    stored.user.role as 'patient' | 'doctor' | 'admin',
    central,
    { expiresAt: stored.expiresAt },
  );
}

export async function logout(userId: string) {
  const central = getCentralPrisma();
  await repo.revokeAllUserRefreshTokens(central, userId);
}

export async function listTrustedDevices(userId: string) {
  const central = getCentralPrisma();
  const devices = await repo.listTrustedDevices(central, userId);
  const now = new Date();
  return devices.map((d: TrustedDevice) => ({
    id: d.id,
    deviceName: d.deviceName,
    trustedUntil: d.trustedUntil.toISOString(),
    lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    isActive: d.trustedUntil > now,
  }));
}

export async function revokeTrustedDevice(userId: string, deviceId: string) {
  const central = getCentralPrisma();
  const device = await repo.findTrustedDeviceById(central, deviceId, userId);
  if (!device) throw new NotFoundError('Trusted device not found');
  await repo.deleteTrustedDevice(central, deviceId);
  return { success: true };
}

export async function getMe(auth: AuthContext, tenantPrisma: TenantPrisma) {
  const central = getCentralPrisma();
  return resolveUserProfile(central, tenantPrisma, auth.userId);
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const central = getCentralPrisma();
  const user = await repo.findUserById(central, userId);
  if (!user || user.deletedAt) throw new NotFoundError('User not found');

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new AuthError('Current password is incorrect');

  const sameAsOld = await bcrypt.compare(input.newPassword, user.passwordHash);
  if (sameAsOld) throw new ValidationError('New password must be different from the current password');

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await repo.updatePasswordHash(central, userId, passwordHash);

  return { success: true };
}

type SessionOpts =
  | { rememberMe: boolean }
  | { expiresAt: Date };

async function issueTokenPair(
  userId: string,
  orgId: string,
  role: 'patient' | 'doctor' | 'admin',
  central: ReturnType<typeof getCentralPrisma>,
  session: SessionOpts,
) {
  const accessToken = issueAccessToken({ sub: userId, orgId, role });

  const expiresAt =
    'expiresAt' in session ? session.expiresAt : refreshExpiresAt(session.rememberMe);

  const jwtExpiresIn =
    'expiresAt' in session
      ? refreshJwtExpiresInFromDate(expiresAt)
      : refreshJwtExpiresIn(session.rememberMe);

  const rawRefresh = issueRefreshToken(userId, jwtExpiresIn);
  const tokenHash = hashToken(rawRefresh);

  await repo.saveRefreshToken(central, {
    id: uuidv4(),
    userId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken: rawRefresh };
}
