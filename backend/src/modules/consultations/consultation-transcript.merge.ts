import type { TranscriptSegment } from '../../types/adapters.js';

export const TRANSCRIPT_SESSION_SEPARATOR =
  '\n\n--- Consultation continued (additional recording) ---\n\n';

export function parseStoredSegments(raw: unknown): TranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is TranscriptSegment =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as TranscriptSegment).text === 'string',
  );
}

/** Append a new recording session onto an existing appointment transcript. */
export function mergeTranscriptSessions(params: {
  existingFullText: string | null | undefined;
  existingSegments: unknown;
  existingDurationSeconds: number | null | undefined;
  sessionFullText: string;
  sessionSegments: TranscriptSegment[];
  sessionDurationSeconds: number;
}): {
  fullText: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
} {
  const sessionText = params.sessionFullText.trim();
  const prevText = params.existingFullText?.trim() ?? '';

  const fullText = prevText
    ? `${prevText}${TRANSCRIPT_SESSION_SEPARATOR}${sessionText}`
    : sessionText;

  const prevSegments = parseStoredSegments(params.existingSegments);
  const offset =
    prevSegments.length > 0
      ? Math.max(...prevSegments.map((s) => s.endSeconds ?? 0))
      : (params.existingDurationSeconds ?? 0);

  const shiftedSessionSegments = params.sessionSegments.map((s) => ({
    ...s,
    startSeconds: (s.startSeconds ?? 0) + offset,
    endSeconds: (s.endSeconds ?? 0) + offset,
  }));

  const segments = [...prevSegments, ...shiftedSessionSegments];
  const durationSeconds =
    (params.existingDurationSeconds ?? 0) + params.sessionDurationSeconds;

  return { fullText, segments, durationSeconds };
}
