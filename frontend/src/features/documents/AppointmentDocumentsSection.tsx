import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, Card, CardHeader, EmptyState, Skeleton, Modal, ModalFooter, Pagination,
} from '@/components/ui';
import { DocumentCard } from './DocumentCard';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import type { Document } from '@/types';
import { documentsApi, documentKeys } from '@/api/documents.api';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';

interface AppointmentDocumentsSectionProps {
  patientId: string;
  appointmentId: string;
}

export function AppointmentDocumentsSection({
  patientId,
  appointmentId,
}: AppointmentDocumentsSectionProps) {
  const { role } = useAuthStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const canUpload =
    role === UserRole.ADMIN || role === UserRole.DOCTOR || role === UserRole.PATIENT;
  const canDelete = role === UserRole.ADMIN || role === UserRole.DOCTOR;

  const listParams = useMemo(
    () => ({ page, pageSize: 12, patientId, appointmentId }),
    [page, patientId, appointmentId],
  );

  const { data, isLoading } = useQuery({
    queryKey: documentKeys.list(listParams),
    queryFn: () => documentsApi.list(listParams),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const inProgress = items.some(
        (d) => d.processingStatus === 'pending' || d.processingStatus === 'processing',
      );
      return inProgress ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: () => toast.error('Delete failed'),
  });

  const reprocessMutation = useMutation({
    mutationFn: documentsApi.reprocess,
    onSuccess: () => {
      toast.success('Reprocessing — text extraction and AI indexing will run again');
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: () => toast.error('Reprocess failed'),
  });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader
        title="Documents"
        action={
          canUpload ? (
            <Button
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setUploadOpen(true)}
            >
              Upload
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents for this appointment"
          description="Upload lab reports, imaging, or other files linked to this visit."
          action={
            canUpload && (
              <Button onClick={() => setUploadOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Upload Document
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 mt-4">
          {items.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              showPatient={false}
              onView={setPreviewDoc}
              onDelete={() => setDeleteId(doc.id)}
              onReprocess={() => reprocessMutation.mutate(doc.id)}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4">
          <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </div>
      )}

      <DocumentPreviewModal
        open={!!previewDoc}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        fixedPatientId={patientId}
        fixedAppointmentId={appointmentId}
      />

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Document" size="sm">
        <p className="text-slate-700">
          Are you sure you want to delete this document? This cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
}
