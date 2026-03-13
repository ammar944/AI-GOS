'use client';

import { useMemo } from 'react';
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
    if (!sectionStates) return sections.length; // document mode: all complete
    return sections.filter((key) => sectionStates[key] === 'approved').length;
  }, [sections, sectionStates]);

  return (
    <div className="flex h-11 items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 overflow-x-auto">
      {sections.map((section) => {
        const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
        const phase = sectionStates?.[section];
        const isActive = section === currentSection;
        const isQueued = mode === 'workspace' && phase === 'queued';
        const isApproved = phase === 'approved';
        const isResearching = phase === 'researching' || phase === 'streaming';
        const isReview = phase === 'review';
        const isError = phase === 'error';

        return (
          <button
            key={section}
            type="button"
            onClick={() => !isQueued && onNavigate(section)}
            disabled={isQueued}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
              // Document mode: simple active/inactive
              mode === 'document' && isActive && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
              mode === 'document' && !isActive && 'border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)] cursor-pointer',
              // Workspace mode states
              mode === 'workspace' && isActive && isApproved && 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
              mode === 'workspace' && isActive && isReview && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shadow-[0_0_12px_rgba(96,165,250,0.1)]',
              mode === 'workspace' && isActive && isResearching && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shadow-[0_0_12px_rgba(96,165,250,0.1)]',
              mode === 'workspace' && isActive && isError && 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
              mode === 'workspace' && !isActive && isApproved && 'border-[var(--accent-green)]/20 bg-[var(--accent-green)]/8 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && (isReview || isResearching) && 'border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/8 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && isError && 'border-[var(--accent-red)]/20 bg-[var(--accent-red)]/8 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/12 cursor-pointer',
              mode === 'workspace' && isQueued && 'border-[var(--border-subtle)] bg-transparent text-[var(--text-quaternary)] cursor-not-allowed',
            )}
          >
            {/* Status indicator */}
            {mode === 'workspace' && isApproved && (
              <span className="text-[10px]">&#10003;</span>
            )}
            {mode === 'workspace' && (isResearching || (isReview && isActive)) && (
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {mode === 'workspace' && isError && (
              <span className="text-[10px]">!</span>
            )}
            {mode === 'workspace' && isQueued && (
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
            )}

            <span className={cn(isActive && 'font-semibold')}>{meta.label}</span>
          </button>
        );
      })}

      {/* Progress counter */}
      {mode === 'workspace' && (
        <span className="ml-auto text-xs font-mono text-[var(--text-tertiary)] shrink-0">
          {approvedCount} / {sections.length}
        </span>
      )}
    </div>
  );
}
