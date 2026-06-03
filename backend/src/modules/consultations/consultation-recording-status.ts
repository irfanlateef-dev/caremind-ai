import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';

/** If a recording stays in processing this long with no outputs, treat as failed (worker crash/stall). */
export const AI_GENERATION_STUCK_MS = 8 * 60 * 1000;

export async function reconcileStuckProcessingRecording(
  tenantPrisma: PrismaClient,
  recording: { id: string; status: string; createdAt: Date },
): Promise<'processing' | 'failed'> {
  if (recording.status !== 'processing') {
    return recording.status as 'processing' | 'failed';
  }

  const ageMs = Date.now() - recording.createdAt.getTime();
  if (ageMs <= AI_GENERATION_STUCK_MS) {
    return 'processing';
  }

  await tenantPrisma.consultationRecording.update({
    where: { id: recording.id },
    data: { status: 'failed' },
  });

  return 'failed';
}
