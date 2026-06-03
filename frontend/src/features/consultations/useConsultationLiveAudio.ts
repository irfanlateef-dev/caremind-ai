import { useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { getAuthStoreSnapshot } from '@/stores/auth.store';

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function buildLiveAudioWsUrl(recordingId: string, streamRole: 'doctor' | 'patient'): string {
  const token = getAuthStoreSnapshot().accessToken;
  const params = new URLSearchParams({
    token: token ?? '',
    recordingId,
    streamRole,
  });
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/consultations/live-audio?${params}`;
}

function useRoleAudioPipeline(
  ws: WebSocket,
  audioContext: AudioContext,
  getTracks: () => MediaStreamTrack[],
): () => void {
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const sources = new Set<MediaStreamAudioSourceNode>();

  const refreshTracks = () => {
    for (const source of sources) source.disconnect();
    sources.clear();
    for (const track of getTracks()) {
      if (track.kind !== 'audio') continue;
      try {
        const source = audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(processor);
        sources.add(source);
      } catch {
        /* track not ready */
      }
    }
  };

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
    ws.send(pcm.buffer);
  };

  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  refreshTracks();
  return () => {
    processor.disconnect();
    silentGain.disconnect();
    for (const source of sources) source.disconnect();
  };
}

/**
 * Streams doctor mic and patient (remote) audio on separate channels so labels
 * follow LiveKit roles — not Deepgram speaker-order guessing.
 */
export function useConsultationLiveAudio(
  recordingId: string | null,
  active: boolean,
  onTranscript: (payload: { fullText: string; interimText: string }) => void,
): void {
  const room = useRoomContext();
  const doctorWsRef = useRef<WebSocket | null>(null);
  const patientWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!recordingId || !active) return;

    const doctorWs = new WebSocket(buildLiveAudioWsUrl(recordingId, 'doctor'));
    const patientWs = new WebSocket(buildLiveAudioWsUrl(recordingId, 'patient'));
    doctorWs.binaryType = 'arraybuffer';
    patientWs.binaryType = 'arraybuffer';
    doctorWsRef.current = doctorWs;
    patientWsRef.current = patientWs;

    doctorWs.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as {
          type?: string;
          fullText?: string;
          interimText?: string;
        };
        if (msg.type === 'transcript' && msg.fullText !== undefined) {
          onTranscript({
            fullText: msg.fullText,
            interimText: msg.interimText ?? '',
          });
        }
      } catch {
        /* ignore */
      }
    };

    const audioContext = new AudioContext({ sampleRate: 16000 });
    let cleanupDoctor: () => void = () => {};
    let cleanupPatient: () => void = () => {};

    const setupPipelines = () => {
      cleanupDoctor = useRoleAudioPipeline(doctorWs, audioContext, () => {
        const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        return mic?.track ? [mic.track.mediaStreamTrack] : [];
      });

      cleanupPatient = useRoleAudioPipeline(patientWs, audioContext, () => {
        const tracks: MediaStreamTrack[] = [];
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            if (pub.track?.mediaStreamTrack) {
              tracks.push(pub.track.mediaStreamTrack);
            }
          });
        });
        return tracks;
      });
    };

    doctorWs.onopen = () => {
      if (patientWs.readyState === WebSocket.OPEN) setupPipelines();
    };
    patientWs.onopen = () => {
      if (doctorWs.readyState === WebSocket.OPEN) setupPipelines();
    };

    const onTrackChange = () => {
      if (doctorWs.readyState === WebSocket.OPEN && patientWs.readyState === WebSocket.OPEN) {
        cleanupDoctor();
        cleanupPatient();
        setupPipelines();
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackChange);
    room.on(RoomEvent.TrackUnsubscribed, onTrackChange);
    room.on(RoomEvent.LocalTrackPublished, onTrackChange);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackChange);
      room.off(RoomEvent.TrackUnsubscribed, onTrackChange);
      room.off(RoomEvent.LocalTrackPublished, onTrackChange);
      cleanupDoctor();
      cleanupPatient();
      doctorWs.close();
      patientWs.close();
      doctorWsRef.current = null;
      patientWsRef.current = null;
      void audioContext.close();
    };
  }, [recordingId, active, room, onTranscript]);
}
