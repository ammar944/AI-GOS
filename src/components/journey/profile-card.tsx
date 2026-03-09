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
  { key: 'icpDescription', label: 'Primary ICP' },
  { key: 'productDescription', label: 'Product' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'offerPricing', label: 'Pricing' },
  {
    key: 'marketingChannels',
    label: 'Active Channels',
    format: (v) => (Array.isArray(v) ? v.join(', ') : String(v)),
  },
  { key: 'goals', label: 'Pain Point' },
  { key: 'monthlyBudget', label: 'Budget' },
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

  // Take first 6 fields for the 3-column grid
  const displayFields = answeredFields.slice(0, 6);

  return (
    <div
      className={cn(
        'glass-surface rounded-[24px] p-8',
        className
      )}
    >
      {/* Section title */}
      <h4 className="text-xs font-mono text-white/30 uppercase tracking-widest mb-6">
        Profile Snapshot: {state.companyName || 'Project Alpha'}
      </h4>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-8">
        {displayFields.map(({ key, label, format }) => {
          const raw = state[key];
          const value = format ? format(raw) : String(raw);
          const truncated = value.length > 50 ? value.slice(0, 48) + '…' : value;

          return (
            <div key={key}>
              <p className="text-[10px] text-white/30 uppercase mb-2">
                {label}
              </p>
              <p className="text-sm font-medium" title={value}>
                {truncated}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
