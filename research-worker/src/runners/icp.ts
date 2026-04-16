import type { RunnerCtx, RunnerDeps, RunnerFn } from './base';
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  createClient,
  buildRunnerTelemetry,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';
import { ICP_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
import { loadRunnerPrompt } from '../skills/loader';
import { MODELS } from '../models';

const ICP_MODEL = process.env.RESEARCH_ICP_MODEL ?? MODELS.STANDARD;
const ICP_MAX_TOKENS = 10000;
const ICP_TIMEOUT_MS = 120_000;

const ICP_SYSTEM_PROMPT =
  loadRunnerPrompt('icp-primary.md') + '\n\n' + ICP_INTELLIGENCE_SKILL;

export async function runResearchICP(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    await emitRunnerProgress(onProgress, 'runner', 'preparing ICP validation brief');
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: ICP_MODEL,
          max_tokens: ICP_MAX_TOKENS,
          stream: true,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
          system: ICP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Validate the ICP for paid media:\n\n${context}` }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: 'synthesizing ICP validation',
            maxToolIterations: 3,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Sub-agent timed out after ${ICP_TIMEOUT_MS / 1000}s`)), ICP_TIMEOUT_MS)),
        ]);
      },
      'researchICP',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = extractJson(resultText);
    } catch (error) {
      console.error('[icp] JSON extraction failed:', resultText.slice(0, 300));
      parseError = error;
    }
    return finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: Date.now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry: buildRunnerTelemetry(finalMsg),
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'icpValidation',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

// Type-check: runResearchICP conforms to RunnerFn when called with a RunnerCtx.
// This is a compile-time assertion — it catches drift between runner signatures
// and the unified contract without forcing immediate migration.
const _runnerFnCheck: (ctx: RunnerCtx, onProgress?: Parameters<RunnerFn>[1]) => ReturnType<RunnerFn> =
  (ctx, onProgress) => runResearchICP(ctx.context, onProgress);
void _runnerFnCheck;
