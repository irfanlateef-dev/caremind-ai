interface AppointmentRow {
  scheduledAt: Date;
  status: string;
}

interface TimeBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function buildDailyBuckets(from: Date, to: Date): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const cursor = startOfLocalDay(from);
  const end = startOfLocalDay(to);

  while (cursor <= end) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const key = dayStart.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: formatDayLabel(dayStart),
      start: dayStart,
      end: dayEnd,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function buildWeeklyBuckets(from: Date, to: Date): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const cursor = startOfLocalDay(from);
  const end = startOfLocalDay(to);

  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    if (weekEnd > to) weekEnd.setTime(to.getTime());

    const key = weekStart.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: formatWeekLabel(weekStart),
      start: weekStart,
      end: weekEnd,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

function buildMonthlyBuckets(from: Date, to: Date): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = startOfLocalDay(to);

  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const cappedEnd = monthEnd > to ? to : monthEnd;
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: formatMonthLabel(monthStart),
      start: monthStart,
      end: cappedEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function pickBuckets(from: Date, to: Date): TimeBucket[] {
  const daySpan = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daySpan <= 31) return buildDailyBuckets(from, to);
  if (daySpan <= 120) return buildWeeklyBuckets(from, to);
  return buildMonthlyBuckets(from, to);
}

export function buildAppointmentTimeSeries(
  appointments: AppointmentRow[],
  from: Date,
  to: Date,
): { date: string; count: number }[] {
  const buckets = pickBuckets(from, to);
  const counts = new Map(buckets.map((b) => [b.key, 0]));

  for (const appt of appointments) {
    const at = appt.scheduledAt.getTime();
    for (const bucket of buckets) {
      if (at >= bucket.start.getTime() && at <= bucket.end.getTime()) {
        counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
        break;
      }
    }
  }

  return buckets.map((b) => ({
    date: b.label,
    count: counts.get(b.key) ?? 0,
  }));
}

const STATUS_ORDER = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function buildAppointmentStatusBreakdown(
  appointments: AppointmentRow[],
): { status: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const status of STATUS_ORDER) counts.set(status, 0);

  for (const appt of appointments) {
    counts.set(appt.status, (counts.get(appt.status) ?? 0) + 1);
  }

  return STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: counts.get(status) ?? 0,
  }));
}
