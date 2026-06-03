import type { TrackReference } from '@livekit/components-core';
import { ParticipantContext, TrackRefContext, VideoTrack } from '@livekit/components-react';
import { MicOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { resolveParticipantLabel } from './consultation-participants';
import type { ParticipantLabelMap } from './consultation-participants';

export function ConsultationVideoTile({
  trackRef,
  labels,
  variant,
}: {
  trackRef: TrackReference;
  labels: ParticipantLabelMap;
  variant: 'main' | 'pip';
}) {
  const { participant } = trackRef;
  const displayName = resolveParticipantLabel(
    participant.identity,
    participant.name,
    labels
  );
  const isLocal = participant.isLocal;
  const pub = trackRef.publication;
  const hasVideo = Boolean(pub?.track && !pub.isMuted);
  return (
    <TrackRefContext.Provider value={trackRef}>
      <ParticipantContext.Provider value={participant}>
        <div
          className={cn(
            'consultation-video-tile relative w-full h-full overflow-hidden bg-slate-950',
            'flex items-center justify-center',
            variant === 'main' ? 'consultation-tile-main rounded-none' : 'consultation-tile-pip rounded-2xl'
          )}
        >
          {hasVideo ? (
            <VideoTrack
              trackRef={trackRef}
              className="consultation-video-element max-w-full max-h-full w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-950">
              <Avatar name={displayName} size={variant === 'main' ? 'xl' : 'md'} />
              <span className="text-white/90 text-sm font-medium px-2 text-center">
                {displayName}
              </span>
            </div>
          )}

          <div
            className={cn(
              'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent',
              variant === 'main' ? 'p-5 pt-16' : 'p-2 pt-8'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    'font-semibold text-white truncate',
                    variant === 'main' ? 'text-lg sm:text-xl' : 'text-xs'
                  )}
                >
                  {displayName}
                  {isLocal && (
                    <span className="text-white/60 font-normal ml-1">(You)</span>
                  )}
                </p>
              </div>
              {!participant.isMicrophoneEnabled && (
                <span
                  className={cn(
                    'shrink-0 flex items-center justify-center rounded-full bg-red-500/90 p-1',
                    variant === 'pip' && 'scale-90'
                  )}
                  title="Muted"
                >
                  <MicOff className={cn('text-white', variant === 'main' ? 'w-4 h-4' : 'w-3 h-3')} />
                </span>
              )}
            </div>
          </div>

          {!hasVideo && (
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white/80">
              <MicOff className="w-3 h-3" />
              Camera off
            </div>
          )}
        </div>
      </ParticipantContext.Provider>
    </TrackRefContext.Provider>
  );
}
