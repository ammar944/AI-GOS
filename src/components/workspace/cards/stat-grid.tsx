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

  const isShortValue = (value: string) =>
    value.length <= 40 && !value.includes('\n');

  const valueClass = (value: string) =>
    cn(
      'text-[var(--text-primary)] w-full min-w-0',
      isShortValue(value)
        ? 'text-[28px] italic font-normal leading-[1.05] tracking-tight'
        : 'text-sm font-medium',
      value.length > 72 && 'max-w-prose text-balance',
    );

  const valueStyle = (value: string): React.CSSProperties | undefined =>
    isShortValue(value)
      ? { fontFamily: 'var(--font-instrument-sans)' }
      : undefined;

  // Auto-detect: if any value is long prose (>100 chars), switch to definition layout
  const effectiveLayout =
    layout === 'definition' || safeStats.some((s) => s.value.length > 100)
      ? 'definition'
      : layout;

  if (effectiveLayout === 'definition') {
    return (
      <dl className="space-y-0">
        {editedStats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              'flex flex-col gap-1 px-0 py-2.5 sm:flex-row sm:items-baseline sm:gap-6',
              index < editedStats.length - 1 && 'border-b border-[var(--border-subtle)]',
            )}
          >
            <dt className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] shrink-0 sm:w-32">
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
                <span className={valueClass(stat.value)} style={valueStyle(stat.value)}>
                  {stat.value}
                </span>
              )}
              {stat.badge && (
                <span
                  className="block text-[10px] font-mono tabular-nums uppercase tracking-[0.1em]"
                  style={{ color: stat.badgeColor ?? 'var(--text-secondary)' }}
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
          className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 self-start h-auto min-h-0"
        >
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.12em] block mb-1.5">
            {stat.label}
          </span>
          {isEditing ? (
            <input
              type="text"
              value={stat.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              onBlur={handleBlur}
              className={cn(valueClass(stat.value), 'bg-transparent border-b border-[var(--text-tertiary)] outline-none')}
              style={valueStyle(stat.value)}
            />
          ) : (
            <span
              className={cn(valueClass(stat.value), 'tabular-nums')}
              style={valueStyle(stat.value)}
            >
              {stat.value}
            </span>
          )}
          {stat.badge && (
            <span
              className="mt-1 block text-[10px] font-mono tabular-nums uppercase tracking-[0.1em]"
              style={{ color: stat.badgeColor ?? 'var(--text-secondary)' }}
            >
              {stat.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
