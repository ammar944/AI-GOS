'use client';

import { cn } from '@/lib/utils';

interface VerdictCardProps {
  status: string;
  reasoning?: string;
}

export function VerdictCard({ status, reasoning }: VerdictCardProps) {
  const normalized = status.toLowerCase().replaceAll('_', ' ');
  const isPositive = /validated|approved|confirmed|strong/.test(normalized);
  const isNegative = /rejected|failed|weak/.test(normalized);

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
        Final Verdict
      </h4>
      <p
        className={cn(
          'text-sm font-semibold capitalize',
          isPositive && 'text-[var(--accent-green)]',
          isNegative && 'text-[var(--accent-red)]',
          !isPositive && !isNegative && 'text-[var(--text-primary)]',
        )}
      >
        {normalized}
      </p>
      {reasoning && (
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{reasoning}</p>
      )}
    </div>
  );
}
