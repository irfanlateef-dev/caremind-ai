import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video, FileText, Brain, FileCheck, X, CheckCircle, XCircle,
  Clock, User, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, CardHeader, Modal, ModalFooter, Skeleton } from '@/components/ui';
import { AppointmentStatusBadge, ConsentStatusBadge } from '@/components/shared/StatusBadge';
import { AiOutputDetailPage } from '@/features/ai-outputs/AiOutputDetailPage';
import { AppointmentDocumentsSection } from '@/features/documents/AppointmentDocumentsSection';
import { appointmentsApi, appointmentKeys } from '@/api/appointments.api';
import { consultationsApi, consultationKeys } from '@/api/consultations.api';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';
import { formatDateTime } from '@/utils/formatDate';
import { cn } from '@/utils/cn';
import { ConsultationTranscriptPanel } from '@/features/consultations/ConsultationTranscriptPanel';

type Tab = 'overview' | 'transcript' | 'ai-outputs' | 'documents';

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: appointment, isLoading } = useQuery({
    queryKey: appointmentKeys.detail(id!),
    queryFn: () => appointmentsApi.get(id!),
    enabled: !!id,
  });

  const { data: transcript } = useQuery({
    queryKey: consultationKeys.transcript(id!),
    queryFn: () => consultationsApi.getTranscript(id!),
    enabled: !!id && tab === 'transcript',
    retry: 1,
  });

  const consentMutation = useMutation({
    mutationFn: (status: 'accepted' | 'declined') => appointmentsApi.updateConsent(id!, status),
    onSuccess: (data) => {
      toast.success(data.consentStatus === 'accepted' ? 'Consent accepted!' : 'Consent declined.');
      queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(id!) });
    },
    onError: () => toast.error('Failed to update consent'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => appointmentsApi.cancel(id!),
    onSuccess: () => {
      toast.success('Appointment cancelled');
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      navigate('/appointments');
    },
    onError: () => toast.error('Failed to cancel appointment'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') =>
      appointmentsApi.updateStatus(id!, status),
    onSuccess: () => {
      toast.success('Appointment updated');
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(id!) });
    },
    onError: () => toast.error('Failed to update appointment'),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-6">
        <p className="text-muted">Appointment not found.</p>
      </div>
    );
  }

  const canJoin =
    (appointment.status === 'scheduled' || appointment.status === 'in_progress') &&
    (role === UserRole.DOCTOR || (role === UserRole.PATIENT && appointment.consentStatus === 'accepted'));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Calendar className="w-4 h-4" /> },
    { key: 'transcript', label: 'Transcript', icon: <FileText className="w-4 h-4" /> },
    { key: 'ai-outputs', label: 'AI Outputs', icon: <Brain className="w-4 h-4" /> },
    { key: 'documents', label: 'Documents', icon: <FileCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">Appointment</h1>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
          <p className="text-muted">
            {formatDateTime(appointment.scheduledAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canJoin && (
            <Button
              leftIcon={<Video className="w-4 h-4" />}
              onClick={() => navigate(`/appointments/${id}/consultation`)}
            >
              Join Consultation
            </Button>
          )}

          {(role === UserRole.ADMIN || role === UserRole.DOCTOR) && appointment.status === 'scheduled' && (
            <Button
              variant="outline"
              leftIcon={<Clock className="w-4 h-4" />}
              onClick={() => updateStatusMutation.mutate('in_progress')}
              loading={updateStatusMutation.isPending}
            >
              Start
            </Button>
          )}

          {(role === UserRole.ADMIN || role === UserRole.DOCTOR) && appointment.status === 'in_progress' && (
            <Button
              variant="outline"
              leftIcon={<CheckCircle className="w-4 h-4" />}
              onClick={() => updateStatusMutation.mutate('completed')}
              loading={updateStatusMutation.isPending}
            >
              Complete
            </Button>
          )}

          {(role === UserRole.ADMIN || role === UserRole.DOCTOR) &&
            appointment.status !== 'cancelled' &&
            appointment.status !== 'completed' && (
            <Button
              variant="outline"
              leftIcon={<X className="w-4 h-4" />}
              onClick={() => setDeleteOpen(true)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Patient Consent Section */}
      {role === UserRole.PATIENT && appointment.consentStatus === 'pending' && (
        <Card className="border-warning bg-warning-50">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-warning-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-warning-800 mb-1">Recording Consent Required</h3>
              <p className="text-sm text-warning-700 mb-4">
                This consultation will be recorded for AI-assisted note generation. Please accept or decline consent before joining.
              </p>
              <div className="flex gap-3">
                <Button
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  onClick={() => consentMutation.mutate('accepted')}
                  loading={consentMutation.isPending}
                >
                  Accept & Join
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<XCircle className="w-4 h-4" />}
                  onClick={() => consentMutation.mutate('declined')}
                  loading={consentMutation.isPending}
                >
                  Decline
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {role === UserRole.PATIENT && appointment.consentStatus !== 'pending' && (
        <div className="flex items-center gap-2">
          <ConsentStatusBadge status={appointment.consentStatus} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-slate-700 hover:border-border'
              )}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Patient" action={<User className="w-4 h-4 text-muted" />} />
            <p className="font-semibold text-slate-900">
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </p>
            <p className="text-sm text-muted mt-0.5">{appointment.patient?.email}</p>
            {appointment.patient?.phone && (
              <p className="text-sm text-muted">{appointment.patient.phone}</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Doctor" action={<User className="w-4 h-4 text-muted" />} />
            <p className="font-semibold text-slate-900">
              Dr. {appointment.doctor?.firstName} {appointment.doctor?.lastName}
            </p>
            {appointment.doctor?.specialty && (
              <p className="text-sm text-muted mt-0.5">{appointment.doctor.specialty}</p>
            )}
            <p className="text-sm text-muted">{appointment.doctor?.email}</p>
          </Card>
          <Card>
            <CardHeader title="Schedule" action={<Clock className="w-4 h-4 text-muted" />} />
            <p className="font-semibold text-slate-900">{formatDateTime(appointment.scheduledAt)}</p>
            <p className="text-sm text-muted mt-1">Status: <AppointmentStatusBadge status={appointment.status} /></p>
          </Card>
          <Card>
            <CardHeader title="Consent" action={<FileText className="w-4 h-4 text-muted" />} />
            <ConsentStatusBadge status={appointment.consentStatus} />
            <p className="text-sm text-muted mt-2">
              Recording consent is required before starting the consultation.
            </p>
          </Card>
        </div>
      )}

      {tab === 'transcript' && (
        <Card>
          <CardHeader title="Consultation Transcript" />
          {transcript ? (
            <ConsultationTranscriptPanel
              content={transcript.content}
              segments={transcript.segments}
            />
          ) : (
            <div className="text-center py-12">
              <FileText className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-muted">No transcript available yet.</p>
              <p className="text-sm text-muted mt-1">
                Transcripts are generated after the consultation recording is processed.
              </p>
            </div>
          )}
        </Card>
      )}

      {tab === 'ai-outputs' && id && (
        <AiOutputDetailPage appointmentId={id} embedded />
      )}

      {tab === 'documents' && id && appointment.patientId && (
        <AppointmentDocumentsSection
          patientId={appointment.patientId}
          appointmentId={id}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Cancel Appointment" size="sm">
        <p className="text-slate-700">Are you sure you want to cancel this appointment? This cannot be undone.</p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Keep Appointment
          </Button>
          <Button
            variant="danger"
            loading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            Yes, Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
