'use client';

import { useEffect, useState } from 'react';
import {
  buildJourneySessionUrl,
  doesJourneyRunMatchActiveRun,
  getJourneyRunIdFromMetadata,
} from '@/lib/journey/journey-run';
import { applyJourneySandboxSectionResets } from '@/lib/journey/research-sandbox';
import {
  extractResearchJobActivity,
  type ResearchJobActivity,
  type ResearchJobStatusRow,
} from '@/lib/journey/research-job-activity-core';
export {
  collapseResearchJobUpdates,
  extractResearchJobActivity,
} from '@/lib/journey/research-job-activity-core';
export type {
  CollapsedResearchJobUpdate,
  ResearchJobActivity,
  ResearchJobStatusRow,
  ResearchJobUpdate,
  ResearchUpdateMeta,
} from '@/lib/journey/research-job-activity-core';

function isResearchJobActivityFresh(
  updatedAt: string | null | undefined,
  ignoreUpdatedBefore: string | null | undefined,
): boolean {
  if (!updatedAt || !ignoreUpdatedBefore) {
    return true;
  }

  return Date.parse(updatedAt) >= Date.parse(ignoreUpdatedBefore);
}

interface UseResearchJobActivityOptions {
  userId: string | null | undefined;
  activeRunId?: string | null;
  resetSignal?: number;
  ignoreUpdatedBefore?: string | null;
}

// Stable empty-state sentinel. Returning a fresh `{}` literal on every render
// caused an infinite re-render loop in consumers whose effects depend on the
// hook's return value (e.g. the sections view's `useEffect([activity])`).
const EMPTY_RESEARCH_JOB_ACTIVITY: Readonly<Record<string, ResearchJobActivity>> =
  Object.freeze({});

interface JourneySessionActivityResponse {
  metadata: Record<string, unknown> | null;
  jobStatus: Record<string, ResearchJobStatusRow> | null;
  updatedAt: string | null;
  runId?: string | null;
  error?: string;
}

function normalizeResearchJobActivityError(
  error: unknown,
): Record<string, string | number | null> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const code =
      'code' in error && typeof error.code === 'string' ? error.code : null;
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : null;

    return {
      code,
      message,
    };
  }

  return {
    message: typeof error === 'string' ? error : String(error),
  };
}

async function readResearchJobActivityErrorResponse(
  response: Response,
): Promise<Record<string, string | number | null>> {
  let message: string | null = null;

  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      message = payload.error;
    }
  } catch {
    // Ignore malformed error bodies and fall back to status metadata.
  }

  return {
    status: Number.isFinite(response.status) ? response.status : null,
    message,
  };
}

function logResearchJobActivityFetchFailure(
  failure: Record<string, string | number | null>,
): void {
  if (failure.status === 401) {
    console.warn(
      '[journey] Research job activity polling paused until the session is verified:',
      failure,
    );
    return;
  }

  console.error('[journey] Failed to fetch research job activity:', failure);
}

export function useResearchJobActivity({
  userId,
  activeRunId,
  resetSignal,
  ignoreUpdatedBefore,
}: UseResearchJobActivityOptions): Record<string, ResearchJobActivity> {
  const resetKey = `${userId ?? ''}:${activeRunId ?? ''}:${String(resetSignal ?? 0)}:${ignoreUpdatedBefore ?? ''}`;
  const [activityState, setActivityState] = useState<{
    resetKey: string;
    data: Record<string, ResearchJobActivity>;
  }>({
    resetKey: '',
    data: {},
  });

  useEffect(() => {
    if (!userId || !activeRunId) {
      return;
    }

    let cancelled = false;

    function stopPolling(): void {
      window.clearInterval(interval);
    }

    const fetchCurrentActivity = async () => {
      try {
        const response = await fetch(buildJourneySessionUrl(activeRunId), {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          if (!cancelled) {
            const failure = await readResearchJobActivityErrorResponse(response);
            logResearchJobActivityFetchFailure(failure);
            if (failure.status === 401) {
              stopPolling();
            }
          }
          return;
        }

        const data = (await response.json()) as JourneySessionActivityResponse;
        const snapshotRunId = data.runId ?? getJourneyRunIdFromMetadata(data.metadata);
        if (
          (snapshotRunId !== null &&
            !doesJourneyRunMatchActiveRun(activeRunId, snapshotRunId)) ||
          !isResearchJobActivityFresh(data.updatedAt, ignoreUpdatedBefore)
        ) {
          return;
        }

        const filtered = applyJourneySandboxSectionResets({
          metadata: data.metadata,
          researchResults: null,
          jobStatus: data.jobStatus,
        });
        if (!cancelled) {
          setActivityState({
            resetKey,
            data: extractResearchJobActivity(filtered.jobStatus),
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            '[journey] Failed to fetch research job activity:',
            normalizeResearchJobActivityError(error),
          );
        }
      }
    };

    const interval = window.setInterval(() => {
      void fetchCurrentActivity();
    }, 2000);
    void fetchCurrentActivity();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [userId, activeRunId, resetKey, ignoreUpdatedBefore]);

  if (!userId || !activeRunId || activityState.resetKey !== resetKey) {
    return EMPTY_RESEARCH_JOB_ACTIVITY;
  }

  return activityState.data;
}
