import { PAID_MEDIA_PLAN_SECTION_ID } from '../ai/prompts/positioning-skills';

export type SoakPlanStopReason = 'run_cap' | 'cost_cap';

export interface SoakPlanInput {
  urls: string[];
  maxRuns: number;
  maxEstimatedCostUsd: number;
  estimatedCostPerRunUsd: number;
  intervalMs: number;
  startedAt: string;
}

export interface SoakPlannedRun {
  index: number;
  scheduledAt: string;
  url: string;
  estimatedCostUsd: number;
}

export interface SoakPlan {
  runs: SoakPlannedRun[];
  totalEstimatedCostUsd: number;
  stopReason: SoakPlanStopReason;
}

export interface RunEvidenceWorkerState {
  sectionId: string;
  status: string;
}

export interface RunEvidenceInput {
  runId: string;
  childrenComplete: number;
  childrenTotal: number;
  workerStates: RunEvidenceWorkerState[];
  sectionsByZone: Record<string, { markdown?: string; title?: string; data?: unknown }>;
  errorBoundaryText: string | null;
}

export interface RunEvidenceResult {
  status: 'passed' | 'failed';
  failures: string[];
}

export interface SoakRecord {
  runId: string;
  url: string;
  status: 'passed' | 'failed';
  failures: string[];
  startedAt: string;
  completedAt: string;
  estimatedCostUsd: number;
}

const FORBIDDEN_SOURCE_HOST_SUFFIXES = ['example.com', 'anthropic.com'] as const;
const SYNTHETIC_MARKER_PATTERN = /Synthetic:/i;
const MONEY_PRECISION = 100;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; received ${value}`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number; received ${value}`);
  }
}

function roundMoney(value: number): number {
  return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
}

function getHostFromUrl(value: string): string | null {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isForbiddenHost(host: string): boolean {
  return FORBIDDEN_SOURCE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function collectStringEvidence(
  value: unknown,
  path: string,
  failures: string[],
): void {
  if (typeof value === 'string') {
    if (SYNTHETIC_MARKER_PATTERN.test(value)) {
      failures.push(`Forbidden synthetic marker found in ${path}`);
    }

    const host = getHostFromUrl(value);
    if (host && isForbiddenHost(host)) {
      failures.push(`Forbidden source host ${host} found in ${path}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringEvidence(item, `${path}[${index}]`, failures);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectStringEvidence(nested, `${path}.${key}`, failures);
    }
  }
}

function hasCompletePaidMediaPlan(input: RunEvidenceInput): boolean {
  if (input.sectionsByZone[PAID_MEDIA_PLAN_SECTION_ID]) {
    return true;
  }

  return input.workerStates.some(
    (worker) =>
      worker.sectionId === PAID_MEDIA_PLAN_SECTION_ID &&
      worker.status === 'complete',
  );
}

export function buildSoakPlan(input: SoakPlanInput): SoakPlan {
  if (input.urls.length === 0) {
    throw new Error('urls must include at least one URL for soak rotation');
  }
  assertPositiveInteger(input.maxRuns, 'maxRuns');
  assertPositiveInteger(input.intervalMs, 'intervalMs');
  assertNonNegativeFinite(input.maxEstimatedCostUsd, 'maxEstimatedCostUsd');
  assertNonNegativeFinite(input.estimatedCostPerRunUsd, 'estimatedCostPerRunUsd');

  const maxRunsByCost =
    input.estimatedCostPerRunUsd === 0
      ? input.maxRuns
      : Math.floor(input.maxEstimatedCostUsd / input.estimatedCostPerRunUsd);
  const plannedRunCount = Math.min(input.maxRuns, maxRunsByCost);
  const startMs = Date.parse(input.startedAt);
  if (!Number.isFinite(startMs)) {
    throw new Error(`startedAt must be an ISO timestamp; received ${input.startedAt}`);
  }

  const runs: SoakPlannedRun[] = Array.from(
    { length: plannedRunCount },
    (_, index) => ({
      index: index + 1,
      scheduledAt: new Date(startMs + index * input.intervalMs).toISOString(),
      url: input.urls[index % input.urls.length],
      estimatedCostUsd: roundMoney(input.estimatedCostPerRunUsd),
    }),
  );

  return {
    runs,
    totalEstimatedCostUsd: roundMoney(
      runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
    ),
    stopReason: plannedRunCount < input.maxRuns ? 'cost_cap' : 'run_cap',
  };
}

export function evaluateRunEvidence(input: RunEvidenceInput): RunEvidenceResult {
  const failures: string[] = [];

  if (input.errorBoundaryText) {
    failures.push(`Error boundary rendered: ${input.errorBoundaryText}`);
  }

  if (input.childrenComplete < 6) {
    failures.push(
      `Only ${input.childrenComplete}/${input.childrenTotal} positioning sections complete`,
    );
  }

  if (!hasCompletePaidMediaPlan(input)) {
    failures.push('Paid media terminal section is not complete');
  }

  for (const worker of input.workerStates) {
    if (worker.status === 'error' || worker.status === 'aborted') {
      failures.push(`Worker ${worker.sectionId} ended with ${worker.status}`);
    }
  }

  for (const [zone, section] of Object.entries(input.sectionsByZone)) {
    collectStringEvidence(section.markdown, `${zone}.markdown`, failures);
    collectStringEvidence(section.title, `${zone}.title`, failures);
    collectStringEvidence(section.data, `${zone}.data`, failures);
  }

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    failures,
  };
}

export function serializeSoakRecord(record: SoakRecord): string {
  return `${JSON.stringify(record)}\n`;
}
