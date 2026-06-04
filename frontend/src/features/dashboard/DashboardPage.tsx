import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  FileCheck,
  TrendingUp,
  Clock,
  Plus,
  ChevronRight,
  Video,
  FileText,
  BrainCircuit,
} from 'lucide-react';
import { Button, Card, CardHeader, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppointmentStatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { dashboardApi, dashboardKeys } from '@/api/dashboard.api';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';
import type { Appointment } from '@/types';
import { formatDateTime } from '@/utils/formatDate';

function StatCard({ label, value, icon, trend, loading }: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  trend?: string;
  loading?: boolean;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between">
        <div>
          {loading ? (
            <Skeleton className="h-8 w-16 mb-1" />
          ) : (
            <p className="text-3xl font-bold text-slate-900">{value ?? 0}</p>
          )}
          <p className="text-sm text-muted mt-0.5">{label}</p>
          {trend && <p className="text-xs text-success-600 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trend}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function DashboardAppointmentRow({
  appt,
  onOpen,
  onJoin,
  viewAs = 'doctor',
}: {
  appt: Appointment;
  onOpen: () => void;
  onJoin: () => void;
  viewAs?: 'doctor' | 'patient';
}) {
  const showJoin = appt.status === 'scheduled' || appt.status === 'in_progress';
  const title =
    viewAs === 'patient'
      ? `Dr. ${appt.doctor?.firstName ?? ''} ${appt.doctor?.lastName ?? ''}`.trim()
      : `${appt.patient?.firstName ?? ''} ${appt.patient?.lastName ?? ''}`.trim();
  const avatarName =
    viewAs === 'patient'
      ? title
      : `${appt.patient?.firstName} ${appt.patient?.lastName}`;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface cursor-pointer transition-colors"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
    >
      <Avatar name={avatarName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
        <p className="text-xs text-muted">{formatDateTime(appt.scheduledAt)}</p>
      </div>
      <AppointmentStatusBadge status={appt.status} />
      {showJoin && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Video className="w-3.5 h-3.5" />}
          onClick={(e) => { e.stopPropagation(); onJoin(); }}
        >
          Join
        </Button>
      )}
    </div>
  );
}

function DoctorDashboard() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.doctor,
    queryFn: () => dashboardApi.getDoctor(),
    retry: 1,
  });

  const stats = data?.stats;
  const inProgress = data?.inProgressAppointments ?? [];
  const upcoming = data?.upcomingAppointments ?? [];
  const scheduledUpcoming = upcoming.filter((a) => a.status === 'scheduled');
  const listForUpcomingCard = inProgress.length > 0 ? scheduledUpcoming : upcoming;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Your schedule and tasks for today"
        action={
          <Button onClick={() => navigate('/appointments')}>
            <Plus className="w-4 h-4 mr-1" /> Schedule Appointment
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Today's Appointments"
          value={stats?.todayAppointments}
          icon={<Calendar className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          label="In Progress"
          value={stats?.inProgressCount}
          icon={<Video className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          label="Pending AI Reviews"
          value={stats?.pendingAiReviews}
          icon={<FileCheck className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          label="Active (Scheduled)"
          value={stats?.totalScheduled}
          icon={<Clock className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {inProgress.length > 0 && (
            <Card>
              <CardHeader
                title="In Progress"
                subtitle={`${inProgress.length} consultation${inProgress.length === 1 ? '' : 's'} active now`}
                action={
                  <Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>
                    View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                }
              />
              <div className="space-y-3">
                {inProgress.map((appt) => (
                  <DashboardAppointmentRow
                    key={appt.id}
                    appt={appt}
                    onOpen={() => navigate(`/appointments/${appt.id}`)}
                    onJoin={() => navigate(`/appointments/${appt.id}/consultation`)}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Upcoming Appointments"
              subtitle="In progress first, then scheduled"
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>
                  View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              }
            />
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : listForUpcomingCard.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">
                  {inProgress.length > 0 ? 'No further scheduled appointments' : 'No active or upcoming appointments'}
                </p>
              ) : (
                listForUpcomingCard.slice(0, 8).map((appt) => (
                  <DashboardAppointmentRow
                    key={appt.id}
                    appt={appt}
                    onOpen={() => navigate(`/appointments/${appt.id}`)}
                    onJoin={() => navigate(`/appointments/${appt.id}/consultation`)}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pending AI Reviews" />
            {isLoading ? (
              <Skeleton className="h-8 w-12 mb-4" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 mb-1">{stats?.pendingAiReviews ?? 0}</p>
            )}
            <p className="text-sm text-muted mb-4">
              AI outputs awaiting your approval before patients can see summaries.
            </p>
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => navigate('/ai-outputs')}
            >
              <FileCheck className="w-4 h-4 mr-1" /> Review AI Outputs
            </Button>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-2">
              {[
                { label: 'AI Assistant', icon: <BrainCircuit className="w-4 h-4" />, to: '/ai-assistant' },
                { label: 'View Documents', icon: <FileText className="w-4 h-4" />, to: '/documents' },
                { label: 'AI Outputs', icon: <FileCheck className="w-4 h-4" />, to: '/ai-outputs' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-md text-sm text-slate-700 hover:bg-surface transition-colors text-left"
                >
                  <span className="text-primary">{action.icon}</span>
                  {action.label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PatientDashboard() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.patient,
    queryFn: () => dashboardApi.getPatient(),
    retry: 1,
  });

  const stats = data?.stats;
  const inProgress = data?.inProgressAppointments ?? [];
  const upcoming = data?.upcomingAppointments ?? [];
  const scheduledUpcoming = upcoming.filter((a) => a.status === 'scheduled');
  const listForUpcomingCard = inProgress.length > 0 ? scheduledUpcoming : upcoming;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Dashboard" subtitle="Your health at a glance" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Today's Appointments"
          value={stats?.todayAppointments}
          icon={<Calendar className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          label="In Progress"
          value={stats?.inProgressCount}
          icon={<Video className="w-5 h-5" />}
          loading={isLoading}
        />
        <StatCard
          label="Active (Scheduled)"
          value={stats?.totalScheduled}
          icon={<Clock className="w-5 h-5" />}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {inProgress.length > 0 && (
            <Card>
              <CardHeader
                title="In Progress"
                subtitle={`${inProgress.length} consultation${inProgress.length === 1 ? '' : 's'} active now`}
                action={
                  <Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>
                    View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                }
              />
              <div className="space-y-3">
                {inProgress.map((appt) => (
                  <DashboardAppointmentRow
                    key={appt.id}
                    appt={appt}
                    viewAs="patient"
                    onOpen={() => navigate(`/appointments/${appt.id}`)}
                    onJoin={() => navigate(`/appointments/${appt.id}/consultation`)}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Upcoming Appointments"
              subtitle="In progress first, then scheduled"
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>
                  View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              }
            />
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : listForUpcomingCard.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted text-sm mb-3">
                    {inProgress.length > 0
                      ? 'No further scheduled appointments'
                      : 'No active or upcoming appointments'}
                  </p>
                  <Button size="sm" onClick={() => navigate('/appointments')}>
                    View Appointments
                  </Button>
                </div>
              ) : (
                listForUpcomingCard.slice(0, 8).map((appt) => (
                  <DashboardAppointmentRow
                    key={appt.id}
                    appt={appt}
                    viewAs="patient"
                    onOpen={() => navigate(`/appointments/${appt.id}`)}
                    onJoin={() => navigate(`/appointments/${appt.id}/consultation`)}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="space-y-2">
              {[
                { label: 'My Documents', icon: <FileText className="w-4 h-4" />, to: '/documents' },
                { label: 'AI Assistant', icon: <BrainCircuit className="w-4 h-4" />, to: '/ai-assistant' },
                { label: 'Appointments', icon: <Calendar className="w-4 h-4" />, to: '/appointments' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-md text-sm text-slate-700 hover:bg-surface transition-colors text-left"
                >
                  <span className="text-primary">{action.icon}</span>
                  {action.label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { role } = useAuthStore();

  if (role === UserRole.ADMIN) return <AdminDashboard />;
  if (role === UserRole.DOCTOR) return <DoctorDashboard />;
  return <PatientDashboard />;
}
