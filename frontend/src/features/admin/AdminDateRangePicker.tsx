import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui';
import {
  ADMIN_DATE_PRESETS,
  type AdminDatePreset,
  type AdminDateRangeParams,
  toCustomRangeIso,
} from './admin-date-range';

interface AdminDateRangePickerProps {
  value: AdminDateRangeParams;
  onChange: (next: AdminDateRangeParams) => void;
}

export function AdminDateRangePicker({ value, onChange }: AdminDateRangePickerProps) {
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const selectPreset = (preset: AdminDatePreset) => {
    if (preset === 'custom') {
      onChange({ preset: 'custom' });
      return;
    }
    onChange({ preset });
  };

  const applyCustom = () => {
    const iso = toCustomRangeIso(customFrom, customTo);
    if (!iso) return;
    onChange({ preset: 'custom', from: iso.from, to: iso.to });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Calendar className="w-4 h-4" />
        <span>Period</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ADMIN_DATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => selectPreset(preset.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              value.preset === preset.id
                ? 'bg-primary text-white'
                : 'bg-surface text-slate-600 hover:bg-primary-50 hover:text-primary',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
          <Input
            type="date"
            label="From"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <Input
            type="date"
            label="To"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="px-3 py-2 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
