import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  emitTelemetry,
  registerTelemetryPersister,
  withTelemetry,
  type TelemetryEvent,
} from '../telemetry';

describe('emitTelemetry', () => {
  const originalVerbose = process.env.RESEARCH_TELEMETRY_VERBOSE;
  const originalPersist = process.env.RESEARCH_TELEMETRY_PERSIST;

  beforeEach(() => {
    delete process.env.RESEARCH_TELEMETRY_VERBOSE;
    delete process.env.RESEARCH_TELEMETRY_PERSIST;
    registerTelemetryPersister(async () => {});
  });

  afterEach(() => {
    if (originalVerbose !== undefined) process.env.RESEARCH_TELEMETRY_VERBOSE = originalVerbose;
    if (originalPersist !== undefined) process.env.RESEARCH_TELEMETRY_PERSIST = originalPersist;
  });

  it('emits nothing when both flags are off', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emitTelemetry({ event: 'runner.start', runId: 'r1' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs JSON line when RESEARCH_TELEMETRY_VERBOSE=true', () => {
    process.env.RESEARCH_TELEMETRY_VERBOSE = 'true';
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emitTelemetry({
      event: 'runner.end',
      runId: 'r1',
      section: 'industryMarket',
      durationMs: 1234,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toMatch(/^\[telemetry\] /);
    const payload = JSON.parse(logged.replace('[telemetry] ', '')) as TelemetryEvent;
    expect(payload.event).toBe('runner.end');
    expect(payload.runId).toBe('r1');
    expect(payload.section).toBe('industryMarket');
    expect(payload.durationMs).toBe(1234);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    spy.mockRestore();
  });

  it('calls persister when RESEARCH_TELEMETRY_PERSIST=true', async () => {
    process.env.RESEARCH_TELEMETRY_PERSIST = 'true';
    const received: TelemetryEvent[] = [];
    registerTelemetryPersister(async (e) => {
      received.push(e);
    });
    emitTelemetry({ event: 'card.write', runId: 'r2', card: 'opportunity' });
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
    expect(received[0]?.event).toBe('card.write');
    expect(received[0]?.card).toBe('opportunity');
  });

  it('never throws when persister rejects', async () => {
    process.env.RESEARCH_TELEMETRY_PERSIST = 'true';
    registerTelemetryPersister(async () => {
      throw new Error('db down');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      emitTelemetry({ event: 'runner.error', runId: 'r3' }),
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('maps usage fields into flat tokens', () => {
    process.env.RESEARCH_TELEMETRY_VERBOSE = 'true';
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    emitTelemetry({
      event: 'runner.end',
      runId: 'r4',
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 350,
        cacheCreationInputTokens: 25,
        cacheReadInputTokens: 25,
      },
    });
    const payload = JSON.parse(
      (spy.mock.calls[0][0] as string).replace('[telemetry] ', ''),
    ) as TelemetryEvent;
    expect(payload.inputTokens).toBe(100);
    expect(payload.outputTokens).toBe(200);
    expect(payload.cacheCreationTokens).toBe(25);
    expect(payload.cacheReadTokens).toBe(25);
    spy.mockRestore();
  });
});

describe('withTelemetry', () => {
  beforeEach(() => {
    process.env.RESEARCH_TELEMETRY_VERBOSE = 'true';
    registerTelemetryPersister(async () => {});
  });

  afterEach(() => {
    delete process.env.RESEARCH_TELEMETRY_VERBOSE;
  });

  it('emits start + end on success', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await withTelemetry(
      'card.synthesize.start',
      'card.synthesize.end',
      'card.error',
      { runId: 'r5', card: 'opportunity' },
      async () => 'ok',
    );
    expect(result).toBe('ok');
    const events = spy.mock.calls.map((c) => {
      const raw = (c[0] as string).replace('[telemetry] ', '');
      return (JSON.parse(raw) as TelemetryEvent).event;
    });
    expect(events).toEqual(['card.synthesize.start', 'card.synthesize.end']);
    spy.mockRestore();
  });

  it('emits start + error and rethrows on throw', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      withTelemetry(
        'card.synthesize.start',
        'card.synthesize.end',
        'card.error',
        { runId: 'r6', card: 'opportunity' },
        async () => {
          throw new Error('boom');
        },
      ),
    ).rejects.toThrow('boom');
    const events = spy.mock.calls.map((c) => {
      const raw = (c[0] as string).replace('[telemetry] ', '');
      return (JSON.parse(raw) as TelemetryEvent).event;
    });
    expect(events).toEqual(['card.synthesize.start', 'card.error']);
    spy.mockRestore();
  });
});
