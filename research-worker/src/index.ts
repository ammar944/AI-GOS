import 'dotenv/config';
import express from 'express';
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
  runMediaPlanner,
} from './runners';
import { writeResearchResult, writeJobStatus, type ResearchResult } from './supabase';
import { compressResearchOutput } from './compress';
import { writeDeadLetter } from './dead-letter';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(express.json({ limit: '1mb' }));

// -- Auth middleware -----------------------------------------------------------
function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.RAILWAY_API_KEY;
  if (!expectedKey) {
    console.warn('[auth] RAILWAY_API_KEY not set — skipping auth (dev mode)');
    next();
    return;
  }
  if (authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
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
}

const TOOL_RUNNERS: Record<ToolName, (context: string) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
  researchMediaPlan: runMediaPlanner,
};

// Maps tool name → section key used in journey_sessions.research_results.
// The readiness poller checks section keys, not tool names.
const TOOL_SECTION_MAP: Record<ToolName, string> = {
  researchIndustry: 'industryMarket',
  researchCompetitors: 'competitors',
  researchICP: 'icpValidation',
  researchOffer: 'offerAnalysis',
  synthesizeResearch: 'crossAnalysis',
  researchKeywords: 'keywords',
  researchMediaPlan: 'mediaPlan',
};

// -- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -- Active job tracking (for stale detection) --------------------------------
const activeJobs = new Map<string, { tool: string; userId: string; startedAt: number }>();

// -- Run ----------------------------------------------------------------------
app.post('/run', requireApiKey, async (req: express.Request, res: express.Response) => {
  const { tool, context, userId, jobId } = req.body as RunJobRequest;

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
      status: 'running',
      tool,
      startedAt: new Date(startMs).toISOString(),
    });
  } catch (statusErr) {
    // Non-fatal — log and proceed. Research is more important than status tracking.
    console.error(`[worker] writeJobStatus failed for ${jobId}:`, statusErr);
  }

  // Track active job for stale detection
  activeJobs.set(jobId, { tool, userId, startedAt: startMs });

  // Return 202 now — job continues asynchronously in background
  res.status(202).json({ status: 'accepted', jobId });

  // Run the job in a detached async context. This is intentional — we've
  // already committed the job to Supabase above, so crashes are observable.
  void (async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);

    // Heartbeat: write 'running' status every 30s so the poller knows we're alive
    const heartbeatInterval = setInterval(async () => {
      try {
        await writeJobStatus(userId, jobId, {
          status: 'running',
          tool,
          startedAt: new Date(startMs).toISOString(),
          lastHeartbeat: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`[heartbeat] Failed for ${jobId}:`, err);
      }
    }, 30_000);

    try {
      const result = await runner(context);

      // Compression disabled — raw runner data flows through to Supabase
      // so artifact-panel.tsx and research-inline-card.tsx can render
      // structured fields (categorySnapshot, marketDynamics, etc.) directly.
      // See: compress.ts transforms data into CompressedSummary shape which
      // has zero overlap with what the frontend renderers expect.
      if (result.status === 'complete' && result.data) {
        const rawLength = JSON.stringify(result.data).length;
        console.log(`[${tool}] Raw data: ${rawLength} chars (compression bypassed)`);
      }

      try {
        await writeResearchResult(userId, result.section, result);
      } catch (writeError) {
        console.error(
          `[worker] writeResearchResult failed after retries for ${result.section}:`,
          writeError,
        );
        writeDeadLetter(userId, result.section, result, String(writeError));
      }
      await writeJobStatus(userId, jobId, {
        status: 'complete',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
      });
      console.log(`[worker] Completed ${tool} for user ${userId} in ${result.durationMs}ms`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Unhandled error in ${tool}:`, error);
      const section = TOOL_SECTION_MAP[tool] ?? tool;
      const errorResult = {
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
      await writeJobStatus(userId, jobId, {
        status: 'error',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
        error: errorMsg,
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

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    if (now - job.startedAt > STALE_THRESHOLD_MS) {
      console.error(`[stale-check] Job ${jobId} (${job.tool}) exceeded ${STALE_THRESHOLD_MS / 1000}s — marking as error`);
      writeJobStatus(job.userId, jobId, {
        status: 'error',
        tool: job.tool,
        error: `timeout: job exceeded ${STALE_THRESHOLD_MS / 1000}s`,
        startedAt: new Date(job.startedAt).toISOString(),
        completedAt: new Date().toISOString(),
      }).catch(err => console.error('[stale-check] writeJobStatus failed:', err));
      activeJobs.delete(jobId);
    }
  }
}, 60_000); // Check every 60s

export default app;
