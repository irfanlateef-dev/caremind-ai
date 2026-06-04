export const ADMIN_DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 days' },
  { id: '1m', label: '1 month' },
  { id: '6m', label: '6 months' },
  { id: '1y', label: '1 year' },
  { id: 'ytd', label: 'YTD' },
  { id: 'custom', label: 'Custom' },
] as const;

export type AdminDatePreset = (typeof ADMIN_DATE_PRESETS)[number]['id'];

export interface AdminDateRangeParams {
  preset: AdminDatePreset;
  from?: string;
  to?: string;
}

export function buildAdminDateQueryParams(range: AdminDateRangeParams): Record<string, string> {
  const params: Record<string, string> = { preset: range.preset };
  if (range.preset === 'custom' && range.from && range.to) {
    params.from = range.from;
    params.to = range.to;
  }
  return params;
}

export function formatPeriodLabel(preset: AdminDatePreset, from: string, to: string): string {
  const match = ADMIN_DATE_PRESETS.find((p) => p.id === preset);
  if (preset !== 'custom' && match) return match.label;
  const fromDate = new Date(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const toDate = new Date(to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fromDate} – ${toDate}`;
}

export function toCustomRangeIso(fromDate: string, toDate: string): { from: string; to: string } | null {
  if (!fromDate || !toDate) return null;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T23:59:59`);
  if (from > to) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}
