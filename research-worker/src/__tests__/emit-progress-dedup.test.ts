import { describe, expect, it, vi } from 'vitest';
import { createEmitProgress } from '../emit-progress';

const BASE_OPTS = {
  runId: 'run-123',
  status: 'running' as const,
  tool: 'positioningMarketCategory',
  startedAt: '2026-01-01T00:00:00.000Z',
};

describe('createEmitProgress dedup logic', () => {
  it('passes through two calls with same phase+message but different ids', async () => {
    const queueWrite = vi.fn();
    let finalized = false;
    const { emitProgress } = createEmitProgress({
      ...BASE_OPTS,
      queueWrite,
      getJobFinalized: () => finalized,
    });

    await emitProgress({ phase: 'tool', message: 'searching: "market size"', id: 'id-1' });
    await emitProgress({ phase: 'tool', message: 'searching: "market size"', id: 'id-2' });

    expect(queueWrite).toHaveBeenCalledTimes(2);
  });

  it('deduplicates two calls with same phase+message+id (replay protection)', async () => {
    const queueWrite = vi.fn();
    let finalized = false;
    const { emitProgress } = createEmitProgress({
      ...BASE_OPTS,
      queueWrite,
      getJobFinalized: () => finalized,
    });

    await emitProgress({ phase: 'tool', message: 'searching: "market size"', id: 'id-same' });
    await emitProgress({ phase: 'tool', message: 'searching: "market size"', id: 'id-same' });

    expect(queueWrite).toHaveBeenCalledTimes(1);
  });

  it('always passes through artifact phase regardless of message and id', async () => {
    const queueWrite = vi.fn();
    let finalized = false;
    const { emitProgress } = createEmitProgress({
      ...BASE_OPTS,
      queueWrite,
      getJobFinalized: () => finalized,
    });

    await emitProgress({ phase: 'artifact', message: 'some artifact content', id: 'art-1' });
    await emitProgress({ phase: 'artifact', message: 'some artifact content', id: 'art-1' });

    expect(queueWrite).toHaveBeenCalledTimes(2);
  });
});
