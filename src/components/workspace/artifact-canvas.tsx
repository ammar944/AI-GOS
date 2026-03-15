'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import { saveResearchDocument } from '@/lib/actions/journey-sessions';
import { CardContentSwitch } from '@/components/research/card-renderer';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
import { CardGrid } from './card-grid';
import { ArtifactCard } from './artifact-card';
import { ResearchActivityLog } from './research-activity-log';
import type { CardState, SectionKey } from '@/lib/workspace/types';

// Stagger timing constants (spec Section 14)
const CARD_STAGGER = 0.05; // seconds between each card
const CARD_DURATION = 0.2; // seconds per card animation
const SECTION_PAUSE = 0.1; // seconds pause between exit and enter

const SECTION_LABELS: Record<string, string> = {
  industryMarket: 'Market Overview',
  competitors: 'Competitor Intel',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  keywordIntel: 'Keywords',
  crossAnalysis: 'Strategic Synthesis',
};

export function ArtifactCanvas() {
  const { state, approveSection, setSectionPhase } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isApproved = phase === 'approved';
  const isLoading = phase === 'researching' || phase === 'streaming';
  const [isExiting, setIsExiting] = useState(false);

  const allApproved = useMemo(
    () => RESEARCH_SECTIONS.every((key) => state.sectionStates[key] === 'approved'),
    [state.sectionStates],
  );

  const [docSaveStatus, setDocSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hasSavedRef = useRef(false);

  // Auto-save research document when all sections are approved
  useEffect(() => {
    if (!allApproved || hasSavedRef.current) return;
    hasSavedRef.current = true;

    // Group cards by section
    const cardsBySection: Record<string, CardState[]> = {};
    for (const key of RESEARCH_SECTIONS) {
      cardsBySection[key] = Object.values(state.cards).filter(
        (card) => card.sectionKey === key,
      );
    }

    setDocSaveStatus('saving');
    saveResearchDocument(state.sessionId, cardsBySection).then((result) => {
      setDocSaveStatus(result.success ? 'saved' : 'error');
    });
  }, [allApproved, state.cards, state.sessionId]);

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
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-white/20"
                          animate={{ opacity: [0.2, 0.5, 0.2] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white/25 font-mono">
                      Waiting for previous sections
                    </p>
                  </div>
                </div>
              )}

              {/* Loading state — activity log */}
              {!allApproved && isLoading && (
                <ResearchActivityLog
                  section={state.currentSection}
                  sectionLabel={SECTION_LABELS[state.currentSection] ?? state.currentSection}
                  phase={phase as 'researching' | 'streaming'}
                />
              )}

              {/* Error state with retry */}
              {!allApproved && phase === 'error' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-400">Research failed</p>
                      <p className="mt-1 text-xs text-white/30">
                        {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="cursor-pointer rounded-full bg-white text-black text-[13px] font-semibold px-5 h-9 transition-all hover:bg-white/90"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Cards — shown for review, approved, or allApproved */}
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

              {/* Empty state — no cards but should have them */}
              {showCards && sectionCards.length === 0 && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="text-sm text-white/30">
                      No data received for this section
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Show "Looks good" only for sections in review phase with actual cards */}
      {!allApproved && isReviewable && sectionCards.length > 0 && <ArtifactFooter variant="approve" onApprove={approveSection} />}

      {/* Show completion footer when all sections approved */}
      {allApproved && (
        <ArtifactFooter
          variant="complete"
          docSaveStatus={docSaveStatus}
          sessionId={state.sessionId}
        />
      )}
    </div>
  );
}
