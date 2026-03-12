'use client';

import { useEffect, useState } from 'react';
import {
  buildJourneySessionUrl,
  doesJourneyRunMatchActiveRun,
  getJourneyRunIdFromMetadata,
} from '@/lib/journey/journey-run';
import type { ResearchTelemetry } from '@/lib/journey/research-observability';
import { applyJourneySandboxSectionResets } from '@/lib/journey/research-sandbox';
import {
  RESEARCH_TOOL_TO_SECTION_MAP,
  getBoundaryResearchSectionId,
} from '@/lib/journey/research-sections';

const TOOL_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(RESEARCH_TOOL_TO_SECTION_MAP).map(([tool, section]) => [
    tool,
    getBoundaryResearchSectionId(section) ?? section,
  ]),
);

export interface ResearchJobStatusRow {
  status: 'running' | 'complete' | 'error';
  tool: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
  updates?: Array<{
    at: string;
    id: string;
    message: string;
    phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
  }>;
  telemetry?: ResearchTelemetry;
}

export interface ResearchJobUpdate {
  at: string;
  id: string;
  message: string;
  phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
}

export interface ResearchJobActivity extends ResearchJobStatusRow {
  jobId: string;
  section: string;
}

export interface CollapsedResearchJobUpdate extends ResearchJobUpdate {
  count: number;
}

function isResearchJobActivityFresh(
  updatedAt: string | null | undefined,
  ignoreUpdatedBefore: string | null | undefined,
): boolean {
  if (!updatedAt || !ignoreUpdatedBefore) {
    return true;
  }

  return Date.parse(updatedAt) >= Date.parse(ignoreUpdatedBefore);
}

function statusTimestamp(row: ResearchJobStatusRow): number {
  const raw = row.completedAt ?? row.lastHeartbeat ?? row.startedAt;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function extractResearchJobActivity(
  jobStatus: Record<string, ResearchJobStatusRow> | null | undefined,
): Record<string, ResearchJobActivity> {
  const latestBySection: Record<string, ResearchJobActivity> = {};

  for (const [jobId, row] of Object.entries(jobStatus ?? {})) {
    const section = TOOL_TO_SECTION[row.tool];
    if (!section) {
      continue;
    }

    const next: ResearchJobActivity = {
      ...row,
      jobId,
      section,
    };

    const current = latestBySection[section];
    if (!current || statusTimestamp(next) >= statusTimestamp(current)) {
      latestBySection[section] = next;
    }
  }

  return latestBySection;
}

export function collapseResearchJobUpdates(
  updates: ResearchJobUpdate[] | undefined,
): CollapsedResearchJobUpdate[] {
  const collapsed: CollapsedResearchJobUpdate[] = [];

  for (const update of [...(updates ?? [])].sort((left, right) =>
    left.at.localeCompare(right.at),
  )) {
    const last = collapsed.at(-1);
    if (last && last.phase === update.phase && last.message === update.message) {
      last.count += 1;
      last.at = update.at;
      last.id = update.id;
      continue;
    }

    collapsed.push({
      ...update,
      count: 1,
    });
  }

  return collapsed;
}

interface UseResearchJobActivityOptions {
  userId: string | null | undefined;
  activeRunId?: string | null;
  resetSignal?: number;
  ignoreUpdatedBefore?: string | null;
}

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

    const fetchCurrentActivity = async () => {
      try {
        const response = await fetch(buildJourneySessionUrl(activeRunId), {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          if (!cancelled) {
            console.error(
              '[journey] Failed to fetch research job activity:',
              await readResearchJobActivityErrorResponse(response),
            );
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

    void fetchCurrentActivity();
    const interval = window.setInterval(() => {
      void fetchCurrentActivity();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userId, activeRunId, resetKey, ignoreUpdatedBefore]);

  if (!userId || !activeRunId || activityState.resetKey !== resetKey) {
    return {};
  }

  return activityState.data;
}
