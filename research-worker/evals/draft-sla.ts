import {
  runPositioningAuditOrchestrator,
  type ChildRow,
  type OrchestratorDeps,
  type SectionRunResult,
} from '../src/runners/positioning-audit-orchestrator';
import type { SectionRuntimeTimings } from '../src/runners/section-phase';
import { printRows, type EvalRow } from './draft-eval-utils';

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeChildren(): ChildRow[] {
  return ZONES.map((zone, index) => ({
    section_run_id: `eval-run-${index + 1}`,
    zone,
    status: 'queued',
  }));
}

function elapsed(start: string | undefined, end: string | undefined): number {
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

async function runHappyPath(): Promise<{
  rows: EvalRow[];
  allSixMs: number;
  commits: number;
}> {
  const children = makeChildren();
  const timingsByRun = new Map<string, SectionRuntimeTimings>();
  let commits = 0;
  const startedAt = Date.now();

  const deps: OrchestratorDeps = {
    loadChildren: async () => children,
    buildSectionContext: async ({ zone }) => ({
      context: `SECTION_CONTEXT_PACK ${zone}`,
      capabilityGaps: [],
      toolBudget: DEFAULT_TOOL_BUDGET,
    }),
    updatePhase: async ({ sectionRunId, runtimeTimings }) => {
      if (runtimeTimings) timingsByRun.set(sectionRunId, runtimeTimings);
    },
    markChildRunning: async () => undefined,
    markChildTerminal: async () => undefined,
    runSection: async ({ onProgress }) => {
      await delay(5);
      await onProgress('partial', {
        event: { meta: { status: 'drafting', textPreview: 'draft started' } },
      });
      await delay(10);
      await onProgress('partial', {
        event: { meta: { status: 'complete', textPreview: 'draft complete' } },
      });
      return {
        status: 'complete',
        markdown: 'draft markdown',
        title: 'Draft',
        data: { artifactLayer: 'draft' },
        claims: [],
        sources: [],
      } satisfies SectionRunResult;
    },
    commitSection: async () => {
      commits += 1;
      await delay(1);
    },
    emitEvent: async () => undefined,
    rollupParent: async () => undefined,
    isParentAborted: async () => false,
  };

  await runPositioningAuditOrchestrator(
    {
      parentAuditRunId: 'eval-parent',
      executionMode: 'draft',
    },
    deps,
  );

  const allSixMs = Date.now() - startedAt;
  const rows = children.map((child) => {
    const timings = timingsByRun.get(child.section_run_id) ?? {};
    const firstPartialMs = elapsed(timings.sectionStartedAt, timings.firstPartialAt);
    const finalObjectMs = elapsed(timings.sectionStartedAt, timings.finalObjectAt);
    const commitMs = elapsed(timings.commitStartedAt, timings.commitCompleteAt);
    return {
      fixture: child.zone,
      model: 'fixture-draft',
      firstPartialMs,
      finalObjectMs,
      commitMs,
      allSixMs,
      qualityScore: 100,
      passed:
        firstPartialMs < 15_000 &&
        finalObjectMs < 90_000 &&
        allSixMs < 180_000 &&
        commitMs < 10_000,
    };
  });

  return { rows, allSixMs, commits };
}

async function runTimeoutPath(): Promise<{
  timeoutTerminalWriteMs: number;
  commits: number;
  passed: boolean;
}> {
  const child: ChildRow = {
    section_run_id: 'timeout-run-1',
    zone: 'positioningMarketCategory',
    status: 'queued',
  };
  let commits = 0;
  let terminalTimings: SectionRuntimeTimings = {};
  const deps: OrchestratorDeps = {
    loadChildren: async () => [child],
    buildSectionContext: async () => ({
      context: 'SECTION_CONTEXT_PACK timeout',
      capabilityGaps: [],
      toolBudget: DEFAULT_TOOL_BUDGET,
    }),
    updatePhase: async ({ runtimeTimings }) => {
      if (runtimeTimings) terminalTimings = runtimeTimings;
    },
    markChildRunning: async () => undefined,
    markChildTerminal: async () => undefined,
    runSection: async () =>
      await new Promise<SectionRunResult>(() => {
        // The SLA gate verifies the orchestrator abort race, not this promise.
      }),
    commitSection: async () => {
      commits += 1;
    },
    emitEvent: async () => undefined,
    rollupParent: async () => undefined,
    isParentAborted: async () => false,
  };

  await runPositioningAuditOrchestrator(
    {
      parentAuditRunId: 'timeout-parent',
      executionMode: 'draft',
      sectionTimeoutMs: 25,
    },
    deps,
  );

  const timeoutTerminalWriteMs = elapsed(
    terminalTimings.timeoutFiredAt,
    terminalTimings.terminalStatusWrittenAt,
  );
  return {
    timeoutTerminalWriteMs,
    commits,
    passed: timeoutTerminalWriteMs < 10_000 && commits === 0,
  };
}

export async function runDraftSlaEval(): Promise<boolean> {
  const happy = await runHappyPath();
  const timeout = await runTimeoutPath();
  printRows('Draft SLA Eval', happy.rows);
  console.log(`all six wall time: ${happy.allSixMs}ms`);
  console.log(`timeout terminal write: ${timeout.timeoutTerminalWriteMs}ms`);
  console.log(`post-timeout commits: ${timeout.commits}`);
  const passed =
    happy.rows.every((row) => row.passed) &&
    happy.commits === 6 &&
    timeout.passed;
  console.log(`draft SLA verdict: ${passed ? 'PASS' : 'FAIL'}`);
  return passed;
}

void runDraftSlaEval().then((passed) => {
  if (!passed) process.exitCode = 1;
});
