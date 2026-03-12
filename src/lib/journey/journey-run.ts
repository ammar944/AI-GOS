export const JOURNEY_ACTIVE_RUN_ID_KEY = 'activeJourneyRunId';
export const JOURNEY_ACTIVE_RUN_METADATA_KEY = JOURNEY_ACTIVE_RUN_ID_KEY;

const JOURNEY_ACTIVE_RUN_STORAGE_KEY = 'aigos_journey_active_run_id';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function createJourneyRunId(): string {
  return crypto.randomUUID();
}

export function getStoredJourneyRunId(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.sessionStorage.getItem(JOURNEY_ACTIVE_RUN_STORAGE_KEY);
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function setStoredJourneyRunId(activeRunId: string | null): void {
  if (!isBrowser()) {
    return;
  }

  if (!activeRunId) {
    window.sessionStorage.removeItem(JOURNEY_ACTIVE_RUN_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(JOURNEY_ACTIVE_RUN_STORAGE_KEY, activeRunId);
}

export function clearStoredJourneyRunId(): void {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(JOURNEY_ACTIVE_RUN_STORAGE_KEY);
}

export function getActiveJourneyRunId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const runId = metadata?.[JOURNEY_ACTIVE_RUN_ID_KEY];
  return typeof runId === 'string' && runId.trim().length > 0
    ? runId
    : null;
}

export function getJourneyRunIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  return getActiveJourneyRunId(metadata);
}

export function withActiveJourneyRunId(
  metadata: Record<string, unknown> | null | undefined,
  activeRunId: string,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [JOURNEY_ACTIVE_RUN_ID_KEY]: activeRunId,
  };
}

export function doesJourneyRunMatchActiveRun(
  activeRunId: string | null | undefined,
  candidateRunId: string | null | undefined,
): boolean {
  return Boolean(activeRunId) && Boolean(candidateRunId) && activeRunId === candidateRunId;
}

export function getRunIdFromScopedValue(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const runId = value.runId;
  return typeof runId === 'string' && runId.trim().length > 0
    ? runId
    : null;
}

export function filterRunScopedRecord<T>(
  record: Record<string, T> | null | undefined,
  activeRunId: string | null | undefined,
): Record<string, T> | null {
  if (!record || !activeRunId) {
    return null;
  }

  const entries = Object.entries(record).filter(
    ([, value]) => getRunIdFromScopedValue(value) === activeRunId,
  );

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as Record<string, T>;
}

export function buildJourneySessionSnapshotUrl(
  activeRunId: string | null | undefined,
): string | null {
  if (!activeRunId) {
    return null;
  }

  return `/api/journey/session?${new URLSearchParams({ runId: activeRunId }).toString()}`;
}

export function buildJourneySessionUrl(
  activeRunId: string | null | undefined,
): string {
  return buildJourneySessionSnapshotUrl(activeRunId) ?? '/api/journey/session';
}
