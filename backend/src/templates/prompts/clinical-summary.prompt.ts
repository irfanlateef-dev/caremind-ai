export function buildClinicalSummaryPrompt(
  transcript: string,
  patientContext: string,
): string {
  return `You are a clinical documentation assistant. Generate a concise clinical summary for the treating physician.
The transcript labels each line with the doctor (Dr. [Name]) or patient name. Use those labels to attribute who said what.

Patient context: ${patientContext}

Include:
- Chief complaint
- Key clinical findings discussed
- Working diagnosis
- Management plan
- Notable risk factors or red flags mentioned
- Recommended follow-up

Rules:
- Use precise medical terminology
- Be concise but clinically complete
- Do NOT add diagnoses or recommendations not discussed in the consultation
- Flag any safety concerns explicitly

CONSULTATION TRANSCRIPT:
${transcript}`;
}
