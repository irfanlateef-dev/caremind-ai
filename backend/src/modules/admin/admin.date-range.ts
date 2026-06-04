import { ValidationError } from '../../core/errors.js';
import type { DashboardQueryInput } from './admin.schema.js';

export type DatePreset = NonNullable<DashboardQueryInput['preset']>;

export interface ResolvedDateRange {
  from: Date;
  to: Date;
  preset: DatePreset;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function daysAgo(n: number, base = new Date()): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return d;
}

export function resolveAdminDateRange(query: DashboardQueryInput): ResolvedDateRange {
  const now = new Date();
  const preset = query.preset ?? '7d';

  if (preset === 'custom') {
    if (!query.from || !query.to) {
      throw new ValidationError('from and to are required for custom date range');
    }
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (from > to) throw new ValidationError('from must be before to');
    return { from, to, preset };
  }

  switch (preset) {
    case 'today':
      return { from: startOfLocalDay(now), to: endOfLocalDay(now), preset };
    case 'yesterday': {
      const y = daysAgo(1, now);
      return { from: startOfLocalDay(y), to: endOfLocalDay(y), preset };
    }
    case '7d':
      return { from: startOfLocalDay(daysAgo(6, now)), to: endOfLocalDay(now), preset };
    case '1m':
      return { from: startOfLocalDay(daysAgo(29, now)), to: endOfLocalDay(now), preset };
    case '6m': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from: startOfLocalDay(d), to: endOfLocalDay(now), preset };
    }
    case '1y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from: startOfLocalDay(d), to: endOfLocalDay(now), preset };
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: startOfLocalDay(start), to: endOfLocalDay(now), preset };
    }
    default:
      return { from: startOfLocalDay(daysAgo(6, now)), to: endOfLocalDay(now), preset: '7d' };
  }
}
