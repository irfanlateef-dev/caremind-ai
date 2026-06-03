import { useConsultationLiveAudio } from './useConsultationLiveAudio';

/** Streams mixed call audio to the backend while recording is active (doctor only). */
export function ConsultationLiveRecorder({
  recordingId,
  active,
  onTranscript,
}: {
  recordingId: string | null;
  active: boolean;
  onTranscript: (payload: { fullText: string; interimText: string }) => void;
}) {
  useConsultationLiveAudio(recordingId, active, onTranscript);
  return null;
}
