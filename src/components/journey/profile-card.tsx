'use client';

import { cn } from '@/lib/utils';
import type { OnboardingState } from '@/lib/journey/session-state';

interface ProfileCardProps {
  state: Partial<OnboardingState> | null;
  className?: string;
}

interface FieldDef {
  key: keyof OnboardingState;
  label: string;
  format?: (v: unknown) => string;
}

const FIELDS: FieldDef[] = [
  { key: 'companyName', label: 'Company' },
  { key: 'websiteUrl', label: 'Website' },
  { key: 'businessModel', label: 'Model' },
  { key: 'industry', label: 'Industry' },
  { key: 'icpDescription', label: 'ICP' },
  { key: 'productDescription', label: 'Product' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'offerPricing', label: 'Pricing' },
  {
    key: 'marketingChannels',
    label: 'Channels',
    format: (v) => (Array.isArray(v) ? v.join(', ') : String(v)),
  },
  { key: 'goals', label: 'Goals' },
  { key: 'monthlyBudget', label: 'Budget' },
];

const REQUIRED_KEYS: Array<keyof OnboardingState> = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
];

export function ProfileCard({ state, className }: ProfileCardProps) {
  if (!state) return null;

  const answeredFields = FIELDS.filter((f) => {
    const v = state[f.key];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== '';
  });

  if (answeredFields.length === 0) return null;

  const requiredAnswered = REQUIRED_KEYS.filter((k) => {
    const v = state[k];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const progress = requiredAnswered / REQUIRED_KEYS.length;

  return (
    <div
      className={cn('mb-6 rounded-xl p-4', className)}
      style={{
        background: 'var(--bg-glass-panel)',
        border: '1px solid var(--border-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium tracking-wide uppercase"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-instrument-sans)' }}
        >
          Client Dossier
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {requiredAnswered}/{REQUIRED_KEYS.length} fields
        </span>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
        {answeredFields.map(({ key, label, format }) => {
          const raw = state[key];
          const value = format ? format(raw) : String(raw);
          const truncated = value.length > 40 ? value.slice(0, 38) + '…' : value;
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {label}
              </span>
              <span
                className="text-xs leading-snug"
                style={{ color: 'var(--text-primary)' }}
                title={value}
              >
                {truncated}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        className="h-0.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--border-glass)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: 'var(--accent-primary, #6366f1)',
          }}
        />
      </div>
    </div>
  );
}
