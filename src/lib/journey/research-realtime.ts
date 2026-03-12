'use client';

import { useEffect, useRef } from 'react';
import {
  normalizeStoredResearchResults,
  type StoredResearchResult,
} from '@/lib/journey/research-result-contract';
import {
  buildJourneySessionUrl,
  doesJourneyRunMatchActiveRun,
  getJourneyRunIdFromMetadata,
} from '@/lib/journey/journey-run';
import { applyJourneySandboxSectionResets } from '@/lib/journey/research-sandbox';

export type ResearchSectionResult = StoredResearchResult<unknown, string>;

export function getResearchResultSignature(
  result: ResearchSectionResult,
): string {
  return JSON.stringify({
    status: result.status,
    section: result.section,
    data: result.data ?? null,
    error: result.error ?? null,
    durationMs: result.durationMs,
    telemetry: result.telemetry ?? null,
  });
}

export function shouldHandleResearchResult(
  seenResults: Map<string, string>,
  section: string,
  result: ResearchSectionResult,
): boolean {
  const signature = getResearchResultSignature(result);
  if (seenResults.get(section) === signature) {
    return false;
  }

  seenResults.set(section, signature);
  return true;
}

export function isJourneySessionRowFresh(
  updatedAt: string | null | undefined,
  ignoreUpdatedBefore: string | null | undefined,
): boolean {
  if (!updatedAt || !ignoreUpdatedBefore) {
    return true;
  }

  return Date.parse(updatedAt) >= Date.parse(ignoreUpdatedBefore);
}

interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  activeRunId?: string | null;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onTimeout?: (pendingSections: string[]) => void;
  timeoutMs?: number;
  /** Increment to reset internal seen-sections state (e.g. when starting a new session). */
  resetSignal?: number;
  ignoreUpdatedBefore?: string | null;
}

const CORE_RESEARCH_SECTIONS = new Set([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
]);

interface JourneySessionSnapshotResponse {
  metadata: Record<string, unknown> | null;
  researchResults: Record<string, unknown> | null;
  jobStatus: Record<string, unknown> | null;
  updatedAt: string | null;
  runId?: string | null;
  error?: string;
}

/**
 * Subscribe to Supabase Realtime for research results.
 * Calls onSectionComplete whenever a new section arrives in journey_sessions.research_results.
 */
export function useResearchRealtime({
  userId,
  activeRunId,
  onSectionComplete,
  onTimeout,
  timeoutMs,
  resetSignal,
  ignoreUpdatedBefore,
}: UseResearchRealtimeOptions) {
  const seenResults = useRef<Map<string, string>>(new Map());
  const onSectionCompleteRef = useRef(onSectionComplete);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onSectionCompleteRef.current = onSectionComplete;
  }, [onSectionComplete]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!userId || !activeRunId) return;

    // Reset internal state when this effect re-runs (resetSignal changed or userId changed)
    seenResults.current = new Map();

    const timeout = setTimeout(() => {
      const pending = [...CORE_RESEARCH_SECTIONS].filter(
        (s) => !seenResults.current.has(s),
      );
      if (pending.length > 0) {
        onTimeoutRef.current?.(pending);
      }
    }, timeoutMs ?? 5 * 60 * 1000);

    function handleNewSection(
      section: string,
      result: ResearchSectionResult,
    ) {
      if (!shouldHandleResearchResult(seenResults.current, section, result)) {
        return;
      }
      onSectionCompleteRef.current(section, result);
    }

    let cancelled = false;

    const fetchCurrentResults = async () => {
      try {
        const response = await fetch(buildJourneySessionUrl(activeRunId), {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          if (!cancelled) {
            console.error('[journey] Failed to fetch current research results:', {
              status: response.status,
            });
          }
          return;
        }

        const data = (await response.json()) as JourneySessionSnapshotResponse;
        const snapshotRunId =
          data.runId ?? getJourneyRunIdFromMetadata(data.metadata);
        if (
          snapshotRunId !== null &&
          !doesJourneyRunMatchActiveRun(activeRunId, snapshotRunId)
        ) {
          if (!cancelled && process.env.NODE_ENV !== 'production') {
            console.info(
              '[journey] Ignoring stale research snapshot with mismatched run id:',
              {
                activeRunId,
                snapshotRunId,
              },
            );
          }
          return;
        }

        if (!data.researchResults) {
          return;
        }

        if (!isJourneySessionRowFresh(data.updatedAt, ignoreUpdatedBefore)) {
          if (!cancelled && process.env.NODE_ENV !== 'production') {
            console.info(
              '[journey] Ignoring stale research snapshot before reset boundary:',
              {
                ignoreUpdatedBefore,
                updatedAt: data.updatedAt,
              },
            );
          }
          return;
        }

        const filtered = applyJourneySandboxSectionResets({
          metadata: data.metadata,
          researchResults: data.researchResults,
          jobStatus: data.jobStatus as Record<string, import('@/lib/journey/research-sandbox').PersistedResearchJobStatusRow> | null,
        });
        const results = normalizeStoredResearchResults(
          filtered.researchResults,
          'boundary',
        );
        for (const [section, result] of Object.entries(results)) {
          handleNewSection(section, result);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[journey] Failed to fetch current research results:', error);
        }
      }
    };

    void fetchCurrentResults();
    const interval = window.setInterval(() => {
      void fetchCurrentResults();
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [activeRunId, userId, timeoutMs, resetSignal, ignoreUpdatedBefore]);
}
