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
import { firecrawlTool, firecrawlExtractTool } from '../tools';
import type { ResearchResult } from '../supabase';
import { loadRunnerPrompt } from '../skills/loader';
import { MODELS } from '../models';
import { maybeCachedSystem } from '../utils/prompt-cache';

const OFFER_MODEL = process.env.RESEARCH_OFFER_MODEL ?? MODELS.STANDARD;
const OFFER_MAX_TOKENS = 8192;
const OFFER_TIMEOUT_MS = 180_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;
type OfferTool = typeof WEB_SEARCH_TOOL | typeof firecrawlTool | typeof firecrawlExtractTool;

// Paired guardrail — keep in sync with synthesize.ts (SYNTHESIS_SYSTEM) and
// media-plan.ts (CURRENT_ACTIVITIES_GUARDRAIL). All three runners react to
// the same "Current Marketing Activities:" line in the context string.
// See docs/superpowers/specs/2026-04-08-current-marketing-activities-design.md
export const OFFER_CURRENT_ACTIVITIES_GUARDRAIL = `

CURRENT MARKETING ACTIVITIES (context for offer analysis):
- The context may contain a "Current Marketing Activities:" line.
- If the client is running paid traffic with poor performance, your offer analysis should consider whether the offer structure itself is the blocker (weak guarantee, unclear value prop, wrong funnel) rather than attributing the failure to targeting or creative.
- Do not recommend a funnel type the client confirms is already in use unless you explicitly reference the existing implementation and recommend a specific structural change.
- If the field is empty or absent, ignore this rule.`;

export const OFFER_SYSTEM_PROMPT =
  `${loadRunnerPrompt('offer-system')}${OFFER_CURRENT_ACTIVITIES_GUARDRAIL}`;

interface OfferAttemptConfig {
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools: OfferTool[];
  system: string;
  synthesisMessage: string;
}

interface RunResearchOfferDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  runAttempt?: (
    context: string,
    config: OfferAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
}

export function extractOfferFirstPartyUrls(context: string): string[] {
  const matches = context.matchAll(
    /^-\s*(?:Pricing Page URL|Pricing URL|Website URL|Website|Homepage URL|Client URL|Landing Page URL)\s*:\s*(https?:\/\/\S+)/gimu,
  );

  return [...new Set([...matches].map((match) => match[1]?.trim()).filter((url): url is string => Boolean(url)))];
}

function shouldEnableOfferFirecrawl(context: string): boolean {
  return extractOfferFirstPartyUrls(context).length > 0;
}

function getOfferAttemptConfig(context: string): OfferAttemptConfig {
  return {
    model: OFFER_MODEL,
    maxTokens: OFFER_MAX_TOKENS,
    timeoutMs: OFFER_TIMEOUT_MS,
    tools: shouldEnableOfferFirecrawl(context)
      ? [WEB_SEARCH_TOOL, firecrawlExtractTool, firecrawlTool]
      : [WEB_SEARCH_TOOL],
    system: OFFER_SYSTEM_PROMPT,
    synthesisMessage: 'synthesizing offer analysis',
  };
}

function getOfferResultText(finalMsg: { content: BetaContentBlock[] }): string {
  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}

async function runOfferAttempt(
  context: string,
  config: OfferAttemptConfig,
  onProgress?: RunnerProgressReporter,
): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const client = createClient();
  const finalMsg = await runWithBackoff(
    () => {
      const runner = client.beta.messages.toolRunner({
        model: config.model,
        max_tokens: config.maxTokens,
        stream: true,
        tools: config.tools,
        system: maybeCachedSystem(config.system) as Parameters<typeof client.beta.messages.toolRunner>[0]['system'],
        messages: [{ role: 'user', content: `Analyze offer viability for paid media:\n\n${context}` }],
      });
      return Promise.race([
        runStreamedToolRunner(runner, {
          onProgress,
          synthesisMessage: config.synthesisMessage,
          maxToolIterations: 3,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`)),
            config.timeoutMs,
          ),
        ),
      ]);
    },
    'researchOffer',
  );

  return {
    resultText: getOfferResultText(finalMsg),
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

export async function runResearchOfferWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunResearchOfferDeps = {},
): Promise<ResearchResult> {
  const now = deps.now ?? (() => Date.now());
  const parseJson = deps.parseJson ?? extractJson;
  const startTime = now();

  try {
    await emitRunnerProgress(onProgress, 'runner', 'preparing offer analysis brief');
    const config = getOfferAttemptConfig(context);
    const attemptResult = await (deps.runAttempt ?? runOfferAttempt)(
      context,
      config,
      onProgress,
    );
    const resultText = attemptResult.resultText;

    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = parseJson(resultText);
    } catch (error) {
      console.error('[offer] JSON extraction failed:', resultText.slice(0, 300));
      parseError = error;
    }

    return finalizeRunnerResult({
      section: 'offerAnalysis',
      durationMs: now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry: attemptResult.telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'offerAnalysis',
      error: error instanceof Error ? error.message : String(error),
      durationMs: now() - startTime,
    };
  }
}

export async function runResearchOffer(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  return runResearchOfferWithDeps(context, onProgress);
}
