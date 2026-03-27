'use client';

import { cn } from '@/lib/utils';
import { InlineText } from './inline-text';

interface TrendCardProps {
  trend: string;
  direction: string;
  evidence: string;
}

export function TrendCard({ trend, direction, evidence }: TrendCardProps) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span
        className={cn(
          'mt-0.5 shrink-0 text-[10px] font-mono font-medium uppercase px-1.5 py-0.5 rounded-full',
          direction === 'rising' && 'text-[var(--accent-green)]',
          direction === 'declining' && 'text-[var(--accent-red)]',
          direction === 'stable' && 'text-[var(--text-tertiary)]',
        )}
        style={{
          background: direction === 'rising' ? 'rgba(34,197,94,0.1)'
            : direction === 'declining' ? 'rgba(239,68,68,0.1)'
            : 'var(--bg-hover)',
        }}
      >
        {direction}
      </span>
      <div className="min-w-0">
        <span className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{trend}</span>
        <p className="mt-0.5 text-[11px] font-mono text-[var(--text-tertiary)] leading-relaxed">
          <InlineText text={evidence} />
        </p>
      </div>
    </div>
  );
}
