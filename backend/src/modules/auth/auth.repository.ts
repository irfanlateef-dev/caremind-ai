import crypto from 'crypto';
import type { PrismaClient as CentralPrisma } from '../../../node_modules/.prisma/central-client/index.js';
import type { TrustedDevice } from '../../lib/prisma/central-prisma.types.js';
import type { UserRole } from '../../types/auth.js';

export async function findUserByEmail(prisma: CentralPrisma, email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
}

export async function findUserById(prisma: CentralPrisma, id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function findOrgBySlug(prisma: CentralPrisma, slug: string) {
  return prisma.organization.findUnique({ where: { slug } });
}

export async function createOrg(
  prisma: CentralPrisma,
  data: { id: string; name: string; slug: string; dbUrl: string },
) {
  return prisma.organization.create({ data });
}

export async function createUser(
  prisma: CentralPrisma,
  data: {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    orgId: string;
  },
) {
  return prisma.user.create({ data: { ...data, role: data.role } });
}

export async function saveRefreshToken(
  prisma: CentralPrisma,
  data: { id: string; userId: string; tokenHash: string; expiresAt: Date },
) {
  return prisma.refreshToken.create({ data });
}

export async function findRefreshToken(prisma: CentralPrisma, tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export async function revokeRefreshToken(prisma: CentralPrisma, id: string) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(
  prisma: CentralPrisma,
  userId: string,
) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function updateUserMfa(
  prisma: CentralPrisma,
  userId: string,
  data: { mfaEnabled: boolean; mfaSecret?: string | null },
) {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function updateLastLogin(prisma: CentralPrisma, userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export async function updatePasswordHash(
  prisma: CentralPrisma,
  userId: string,
  passwordHash: string,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function findActiveTrustedDevice(
  prisma: CentralPrisma,
  userId: string,
  deviceHash: string,
) {
  return prisma.trustedDevice.findFirst({
    where: {
      userId,
      deviceHash,
      trustedUntil: { gt: new Date() },
    },
  });
}

export async function upsertTrustedDevice(
  prisma: CentralPrisma,
  data: {
    userId: string;
    deviceHash: string;
    deviceName: string;
    trustedUntil: Date;
  },
) {
  return prisma.trustedDevice.upsert({
    where: {
      userId_deviceHash: { userId: data.userId, deviceHash: data.deviceHash },
    },
    create: {
      id: crypto.randomUUID(),
      userId: data.userId,
      deviceHash: data.deviceHash,
      deviceName: data.deviceName,
      trustedUntil: data.trustedUntil,
      lastUsedAt: new Date(),
    },
    update: {
      deviceName: data.deviceName,
      trustedUntil: data.trustedUntil,
      lastUsedAt: new Date(),
    },
  });
}

export async function touchTrustedDevice(prisma: CentralPrisma, id: string) {
  return prisma.trustedDevice.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

export async function listTrustedDevices(
  prisma: CentralPrisma,
  userId: string,
): Promise<TrustedDevice[]> {
  return prisma.trustedDevice.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
  });
}

export async function findTrustedDeviceById(prisma: CentralPrisma, id: string, userId: string) {
  return prisma.trustedDevice.findFirst({
    where: { id, userId },
  });
}

export async function deleteTrustedDevice(prisma: CentralPrisma, id: string) {
  return prisma.trustedDevice.delete({ where: { id } });
}

export async function deleteUnusedPasswordResetTokens(
  prisma: CentralPrisma,
  userId: string,
) {
  return prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });
}

export async function createPasswordResetToken(
  prisma: CentralPrisma,
  data: { id: string; userId: string; tokenHash: string; expiresAt: Date },
) {
  return prisma.passwordResetToken.create({ data });
}

export async function findValidPasswordResetToken(
  prisma: CentralPrisma,
  tokenHash: string,
) {
  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function markPasswordResetTokenUsed(prisma: CentralPrisma, id: string) {
  return prisma.passwordResetToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}
