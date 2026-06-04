import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ZoomIn, ZoomOut, RotateCcw, Download, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { documentsApi } from '@/api/documents.api';
import { getApiErrorMessage } from '@/api/errors';
import type { Document } from '@/types';
import { cn } from '@/utils/cn';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

interface DocumentPreviewModalProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
}

function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf' || mime.endsWith('/pdf');
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function PdfPreviewPane({ blob }: { blob: Blob }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!objectUrl) return null;

  return (
    <iframe
      title="PDF preview"
      src={objectUrl}
      className="w-full h-full min-h-[55vh] border-0 bg-slate-100"
    />
  );
}

function ImagePreviewWithToolbar({ blob, mimeType }: { blob: Blob; mimeType: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, mimeType]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  };

  return (
    <div className="flex flex-col flex-1 min-h-[55vh]">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted tabular-nums w-14 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" aria-label="Reset view" onClick={resetView}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted ml-2 hidden sm:inline">Drag to pan · scroll to zoom</span>
      </div>
      <div
        className={cn(
          'relative flex-1 min-h-0 bg-slate-900/95 overflow-hidden',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {objectUrl && (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={objectUrl}
              alt="Document preview"
              draggable={false}
              className="max-w-none select-none pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentPreviewModal({ document: doc, open, onClose }: DocumentPreviewModalProps) {
  const previewQuery = useQuery({
    queryKey: ['documents', 'preview', doc?.id],
    queryFn: () => documentsApi.fetchPreviewBlob(doc!.id),
    enabled: open && !!doc?.id,
    staleTime: 60_000,
  });

  const blob = previewQuery.data;
  const mimeType = doc?.fileType ?? 'application/octet-stream';

  const handleDownload = () => {
    if (!blob || !doc) return;
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const a = window.document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={doc?.fileName ?? 'Document preview'}
      size="full"
      className="!max-w-[min(96vw,1100px)] flex flex-col !overflow-hidden"
    >
      <div className="flex items-center gap-2 -mt-2 mb-3">
        <div className="flex-1" />
        {blob && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Download
          </Button>
        )}
      </div>

      <div className="flex flex-col min-h-[58vh] max-h-[72vh] rounded-lg border border-border overflow-hidden bg-white">
        {previewQuery.isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Loading preview…</p>
          </div>
        )}

        {previewQuery.isError && (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-danger">
              {getApiErrorMessage(previewQuery.error, 'Could not load preview')}
            </p>
          </div>
        )}

        {blob && !previewQuery.isLoading && !previewQuery.isError && (
          <>
            {isPdfMime(mimeType) && <PdfPreviewPane blob={blob} />}
            {isImageMime(mimeType) && <ImagePreviewWithToolbar blob={blob} mimeType={mimeType} />}
            {!isPdfMime(mimeType) && !isImageMime(mimeType) && (
              <div className="flex-1 flex items-center justify-center p-8 text-muted text-sm">
                Preview is not supported for this file type. Use Download instead.
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
