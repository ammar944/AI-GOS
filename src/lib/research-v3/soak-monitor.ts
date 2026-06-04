import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '../ai/prompts/positioning-skills';

export interface SoakArtifactSnapshot {
  id: string;
  status: string | null;
  childrenComplete: number;
  childrenTotal: number;
}

export interface SoakSectionRunSnapshot {
  zone: string;
  status: string | null;
  updatedAt: string | null;
}

export interface SoakEventSnapshot {
  zone: string;
  eventType: string;
  message: string | null;
  createdAt: string;
}

export interface SoakHealthInput {
  now: string;
  previousChildrenComplete: number | null;
  artifact: SoakArtifactSnapshot | null;
  sectionRuns: SoakSectionRunSnapshot[];
  events: SoakEventSnapshot[];
  defaultStaleMs?: number;
  corpusStaleMs?: number;
}

export interface SoakHealthResult {
  status: 'healthy' | 'complete' | 'failed';
  failures: string[];
  childrenComplete: number;
  childrenTotal: number;
}

const DEFAULT_STALE_MS = 5 * 60 * 1000;
const CORPUS_STALE_MS = 15 * 60 * 1000;
const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['queued', 'running']);

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isProgressStalled(
  previousChildrenComplete: number | null,
  childrenComplete: number,
): boolean {
  return (
    previousChildrenComplete !== null &&
    childrenComplete <= previousChildrenComplete
  );
}

function getStaleThresholdMs(
  zone: string,
  defaultStaleMs: number,
  corpusStaleMs: number,
): number {
  return zone === 'deepResearchProgram' ? corpusStaleMs : defaultStaleMs;
}

function hasCompleteRun(sectionRuns: SoakSectionRunSnapshot[], zone: string): boolean {
  return sectionRuns.some(
    (run) => run.zone === zone && run.status === 'complete',
  );
}

function hasAllTerminalSections(sectionRuns: SoakSectionRunSnapshot[]): boolean {
  return (
    POSITIONING_SECTION_IDS.every((zone) => hasCompleteRun(sectionRuns, zone)) &&
    hasCompleteRun(sectionRuns, CROSS_SECTION_REASONING_SECTION_ID) &&
    hasCompleteRun(sectionRuns, POSITIONING_SYNTHESIS_SECTION_ID) &&
    hasCompleteRun(sectionRuns, PAID_MEDIA_PLAN_SECTION_ID)
  );
}

export function evaluateSoakHealth(input: SoakHealthInput): SoakHealthResult {
  const failures: string[] = [];
  const childrenComplete = input.artifact?.childrenComplete ?? 0;
  const childrenTotal = input.artifact?.childrenTotal ?? POSITIONING_SECTION_IDS.length;
  const defaultStaleMs = input.defaultStaleMs ?? DEFAULT_STALE_MS;
  const corpusStaleMs = input.corpusStaleMs ?? CORPUS_STALE_MS;
  const nowMs = Date.parse(input.now);

  if (!Number.isFinite(nowMs)) {
    throw new Error(`now must be an ISO timestamp; received ${input.now}`);
  }

  if (input.artifact?.status === 'error') {
    failures.push(`research_artifacts ${input.artifact.id} status is error`);
  }

  for (const run of input.sectionRuns) {
    if (run.status === 'error') {
      failures.push(`research_section_runs ${run.zone} status is error`);
    }
  }

  for (const event of input.events) {
    if (event.eventType === 'error') {
      failures.push(
        `research_section_events ${event.zone} emitted error: ${
          event.message ?? 'no message'
        }`,
      );
    }
  }

  const stalled = isProgressStalled(input.previousChildrenComplete, childrenComplete);
  for (const run of input.sectionRuns) {
    if (!run.status || !ACTIVE_STATUSES.has(run.status) || !stalled) {
      continue;
    }

    const updatedAtMs = parseTimestamp(run.updatedAt);
    if (updatedAtMs === null) {
      continue;
    }

    const ageMs = nowMs - updatedAtMs;
    const thresholdMs = getStaleThresholdMs(
      run.zone,
      defaultStaleMs,
      corpusStaleMs,
    );
    if (ageMs >= thresholdMs) {
      failures.push(
        `research_section_runs ${run.zone} is stale in ${run.status} for ${ageMs}ms`,
      );
    }
  }

  if (failures.length > 0) {
    return {
      status: 'failed',
      failures,
      childrenComplete,
      childrenTotal,
    };
  }

  const complete =
    input.artifact?.status === 'complete' &&
    childrenComplete >= childrenTotal &&
    hasAllTerminalSections(input.sectionRuns);

  return {
    status: complete ? 'complete' : 'healthy',
    failures,
    childrenComplete,
    childrenTotal,
  };
}
