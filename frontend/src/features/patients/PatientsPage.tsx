import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  ModalFooter,
  Pagination,
  Select,
  Skeleton,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { getApiErrorMessage } from '@/api/errors';
import { patientsApi, patientKeys, GENDER_OPTIONS, formatGender } from '@/api/patients.api';
import { usersApi, userKeys } from '@/api/users.api';
import { PatientGender } from '@/types';
import { formatDate } from '@/utils/formatDate';

const invitePatientSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
});

type InvitePatientValues = z.infer<typeof invitePatientSchema>;

export function PatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: patientKeys.list({ page, pageSize: 20 }),
    queryFn: () => patientsApi.list({ page, pageSize: 20 }),
    retry: 1,
  });

  const form = useForm<InvitePatientValues>({
    resolver: zodResolver(invitePatientSchema),
    defaultValues: { gender: PatientGender.MALE },
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      toast.success('Patient removed');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: patientKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to remove patient')),
  });

  const inviteMutation = useMutation({
    mutationFn: usersApi.invitePatient,
    onSuccess: () => {
      toast.success('Patient invitation sent!');
      setInviteOpen(false);
      form.reset({ gender: PatientGender.MALE });
      queryClient.invalidateQueries({ queryKey: patientKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: () => toast.error('Failed to send invitation'),
  });

  const searchLower = search.trim().toLowerCase();
  const items = (data?.items ?? []).filter((p) => {
    if (!searchLower) return true;
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    return name.includes(searchLower) || p.email.toLowerCase().includes(searchLower);
  });

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Patients"
        subtitle="View and invite patients"
        action={(
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
            Add Patient
          </Button>
        )}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search by name or email..."
            leadingIcon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="hidden md:block">
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Gender</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">DOB</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Sessions</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState title="No patients found" description="Invite a patient to get started." />
                    </td>
                  </tr>
                ) : (
                  items.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-surface/60 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${p.firstName} ${p.lastName}`} size="xs" />
                          <span className="font-medium text-slate-900">
                            {p.firstName} {p.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatGender(p.gender)}</td>
                      <td className="px-4 py-3 text-slate-700">{p.email}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.sessionCount ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              userId: p.userId,
                              name: `${p.firstName} ${p.lastName}`.trim(),
                            });
                          }}
                          className="p-2 text-muted hover:text-danger hover:bg-danger-50 rounded-md transition-colors"
                          aria-label={`Remove ${p.firstName} ${p.lastName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-64 mt-2" />
            </Card>
          ))
        ) : items.length === 0 ? (
          <EmptyState title="No patients found" description="Invite a patient to get started." />
        ) : (
          items.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-elevated transition-shadow"
              onClick={() => navigate(`/patients/${p.id}`)}
            >
              <div className="flex items-center gap-3">
                <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-muted truncate">{p.email}</p>
                  <p className="text-xs text-muted mt-1">
                    {formatGender(p.gender)} · {p.sessionCount ?? 0} sessions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({
                      userId: p.userId,
                      name: `${p.firstName} ${p.lastName}`.trim(),
                    });
                  }}
                  className="p-2 text-muted hover:text-danger"
                  aria-label="Remove patient"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Patient"
        size="sm"
      >
        <p className="text-sm text-slate-700">
          Remove <strong>{deleteTarget?.name}</strong>? They will lose access to the portal. This cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.userId)}
          >
            Remove Patient
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); form.reset({ gender: PatientGender.MALE }); }} title="Add Patient">
        <form
          onSubmit={form.handleSubmit((d) => inviteMutation.mutate(d))}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="First name" error={form.formState.errors.firstName?.message} {...form.register('firstName')} />
            <Input label="Last name" error={form.formState.errors.lastName?.message} {...form.register('lastName')} />
          </div>
          <Input label="Email" error={form.formState.errors.email?.message} {...form.register('email')} />
          <Select
            label="Gender"
            options={[...GENDER_OPTIONS]}
            error={form.formState.errors.gender?.message}
            {...form.register('gender')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Date of birth (optional)" type="date" {...form.register('dateOfBirth')} />
            <Input label="Phone (optional)" {...form.register('phone')} />
          </div>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={() => { setInviteOpen(false); form.reset({ gender: PatientGender.MALE }); }}>
              Cancel
            </Button>
            <Button type="submit" loading={inviteMutation.isPending}>
              Send Invite
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
