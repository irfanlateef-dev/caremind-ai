import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '../../../node_modules/.prisma/tenant-client/index.js';
import { getAiChatAdapter } from '../../adapters/ai/index.js';
import { buildSoapNotePrompt } from '../../templates/prompts/soap-note.prompt.js';
import { buildClinicalSummaryPrompt } from '../../templates/prompts/clinical-summary.prompt.js';
import { buildPatientSummaryPrompt } from '../../templates/prompts/patient-summary.prompt.js';
import { buildFollowUpPrompt } from '../../templates/prompts/follow-up.prompt.js';

const EXPECTED_OUTPUT_COUNT = 4;

async function generateOne(buildPrompt: () => string, maxTokens: number): Promise<string> {
  const ai = getAiChatAdapter();
  return ai.chat({
    systemPrompt: buildPrompt(),
    messages: [],
    maxTokens,
  });
}

/** Runs LLM calls sequentially to limit peak memory (long consultations). */
export async function generateAiOutputsForAppointment(params: {
  tenantPrisma: PrismaClient;
  appointmentId: string;
  orgId: string;
  fullText: string;
}): Promise<{ hasApprovedOutputs: boolean; createdCount: number }> {
  const { tenantPrisma, appointmentId, orgId, fullText } = params;

  const appointment = await tenantPrisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
  if (!appointment) throw new Error('Appointment not found');

  const hasApprovedOutputs =
    (await tenantPrisma.aiOutput.count({
      where: {
        appointmentId,
        status: { in: ['approved', 'edited'] },
      },
    })) > 0;

  const patientContext = `Patient: ${appointment.patient.firstName} ${appointment.patient.lastName}`;

  const soapNote = await generateOne(() => buildSoapNotePrompt(fullText), 2048);
  const clinicalSummary = await generateOne(
    () => buildClinicalSummaryPrompt(fullText, patientContext),
    2048,
  );
  const patientSummary = await generateOne(() => buildPatientSummaryPrompt(fullText, ''), 1024);
  const followUp = await generateOne(() => buildFollowUpPrompt(fullText, patientContext), 1024);

  await tenantPrisma.aiOutput.deleteMany({
    where: { appointmentId, status: 'pending_review' },
  });

  const outputs = [
    { type: 'soap_note' as const, content: soapNote },
    { type: 'clinical_summary' as const, content: clinicalSummary },
    { type: 'patient_summary' as const, content: patientSummary },
    { type: 'follow_up_instructions' as const, content: followUp },
  ];

  await Promise.all(
    outputs.map((o) =>
      tenantPrisma.aiOutput.create({
        data: {
          id: uuidv4(),
          appointmentId,
          orgId,
          type: o.type,
          content: o.content,
          originalContent: o.content,
        },
      }),
    ),
  );

  return { hasApprovedOutputs, createdCount: EXPECTED_OUTPUT_COUNT };
}
