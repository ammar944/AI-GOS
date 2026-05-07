'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2, Check, Loader2, Link2, ArrowLeft } from 'lucide-react';
import { ArtifactCanvas } from './artifact-canvas';
import { ManusWorkspaceShell } from './manus-workspace-shell';
import { UnifiedChat } from '@/components/chat/unified-chat';
import type { CardContext } from '@/components/chat/unified-chat';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { useResearchJobActivity, type ResearchJobActivity } from '@/lib/journey/research-job-activity';
import {
  dispatchResearchSection,
} from '@/lib/journey/dispatch-client';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import { getJourneySession } from '@/lib/storage/local-storage';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { useSessionShare } from '@/hooks/use-session-share';
import type { SectionKey, WorkspaceState } from '@/lib/workspace/types';
import { getNextSection, RESEARCH_SECTIONS, SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { ScriptsPhaseContent } from './scripts-phase';
import { AssetCollectionPhase } from './asset-collection-phase';
import { buildWorkspaceHydrationPlan } from './workspace-hydration';
import { JourneyRunStagePanel } from './journey-run-stage-panel';
import { JourneyRunEventLog } from './journey-run-event-log';
import { JourneyRunBlockerPanel } from './journey-run-blocker-panel';
import { JourneyRunArtifactVisibilityPanel } from './journey-run-artifact-visibility-panel';
import type { JourneyRunView } from '@/lib/journey/run-view';

interface WorkspacePageProps {
  userId?: string | null;
  activeRunId?: string | null;
  onSectionApproved?: (section: SectionKey) => void;
  companyName?: string | null;
  onBack?: () => void;
}

interface WorkspaceResearchBridgeProps {
  userId?: string | null;
  activeRunId?: string | null;
  activityBySection: Record<string, ResearchJobActivity>;
  onRunViewLoaded: (view: JourneyRunView | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getRunViewFromSnapshot(snapshot: unknown): JourneyRunView | null {
  const record = isRecord(snapshot) ? snapshot : null;
  const view = isRecord(record?.view) ? record.view : null;
  return Array.isArray(view?.sections) ? (view as unknown as JourneyRunView) : null;
}

function hasRunningResearchActivity(
  activityBySection: Record<string, ResearchJobActivity>,
): boolean {
  return Object.values(activityBySection).some(
    (activity) => activity.status === 'running',
  );
}

function getRunDetailsSummary(
  view: JourneyRunView | null,
  activityBySection: Record<string, ResearchJobActivity>,
): string {
  if (hasRunningResearchActivity(activityBySection)) {
    return 'Run details - running';
  }

  return view ? `Run details - ${view.status}` : 'Run details';
}

function WorkspaceResearchBridge({
  userId,
  activeRunId,
  activityBySection,
  onRunViewLoaded,
}: WorkspaceResearchBridgeProps) {
  const { setSectionPhase, setCards, updateCard } = useWorkspace();
  const renderedMediaPlanBlocksRef = useRef<Set<string>>(new Set());
  const appliedEditsRef = useRef(false);
  const activityBySectionRef = useRef(activityBySection);

  useEffect(() => {
    activityBySectionRef.current = activityBySection;
  }, [activityBySection]);

  const hydrateWorkspaceSnapshot = useCallback(
    (json: unknown): void => {
      onRunViewLoaded(getRunViewFromSnapshot(json));
      const hydrationPlan = buildWorkspaceHydrationPlan(json);
      for (const sectionPlan of hydrationPlan.sections) {
        const activity = activityBySectionRef.current[sectionPlan.section];
        const phase =
          activity?.status === 'running' ? 'researching' : sectionPlan.phase;
        const error =
          activity?.status === 'running' ? undefined : sectionPlan.error;

        if (sectionPlan.cards.length > 0) {
          setCards(sectionPlan.section, sectionPlan.cards);
        }
        setSectionPhase(
          sectionPlan.section,
          phase,
          error,
        );
      }

      if (appliedEditsRef.current) {
        return;
      }

      appliedEditsRef.current = true;
      for (const edit of hydrationPlan.cardEdits) {
        updateCard(edit.cardId, edit.content, 'ai');
      }
    },
    [onRunViewLoaded, setCards, setSectionPhase, updateCard],
  );

  // Poll persisted data from Supabase (cold-start / cross-device recovery + live job status).
  // 1. Hydrates section states — if Supabase has complete results but localStorage is stale,
  //    update workspace state so CTAs (media plan, scripts) appear correctly.
  // 2. Applies persisted card edits stored under research_results[section].__cardEdits.
  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    appliedEditsRef.current = false;

    const fetchSnapshot = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/journey/session?runId=${activeRunId}`, {
          credentials: 'same-origin',
        });
        const json = response.ok ? await response.json() : null;
        if (!cancelled) {
          hydrateWorkspaceSnapshot(json);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        onRunViewLoaded(null);
        console.warn('[journey] Failed to hydrate workspace from session snapshot:', {
          activeRunId,
          error,
        });
      }
    };

    void fetchSnapshot();
    const interval = window.setInterval(() => {
      void fetchSnapshot();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRunId, hydrateWorkspaceSnapshot, onRunViewLoaded]);

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

function WorkspaceStatusSummary({
  companyName,
  onBack,
}: {
  companyName?: string | null;
  onBack?: () => void;
}): React.ReactElement {
  const { state } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const showCompanyName = companyName && companyName !== 'this company';
  const activePhase = state.sectionStates[state.currentSection];

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Section Synthesis Workspace
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-medium text-[var(--text-primary)]">
            {showCompanyName ? companyName : 'AI-GOS Journey'}
          </h1>
          <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {activePhase}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
          {meta.moduleNumber} · {meta.label}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ShareButton />
        {onBack && (
          <button
            type="button"
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

function WorkspaceRunDetails({
  view,
  activityBySection,
}: {
  view: JourneyRunView | null;
  activityBySection: Record<string, ResearchJobActivity>;
}): React.ReactElement | null {
  if (!view) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <JourneyRunBlockerPanel view={view} />
      <JourneyRunStagePanel
        view={view}
        activityBySection={activityBySection}
      />
      <JourneyRunArtifactVisibilityPanel view={view} />
      <JourneyRunEventLog view={view} />
    </div>
  );
}

function buildCardContextForSection(
  cards: WorkspaceState['cards'],
  section: SectionKey,
): CardContext[] {
  return Object.values(cards)
    .filter((card) => card.sectionKey === section)
    .slice(0, 10)
    .map((card) => {
      let summary = '';
      const content = card.content;
      if (content) {
        if ('text' in content && typeof content.text === 'string') {
          summary = content.text.slice(0, 300);
        } else if ('stats' in content && Array.isArray(content.stats)) {
          summary = (content.stats as Array<{ label?: string; value?: string }>)
            .map((stat) => `${stat.label}: ${stat.value}`)
            .join(', ')
            .slice(0, 300);
        } else if ('items' in content && Array.isArray(content.items)) {
          summary = (content.items as Array<{ title?: string; text?: string }>)
            .map((item) => item.title || item.text || '')
            .filter(Boolean)
            .join('; ')
            .slice(0, 300);
        } else {
          summary = JSON.stringify(content).slice(0, 300);
        }
      }

      const fields: string[] = [];
      for (const key of Object.keys(content)) {
        if (key === 'stats' && Array.isArray(content.stats)) {
          const statLabels = (content.stats as Array<{ label?: string }>)
            .map((stat) => stat.label)
            .filter((label): label is string => Boolean(label));
          fields.push(...statLabels.map((label) => `stats.${label}`));
        } else {
          fields.push(key);
        }
      }

      return {
        id: card.id,
        title: card.label ?? card.cardType,
        firstParagraph: summary,
        fields: fields.slice(0, 15),
      };
    });
}

export function WorkspacePage({ userId, activeRunId, onSectionApproved, companyName, onBack }: WorkspacePageProps) {
  const { state, setSectionPhase, navigateToSection } = useWorkspace();
  const [mediaPlanGenerating, setMediaPlanGenerating] = useState(false);
  const [scriptsGenerating, setScriptsGenerating] = useState(false);
  const [autoGenerateScripts, setAutoGenerateScripts] = useState(false);
  const [showAssetCollection, setShowAssetCollection] = useState(false);
  const [runView, setRunView] = useState<JourneyRunView | null>(null);

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

  const handleSectionApproved = useCallback((section: SectionKey) => {
    onSectionApproved?.(section);

    const nextSection = getNextSection(section);
    if (
      !activeRunId ||
      !nextSection ||
      nextSection === 'mediaPlan' ||
      !RESEARCH_SECTIONS.includes(nextSection)
    ) {
      return;
    }

    const nextPhase = state.sectionStates[nextSection];
    if (nextPhase === 'researching' || nextPhase === 'streaming' || nextPhase === 'review' || nextPhase === 'approved') {
      return;
    }

    setSectionPhase(nextSection, 'researching');
    void buildSectionContext(`Synthesize ${SECTION_META[nextSection]?.label ?? nextSection} from completed onboarding and approved prior sections`)
      .then((context) => dispatchResearchSection(nextSection, activeRunId, context))
      .then((result) => {
        if (result.status === 'error') {
          setSectionPhase(nextSection, 'error', result.error ?? 'Failed to start next section');
        }
      })
      .catch((error: unknown) => {
        setSectionPhase(
          nextSection,
          'error',
          error instanceof Error ? error.message : String(error),
        );
      });
  }, [
    activeRunId,
    buildSectionContext,
    onSectionApproved,
    setSectionPhase,
    state.sectionStates,
  ]);

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

  const cardCtx = buildCardContextForSection(state.cards, state.currentSection);
  const hideChatForScripts = state.currentSection === 'scripts' && scriptsGenerating;
  const chatPane = hideChatForScripts ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        Script generation running
      </p>
      <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
        The workspace chat will return when the active script pass finishes.
      </p>
    </div>
  ) : (
    <UnifiedChat
      section={state.currentSection}
      activeRunId={activeRunId ?? ''}
      cardContext={cardCtx}
      companyName={companyName ?? undefined}
      className="flex-1"
    />
  );

  const artifactPane = showAssetCollection && state.currentSection !== 'scripts' ? (
    <AssetCollectionPhase
      runId={activeRunId ?? ''}
      onGenerateScripts={handleNavigateToScripts}
      onSkip={handleNavigateToScripts}
    />
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
  );

  const runDetails = (
    <WorkspaceRunDetails
      view={runView}
      activityBySection={jobActivity}
    />
  );

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--bg-base)]">
      <WorkspaceResearchBridge
        userId={userId}
        activeRunId={activeRunId}
        activityBySection={jobActivity}
        onRunViewLoaded={setRunView}
      />
      <WorkspaceApprovalBridge onSectionApproved={handleSectionApproved} />
      <ManusWorkspaceShell
        workspaceState={{
          currentSection: state.currentSection,
          sectionStates: state.sectionStates,
        }}
        sections={RESEARCH_SECTIONS}
        onNavigateSection={navigateToSection}
        statusSummary={(
          <WorkspaceStatusSummary
            companyName={companyName}
            onBack={onBack}
          />
        )}
        chat={chatPane}
        artifact={artifactPane}
        runDetails={runView ? runDetails : undefined}
        runDetailsSummary={getRunDetailsSummary(runView, jobActivity)}
      />
    </div>
  );
}
