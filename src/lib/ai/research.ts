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
  summaryCompetitorBatchSchema,
} from './schemas';
import type {
  ICPAnalysisValidation,
  CompetitorAnalysis,
  SummaryCompetitorBatch,
} from './schemas';
import type {
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  CrossAnalysisResult,
  SummaryCompetitorResult,
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
// Retry wrapper for schema validation failures
// generateObject retries network errors internally but NOT schema mismatches.
// This wraps the full call so a fresh model response is requested on mismatch.
// =============================================================================
const SCHEMA_RETRY_MAX = 2; // up to 2 additional attempts (3 total)

async function withSchemaRetry<T>(
  fn: () => Promise<T>,
  section: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= SCHEMA_RETRY_MAX; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof NoObjectGeneratedError && attempt < SCHEMA_RETRY_MAX) {
        console.warn(
          `[${section}] Schema mismatch on attempt ${attempt + 1}/${SCHEMA_RETRY_MAX + 1}, retrying...`
        );
        continue;
      }
      throw error;
    }
  }
  throw lastError; // unreachable but satisfies TS
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
    const result = await withSchemaRetry(
      () => generateObject({
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
      }),
      'industryMarket',
    );

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
    const result = await withSchemaRetry(
      () => generateObject({
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

ADDITIONAL ICP REQUIREMENTS:

TRIGGER EVENT ANALYSIS:
For each ICP segment, identify 4-6 specific trigger events that create an active buying window. For each trigger:
- Event description (e.g., "New CMO hired at target company")
- Estimated annual frequency across TAM (e.g., "~8% CMO turnover annually in B2B SaaS = ~2,400 events/year")
- Urgency level: immediate (0-30 days), near-term (1-3 months), planning-cycle (3-6 months)
- Detection method for paid targeting (e.g., "LinkedIn job change alerts", "Crunchbase funding alerts")
- Recommended ad hook tied to this trigger
Trigger events MUST be specific and targetable, not generic. Bad: "Company needs better attribution." Good: "VP Marketing hired at Series B company in last 90 days — needs quick wins to prove value."

SEGMENT SIZING & PRIORITIZATION:
For each ICP segment, estimate:
- Total addressable accounts (number of companies matching firmographics)
- Total addressable contacts (number of individuals in target roles at those companies)
- Segment share of total ICP (as percentage)
- Priority tier (1 = highest) based on raw factor scores you provide for: painSeverity (1-10), budgetAuthority (1-10), reachability (1-10), triggerFrequency (1-10). Just provide the raw scores — composite rank will be computed separately.
- Recommended budget weight (percentage of total paid budget)
These are DIRECTIONAL estimates for planning purposes. Label them as estimated and cite your data sources (LinkedIn, Crunchbase, industry reports).

SAM ESTIMATE:
Calculate Serviceable Addressable Market:
- Start with total companies matching firmographic criteria (size, industry, geography)
- Apply filtering funnel: has active paid advertising, uses relevant tech stack, has budget authority role
- Output the filtering funnel with count and drop-off reason at each stage
- Provide confidence level (high/medium/low) based on data source quality

SENSITIVITY ANALYSIS (replaces simple economic feasibility):
Provide three scenarios with assumed CPL and conversion rates for each:

BEST CASE (top 25th percentile): lowest realistic CPL, highest realistic conversion rates, conditions required
BASE CASE (median expected): median CPL/rates from industry data, confidence level percentage
WORST CASE (bottom 25th percentile / first 30 days): highest realistic CPL, conservative rates, conditions causing this

BREAK-EVEN ANALYSIS: maximum CPL before LTV:CAC drops below 3:1, maximum CAC before unprofitable, minimum lead-to-SQL rate for 3:1, budget floor for statistical testing significance.

For each scenario, provide ONLY the assumed CPL and conversion rates. The resulting CAC, customer count, and LTV:CAC ratio will be computed from those inputs deterministically.
Apply 20% margin of error to all projections for planning safety.

NUMERICAL RISK SCORING:
Assess risks across these categories (first 5 required, last 3 only if relevant data exists):
1. audience_reachability — ICP size on target platforms vs budget
2. budget_adequacy — budget vs platform minimums and competitive CPC
3. pain_strength — is pain acute enough for cold traffic conversion?
4. competitive_intensity — ad auction density and competitor spend
5. proof_credibility — can the client substantiate ad claims?
6. platform_policy — offer compliance with ad policies (only if compliance data provided)
7. seasonality — timing with buying cycles (only if seasonal patterns detected)
8. data_quality — tracking/attribution readiness (only if relevant signals)

For each risk provide: description, category, probability (1-5), impact (1-5), and optionally: early warning indicator, mitigation, contingency, budget impact estimate. Provide only the raw probability and impact scores — the composite score and classification will be computed separately.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

        prompt: `Validate the ICP for paid media:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
        maxOutputTokens: 4096,  // Override: ICP output is ~2-4K tokens
      }),
      'icpAnalysis',
    );

    const processedData = postProcessICPAnalysis(result.object);

    return {
      data: processedData,
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
    const result = await withSchemaRetry(
      () => generateObject({
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
        maxOutputTokens: 4096,  // Override: Offer output is ~2-4K tokens
      }),
      'offerAnalysis',
    );

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
  context: string,
  fullTierNames?: string[],
): Promise<CompetitorAnalysisResult> {
  const model = SECTION_MODELS.competitorAnalysis;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
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
${fullTierNames && fullTierNames.length > 0
  ? `1. Research these specific competitors in depth: ${fullTierNames.join(', ')}.
   The client named these as their competitive landscape — analyze ALL of them.
   If any additional major competitors are discovered during research, include them too.`
  : '1. Identify 3-5 direct competitors'}
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

COMPETITOR THREAT ASSESSMENT:
For each competitor, score these 5 threat factors (1-10 each):
- marketShareRecognition: Brand recognition and market share
- adSpendIntensity: Estimated monthly ad spend level
- productOverlap: Feature overlap with client offer
- priceCompetitiveness: Price competitiveness vs client
- growthTrajectory: Funding, hiring, feature velocity

The weighted threat score and classification will be computed separately from these raw scores. For competitors you assess as high-threat based on these factors, also provide:
- Their top 3 ad hooks (extracted from ad library research)
- Their likely response if client gains market share
- Recommended counter-positioning for media plan creative strategy

WHITE SPACE ANALYSIS:
Systematically identify gaps using this framework:

1. Messaging White Space — messaging angles NO competitor is using or severely underinvesting in
2. Feature/Capability White Space — capabilities unaddressed, addressed poorly (low G2 scores), or addressed but not marketed
3. Audience White Space — ICP sub-segments competitors are ignoring (job titles, company stages, geographies, industries)
4. Channel White Space — platforms with <2 active competitor ads, unused ad formats, funnel stages with no competitor presence

For each gap, provide: description, type (messaging/feature/audience/channel), evidence of what competitors do instead, exploitability score (1-10), impact score (1-10), and recommended action for the media plan. The composite score will be computed separately.

Identify at minimum 3 gaps, aiming for 5-8 across all 4 types.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

        prompt: `Research competitors for:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'competitorAnalysis',
    );

    // NOTE: The generator will enrich this with:
    // - scrapePricingForCompetitors() → Real pricing from Firecrawl
    // - fetchCompetitorAds() → Real ads from Ad Library
    // This function returns base research only

    const processedData = postProcessCompetitorAnalysis(result.object);

    return {
      data: processedData,
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
// Section 4b: Summary Competitor Research (lightweight batch)
// Model: Sonar Pro (research)
// =============================================================================

export async function researchSummaryCompetitors(
  context: string,
  summaryNames: string[],
): Promise<SummaryCompetitorResult> {
  const model = SECTION_MODELS.competitorAnalysis;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: perplexity(model),
        schema: summaryCompetitorBatchSchema,
        system: `You are an expert competitive analyst providing brief competitive snapshots.

TASK: For each competitor listed below, provide a concise competitive snapshot.

REQUIREMENTS:
- One-sentence positioning statement per competitor
- Brief product/service description (1-2 sentences)
- Pricing tier or "See pricing page" if unknown (do NOT guess exact prices)
- 1-3 key strengths from market research
- 1-3 key weaknesses from G2, Capterra, or market positioning gaps
- ALWAYS include the official website URL if found

QUALITY: Be specific. Use real company names and verified information. Do not fabricate data.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.`,

        prompt: `Provide brief competitive snapshots for these companies:\n\n${summaryNames.join(', ')}\n\nBusiness context:\n${context}`,
        ...GENERATION_SETTINGS.research,
        maxOutputTokens: 2048,
      }),
      'summaryCompetitors',
    );

    return {
      data: result.object,
      sources: [],
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logGenerationError('summaryCompetitors', error);
    throw error;
  }
}

// =============================================================================
// Deterministic Post-Processing
// Compute scores/classifications that the AI was told would be "computed separately"
// These fields are intentionally omitted from Zod schemas (so AI doesn't hallucinate
// them) and added here post-generation. The extended types use Record intersections
// to allow the additional computed properties.
// =============================================================================

/** Risk score entry with computed fields added post-generation */
type RiskScoreWithComputed = ICPAnalysisValidation['riskScores'][number] & {
  score: number;
  classification: 'low' | 'medium' | 'high' | 'critical';
};

/** Segment sizing entry with computed composite rank */
type SegmentSizingWithComputed = ICPAnalysisValidation['segmentSizing'][number] & {
  compositeRank?: number;
};

/** White space gap with computed composite score */
type WhiteSpaceGapWithComputed = CompetitorAnalysis['whiteSpaceGaps'][number] & {
  compositeScore: number;
};

/** Competitor threat assessment with computed weighted score */
type ThreatAssessmentWithComputed = NonNullable<CompetitorAnalysis['competitors'][number]['threatAssessment']> & {
  weightedThreatScore: number;
  classification: 'primary' | 'secondary' | 'low';
};

/** Compute deterministic fields on ICP research output */
function postProcessICPAnalysis(data: ICPAnalysisValidation): ICPAnalysisValidation {
  // Compute risk scores
  if (data.riskScores) {
    (data as any).riskScores = data.riskScores.map((risk): RiskScoreWithComputed => ({
      ...risk,
      score: risk.probability * risk.impact,
      classification: classifyRiskScore(risk.probability * risk.impact),
    }));
  }

  // Compute segment sizing composite ranks
  if (data.segmentSizing) {
    const withRanks: SegmentSizingWithComputed[] = data.segmentSizing.map(seg => ({
      ...seg,
      compositeRank: seg.priorityFactors
        ? seg.priorityFactors.painSeverity * seg.priorityFactors.budgetAuthority *
          seg.priorityFactors.reachability * seg.priorityFactors.triggerFrequency
        : undefined,
    }));
    // Sort by composite rank descending, assign priority tiers
    const sorted = [...withRanks].sort((a, b) => (b.compositeRank ?? 0) - (a.compositeRank ?? 0));
    sorted.forEach((seg, i) => { seg.priorityTier = i + 1; });
    (data as any).segmentSizing = sorted;
  }

  return data;
}

function classifyRiskScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 6) return 'low';
  if (score <= 12) return 'medium';
  if (score <= 19) return 'high';
  return 'critical';
}

/** Compute deterministic fields on competitor research output */
function postProcessCompetitorAnalysis(data: CompetitorAnalysis): CompetitorAnalysis {
  // Tag all competitors from full research with analysisDepth: 'full'
  if (data.competitors) {
    data.competitors = data.competitors.map(c => ({
      ...c,
      analysisDepth: 'full' as const,
    }));
  }

  // Compute white space composite scores
  if (data.whiteSpaceGaps) {
    const withScores: WhiteSpaceGapWithComputed[] = data.whiteSpaceGaps
      .map(gap => ({
        ...gap,
        compositeScore: gap.exploitability * gap.impact,
      }));
    withScores.sort((a, b) => b.compositeScore - a.compositeScore);
    (data as any).whiteSpaceGaps = withScores;
  }

  // Compute competitor threat scores (weighted: market 25%, adSpend 20%, product 25%, price 15%, growth 15%)
  if (data.competitors) {
    data.competitors = data.competitors.map(comp => {
      if (comp.threatAssessment?.threatFactors) {
        const f = comp.threatAssessment.threatFactors;
        const weightedScore =
          f.marketShareRecognition * 0.25 +
          f.adSpendIntensity * 0.20 +
          f.productOverlap * 0.25 +
          f.priceCompetitiveness * 0.15 +
          f.growthTrajectory * 0.15;
        const classification = weightedScore >= 7.0 ? 'primary' as const
          : weightedScore >= 4.0 ? 'secondary' as const
          : 'low' as const;
        const enrichedThreat: ThreatAssessmentWithComputed = {
          ...comp.threatAssessment,
          weightedThreatScore: Math.round(weightedScore * 10) / 10,
          classification,
        };
        return {
          ...comp,
          threatAssessment: enrichedThreat as typeof comp.threatAssessment,
        };
      }
      return comp;
    });
  }

  return data;
}

// =============================================================================
// Section 5: Cross-Analysis Synthesis
// Model: Claude Sonnet 4 (strategic prose)
// =============================================================================

export async function synthesizeCrossAnalysis(
  context: string,
  sections: AllSectionResults,
  keywordData?: import('@/lib/strategic-blueprint/output-types').KeywordIntelligence,
  seoAuditData?: import('@/lib/strategic-blueprint/output-types').SEOAuditData,
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

Key Recommendations:
${sections.industryMarket.messagingOpportunities.summaryRecommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: ICP ANALYSIS & VALIDATION
═══════════════════════════════════════════════════════════════════════════════
Validation Status: ${sections.icpAnalysis.finalVerdict.status.toUpperCase()}
Reasoning: ${sections.icpAnalysis.finalVerdict.reasoning}

Pain-Solution Fit: ${sections.icpAnalysis.painSolutionFit.fitAssessment}
Primary Pain: ${sections.icpAnalysis.painSolutionFit.primaryPain}

Risk Scores:
${(sections.icpAnalysis.riskScores || []).map((rs: { category: string; risk: string; probability: number; impact: number; classification?: string }) =>
  `- ${rs.category}: ${rs.risk} (P:${rs.probability} x I:${rs.impact}${rs.classification ? ` = ${rs.classification}` : ''})`
).join('\n')}

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
SECTION 4A: FULL COMPETITOR ANALYSIS (Deep Research + Enrichment)
═══════════════════════════════════════════════════════════════════════════════
${(() => {
  const fullTier = sections.competitorAnalysis.competitors.filter(c => (c as any).analysisDepth !== 'summary');
  const summaryTier = sections.competitorAnalysis.competitors.filter(c => (c as any).analysisDepth === 'summary');

  let text = `Full-Tier Competitors Analyzed: ${fullTier.length}\n`;
  text += fullTier.map(c => `
${c.name}:
- Positioning: ${c.positioning}
- Strengths: ${c.strengths.join(', ')}
- Weaknesses: ${c.weaknesses.join(', ')}
`).join('\n');

  if (summaryTier.length > 0) {
    text += `\n═══════════════════════════════════════════════════════════════════════════════
SECTION 4B: BROADER COMPETITIVE LANDSCAPE (Summary Research)
═══════════════════════════════════════════════════════════════════════════════
Summary-Tier Competitors: ${summaryTier.length}\n`;
    text += summaryTier.map(c =>
      `${c.name}: ${c.positioning} | Price: ${c.price} | Strengths: ${c.strengths.join(', ')} | Weaknesses: ${c.weaknesses.join(', ')}`
    ).join('\n');
    text += `\n\nCOMPLETE COMPETITOR LANDSCAPE:
Full analysis (${fullTier.length}): ${fullTier.map(c => c.name).join(', ')}
Summary analysis (${summaryTier.length}): ${summaryTier.map(c => c.name).join(', ')}
Note: Full competitive profiles generated for top ${fullTier.length} competitors based on market presence.
Summary profiles included for all remaining competitors.`;
  }

  return text;
})()}

Market Gaps:
${(sections.competitorAnalysis.whiteSpaceGaps || []).map((g: { gap: string; type: string; exploitability: number; impact: number }, i: number) =>
  `${i + 1}. [${g.type}] ${g.gap} (exploitability: ${g.exploitability}, impact: ${g.impact})`
).join('\n')}

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
    const topAds = c.adCreatives.slice(0, 2);
    const adsText = topAds.map((ad: any, i: number) => {
      const parts = [`  Ad ${i + 1} [${ad.platform}]:`];
      if (ad.headline) parts.push(`    Headline: "${ad.headline}"`);
      if (ad.body) parts.push(`    Body: "${ad.body.slice(0, 120)}${ad.body.length > 120 ? '...' : ''}"`);
      return parts.join('\n');
    }).join('\n\n');

    const remaining = c.adCreatives.length - topAds.length;
    return `${c.name} Ads (${c.adCreatives.length} found, showing top ${topAds.length}):\n${adsText}${remaining > 0 ? `\n  (+${remaining} more ads available in data)` : ''}`;
  }).join('\n\n');
})()}

${keywordData ? `
═══════════════════════════════════════════════════════════════════════════════
KEYWORD INTELLIGENCE (SpyFu competitive keyword data)
═══════════════════════════════════════════════════════════════════════════════

DOMAIN COMPARISON:
${keywordData.clientDomain ? `Client (${keywordData.clientDomain.domain}): ${keywordData.clientDomain.organicKeywords} organic KWs, ${keywordData.clientDomain.paidKeywords} paid KWs, ~${keywordData.clientDomain.monthlyOrganicClicks.toLocaleString()} organic clicks/mo ($${keywordData.clientDomain.organicClicksValue.toLocaleString()} value), ~${keywordData.clientDomain.monthlyPaidClicks.toLocaleString()} paid clicks/mo ($${keywordData.clientDomain.paidClicksValue.toLocaleString()} ad spend)` : 'Client domain: N/A'}
${keywordData.competitorDomains.map(c => `Competitor (${c.domain}): ${c.organicKeywords} organic KWs, ${c.paidKeywords} paid KWs, ~${c.monthlyOrganicClicks.toLocaleString()} organic clicks/mo ($${c.organicClicksValue.toLocaleString()} value), ~${c.monthlyPaidClicks.toLocaleString()} paid clicks/mo ($${c.paidClicksValue.toLocaleString()} ad spend)`).join('\n') || '  No competitor domain data'}

TOP ORGANIC GAPS (competitors rank, client doesn't — content creation targets):
${keywordData.organicGaps.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}, $${k.cpc.toFixed(2)} CPC${k.clicksPerMonth ? `, ~${k.clicksPerMonth} clicks/mo` : ''}`).join('\n') || '  None found'}${keywordData.organicGaps.length > 5 ? `\n  (+${keywordData.organicGaps.length - 5} more in data)` : ''}

TOP PAID GAPS (competitors bid, client doesn't — PPC opportunities):
${keywordData.paidGaps.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, $${k.cpc.toFixed(2)} CPC, difficulty ${k.difficulty}`).join('\n') || '  None found'}${keywordData.paidGaps.length > 5 ? `\n  (+${keywordData.paidGaps.length - 5} more in data)` : ''}

SHARED KEYWORDS (both client and competitors rank — competitive battlegrounds):
${keywordData.sharedKeywords.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}`).join('\n') || '  None found'}

CLIENT STRENGTHS (only client ranks, competitors don't — DEFEND these):
${keywordData.clientStrengths.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}`).join('\n') || '  None found'}

QUICK WIN KEYWORDS (difficulty ≤40, volume ≥100 — immediate organic targets):
${keywordData.quickWins.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}, $${k.cpc.toFixed(2)} CPC`).join('\n') || '  None found'}

LONG-TERM PLAYS (difficulty >40, volume ≥500 — build authority over 3-6 months):
${keywordData.longTermPlays.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}`).join('\n') || '  None found'}

HIGH-INTENT KEYWORDS (CPC ≥$3 = strong commercial/buying intent):
${keywordData.highIntentKeywords.slice(0, 5).map(k => `  • "${k.keyword}" — $${k.cpc.toFixed(2)} CPC, ${k.searchVolume}/mo`).join('\n') || '  None found'}

RELATED KEYWORD EXPANSIONS (thematic opportunities beyond direct gaps):
${keywordData.relatedExpansions.slice(0, 5).map(k => `  • "${k.keyword}" — ${k.searchVolume}/mo, difficulty ${k.difficulty}`).join('\n') || '  None found'}

CONTENT TOPIC CLUSTERS (grouped keyword themes):
${keywordData.contentTopicClusters.slice(0, 5).map(c => `  • "${c.theme}" — ${c.searchVolumeTotal.toLocaleString()} total vol, ${c.keywords.length} keywords, recommended: ${c.recommendedFormat}`).join('\n') || '  None found'}

${keywordData.competitorTopKeywords?.length > 0 ? `COMPETITOR TOP KEYWORDS:
${keywordData.competitorTopKeywords.map(c => {
  const topKws = c.keywords.slice(0, 3);
  if (topKws.length === 0) return `  ${c.competitorName} (${c.domain}): No relevant overlapping keywords found`;
  return `  ${c.competitorName} (${c.domain}): ${topKws.map(k => `"${k.keyword}" (${k.searchVolume}/mo)`).join(', ')}`;
}).join('\n')}` : ''}

SUMMARY STATS: ${keywordData.metadata.totalKeywordsAnalyzed} keywords analyzed across ${keywordData.metadata.competitorDomainsAnalyzed.length} competitor domains

KEYWORD DATA USAGE:
- Map organic gaps (difficulty <30) to quick-win content targets with exact keywords and volumes
- Use high-CPC keywords ($5+) as PPC campaign targets — proven commercial intent
- Cross-reference gaps with Section 1 pain points to find critical content gaps
- Use topic clusters for 3-month content calendar recommendations
- Include 3+ keyword-specific next steps with exact keywords, volumes, difficulty scores
- If 80%+ gaps have difficulty >60, prioritize PPC over organic; if <40, prioritize content
` : ''}
${seoAuditData ? `
═══════════════════════════════════════════════════════════════════════════════
SEO TECHNICAL AUDIT (Firecrawl HTML crawl + PageSpeed Insights — real data)
═══════════════════════════════════════════════════════════════════════════════
Overall SEO Score: ${seoAuditData.overallScore}/100 (Technical: ${seoAuditData.technical.overallScore}/100, Performance: ${seoAuditData.performance.mobile?.performanceScore ?? seoAuditData.performance.desktop?.performanceScore ?? 'N/A'}/100)

TECHNICAL ISSUES:
• ${seoAuditData.technical.issueCount.critical} critical issues, ${seoAuditData.technical.issueCount.warning} warnings, ${seoAuditData.technical.issueCount.pass} passed checks
• Sitemap: ${seoAuditData.technical.sitemapFound ? 'Found' : 'MISSING'}
• Robots.txt: ${seoAuditData.technical.robotsTxtFound ? 'Found' : 'MISSING'}
${seoAuditData.technical.pages.map(p => {
  const issues: string[] = [];
  if (!p.title.pass) issues.push(`title ${p.title.length === 0 ? 'missing' : `${p.title.length} chars`}`);
  if (!p.metaDescription.pass) issues.push(`meta desc ${p.metaDescription.length === 0 ? 'missing' : `${p.metaDescription.length} chars`}`);
  if (!p.h1.pass) issues.push(`${p.h1.values.length} H1 tags`);
  if (!p.canonical.pass) issues.push('no canonical');
  if (p.images.coveragePercent < 80) issues.push(`${p.images.coveragePercent}% img alt coverage`);
  return issues.length > 0 ? `  ${p.url}: ${issues.join(', ')}` : null;
}).filter(Boolean).slice(0, 5).join('\n')}

PAGESPEED:
${seoAuditData.performance.mobile ? `• Mobile: ${seoAuditData.performance.mobile.performanceScore}/100 — LCP ${seoAuditData.performance.mobile.lcp}s, CLS ${seoAuditData.performance.mobile.cls}, FCP ${seoAuditData.performance.mobile.fcp}s` : '• Mobile: Not available'}
${seoAuditData.performance.desktop ? `• Desktop: ${seoAuditData.performance.desktop.performanceScore}/100 — LCP ${seoAuditData.performance.desktop.lcp}s, CLS ${seoAuditData.performance.desktop.cls}, FCP ${seoAuditData.performance.desktop.fcp}s` : '• Desktop: Not available'}

SEO DATA USAGE:
- Reference specific technical issues in nextSteps (e.g., "Fix missing meta descriptions on /about and /blog")
- Tie performance scores to criticalSuccessFactors
- Cross-reference keyword gaps with missing page titles to identify SEO quick wins
` : ''}
IMPORTANT: When creating adHooks in messagingFramework, prioritize EXTRACTING hooks from the real ads above.
Mark each hook's source.type as "extracted" (verbatim), "inspired" (based on pattern), or "generated" (no matching ad).

═══════════════════════════════════════════════════════════════════════════════
COMPETITOR CUSTOMER REVIEWS (Ground truth from Trustpilot scrapes + G2 metadata)
═══════════════════════════════════════════════════════════════════════════════
${(() => {
  const competitors = sections.competitorAnalysis.competitors as any[];
  const competitorsWithReviews = competitors.filter(
    (c) => c.reviewData?.trustpilot || c.reviewData?.g2,
  );

  if (competitorsWithReviews.length === 0) {
    return 'No competitor review data available.';
  }

  return competitorsWithReviews
    .map((c) => {
      const parts: string[] = [`${c.name}:`];
      const rd = c.reviewData;

      if (rd?.g2) {
        parts.push(`  G2: ${rd.g2.rating}/5 from ${rd.g2.reviewCount} reviews${rd.g2.productCategory ? ` (${rd.g2.productCategory})` : ''}`);
      }
      if (rd?.trustpilot) {
        parts.push(`  Trustpilot: ${rd.trustpilot.trustScore}/5 from ${rd.trustpilot.totalReviews} reviews`);
        if (rd.trustpilot.aiSummary) {
          parts.push(`  Trustpilot AI Summary: "${rd.trustpilot.aiSummary.slice(0, 150)}${rd.trustpilot.aiSummary.length > 150 ? '...' : ''}"`);
        }
        // Key complaints (1-2★) — gold for messaging angles
        const complaints = rd.trustpilot.reviews
          ?.filter((r: any) => r.rating <= 2)
          .slice(0, 2);
        if (complaints?.length > 0) {
          parts.push('  Key Complaints:');
          for (const r of complaints) {
            parts.push(`    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} "${r.text.slice(0, 100)}${r.text.length > 100 ? '...' : ''}"`);
          }
        }
        // What customers love (4-5★)
        const praise = rd.trustpilot.reviews
          ?.filter((r: any) => r.rating >= 4)
          .slice(0, 1);
        if (praise?.length > 0) {
          parts.push('  What Customers Love:');
          for (const r of praise) {
            parts.push(`    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} "${r.text.slice(0, 100)}${r.text.length > 100 ? '...' : ''}"`);
          }
        }
      }

      return parts.join('\n');
    })
    .join('\n\n');
})()}

REVIEW DATA USAGE:
- Turn competitor complaints into positioning angles (poor support → "white-glove service")
- Use verbatim customer language in ad hooks — their words resonate more than marketer-speak
- Cite specific ratings (e.g., "rated 2.1/5 on Trustpilot") as proof points
- Use praise to identify confirmed buying criteria the market rewards
`;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
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
4. Mine competitor reviews for positioning gold — at least ONE key insight must reference specific review data (ratings, complaint patterns, or customer language). Competitor review complaints are GROUND TRUTH weaknesses, more reliable than inferred ones.

${MESSAGING_ANGLES_PROMPT}

MESSAGING FRAMEWORK REQUIREMENTS:
- Core message: One memorable takeaway
- Ad hooks: exactly 12 using pattern interrupt techniques (controversial, revelation, myth-bust, status-quo-challenge, curiosity-gap, story, fear, social-proof, urgency, authority, comparison). When review data is available, at least 2 hooks should use verbatim customer language or pain points from competitor reviews.
  HOOK DIVERSITY RULES:
  - MAX 2 hooks from any single competitor (across extracted + inspired types)
  - When only 1-2 competitors have ad data: max 2 EXTRACTED, 4 INSPIRED, 6 GENERATED
  - When 3+ competitors have ad data: 4 EXTRACTED, 4 INSPIRED, 4 GENERATED
  - When NO competitors have ad data: 6 INSPIRED, 6 GENERATED
  - Every INSPIRED/GENERATED hook MUST match the CLIENT's target segment — do NOT write hooks about a competitor's audience
- Angles: 4-6 distinct advertising angles with target emotions and example headlines
- Proof points: 3-6 claims backed by evidence from the research. Include competitor review ratings/scores as concrete evidence where available (e.g., "Competitor X rated 2.1/5 on Trustpilot for support").
- Objection handlers: 4-8 common objections with responses AND reframes. Use competitor review complaints to inform responses — if customers complain about a competitor's flaw, reference that reality when handling the same objection for our client.
- Tonal guidelines: Voice, words to avoid, power words to use

QUALITY STANDARDS:
- Hooks should stop the scroll, not be generic
- Angles must be specific to THIS business
- Proof points need real evidence from the research
- Objection reframes should turn negatives into positives
- When review data is available, at least one key insight and one positioning angle must explicitly cite review findings (e.g., "Competitor X's Trustpilot complaints about [issue] reveal...")
- Objection reframes should reference competitor review failures as cautionary evidence
- Platform recommendations need clear reasoning
- Next steps achievable in 2 weeks
- When keyword intelligence is available: include at least 3 keyword-specific next steps with exact keywords, volumes, and difficulty scores. Reference keyword data in platform recommendations (difficulty distribution informs organic vs PPC priority). Use high-CPC keywords as evidence of commercial intent in messaging angles.
- When SEO audit data is available: reference specific technical issues (missing meta descriptions, missing H1 tags, slow LCP) in nextSteps as actionable items. Include PageSpeed scores in criticalSuccessFactors if performance is poor (<70). Cross-reference keyword gaps with pages that have weak/missing titles for quick-win SEO fixes.

COMPETITOR TIERING:
- Full-tier competitors: generate deep competitive profiles with ad strategy, pricing comparison, review sentiment, SEO gaps
- Summary-tier competitors: generate a brief snapshot (1 paragraph each) in a "Broader Competitive Landscape" subsection
- Your output MUST mention ALL competitors — no competitor should be silently omitted
- Do NOT fabricate ad analysis, review scores, or pricing details for summary-tier competitors — only use data actually available
- Include a complete competitor landscape table with ALL competitor names, what they do, pricing tier, and analysis depth`,

        prompt: `Create a strategic paid media blueprint for:\n\n${context}`,
        ...GENERATION_SETTINGS.synthesis,
      }),
      'crossAnalysis',
    );

    return {
      data: result.object,
      sources: [], // Claude doesn't have web search
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    if (error instanceof NoObjectGeneratedError && error.text) {
      // Recovery 1: Anthropic tool-use mode sometimes wraps JSON in {"$PARAMETER_NAME": {...}}.
      const unwrapped = tryUnwrapParameterName(error.text, crossAnalysisSchema);
      if (unwrapped) {
        console.warn('[crossAnalysis] Recovered from $PARAMETER_NAME wrapper — unwrapped successfully');
        return {
          data: unwrapped,
          sources: [],
          usage: { inputTokens: error.usage?.inputTokens ?? 0, outputTokens: error.usage?.outputTokens ?? 0, totalTokens: error.usage?.totalTokens ?? 0 },
          cost: estimateCost(model, error.usage?.inputTokens ?? 0, error.usage?.outputTokens ?? 0),
          model,
        };
      }

      // Recovery 2: LLMs sometimes return deeply nested objects as JSON strings
      // (e.g. messagingFramework: "{\"coreMessage\":...}" instead of an object).
      // Attempt to JSON.parse any string fields that should be objects.
      const fixedStringified = tryFixStringifiedFields(error.text, crossAnalysisSchema);
      if (fixedStringified) {
        console.warn('[crossAnalysis] Recovered from stringified nested fields — parsed successfully');
        return {
          data: fixedStringified,
          sources: [],
          usage: { inputTokens: error.usage?.inputTokens ?? 0, outputTokens: error.usage?.outputTokens ?? 0, totalTokens: error.usage?.totalTokens ?? 0 },
          cost: estimateCost(model, error.usage?.inputTokens ?? 0, error.usage?.outputTokens ?? 0),
          model,
        };
      }
    }
    logGenerationError('crossAnalysis', error);
    throw error;
  }
}

/**
 * Attempt to unwrap a `{"$PARAMETER_NAME": {...data...}}` wrapper that Anthropic
 * sometimes emits in tool-use mode. Returns the parsed + validated inner object,
 * or null if unwrapping fails or the inner data doesn't match the schema.
 */
function tryUnwrapParameterName<T>(
  rawText: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T | null {
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const keys = Object.keys(parsed);
    // Only unwrap if there's exactly one key and it's not a valid schema key
    if (keys.length !== 1) return null;
    const innerKey = keys[0];

    const inner = parsed[innerKey];
    if (typeof inner !== 'object' || inner === null) return null;

    const result = schema.safeParse(inner);
    if (result.success) return result.data as T;

    return null;
  } catch {
    return null;
  }
}

/**
 * LLMs sometimes return deeply nested objects as JSON strings instead of objects.
 * For example: `messagingFramework: "{\"coreMessage\":...}"` instead of an object.
 * This walks the parsed response and JSON.parses any string values that look like
 * JSON objects or arrays, then re-validates against the schema.
 */
function tryFixStringifiedFields<T>(
  rawText: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T | null {
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed !== 'object' || parsed === null) return null;

    let didFix = false;
    for (const key of Object.keys(parsed)) {
      const val = parsed[key];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            parsed[key] = JSON.parse(trimmed);
            didFix = true;
          } catch {
            // Not valid JSON string — leave as-is
          }
        }
      }
    }

    if (!didFix) return null;

    const result = schema.safeParse(parsed);
    if (result.success) return result.data as T;

    return null;
  } catch {
    return null;
  }
}
