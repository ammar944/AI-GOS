import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createThrottledSectionPartialBroadcaster,
  makeSectionPartialPayload,
  type SectionPartialPublishFn,
} from '../section-partial-broadcaster';
import {
  broadcastSectionPartial,
  RealtimeBroadcastError,
} from '../realtime-broadcast';

interface DeferredPromise<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
}

function createDeferred<T>(): DeferredPromise<T> {
  let reject: DeferredPromise<T>['reject'] | undefined;
  let resolve: DeferredPromise<T>['resolve'] | undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  if (resolve === undefined || reject === undefined) {
    throw new Error('Expected deferred promise controls to be initialized.');
  }

  return { promise, reject, resolve };
}

function watchUnhandledRejections(): {
  dispose: () => void;
  reasons: unknown[];
} {
  const reasons: unknown[] = [];
  const handler = (reason: unknown): void => {
    reasons.push(reason);
  };
  process.on('unhandledRejection', handler);

  return {
    dispose: (): void => {
      process.off('unhandledRejection', handler);
    },
    reasons,
  };
}

async function waitForRejectionReportingTurn(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('section partial broadcaster', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('coalesces frequent partials behind the throttle window', async (): Promise<void> => {
    const publish = vi.fn<SectionPartialPublishFn>(async () => undefined);
    const broadcaster = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      zone: 'positioningMarketCategory',
    });

    broadcaster.enqueue({ categoryDefinition: { prose: 'first' } });
    broadcaster.enqueue({ categoryDefinition: { prose: 'second' } });
    broadcaster.enqueue({ categoryDefinition: { prose: 'third' } });

    await Promise.resolve();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        seq: 1,
        snapshot: { categoryDefinition: { prose: 'first' } },
      }),
    );

    await vi.advanceTimersByTimeAsync(599);
    expect(publish).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        seq: 2,
        snapshot: { categoryDefinition: { prose: 'third' } },
      }),
    );
  });

  it('continues sequence numbers from a shared repair-loop ref', async (): Promise<void> => {
    const publish = vi.fn<SectionPartialPublishFn>(async () => undefined);
    const seqRef = { current: 0 };
    const firstAttempt = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      seqRef,
      zone: 'positioningMarketCategory',
    });
    const secondAttempt = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      seqRef,
      zone: 'positioningMarketCategory',
    });

    firstAttempt.enqueue({ verdict: 'initial partial' });
    await firstAttempt.flush();
    secondAttempt.enqueue({ verdict: 'repair partial' });
    await secondAttempt.flush();

    expect(publish.mock.calls.map(([payload]) => payload.seq)).toEqual([1, 2]);
  });

  it('honors startSeq when no shared ref is supplied', async (): Promise<void> => {
    const publish = vi.fn<SectionPartialPublishFn>(async () => undefined);
    const broadcaster = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      startSeq: 7,
      zone: 'positioningMarketCategory',
    });

    broadcaster.enqueue({ verdict: 'repair partial' });
    await broadcaster.flush();

    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ seq: 8 }),
    );
  });

  it('contains a queued publish rejection while a prior publish is pending', async (): Promise<void> => {
    vi.useRealTimers();
    const firstPublish = createDeferred<void>();
    const secondError = new Error('second broadcast failed');
    const unhandledRejections = watchUnhandledRejections();
    const events: string[] = [];
    const publish = vi.fn<SectionPartialPublishFn>((payload) => {
      events.push(`start-${payload.seq}`);

      if (payload.seq === 1) {
        return firstPublish.promise.then((): void => {
          events.push('finish-1');
        });
      }

      return Promise.reject(secondError);
    });
    const onError = vi.fn<(error: unknown) => void>();
    const broadcaster = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      onError,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      zone: 'positioningMarketCategory',
    });

    try {
      broadcaster.enqueue({ categoryDefinition: { prose: 'first' } });
      broadcaster.enqueue({ marketSize: { prose: 'second' } });
      const flushPromise = broadcaster.flush();

      await waitForRejectionReportingTurn();
      firstPublish.resolve(undefined);

      await expect(flushPromise).resolves.toBeUndefined();
      await waitForRejectionReportingTurn();

      expect(events).toEqual(['start-1', 'finish-1', 'start-2']);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(secondError);
      expect(unhandledRejections.reasons).toEqual([]);
    } finally {
      unhandledRejections.dispose();
    }
  });

  it('reports each failed publish once with contextual errors', async (): Promise<void> => {
    const publish = vi.fn<SectionPartialPublishFn>(async (payload) => {
      const topic = `section-partials:${payload.runId}`;
      throw new RealtimeBroadcastError(`failed seq ${payload.seq}`, {
        channel: topic,
        originalMessage: `network failed for seq ${payload.seq}`,
        runId: payload.runId,
        sectionId: payload.sectionId,
        seq: payload.seq,
        topic,
      });
    });
    const onError = vi.fn<(error: unknown) => void>();
    const broadcaster = createThrottledSectionPartialBroadcaster({
      intervalMs: 600,
      onError,
      publish,
      runId: 'run-1',
      sectionId: 'positioningMarketCategory',
      zone: 'positioningMarketCategory',
    });

    broadcaster.enqueue({ categoryDefinition: { prose: 'first' } });
    broadcaster.enqueue({ marketSize: { prose: 'second' } });

    await expect(broadcaster.flush()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(2);
    const errors = onError.mock.calls.map(([error]) => error);
    const firstError = errors[0];
    const secondError = errors[1];
    expect(firstError).toBeInstanceOf(RealtimeBroadcastError);
    expect(secondError).toBeInstanceOf(RealtimeBroadcastError);

    if (
      !(firstError instanceof RealtimeBroadcastError) ||
      !(secondError instanceof RealtimeBroadcastError)
    ) {
      throw new Error('Expected contextual realtime broadcast errors.');
    }

    expect([firstError.context, secondError.context]).toEqual([
      expect.objectContaining({
        channel: 'section-partials:run-1',
        originalMessage: 'network failed for seq 1',
        runId: 'run-1',
        sectionId: 'positioningMarketCategory',
        seq: 1,
        topic: 'section-partials:run-1',
      }),
      expect.objectContaining({
        channel: 'section-partials:run-1',
        originalMessage: 'network failed for seq 2',
        runId: 'run-1',
        sectionId: 'positioningMarketCategory',
        seq: 2,
        topic: 'section-partials:run-1',
      }),
    ]);
  });

  it('builds the REST broadcast topic, event, and payload shape', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');

    await broadcastSectionPartial({
      runId: 'run-1',
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 7,
      snapshot: { marketSize: { prose: 'draft' } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/realtime/v1/api/broadcast',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              topic: 'section-partials:run-1',
              event: 'partial',
              payload: makeSectionPartialPayload({
                zone: 'positioningMarketCategory',
                sectionId: 'positioningMarketCategory',
                seq: 7,
                snapshot: { marketSize: { prose: 'draft' } },
              }),
            },
          ],
        }),
      }),
    );
  });

  it('wraps fetch rejections with realtime broadcast context', async (): Promise<void> => {
    const fetchError = new Error('socket closed');
    const fetchMock = vi.fn<typeof fetch>(async (): Promise<Response> => {
      throw fetchError;
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');

    let caughtError: unknown;
    try {
      await broadcastSectionPartial({
        runId: 'run-1',
        zone: 'positioningMarketCategory',
        sectionId: 'positioningMarketCategory',
        seq: 9,
        snapshot: { marketSize: { prose: 'draft' } },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(RealtimeBroadcastError);

    if (!(caughtError instanceof RealtimeBroadcastError)) {
      throw new Error('Expected fetch rejection to be wrapped.');
    }

    expect(caughtError.message).toContain('socket closed');
    expect(caughtError.context).toEqual(
      expect.objectContaining({
        channel: 'section-partials:run-1',
        originalMessage: 'socket closed',
        runId: 'run-1',
        sectionId: 'positioningMarketCategory',
        seq: 9,
        topic: 'section-partials:run-1',
      }),
    );
  });
});
