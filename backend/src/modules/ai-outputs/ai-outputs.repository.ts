import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';

export async function findAiOutputById(prisma: PrismaClient, id: string) {
  return prisma.aiOutput.findUnique({ where: { id } });
}

export async function listAiOutputsByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.aiOutput.findMany({
    where: { appointmentId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateAiOutput(
  prisma: PrismaClient,
  id: string,
  data: {
    content?: string;
    status: 'approved' | 'rejected' | 'edited';
    reviewedByDoctorId?: string;
    reviewedAt?: Date;
  },
) {
  return prisma.aiOutput.update({ where: { id }, data });
}

export async function saveAiOutputContent(prisma: PrismaClient, id: string, content: string) {
  return prisma.aiOutput.update({ where: { id }, data: { content } });
}

export async function countOutputsByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.aiOutput.count({ where: { appointmentId } });
}

export async function findDoctorByUserId(prisma: PrismaClient, userId: string) {
  return prisma.doctor.findFirst({ where: { userId } });
}

export async function findAppointmentById(prisma: PrismaClient, id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { patient: true, doctor: true },
  });
}

export async function findTranscriptByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.transcript.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findLatestRecordingByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.consultationRecording.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function countPendingOutputsByAppointment(prisma: PrismaClient, appointmentId: string) {
  return prisma.aiOutput.count({
    where: { appointmentId, status: 'pending_review' },
  });
}

export async function updateRecordingStatus(
  prisma: PrismaClient,
  id: string,
  status: 'uploaded' | 'processing' | 'ready' | 'failed',
) {
  return prisma.consultationRecording.update({ where: { id }, data: { status } });
}
