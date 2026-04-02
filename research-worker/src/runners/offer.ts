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

const OFFER_MODEL = process.env.RESEARCH_OFFER_MODEL ?? 'claude-sonnet-4-6';
const OFFER_MAX_TOKENS = 5200;
const OFFER_TIMEOUT_MS = 120_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;
type OfferTool = typeof WEB_SEARCH_TOOL | typeof firecrawlTool | typeof firecrawlExtractTool;

const OFFER_SYSTEM_PROMPT = `You are an expert offer analyst evaluating viability for paid media campaigns.

TASK: Score and assess whether this offer can convert cold traffic profitably.

EVALUATION APPROACH:
1. Clarity — Can the offer be understood in 10 seconds?
2. Strength — Score 6 dimensions (1-10 each)
3. Market Fit — Does the market want this now?
4. Red Flags — What could hurt ad performance?

TOOL USAGE:
1. Use web_search for at most 2 focused searches:
   - category pricing benchmarks and buyer objections
   - missing market signals not already present in persisted competitor or synthesis context
2. Use firecrawlExtract (preferred) or firecrawl when a first-party pricing or website URL is present in the context:
   - firecrawlExtract: Use for pricing pages — returns structured tier/price/feature data directly
   - firecrawl: Use for general page content when you need the full markdown
3. Use at most 1 firecrawl/firecrawlExtract call on the highest-value first-party page only
4. Never scrape competitor pages or second-order URLs in this pass
5. Reuse persisted competitor context instead of re-running broad competitor discovery
6. Do NOT analyze or reference the client's ad creatives in this section — ad creative analysis is handled in the Competitor Intel module under "Your Ads". Focus this section purely on the offer itself (pricing, value prop, market fit, cold traffic viability).

PRICING DATA INTEGRITY (CRITICAL):
- NEVER fabricate, hallucinate, or guess pricing data — for the client OR competitors.
- For currentPricing: ONLY report pricing you found from firecrawlExtract, firecrawl, or web_search results. Include ALL tiers/plans you found (e.g. "$50/mo website + $42/mo sync = $92/mo total").
- If firecrawl/web_search returns pricing data, set pricingSource to the URL where you found it.
- If you CANNOT find verified pricing from any source, set currentPricing to "Pricing not found — unable to verify from public sources" and pricingSource to null. Do NOT infer or assume pricing from training data.
- For marketBenchmark: Only cite competitor pricing that was verified in the persisted competitor context or found via web_search. Attribute each price to a named competitor.

SCORING GUIDELINES:
- Score based on competitive positioning
- Be honest — inflated scores waste ad spend
- Overall score = average of 6 dimension scores
- Dimensions to score: painRelevance, urgency, differentiation, tangibility, proof, pricingLogic

OFFER STRENGTH EVALUATION:
For each dimension (1-10):
- painRelevance: How directly does this offer solve the primary pain?
- urgency: Is there a compelling reason to buy NOW vs later?
- differentiation: How unique is this vs competitors?
- tangibility: Can buyers clearly visualize the outcome?
- proof: How much evidence supports the claims?
- pricingLogic: Does the price make sense relative to the value?

RED FLAGS FOR PAID ADS:
- Vague outcomes ("improve your business")
- No clear differentiator from competitors
- Price point too high for cold traffic conversion
- No social proof or credibility signals
- Long sales cycle for cold traffic

COMPRESSION RULES:
- topStrengths: 2-3 items
- priorityFixes: 2-3 items (keep as plain strings)
- iceScoredFixes: one entry per priorityFix, scored with the ICE framework (Impact 1-10, Confidence 1-10, Ease 1-10). Compute iceScore as impact * confidence * ease. Sort by iceScore descending.
- recommendedActionPlan: 3 items max
- redFlags: 3 items max
- messagingRecommendations: 3 items max
- citations: max 4 items, only when they materially support the verdict
- Keep summary, marketFitAssessment, and coldTrafficViability to 2-3 sentences each

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "offerStrength": {
    "overallScore": 1-10,
    "painRelevance": 1-10,
    "urgency": 1-10,
    "differentiation": 1-10,
    "tangibility": 1-10,
    "proof": 1-10,
    "pricingLogic": 1-10
  },
  "recommendation": {
    "status": "proceed | needs-work | adjust-messaging | adjust-pricing | icp-refinement-needed | major-offer-rebuild | do-not-launch",
    "summary": "string — concise assessment",
    "topStrengths": ["string — 2-3 strongest elements"],
    "priorityFixes": ["string — 2-3 most important improvements needed"],
    "iceScoredFixes": [
      {
        "issue": "string — description of the issue",
        "fix": "string — recommended fix",
        "impact": "number 1-10 — potential improvement to conversion/results",
        "confidence": "number 1-10 — how confident are you this fix will work",
        "ease": "number 1-10 — how easy is this to implement",
        "iceScore": "number — impact * confidence * ease"
      }
    ],
    "recommendedActionPlan": ["string — prescriptive next actions the team should take before launch"]
  },
  "redFlags": [
    {
      "issue": "string — specific concern that could hurt ad performance",
      "severity": "high | medium | low",
      "priority": 1,
      "recommendedAction": "string — what to do about it",
      "launchBlocker": true,
      "evidence": "string — why this is a problem"
    }
  ],
  "pricingAnalysis": {
    "currentPricing": "string — ONLY verified pricing from scraped sources. Include all tiers. If not found, state 'Pricing not found — unable to verify from public sources'",
    "pricingSource": "string | null — URL where pricing was found, or null if not found",
    "marketBenchmark": "string — verified competitor pricing with named competitors. Only cite prices found in persisted context or web search results",
    "pricingPosition": "premium | mid-market | budget | unclear",
    "coldTrafficViability": "string — assessment of converting cold traffic at this price point"
  },
  "marketFitAssessment": "string — does the market want this offer right now?",
  "messagingRecommendations": ["string — how to frame this offer in ads for maximum conversion"],
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ],
  "generatedOfferStatements": [
    {
      "type": "headline | guarantee | usp | value-prop | risk-reversal",
      "statement": "The actual offer statement copy",
      "rationale": "Why this statement works for this client",
      "targetEmotion": "The emotion this targets (e.g., loss aversion, aspiration, trust)"
    }
  ]
}

After your analysis, generate 3-5 concrete offer statements the client could use in their ads. Include at least one guarantee or risk-reversal. Each statement should be specific to this client's product and market position — not generic.`;

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
        system: config.system,
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
