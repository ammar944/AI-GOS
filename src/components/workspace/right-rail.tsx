'use client';

import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';

export function RightRail() {
  const { state, approveSection } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const isReviewable = state.sectionStates[state.currentSection] === 'review';

  return (
    <div className="flex w-[40%] flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-chat)]">
      {/* Rail header */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          Chat &middot; {meta.label}
        </span>
      </div>

      {/* Chat thread placeholder */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <p className="text-xs text-[var(--text-quaternary)]">
          Ask questions about this section...
        </p>
      </div>

      {/* Looks good + input */}
      <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
        {isReviewable && (
          <button
            type="button"
            onClick={approveSection}
            className={cn(
              'w-full rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-4 py-2',
              'text-sm font-medium text-white',
              'transition-colors hover:bg-[var(--accent-blue)]/90',
            )}
          >
            Looks good &rarr;
          </button>
        )}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
          <span className="text-xs text-[var(--text-quaternary)]">
            Ask about this section...
          </span>
        </div>
      </div>
    </div>
  );
}
