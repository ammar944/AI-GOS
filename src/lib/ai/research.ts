// Research Functions - Vercel AI SDK
// All 5 sections of Strategic Blueprint generation

import { generateObject, NoObjectGeneratedError } from 'ai';
import {
  perplexity,
  anthropic,
  MODELS,
  SECTION_MODELS,
  GENERATION_SETTINGS,
  estimateCost,
} from './providers';
import {
  industryMarketSchema,
  icpAnalysisSchema,
  offerAnalysisSchema,
  competitorAnalysisSchema,
  crossAnalysisSchema,
} from './schemas';
import type {
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  CrossAnalysisResult,
  ResearchSource,
  AllSectionResults,
} from './types';
import { COPYWRITING_EXPERT_PERSONA, MESSAGING_ANGLES_PROMPT, PSYCHOGRAPHICS_RESEARCH_PROMPT } from './prompts';

// =============================================================================
// Debug logging helper
// =============================================================================
function logGenerationError(section: string, error: unknown): void {
  console.error(`[${section}] Generation failed:`, error);
  if (error instanceof NoObjectGeneratedError) {
    console.error(`[${section}] Raw response text:`, error.text?.slice(0, 2000));
    console.error(`[${section}] Cause:`, error.cause);
  }
}

// =============================================================================
// Section 1: Industry & Market Overview
// Model: Sonar Pro (research aggregation)
// =============================================================================

export async function researchIndustryMarket(
  context: string
): Promise<IndustryMarketResult> {
  const model = SECTION_MODELS.industryMarket;

  try {
    const result = await generateObject({
      model: perplexity(model),
      schema: industryMarketSchema,
      system: `You are an expert market researcher with real-time web search.

TASK: Research the industry and market landscape to inform a paid media strategy.

RESEARCH FOCUS:
- Current market trends and statistics (2024+)
- Pain points from G2, Capterra, Reddit, forums
- Buying behaviors and triggers
- Seasonal patterns and sales cycles
- Demand drivers and barriers

QUALITY STANDARDS:
- Be specific with real data
- Include statistics when available
- Source pain points from actual customer feedback
- Make insights actionable for paid media

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

      prompt: `Research the industry and market for:\n\n${context}`,
      ...GENERATION_SETTINGS.research,
    });

    return {
      data: result.object,
      sources: [],
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('industryMarket', error);
    throw error;
  }
}

// =============================================================================
// Section 2: ICP Analysis & Validation
// Model: Sonar Pro (research + structured JSON output)
// =============================================================================

export async function researchICPAnalysis(
  context: string,
  industryContext: IndustryMarketResult['data']
): Promise<ICPAnalysisResult> {
  const model = SECTION_MODELS.icpValidation;

  // Build context from Section 1
  const previousContext = `
MARKET CONTEXT (from previous research):
- Category: ${industryContext.categorySnapshot.category}
- Market Maturity: ${industryContext.categorySnapshot.marketMaturity}
- Buying Behavior: ${industryContext.categorySnapshot.buyingBehavior}
- Awareness Level: ${industryContext.categorySnapshot.awarenessLevel}
- Top Pain Points: ${industryContext.painPoints.primary.slice(0, 4).join('; ')}
`;

  try {
    const result = await generateObject({
      model: perplexity(model),
      schema: icpAnalysisSchema,
      system: `You are an expert ICP analyst validating whether a target audience is viable for paid media.
${previousContext}

TASK: Critically assess whether this ICP can be profitably targeted with paid ads.

VALIDATION APPROACH:
1. Check targeting feasibility on Meta, LinkedIn, Google
2. Verify adequate audience scale for testing
3. Assess pain-solution fit strength
4. Evaluate economic feasibility (budget, authority)

BE CRITICAL:
- Flag real concerns, don't sugarcoat
- "validated" = truly ready for ads
- "workable" = proceed with caution
- "invalid" = do not spend money until fixed

${PSYCHOGRAPHICS_RESEARCH_PROMPT}

PSYCHOGRAPHICS QUALITY:
- Goals should be specific and aspirational
- Fears should be deep, not surface-level
- "Day in the life" should be 2-3 paragraphs, emotional, 1st person
- Perceived enemy should be concrete (a type of vendor, approach, or situation)
- Failed solutions should explain WHY each failed

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

      prompt: `Validate the ICP for paid media:\n\n${context}`,
      ...GENERATION_SETTINGS.research,
    });

    return {
      data: result.object,
      sources: [],
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('icpAnalysis', error);
    throw error;
  }
}

// =============================================================================
// Section 3: Offer Analysis & Viability
// Model: Sonar Pro (research + structured JSON output)
// Note: Uses industry context (not ICP) to enable parallel Phase 2 execution
// =============================================================================

export async function researchOfferAnalysis(
  context: string,
  industryContext: IndustryMarketResult['data']
): Promise<OfferAnalysisResult> {
  const model = SECTION_MODELS.offerAnalysis;

  // Build context from Section 1 (market context for parallel execution)
  const previousContext = `
MARKET CONTEXT (from industry research):
- Category: ${industryContext.categorySnapshot.category}
- Market Maturity: ${industryContext.categorySnapshot.marketMaturity}
- Buying Behavior: ${industryContext.categorySnapshot.buyingBehavior}
- Awareness Level: ${industryContext.categorySnapshot.awarenessLevel}
- Top Pain Points: ${industryContext.painPoints.primary.slice(0, 4).join('; ')}
`;

  try {
    const result = await generateObject({
      model: perplexity(model),
      schema: offerAnalysisSchema,
      system: `You are an expert offer analyst evaluating viability for paid media campaigns.
${previousContext}

TASK: Score and assess whether this offer can convert cold traffic profitably.

EVALUATION APPROACH:
1. Clarity - Can it be understood in 10 seconds?
2. Strength - Score 6 dimensions (1-10 each)
3. Market Fit - Does the market want this now?
4. Red Flags - What could hurt ad performance?

SCORING GUIDELINES:
- Score based on competitive positioning
- Be honest - inflated scores waste ad spend
- Overall score = average of 6 dimension scores

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

      prompt: `Analyze offer viability for paid media:\n\n${context}`,
      ...GENERATION_SETTINGS.research,
    });

    return {
      data: result.object,
      sources: [],
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('offerAnalysis', error);
    throw error;
  }
}

// =============================================================================
// Section 4: Competitor Analysis
// Model: Sonar Pro + Firecrawl (pricing) + Ad Library (creatives)
// =============================================================================

export async function researchCompetitors(
  context: string
): Promise<CompetitorAnalysisResult> {
  const model = SECTION_MODELS.competitorAnalysis;

  try {
    const result = await generateObject({
      model: perplexity(model),
      schema: competitorAnalysisSchema,
      system: `You are an expert competitive analyst researching the competitor landscape.

TASK: Research competitors to inform paid media positioning and messaging.

CRITICAL - COMPETITOR DISAMBIGUATION:
- When multiple companies share a similar name (e.g., "Fathom AI" vs "FathomHQ" vs "Fathom Analytics"), you MUST identify which one operates in the SAME product category and serves the SAME target audience as the business being analyzed
- Verify each competitor's PRIMARY product/service matches the market segment described in the context
- Exclude companies that are homonyms serving completely different industries (e.g., a call recording tool vs a revenue intelligence platform)
- ALWAYS include the competitor's official website URL - this is critical for verification
- When in doubt between similar-named companies, choose the one with the most similar:
  1. Target customer (same industry, company size, job titles)
  2. Product category (same type of solution)
  3. Go-to-market approach (same sales model)

RESEARCH FOCUS:
1. Identify 3-5 direct competitors
2. Analyze their positioning and messaging
3. Find strengths/weaknesses from G2, Capterra reviews
4. Identify market patterns and gaps

IMPORTANT - PRICING:
- Do NOT guess exact prices
- Say "See pricing page" for specific prices
- Pricing will be scraped separately from actual pages

IMPORTANT - ADS:
- Note which platforms they advertise on
- Real ad creatives will be fetched separately

QUALITY:
- Use real company names
- ALWAYS include the official website URL for each competitor
- Quote actual review feedback
- Be specific about positioning
- Verify the competitor serves the same market as the analyzed business

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

      prompt: `Research competitors for:\n\n${context}`,
      ...GENERATION_SETTINGS.research,
    });

    // NOTE: The generator will enrich this with:
    // - scrapePricingForCompetitors() → Real pricing from Firecrawl
    // - fetchCompetitorAds() → Real ads from Ad Library
    // This function returns base research only

    return {
      data: result.object,
      sources: [],
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('competitorAnalysis', error);
    throw error;
  }
}

// =============================================================================
// Section 5: Cross-Analysis Synthesis
// Model: Claude Sonnet 4 (strategic prose)
// =============================================================================

export async function synthesizeCrossAnalysis(
  context: string,
  sections: AllSectionResults
): Promise<CrossAnalysisResult> {
  const model = SECTION_MODELS.crossAnalysis;

  // Build comprehensive context from all sections
  const allContext = `
═══════════════════════════════════════════════════════════════════════════════
SECTION 1: INDUSTRY & MARKET OVERVIEW
═══════════════════════════════════════════════════════════════════════════════
Category: ${sections.industryMarket.categorySnapshot.category}
Market Maturity: ${sections.industryMarket.categorySnapshot.marketMaturity}
Buying Behavior: ${sections.industryMarket.categorySnapshot.buyingBehavior}
Awareness Level: ${sections.industryMarket.categorySnapshot.awarenessLevel}
Sales Cycle: ${sections.industryMarket.categorySnapshot.averageSalesCycle}

Top Pain Points:
${sections.industryMarket.painPoints.primary.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Key Messaging Opportunities:
${sections.industryMarket.messagingOpportunities.opportunities.slice(0, 4).map((o, i) => `${i + 1}. ${o}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: ICP ANALYSIS & VALIDATION
═══════════════════════════════════════════════════════════════════════════════
Validation Status: ${sections.icpAnalysis.finalVerdict.status.toUpperCase()}
Reasoning: ${sections.icpAnalysis.finalVerdict.reasoning}

Pain-Solution Fit: ${sections.icpAnalysis.painSolutionFit.fitAssessment}
Primary Pain: ${sections.icpAnalysis.painSolutionFit.primaryPain}

Risk Assessment:
- Reachability: ${sections.icpAnalysis.riskAssessment.reachability}
- Budget: ${sections.icpAnalysis.riskAssessment.budget}
- Pain Strength: ${sections.icpAnalysis.riskAssessment.painStrength}
- Competitiveness: ${sections.icpAnalysis.riskAssessment.competitiveness}

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: OFFER ANALYSIS & VIABILITY
═══════════════════════════════════════════════════════════════════════════════
Overall Score: ${sections.offerAnalysis.offerStrength.overallScore}/10
Recommendation: ${sections.offerAnalysis.recommendation.status.toUpperCase()}

Dimension Scores:
- Pain Relevance: ${sections.offerAnalysis.offerStrength.painRelevance}/10
- Urgency: ${sections.offerAnalysis.offerStrength.urgency}/10
- Differentiation: ${sections.offerAnalysis.offerStrength.differentiation}/10
- Tangibility: ${sections.offerAnalysis.offerStrength.tangibility}/10
- Proof: ${sections.offerAnalysis.offerStrength.proof}/10
- Pricing Logic: ${sections.offerAnalysis.offerStrength.pricingLogic}/10

Red Flags: ${sections.offerAnalysis.redFlags.length > 0 ? sections.offerAnalysis.redFlags.join(', ') : 'None'}

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: COMPETITOR ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Competitors Analyzed: ${sections.competitorAnalysis.competitors.length}

${sections.competitorAnalysis.competitors.map(c => `
${c.name}:
- Positioning: ${c.positioning}
- Strengths: ${c.strengths.join(', ')}
- Weaknesses: ${c.weaknesses.join(', ')}
`).join('\n')}

Market Gaps:
${sections.competitorAnalysis.gapsAndOpportunities.messagingOpportunities.map((g, i) => `${i + 1}. ${g}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
COMPETITOR AD CREATIVES (Real ads from ad libraries)
═══════════════════════════════════════════════════════════════════════════════
${(() => {
  // Cast to any to access enriched fields (adCreatives added by competitor-enrichment.ts)
  const competitors = sections.competitorAnalysis.competitors as any[];
  const competitorsWithAds = competitors.filter(c => c.adCreatives?.length > 0);

  if (competitorsWithAds.length === 0) {
    return 'No competitor ad creatives available for analysis.';
  }

  return competitorsWithAds.map(c => {
    const adsText = c.adCreatives.slice(0, 5).map((ad: any, i: number) => {
      const parts = [`  Ad ${i + 1} [${ad.platform}]:`];
      if (ad.headline) parts.push(`    Headline: "${ad.headline}"`);
      if (ad.body) parts.push(`    Body: "${ad.body.slice(0, 200)}${ad.body.length > 200 ? '...' : ''}"`);
      return parts.join('\n');
    }).join('\n\n');

    return `${c.name} Ads (${c.adCreatives.length} found):\n${adsText}`;
  }).join('\n\n');
})()}

IMPORTANT: When creating adHooks in messagingFramework, prioritize EXTRACTING hooks from the real ads above.
Mark each hook's source.type as "extracted" (verbatim), "inspired" (based on pattern), or "generated" (no matching ad).
`;

  try {
    const result = await generateObject({
      model: anthropic(model),
      schema: crossAnalysisSchema,
      system: `${COPYWRITING_EXPERT_PERSONA}

You are synthesizing research into an actionable paid media strategy with compelling copywriting angles.

CONTEXT FROM ALL RESEARCH:
${allContext}

TASK: Create a cohesive strategic blueprint that connects all insights with persuasive messaging.

SYNTHESIS APPROACH:
1. Extract 5-7 key insights (at least one from each section)
2. Develop a clear positioning strategy with 2-3 alternatives to test
3. Use your copywriting expertise for the messaging framework

${MESSAGING_ANGLES_PROMPT}

MESSAGING FRAMEWORK REQUIREMENTS:
- Core message: One memorable takeaway
- Ad hooks: 5-10 using pattern interrupt techniques (controversial, revelation, myth-bust, status-quo-challenge, curiosity-gap, story)
- Angles: 4-6 distinct advertising angles with target emotions and example headlines
- Proof points: 3-6 claims backed by evidence from the research
- Objection handlers: 4-8 common objections with responses AND reframes
- Tonal guidelines: Voice, words to avoid, power words to use

QUALITY STANDARDS:
- Hooks should stop the scroll, not be generic
- Angles must be specific to THIS business
- Proof points need real evidence from the research
- Objection reframes should turn negatives into positives
- Platform recommendations need clear reasoning
- Next steps achievable in 2 weeks`,

      prompt: `Create a strategic paid media blueprint for:\n\n${context}`,
      ...GENERATION_SETTINGS.synthesis,
    });

    return {
      data: result.object,
      sources: [], // Claude doesn't have web search
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('crossAnalysis', error);
    throw error;
  }
}
