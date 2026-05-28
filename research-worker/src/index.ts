import './env';
import express from 'express';
import {
  resolveProductIdentity,
  runMeetingExtraction,
  runDeepResearchProgram,
} from './runners';
import {
  writeResearchResult,
  writeJobStatus,
  getClient,
} from './supabase';
import { createEmitProgress } from './emit-progress';
import { writeDeadLetter } from './dead-letter';
import { sanitizeForJson, type RunnerProgressReporter } from './runner';
import { TOOL_SECTION_MAP } from './section-map';
import { authorizeWorkerRequest } from './auth';
import { extractWikiEntries, writeWikiEntries } from './wiki';
import { workerBus } from './events';
import { dispatchIntelligenceCards } from './intelligence/dispatcher';
import { emitTelemetry } from './telemetry';
import { getAnthropicSkillsRuntimeStatus } from './anthropic-skills';
import { createSemaphore } from './utils/semaphore';
import { buildCapabilitiesPayload } from './capabilities';
import { renderBaselineMetricsBlock, type BaselineMetrics } from './baseline-metrics';
import type { ResearchResult } from './supabase';
import pkg from '../package.json';

const WORKER_VERSION: string =
  typeof pkg.version === 'string' ? pkg.version : 'unknown';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// -- Concurrency cap ----------------------------------------------------------
// Keep concurrent /run executions bounded so worker jobs don't thunder external
// APIs. Overridable via WORKER_RUN_CONCURRENCY.
const WORKER_RUN_CONCURRENCY = Number(process.env.WORKER_RUN_CONCURRENCY ?? 6);
const runSemaphore = createSemaphore(WORKER_RUN_CONCURRENCY);

app.use(express.json({ limit: '1mb' }));

// -- Auth middleware -----------------------------------------------------------
function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const decision = authorizeWorkerRequest({
    authHeader: req.headers.authorization as string | undefined,
    environment: process.env.NODE_ENV,
    expectedKey: process.env.RAILWAY_API_KEY,
    forwardedFor: req.headers['x-forwarded-for'] as string | undefined,
    host: req.hostname,
    ip: req.ip,
    remoteAddress: req.socket?.remoteAddress,
  });

  if (!decision.authorized) {
    console.warn(`[auth] Rejected request: ${decision.reason}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (decision.reason !== 'matched-key') {
    console.info(`[auth] Authorized via ${decision.reason}`);
  }

  next();
}

// -- Types --------------------------------------------------------------------
type ToolName =
  | 'runDeepResearchProgram'
  | 'resolveIdentity'
  | 'extractMeetingTranscript';

interface RunJobRequest {
  tool: ToolName;
  context: string;
  userId: string;
  jobId: string;
  runId?: string;
  /**
   * Optional baseline metrics forwarded by the dispatch layer. When present,
   * a BASELINE METRICS DATA INTEGRITY block is rendered into the runner's
   * context so the model cannot fabricate LTV/CAC/growth claims. When absent,
   * the block renders with all NOT PROVIDED values, which forces runners to
   * emit insufficient-data states for any computation that needs the data.
   */
  baselineMetrics?: BaselineMetrics;
  /**
   * Optional document ID for meeting extraction. When present and tool is
   * 'extractMeetingTranscript', the extracted fields are written back to
   * business_profile_documents and the meeting status is updated.
   */
  documentId?: string;
  chatRefinement?: string;
}

const TOOL_RUNNERS: Record<
  ToolName,
  (
    context: string,
    onProgress?: RunnerProgressReporter,
    chatRefinement?: string,
    abortSignal?: AbortSignal,
  ) => Promise<ResearchResult>
> = {
  runDeepResearchProgram,
  resolveIdentity: resolveProductIdentity,
  extractMeetingTranscript: runMeetingExtraction,
};

// ---------------------------------------------------------------------------
// Abort infrastructure.
// ---------------------------------------------------------------------------
const abortControllers = new Map<string, AbortController>();

// -- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/capabilities', (_req, res) => {
  res.json(
    buildCapabilitiesPayload({
      env: process.env,
      workerVersion: WORKER_VERSION,
      orchestrateSupported: false,
    }),
  );
});

// -- Active job tracking (for stale detection) --------------------------------
const activeJobs = new Map<
  string,
  {
    tool: string;
    userId: string;
    startedAt: number;
    runId?: string;
  }
>();

// -- Run ----------------------------------------------------------------------
app.post('/run', requireApiKey, async (req: express.Request, res: express.Response) => {
  // Cap concurrent /run executions. Release fires either on early-return
  // (400 validation) or from the detached async's `finally` once the runner
  // settles, so the slot is bounded by actual runner work — not just the
  // synchronous setup phase before the 202 response.
  const releaseSlot = await runSemaphore.acquire();
  const { tool, context, userId, jobId, runId, baselineMetrics, documentId, chatRefinement } = req.body as RunJobRequest;

  if (!tool || !context || !userId || !jobId) {
    releaseSlot();
    res.status(400).json({ error: 'tool, context, userId, jobId are required' });
    return;
  }

  const runner = TOOL_RUNNERS[tool];
  if (!runner) {
    releaseSlot();
    res.status(400).json({ error: `Unknown tool: ${tool}` });
    return;
  }

  const startMs = Date.now();

  // Write job status to Supabase BEFORE returning 202.
  // If the process crashes after this point, the row stays as 'running'
  // — detectable rather than silently lost.
  try {
    await writeJobStatus(userId, jobId, {
      runId,
      status: 'running',
      tool,
      startedAt: new Date(startMs).toISOString(),
      updates: [
        {
          at: new Date(startMs).toISOString(),
          id: crypto.randomUUID(),
          message: 'research job started',
          phase: 'runner',
        },
      ],
    });
  } catch (statusErr) {
    // Non-fatal — log and proceed. Research is more important than status tracking.
    console.error(`[worker] writeJobStatus failed for ${jobId}:`, statusErr);
  }

  // Track active job for stale detection
  activeJobs.set(jobId, { tool, userId, startedAt: startMs, runId });

  // Return 202 now — job continues asynchronously in background
  res.status(202).json({ status: 'accepted', jobId });

  // Run the job in a detached async context. This is intentional — we've
  // already committed the job to Supabase above, so crashes are observable.
  void (async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);
    emitTelemetry({
      event: 'runner.start',
      runId: runId ?? jobId,
      userId,
      section: TOOL_SECTION_MAP[tool] ?? tool,
      extra: { tool, jobId },
    });

    // Inject current date into context so research models use up-to-date information.
    // Without this, models default to their training cutoff and return stale data.
    const now = new Date();
    const dateContext = `Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${now.getFullYear()}). Always search for and prioritize the most recent data available. Do not use outdated statistics or market data from prior years when current data exists.\n\n`;

    // Inject the baseline-metrics integrity block. This appears in every
    // runner's context (not just synthesize/icp/media-plan) — runners that
    // don't generate LTV/CAC/growth claims simply ignore it. Runners that do
    // are constrained by the block to either use the user's reported numbers
    // or emit explicit insufficient-data states. This is the production-side
    // anchor for the research-fabrication fix.
    const baselineBlock = `${renderBaselineMetricsBlock(baselineMetrics)}\n\n`;

    // Provenance tracking instruction — tells every runner to tag data sources.
    const provenanceInstruction = `SOURCE TRACKING: Include a "_provenance" array in your JSON output. For each significant field, add: {"field": "dotPath", "source": "user_data|web_search|tool_output|template_default|ai_synthesis", "sourceDetail": "url or description", "confidence": 0-100}. Any number from reference/template data MUST be tagged "template_default".\n\n`;

    const contextWithDate = sanitizeForJson(dateContext + baselineBlock + provenanceInstruction + context);
    let statusWriteChain = Promise.resolve();
    let jobFinalized = false;

    const queueJobStatusWrite = (row: Parameters<typeof writeJobStatus>[2]) => {
      if (jobFinalized && row.status === 'running') {
        return statusWriteChain;
      }

      statusWriteChain = statusWriteChain
        .then(() => writeJobStatus(userId, jobId, row))
        .catch((err) => {
          console.warn(`[status] Failed to persist update for ${jobId}:`, err);
        });

      return statusWriteChain;
    };

    const { emitProgress } = createEmitProgress({
      queueWrite: queueJobStatusWrite,
      getJobFinalized: () => jobFinalized,
      runId,
      status: 'running',
      tool,
      startedAt: new Date(startMs).toISOString(),
    });

    const abortController = new AbortController();
    abortControllers.set(jobId, abortController);

    // Heartbeat: write 'running' status every 30s so the poller knows we're alive.
    // Includes an updates[] entry so the frontend activity log shows activity.
    const heartbeatInterval = setInterval(async () => {
      if (jobFinalized) {
        return;
      }
      const now = new Date().toISOString();
      await queueJobStatusWrite({
        runId,
        status: 'running',
        tool,
        startedAt: new Date(startMs).toISOString(),
        lastHeartbeat: now,
        updates: [
          {
            at: now,
            id: crypto.randomUUID(),
            message: 'Still running…',
            phase: 'heartbeat',
          },
        ],
      });
    }, 30_000);

    try {
      await emitProgress({
        message: 'launching research analysis',
        phase: 'runner',
      });
      const runnerStartMs = Date.now();
      const result = await runner(
        contextWithDate,
        emitProgress,
        chatRefinement,
        abortController.signal,
      );
      const runnerDurationMs = Date.now() - runnerStartMs;
      console.log(`[timing] ${tool} runner completed in ${(runnerDurationMs / 1000).toFixed(1)}s`);
      emitTelemetry({
        event: result.status === 'complete' ? 'runner.end' : 'runner.error',
        runId: runId ?? jobId,
        userId,
        section: result.section,
        durationMs: runnerDurationMs,
        model: result.telemetry?.model,
        usage: result.telemetry?.usage,
        estimatedCostUsd: result.telemetry?.estimatedCostUsd,
        errorMessage: result.status === 'complete' ? undefined : result.error,
        extra: { tool, stopReason: result.telemetry?.stopReason },
      });

      // Compression disabled — raw runner data flows through to Supabase
      // so artifact-panel.tsx and research-inline-card.tsx can render
      // structured fields (categorySnapshot, marketDynamics, etc.) directly.
      // See: compress.ts transforms data into CompressedSummary shape which
      // has zero overlap with what the frontend renderers expect.
      if (result.status === 'complete' && result.data) {
        const rawLength = JSON.stringify(result.data).length;
        console.log(`[${tool}] Raw data: ${rawLength} chars (compression bypassed)`);
      }

      await emitProgress({
        message:
          result.status === 'complete'
            ? 'writing completed artifact to Journey'
            : 'writing research error state to Journey',
        phase: result.status === 'complete' ? 'output' : 'error',
      });

      try {
        await writeResearchResult(userId, result.section, {
          ...result,
          runId,
        });
      } catch (writeError) {
        console.error(
          `[worker] writeResearchResult failed after retries for ${result.section}:`,
          writeError,
        );
        writeDeadLetter(userId, result.section, result, String(writeError));
      }

      // Write structured wiki entries for downstream runner context sharing.
      // Non-fatal — wiki is an enhancement layer, not critical path.
      if (result.status === 'complete' && result.data && runId) {
        try {
          const wikiEntries = extractWikiEntries(result.section, result.data);
          if (wikiEntries.length > 0) {
            await writeWikiEntries(userId, runId, wikiEntries);

            // Phase 7.1 — emit so the intelligence dispatcher can fan out
            // cards for any section the wiki write unlocks. Listeners run
            // via setImmediate, so this emit does not block the worker.
            workerBus.emit('wiki:section-complete', {
              userId,
              runId,
              section: result.section,
              entries: wikiEntries,
            });
          }
        } catch (wikiErr) {
          console.warn(`[wiki] Non-fatal wiki write failure for ${result.section}:`, wikiErr);
        }
      }

      // For meeting extraction: write extracted fields back to business_profile_documents
      // and update the meeting status to 'ready'.
      if (tool === 'extractMeetingTranscript' && documentId && result.status === 'complete' && result.data) {
        try {
          const adminClient = getClient();
          await adminClient
            .from('business_profile_documents')
            .update({ extracted_fields: result.data })
            .eq('id', documentId);

          await adminClient.rpc('update_meeting_status_by_document', {
            p_user_id: userId,
            p_run_id: runId ?? '',
            p_document_id: documentId,
            p_status: 'ready',
          });
          console.log(`[worker] Updated extracted_fields for meeting doc ${documentId}`);
        } catch (writeBackErr) {
          console.error(`[worker] Failed to write back meeting extraction for doc ${documentId}:`, writeBackErr);
        }
      }
      jobFinalized = true;
      clearInterval(heartbeatInterval);
      await queueJobStatusWrite({
        runId,
        status: result.status === 'complete' ? 'complete' : 'error',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
        error: result.status === 'complete' ? undefined : result.error,
        telemetry: result.telemetry,
        updates: [
          {
            at: new Date().toISOString(),
            id: crypto.randomUUID(),
            message:
              result.status === 'complete'
                ? 'research complete'
                : result.error ?? 'research failed validation',
            phase: result.status === 'complete' ? 'output' : 'error',
          },
        ],
      });
      console.log(
        `[worker] ${result.status === 'complete' ? 'Completed' : 'Recorded error for'} ${tool} for user ${userId} in ${result.durationMs}ms`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Unhandled error in ${tool}:`, error);
      const section = TOOL_SECTION_MAP[tool] ?? tool;
      const errorDurationMs = Date.now() - startMs;
      emitTelemetry({
        event: 'runner.error',
        runId: runId ?? jobId,
        userId,
        section,
        durationMs: errorDurationMs,
        errorMessage: errorMsg,
        extra: { tool, unhandled: true },
      });
      const errorResult = {
        runId,
        status: 'error' as const,
        section,
        error: errorMsg,
        durationMs: errorDurationMs,
      };
      try {
        await writeResearchResult(userId, section, errorResult);
      } catch (writeError) {
        console.error(
          `[worker] writeResearchResult failed after retries for ${section}:`,
          writeError,
        );
        writeDeadLetter(userId, section, errorResult, String(writeError));
      }
      jobFinalized = true;
      clearInterval(heartbeatInterval);
      await queueJobStatusWrite({
        runId,
        status: 'error',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
        error: errorMsg,
        updates: [
          {
            at: new Date().toISOString(),
            id: crypto.randomUUID(),
            message: errorMsg,
            phase: 'error',
          },
        ],
      });
    } finally {
      clearInterval(heartbeatInterval);
      activeJobs.delete(jobId);
      abortControllers.delete(jobId);
    }
  })().finally(releaseSlot);
});

// -- Abort --------------------------------------------------------------------
//
// Accepts { sectionRunId } or { jobId }. Calls .abort() on the matching
// AbortController if one exists, writes aborted_at to research_section_runs
// (idempotent), and returns 200. Unknown keys also return 200 — repeated
// aborts after a run already settled are no-ops.
app.post('/abort', requireApiKey, async (req: express.Request, res: express.Response) => {
  const { sectionRunId, jobId } = req.body as {
    sectionRunId?: string;
    jobId?: string;
  };

  if (!sectionRunId && !jobId) {
    res.status(400).json({ error: 'sectionRunId or jobId is required' });
    return;
  }

  let controllerKey: string | null = null;
  if (sectionRunId && abortControllers.has(sectionRunId)) {
    controllerKey = sectionRunId;
  } else if (jobId && abortControllers.has(jobId)) {
    controllerKey = jobId;
  }

  if (controllerKey) {
    const controller = abortControllers.get(controllerKey);
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error('aborted via /abort route'));
    }
  }

  const targetSectionRunId = sectionRunId ?? null;

  if (targetSectionRunId) {
    try {
      const supabase = getClient();
      // P2 fix — only stamp aborted_at on still-running rows. A terminal
      // row (complete/error/partial) should never be re-marked as aborted.
      await supabase
        .from('research_section_runs')
        .update({ aborted_at: new Date().toISOString() })
        .eq('id', targetSectionRunId)
        .eq('status', 'running')
        .is('aborted_at', null);
    } catch (writeErr) {
      console.warn('[abort] aborted_at write failed:', writeErr);
    }
  }

  res.json({
    ok: true,
    aborted: Boolean(controllerKey),
    sectionRunId: targetSectionRunId,
  });
});

// -- Stale-run reaper on boot -------------------------------------------------
//
// If the worker process was killed mid-run, research_section_runs rows are
// left in 'running' state with no live AbortController behind them. On boot,
// mark any running section_run older than STALE_RUN_THRESHOLD_MIN as
// 'error' with aborted_at=now() so the projector flips the zone to its error
// state and the user can retry. Idempotent — safe to run on every boot.
const STALE_RUN_THRESHOLD_MIN = Number(
  process.env.WORKER_STALE_RUN_THRESHOLD_MIN ?? 15,
);
async function reapOrphanedSectionRuns(): Promise<void> {
  try {
    const supabase = getClient();
    // Phase 5 P1 fix: call the RPC so both research_section_runs AND the
    // matching research_artifact_sections rows flip to 'error' atomically.
    // The projector reads the sections table — updating only the runs
    // table would leave the canvas stuck on a stale 'running' tile.
    const { data, error } = await supabase.rpc('reap_orphaned_section_runs', {
      p_threshold_minutes: STALE_RUN_THRESHOLD_MIN,
    });
    if (error) {
      console.warn('[reaper] failed:', error.message);
      return;
    }
    const reaped = typeof data === 'number' ? data : 0;
    if (reaped > 0) {
      console.log(`[reaper] Marked ${reaped} orphaned section_runs as error`);
    }
  } catch (err) {
    console.warn('[reaper] threw:', err);
  }
}

// -- Start --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
  void reapOrphanedSectionRuns();
});

// -- Stale job detection ------------------------------------------------------
const STALE_THRESHOLD_MS = 300_000; // 5 minutes

// Per-tool overrides
const TOOL_STALE_THRESHOLDS: Partial<Record<ToolName, number>> = {
  runDeepResearchProgram: 900_000, // company corpus extraction can run longer than global 5m
};

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    const threshold = TOOL_STALE_THRESHOLDS[job.tool as ToolName] ?? STALE_THRESHOLD_MS;
    if (now - job.startedAt > threshold) {
      console.error(`[stale-check] Job ${jobId} (${job.tool}) exceeded ${threshold / 1000}s — marking as error`);
      writeJobStatus(job.userId, jobId, {
        runId: job.runId,
        status: 'error',
        tool: job.tool,
        error: `timeout: job exceeded ${threshold / 1000}s`,
        startedAt: new Date(job.startedAt).toISOString(),
        completedAt: new Date().toISOString(),
      }).catch(err => console.error('[stale-check] writeJobStatus failed:', err));
      activeJobs.delete(jobId);
    }
  }
}, 60_000); // Check every 60s

export default app;
