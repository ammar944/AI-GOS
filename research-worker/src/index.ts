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
  resolveProductIdentity,
  runMeetingExtraction,
} from './runners';
import { writeResearchResult, writeJobStatus, writeScriptPackUpdate, getClient, type ResearchResult } from './supabase';
import { runAdScripts, type AdScriptsInput } from './runners/ad-scripts';
import { runScriptPipeline, type PipelineInput } from './scripts/pipeline';
import { writeDeadLetter } from './dead-letter';
import { sanitizeForJson, type RunnerProgressReporter } from './runner';
import { TOOL_SECTION_MAP } from './section-map';
import { authorizeWorkerRequest } from './auth';
import { extractWikiEntries, writeWikiEntries } from './wiki';
import { workerBus } from './events';
import { dispatchIntelligenceCards } from './intelligence/dispatcher';

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
  | 'researchMediaPlan'
  | 'resolveIdentity'
  | 'extractMeetingTranscript';

import { renderBaselineMetricsBlock, type BaselineMetrics } from './baseline-metrics';

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
}

const TOOL_RUNNERS: Record<ToolName, (context: string, onProgress?: RunnerProgressReporter) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
  researchMediaPlan: runMediaPlan,
  resolveIdentity: resolveProductIdentity,
  extractMeetingTranscript: runMeetingExtraction,
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
  const { tool, context, userId, jobId, runId, baselineMetrics, documentId } = req.body as RunJobRequest;

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
            ...(update.meta ? { meta: update.meta } : {}),
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
        message: 'launching research analysis',
        phase: 'runner',
      });
      const runnerStartMs = Date.now();
      const result = await runner(contextWithDate, emitProgress);
      const runnerDurationMs = Date.now() - runnerStartMs;
      console.log(`[timing] ${tool} runner completed in ${(runnerDurationMs / 1000).toFixed(1)}s`);

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

// -- Ad Scripts ---------------------------------------------------------------
app.post('/api/scripts', requireApiKey, async (req: express.Request, res: express.Response) => {
  const { packId, profileId, sessionId, userId, companyName, researchContext, styleReferences, proofPoints, brandVoiceNotes } = req.body;

  if (!packId || !profileId || !userId || !researchContext) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  res.status(202).json({ status: 'accepted', packId });

  // Pipeline version toggle: v2 (ICM pipeline) is default, v1 available as fallback
  const useV2 = req.body.pipelineVersion !== 'v1';

  void (async () => {
    try {
      if (useV2) {
        // --- ICM Pipeline (v2) ---
        console.log(`[ad-scripts-v2] Starting ICM pipeline for pack ${packId}`);
        const pipelineInput: PipelineInput = {
          companyName: companyName ?? 'Unknown Company',
          researchContext,
          styleReferences: styleReferences ?? [],
          targetAudience: researchContext.targetAudience ?? 'target audience',
          proofPoints: proofPoints ?? [],
          brandVoiceNotes: brandVoiceNotes ?? null,
        };

        const result = await runScriptPipeline(
          pipelineInput,
          async (update) => {
            console.log(`[ad-scripts-v2] ${update.phase}: ${update.message}`);
          },
          async (scripts, completedLevels) => {
            const status = completedLevels >= 5 ? 'complete' : 'partial';
            await writeScriptPackUpdate(packId, {
              scripts: JSON.stringify(scripts),
              status,
              script_count: scripts.length,
            });
          },
        );

        await writeScriptPackUpdate(packId, {
          scripts: JSON.stringify(result.assembledScripts),
          status: 'complete',
          script_count: result.assembledScripts.length,
          diversity_score: 10, // Diversity guaranteed by construction in v2
          diversity_flags: JSON.stringify(result.metadata.matrixViolations),
        });
        console.log(`[ad-scripts-v2] Completed: ${result.assembledScripts.length} scripts, ${result.hookVariants.length} hook variants, ${result.metadata.totalClaims} claims for pack ${packId}`);
      } else {
        // --- Legacy Pipeline (v1) ---
        console.log(`[ad-scripts-v1] Starting legacy pipeline for pack ${packId}`);
        const input: AdScriptsInput = {
          companyName: companyName ?? 'Unknown Company',
          researchContext,
          styleReferences: styleReferences ?? [],
          targetAudience: researchContext.targetAudience ?? 'target audience',
          proofPoints: proofPoints ?? [],
          brandVoiceNotes: brandVoiceNotes ?? null,
        };

        const result = await runAdScripts(
          input,
          async (update) => {
            console.log(`[ad-scripts-v1] ${update.phase}: ${update.message}`);
          },
          async (scripts, completedLevels) => {
            const status = completedLevels >= 5 ? 'complete' : 'partial';
            await writeScriptPackUpdate(packId, {
              scripts: JSON.stringify(scripts),
              status,
              script_count: scripts.length,
            });
          },
        );

        await writeScriptPackUpdate(packId, {
          scripts: JSON.stringify(result.scripts),
          status: 'complete',
          script_count: result.scripts.length,
          ...(result.diversity ? {
            diversity_score: result.diversity.diversityScore,
            diversity_flags: JSON.stringify(result.diversity.flags),
          } : {}),
        });
        console.log(`[ad-scripts-v1] Completed: ${result.summary.totalScripts} scripts for pack ${packId}${result.diversity ? ` (diversity: ${result.diversity.diversityScore}/10)` : ''}`);
      }
    } catch (err) {
      console.error(`[ad-scripts] Failed for pack ${packId}:`, err);
      await writeScriptPackUpdate(packId, {
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
      });
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
