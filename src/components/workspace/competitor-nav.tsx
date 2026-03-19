'use client';

import { cn } from '@/lib/utils';

interface CompetitorNavProps {
  competitors: string[];
  selected: string;
  onSelect: (name: string) => void;
}

export function CompetitorNav({ competitors, selected, onSelect }: CompetitorNavProps) {
  if (competitors.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
      {competitors.map((name) => {
        const isActive = name === selected;

        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer',
              isActive
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--accent-blue)]/30 shadow-[0_0_8px_rgba(96,165,250,0.15)]'
                : 'bg-transparent text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: isActive ? 'var(--accent-blue)' : 'var(--text-quaternary)' }}
            />
            {name}
          </button>
        );
      })}
    </div>
  );
}
