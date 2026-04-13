'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}

type StatGridLayout = 'grid' | 'definition';

interface StatGridProps {
  stats: StatItem[];
  columns?: 2 | 3;
  /** definition = stacked label/value rows (no stretched grid cells); better for category snapshots */
  layout?: StatGridLayout;
  isEditing?: boolean;
  onStatsChange?: (stats: StatItem[]) => void;
}

export function StatGrid({
  stats,
  columns = 3,
  layout = 'grid',
  isEditing = false,
  onStatsChange,
}: StatGridProps) {
  // Defensive: ensure stats is always an array of { label, value } objects.
  // AI edits can accidentally replace the array with a string or malformed data.
  const safeStats = Array.isArray(stats)
    ? stats.filter((s): s is StatItem =>
        typeof s === 'object' && s !== null && typeof s.label === 'string' && typeof s.value === 'string'
      )
    : [];

  const [editedStats, setEditedStats] = useState<StatItem[]>(safeStats);

  useEffect(() => {
    setEditedStats(safeStats);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  function handleValueChange(index: number, value: string) {
    setEditedStats((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, value } : s));
      return next;
    });
  }

  function handleBlur() {
    onStatsChange?.(editedStats);
  }

  const valueClass = (value: string) =>
    cn(
      'text-sm font-medium text-[var(--text-primary)] w-full min-w-0',
      value.length > 72 && 'max-w-prose text-balance',
    );

  if (layout === 'definition') {
    return (
      <dl className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--bg-hover)]/30">
        {editedStats.map((stat, index) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-start sm:gap-6 first:pt-3 last:pb-3"
          >
            <dt className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider shrink-0 sm:w-36 pt-0.5">
              {stat.label}
            </dt>
            <dd className="min-w-0 flex-1 space-y-1">
              {isEditing ? (
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  onBlur={handleBlur}
                  className={cn(valueClass(stat.value), 'bg-transparent border-b border-[var(--text-tertiary)] outline-none')}
                />
              ) : (
                <span className={valueClass(stat.value)}>{stat.value}</span>
              )}
              {stat.badge && (
                <span
                  className="block text-[10px] font-mono"
                  style={{ color: stat.badgeColor ?? 'var(--accent-blue)' }}
                >
                  {stat.badge}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-3 items-start',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
      )}
    >
      {editedStats.map((stat, index) => (
        <div
          key={stat.label}
          className="glass-surface rounded-[var(--radius-md)] p-3 self-start h-auto min-h-0"
        >
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">
            {stat.label}
          </span>
          {isEditing ? (
            <input
              type="text"
              value={stat.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              onBlur={handleBlur}
              className={cn(valueClass(stat.value), 'bg-transparent border-b border-[var(--text-tertiary)] outline-none')}
            />
          ) : (
            <span className={valueClass(stat.value)}>{stat.value}</span>
          )}
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
