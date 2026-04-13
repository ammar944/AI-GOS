'use client';

import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

interface SectionTabsProps {
  sections: SectionKey[];
  currentSection: SectionKey;
  sectionStates?: Record<SectionKey, SectionPhase>;
  onNavigate: (section: SectionKey) => void;
  mode: 'workspace' | 'document';
}

export function SectionTabs({ sections, currentSection, sectionStates, onNavigate, mode }: SectionTabsProps) {
  const approvedCount = useMemo(() => {
    if (!sectionStates) return sections.length;
    return sections.filter((key) => sectionStates[key] === 'approved').length;
  }, [sections, sectionStates]);

  const tabBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tabBarRef.current) {
      tabBarRef.current.scrollLeft = 0;
    }
  }, [currentSection]);

  return (
    <div
      ref={tabBarRef}
      className="flex h-10 items-end gap-0 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 overflow-x-auto"
    >
      {sections.map((section) => {
        const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
        const phase = sectionStates?.[section];
        const isActive = section === currentSection;
        const isQueued = mode === 'workspace' && phase === 'queued';
        const isApproved = phase === 'approved';
        const isResearching = phase === 'researching' || phase === 'streaming';
        const isError = phase === 'error';

        // Text color by state — no backgrounds, underline only
        const textColor = (() => {
          if (isQueued) return 'text-[var(--text-quaternary)]';
          if (isActive) return 'text-[var(--text-primary)]';
          if (isApproved) return 'text-[var(--accent-green)]';
          if (isError) return 'text-[var(--accent-red)]';
          if (isResearching) return 'text-[var(--accent-blue)]';
          return 'text-[var(--text-quaternary)]';
        })();

        // Bottom border for active tab
        const borderColor = (() => {
          if (!isActive) return 'border-transparent';
          if (isApproved) return 'border-[var(--accent-green)]';
          if (isError) return 'border-[var(--accent-red)]';
          if (isResearching) return 'border-[var(--accent-blue)]';
          return 'border-[var(--accent-blue)]';
        })();

        return (
          <button
            key={section}
            type="button"
            onClick={() => !isQueued && onNavigate(section)}
            disabled={isQueued}
            className={cn(
              'group flex items-center gap-1.5 px-3 pb-2.5 pt-2',
              'text-[12px] font-mono font-medium whitespace-nowrap',
              'border-b-[1.5px] shrink-0',
              'transition-colors duration-150',
              textColor,
              borderColor,
              isQueued && 'cursor-not-allowed opacity-50',
              !isQueued && !isActive && 'cursor-pointer hover:text-[var(--text-secondary)]',
            )}
          >
            {/* Status indicator — subtle inline markers */}
            {mode === 'workspace' && isApproved && (
              <span className="text-[10px] leading-none">&#10003;</span>
            )}
            {mode === 'workspace' && isResearching && (
              <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0 animate-pulse" />
            )}
            {mode === 'workspace' && isError && (
              <span className="text-[10px] leading-none">!</span>
            )}

            <span>{meta.label}</span>
          </button>
        );
      })}

      {/* Progress counter */}
      {mode === 'workspace' && (
        <span className="ml-auto pb-2.5 text-[11px] font-mono text-[var(--text-quaternary)] shrink-0 tabular-nums">
          {approvedCount}/{sections.length}
        </span>
      )}
    </div>
  );
}
