'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { RESEARCH_SECTIONS, SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { saveResearchDocument } from '@/lib/actions/journey-sessions';
import { CardContentSwitch } from '@/components/research/card-renderer';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
import { CardGrid } from './card-grid';
import { ArtifactCard } from './artifact-card';
import { ResearchActivityLog } from './research-activity-log';
import { MediaPlanCta } from './media-plan-cta';
import { PhaseTransitionCard } from './phase-transition-card';
import { OfferRefinementCard } from './cards/offer-refinement-card';
import { parseOfferScoreFromStats } from '@/lib/workspace/parse-offer-score-stats';
import { CompetitorTabs } from './competitor-tabs';
import type { CardState, SectionKey } from '@/lib/workspace/types';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';

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
  mediaPlan: 'Media Plan',
  scripts: 'Scripts',
};

interface ArtifactCanvasProps {
  jobActivity?: Record<string, ResearchJobActivity>;
  onGenerateMediaPlan?: () => void;
  mediaPlanGenerating?: boolean;
  onRetrySection?: (section: SectionKey) => void;
  onNavigateToScripts?: () => void;
  onNavigateToAssets?: () => void;
}

export function ArtifactCanvas({ jobActivity, onGenerateMediaPlan, mediaPlanGenerating, onRetrySection, onNavigateToScripts, onNavigateToAssets }: ArtifactCanvasProps) {
  const { state, approveSection } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isApproved = phase === 'approved';
  const isLoading = phase === 'researching' || phase === 'streaming';
  const [isExiting, setIsExiting] = useState(false);
  const offerPrevScoreRef = useRef<number | null>(null);

  // Extract offer score data for the refinement card
  const offerScoreData = useMemo(() => {
    if (state.currentSection !== 'offerAnalysis') return null;
    const scoreCard = Object.values(state.cards).find(
      (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Offer Score',
    );
    if (!scoreCard) return null;

    const parsed = parseOfferScoreFromStats(scoreCard.content?.stats);
    if (!parsed) return null;

    const prevScore = offerPrevScoreRef.current;
    offerPrevScoreRef.current = parsed.overall;

    const weaknessesCard = Object.values(state.cards).find(
      (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Weaknesses',
    );
    const actionsCard = Object.values(state.cards).find(
      (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Recommended Actions',
    );
    const priorityFixes = (weaknessesCard?.content?.items ?? []) as string[];
    const actionPlan = (actionsCard?.content?.items ?? []) as string[];

    return {
      overall: parsed.overall,
      dimensions: parsed.dimensions,
      prevScore,
      priorityFixes,
      actionPlan,
    };
  }, [state.currentSection, state.cards]);

  const allResearchApproved = useMemo(
    () => RESEARCH_SECTIONS.every((key) => state.sectionStates[key] === 'approved'),
    [state.sectionStates],
  );

  // All research sections are ready for media plan generation (review or approved)
  const allResearchComplete = useMemo(
    () => RESEARCH_SECTIONS.every(
      (key) => state.sectionStates[key] === 'review' || state.sectionStates[key] === 'approved',
    ),
    [state.sectionStates],
  );

  // mediaPlan is "active" once it leaves 'queued' — any subsequent phase (researching,
  // streaming, review, approved, error) means generation was triggered.
  const mediaPlanActive = state.sectionStates.mediaPlan !== 'queued';

  // mediaPlan is done — show scripts CTA
  const mediaPlanComplete = state.sectionStates.mediaPlan === 'review' || state.sectionStates.mediaPlan === 'approved';

  // scripts is "active" once it leaves 'queued'
  const scriptsActive = state.sectionStates.scripts !== 'queued';

  // Only gates research + media plan completion. Scripts phase is managed separately.
  const researchAndPlanDone = useMemo(
    () => SECTION_PIPELINE.every((key) => state.sectionStates[key] === 'approved'),
    [state.sectionStates],
  );

  const [docSaveStatus, setDocSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hasSavedRef = useRef(false);

  // Reset vertical scroll to top whenever the active section changes
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [state.currentSection]);

  // Auto-save research document when all 6 research sections are approved
  useEffect(() => {
    if (!allResearchApproved || hasSavedRef.current) return;
    hasSavedRef.current = true;

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
  }, [allResearchApproved, state.cards, state.sessionId]);

  const showCards = phase === 'streaming' || isReviewable || isApproved || allResearchApproved || researchAndPlanDone;

  const sectionCards = useMemo(() => {
    return Object.values(state.cards)
      .filter((card) => card.sectionKey === state.currentSection);
  }, [state.cards, state.currentSection]);

  const handleRetry = useCallback(() => {
    onRetrySection?.(state.currentSection);
  }, [onRetrySection, state.currentSection]);


  // Determine if we're viewing a non-mediaPlan section that's already approved
  // (browsing completed research while media plan generates)
  const isBrowsingApproved = allResearchApproved && isApproved && state.currentSection !== 'mediaPlan';

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-x-hidden">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
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
              {phase === 'queued' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--bg-hover)]"
                          animate={{ opacity: [0.2, 0.5, 0.2] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-[var(--text-quaternary)] font-mono">
                      Waiting for previous sections
                    </p>
                  </div>
                </div>
              )}

              {/* Loading state — activity log (real worker updates when available) */}
              {isLoading && (
                <ResearchActivityLog
                  section={state.currentSection}
                  sectionLabel={SECTION_LABELS[state.currentSection] ?? state.currentSection}
                  phase={phase as 'researching' | 'streaming'}
                  activity={jobActivity?.[state.currentSection]}
                />
              )}

              {/* Error state with retry */}
              {phase === 'error' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-400">Research failed</p>
                      <p className="mt-1 text-xs text-[var(--text-quaternary)]">
                        {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="cursor-pointer rounded-full bg-foreground text-background text-[13px] font-semibold px-5 h-9 transition-all hover:bg-foreground/90"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Offer refinement card — score breakdown at TOP, before other cards */}
              {state.currentSection === 'offerAnalysis' &&
                (isReviewable || isApproved) &&
                offerScoreData && (
                  <div className="mb-4">
                    <OfferRefinementCard
                      overallScore={offerScoreData.overall}
                      dimensions={offerScoreData.dimensions}
                      priorityFixes={offerScoreData.priorityFixes}
                      actionPlan={offerScoreData.actionPlan}
                      prevScore={offerScoreData.prevScore}
                    />
                  </div>
                )}

              {/* Media plan CTA — shown when all 6 research sections complete and media plan not yet started */}
              {allResearchComplete && !mediaPlanActive && state.currentSection !== 'mediaPlan' && onGenerateMediaPlan && (
                <MediaPlanCta
                  sectionStates={state.sectionStates}
                  onGenerateMediaPlan={onGenerateMediaPlan}
                  mediaPlanGenerating={mediaPlanGenerating}
                />
              )}

              {/* Scripts CTA — shown on any tab when media plan is complete and scripts not yet started */}
              {mediaPlanComplete && !scriptsActive && state.currentSection !== 'scripts' && (
                <div className={cn(
                  'rounded-[6px] border border-[var(--border-default)]',
                  'border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5',
                )}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-mono mb-1">Next Phase</div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Enhance & generate your ad scripts</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">Add reference ads, proof points, and voice guidelines — or skip straight to generation.</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      {onNavigateToAssets && (
                        <button
                          onClick={onNavigateToAssets}
                          className="cursor-pointer px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green)]/90 transition-colors"
                        >
                          Add Assets
                        </button>
                      )}
                      {onNavigateToScripts && (
                        <button
                          onClick={onNavigateToScripts}
                          className="px-4 py-2 rounded-md text-sm text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          Skip to Scripts
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cards — shown for review, approved, or browsing */}
              {showCards && sectionCards.length > 0 && state.currentSection === 'competitors' && (
                <CompetitorTabs cards={sectionCards} mode="workspace" />
              )}
              {showCards && sectionCards.length > 0 && state.currentSection !== 'competitors' && (
                <CardGrid>
                  {sectionCards
                    // Filter out the stat-grid "Offer Score" card when refinement card is showing (avoids duplicate)
                    .filter(
                      (card) =>
                        !(
                          state.currentSection === 'offerAnalysis' &&
                          (isReviewable || isApproved) &&
                          offerScoreData &&
                          card.label === 'Offer Score' &&
                          card.cardType === 'stat-grid'
                        ),
                    )
                    .map((card, i) => (
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
              {showCards && sectionCards.length === 0 && !isLoading && phase !== 'queued' && phase !== 'error' && (
                <div className="flex flex-1 items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[var(--text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <p className="text-sm text-[var(--text-quaternary)]">
                      No data received for this section
                    </p>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Approve footer for research sections in review phase */}
      {isReviewable && sectionCards.length > 0 && !isBrowsingApproved && state.currentSection !== 'mediaPlan' && state.currentSection !== 'crossAnalysis' && (
        <ArtifactFooter variant="approve" onApprove={approveSection} approveLabel="Approve & Continue →" />
      )}

      {/* Show completion footer when all 6 research sections approved (media plan not yet generated).
          The generate button is intentionally omitted here — the in-canvas MediaPlanCta card handles it. */}
      {allResearchApproved && !mediaPlanActive && !researchAndPlanDone && (
        <ArtifactFooter
          variant="complete"
          docSaveStatus={docSaveStatus}
          sessionId={state.sessionId}
        />
      )}

      {/* Media plan in review — show save & finish only if not already all done */}
      {state.currentSection === 'mediaPlan' && isReviewable && sectionCards.length > 0 && !researchAndPlanDone && (
        <ArtifactFooter variant="approve" onApprove={approveSection} approveLabel="Save & Finish →" />
      )}

      {/* Research + media plan approved — completion footer (scripts phase is separate) */}
      {researchAndPlanDone && (
        <ArtifactFooter
          variant="complete"
          docSaveStatus={docSaveStatus}
          sessionId={state.sessionId}
        />
      )}
    </div>
  );
}
