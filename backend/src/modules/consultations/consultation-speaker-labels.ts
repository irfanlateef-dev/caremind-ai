import type { TranscriptSegment } from '../../types/adapters.js';

export type SpeakerRole = 'doctor' | 'patient';

export interface ConsultationSpeakerLabels {
  doctorName: string;
  patientName: string;
}

export function buildSpeakerLabelsFromAppointment(appointment: {
  patient: { firstName: string; lastName: string };
  doctor: { firstName: string; lastName: string };
}): ConsultationSpeakerLabels {
  return {
    doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`.trim(),
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim(),
  };
}

export function displayNameForRole(
  role: SpeakerRole,
  labels: ConsultationSpeakerLabels,
): string {
  return role === 'doctor' ? labels.doctorName : labels.patientName;
}

export function resolveSpeakerRoleFromName(
  speaker: string,
  labels: ConsultationSpeakerLabels,
): SpeakerRole | undefined {
  if (speaker === labels.doctorName) return 'doctor';
  if (speaker === labels.patientName) return 'patient';
  return undefined;
}

/** Legacy Deepgram "Speaker N" labels — cannot map without track metadata. */
export function parseDeepgramSpeakerIndex(speaker?: string): number | undefined {
  if (speaker === undefined || speaker === '') return undefined;
  if (/^\d+$/.test(speaker)) return Number(speaker);
  const match = /^Speaker\s+(\d+)$/i.exec(speaker.trim());
  return match ? Number(match[1]) : undefined;
}

export function formatUtteranceLine(displayName: string, text: string): string {
  return `${displayName}: ${text.trim()}`;
}

export function formatTranscriptFromLines(
  lines: Array<{ text: string; speaker: string }>,
): string {
  return lines
    .map((line) => formatUtteranceLine(line.speaker, line.text))
    .join('\n\n');
}

export function formatTranscriptFromSegments(
  segments: TranscriptSegment[],
  labels: ConsultationSpeakerLabels,
): string {
  return segments
    .map((seg) => {
      const name =
        resolveSpeakerRoleFromName(seg.speaker ?? '', labels) !== undefined
          ? seg.speaker!
          : seg.speaker ?? 'Unknown';
      return formatUtteranceLine(name, seg.text);
    })
    .join('\n\n');
}

export function segmentsFromRoleLines(
  lines: Array<{
    text: string;
    speaker: string;
    speakerRole: SpeakerRole;
    startSeconds?: number;
    endSeconds?: number;
  }>,
): TranscriptSegment[] {
  return lines.map((line, i) => ({
    speaker: line.speaker,
    startSeconds: line.startSeconds ?? i,
    endSeconds: line.endSeconds ?? i + 1,
    text: line.text,
  }));
}

export function enrichSegmentsForApi(
  segments: TranscriptSegment[],
  labels: ConsultationSpeakerLabels,
): Array<TranscriptSegment & { speakerRole?: SpeakerRole }> {
  return segments.map((seg) => {
    const speakerRole = resolveSpeakerRoleFromName(seg.speaker ?? '', labels);
    return { ...seg, speakerRole };
  });
}
