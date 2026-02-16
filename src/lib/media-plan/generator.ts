// Media Plan Generator
// Single-phase generateObject call

import { generateObject } from 'ai';
import { anthropic, MODELS, GENERATION_SETTINGS, estimateCost } from '@/lib/ai/providers';
import { mediaPlanSchema } from './schemas';
import type { MediaPlanOutput, MediaPlanMetadata, MediaPlanGeneratorResult } from './types';

interface GenerateMediaPlanOptions {
  /** Progress callback for SSE events */
  onProgress?: (message: string, percentage: number) => void;
}

const SYSTEM_PROMPT = `You are a senior media buyer and paid advertising strategist with 10+ years of experience managing $1M+ monthly ad budgets across Meta, Google, LinkedIn, TikTok, and YouTube for B2B SaaS and high-ticket service businesses.

Your task is to create a detailed, execution-ready media plan that a media buying team can act on immediately — no follow-up questions needed. Every recommendation must be backed by data from the strategic blueprint provided.

## PLATFORM SELECTION RULES
- Meta (Facebook/Instagram): Default primary for B2C, D2C, and B2B with broad ICP. Prioritize if competitors are active on Meta or ICP has consumer-like behavior.
- LinkedIn: Primary for B2B with enterprise ICP (director+ titles, $100K+ deal sizes). Secondary if ICP is SMB or individual contributor level.
- Google Ads (Search): Include when blueprint shows high-intent keywords with CPC within 2x of target CPL. Primary for bottom-funnel conversion capture.
- YouTube: Secondary/testing platform for awareness when video assets are available. Pair with Meta for full-funnel.
- TikTok: Testing platform for younger ICP (<40) or consumer products. Avoid for enterprise B2B unless research shows ICP presence.
- Only recommend platforms where the ICP is reachable. If the blueprint ICP validation flags low reachability for a platform, exclude it.

## ICP TARGETING RULES
- Build 2-4 audience segments minimum: at least one cold prospecting and one warm retargeting.
- Per-platform targeting must use actual targeting options available on the platform (real job titles, real interest categories).
- Estimated reach per segment: cite a range, not a point estimate. Base on platform audience insights when possible.
- Exclusion lists are mandatory: always exclude existing customers, job seekers, and irrelevant demographics.
- Geographic targeting must match the client brief exactly.

## CAMPAIGN STRUCTURE RULES
- Minimum 3 campaigns across funnel stages: cold (prospecting), warm (retargeting), hot (conversion).
- Cold campaigns get 50-70% of budget. Warm gets 20-30%. Hot gets 10-20%.
- Ad set structure: 1-3 ad sets per campaign. Each ad set tests a different audience or targeting variable.
- Name campaigns, ad sets, and ads using the naming convention pattern. Consistent naming enables automated reporting.
- UTM parameters are required for every campaign. Follow the structure specified.
- Include negative keywords for search campaigns. Focus on excluding job seekers, free-tier seekers, and competitor brand terms (separate campaign).

## CREATIVE STRATEGY RULES
- Minimum 3 creative angles, each with a specific example hook using the client's data from the blueprint.
- Do NOT use generic hooks like "Struggling with X?" — use specific statistics, competitor gaps, or ICP pain points from the research.
- Reference competitor creative formats from the blueprint. If competitors overuse static images, recommend UGC video to differentiate.
- Testing plan must be phased: Phase 1 tests hooks/messages, Phase 2 tests formats/visuals, Phase 3 scales winners.
- Refresh cadence: Meta 14-21 days, LinkedIn 30-45 days, Google 30-60 days, TikTok 7-14 days.

## BUDGET PHASING RULES
- Month 1 (40-50% of steady-state budget): Testing phase. Low daily caps. Focus on data collection.
- Month 2 (75-100% of steady-state budget): Scale phase. Double down on winning audiences and creatives.
- Month 3+ (100% of steady-state budget): Optimization phase. Full budget deployment with continuous testing allocation (15-20%).
- Daily budget ceiling must be specified. Never exceed the client's stated daily ceiling from onboarding.
- Monthly roadmap must show 3-6 months with specific scaling triggers for each month.

## KPI FRAMEWORK
- Primary KPIs (3-4): The metrics the campaign is optimized for (CPL, ROAS, SQL volume, CAC).
- Secondary KPIs (3-4): Supporting metrics that inform optimization (CTR, CPC, frequency, impression share).
- Every KPI must include an industry benchmark with source context (e.g., "Industry avg B2B SaaS CPL: $85-120").
- Targets must be achievable: reference the performance model CAC math to ensure consistency.

## PERFORMANCE MODEL RULES
- CAC model must be internally consistent: monthlyBudget / targetCPL = expectedLeads. Leads * leadToSQLRate = SQLs. SQLs * closeRate = customers.
- Conversion rate assumptions must cite industry benchmarks or the client's historical data from onboarding.
- LTV estimate must be based on offer price and typical retention for the pricing model.
- LTV:CAC ratio must be >3:1 for the plan to be viable. If math doesn't work, flag it in risks and adjust targets.

## RISK IDENTIFICATION RULES
- Must cover at least 4 of 6 categories: budget, creative, audience, platform, compliance, market.
- Every risk must be specific to this client — no generic risks like "ad costs may increase."
- Each risk needs both a mitigation (proactive) and contingency (reactive) strategy.
- Assumptions section must capture dependencies that could invalidate the plan.

## SPECIFICITY STANDARDS
- No generic advice. Every recommendation must reference specific data from the blueprint or onboarding.
- Platform rationale must cite competitor activity, ICP fit, or keyword data.
- Creative hooks must use the client's specific numbers, pain points, or competitive advantages.
- Budget recommendations must show the math (budget * percentage = dollar amount).
- When making claims about industry benchmarks, state the benchmark range for the specific vertical.`;

/**
 * Generate a media plan from a pre-built context string.
 * Uses a single generateObject call.
 */
export async function generateMediaPlan(
  contextString: string,
  options: GenerateMediaPlanOptions = {},
): Promise<MediaPlanGeneratorResult> {
  const { onProgress } = options;
  const startTime = Date.now();

  try {
    onProgress?.('Analyzing blueprint context...', 5);

    onProgress?.('Building platform strategy & targeting...', 15);

    const result = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONNET),
      schema: mediaPlanSchema,
      system: SYSTEM_PROMPT,
      prompt: `Generate a comprehensive, execution-ready media plan based on the following strategic research and client brief. The plan must cover all 10 sections: executive summary, platform strategy, ICP targeting, campaign structure, creative strategy, budget allocation, campaign phases, KPI targets, performance model, and risk monitoring.\n\n${contextString}`,
      temperature: GENERATION_SETTINGS.synthesis.temperature,
      maxOutputTokens: 16384,
    });

    onProgress?.('Validating and finalizing...', 90);

    // Calculate cost from usage
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const cost = estimateCost(MODELS.CLAUDE_SONNET, inputTokens, outputTokens);

    // Build metadata (not part of AI output)
    const metadata: MediaPlanMetadata = {
      generatedAt: new Date().toISOString(),
      version: '2.0.0',
      processingTime: Date.now() - startTime,
      totalCost: cost,
      modelUsed: MODELS.CLAUDE_SONNET,
    };

    const mediaPlan: MediaPlanOutput = {
      ...result.object,
      metadata,
    };

    onProgress?.('Media plan complete!', 100);

    return {
      success: true,
      mediaPlan,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during media plan generation';
    console.error('[MediaPlanGenerator] Error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
