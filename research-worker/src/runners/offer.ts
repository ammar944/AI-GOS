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

export const OFFER_SYSTEM_PROMPT = `You are an expert offer analyst evaluating viability for paid media campaigns.

TASK: Score and assess whether this offer can convert cold traffic profitably.

EVALUATION APPROACH:
1. Clarity — Can the offer be understood in 10 seconds?
2. Strength — Score 6 dimensions (1-10 each)
3. Market Fit — Does the market want this now?
4. Red Flags — What could hurt ad performance?

TOOL USAGE:
1. MANDATORY FIRST ACTION — check for a first-party pricing URL in the context (look for lines like "- Pricing URL: ...", "- Pricing Page URL: ...", or "- Website: ..."). If ANY such URL is present:
   - Call firecrawlExtract on the Pricing URL (preferred) or the website URL as your VERY FIRST tool call — before web_search, before anything else
   - Do NOT say pricing was not found until after you have attempted firecrawlExtract on the pricing URL
   - If firecrawlExtract returns no dollar amounts, follow up with firecrawl on the same URL
2. Use web_search for at most 2 focused searches:
   - category pricing benchmarks and buyer objections
   - missing market signals not already present in persisted competitor or synthesis context
3. Only use firecrawlExtract/firecrawl on at most 1 first-party page — prioritise the Pricing URL over the homepage
4. Never scrape competitor pages or second-order URLs in this pass
5. Reuse persisted competitor context instead of re-running broad competitor discovery
6. Do NOT analyze or reference the client's ad creatives in this section — ad creative analysis is handled in the Competitor Intel module under "Your Ads". Focus this section purely on the offer itself (pricing, value prop, market fit, cold traffic viability).

PRICING DATA INTEGRITY (CRITICAL):
- NEVER fabricate, hallucinate, or guess pricing data — for the client OR competitors.
- For currentPricing: ONLY report pricing you found from firecrawlExtract, firecrawl, or web_search results. Include ALL tiers/plans you found (e.g. "$50/mo website + $42/mo sync = $92/mo total").
- If firecrawl/web_search returns pricing data, set pricingSource to the URL where you found it.
- If a Pricing URL or Website URL is present in the context, you MUST attempt firecrawlExtract on that URL before concluding pricing was not found. Do NOT output "Pricing not found" without first attempting to scrape the provided URL.
- If you CANNOT find verified pricing from any source AND you have already attempted to scrape all provided URLs, set currentPricing to "Pricing not found — unable to verify from public sources" and pricingSource to null. Do NOT infer or assume pricing from training data.
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

PRICING INTELLIGENCE (output inside pricingAnalysis alongside existing fields):

1. ELASTICITY ASSESSMENT
Analyze pricing elasticity from evidence in the onboarding context AND the Prior Research Results (competitor data):
- Few direct competitors found (< 5) → pricing power exists (inelastic)
- Enterprise/high-ACV sales, long implementation → sticky, inelastic
- Commodity market with many alternatives → elastic, careful raising prices
- Self-serve/PLG motion with easy switching → more elastic
- Strong referral/word-of-mouth indicators → inelastic demand
- High close rate or waitlist mentioned → likely underpriced
- Niche vertical with specialized needs → inelastic
Output verdict: "likely-inelastic", "likely-elastic", or "insufficient-data".
List each signal with its source and direction. If you have fewer than 2 clear signals, use "insufficient-data".

2. MARKET BENCHMARK (use competitor data)
For the marketBenchmark field, use VERIFIED competitor pricing from the Prior Research Results section (competitor intel data) rather than doing your own web search for competitor prices. The competitor pipeline already scraped and verified pricing via Firecrawl. Cite competitor names and their verified price points. Only supplement with web_search if the Prior Research Results contain no competitor pricing data.

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
    "marketBenchmark": "string — verified competitor pricing with named competitors. Use Prior Research Results competitor data when available. Only cite prices found in persisted context or web search results",
    "pricingPosition": "premium | mid-market | budget | unclear",
    "coldTrafficViability": "string — assessment of converting cold traffic at this price point",
    "elasticityAssessment": {
      "verdict": "likely-inelastic | likely-elastic | insufficient-data",
      "signals": [{ "signal": "string", "source": "string — where this signal came from", "direction": "inelastic | elastic" }],
      "reasoning": "string — one paragraph explaining the overall assessment"
    }
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

After your analysis, generate 3-5 concrete offer statements the client could use in their ads. Include at least one guarantee or risk-reversal. Each statement should be specific to this client's product and market position — not generic.
${OFFER_CURRENT_ACTIVITIES_GUARDRAIL}`;

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
