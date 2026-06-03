import { Track, RoomEvent } from 'livekit-client';
import { isTrackReference, useParticipants, useTracks } from '@livekit/components-react';
import { Users } from 'lucide-react';
import { ConsultationVideoTile } from './ConsultationVideoTile';
import { ConsultationDraggablePip } from './ConsultationDraggablePip';
import type { ParticipantLabelMap } from './consultation-participants';
import { useVideoTrackDimensions, videoAspectRatio } from './useVideoTrackDimensions';

export function ConsultationCallLayout({ labels }: { labels: ParticipantLabelMap }) {
  const participants = useParticipants();
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  );

  const cameraTracks = tracks.filter(isTrackReference).filter((t) => t.source === Track.Source.Camera);
  const localTrack = cameraTracks.find((t) => t.participant.isLocal);
  const remoteTrack = cameraTracks.find((t) => !t.participant.isLocal);
  const remoteCount = participants.filter((p) => !p.isLocal).length;
  const localDimensions = useVideoTrackDimensions(localTrack);
  const localPipAspect = videoAspectRatio(localDimensions);

  return (
    <div className="consultation-stage relative flex-1 min-h-0 w-full bg-slate-950 overflow-hidden">
      {remoteCount > 0 && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 px-3 py-1 text-xs font-medium text-white/90">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {remoteCount} in call
          </span>
        </div>
      )}

      {remoteTrack ? (
        <ConsultationVideoTile trackRef={remoteTrack} labels={labels} variant="main" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Users className="w-10 h-10 text-white/30" />
          </div>
          <div>
            <p className="text-white/90 font-medium text-lg">Waiting to connect</p>
            <p className="text-white/50 text-sm mt-1 max-w-xs">
              The other participant will appear here when they join the call.
            </p>
          </div>
        </div>
      )}

      {localTrack && (
        <ConsultationDraggablePip videoAspectRatio={localPipAspect}>
          <ConsultationVideoTile trackRef={localTrack} labels={labels} variant="pip" />
        </ConsultationDraggablePip>
      )}
    </div>
  );
}
