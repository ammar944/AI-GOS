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
    <div className="border-l-2 py-3 pl-4 pr-2" style={{ borderColor: isPositive ? 'var(--accent-green)' : isNegative ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
      <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1">
        Final Verdict
      </h4>
      <p
        className={cn(
          'text-[14px] leading-[1.55] font-semibold capitalize',
          isPositive && 'text-[var(--accent-green)]',
          isNegative && 'text-[var(--accent-red)]',
          !isPositive && !isNegative && 'text-[var(--text-primary)]',
        )}
      >
        {normalized}
      </p>
      {reasoning && (
        <p className="mt-1.5 text-[13px] leading-snug text-[var(--text-secondary)]">{reasoning}</p>
      )}
    </div>
  );
}
