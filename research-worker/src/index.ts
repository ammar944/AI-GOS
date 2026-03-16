import 'dotenv/config';
import express from 'express';
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
  runMediaPlan,
} from './runners';
import { writeResearchResult, writeJobStatus, type ResearchResult } from './supabase';
import { writeDeadLetter } from './dead-letter';
import type { RunnerProgressReporter } from './runner';
import { TOOL_SECTION_MAP } from './section-map';
import { authorizeWorkerRequest } from './auth';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

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
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords'
  | 'researchMediaPlan';

interface RunJobRequest {
  tool: ToolName;
  context: string;
  userId: string;
  jobId: string;
  runId?: string;
}

const TOOL_RUNNERS: Record<ToolName, (context: string, onProgress?: RunnerProgressReporter) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
  researchMediaPlan: runMediaPlan,
};

// -- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/capabilities', (_req, res) => {
  res.json({
    status: 'ok',
    tools: {
      webSearch: true,
      spyfu: Boolean(process.env.SPYFU_API_KEY),
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
      googleAds: Boolean(
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
          process.env.GOOGLE_ADS_CLIENT_ID &&
          process.env.GOOGLE_ADS_CLIENT_SECRET &&
          process.env.GOOGLE_ADS_REFRESH_TOKEN &&
          process.env.GOOGLE_ADS_CUSTOMER_ID,
      ),
      metaAds: Boolean(
        process.env.META_ACCESS_TOKEN && process.env.META_BUSINESS_ACCOUNT_ID,
      ),
      ga4: Boolean(
        process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_JSON,
      ),
      charting: true,
    },
  });
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
  const { tool, context, userId, jobId, runId } = req.body as RunJobRequest;

  if (!tool || !context || !userId || !jobId) {
    res.status(400).json({ error: 'tool, context, userId, jobId are required' });
    return;
  }

  const runner = TOOL_RUNNERS[tool];
  if (!runner) {
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
          message: 'worker accepted research job',
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
    let statusWriteChain = Promise.resolve();
    let lastProgressSignature: string | null = null;
    let jobFinalized = false;

    const queueJobStatusWrite = (row: Parameters<typeof writeJobStatus>[2]) => {
      statusWriteChain = statusWriteChain
        .then(() => writeJobStatus(userId, jobId, row))
        .catch((err) => {
          console.warn(`[status] Failed to persist update for ${jobId}:`, err);
        });

      return statusWriteChain;
    };

    const emitProgress: RunnerProgressReporter = async (update) => {
      const signature = `${update.phase}:${update.message}`;
      if (signature === lastProgressSignature) {
        return;
      }
      lastProgressSignature = signature;

      await queueJobStatusWrite({
        runId,
        status: 'running',
        tool,
        startedAt: new Date(startMs).toISOString(),
        lastHeartbeat: new Date().toISOString(),
        updates: [
          {
            at: update.at ?? new Date().toISOString(),
            id: update.id ?? crypto.randomUUID(),
            message: update.message,
            phase: update.phase,
          },
        ],
      });
    };

    // Heartbeat: write 'running' status every 30s so the poller knows we're alive
    const heartbeatInterval = setInterval(async () => {
      if (jobFinalized) {
        return;
      }

      await queueJobStatusWrite({
        runId,
        status: 'running',
        tool,
        startedAt: new Date(startMs).toISOString(),
        lastHeartbeat: new Date().toISOString(),
      });
    }, 30_000);

    try {
      await emitProgress({
        message: 'launching research sub-agent',
        phase: 'runner',
      });
      const result = await runner(context, emitProgress);

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
      const errorResult = {
        runId,
        status: 'error' as const,
        section,
        error: errorMsg,
        durationMs: Date.now() - startMs,
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
    }
  })();
});

// -- Start --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
});

// -- Stale job detection ------------------------------------------------------
const STALE_THRESHOLD_MS = 300_000; // 5 minutes

// Per-tool overrides — media plan runs 6 sequential generateObject() calls
const TOOL_STALE_THRESHOLDS: Partial<Record<ToolName, number>> = {
  researchMediaPlan: 900_000, // 15 minutes for 6-block sequential generation
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
