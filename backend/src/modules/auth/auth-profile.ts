import type { PrismaClient as CentralPrisma } from '../../../node_modules/.prisma/central-client/index.js';
import type { PrismaClient as TenantPrisma } from '../../../node_modules/.prisma/tenant-client/index.js';
import * as repo from './auth.repository.js';
import { NotFoundError } from '../../core/errors.js';
import { isDemoAccountEmail } from '../../core/demo-users.js';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (!local) return 'Administrator';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function resolveUserProfile(
  central: CentralPrisma,
  tenantPrisma: TenantPrisma,
  userId: string,
) {
  const user = await repo.findUserById(central, userId);
  if (!user || user.deletedAt) throw new NotFoundError('User not found');

  let firstName: string | undefined;
  let lastName: string | undefined;
  let name: string | undefined;

  if (user.role === 'doctor') {
    const doctor = await tenantPrisma.doctor.findFirst({
      where: { userId: user.id, orgId: user.orgId },
    });
    if (doctor) {
      firstName = doctor.firstName;
      lastName = doctor.lastName;
      name = `Dr. ${doctor.firstName} ${doctor.lastName}`.trim();
    }
  } else if (user.role === 'patient') {
    const patient = await tenantPrisma.patient.findFirst({
      where: { userId: user.id, orgId: user.orgId },
    });
    if (patient) {
      firstName = patient.firstName;
      lastName = patient.lastName;
      name = `${patient.firstName} ${patient.lastName}`.trim();
    }
  } else {
    name = displayNameFromEmail(user.email);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    firstName,
    lastName,
    name: name ?? displayNameFromEmail(user.email),
    mfaEnabled: user.mfaEnabled,
    mfaEligible: !isDemoAccountEmail(user.email),
    lastLogin: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
