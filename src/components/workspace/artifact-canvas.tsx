'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { CardContentSwitch } from '@/components/research/card-renderer';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
import { CardGrid } from './card-grid';
import { ArtifactCard } from './artifact-card';

// Stagger timing constants (spec Section 14)
const CARD_STAGGER = 0.05; // seconds between each card
const CARD_DURATION = 0.2; // seconds per card animation
const SECTION_PAUSE = 0.1; // seconds pause between exit and enter

export function ArtifactCanvas() {
  const { state, approveSection, setSectionPhase } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isApproved = phase === 'approved';
  const isLoading = phase === 'researching' || phase === 'streaming';
  const [isExiting, setIsExiting] = useState(false);

  const allApproved = useMemo(
    () => SECTION_PIPELINE.every((key) => state.sectionStates[key] === 'approved'),
    [state.sectionStates],
  );

  const showCards = isReviewable || isApproved || allApproved;

  const sectionCards = useMemo(() => {
    return Object.values(state.cards)
      .filter((card) => card.sectionKey === state.currentSection);
  }, [state.cards, state.currentSection]);

  const handleRetry = useCallback(() => {
    setSectionPhase(state.currentSection, 'researching');
  }, [setSectionPhase, state.currentSection]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-x-hidden">
      <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
        <AnimatePresence
          mode="wait"
          onExitComplete={() => {
            setIsExiting(true);
            setTimeout(() => setIsExiting(false), SECTION_PAUSE * 1000);
          }}
        >
          {!isExiting && (
            <motion.div
              key={state.currentSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <SectionHeader section={state.currentSection} />

              {/* Queued state — section not yet started */}
              {!allApproved && phase === 'queued' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <p className="text-sm text-[var(--text-tertiary)] font-mono">
                    Waiting for previous sections...
                  </p>
                </div>
              )}

              {/* Loading state */}
              {!allApproved && isLoading && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <p className="text-sm text-[var(--text-tertiary)] font-mono">
                    Researching...
                  </p>
                </div>
              )}

              {/* Error state with retry */}
              {!allApproved && phase === 'error' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <p className="text-sm text-[var(--accent-red)]">Research failed</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-raised)]"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Cards — shown for review, approved (navigated back), or allApproved */}
              {showCards && sectionCards.length > 0 && (
                <CardGrid>
                  {sectionCards.map((card, i) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: CARD_DURATION,
                        delay: i * CARD_STAGGER,
                      }}
                    >
                      <ArtifactCard card={card} index={i}>
                        <CardContentSwitch card={card} />
                      </ArtifactCard>
                    </motion.div>
                  ))}
                </CardGrid>
              )}

              {showCards && sectionCards.length === 0 && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <p className="text-sm text-[var(--text-tertiary)] font-mono">
                    No cards for this section yet
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Show "Looks good" only for sections in review phase, not approved or allApproved */}
      {!allApproved && isReviewable && <ArtifactFooter variant="approve" onApprove={approveSection} />}

      {/* Show completion footer when all sections approved */}
      {allApproved && <ArtifactFooter variant="complete" />}
    </div>
  );
}
