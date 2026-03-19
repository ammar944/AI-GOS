'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionTabs } from './section-tabs';
import { ArtifactCanvas } from './artifact-canvas';
import { RightRail } from './right-rail';
import { BottomSheet } from './bottom-sheet';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import { dispatchResearchSection } from '@/lib/journey/dispatch-client';
import { parseResearchToCards } from '@/lib/workspace/card-taxonomy';
import { getJourneySession } from '@/lib/storage/local-storage';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import type { SectionKey } from '@/lib/workspace/types';
import { SECTION_PIPELINE, RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';

interface WorkspacePageProps {
  userId?: string | null;
  activeRunId?: string | null;
  onSectionApproved?: (section: SectionKey) => void;
}

function WorkspaceResearchBridge({ userId, activeRunId }: WorkspacePageProps) {
  const { setSectionPhase, setCards } = useWorkspace();
  const renderedMediaPlanBlocksRef = useRef<Set<string>>(new Set());

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

function WorkspaceNavBar() {
  const { state, navigateToSection } = useWorkspace();

  // Show mediaPlan tab when it's no longer queued
  const visibleSections = useMemo(() => {
    if (state.sectionStates.mediaPlan !== 'queued') {
      return SECTION_PIPELINE;
    }
    return RESEARCH_SECTIONS;
  }, [state.sectionStates.mediaPlan]);

  return (
    <SectionTabs
      sections={visibleSections}
      currentSection={state.currentSection}
      sectionStates={state.sectionStates}
      onNavigate={navigateToSection}
      mode="workspace"
    />
  );
}

export function WorkspacePage({ userId, activeRunId, onSectionApproved }: WorkspacePageProps) {
  const { state, setSectionPhase, navigateToSection } = useWorkspace();
  const [mediaPlanGenerating, setMediaPlanGenerating] = useState(false);

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

    // Auto-approve crossAnalysis (strategic synthesis) when generating media plan
    // — it's the last research section before media plan, and clicking "Generate"
    // signals the user is done reviewing it
    if (state.sectionStates.crossAnalysis === 'review') {
      setSectionPhase('crossAnalysis', 'approved');
    }

    setSectionPhase('mediaPlan', 'researching');
    // Use requestAnimationFrame to ensure the state flush happens before navigation.
    // The navigation guard in workspace-provider blocks navigation to 'queued' sections,
    // and setState is async — stateRef.current still reflects 'queued' synchronously.
    requestAnimationFrame(() => navigateToSection('mediaPlan'));

    const result = await dispatchResearchSection('mediaPlan', activeRunId, context);
    if (result.status === 'error') {
      setSectionPhase('mediaPlan', 'error', result.error ?? 'Failed to start media plan generation');
    }
    setMediaPlanGenerating(false);
  }, [activeRunId, mediaPlanGenerating, setSectionPhase, navigateToSection, buildSectionContext, state.sectionStates.crossAnalysis]);

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--bg-base)]">
      <WorkspaceResearchBridge userId={userId} activeRunId={activeRunId} />
      <WorkspaceApprovalBridge onSectionApproved={onSectionApproved} />
      <WorkspaceNavBar />
      <div className="flex flex-1 min-h-0">
        <ArtifactCanvas
          jobActivity={jobActivity}
          onGenerateMediaPlan={handleGenerateMediaPlan}
          mediaPlanGenerating={mediaPlanGenerating}
          onRetrySection={handleRetrySection}
        />
        {(() => {
          const currentPhase = state.sectionStates[state.currentSection];
          const showChat = !hasActiveResearch || currentPhase === 'review';
          return showChat ? (
            <RightRail className="hidden md:flex w-[380px] shrink-0" />
          ) : null;
        })()}
      </div>
      <div className="md:hidden">
        <BottomSheet />
      </div>
    </div>
  );
}
