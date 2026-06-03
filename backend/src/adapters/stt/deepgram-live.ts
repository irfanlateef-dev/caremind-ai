import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { env } from '../../config/env.js';
export interface LiveTranscriptEvent {
  text: string;
  isFinal: boolean;
  /** Deepgram diarization index (0, 1, …), when available. */
  speakerId?: number;
  startSeconds?: number;
  endSeconds?: number;
}

function resolveSpeakerIdFromResult(data: {
  channel?: { alternatives?: Array<{ words?: Array<{ speaker?: number }> }> };
}): number | undefined {
  const words = data.channel?.alternatives?.[0]?.words;
  if (!words?.length) return undefined;

  const counts = new Map<number, number>();
  for (const word of words) {
    if (word.speaker === undefined) continue;
    counts.set(word.speaker, (counts.get(word.speaker) ?? 0) + 1);
  }

  let best: number | undefined;
  let max = 0;
  for (const [id, count] of counts) {
    if (count > max) {
      max = count;
      best = id;
    }
  }
  return best;
}

export interface DeepgramLiveConnection {
  sendAudio: (chunk: Buffer) => void;
  close: () => Promise<void>;
}

export function openDeepgramLiveStream(handlers: {
  onTranscript: (event: LiveTranscriptEvent) => void;
  onError?: (message: string) => void;
  /** Single-speaker stream (doctor mic / patient mic) — diarization not needed. */
  diarize?: boolean;
}): DeepgramLiveConnection {
  const deepgram = createClient(env.DEEPGRAM_API_KEY);
  const connection = deepgram.listen.live({
    model: 'nova-2-medical',
    smart_format: true,
    punctuate: true,
    interim_results: true,
    utterances: true,
    diarize: handlers.diarize ?? false,
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    /* ready */
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (!text) return;

    const speakerId = resolveSpeakerIdFromResult(data);

    handlers.onTranscript({
      text,
      isFinal: Boolean(data.is_final),
      speakerId,
      startSeconds: data.start,
      endSeconds: data.end,
    });
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    const message = err instanceof Error ? err.message : 'Deepgram live stream error';
    handlers.onError?.(message);
  });

  return {
    sendAudio: (chunk: Buffer) => {
      const ab = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      connection.send(ab as ArrayBuffer);
    },
    close: async () => {
      connection.requestClose();
    },
  };
}

