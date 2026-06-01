import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applySectionPartialPayload,
  type SectionPartialsByZone,
  useSectionPartials,
} from '../use-section-partials';

type BroadcastHandler = (message: { payload: unknown }) => void;

interface MockRealtimeChannel {
  on: (
    event: string,
    filter: unknown,
    handler: BroadcastHandler,
  ) => MockRealtimeChannel;
  subscribe: () => MockRealtimeChannel;
  unsubscribe: () => Promise<void>;
}

const supabaseHarness = vi.hoisted(() => {
  const state: { handler: BroadcastHandler | undefined } = {
    handler: undefined,
  };
  const channel = {} as MockRealtimeChannel;
  channel.on = vi.fn((_event, _filter, handler) => {
    state.handler = handler;
    return channel;
  });
  channel.subscribe = vi.fn(() => channel);
  channel.unsubscribe = vi.fn(async () => undefined);
  const supabase = {
    channel: vi.fn(() => channel),
  };

  return {
    channel,
    createClient: vi.fn(() => supabase),
    state,
    supabase,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: supabaseHarness.createClient,
}));

function emitPartial(payload: unknown): void {
  const handler = supabaseHarness.state.handler;

  if (handler === undefined) {
    throw new Error('Expected section partial broadcast handler to be registered.');
  }

  act(() => {
    handler({ payload });
  });
}

describe('useSectionPartials state reducer', (): void => {
  it('keeps the latest partial per zone and drops stale sequence frames', (): void => {
    let state: SectionPartialsByZone = {};

    state = applySectionPartialPayload(state, {
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 2,
      snapshot: { marketSize: { prose: 'newer' } },
    });
    state = applySectionPartialPayload(state, {
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 1,
      snapshot: { marketSize: { prose: 'stale' } },
    });
    state = applySectionPartialPayload(state, {
      zone: 'positioningBuyerICP',
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { personaReality: { prose: 'buyer draft' } },
    });

    expect(state.positioningMarketCategory).toEqual({
      sectionId: 'positioningMarketCategory',
      seq: 2,
      snapshot: { marketSize: { prose: 'newer' } },
      zone: 'positioningMarketCategory',
    });
    expect(state.positioningBuyerICP).toEqual({
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { personaReality: { prose: 'buyer draft' } },
      zone: 'positioningBuyerICP',
    });
  });
});

describe('useSectionPartials hook', (): void => {
  beforeEach((): void => {
    supabaseHarness.state.handler = undefined;
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it('subscribes, validates payloads, keeps latest zones, drops stale frames, and unsubscribes', async (): Promise<void> => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useSectionPartials('run-1'));

    await waitFor(() => {
      expect(supabaseHarness.supabase.channel).toHaveBeenCalledWith(
        'section-partials:run-1',
      );
    });
    expect(supabaseHarness.channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'partial' },
      expect.any(Function),
    );
    expect(supabaseHarness.channel.subscribe).toHaveBeenCalledTimes(1);

    emitPartial({
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 1,
      snapshot: { verdict: 'initial' },
    });
    emitPartial({
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 0,
      snapshot: { verdict: 'stale' },
    });
    emitPartial({
      zone: 'positioningBuyerICP',
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { verdict: 'buyer' },
    });
    emitPartial({
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 2,
      snapshot: { verdict: 'fresh' },
    });
    emitPartial({
      zone: 'positioningMarketCategory',
      sectionId: 'positioningMarketCategory',
      seq: 'malformed',
      snapshot: { verdict: 'bad' },
    });

    await waitFor(() => {
      expect(result.current.positioningMarketCategory).toEqual({
        zone: 'positioningMarketCategory',
        sectionId: 'positioningMarketCategory',
        seq: 2,
        snapshot: { verdict: 'fresh' },
      });
    });
    expect(result.current.positioningBuyerICP).toEqual({
      zone: 'positioningBuyerICP',
      sectionId: 'positioningBuyerICP',
      seq: 1,
      snapshot: { verdict: 'buyer' },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[use-section-partials] malformed partial payload',
      expect.objectContaining({
        issues: expect.any(Array),
        runId: 'run-1',
      }),
    );

    unmount();
    expect(supabaseHarness.channel.unsubscribe).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
