import { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { useMediaDeviceSelect, useTrackToggle } from '@livekit/components-react';
import { ChevronUp, Mic, MicOff, Video, VideoOff, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

type MediaKind = 'audioinput' | 'videoinput';

interface ConsultationMediaControlProps {
  source: Track.Source.Microphone | Track.Source.Camera;
  deviceKind: MediaKind;
  label: string;
  /** Smaller toggle-only control for the floating minimized call window. */
  compact?: boolean;
}

export function ConsultationMediaControl({
  source,
  deviceKind,
  label,
  compact = false,
}: ConsultationMediaControlProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { buttonProps, enabled } = useTrackToggle({ source });
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: deviceKind,
    requestPermissions: true,
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  const isMic = source === Track.Source.Microphone;
  const Icon = isMic ? (enabled ? Mic : MicOff) : enabled ? Video : VideoOff;

  if (compact) {
    return (
      <button
        type="button"
        {...buttonProps}
        aria-label={enabled ? `Turn off ${label.toLowerCase()}` : `Turn on ${label.toLowerCase()}`}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl border border-white/15 transition-colors',
          enabled
            ? 'bg-white/10 text-white hover:bg-white/15'
            : 'text-red-200 bg-red-500/25 hover:bg-red-500/35'
        )}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {label}
            </p>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {devices.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No devices found</li>
            ) : (
              devices.map((device) => {
                const active =
                  device.deviceId === activeDeviceId ||
                  (activeDeviceId === 'default' && devices[0]?.deviceId === device.deviceId);
                return (
                  <li key={device.deviceId}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        void setActiveMediaDevice(device.deviceId);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                        active
                          ? 'bg-primary/20 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className="flex-1 truncate">
                        {device.label || 'Unknown device'}
                      </span>
                      {active && <Check className="w-4 h-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      <div className="flex items-stretch rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-lg overflow-hidden">
        <button
          type="button"
          {...buttonProps}
          aria-label={enabled ? `Turn off ${label.toLowerCase()}` : `Turn on ${label.toLowerCase()}`}
          className={cn(
            'flex items-center justify-center w-12 h-12 transition-colors',
            enabled
              ? 'text-white hover:bg-white/10'
              : 'text-red-300 bg-red-500/20 hover:bg-red-500/30'
          )}
        >
          <Icon className="w-5 h-5" />
        </button>
        <div className="w-px bg-white/15 self-stretch my-2" />
        <button
          type="button"
          aria-label={`Choose ${label.toLowerCase()}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center justify-center w-9 h-12 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronUp
            className={cn('w-4 h-4 transition-transform duration-200', menuOpen && 'rotate-180')}
          />
        </button>
      </div>
    </div>
  );
}
