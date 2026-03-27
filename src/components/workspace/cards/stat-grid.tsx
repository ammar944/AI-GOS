'use client';

import { useState, useEffect } from 'react';
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
  isEditing?: boolean;
  onStatsChange?: (stats: StatItem[]) => void;
}

export function StatGrid({ stats, columns = 3, isEditing = false, onStatsChange }: StatGridProps) {
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

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {editedStats.map((stat, index) => {
        // Short values (numbers, brief text ≤25 chars) get big mono treatment.
        // Medium values (25-60 chars) get small mono. Long values = body text.
        const len = stat.value.length;
        const isShort = len <= 25;
        const isMedium = len > 25 && len <= 60;

        return (
          <div
            key={stat.label}
            className="py-0.5"
          >
            <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] block mb-0.5">
              {stat.label}
            </span>
            {isEditing ? (
              <input
                type="text"
                value={stat.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                onBlur={handleBlur}
                className={cn(
                  'w-full bg-transparent border-b border-[var(--text-tertiary)] outline-none',
                  isShort
                    ? 'text-[20px] font-semibold text-[var(--text-primary)] font-mono tabular-nums'
                    : isMedium
                      ? 'text-[13px] font-mono text-[var(--text-primary)] tabular-nums'
                      : 'text-[13px] leading-snug text-[var(--text-primary)]'
                )}
              />
            ) : (
              <span className={cn(
                isShort
                  ? 'text-[20px] font-semibold text-[var(--text-primary)] font-mono tabular-nums leading-tight'
                  : isMedium
                    ? 'text-[13px] font-mono text-[var(--text-secondary)] tabular-nums'
                    : 'text-[13px] leading-snug text-[var(--text-secondary)]'
              )}>
                {stat.value}
              </span>
            )}
            {stat.badge && (
              <span
                className="mt-0.5 block text-[10px] font-mono"
                style={{ color: stat.badgeColor ?? 'var(--accent-blue)' }}
              >
                {stat.badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
