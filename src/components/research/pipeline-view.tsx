'use client';

import { useUser } from '@clerk/nextjs';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import { getRunIdFromScopedValue } from '@/lib/journey/journey-run';
import { normalizeResearchSectionId } from '@/lib/journey/research-sections';
import {
  PIPELINE_SECTION_CONFIG,
  PIPELINE_SECTION_ORDER,
  pipelineStateSchema,
  type PipelineSectionId,
  type PipelineState,
  type SectionState,
  type SectionStatus,
} from '@/lib/research/pipeline-types';
import { GateControls } from './gate-controls';
import { SectionCard } from './section-card';

interface PipelineViewProps {
  runId: string;
}

interface JourneySessionSnapshotResponse {
  metadata: Record<string, unknown> | null;
  runId?: string | null;
}

type SectionResultMap = Partial<
  Record<PipelineSectionId, ResearchSectionResult>
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getSectionResultData(
  result: ResearchSectionResult | undefined,
): Record<string, unknown> | undefined {
  return isRecord(result?.data) ? result.data : undefined;
}

function getSectionData(
  section: SectionState,
  result: ResearchSectionResult | undefined,
): Record<string, unknown> | undefined {
  return isRecord(section.data) ? section.data : getSectionResultData(result);
}

function getSectionError(
  section: SectionState,
  result: ResearchSectionResult | undefined,
): string | undefined {
  if (typeof section.error === 'string' && section.error.length > 0) {
    return section.error;
  }

  return typeof result?.error === 'string' && result.error.length > 0
    ? result.error
    : undefined;
}

function getSectionActivity(
  activityByBoundaryKey: Record<string, ResearchJobActivity>,
  sectionId: PipelineSectionId,
): ResearchJobActivity | undefined {
  return activityByBoundaryKey[PIPELINE_SECTION_CONFIG[sectionId].boundaryKey];
}

function getDisplayStatus(
  pipelineState: PipelineState,
  section: SectionState,
  result: ResearchSectionResult | undefined,
  activity: ResearchJobActivity | undefined,
): SectionStatus {
  if (section.status === 'approved' || section.status === 'editing' || section.status === 'stale') {
    return section.status;
  }

  if (section.status === 'error' || result?.status === 'error') {
    return 'error';
  }

  if (result?.status === 'complete' || result?.status === 'partial') {
    return 'complete';
  }

  if (
    pipelineState.currentSectionId === section.id &&
    (pipelineState.status === 'running' || section.status === 'running')
  ) {
    return activity?.status === 'running' ? 'running' : 'queued';
  }

  return section.status;
}

function getGatedSectionId(
  pipelineState: PipelineState | null,
  sectionResults: SectionResultMap,
  activityByBoundaryKey: Record<string, ResearchJobActivity>,
): PipelineSectionId | null {
  if (!pipelineState?.currentSectionId) {
    return null;
  }

  const currentSection = pipelineState.sections.find(
    (section) => section.id === pipelineState.currentSectionId,
  );
  if (!currentSection) {
    return null;
  }

  const activity = getSectionActivity(
    activityByBoundaryKey,
    pipelineState.currentSectionId,
  );
  const displayStatus = getDisplayStatus(
    pipelineState,
    currentSection,
    sectionResults[pipelineState.currentSectionId],
    activity,
  );

  return displayStatus === 'complete' ? pipelineState.currentSectionId : null;
}

function getPipelineStateFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): PipelineState | null {
  const pipelineValue = metadata?.researchPipeline;
  const parsedPipelineState = pipelineStateSchema.safeParse(pipelineValue);

  return parsedPipelineState.success ? parsedPipelineState.data : null;
}

export function PipelineView({ runId }: PipelineViewProps): ReactElement {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;

  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [sectionResults, setSectionResults] = useState<SectionResultMap>({});
  const [activeChatSection, setActiveChatSection] = useState<PipelineSectionId | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const refreshPipelineState = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/journey/session?runId=${runId}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Failed to load pipeline snapshot for run ${runId}: ${response.status}`);
    }

    const data = (await response.json()) as JourneySessionSnapshotResponse;
    const nextPipelineState = getPipelineStateFromMetadata(data.metadata);

    if (!nextPipelineState || nextPipelineState.runId !== runId) {
      return;
    }

    setPipelineState(nextPipelineState);
    setSnapshotError(null);
  }, [runId]);

  useResearchRealtime({
    userId,
    activeRunId: runId,
    onSectionComplete: (section, result) => {
      const canonicalSectionId = normalizeResearchSectionId(section);
      if (!canonicalSectionId || canonicalSectionId === 'mediaPlan') {
        return;
      }

      const resultRunId = getRunIdFromScopedValue(result);
      if (resultRunId !== runId) {
        return;
      }

      setSectionResults((currentSectionResults) => ({
        ...currentSectionResults,
        [canonicalSectionId]: result,
      }));
    },
  });

  const activityByBoundaryKey = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isCancelled = false;

    const loadPipelineState = async (): Promise<void> => {
      try {
        await refreshPipelineState();
      } catch (error) {
        if (!isCancelled) {
          setSnapshotError(
            error instanceof Error
              ? error.message
              : `Failed to load pipeline snapshot for run ${runId}`,
          );
        }
      }
    };

    void loadPipelineState();
    const interval = window.setInterval(() => {
      void loadPipelineState();
    }, 2000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshPipelineState, runId, userId]);

  const gatedSectionId = getGatedSectionId(
    pipelineState,
    sectionResults,
    activityByBoundaryKey,
  );

  useEffect(() => {
    setActiveChatSection(gatedSectionId);
  }, [gatedSectionId]);

  const handleApprove = useCallback(async (): Promise<void> => {
    setIsApproving(true);

    try {
      const response = await fetch('/api/research/pipeline/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId }),
      });

      const payload = (await response.json()) as {
        error?: string;
        status?: 'advanced' | 'complete';
      };

      if (!response.ok) {
        throw new Error(
          payload.error ??
            `Failed to advance pipeline for run ${runId}: ${response.status}`,
        );
      }

      setActiveChatSection(null);
      await refreshPipelineState();
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : `Failed to advance pipeline for run ${runId}`,
      );
    } finally {
      setIsApproving(false);
    }
  }, [refreshPipelineState, runId]);

  const handleRetry = useCallback(async (sectionId: PipelineSectionId): Promise<void> => {
    setIsApproving(true);

    try {
      const response = await fetch('/api/research/pipeline/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runId, retry: true }),
      });
      const payload = (await response.json()) as {
        error?: string;
        status?: 'retried';
      };

      if (!response.ok) {
        throw new Error(
          payload.error ??
            `Failed to retry pipeline section ${sectionId} for run ${runId}`,
        );
      }

      setSectionResults((currentSectionResults) => {
        const nextSectionResults = { ...currentSectionResults };
        delete nextSectionResults[sectionId];
        return nextSectionResults;
      });
      await refreshPipelineState();
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : `Failed to retry pipeline section ${sectionId} for run ${runId}`,
      );
    } finally {
      setIsApproving(false);
    }
  }, [refreshPipelineState, runId]);

  if (!isLoaded || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading pipeline session...
      </div>
    );
  }

  if (!pipelineState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        {snapshotError ?? 'Loading pipeline...'}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50 lg:flex-row">
      <div className="w-full border-b border-zinc-800/80 lg:w-1/3 lg:border-b-0 lg:border-r">
        {activeChatSection ? (
          <GateControls
            runId={runId}
            sectionId={activeChatSection}
            sectionData={getSectionData(
              pipelineState.sections.find((section) => section.id === activeChatSection) ??
                pipelineState.sections[0],
              sectionResults[activeChatSection],
            )}
            onApprove={handleApprove}
          />
        ) : (
          <div className="flex h-full min-h-screen flex-col justify-between p-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Section Chat
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                Waiting for the next review gate
              </h1>
              <p className="max-w-md text-sm leading-6 text-zinc-400">
                The chat panel activates when the current section finishes and becomes ready for
                review or refinement.
              </p>
            </div>

            {snapshotError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
                {snapshotError}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="w-full lg:w-2/3">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Research Pipeline
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                  Sequential research review
                </h2>
                <p className="text-sm text-zinc-400">
                  Run <span className="font-mono text-zinc-300">{runId}</span>. Approve each
                  artifact or refine it in chat before the next stage advances.
                </p>
              </div>
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                {pipelineState.status}
              </div>
            </div>
          </div>

          {snapshotError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
              {snapshotError}
            </div>
          ) : null}

          <div className="space-y-4">
            {PIPELINE_SECTION_ORDER.map((sectionId) => {
              const section = pipelineState.sections.find(
                (candidateSection) => candidateSection.id === sectionId,
              );
              if (!section) {
                return null;
              }

              const result = sectionResults[sectionId];
              const activity = getSectionActivity(activityByBoundaryKey, sectionId);
              const displayStatus = getDisplayStatus(
                pipelineState,
                section,
                result,
                activity,
              );

              return (
                <SectionCard
                  key={sectionId}
                  sectionId={sectionId}
                  displayName={PIPELINE_SECTION_CONFIG[sectionId].displayName}
                  status={displayStatus}
                  data={getSectionData(section, result)}
                  activity={activity}
                  error={getSectionError(section, result)}
                  isGated={gatedSectionId === sectionId}
                  isActive={activeChatSection === sectionId}
                  isBusy={isApproving}
                  onOpenChat={() => setActiveChatSection(sectionId)}
                  onApprove={handleApprove}
                  onRetry={
                    displayStatus === 'error' &&
                    pipelineState.currentSectionId === sectionId
                      ? () => {
                          void handleRetry(sectionId);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
