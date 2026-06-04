/**
 * Seeds Demo Clinic org with admin / doctor / patient (@demo.clinic).
 * Run: cd backend && npm run seed
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { validateEnv } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  buildTenantDbUrl,
  createTenantDatabase,
  getCentralPrisma,
} from '../core/tenant-registry.js';
import { getTenantPrisma } from '../core/tenant-prisma.js';
import {
  DEMO_ORG_SLUG,
  DEMO_SEED_EMAILS,
  type DemoSeedEmail,
} from '../core/demo-users.js';
import * as authRepo from '../modules/auth/auth.repository.js';
import * as usersRepo from '../modules/users/users.repository.js';

const BCRYPT_ROUNDS = 12;
const DEMO_ORG_NAME = 'Demo Clinic';
const DEFAULT_DEMO_PASSWORD = 'Demo123!';

type SeedUserSpec = {
  email: DemoSeedEmail;
  role: 'admin' | 'doctor' | 'patient';
  firstName: string;
  lastName: string;
};

const SEED_USERS: SeedUserSpec[] = [
  { email: 'admin@demo.clinic', role: 'admin', firstName: 'Demo', lastName: 'Admin' },
  { email: 'doctor@demo.clinic', role: 'doctor', firstName: 'Demo', lastName: 'Doctor' },
  { email: 'patient@demo.clinic', role: 'patient', firstName: 'Demo', lastName: 'Patient' },
];

async function ensureDemoOrg(): Promise<{ orgId: string; dbUrl: string; created: boolean }> {
  const central = getCentralPrisma();
  const existing = await authRepo.findOrgBySlug(central, DEMO_ORG_SLUG);

  if (existing) {
    return { orgId: existing.id, dbUrl: existing.dbUrl, created: false };
  }

  const orgId = uuidv4();
  const dbUrl = await createTenantDatabase(orgId, DEMO_ORG_SLUG);
  await authRepo.createOrg(central, {
    id: orgId,
    name: DEMO_ORG_NAME,
    slug: DEMO_ORG_SLUG,
    dbUrl,
  });

  return { orgId, dbUrl, created: true };
}

async function upsertCentralUser(
  orgId: string,
  spec: SeedUserSpec,
  passwordHash: string,
): Promise<string> {
  const central = getCentralPrisma();
  const existing = await central.user.findUnique({ where: { email: spec.email } });

  if (existing) {
    await central.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: spec.role,
        orgId,
        mfaEnabled: false,
        mfaSecret: null,
        deletedAt: null,
      },
    });
    return existing.id;
  }

  const userId = uuidv4();
  await authRepo.createUser(central, {
    id: userId,
    email: spec.email,
    passwordHash,
    role: spec.role,
    orgId,
  });
  await central.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null },
  });
  return userId;
}

async function ensureTenantProfiles(
  orgId: string,
  dbUrl: string,
  userIds: Record<DemoSeedEmail, string>,
): Promise<void> {
  const tenant = getTenantPrisma(dbUrl);

  const doctorExisting = await tenant.doctor.findFirst({
    where: { userId: userIds['doctor@demo.clinic'], orgId },
  });
  let doctorId = doctorExisting?.id;
  if (!doctorId) {
    doctorId = uuidv4();
    await usersRepo.createDoctorProfile(tenant, {
      id: doctorId,
      userId: userIds['doctor@demo.clinic'],
      orgId,
      firstName: 'Demo',
      lastName: 'Doctor',
      specialty: 'General Practice',
    });
  }

  const patientExisting = await tenant.patient.findFirst({
    where: { userId: userIds['patient@demo.clinic'], orgId },
  });
  if (!patientExisting) {
    await usersRepo.createPatientProfile(tenant, {
      id: uuidv4(),
      userId: userIds['patient@demo.clinic'],
      orgId,
      primaryDoctorId: doctorId,
      firstName: 'Demo',
      lastName: 'Patient',
      gender: 'prefer_not_to_say',
    });
  } else if (!patientExisting.primaryDoctorId) {
    await tenant.patient.update({
      where: { id: patientExisting.id },
      data: { primaryDoctorId: doctorId },
    });
  }
}

async function main(): Promise<void> {
  validateEnv();

  const password = process.env['SEED_DEMO_PASSWORD'] ?? DEFAULT_DEMO_PASSWORD;
  if (password.length < 8) {
    throw new Error('SEED_DEMO_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { orgId, dbUrl, created } = await ensureDemoOrg();

  const userIds = {} as Record<DemoSeedEmail, string>;
  for (const spec of SEED_USERS) {
    userIds[spec.email] = await upsertCentralUser(orgId, spec, passwordHash);
  }

  await ensureTenantProfiles(orgId, dbUrl, userIds);

  const central = getCentralPrisma();
  await central.$disconnect();

  logger.info(
    {
      orgSlug: DEMO_ORG_SLUG,
      orgId,
      createdOrg: created,
      emails: DEMO_SEED_EMAILS,
      passwordHint: 'Use SEED_DEMO_PASSWORD or default Demo123!',
    },
    'Demo seed complete',
  );

  console.log('\nDemo Clinic seed complete');
  console.log(`  Organization: ${DEMO_ORG_NAME} (${DEMO_ORG_SLUG})`);
  console.log(`  Tenant DB: ${buildTenantDbUrl(orgId).replace(/:[^:@]+@/, ':***@')}`);
  console.log('  Accounts (MFA disabled):');
  for (const email of DEMO_SEED_EMAILS) {
    console.log(`    - ${email}`);
  }
  console.log(`  Password: ${password}\n`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
