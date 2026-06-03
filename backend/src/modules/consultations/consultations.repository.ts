import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';

export async function findAppointmentById(prisma: PrismaClient, id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { patient: true, doctor: true },
  });
}

export async function createRecording(
  prisma: PrismaClient,
  data: {
    id: string;
    appointmentId: string;
    orgId: string;
    storageBucket: string;
    storageKey: string;
  },
) {
  return prisma.consultationRecording.create({ data });
}

export async function findRecordingById(prisma: PrismaClient, id: string) {
  return prisma.consultationRecording.findUnique({ where: { id } });
}

export async function findRecordingByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.consultationRecording.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateRecordingStatus(
  prisma: PrismaClient,
  id: string,
  status: 'uploaded' | 'processing' | 'ready' | 'failed',
) {
  return prisma.consultationRecording.update({ where: { id }, data: { status } });
}

export async function findTranscriptByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.transcript.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAiOutputsByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.aiOutput.findMany({
    where: { appointmentId },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function findPatientByUserId(prisma: PrismaClient, userId: string) {
  return prisma.patient.findFirst({ where: { userId } });
}

export async function findDoctorByUserId(prisma: PrismaClient, userId: string) {
  return prisma.doctor.findFirst({ where: { userId } });
}
