'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_PIPELINE, getSectionIndex } from '@/lib/workspace/pipeline';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { springs } from '@/lib/motion';

export function StatusStrip() {
  const { state } = useWorkspace();
  const currentIndex = getSectionIndex(state.currentSection);
  const approvedCount = SECTION_PIPELINE.filter(
    (key) => state.sectionStates[key] === 'approved',
  ).length;
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const isActive = state.sectionStates[state.currentSection] === 'researching'
    || state.sectionStates[state.currentSection] === 'streaming';

  return (
    <div className="flex h-11 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4">
      {/* Section indicator */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            isActive && 'animate-pulse',
          )}
          style={{
            backgroundColor: isActive
              ? 'var(--accent-blue)'
              : state.sectionStates[state.currentSection] === 'review'
                ? 'var(--accent-green)'
                : 'var(--text-tertiary)',
          }}
        />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {meta.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 mx-4">
        <div className="h-1 rounded-full bg-[var(--bg-hover)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--brand-sky)]"
            initial={false}
            animate={{ width: `${((approvedCount + (state.sectionStates[state.currentSection] === 'review' ? 0.5 : 0)) / SECTION_PIPELINE.length) * 100}%` }}
            transition={springs.snappy}
          />
        </div>
      </div>

      {/* Section count */}
      <span className="text-xs font-mono text-[var(--text-tertiary)]">
        {currentIndex + 1} of {SECTION_PIPELINE.length}
      </span>

      {/* Worker status */}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
          isActive
            ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
            : 'bg-white/5 text-[var(--text-tertiary)]',
        )}
      >
        {isActive ? 'Working' : 'Idle'}
      </span>
    </div>
  );
}
