import { broadcastSectionPartial } from './realtime-broadcast';

export type SectionPartialSnapshot = Record<string, unknown>;

export interface SectionPartialPayload {
  zone: string;
  sectionId: string;
  seq: number;
  snapshot: SectionPartialSnapshot;
}

export interface SectionPartialPublishInput extends SectionPartialPayload {
  runId: string;
}

export type SectionPartialPublishFn = (
  input: SectionPartialPublishInput,
) => Promise<void>;

export interface SectionPartialBroadcaster {
  cancel: () => void;
  enqueue: (snapshot: unknown) => void;
  flush: () => Promise<void>;
}

export interface SectionPartialSeqRef {
  current: number;
}

interface ThrottledSectionPartialBroadcasterParams {
  intervalMs?: number;
  onError?: (error: unknown) => void;
  publish?: SectionPartialPublishFn;
  runId: string;
  sectionId: string;
  seqRef?: SectionPartialSeqRef;
  startSeq?: number;
  zone: string;
}

export function makeSectionPartialPayload(
  input: SectionPartialPayload,
): SectionPartialPayload {
  return {
    zone: input.zone,
    sectionId: input.sectionId,
    seq: input.seq,
    snapshot: input.snapshot,
  };
}

export function createThrottledSectionPartialBroadcaster({
  intervalMs = 600,
  onError,
  publish = broadcastSectionPartial,
  runId,
  sectionId,
  seqRef,
  startSeq = 0,
  zone,
}: ThrottledSectionPartialBroadcasterParams): SectionPartialBroadcaster {
  let lastSentAt = 0;
  let pendingSnapshot: SectionPartialSnapshot | null = null;
  let publishChain: Promise<void> = Promise.resolve();
  const sequence = seqRef ?? { current: startSeq };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasSent = false;
  const seenTopLevelKeys = new Set<string>();

  const publishSnapshot = (snapshot: SectionPartialSnapshot): void => {
    hasSent = true;
    lastSentAt = Date.now();
    sequence.current += 1;
    const payload = {
      runId,
      ...makeSectionPartialPayload({
        zone,
        sectionId,
        seq: sequence.current,
        snapshot,
      }),
    };
    publishChain = publishChain.then(async (): Promise<void> => {
      try {
        await publish(payload);
      } catch (error: unknown) {
        onError?.(error);
      }
    });
  };

  const clearTimer = (): void => {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  };

  const flushPending = (): void => {
    clearTimer();
    if (pendingSnapshot === null) {
      return;
    }
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    publishSnapshot(snapshot);
  };

  const schedulePending = (): void => {
    clearTimer();
    const elapsedMs = Date.now() - lastSentAt;
    const remainingMs = Math.max(0, intervalMs - elapsedMs);
    timer = setTimeout(flushPending, remainingMs);
  };

  return {
    cancel: (): void => {
      clearTimer();
      pendingSnapshot = null;
    },
    enqueue: (snapshot: unknown): void => {
      if (!isRecord(snapshot)) {
        return;
      }

      const topLevelKeys = Object.keys(snapshot);
      const hasNewTopLevelKey = topLevelKeys.some(
        (key) => !seenTopLevelKeys.has(key),
      );

      for (const key of topLevelKeys) {
        seenTopLevelKeys.add(key);
      }

      if (!hasSent || hasNewTopLevelKey) {
        pendingSnapshot = null;
        clearTimer();
        publishSnapshot(snapshot);
        return;
      }

      pendingSnapshot = snapshot;
      schedulePending();
    },
    flush: async (): Promise<void> => {
      flushPending();
      await publishChain;
    },
  };
}

function isRecord(value: unknown): value is SectionPartialSnapshot {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
