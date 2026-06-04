import { FileText, Image, Eye, Trash2, RefreshCw } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { DocumentStatusBadge } from '@/components/shared/StatusBadge';
import type { Document } from '@/types';
import { formatDate, formatDateTime, formatFileSize } from '@/utils';

interface DocumentCardProps {
  doc: Document;
  onView: (doc: Document) => void;
  onDelete: () => void;
  onReprocess?: () => void;
  canDelete: boolean;
  showPatient?: boolean;
}

export function DocumentCard({
  doc,
  onView,
  onDelete,
  onReprocess,
  canDelete,
  showPatient = true,
}: DocumentCardProps) {
  const isImage = doc.fileType.startsWith('image/');
  const canRetry = onReprocess && doc.processingStatus === 'failed';

  return (
    <Card padding="md" className="flex items-start gap-3 hover:shadow-elevated transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
        {isImage ? (
          <Image className="w-5 h-5 text-primary" />
        ) : (
          <FileText className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate text-sm">{doc.fileName}</p>
        {showPatient && doc.patient && (
          <p className="text-xs text-muted mt-0.5">
            {doc.patient.firstName} {doc.patient.lastName}
          </p>
        )}
        {doc.appointment?.scheduledAt ? (
          <p className="text-xs text-muted mt-0.5">
            Appointment: {formatDateTime(doc.appointment.scheduledAt)}
          </p>
        ) : (
          <p className="text-xs text-muted mt-0.5">Not linked to an appointment</p>
        )}
        {doc.documentType && (
          <p className="text-xs text-muted">{doc.documentType}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <DocumentStatusBadge status={doc.processingStatus} />
          <span className="text-xs text-muted">{formatFileSize(doc.fileSize)}</span>
          <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
        </div>
        {canRetry && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="mt-2"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onReprocess}
          >
            Retry processing
          </Button>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {doc.processingStatus === 'ready' && (
          <button
            type="button"
            onClick={() => onView(doc)}
            className="p-2 text-muted hover:text-primary hover:bg-primary-50 rounded-md transition-colors"
            aria-label={`View ${doc.fileName}`}
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            onClick={onReprocess}
            className="p-2 text-danger hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
            aria-label={`Reprocess ${doc.fileName}`}
            title="Re-run text extraction and AI indexing"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-muted hover:text-danger hover:bg-danger-50 rounded-md transition-colors"
            aria-label={`Delete ${doc.fileName}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </Card>
  );
}
