'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Check, Loader2, Link2, ArrowLeft } from 'lucide-react';
import { SectionTabs } from './section-tabs';
import { ArtifactCanvas } from './artifact-canvas';
import { UnifiedChat } from '@/components/chat/unified-chat';
import type { CardContext } from '@/components/chat/unified-chat';
import { BottomSheet } from './bottom-sheet';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import { dispatchResearchSection } from '@/lib/journey/dispatch-client';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import { getJourneySession } from '@/lib/storage/local-storage';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import { useSessionShare } from '@/hooks/use-session-share';
import type { SectionKey } from '@/lib/workspace/types';
import { SECTION_PIPELINE, WORKSPACE_SECTIONS } from '@/lib/workspace/pipeline';
import { ScriptsPhaseContent } from './scripts-phase';
import { AssetCollectionPhase } from './asset-collection-phase';
import { buildWorkspaceHydrationPlan } from './workspace-hydration';

interface WorkspacePageProps {
  userId?: string | null;
  activeRunId?: string | null;
  onSectionApproved?: (section: SectionKey) => void;
  companyName?: string | null;
  onBack?: () => void;
}

function WorkspaceResearchBridge({ userId, activeRunId }: WorkspacePageProps) {
  const { setSectionPhase, setCards, updateCard } = useWorkspace();
  const renderedMediaPlanBlocksRef = useRef<Set<string>>(new Set());

  // One-time fetch of persisted data from Supabase (cold-start / cross-device recovery).
  // 1. Hydrates section states — if Supabase has complete results but localStorage is stale,
  //    update workspace state so CTAs (media plan, scripts) appear correctly.
  // 2. Applies persisted card edits stored under research_results[section].__cardEdits.
  const appliedEditsRef = useRef(false);
  useEffect(() => {
    if (!activeRunId || appliedEditsRef.current) return;
    appliedEditsRef.current = true;

    fetch(`/api/journey/session?runId=${activeRunId}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const hydrationPlan = buildWorkspaceHydrationPlan(json);
        for (const sectionPlan of hydrationPlan.sections) {
          if (sectionPlan.cards.length > 0) {
            setCards(sectionPlan.section, sectionPlan.cards);
          }
          setSectionPhase(
            sectionPlan.section,
            sectionPlan.phase,
            sectionPlan.error,
          );
        }

        // Apply persisted card edits
        for (const edit of hydrationPlan.cardEdits) {
          updateCard(edit.cardId, edit.content, 'ai');
        }
      })
      .catch((error: unknown) => {
        console.warn('[journey] Failed to hydrate workspace from session snapshot:', {
          activeRunId,
          error,
        });
      });
  }, [activeRunId, updateCard, setCards, setSectionPhase]);

  const onSectionComplete = useCallback(
    (section: string, result: ResearchSectionResult) => {
      if (!SECTION_PIPELINE.includes(section as SectionKey)) return;
      const key = section as SectionKey;

      if (result.status === 'error') {
        setSectionPhase(key, 'error', result.error ?? 'Unknown error');
        return;
      }

      if (result.status !== 'complete' && result.status !== 'partial') return;

      const data = (result.data ?? {}) as Record<string, unknown>;

      if (key === 'mediaPlan' && Array.isArray(data.completedBlocks)) {
        const completedBlocks = data.completedBlocks as string[];
        const rendered = renderedMediaPlanBlocksRef.current;
        const newBlocks = completedBlocks.filter((b) => !rendered.has(b));

        if (newBlocks.length > 0) {
          const newBlockData: Record<string, unknown> = {};
          for (const block of newBlocks) {
            if (data[block]) newBlockData[block] = data[block];
            rendered.add(block);
          }
          if (result.status === 'complete' && data.validationWarnings) {
            newBlockData.validationWarnings = data.validationWarnings;
          }

          const newCards = parseResearchToCards(key, newBlockData);
          setCards(key, newCards);
        }

        setSectionPhase(key, result.status === 'complete' ? 'review' : 'streaming');
        return;
      }

      const cards = parseResearchToCards(key, data);
      if (cards.length === 0) {
        const errorMsg = result.status === 'partial'
          ? (result.error as string | undefined) ?? 'Research returned incomplete data — try again'
          : 'No data returned for this section';
        setSectionPhase(key, 'error', errorMsg);
        return;
      }
      setCards(key, cards);
      setSectionPhase(key, 'review');
    },
    [setSectionPhase, setCards],
  );

  useResearchRealtime({
    userId,
    activeRunId,
    onSectionComplete,
    skipRunIdCheck: true,
  });

  return null;
}

function WorkspaceApprovalBridge({ onSectionApproved }: { onSectionApproved?: (section: SectionKey) => void }) {
  const { state } = useWorkspace();
  const prevStatesRef = useRef(state.sectionStates);

  useEffect(() => {
    if (!onSectionApproved) return;
    const prev = prevStatesRef.current;
    for (const key of SECTION_PIPELINE) {
      if (prev[key] !== 'approved' && state.sectionStates[key] === 'approved') {
        onSectionApproved(key);
      }
    }
    prevStatesRef.current = state.sectionStates;
  }, [state.sectionStates, onSectionApproved]);

  return null;
}

function ShareButton() {
  const { state } = useWorkspace();
  const { isSharing, shareUrl, copied, error, handleShare, handleCopyLink } = useSessionShare();

  // Only show when crossAnalysis is complete (review or approved)
  const crossAnalysisPhase = state.sectionStates.crossAnalysis;
  const isShareable = crossAnalysisPhase === 'review' || crossAnalysisPhase === 'approved';

  if (!isShareable) return null;

  if (shareUrl) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => handleShare(state.sessionId)}
      disabled={isSharing}
      title={error ?? 'Share this session'}
      className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] disabled:opacity-50"
    >
      {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
      Share
    </button>
  );
}

function WorkspaceNavBar({
  companyName,
  onBack,
  userId,
  activeRunId,
}: {
  companyName?: string | null;
  onBack?: () => void;
  userId?: string | null;
  activeRunId?: string | null;
}) {
  const { state, navigateToSection } = useWorkspace();

  // Show all 8 sections so users see the full pipeline upfront.
  // Queued sections render dimmed but visible in the tab bar.
  const visibleSections = WORKSPACE_SECTIONS;
  const showCompanyName = companyName && companyName !== 'this company';

  return (
    <div className="flex items-center">
      <div className="flex-1 min-w-0">
        <SectionTabs
          sections={visibleSections}
          currentSection={state.currentSection}
          sectionStates={state.sectionStates}
          onNavigate={navigateToSection}
          mode="workspace"
          userId={userId}
          activeRunId={activeRunId}
        />
      </div>
      <div className="flex shrink-0 items-center gap-3 pr-4">
        {showCompanyName && (
          <p className="hidden text-xs text-[var(--text-tertiary)] sm:block truncate max-w-[200px]">
            {companyName}
          </p>
        )}
        <ShareButton />
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-quaternary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            title="Start a new journey"
          >
            <ArrowLeft size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

const CHAT_MIN_W = 320;
const CHAT_MAX_W = 640;
const CHAT_DEFAULT_W = 400;

export function WorkspacePage({ userId, activeRunId, onSectionApproved, companyName, onBack }: WorkspacePageProps) {
  const { state, setSectionPhase, navigateToSection } = useWorkspace();
  const [mediaPlanGenerating, setMediaPlanGenerating] = useState(false);
  const [scriptsGenerating, setScriptsGenerating] = useState(false);
  const [autoGenerateScripts, setAutoGenerateScripts] = useState(false);
  const [showAssetCollection, setShowAssetCollection] = useState(false);

  // Resizable chat panel
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_W);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(CHAT_DEFAULT_W);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - ev.clientX; // dragging left = wider
      const next = Math.min(CHAT_MAX_W, Math.max(CHAT_MIN_W, startWidthRef.current + delta));
      setChatWidth(next);
    };

    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [chatWidth]);

  // Hide chat rail when any section is actively generating
  const hasActiveResearch = useMemo(() => {
    return SECTION_PIPELINE.some(
      (key) => state.sectionStates[key] === 'researching' || state.sectionStates[key] === 'streaming',
    );
  }, [state.sectionStates]);

  const jobActivity = useResearchJobActivity({
    userId,
    activeRunId,
  });

  // Build context from localStorage or Supabase metadata
  const buildSectionContext = useCallback(async (fallbackLabel: string): Promise<string> => {
    const session = getJourneySession();
    const contextLines: string[] = [];
    if (session) {
      for (const [key, value] of Object.entries(session)) {
        if (typeof value === 'string' && value.trim()) {
          contextLines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
        }
      }
    }

    if (contextLines.length === 0 && activeRunId) {
      try {
        const res = await fetch(`/api/journey/session?runId=${activeRunId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          const metadata = data?.metadata as Record<string, unknown> | null;
          if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
              if (
                typeof value === 'string' &&
                value.trim() &&
                key !== 'activeJourneyRunId' &&
                key !== 'lastUpdated' &&
                key !== 'researchPipeline'
              ) {
                contextLines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
              }
            }
          }
        }
      } catch {
        // Fall through with default context
      }
    }

    return contextLines.length > 0 ? contextLines.join('\n') : fallbackLabel;
  }, [activeRunId]);

  const handleRetrySection = useCallback(async (section: SectionKey) => {
    if (!activeRunId) return;
    setSectionPhase(section, 'researching');

    const context = await buildSectionContext(`Retry ${section} research`);
    const result = await dispatchResearchSection(section, activeRunId, context);
    if (result.status === 'error') {
      setSectionPhase(section, 'error', result.error ?? 'Retry failed');
    }
  }, [activeRunId, setSectionPhase, buildSectionContext]);

  const handleGenerateMediaPlan = useCallback(async () => {
    if (!activeRunId || mediaPlanGenerating) return;
    setMediaPlanGenerating(true);

    const context = await buildSectionContext('Generate media plan from approved research results');

    // Set mediaPlan to 'researching' BEFORE approving crossAnalysis.
    // This prevents WorkspaceApprovalBridge from re-dispatching mediaPlan
    // when it detects the crossAnalysis → approved transition.
    setSectionPhase('mediaPlan', 'researching');

    if (state.sectionStates.crossAnalysis === 'review') {
      setSectionPhase('crossAnalysis', 'approved');
    }
    navigateToSection('mediaPlan');

    const result = await dispatchResearchSection('mediaPlan', activeRunId, context);
    if (result.status === 'error') {
      setSectionPhase('mediaPlan', 'error', result.error ?? 'Failed to start media plan generation');
    }
    setMediaPlanGenerating(false);
  }, [activeRunId, mediaPlanGenerating, setSectionPhase, navigateToSection, buildSectionContext, state.sectionStates.crossAnalysis]);

  const handleNavigateToAssets = useCallback(() => {
    if (state.sectionStates.mediaPlan === 'review') {
      setSectionPhase('mediaPlan', 'approved');
    }
    setShowAssetCollection(true);
  }, [setSectionPhase, state.sectionStates.mediaPlan]);

  const handleNavigateToScripts = useCallback(() => {
    // Approve mediaPlan if still in review
    if (state.sectionStates.mediaPlan === 'review') {
      setSectionPhase('mediaPlan', 'approved');
    }
    // Clear asset collection if it was showing
    setShowAssetCollection(false);
    // Transition scripts out of 'queued' so the tab appears and navigation is allowed
    setSectionPhase('scripts', 'review');
    setAutoGenerateScripts(true);
    navigateToSection('scripts');
  }, [setSectionPhase, navigateToSection, state.sectionStates.mediaPlan]);

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--bg-base)]">
      <WorkspaceResearchBridge userId={userId} activeRunId={activeRunId} />
      <WorkspaceApprovalBridge onSectionApproved={onSectionApproved} />
      <WorkspaceNavBar
        companyName={companyName}
        onBack={onBack}
        userId={userId}
        activeRunId={activeRunId}
      />
      <div className="flex flex-1 min-h-0">
        {showAssetCollection && state.currentSection !== 'scripts' ? (
          <div className="flex flex-1 flex-col min-h-0">
            <AssetCollectionPhase
              runId={activeRunId ?? ''}
              onGenerateScripts={handleNavigateToScripts}
              onSkip={handleNavigateToScripts}
            />
          </div>
        ) : state.currentSection === 'scripts' ? (
          <div className="flex flex-1 flex-col min-h-0 overflow-y-auto custom-scrollbar">
            <ScriptsPhaseContent
              activeRunId={activeRunId ?? null}
              onScriptsGeneratingChange={setScriptsGenerating}
              autoGenerate={autoGenerateScripts}
            />
          </div>
        ) : (
          <ArtifactCanvas
            jobActivity={jobActivity}
            onGenerateMediaPlan={handleGenerateMediaPlan}
            mediaPlanGenerating={mediaPlanGenerating}
            onRetrySection={handleRetrySection}
            onNavigateToScripts={handleNavigateToScripts}
            onNavigateToAssets={handleNavigateToAssets}
          />
        )}
        {(() => {
          const currentPhase = state.sectionStates[state.currentSection];
          const hideChatForScripts =
            state.currentSection === 'scripts' && scriptsGenerating;
          const showChat =
            (!hasActiveResearch || currentPhase === 'review') && !hideChatForScripts;
          if (!showChat) return null;

          // Build card summaries for AI context injection
          const sectionCards = Object.values(state.cards).filter(
            (c) => c.sectionKey === state.currentSection,
          );
          const cardCtx: CardContext[] = sectionCards.slice(0, 10).map((card) => {
            // Build a readable summary of card content for the AI
            let summary = '';
            const content = card.content;
            if (content) {
              if ('text' in content && typeof content.text === 'string') {
                summary = content.text.slice(0, 300);
              } else if ('stats' in content && Array.isArray(content.stats)) {
                // Stat grid cards: [{ label, value }]
                summary = (content.stats as Array<{ label?: string; value?: string }>)
                  .map(s => `${s.label}: ${s.value}`)
                  .join(', ')
                  .slice(0, 300);
              } else if ('items' in content && Array.isArray(content.items)) {
                // List cards
                summary = (content.items as Array<{ title?: string; text?: string }>)
                  .map(item => item.title || item.text || '')
                  .filter(Boolean)
                  .join('; ')
                  .slice(0, 300);
              } else {
                // Fallback: JSON preview of top-level keys
                summary = JSON.stringify(content).slice(0, 300);
              }
            }
            // Build field list — for stat grids, expose dot-notation paths like "stats.Category"
            const fields: string[] = [];
            if (content && typeof content === 'object') {
              for (const key of Object.keys(content)) {
                if (key === 'stats' && Array.isArray(content.stats)) {
                  const statLabels = (content.stats as Array<{ label?: string }>)
                    .map(s => s.label)
                    .filter(Boolean);
                  fields.push(...statLabels.map(l => `stats.${l}`));
                } else {
                  fields.push(key);
                }
              }
            }

            return {
              id: card.id,
              title: card.label ?? card.cardType,
              firstParagraph: summary,
              fields: fields.slice(0, 15),
            };
          });

          return (
            <div
              className="hidden md:flex shrink-0 relative"
              style={{ width: chatWidth }}
            >
              {/* Resize handle — left edge */}
              <div
                onMouseDown={handleResizeStart}
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group"
              >
                <div className="absolute inset-y-0 -left-0.5 w-2 transition-colors group-hover:bg-[var(--border-default)]/40 group-active:bg-[var(--border-default)]/60" />
                <div className="absolute top-1/2 -translate-y-1/2 -left-[3px] w-[7px] h-8 rounded-full bg-zinc-700/60 group-hover:bg-[var(--text-tertiary)]/60 transition-all opacity-0 group-hover:opacity-100" />
              </div>
              <UnifiedChat
                section={state.currentSection}
                activeRunId={activeRunId ?? ''}
                cardContext={cardCtx}
                className="flex-1 border-l border-zinc-800/40"
              />
            </div>
          );
        })()}
      </div>
      <div className="md:hidden">
        <BottomSheet />
      </div>
    </div>
  );
}
