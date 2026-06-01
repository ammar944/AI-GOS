import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createThrottledSectionPartialBroadcaster,
  makeSectionPartialPayload,
  type SectionPartialPublishFn,
} from '../section-partial-broadcaster';
import { broadcastSectionPartial } from '../realtime-broadcast';

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
});
