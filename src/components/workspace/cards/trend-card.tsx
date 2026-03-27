'use client';

import { cn } from '@/lib/utils';

interface TrendCardProps {
  trend: string;
  direction: string;
  evidence: string;
}

export function TrendCard({ trend, direction, evidence }: TrendCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
            direction === 'rising' && 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
            direction === 'declining' && 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
            direction === 'stable' && 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]',
          )}
        >
          {direction}
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">{trend}</span>
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">{evidence}</p>
    </div>
  );
}
