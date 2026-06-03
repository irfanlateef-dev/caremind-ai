import { useEffect, useState } from 'react';
import type { TrackReference } from '@livekit/components-core';
import { Track, TrackEvent, type LocalTrack, type Track as LiveKitTrack } from 'livekit-client';

export interface VideoDimensions {
  width: number;
  height: number;
}

function readDimensions(trackRef: TrackReference | undefined): VideoDimensions | null {
  const pub = trackRef?.publication;
  if (pub?.dimensions?.width && pub.dimensions?.height) {
    return { width: pub.dimensions.width, height: pub.dimensions.height };
  }

  const track = pub?.track;
  if (track && track.kind === Track.Kind.Video) {
    const localDims = (track as LocalTrack).dimensions;
    if (localDims?.width && localDims?.height) {
      return { width: localDims.width, height: localDims.height };
    }

    const settings = track.mediaStreamTrack?.getSettings();
    if (settings?.width && settings?.height) {
      return { width: settings.width, height: settings.height };
    }
  }

  return null;
}

/** Subscribes to LiveKit video size / rotation changes (portrait ↔ landscape). */
export function useVideoTrackDimensions(
  trackRef: TrackReference | undefined,
): VideoDimensions | null {
  const [dimensions, setDimensions] = useState<VideoDimensions | null>(null);

  useEffect(() => {
    const pub = trackRef?.publication;
    const track = pub?.track as LiveKitTrack | undefined;

    if (!track || track.kind !== Track.Kind.Video) {
      setDimensions(null);
      return;
    }

    const apply = () => {
      setDimensions(readDimensions(trackRef));
    };

    apply();
    track.on(TrackEvent.VideoDimensionsChanged, apply);

    const media = track.mediaStreamTrack;
    const onMediaSettings = () => apply();
    media?.addEventListener('resize', onMediaSettings);

    return () => {
      track.off(TrackEvent.VideoDimensionsChanged, apply);
      media?.removeEventListener('resize', onMediaSettings);
    };
  }, [trackRef, trackRef?.publication?.trackSid]);

  return dimensions;
}

export function videoAspectRatio(dimensions: VideoDimensions | null): number | undefined {
  if (!dimensions) return undefined;
  return dimensions.width / dimensions.height;
}
