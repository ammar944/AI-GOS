import { describe, expect, it } from 'vitest';

import { ALL_ACTIVITY_PHASES } from '@/components/research-v2/activity-rail';
import type { CollapsedResearchJobUpdate } from '@/lib/journey/research-job-activity-core';

import { mapCorpusUpdatesToSteps } from '../corpus-activity';

const RAW_MARKERS = ['outputSummary', '"code"', 'issues', 'body.'];
const EMOJI_MARKERS = ['🔍', '🧠', '💭', '📄', '⏱', '✗'];

function update(
  partial: Partial<CollapsedResearchJobUpdate> &
    Pick<CollapsedResearchJobUpdate, 'phase' | 'message'>,
): CollapsedResearchJobUpdate {
  return {
    at: '2026-06-01T12:00:00.000Z',
    id: 'update-1',
    count: 1,
    ...partial,
  };
}

function assertNoLeak(steps: ReturnType<typeof mapCorpusUpdatesToSteps>['steps']): void {
  const serialized = JSON.stringify(steps);
  for (const marker of RAW_MARKERS) {
    expect(serialized).not.toContain(marker);
  }
  for (const emoji of EMOJI_MARKERS) {
    expect(serialized).not.toContain(emoji);
  }
}

describe('mapCorpusUpdatesToSteps', () => {
  it('maps each ResearchJobUpdate phase to ActivityPhase', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'runner', message: 'worker accepted research job' }),
      update({ id: '2', phase: 'tool', message: 'b2b saas pricing' }),
      update({ id: '3', phase: 'analysis', message: 'synthesizing overview' }),
      update({ id: '4', phase: 'thinking', message: 'drafting narrative' }),
      update({ id: '5', phase: 'artifact', message: 'artifact saved' }),
      update({ id: '6', phase: 'output', message: 'output ready' }),
    ]);

    expect(steps.map((step) => step.phase)).toEqual([
      'preparing',
      'searching',
      'checking',
      'drafting',
      'committing',
      'committing',
    ]);
    assertNoLeak(steps);
  });

  it('drops heartbeat updates', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'runner', message: 'starting' }),
      update({ id: '2', phase: 'heartbeat', message: 'still alive' }),
      update({ id: '3', phase: 'tool', message: 'searching' }),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.phase)).toEqual(['preparing', 'searching']);
  });

  it('marks only the last step active and prior steps complete', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'runner', message: 'starting' }),
      update({ id: '2', phase: 'tool', message: 'query one' }),
      update({ id: '3', phase: 'analysis', message: 'checking' }),
    ]);

    expect(steps[0]?.status).toBe('complete');
    expect(steps[1]?.status).toBe('complete');
    expect(steps[2]?.status).toBe('active');
    expect(steps[2]?.tone).toBe('active');
  });

  it('emits a single error-toned step for error phase', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'error', message: 'Research failed unexpectedly' }),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.tone).toBe('error');
    expect(steps[0]?.status).toBe('active');
    assertNoLeak(steps);
  });

  it('rejects JSON-shaped tool messages as chips', () => {
    const rawJson = '[{"code":"invalid_type","path":["body.foo"]}]';
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'tool', message: rawJson }),
    ]);

    expect(steps[0]?.chips).toBeUndefined();
    expect(JSON.stringify(steps[0])).not.toContain(rawJson);
  });

  it('carries a clean short tool message as a chip', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({ id: '1', phase: 'tool', message: 'b2b saas pricing' }),
    ]);

    expect(steps[0]?.chips).toEqual(['b2b saas pricing']);
  });

  it('returns empty steps and a default label for empty input', () => {
    const { steps, currentLabel } = mapCorpusUpdatesToSteps([]);

    expect(steps).toEqual([]);
    expect(currentLabel).toBe('Researching live sources…');
  });

  it('never surfaces jargon substrings in labels', () => {
    const { steps } = mapCorpusUpdatesToSteps([
      update({
        id: '1',
        phase: 'analysis',
        message: 'validation failed for unsupported repair payload',
      }),
    ]);

    const serialized = JSON.stringify(steps);
    expect(serialized).not.toMatch(/repair|unsupported|validation/i);
    assertNoLeak(steps);
  });
});

describe('ALL_ACTIVITY_PHASES', () => {
  it('lists every non-done product phase for the rail', () => {
    expect(ALL_ACTIVITY_PHASES).toHaveLength(6);
    expect(ALL_ACTIVITY_PHASES).not.toContain('done');
  });
});
