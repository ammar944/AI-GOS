'use client';

import { cn } from '@/lib/utils';

export type AwarenessLevel = 'all' | 'unaware' | 'problem' | 'solution' | 'product' | 'mostAware';

const LEVELS: { id: AwarenessLevel; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unaware', label: 'Unaware' },
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'product', label: 'Product' },
  { id: 'mostAware', label: 'Most Aware' },
];

interface AwarenessTabsProps {
  active: AwarenessLevel;
  counts: Partial<Record<AwarenessLevel, number>>;
  total: number;
  onChange: (level: AwarenessLevel) => void;
}

export function AwarenessTabs({ active, counts, total, onChange }: AwarenessTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEVELS.map((level) => {
        const count = level.id === 'all' ? total : (counts[level.id] ?? 0);
        const isActive = active === level.id;
        return (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors duration-100',
              isActive
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-default)]'
                : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
          >
            {level.label}
            <span
              className={cn(
                'text-[10px] font-mono tabular-nums',
                isActive ? 'text-white/80' : 'text-[var(--text-quaternary)]',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
