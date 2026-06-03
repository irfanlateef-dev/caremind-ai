export function buildSoapNotePrompt(transcript: string): string {
  return `You are a clinical documentation assistant. Generate a SOAP note from the following consultation transcript.
The transcript uses "Dr. [Name]:" for the doctor and the patient's full name for the patient. Attribute statements to the correct speaker.

Format strictly as:
SUBJECTIVE:
[Patient's chief complaint, history of present illness, symptoms as reported]

OBJECTIVE:
[Observable findings mentioned in the consultation]

ASSESSMENT:
[Differential or working diagnosis based on the discussion]

PLAN:
[Treatment plan, medications, referrals, follow-up]

Rules:
- Use clinical, professional language
- Do NOT diagnose or prescribe — only document what was discussed
- If information is absent for a section, write "Not documented"
- Keep each section concise and factual

TRANSCRIPT:
${transcript}`;
}
