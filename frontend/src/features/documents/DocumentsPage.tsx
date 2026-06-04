import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Upload, User, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, Card, Input, Select, Modal, ModalFooter,
  Pagination, EmptyState, Skeleton,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { DocumentCard } from './DocumentCard';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import type { Document } from '@/types';
import { documentsApi, documentKeys } from '@/api/documents.api';
import { appointmentsApi, appointmentKeys } from '@/api/appointments.api';
import { patientsApi, patientKeys } from '@/api/patients.api';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';
import { formatDateTime } from '@/utils';

const ALL_APPOINTMENTS = '';

export function DocumentsPage() {
  const { role } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = role === UserRole.ADMIN || role === UserRole.DOCTOR;
  const isPatient = role === UserRole.PATIENT;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(ALL_APPOINTMENTS);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const canUpload = !isPatient;
  const listEnabled = isStaff ? !!selectedPatientId : !!selectedDoctorId;

  const listParams = useMemo(() => {
    const params: {
      page: number;
      pageSize: number;
      patientId?: string;
      doctorId?: string;
      appointmentId?: string;
    } = { page, pageSize: 12 };
    if (isStaff && selectedPatientId) params.patientId = selectedPatientId;
    if (isPatient && selectedDoctorId) params.doctorId = selectedDoctorId;
    if (selectedAppointmentId) params.appointmentId = selectedAppointmentId;
    return params;
  }, [page, isStaff, isPatient, selectedPatientId, selectedDoctorId, selectedAppointmentId]);

  const { data, isLoading } = useQuery({
    queryKey: documentKeys.list(listParams),
    queryFn: () => documentsApi.list(listParams),
    enabled: listEnabled,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const inProgress = items.some(
        (d) => d.processingStatus === 'pending' || d.processingStatus === 'processing',
      );
      return inProgress ? 3000 : false;
    },
  });

  const { data: patientsData } = useQuery({
    queryKey: patientKeys.list({ pageSize: 100 }),
    queryFn: () => patientsApi.list({ pageSize: 100 }),
    enabled: isStaff,
    retry: 1,
  });

  const { data: patientAppointmentsData } = useQuery({
    queryKey: appointmentKeys.list({ pageSize: 100 }),
    queryFn: () => appointmentsApi.list({ pageSize: 100 }),
    enabled: isPatient,
    retry: 1,
  });

  const staffAppointmentsEnabled = isStaff && !!selectedPatientId;
  const { data: staffAppointmentsData } = useQuery({
    queryKey: appointmentKeys.list({ pageSize: 100, patientId: selectedPatientId }),
    queryFn: () =>
      appointmentsApi.list({ pageSize: 100, patientId: selectedPatientId }),
    enabled: staffAppointmentsEnabled,
    retry: 1,
  });

  const patientAppointmentsForDoctor = useQuery({
    queryKey: appointmentKeys.list({
      pageSize: 100,
      doctorId: selectedDoctorId || undefined,
    }),
    queryFn: () =>
      appointmentsApi.list({
        pageSize: 100,
        doctorId: selectedDoctorId,
      }),
    enabled: isPatient && !!selectedDoctorId,
    retry: 1,
  });

  const appointmentsData = isPatient
    ? patientAppointmentsForDoctor.data
    : staffAppointmentsData;

  const patientOptions = useMemo(
    () =>
      (patientsData?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName}`,
      })),
    [patientsData?.items],
  );

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const appt of patientAppointmentsData?.items ?? []) {
      if (appt.doctorId && appt.doctor) {
        map.set(
          appt.doctorId,
          `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`.trim(),
        );
      }
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [patientAppointmentsData?.items]);

  const appointmentOptions = useMemo(
    () =>
      (appointmentsData?.items ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
        )
        .map((a) => ({
          value: a.id,
          label: formatDateTime(a.scheduledAt),
        })),
    [appointmentsData?.items],
  );

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        (d.documentType?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.items, search]);

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

  const canManageDocuments = role === UserRole.ADMIN || role === UserRole.DOCTOR;

  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId);
    setSelectedAppointmentId(ALL_APPOINTMENTS);
    setPage(1);
  };

  const handleDoctorChange = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setSelectedAppointmentId(ALL_APPOINTMENTS);
    setPage(1);
  };

  const showSelectPatientEmpty = isStaff && !selectedPatientId;
  const showSelectDoctorEmpty = isPatient && !selectedDoctorId;

  const pageSubtitle = isStaff
    ? 'Select a patient to browse and upload records'
    : 'Select a doctor to view documents from your visits';

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Documents"
        subtitle={pageSubtitle}
        action={
          canUpload && listEnabled && (
            <Button onClick={() => setUploadOpen(true)} leftIcon={<Upload className="w-4 h-4" />}>
              Upload Document
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {isStaff && (
          <div className="w-full sm:w-64">
            <Select
              label="Patient"
              value={selectedPatientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              options={[{ value: '', label: 'Select a patient…' }, ...patientOptions]}
            />
          </div>
        )}
        {isPatient && (
          <div className="w-full sm:w-64">
            <Select
              label="Doctor"
              value={selectedDoctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              options={[{ value: '', label: 'Select a doctor…' }, ...doctorOptions]}
            />
          </div>
        )}
        {listEnabled && (
          <div className="w-full sm:w-64">
            <Select
              label="Appointment"
              value={selectedAppointmentId}
              onChange={(e) => {
                setSelectedAppointmentId(e.target.value);
                setPage(1);
              }}
              options={[
                { value: ALL_APPOINTMENTS, label: 'All (includes uploads without appointment)' },
                ...appointmentOptions,
              ]}
              disabled={appointmentOptions.length === 0}
            />
          </div>
        )}
        {listEnabled && (
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Input
              label="Search"
              placeholder="Search documents..."
              leadingIcon={<Search className="w-4 h-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {showSelectPatientEmpty ? (
        <EmptyState
          icon={<User className="w-6 h-6" />}
          title="Select a patient"
          description="Please select a patient to view their documents. You can then narrow results by appointment."
        />
      ) : showSelectDoctorEmpty ? (
        <EmptyState
          icon={<Stethoscope className="w-6 h-6" />}
          title="Select a doctor"
          description="Please select a doctor to view documents from your appointments with them. You can then filter by a specific visit."
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="md">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No documents found"
          description={
            selectedAppointmentId
              ? 'No documents for this appointment. Try another filter or ask your care team to upload records.'
              : isPatient
                ? 'No documents linked to this doctor yet. Try a specific appointment or check back after your visit.'
                : 'Upload patient records, reports, or other documents for this patient.'
          }
          action={
            canUpload && (
              <Button onClick={() => setUploadOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Upload Document
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              showPatient={false}
              onView={setPreviewDoc}
              onDelete={() => setDeleteId(doc.id)}
              onReprocess={
                canManageDocuments
                  ? () => reprocessMutation.mutate(doc.id)
                  : undefined
              }
              canDelete={canManageDocuments}
            />
          ))}
        </div>
      )}

      {listEnabled && data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
      )}

      <DocumentPreviewModal
        open={!!previewDoc}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        fixedPatientId={isStaff ? selectedPatientId || undefined : undefined}
        patientOptions={patientOptions}
        appointmentOptions={appointmentOptions}
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
    </div>
  );
}
