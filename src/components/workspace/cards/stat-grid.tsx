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
  const [editedStats, setEditedStats] = useState<StatItem[]>(stats);

  useEffect(() => {
    setEditedStats(stats);
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
    <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
      {editedStats.map((stat, index) => (
        <div
          key={stat.label}
          className="glass-surface rounded-[var(--radius-md)] p-3"
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
              className="text-sm font-medium text-[var(--text-primary)] capitalize w-full bg-transparent border-b border-[var(--text-tertiary)] outline-none"
            />
          ) : (
            <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
              {stat.value}
            </span>
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
