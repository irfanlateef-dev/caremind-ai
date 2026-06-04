import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Mail, Phone, Trash2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  ModalFooter,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { getApiErrorMessage } from '@/api/errors';
import { patientsApi, patientKeys, formatGender } from '@/api/patients.api';
import { usersApi, userKeys } from '@/api/users.api';
import { formatDate, formatDateTime } from '@/utils/formatDate';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionsPage, setSessionsPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: patientKeys.detail(id!),
    queryFn: () => patientsApi.get(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      toast.success('Patient removed');
      queryClient.invalidateQueries({ queryKey: patientKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      navigate('/patients', { replace: true });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to remove patient')),
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: patientKeys.sessions(id!, { page: sessionsPage, pageSize: 20 }),
    queryFn: () => patientsApi.listSessions(id!, { page: sessionsPage, pageSize: 20 }),
    enabled: !!id,
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

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-muted">Patient not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/patients')}>
          Patients
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-muted mt-1">{patient.sessionCount ?? 0} total sessions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Trash2 className="w-4 h-4" />}
          onClick={() => setConfirmDelete(true)}
        >
          Remove Patient
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Profile" action={<User className="w-4 h-4 text-muted" />} />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Gender</dt>
              <dd className="font-medium text-slate-900">{formatGender(patient.gender)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Date of birth</dt>
              <dd className="font-medium text-slate-900">
                {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : '—'}
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Contact" action={<Mail className="w-4 h-4 text-muted" />} />
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-4 h-4 text-muted" />
              {patient.email}
            </div>
            {patient.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-muted" />
                {patient.phone}
              </div>
            )}
          </dl>
        </Card>
      </div>

      <Card padding="none">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <p className="text-sm text-muted">Appointments for this patient (20 per page)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date & Time</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Doctor</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessionsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : sessions?.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10">
                    <EmptyState
                      icon={<Calendar className="w-6 h-6" />}
                      title="No sessions yet"
                      description="Schedule an appointment for this patient."
                    />
                  </td>
                </tr>
              ) : (
                sessions?.items.map((session) => (
                  <tr key={session.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(session.scheduledAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {session.doctor
                        ? `Dr. ${session.doctor.firstName} ${session.doctor.lastName}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <AppointmentStatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/appointments/${session.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sessions && sessions.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border">
            <Pagination
              page={sessionsPage}
              totalPages={sessions.totalPages}
              onPageChange={setSessionsPage}
            />
          </div>
        )}
      </Card>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Remove Patient" size="sm">
        <p className="text-sm text-slate-700">
          Remove <strong>{patient.firstName} {patient.lastName}</strong>? They will lose access to the portal.
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => patient.userId && deleteMutation.mutate(patient.userId)}
          >
            Remove Patient
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
