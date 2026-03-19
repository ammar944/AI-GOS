'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
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

        // Active researching tab gets a Framer Motion glow pulse
        const showResearchGlow = mode === 'workspace' && isActive && isResearching;

        return (
          <motion.button
            key={section}
            type="button"
            onClick={() => !isQueued && onNavigate(section)}
            disabled={isQueued}
            animate={showResearchGlow ? { boxShadow: ['0 0 8px rgba(96,165,250,0.15)', '0 0 20px rgba(96,165,250,0.45)', '0 0 8px rgba(96,165,250,0.15)'] } : {}}
            transition={showResearchGlow ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
              // Document mode: simple active/inactive
              mode === 'document' && isActive && 'border-transparent bg-transparent text-[var(--accent-blue)] font-semibold relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/4 after:h-0.5 after:bg-[var(--accent-blue)] after:rounded-full',
              mode === 'document' && !isActive && 'border-transparent bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer',
              // Workspace mode states
              mode === 'workspace' && isActive && isApproved && 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
              mode === 'workspace' && isActive && isReview && 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] shadow-[0_0_12px_rgba(96,165,250,0.1)]',
              mode === 'workspace' && isActive && isResearching && 'border-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
              mode === 'workspace' && isActive && isError && 'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
              mode === 'workspace' && !isActive && isApproved && 'border-[var(--accent-green)]/20 bg-[var(--accent-green)]/8 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && (isReview || isResearching) && 'border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/8 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/12 cursor-pointer',
              mode === 'workspace' && !isActive && isError && 'border-[var(--accent-red)]/20 bg-[var(--accent-red)]/8 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/12 cursor-pointer',
              mode === 'workspace' && isQueued && 'border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)] cursor-not-allowed opacity-70',
            )}
          >
            {/* Status indicator */}
            {mode === 'workspace' && isApproved && (
              <span className="text-[10px]">&#10003;</span>
            )}
            {mode === 'workspace' && (isResearching || (isReview && isActive)) && (
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-current shrink-0"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {mode === 'workspace' && isError && (
              <span className="text-[10px]">!</span>
            )}
            {mode === 'workspace' && isQueued && (
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50 shrink-0" />
            )}

            <span className={cn(isActive && 'font-semibold')}>{meta.label}</span>
          </motion.button>
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
