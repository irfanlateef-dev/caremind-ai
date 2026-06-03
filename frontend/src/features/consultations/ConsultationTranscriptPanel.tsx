import type { TranscriptSegmentView } from '@/types';
import { cn } from '@/utils/cn';

export function ConsultationTranscriptPanel({
  content,
  segments,
  isLive,
  variant = 'light',
}: {
  content: string;
  segments?: TranscriptSegmentView[];
  isLive?: boolean;
  variant?: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';
  const hasSegments = segments && segments.length > 0;

  return (
    <div>
      {isLive && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 mb-3 rounded-full px-2.5 py-1 text-xs font-medium',
            isDark
              ? 'bg-red-500/20 border border-red-500/30 text-red-300'
              : 'bg-red-50 border border-red-200 text-red-700'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full animate-pulse',
              isDark ? 'bg-red-400' : 'bg-red-500'
            )}
          />
          Live transcription
        </span>
      )}
      {hasSegments ? (
        <ul className="space-y-4">
          {segments.map((seg, i) => (
            <li key={`${seg.startSeconds ?? i}-${i}`} className="text-sm leading-relaxed">
              <span
                className={cn(
                  'font-semibold',
                  seg.speakerRole === 'doctor'
                    ? isDark
                      ? 'text-primary-300'
                      : 'text-primary'
                    : isDark
                      ? 'text-emerald-300'
                      : 'text-emerald-700'
                )}
              >
                {seg.speaker}
              </span>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>: </span>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{seg.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <pre
          className={cn(
            'text-sm whitespace-pre-wrap font-sans leading-relaxed',
            isDark ? 'text-slate-300' : 'text-slate-700'
          )}
        >
          {content}
        </pre>
      )}
      <p
        className={cn(
          'mt-4 text-[11px] leading-snug',
          isDark ? 'text-slate-500' : 'text-muted'
        )}
      >
        Speaker labels use your microphone as the doctor and the other call participant as the
        patient (from the video session, not voice order).
      </p>
    </div>
  );
}
