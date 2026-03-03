import express from 'express';
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
} from './runners';
import { writeResearchResult, type ResearchResult } from './supabase';

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
  | 'researchKeywords';

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
};

// -- Health -------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// -- Run ----------------------------------------------------------------------
app.post('/run', requireApiKey, (req: express.Request, res: express.Response) => {
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

  // Return 202 immediately — job runs in background
  res.status(202).json({ status: 'accepted', jobId });

  setImmediate(async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);
    try {
      const result = await runner(context);
      await writeResearchResult(userId, result.section, result);
      console.log(`[worker] Completed ${tool} for user ${userId} in ${result.durationMs}ms`);
    } catch (error) {
      console.error(`[worker] Unhandled error in ${tool}:`, error);
      await writeResearchResult(userId, tool, {
        status: 'error',
        section: tool,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      });
    }
  });
});

// -- Start --------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[worker] Research worker listening on :${PORT}`);
});

export default app;
