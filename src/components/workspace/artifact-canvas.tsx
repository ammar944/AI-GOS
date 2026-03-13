'use client';

import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';

export function ArtifactCanvas() {
  const { state, approveSection } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isLoading = phase === 'researching' || phase === 'streaming';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
        <SectionHeader section={state.currentSection} />

        {isLoading && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              Researching...
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-sm text-[var(--accent-red)]">Research failed</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {isReviewable && (
          <div className="text-sm text-[var(--text-tertiary)]">
            {/* CardGrid will be rendered here in Sprint 2 */}
            <p>Cards will render here</p>
          </div>
        )}
      </div>

      {isReviewable && <ArtifactFooter onApprove={approveSection} />}
    </div>
  );
}
