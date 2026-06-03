import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GripHorizontal, Maximize2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const MARGIN = 12;
const DEFAULT_BOTTOM = 88;

interface ConsultationFloatingWindowProps {
  children: ReactNode;
  title: string;
  onExpand: () => void;
  className?: string;
}

export function ConsultationFloatingWindow({
  children,
  title,
  onExpand,
  className,
}: ConsultationFloatingWindowProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const clampPosition = useCallback((x: number, y: number) => {
    const shell = shellRef.current;
    if (!shell) return { x, y };

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = shell.offsetWidth;
    const ph = shell.offsetHeight;

    return {
      x: Math.min(Math.max(MARGIN, x), vw - pw - MARGIN),
      y: Math.min(Math.max(MARGIN, y), vh - ph - MARGIN),
    };
  }, []);

  const placeDefault = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = shell.offsetWidth;
    const ph = shell.offsetHeight;

    setPosition(clampPosition(vw - pw - MARGIN, vh - ph - DEFAULT_BOTTOM));
  }, [clampPosition]);

  useLayoutEffect(() => {
    if (position !== null) return;
    placeDefault();
  }, [position, placeDefault]);

  useLayoutEffect(() => {
    if (position === null) return;

    const onResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
      /* already released */
    }
  };

  return (
    <div
      ref={shellRef}
      role="region"
      aria-label={`Call in progress: ${title}`}
      style={
        position
          ? { left: position.x, top: position.y }
          : { right: MARGIN, bottom: DEFAULT_BOTTOM }
      }
      className={cn(
        'fixed z-[300] w-[min(92vw,18rem)] rounded-2xl overflow-hidden',
        'shadow-2xl ring-2 ring-white/20 border border-white/15 bg-slate-950',
        'touch-none select-none',
        dragging && 'ring-white/35 scale-[1.01]',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 bg-slate-900/95 border-b border-white/10',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripHorizontal className="w-4 h-4 text-white/40 shrink-0" aria-hidden />
        <p className="flex-1 min-w-0 text-xs font-medium text-white truncate">{title}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="shrink-0 p-1.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Expand call to full screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
