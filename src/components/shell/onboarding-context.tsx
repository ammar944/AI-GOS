'use client';

import { cn } from '@/lib/utils';
import type { OnboardingState } from '@/lib/journey/session-state';
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from '@/lib/journey/session-state';

interface OnboardingContextProps {
  onboardingState: Partial<OnboardingState> | null;
}

const CONTEXT_LABELS: Record<string, string> = {
  companyName: 'Company',
  businessModel: 'Model',
  industry: 'Industry',
  icpDescription: 'ICP',
  productDescription: 'Product',
  offerPricing: 'Pricing',
  marketingChannels: 'Channels',
  goals: 'Goals',
  monthlyBudget: 'Budget',
  websiteUrl: 'Website',
  teamSize: 'Team',
  currentCac: 'CAC',
  targetCpa: 'Target CPA',
  topPerformingChannel: 'Top Channel',
  biggestMarketingChallenge: 'Challenge',
  buyerPersonaTitle: 'Persona',
  salesCycleLength: 'Sales Cycle',
  avgDealSize: 'Deal Size',
  primaryKpi: 'KPI',
  geographicFocus: 'Geography',
  seasonalityPattern: 'Seasonality',
  competitors: 'Competitors',
};

function formatFieldValue(
  field: keyof OnboardingState,
  value: unknown
): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function isFieldFilled(
  field: keyof OnboardingState,
  state: Partial<OnboardingState> | null
): boolean {
  if (!state) return false;
  const val = state[field];
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

interface ContextRowProps {
  label: string;
  value: string | null;
  isEmpty: boolean;
}

function ContextRow({ label, value, isEmpty }: ContextRowProps) {
  return (
    <div className="flex items-start gap-2" style={{ minHeight: 20 }}>
      <span
        className="flex-shrink-0"
        style={{
          fontSize: 11,
          color: 'var(--text-quaternary)',
          width: 72,
          lineHeight: '18px',
          fontWeight: 400,
        }}
      >
        {label}
      </span>
      <span
        className={cn('flex-1 min-w-0 truncate')}
        title={value ?? undefined}
        style={{
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '18px',
          color: isEmpty ? 'var(--text-quaternary)' : 'var(--text-secondary)',
          fontStyle: isEmpty ? 'italic' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isEmpty ? 'Waiting...' : value}
      </span>
    </div>
  );
}

export function OnboardingContext({ onboardingState }: OnboardingContextProps) {
  // Required fields always visible
  const requiredRows = REQUIRED_FIELDS.map((field) => {
    const filled = isFieldFilled(field, onboardingState);
    const rawValue = onboardingState?.[field];
    const value = filled ? formatFieldValue(field, rawValue) : null;
    return { field, label: CONTEXT_LABELS[field] ?? field, value, isEmpty: !filled };
  });

  // Optional fields only visible when they have values
  const optionalRows = OPTIONAL_FIELDS.flatMap((field) => {
    const filled = isFieldFilled(field, onboardingState);
    if (!filled) return [];
    const rawValue = onboardingState?.[field];
    const value = formatFieldValue(field, rawValue);
    return [{ field, label: CONTEXT_LABELS[field] ?? field, value, isEmpty: false }];
  });

  const allRows = [...requiredRows, ...optionalRows];

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {allRows.map(({ field, label, value, isEmpty }) => (
        <ContextRow
          key={field}
          label={label}
          value={value}
          isEmpty={isEmpty}
        />
      ))}
    </div>
  );
}
