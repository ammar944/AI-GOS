export type JourneyArtifactSectionStatus =
  | 'queued'
  | 'researching'
  | 'drafting'
  | 'citing'
  | 'complete'
  | 'partial'
  | 'error';

export type JourneyArtifactEvent =
  | {
      type: 'artifact-clear';
      runId?: string;
      section: string;
      title?: string;
      at: string;
    }
  | {
      type: 'artifact-delta';
      runId?: string;
      section: string;
      delta: string;
      title?: string;
      at: string;
    }
  | {
      type: 'artifact-section-state';
      runId?: string;
      section: string;
      status: JourneyArtifactSectionStatus;
      title?: string;
      at: string;
    }
  | {
      type: 'artifact-finish';
      runId?: string;
      section: string;
      title?: string;
      at: string;
    };

export interface JourneyArtifactProgressUpdateLike {
  at?: string;
  message: string;
  phase?: string;
  meta?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStatus(value: unknown): JourneyArtifactSectionStatus | null {
  return value === 'queued' ||
    value === 'researching' ||
    value === 'drafting' ||
    value === 'citing' ||
    value === 'complete' ||
    value === 'partial' ||
    value === 'error'
    ? value
    : null;
}

function readEventType(value: unknown): JourneyArtifactEvent['type'] | null {
  return value === 'artifact-clear' ||
    value === 'artifact-delta' ||
    value === 'artifact-section-state' ||
    value === 'artifact-finish'
    ? value
    : null;
}

export function parseJourneyArtifactEvent(
  update: JourneyArtifactProgressUpdateLike,
  fallbackSection?: string,
): JourneyArtifactEvent | null {
  if (update.phase !== 'artifact') {
    return null;
  }

  const meta = isRecord(update.meta) ? update.meta : null;
  const type = readEventType(meta?.eventType);
  if (!type) {
    return null;
  }

  const section = readString(meta?.section) ?? fallbackSection ?? null;
  if (!section) {
    return null;
  }

  const base = {
    runId: readString(meta?.runId) ?? undefined,
    section,
    title: readString(meta?.title) ?? undefined,
    at: update.at ?? new Date(0).toISOString(),
  };

  if (type === 'artifact-clear') {
    return {
      ...base,
      type,
    };
  }

  if (type === 'artifact-delta') {
    return {
      ...base,
      type,
      delta: update.message,
    };
  }

  if (type === 'artifact-section-state') {
    const status = readStatus(meta?.status);
    if (!status) {
      return null;
    }

    return {
      ...base,
      type,
      status,
    };
  }

  return {
    ...base,
    type,
  };
}
