import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testing__,
  runPositioningAuditOrchestrator,
  type ChildRow,
  type OrchestratorDeps,
  type SectionRunResult,
} from '../positioning-audit-orchestrator';

const ZONES = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
] as const;

const DEFAULT_TOOL_BUDGET = {
  maxExternalLookups: 2,
  allowedTools: ['web_search'],
};

function makeChildren(): ChildRow[] {
  return ZONES.map((zone, i) => ({
    section_run_id: `run-${i + 1}`,
    zone,
    status: 'queued',
  }));
}

interface DepRecorder {
  deps: OrchestratorDeps;
  emitted: Array<{ section_run_id: string; type: string }>;
  contexts: Array<{ section_run_id: string; zone: string; context: string }>;
  phases: Array<{ section_run_id: string; phase: string }>;
  childStatus: Map<string, string>;
  parentStatus: { status: string; children_complete: number } | null;
  runningAtCheck: number[];
  commits: number;
}

function makeRecorder(opts: {
  children?: ChildRow[];
  runSection?: OrchestratorDeps['runSection'];
  buildSectionContext?: OrchestratorDeps['buildSectionContext'];
  isParentAborted?: () => Promise<boolean>;
} = {}): DepRecorder {
  const children = opts.children ?? makeChildren();
  const emitted: Array<{ section_run_id: string; type: string }> = [];
  const contexts: DepRecorder['contexts'] = [];
  const phases: DepRecorder['phases'] = [];
  const childStatus = new Map<string, string>();
  let parentStatus: DepRecorder['parentStatus'] = null;
  let running = 0;
  const runningAtCheck: number[] = [];
  let commits = 0;

  const defaultRunSection: OrchestratorDeps['runSection'] = async ({
    sectionRunId,
    zone,
    context,
    onProgress,
  }) => {
    contexts.push({ section_run_id: sectionRunId, zone, context });
    running += 1;
    runningAtCheck.push(running);
    await onProgress('searching', { query: 'demo' });
    await new Promise((r) => setTimeout(r, 5));
    running -= 1;
    return {
      status: 'complete',
      markdown: 'hello',
      claims: [],
      sources: [],
    } satisfies SectionRunResult;
  };

  const recorder: DepRecorder = {
    emitted,
    contexts,
    phases,
    childStatus,
    parentStatus,
    runningAtCheck,
    commits,
    deps: {
      loadChildren: async () => children,
      buildSectionContext:
        opts.buildSectionContext ??
        (async ({ zone }) => ({
          context: `context:${zone}`,
          capabilityGaps: [],
          toolBudget: DEFAULT_TOOL_BUDGET,
        })),
      updatePhase: async ({ sectionRunId, phase }) => {
        phases.push({ section_run_id: sectionRunId, phase });
      },
      markChildRunning: async (id) => {
        childStatus.set(id, 'running');
      },
      markChildTerminal: async (id, status) => {
        childStatus.set(id, status);
      },
      runSection: opts.runSection ?? defaultRunSection,
      commitSection: async ({ signal }) => {
        if (signal.aborted) throw new Error('aborted before commit');
        commits += 1;
        recorder.commits = commits;
      },
      emitEvent: async ({ sectionRunId, type }) => {
        emitted.push({ section_run_id: sectionRunId, type });
      },
      rollupParent: async ({ status, children_complete }) => {
        recorder.parentStatus = { status, children_complete };
      },
      isParentAborted: opts.isParentAborted ?? (async () => false),
    },
  };
  return recorder;
}

describe('rollupStatus', () => {
  const r = __testing__.rollupStatus;
  it('returns complete when all children completed', () => {
    expect(r(false, ['complete', 'complete', 'complete'])).toBe('complete');
  });
  it('returns error when all children errored', () => {
    expect(r(false, ['error', 'error'])).toBe('error');
  });
  it('returns partial on a mix of complete + error', () => {
    expect(r(false, ['complete', 'error', 'complete'])).toBe('partial');
  });
  it('returns aborted when only aborts and no completes/errors', () => {
    expect(r(false, ['aborted', 'aborted'])).toBe('aborted');
  });
  it('returns aborted when parent abort flag is set regardless of mix', () => {
    expect(r(true, ['complete', 'complete'])).toBe('aborted');
  });
});

describe('runPositioningAuditOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs all six children to completion and rolls up to complete', async () => {
    const r = makeRecorder();
    const result = await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 3 },
      r.deps,
    );
    expect(result.status).toBe('complete');
    expect(result.per_child).toHaveLength(6);
    expect(result.per_child.every((c) => c.status === 'complete')).toBe(true);
    expect(r.parentStatus?.status).toBe('complete');
    expect(r.parentStatus?.children_complete).toBe(6);
    expect(r.commits).toBe(6);
  });

  it('bounds concurrency by the configured limit (default 3)', async () => {
    let running = 0;
    let peak = 0;
    const slow: OrchestratorDeps['runSection'] = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((res) => setTimeout(res, 20));
      running -= 1;
      return { status: 'complete' };
    };
    const r = makeRecorder({ runSection: slow });
    const promise = runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 3 },
      r.deps,
    );
    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThanOrEqual(1);
  });

  it('emits started / searching / complete events in order per child', async () => {
    const r = makeRecorder({
      children: [
        { section_run_id: 'run-1', zone: 'positioningMarketCategory', status: 'queued' },
      ],
    });
    await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );
    const seq = r.emitted.map((e) => e.type);
    expect(seq).toEqual(['started', 'searching', 'complete']);
  });

  it('passes distinct Section Context Pack strings into each child run', async () => {
    const r = makeRecorder({
      buildSectionContext: async ({ zone }) => ({
        context: `SECTION_CONTEXT_PACK:${zone}`,
        capabilityGaps: [],
        toolBudget: DEFAULT_TOOL_BUDGET,
      }),
    });

    await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 6 },
      r.deps,
    );

    expect(r.contexts).toHaveLength(6);
    expect(new Set(r.contexts.map((entry) => entry.context)).size).toBe(6);
    expect(r.contexts[0]?.context).toBe('SECTION_CONTEXT_PACK:positioningMarketCategory');
  });

  it('writes phase transitions in order for a successful section', async () => {
    const r = makeRecorder({
      children: [
        { section_run_id: 'run-1', zone: 'positioningMarketCategory', status: 'queued' },
      ],
      runSection: async ({ sectionRunId, zone, context, onProgress }) => {
        r.contexts.push({ section_run_id: sectionRunId, zone, context });
        await onProgress('searching', {
          event: { meta: { toolNames: ['web_search'], textPreview: 'reading source' } },
        });
        await onProgress('partial', {
          event: { meta: { status: 'drafting' } },
        });
        await onProgress('partial', {
          event: { meta: { status: 'validating' } },
        });
        return { status: 'complete' };
      },
    });

    await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );

    expect(r.phases.map((entry) => entry.phase)).toEqual([
      'Queued',
      'Compiling context',
      'Reading sources',
      'Drafting',
      'Validating',
      'Committed',
    ]);
  });

  it('marks a completed section as Needs review when the pack has capability gaps', async () => {
    const r = makeRecorder({
      children: [
        { section_run_id: 'run-1', zone: 'positioningCompetitorLandscape', status: 'queued' },
      ],
      buildSectionContext: async ({ zone }) => ({
        context: `SECTION_CONTEXT_PACK:${zone}`,
        capabilityGaps: [{ tool: 'spyfu', reason: 'missing', impact: 'no spend data' }],
        toolBudget: DEFAULT_TOOL_BUDGET,
      }),
    });

    await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );

    expect(r.phases.at(-1)?.phase).toBe('Needs review');
  });

  it('isolates abort to one child without aborting siblings (no parent abort)', async () => {
    const aborted = { 'run-2': true } as Record<string, boolean>;
    const runSection: OrchestratorDeps['runSection'] = async ({
      sectionRunId,
      signal,
    }) => {
      if (aborted[sectionRunId]) {
        const err = new Error('aborted-by-test');
        signal.dispatchEvent?.(new Event('abort'));
        throw err;
      }
      return { status: 'complete' };
    };
    const r = makeRecorder({ runSection });
    const result = await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 6 },
      r.deps,
    );
    expect(result.status).toBe('partial');
    expect(result.per_child.filter((c) => c.status === 'complete')).toHaveLength(5);
    expect(result.per_child.filter((c) => c.status === 'error')).toHaveLength(1);
  });

  it('rolls up to partial when one section throws (crash → partial)', async () => {
    let calls = 0;
    const flaky: OrchestratorDeps['runSection'] = async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return { status: 'complete' };
    };
    const r = makeRecorder({ runSection: flaky });
    const result = await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );
    expect(result.status).toBe('partial');
    expect(r.parentStatus?.status).toBe('partial');
    expect(r.parentStatus?.children_complete).toBe(5);
  });

  it('cooperatively aborts in-flight children when the parent abort signal fires', async () => {
    const controller = new AbortController();
    const r = makeRecorder({
      isParentAborted: async () => controller.signal.aborted,
      runSection: async ({ signal }) => {
        await new Promise((resolve, reject) => {
          const onAbort = () => reject(new Error('aborted-by-parent'));
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort);
          setTimeout(() => resolve(undefined), 50);
        });
        return { status: 'complete' };
      },
    });
    const promise = runPositioningAuditOrchestrator(
      {
        parentAuditRunId: 'p1',
        concurrency: 6,
        parentAbortSignal: controller.signal,
      },
      r.deps,
    );
    setTimeout(() => controller.abort(), 5);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result.status).toBe('aborted');
  });

  it('skips already-terminal children and includes them in the rollup', async () => {
    const children: ChildRow[] = [
      { section_run_id: 'run-1', zone: 'positioningMarketCategory', status: 'complete' },
      { section_run_id: 'run-2', zone: 'positioningBuyerICP', status: 'queued' },
    ];
    const r = makeRecorder({ children });
    const result = await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );
    expect(result.status).toBe('complete');
    expect(r.commits).toBe(1);
    expect(r.parentStatus?.children_complete).toBe(2);
  });

  it('defaults initial orchestration to draft mode', async () => {
    const seenModes: string[] = [];
    const r = makeRecorder({
      children: [
        { section_run_id: 'run-1', zone: 'positioningMarketCategory', status: 'queued' },
      ],
      runSection: async ({ executionMode }) => {
        seenModes.push(executionMode);
        return { status: 'complete' };
      },
    });

    await runPositioningAuditOrchestrator(
      { parentAuditRunId: 'p1', concurrency: 1 },
      r.deps,
    );

    expect(seenModes).toEqual(['draft']);
  });

  it('runs only the requested zone when a zone filter is provided', async () => {
    const r = makeRecorder();

    await runPositioningAuditOrchestrator(
      {
        parentAuditRunId: 'p1',
        concurrency: 6,
        zones: ['positioningVoiceOfCustomer'],
        executionMode: 'deep',
      },
      r.deps,
    );

    expect(r.contexts).toHaveLength(1);
    expect(r.contexts[0]?.zone).toBe('positioningVoiceOfCustomer');
  });

  it('prevents commit when the section timeout fires before commit', async () => {
    const r = makeRecorder({
      children: [
        { section_run_id: 'run-1', zone: 'positioningMarketCategory', status: 'queued' },
      ],
      runSection: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { status: 'complete' };
      },
    });
    const promise = runPositioningAuditOrchestrator(
      {
        parentAuditRunId: 'p1',
        concurrency: 1,
        sectionTimeoutMs: 5,
      },
      r.deps,
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result.status).toBe('error');
    expect(r.commits).toBe(0);
    expect(r.phases.at(-1)?.phase).toBe('Needs review');
  });
});
