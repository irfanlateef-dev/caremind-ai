import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getCentralPrisma } from '../../core/tenant-registry.js';
import type { PrismaClient as TenantPrisma } from '../../../node_modules/.prisma/tenant-client/index.js';
import * as repo from './users.repository.js';
import { getEmailAdapter } from '../../adapters/email/index.js';
import { auditLog } from '../../core/audit-logger.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import type { AuthContext } from '../../types/auth.js';
import type { InviteDoctorInput, InvitePatientInput } from './users.schema.js';

const BCRYPT_ROUNDS = 12;

function generateTempPassword(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export async function inviteDoctor(
  auth: AuthContext,
  tenantPrisma: TenantPrisma,
  input: InviteDoctorInput,
) {
  const central = getCentralPrisma();
  const existing = await central.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError(`User with email '${input.email}' already exists`);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const doctorId = uuidv4();

  await central.user.create({
    data: { id: userId, email: input.email, passwordHash, role: 'doctor', orgId: auth.orgId },
  });

  await repo.createDoctorProfile(tenantPrisma, {
    id: doctorId,
    userId,
    orgId: auth.orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    specialty: input.specialty,
    licenseNumber: input.licenseNumber,
  });

  const email = getEmailAdapter();
  await email.send({
    to: input.email,
    subject: 'You have been invited to CareMind AI',
    html: `<p>Welcome Dr. ${input.firstName} ${input.lastName}. Your temporary password is: <strong>${tempPassword}</strong>. Please log in and change it.</p>`,
  }).catch(() => { /* non-blocking */ });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'INVITE_USER',
    resourceType: 'Doctor',
    resourceId: doctorId,
  });

  return { userId, doctorId };
}

export async function invitePatient(
  auth: AuthContext,
  tenantPrisma: TenantPrisma,
  input: InvitePatientInput,
) {
  let primaryDoctorId: string | null = null;
  if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor) {
      throw new ForbiddenError('Doctor profile not found for this account');
    }
    primaryDoctorId = doctor.id;
  } else {
    if (!input.doctorId) {
      throw new ForbiddenError('doctorId is required when inviting a patient as admin');
    }
    primaryDoctorId = input.doctorId;
  }

  const central = getCentralPrisma();
  const existing = await central.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError(`User with email '${input.email}' already exists`);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const patientId = uuidv4();

  await central.user.create({
    data: { id: userId, email: input.email, passwordHash, role: 'patient', orgId: auth.orgId },
  });

  await repo.createPatientProfile(tenantPrisma, {
    id: patientId,
    userId,
    orgId: auth.orgId,
    primaryDoctorId,
    firstName: input.firstName,
    lastName: input.lastName,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    phone: input.phone,
  });

  const email = getEmailAdapter();
  await email.send({
    to: input.email,
    subject: 'Welcome to CareMind AI',
    html: `<p>Welcome ${input.firstName}. Your temporary password is: <strong>${tempPassword}</strong>.</p>`,
  }).catch(() => { /* non-blocking */ });

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'INVITE_USER',
    resourceType: 'Patient',
    resourceId: patientId,
  });

  return { userId, patientId };
}

export async function listUsers(
  auth: AuthContext,
  tenantPrisma: TenantPrisma,
  options: { page: number; limit: number; role?: string; doctorId?: string; search?: string },
) {
  if (auth.role === 'doctor') {
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor) throw new ForbiddenError('Doctor profile not found for this account');
    if (options.role && options.role !== 'patient') {
      throw new ForbiddenError("Doctors can only list role='patient'");
    }
  }

  const central = getCentralPrisma();
  const skip = (options.page - 1) * options.limit;
  let role = auth.role === 'doctor' ? 'patient' : options.role;
  let userIds: string[] | undefined;
  const searchQuery = options.search?.trim().toLowerCase();

  if (auth.role === 'admin' && options.doctorId) {
    role = 'patient';
    userIds = await repo.listPatientUserIdsByPrimaryDoctor(
      tenantPrisma,
      auth.orgId,
      options.doctorId,
    );
    if (userIds.length === 0) {
      return { users: [], total: 0, page: options.page, limit: options.limit };
    }
  }

  const [doctorNames, patientNames, patientAssignments] = await Promise.all([
    repo.listDoctorNamesByUserId(tenantPrisma, auth.orgId),
    repo.listPatientNamesByUserId(tenantPrisma, auth.orgId),
    repo.listPatientAssignmentsByOrg(tenantPrisma, auth.orgId),
  ]);

  const attachMeta = (
    rows: Awaited<ReturnType<typeof repo.listCentralUsers>>,
  ) =>
    rows.map((u) => {
      const name =
        u.role === 'doctor'
          ? doctorNames.get(u.id) ?? null
          : u.role === 'patient'
            ? patientNames.get(u.id) ?? null
            : null;
      const assignment = u.role === 'patient' ? patientAssignments.get(u.id) : undefined;
      return {
        ...u,
        name,
        patientProfileId: assignment?.patientProfileId,
        primaryDoctorId: assignment?.primaryDoctorId ?? null,
        primaryDoctorName: assignment?.primaryDoctorName ?? null,
      };
    });

  const matchesSearch = (u: ReturnType<typeof attachMeta>[number]) => {
    if (!searchQuery) return true;
    return (
      u.email.toLowerCase().includes(searchQuery) ||
      (u.name?.toLowerCase().includes(searchQuery) ?? false)
    );
  };

  if (searchQuery) {
    const allRows = await repo.listCentralUsers(central, auth.orgId, {
      skip: 0,
      take: 500,
      role,
      userIds,
    });
    const filtered = attachMeta(allRows).filter(matchesSearch);
    const total = filtered.length;
    const pageRows = filtered.slice(skip, skip + options.limit);
    return { users: pageRows, total, page: options.page, limit: options.limit };
  }

  const [users, total] = await Promise.all([
    repo.listCentralUsers(central, auth.orgId, { skip, take: options.limit, role, userIds }),
    repo.countCentralUsers(central, auth.orgId, role, userIds),
  ]);

  return {
    users: attachMeta(users),
    total,
    page: options.page,
    limit: options.limit,
  };
}

export async function listDoctorProfiles(auth: AuthContext, tenantPrisma: TenantPrisma) {
  if (auth.role === 'doctor') {
    const doctor = await tenantPrisma.doctor.findFirst({
      where: { userId: auth.userId, orgId: auth.orgId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    return doctor ? [doctor] : [];
  }
  if (auth.role !== 'admin') {
    throw new ForbiddenError('Admin role required');
  }

  const doctors = await repo.listDoctors(tenantPrisma, auth.orgId);
  if (doctors.length === 0) return [];

  const central = getCentralPrisma();
  const activeUsers = await central.user.findMany({
    where: { id: { in: doctors.map((d) => d.userId) }, deletedAt: null },
    select: { id: true, email: true },
  });
  const emailByUserId = new Map(activeUsers.map((u) => [u.id, u.email]));

  return doctors
    .filter((d) => emailByUserId.has(d.userId))
    .map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      email: emailByUserId.get(d.userId)!,
    }));
}

export async function deleteUser(
  auth: AuthContext,
  tenantPrisma: TenantPrisma,
  targetUserId: string,
) {
  if (targetUserId === auth.userId) {
    throw new ForbiddenError('Cannot delete your own account');
  }

  const central = getCentralPrisma();
  const user = await central.user.findUnique({
    where: { id: targetUserId },
    select: { role: true, orgId: true, deletedAt: true },
  });

  if (!user || user.orgId !== auth.orgId || user.deletedAt) {
    throw new NotFoundError('User not found');
  }
  if (user.role === 'admin') {
    throw new ForbiddenError('Cannot delete admin accounts');
  }

  if (auth.role === 'doctor') {
    if (user.role !== 'patient') {
      throw new ForbiddenError('Doctors can only remove patient accounts');
    }
    const doctor = await repo.findDoctorByUserId(tenantPrisma, auth.userId);
    if (!doctor || doctor.orgId !== auth.orgId || doctor.deletedAt) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const patient = await repo.findPatientByUserId(tenantPrisma, targetUserId);
    if (!patient || patient.orgId !== auth.orgId || patient.deletedAt) {
      throw new NotFoundError('Patient not found');
    }
    if (patient.primaryDoctorId !== doctor.id) {
      throw new ForbiddenError('You can only remove patients assigned to you');
    }
  }

  await repo.softDeleteUser(central, targetUserId);

  if (user?.role === 'doctor') {
    await repo.softDeleteDoctorByUserId(tenantPrisma, targetUserId);
  } else if (user?.role === 'patient') {
    await repo.softDeletePatientByUserId(tenantPrisma, targetUserId);
  }

  await auditLog({
    tenantPrisma,
    userId: auth.userId,
    orgId: auth.orgId,
    action: 'DELETE_USER',
    resourceType: 'User',
    resourceId: targetUserId,
  });
}
