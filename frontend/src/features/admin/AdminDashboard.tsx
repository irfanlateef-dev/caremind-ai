import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, ChevronRight, ShieldCheck, Plus, Stethoscope,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Button, Card, CardHeader, Skeleton, Badge } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/layout/PageHeader';
import { adminApi, adminKeys } from '@/api/admin.api';
import { AppointmentStatus } from '@/types';
import { formatRelative } from '@/utils';
import { getAuditLogDisplayName, getAuditLogSummary } from '@/utils/audit-log-labels';
import { AdminDateRangePicker } from './AdminDateRangePicker';
import {
  type AdminDateRangeParams,
  formatPeriodLabel,
} from './admin-date-range';

const PIE_COLORS: Record<string, string> = {
  [AppointmentStatus.SCHEDULED]: '#0EA5E9',
  [AppointmentStatus.IN_PROGRESS]: '#F59E0B',
  [AppointmentStatus.COMPLETED]: '#10B981',
  [AppointmentStatus.CANCELLED]: '#EF4444',
};

function StatCard({ label, value, icon, loading, hint }: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  loading?: boolean;
  hint?: string;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-3xl font-bold text-slate-900">{(value ?? 0).toLocaleString()}</p>
      )}
      <p className="text-sm text-muted mt-0.5">{label}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </Card>
  );
}

const DEFAULT_RANGE: AdminDateRangeParams = { preset: '7d' };

export function AdminDashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<AdminDateRangeParams>(DEFAULT_RANGE);

  const rangeReady = dateRange.preset !== 'custom' || Boolean(dateRange.from && dateRange.to);

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.dashboard(dateRange),
    queryFn: () => adminApi.getDashboard(dateRange),
    enabled: rangeReady,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: adminKeys.activity,
    queryFn: adminApi.getRecentActivity,
  });

  const periodLabel = data
    ? formatPeriodLabel(data.period.preset as AdminDateRangeParams['preset'], data.period.from, data.period.to)
    : '7 days';

  const pieData = (data?.statusBreakdown ?? []).map((row) => ({
    name: row.label,
    value: row.count,
    status: row.status,
  }));

  const hasChartData = (data?.timeSeries ?? []).some((p) => p.count > 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Organization overview and appointment analytics"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              onClick={() => navigate('/admin/audit-logs')}
            >
              Audit Logs
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/users')}>
              <Plus className="w-4 h-4 mr-1" /> Invite User
            </Button>
            <Button size="sm" onClick={() => navigate('/appointments')}>
              <Plus className="w-4 h-4 mr-1" /> New Appointment
            </Button>
          </div>
        }
      />

      <Card padding="md">
        <AdminDateRangePicker value={dateRange} onChange={setDateRange} />
      </Card>

      {!rangeReady && (
        <p className="text-sm text-muted">Select a start and end date, then click Apply for a custom range.</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data?.totalUsers} icon={<Users className="w-5 h-5" />} loading={isLoading} hint="Active doctors and patients (excludes admins)" />
        <StatCard label="Doctors" value={data?.totalDoctors} icon={<Stethoscope className="w-5 h-5" />} loading={isLoading} hint="Active doctor accounts" />
        <StatCard label="Patients" value={data?.totalPatients} icon={<Users className="w-5 h-5" />} loading={isLoading} hint="Active patient accounts" />
        <StatCard
          label="Appointments"
          value={data?.appointmentsInPeriod}
          icon={<Calendar className="w-5 h-5" />}
          loading={isLoading}
          hint={`Scheduled in ${periodLabel}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Appointments Over Time"
              subtitle={`By scheduled date · ${periodLabel}`}
            />
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : !hasChartData ? (
              <p className="text-sm text-muted text-center py-16">No appointments in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.timeSeries ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0EA5E9"
                    strokeWidth={2}
                    fill="url(#colorAppointments)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Status Distribution" subtitle={periodLabel} />
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : pieData.every((d) => d.value === 0) ? (
            <p className="text-sm text-muted text-center py-16">No appointments in this period</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={PIE_COLORS[entry.status] ?? '#94A3B8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[entry.status] ?? '#94A3B8' }}
                    />
                    <span className="text-xs text-muted">{entry.name}</span>
                    <span className="text-xs font-semibold text-slate-900 ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent Activity"
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/audit-logs')}>
              View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          }
        />
        <div className="divide-y divide-border">
          {activityLoading ? (
            <div className="py-8 flex justify-center">
              <Skeleton className="h-4 w-48" />
            </div>
          ) : activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No recent activity</p>
          ) : (
            activity.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-3">
                <Avatar name={getAuditLogDisplayName(log)} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {getAuditLogDisplayName(log)}
                  </p>
                  <p className="text-sm text-slate-700 leading-snug mt-0.5">
                    {getAuditLogSummary(log)}
                  </p>
                  <Badge variant="gray" className="mt-1 font-mono text-[10px]">
                    {log.action}
                  </Badge>
                </div>
                <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">
                  {formatRelative(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
