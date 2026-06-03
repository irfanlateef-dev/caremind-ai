import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GripHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';

const PIP_MARGIN = 12;
/** Space reserved at bottom for the floating control dock */
const BOTTOM_SAFE = 128;

interface ConsultationDraggablePipProps {
  children: ReactNode;
  /** width ÷ height from the local camera track (updates on device rotation). */
  videoAspectRatio?: number;
  className?: string;
}

export function ConsultationDraggablePip({
  children,
  videoAspectRatio,
  className,
}: ConsultationDraggablePipProps) {
  const boundsRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampPosition = useCallback((x: number, y: number) => {
    const bounds = boundsRef.current;
    const pip = pipRef.current;
    if (!bounds || !pip) return { x, y };

    const bw = bounds.clientWidth;
    const bh = bounds.clientHeight;
    const pw = pip.offsetWidth;
    const ph = pip.offsetHeight;

    return {
      x: Math.min(Math.max(PIP_MARGIN, x), bw - pw - PIP_MARGIN),
      y: Math.min(Math.max(PIP_MARGIN, y), bh - ph - PIP_MARGIN),
    };
  }, []);

  const placeDefault = useCallback(() => {
    const bounds = boundsRef.current;
    const pip = pipRef.current;
    if (!bounds || !pip) return;

    const bw = bounds.clientWidth;
    const bh = bounds.clientHeight;
    const pw = pip.offsetWidth;
    const ph = pip.offsetHeight;

    setPosition(
      clampPosition(bw - pw - PIP_MARGIN, bh - ph - BOTTOM_SAFE)
    );
  }, [clampPosition]);

  useLayoutEffect(() => {
    if (position !== null) return;
    placeDefault();
  }, [position, placeDefault]);

  useLayoutEffect(() => {
    const bounds = boundsRef.current;
    if (!bounds || position === null) return;

    const ro = new ResizeObserver(() => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : prev));
    });
    ro.observe(bounds);
    return () => ro.disconnect();
  }, [position, clampPosition]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (position === null) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPosition(clampPosition(drag.origX + dx, drag.origY + dy));
  };

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragState.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  return (
    <div ref={boundsRef} className="absolute inset-0 pointer-events-none">
      <div
        ref={pipRef}
        role="region"
        aria-label="Your video — drag to reposition"
        style={{
          ...(position
            ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
            : { right: PIP_MARGIN, bottom: BOTTOM_SAFE }),
          aspectRatio: videoAspectRatio ?? 3 / 4,
        }}
        className={cn(
          'consultation-pip pointer-events-auto absolute z-20',
          'w-[min(42vw,10.5rem)] max-h-[min(38vh,15rem)] rounded-2xl overflow-hidden',
          'shadow-2xl ring-2 ring-white/20 border border-white/10 bg-slate-900',
          'touch-none select-none',
          dragging ? 'cursor-grabbing scale-[1.02]' : 'cursor-grab',
          'transition-shadow',
          dragging && 'shadow-black/50 ring-white/30',
          className
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute top-0 inset-x-0 z-10 flex justify-center py-0.5 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
          <GripHorizontal className="w-5 h-5 text-white/50" aria-hidden />
        </div>
        {children}
      </div>
    </div>
  );
}
