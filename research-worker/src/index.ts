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
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

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

  // Write job status to Supabase BEFORE returning 202.
  // If the process crashes after this point, the row stays as 'running'
  // — detectable rather than silently lost.
  try {
    await writeJobStatus(userId, jobId, {
      status: 'running',
      tool,
      startedAt: new Date().toISOString(),
    });
  } catch (statusErr) {
    // Non-fatal — log and proceed. Research is more important than status tracking.
    console.error(`[worker] writeJobStatus failed for ${jobId}:`, statusErr);
  }

  // Return 202 now — job continues asynchronously in background
  res.status(202).json({ status: 'accepted', jobId });

  // Run the job in a detached async context. This is intentional — we've
  // already committed the job to Supabase above, so crashes are observable.
  void (async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);
    const startMs = Date.now();
    try {
      const result = await runner(context);

      // Compress successful results before writing to Supabase
      if (result.status === 'complete' && result.data) {
        try {
          const rawLength = JSON.stringify(result.data).length;
          const compressed = await compressResearchOutput(result.section, result.data);
          const compressedLength = JSON.stringify(compressed).length;
          console.log(`[${tool}] Compressed: ${rawLength} → ${compressedLength} chars`);
          result.data = compressed;
        } catch (compressError) {
          console.warn(`[${tool}] Compression failed, using raw data:`, compressError);
          // Keep raw data — don't lose results
        }
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
    }
  })();
});

// -- Start --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
});

// -- Stale job detection ------------------------------------------------------
const STALE_THRESHOLD_MS = 180_000; // 3 minutes

setInterval(() => {
  console.log(`[stale-check] Checking for stale jobs (threshold: ${STALE_THRESHOLD_MS / 1000}s)...`);
  // MVP: log only. Full implementation would query Supabase for job_status entries
  // where status='running' and startedAt < now - STALE_THRESHOLD_MS,
  // then mark them as { status: 'error', error: 'timeout: job exceeded 180s' }
}, 60_000); // Check every 60s

export default app;
