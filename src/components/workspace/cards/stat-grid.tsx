'use client';

import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}

interface StatGridProps {
  stats: StatItem[];
  columns?: 2 | 3;
}

export function StatGrid({ stats, columns = 3 }: StatGridProps) {
  return (
    <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="glass-surface rounded-[var(--radius-md)] p-3"
        >
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">
            {stat.label}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
            {stat.value}
          </span>
          {stat.badge && (
            <span
              className="mt-1 block text-[10px] font-mono"
              style={{ color: stat.badgeColor ?? 'var(--accent-blue)' }}
            >
              {stat.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
