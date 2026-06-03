import { useNavigate } from 'react-router-dom';
import { Track, RoomEvent } from 'livekit-client';
import {
  isTrackReference,
  RoomAudioRenderer,
  useDisconnectButton,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { PhoneOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useConsultationSessionStore } from '@/stores/consultation-session.store';
import { buildParticipantLabels, getCallTitle } from './consultation-participants';
import { ConsultationVideoTile } from './ConsultationVideoTile';
import { ConsultationFloatingWindow } from './ConsultationFloatingWindow';
import { ConsultationMediaControl } from './ConsultationMediaControl';

export function ConsultationMinimizedCall() {
  const navigate = useNavigate();
  const appointment = useConsultationSessionStore((s) => s.appointment);
  const appointmentId = useConsultationSessionStore((s) => s.appointmentId);
  const setMinimized = useConsultationSessionStore((s) => s.setMinimized);

  const { buttonProps: leaveProps } = useDisconnectButton({});

  const participants = useParticipants();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  );

  if (!appointment || !appointmentId) return null;

  const labels = buildParticipantLabels(appointment);
  const callTitle = getCallTitle(appointment);
  const cameraTracks = tracks.filter(isTrackReference).filter((t) => t.source === Track.Source.Camera);
  const localTrack = cameraTracks.find((t) => t.participant.isLocal);
  const remoteTrack = cameraTracks.find((t) => !t.participant.isLocal);
  const remoteCount = participants.filter((p) => !p.isLocal).length;

  const handleExpand = () => {
    setMinimized(false);
    navigate(`/appointments/${appointmentId}/consultation`);
  };

  return (
    <>
      <ConsultationFloatingWindow title={callTitle} onExpand={handleExpand}>
        <div className="consultation-float-stage relative aspect-video bg-slate-950">
          {remoteTrack ? (
            <ConsultationVideoTile trackRef={remoteTrack} labels={labels} variant="main" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
              <p className="text-white/70 text-xs">Waiting for participant…</p>
            </div>
          )}
          {localTrack && (
            <div className="absolute bottom-2 right-2 z-10 w-[28%] min-w-[3.5rem] aspect-[3/4] rounded-lg overflow-hidden shadow-lg ring-1 ring-white/20">
              <ConsultationVideoTile trackRef={localTrack} labels={labels} variant="pip" />
            </div>
          )}
          {remoteCount > 0 && (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-emerald-300">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-900/90 border-t border-white/10">
          <ConsultationMediaControl
            source={Track.Source.Microphone}
            deviceKind="audioinput"
            label="Microphone"
            compact
          />
          <ConsultationMediaControl
            source={Track.Source.Camera}
            deviceKind="videoinput"
            label="Camera"
            compact
          />
          <button
            type="button"
            aria-label="Leave call"
            {...leaveProps}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-xl',
              'bg-red-500 hover:bg-red-600 text-white transition-colors'
            )}
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </ConsultationFloatingWindow>
      <RoomAudioRenderer />
    </>
  );
}
