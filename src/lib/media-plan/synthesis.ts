// Media Plan Synthesis — Phase 2/3 Claude Sonnet Calls
// Creative synthesis sections that need AI reasoning but not web research.
// Follows src/lib/ai/research.ts pattern.

import { generateObject, NoObjectGeneratedError } from 'ai';
import {
  anthropic,
  MODELS,
  GENERATION_SETTINGS,
  estimateCost,
} from '@/lib/ai/providers';
import {
  phase2CampaignStructureSchema,
  phase2CreativeStrategySchema,
  phase2CampaignPhasesSchema,
  phase2BudgetMonitoringSchema,
  phase3ExecutiveSummarySchema,
  phase3RiskMonitoringSchema,
  type Phase2CampaignStructureOutput,
  type Phase2CreativeStrategyOutput,
  type Phase2CampaignPhasesOutput,
  type Phase2BudgetMonitoringOutput,
  type Phase3ExecutiveSummaryOutput,
  type Phase3RiskMonitoringOutput,
} from './phase-schemas';

// =============================================================================
// Types
// =============================================================================

export interface SynthesisResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  cost: number;
  model: string;
}

// =============================================================================
// Retry wrapper (handles schema mismatch + rate limit errors)
// =============================================================================

const SCHEMA_RETRY_MAX = 2;
const RATE_LIMIT_RETRY_MAX = 3;
const RATE_LIMIT_BASE_DELAY_MS = 15_000; // 15s base — rate limit window is per minute

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('429') || msg.includes('output tokens per minute');
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withSchemaRetry<T>(
  fn: () => Promise<T>,
  section: string,
): Promise<T> {
  let lastError: unknown;
  let rateLimitRetries = 0;

  for (let attempt = 0; attempt <= SCHEMA_RETRY_MAX; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Rate limit: exponential backoff with longer delays
      if (isRateLimitError(error) && rateLimitRetries < RATE_LIMIT_RETRY_MAX) {
        rateLimitRetries++;
        const delay = RATE_LIMIT_BASE_DELAY_MS * rateLimitRetries;
        console.warn(`[MediaPlan:${section}] Rate limited (attempt ${rateLimitRetries}/${RATE_LIMIT_RETRY_MAX}), waiting ${delay / 1000}s...`);
        await sleep(delay);
        attempt--; // Don't count rate limit retries against schema retries
        continue;
      }

      // Schema mismatch: immediate retry
      if (error instanceof NoObjectGeneratedError && attempt < SCHEMA_RETRY_MAX) {
        console.warn(`[MediaPlan:${section}] Schema mismatch on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function logError(section: string, error: unknown): void {
  console.error(`[MediaPlan:${section}] Synthesis failed:`, error);
  if (error instanceof NoObjectGeneratedError) {
    console.error(`[MediaPlan:${section}] Raw text:`, error.text?.slice(0, 2000));
  }
}

const SONNET_MODEL = MODELS.CLAUDE_SONNET;

// Per-section output token limits — generous to avoid mid-word truncation.
// Pipeline runs Phase 2 sequentially with rate-limit retry as safety net.
const SECTION_MAX_TOKENS: Record<string, number> = {
  campaignStructure: 8000,   // largest section: campaigns, ad sets, naming, retargeting, negatives
  creativeStrategy: 5000,    // angles, format specs, testing plan, refresh cadence, brand guidelines
  campaignPhases: 4000,      // 3-4 phases with activities and criteria
  budgetAndMonitoring: 4500, // budget allocation + monitoring schedule
  executiveSummary: 2048,    // short summary — fine as-is
  riskMonitoring: 3500,      // risks + assumptions
};

// =============================================================================
// Phase 2A: Campaign Structure
// =============================================================================

export async function synthesizeCampaignStructure(
  context: string,
): Promise<SynthesisResult<Phase2CampaignStructureOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase2CampaignStructureSchema,
        system: `You are a senior media buyer designing campaign structure for paid advertising.

TASK: Create a detailed campaign structure with templates, naming conventions, retargeting segments, and negative keywords.

RULES:
- Minimum 3 campaigns across funnel stages: cold (prospecting), warm (retargeting), hot (conversion)
- Cold campaigns get 50-70% of budget. Warm 20-30%. Hot 10-20%
- 1-3 ad sets per campaign, each testing a different audience or targeting variable
- Campaign names MUST follow the naming convention pattern exactly
- UTM parameters are REQUIRED for every campaign
- Include negative keywords for search campaigns (exclude job seekers, free-tier seekers)
- All campaigns must reference ONLY platforms from the validated platform strategy
- All targeting must reference ONLY segments from the validated ICP targeting
- Do NOT include citation markers like [1], [5], [8], or any bracketed numbers in the output. If referencing a benchmark or data source, name it inline (e.g., "per WordStream 2025 industry benchmarks") or omit the reference entirely. Raw citation markers are not useful to the end user.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT fabricate source names, report titles, or citations. If stating a general industry benchmark, say "industry standard" — do not invent a specific source.

PLATFORM-SPECIFIC CAMPAIGN TEMPLATES:

You MUST follow these platform-specific templates. Do NOT generate generic campaigns.
These come from proven media buyer frameworks. The generic "minimum 3 campaigns" rule
above is a FLOOR — these templates define the actual structure.

══════════════════════════════════════════════════════════════
LINKEDIN CAMPAIGNS (when LinkedIn is a selected platform)
══════════════════════════════════════════════════════════════

Generate 3-4 campaigns depending on budget. If LinkedIn budget >= $6K/mo, include all 4.
If < $6K/mo, drop Campaign 1 (CTV) and redistribute to Campaign 2.

CAMPAIGN 1: CTV / Awareness (10-15% of LinkedIn budget)
- Objective: Brand Awareness or Video Views
- Ad Set 1: ICP Job Titles + Company Size + Industry (from ICP targeting data)
  - Format: Video ads 15-60s
  - Purpose: Build awareness, generate video viewer audiences for retargeting
- Daily Budget: (LinkedIn monthly budget × 0.125) / 30
- Skip if LinkedIn budget < $6,000/mo

CAMPAIGN 2: Prospecting Lead Gen (50-60% of LinkedIn budget)
- Objective: Lead Generation (Lead Gen Forms)
- Ad Set 1: ICP Job Titles — Primary Segment
  - Targeting: Priority 1 segment from ICP targeting data
  - Ads: 3-4 ads mixing Thought Leader Ads, Carousel, Single Image
- Ad Set 2: ICP Job Titles — Secondary Segment
  - Targeting: Priority 2 segment from ICP targeting data
  - Ads: 3-4 ads
- Ad Set 3: ABM Company List (optional, if client has account list)
  - Targeting: Uploaded company list + matched audiences
  - Ads: 3 ads with account-specific messaging
- Daily Budget: (LinkedIn monthly budget × 0.55) / 30

CAMPAIGN 3: MoFu Thought Leadership (15-20% of LinkedIn budget)
- Objective: Website Visits or Lead Generation
- Ad Set 1: Case Study / Customer Story promotion
  - Targeting: Website visitors 30d + video viewers 50%+ from Campaign 1
  - Ads: 2-3 ads featuring customer outcomes
- Ad Set 2: POV / Webinar content
  - Targeting: Lead form openers who didn't submit + page followers
  - Ads: 2-3 ads
- Daily Budget: (LinkedIn monthly budget × 0.175) / 30
- Activation: Week 2-3 after Campaign 2 generates engagement data

CAMPAIGN 4: Retargeting — Conversation Ads + Image (10-15% of LinkedIn budget)
- Objective: Lead Generation or Conversions
- Ad Set 1: Conversation Ads
  - Targeting: Website visitors 7d + lead form openers not submitted
  - Format: Conversation Ads with 2 workflow paths
  - Path A: Address top objection from research data → Demo booking
  - Path B: Offer alternative engagement (resource download) → Nurture
- Ad Set 2: Single Image / Video Retargeting
  - Targeting: Website visitors 30d + video viewers 75%+
  - Ads: 4-6 variations (urgency, social proof, price comparison)
- Daily Budget: (LinkedIn monthly budget × 0.125) / 30
- Activation: Week 3-4 after sufficient retargeting pool builds

══════════════════════════════════════════════════════════════
GOOGLE CAMPAIGNS (when Google is a selected platform)
══════════════════════════════════════════════════════════════

Generate 3-4 campaigns. Campaign 2 (Competitor Branded) is MANDATORY when competitors
are identified in the research data or context.

CAMPAIGN 1: Brand Campaign (10-15% of Google budget)
- Objective: Search — Conversions
- Keywords: [client brand name], [client brand + product], [client brand + review]
- Ad Format: Responsive Search Ads with sitelinks
- Bid Strategy: Target Impression Share (top of page)
- Daily Budget: (Google monthly budget × 0.125) / 30
- Purpose: Protect brand terms, cheapest conversions

CAMPAIGN 2: Competitor Branded Campaign (25-35% of Google budget) ★ MANDATORY
- Objective: Search — Conversions
- Keywords: For EACH competitor identified in the research data or context, generate:
  - "[competitor name]" (exact match)
  - "[competitor name] alternative" (phrase match)
  - "[competitor name] vs" (phrase match)
  - "[competitor name] pricing" (phrase match)
  - "[competitor name] reviews" (phrase match)
- Ad Format: Responsive Search Ads
  - Headlines MUST include: client USP, speed/ease advantage, pricing advantage
  - Descriptions MUST address: why switch, key differentiator, social proof
- Bid Strategy: Maximize Conversions with Target CPA
- Daily Budget: (Google monthly budget × 0.30) / 30
- Purpose: Capture high-intent comparison shoppers
- IMPORTANT: Pull ALL competitor names from the context. If competitors are listed,
  this campaign is required. Do NOT skip it.

CAMPAIGN 3: Non-Branded / High-Intent Search (35-45% of Google budget)
- Objective: Search — Conversions
- Keywords: Pull from high-intent keywords in context (keywords with CPC data)
  - Focus on solution-aware terms (e.g., "marketing attribution software")
  - Include problem-aware terms (e.g., "how to track marketing ROI")
- Ad Format: Responsive Search Ads + sitelinks + callouts + structured snippets
- Negative Keywords MUST include:
  - Standard: free, jobs, career, course, tutorial, salary, intern, student
  - All competitor names from Campaign 2 (prevent cannibalization between campaigns)
- Bid Strategy: Target CPA
- Daily Budget: (Google monthly budget × 0.40) / 30

CAMPAIGN 4: Display / YouTube Remarketing (10-15% of Google budget)
- Objective: Display — Conversions
- Targeting: Website visitors 90d + YouTube viewers
- Ad Format: Responsive Display Ads
- Bid Strategy: Target CPA
- Daily Budget: (Google monthly budget × 0.125) / 30
- Activation: Week 3-4 after search campaigns build retargeting pool

══════════════════════════════════════════════════════════════
META CAMPAIGNS (when Meta is a selected platform)
══════════════════════════════════════════════════════════════

Generate 2-3 campaigns depending on budget.

CAMPAIGN 1: Lead Gen Form (50-60% of Meta budget)
- Objective: Lead Generation (native lead forms)
- Ad Set 1: Interest-Based + Job Title Targeting
  - Targeting: From ICP targeting data — interests, job titles, company size
  - Ads: 3x UGC/testimonial videos (Pain, Claim, Gain hooks)
        3x Static images (USP-focused)
        2x Product demo videos (if available)
- Ad Set 2: ABM Lookalike (1%)
  - Targeting: 1% Lookalike of converters or website purchasers
  - Ads: Same creative mix as Ad Set 1
- Daily Budget: (Meta monthly budget × 0.55) / 30

CAMPAIGN 2: Website Conversions (30-40% of Meta budget)
- Objective: Conversions (optimize for demo booking / trial signup)
- Ad Set 1: Interest-Based targeting (same as Campaign 1)
  - Same creative mix
- Ad Set 2: Retargeting
  - Targeting: Website visitors 30d + video viewers 50%+ + lead form openers
  - Ads: 3x social proof/case study, 2x urgency, 1x competitor comparison
- Daily Budget: (Meta monthly budget × 0.35) / 30
- Retargeting ad set activates Week 3-4

CAMPAIGN 3: Brand Awareness / Video Views (only if Meta budget > $5K/mo)
- Objective: Brand Awareness or ThruPlay
- Targeting: Broad ICP interests
- Ads: 2x brand story videos
- Daily Budget: (Meta monthly budget × 0.10) / 30
- Skip if Meta budget <= $5,000/mo

══════════════════════════════════════════════════════════════

WITHIN-PLATFORM BUDGET VALIDATION:
For each platform, verify that the sum of all campaign daily budgets equals
the platform's monthly budget divided by 30 (±5%). If they don't reconcile,
adjust campaign daily budgets proportionally.

CAMPAIGN NAMING CONVENTIONS:
Format: [Client]_[Platform]_[Objective]_[Audience]_[Year]
- Platform codes: LI, GG, META, TT, YT
- Year: MUST use current year
- NEVER include: "financing", "credit", "loan", "insurance"

Examples:
- ClientName_LI_LeadGen_VPMarketing_2026
- ClientName_GG_Competitor_DreamdataAlt_2026
- ClientName_META_LeadGen_Interest_2026

RETARGETING SEGMENTS (apply across all platforms):
| Segment | Lookback | Messaging |
| Website visitors all pages | 7 days | Urgency, limited offer |
| Website visitors all pages | 30 days | Social proof, case studies |
| Website visitors pricing/demo | 14 days | Objection handling |
| Video viewers 50%+ | 30 days | Deeper product education |
| Lead form openers not submitted | 14 days | Reduce friction, alternative CTA |

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Design campaign structure based on these validated inputs:\n\n${context}`,
        temperature: GENERATION_SETTINGS.synthesis.temperature,
        maxOutputTokens: SECTION_MAX_TOKENS.campaignStructure,
      }),
      'campaignStructure',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('campaignStructure', error);
    throw error;
  }
}

// =============================================================================
// Phase 2A: Creative Strategy
// =============================================================================

export async function synthesizeCreativeStrategy(
  context: string,
): Promise<SynthesisResult<Phase2CreativeStrategyOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase2CreativeStrategySchema,
        system: `You are a creative strategist for performance advertising with 10+ years of experience.

TASK: Develop a creative strategy with angles, format specs, testing plan, refresh cadence, and brand guidelines.

RULES:
- Minimum 3 creative angles, each with a SPECIFIC example hook using the client's actual data
- Do NOT use generic hooks like "Struggling with X?" — use specific statistics, competitor gaps, or ICP pain points
- Reference competitor creative formats from the data. If competitors overuse static images, recommend UGC video
- Testing plan must be phased: Phase 1 tests hooks/messages, Phase 2 tests formats/visuals, Phase 3 scales winners
- Refresh cadence: Meta 14-21d, LinkedIn 30-45d, Google 30-60d, TikTok 7-14d
- Every hook must be immediately usable by a copywriter — not a template, but a real headline/hook
- If the offer proof score (provided in context) is below 7/10, do NOT include specific customer counts, revenue claims, or outcome statistics in ad copy examples unless they are explicitly documented in the research context.
- When proof is weak, use language like "typically", "on average", or focus on process benefits (speed, ease, simplicity) rather than specific outcome claims.
- Flag any creative angle that requires proof assets (case studies, testimonials, data points) that are not documented in the provided context.
- When scored white space gaps are provided in context, the highest-scored gaps MUST directly inform creative angles. At least one creative angle should exploit the #1 ranked white space gap.
- When competitor threat data with counter-positioning is provided, include at least one angle that directly counter-positions against the primary competitor threat.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Develop creative strategy using this competitive intelligence and brand context:\n\n${context}`,
        temperature: GENERATION_SETTINGS.synthesis.temperature,
        maxOutputTokens: SECTION_MAX_TOKENS.creativeStrategy,
      }),
      'creativeStrategy',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('creativeStrategy', error);
    throw error;
  }
}

// =============================================================================
// Phase 2A: Campaign Phases
// =============================================================================

export async function synthesizeCampaignPhases(
  context: string,
): Promise<SynthesisResult<Phase2CampaignPhasesOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase2CampaignPhasesSchema,
        system: `You are a paid media strategist designing a phased campaign rollout.

TASK: Create a phased rollout plan (3-4 phases) from testing to scale to optimization.

RULES:
- Phase 1: Testing/Foundation (40-50% of steady-state budget). Low daily caps. Data collection focus
- Phase 2: Scale (75-100% of budget). Double down on winning audiences and creatives
- Phase 3+: Optimization (100% budget). Full deployment with 15-20% continuous testing allocation
- Each phase needs specific success criteria for advancing to the next phase
- Activities must be concrete actions a media buyer can execute
- Budget per phase must be realistic given the total monthly budget and phase duration
- Each phase's estimatedBudget MUST equal the implied daily spending × durationWeeks × 7. Show the math in a comment if helpful.
- Phase daily spending MUST NOT exceed the daily budget ceiling provided in context.
- Sum of all phase estimatedBudgets across the full timeline must approximately equal (monthly budget × total months).
- SQL and CPL targets in success criteria MUST match the KPI targets provided in context. Do not invent different performance targets.
- Phase budgets represent absolute dollar amounts for each time window, NOT percentage slices. Their sum should equal monthlyBudget × total months spanned.
- Every phase MUST include a goNoGoDecision: what specific action to take if success criteria are NOT met by the end of the phase. This must be a concrete action (e.g., "Reduce daily budget by 30% and extend testing 2 weeks"), not vague advice.
- When sensitivity analysis scenarios are provided in context, include a scenarioAdjustment per phase describing how the phase changes under worst-case conditions. E.g., "If worst-case CPL ($120) materializes, reduce to 2 platforms and extend Phase 1 by 2 weeks."
- Phase success criteria should reference base-case targets as the primary threshold and worst-case targets as the minimum floor.
- Do NOT include citation markers like [1], [5], [8], or any bracketed numbers in the output. If referencing a benchmark or data source, name it inline (e.g., "per WordStream 2025 industry benchmarks") or omit the reference entirely. Raw citation markers are not useful to the end user.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT fabricate source names, report titles, or citations. If stating a general industry benchmark, say "industry standard" — do not invent a specific source.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Design a phased campaign rollout based on:\n\n${context}`,
        temperature: GENERATION_SETTINGS.synthesis.temperature,
        maxOutputTokens: SECTION_MAX_TOKENS.campaignPhases,
      }),
      'campaignPhases',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('campaignPhases', error);
    throw error;
  }
}

// =============================================================================
// Phase 2B: Budget Allocation + Monitoring Schedule (single Sonnet call)
// =============================================================================

export async function synthesizeBudgetAndMonitoring(
  context: string,
): Promise<SynthesisResult<Phase2BudgetMonitoringOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase2BudgetMonitoringSchema,
        system: `You are a media buying operations manager responsible for budget allocation and campaign monitoring.

TASK: Create a budget allocation plan AND a practical monitoring schedule.

BUDGET RULES:
- totalMonthlyBudget MUST match the client's stated monthly ad budget exactly
- Platform percentages MUST sum to 100%
- monthlyBudget per platform = totalMonthlyBudget × percentage / 100 (exact math)
- dailyCeiling MUST NOT exceed totalMonthlyBudget / 30
- Funnel split: cold 50-70%, warm 20-30%, hot 10-20% — percentages must sum to 100%
- Monthly roadmap: 3-6 months with specific scaling triggers
- Monthly roadmap MUST include contingency triggers: specific thresholds that activate budget reallocation (e.g., "If CPL exceeds worst-case threshold for 7+ days, shift 20% from Meta to Google")
- When sensitivity analysis scenarios are available in context, the ramp-up strategy should reference worst-case CPL as the ceiling for scaling decisions. Do not scale past Phase 1 budget levels until CPL is consistently below base-case threshold.

RAMP-UP STRATEGY CONSTRAINT:
- The ramp-up daily spend progression MUST sum to approximately the Phase 1 budget.
- Phase 1 is typically 40-50% of monthly budget over its duration (usually 3-4 weeks).
- Example: If Phase 1 is 4 weeks at $12,000 budget, the ramp-up should be:
  Week 1: ~$285/day × 7 = ~$2,000 (low daily caps for data collection)
  Week 2: ~$428/day × 7 = ~$3,000 (increase as initial data comes in)
  Week 3: ~$428/day × 7 = ~$3,000 (consolidate learnings)
  Week 4: ~$571/day × 7 = ~$4,000 (ramp toward full Phase 2 spend)
  Total: ~$12,000 ✓
- Do NOT write ramp-up daily amounts that, when multiplied by days, exceed or fall far short of Phase 1's total budget.

MONTHLY ROADMAP CONSTRAINT:
- The monthly roadmap amounts MUST be consistent with the stated monthly budget and phase budgets.
- Month 1 should reflect Phase 1 spend level — typically 40-50% of the full monthly budget during ramp-up.
- Subsequent months should match subsequent phase budgets, scaling toward the full monthly budget.
- No month should exceed the stated totalMonthlyBudget unless a specific approved scaling strategy justifies it.
- The monthly roadmap should span the same duration as the campaign phases — if phases cover 3 months, include at least 3 months.

MONITORING RULES:
- Daily: spend pacing, ad disapprovals, CPL by campaign (reference actual campaign names)
- Weekly: creative performance analysis, search term reports, frequency caps
- Monthly: full funnel analysis (CPL → CAC → LTV), budget reallocation, creative refresh
- Include early warning thresholds for each monitoring cadence: daily (CPL spike), weekly (creative fatigue signals), monthly (CAC drift from model)
- Do NOT include citation markers like [1], [5], [8], or any bracketed numbers in the output. If referencing a benchmark or data source, name it inline (e.g., "per WordStream 2025 industry benchmarks") or omit the reference entirely. Raw citation markers are not useful to the end user.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT fabricate source names, report titles, or citations. If stating a general industry benchmark, say "industry standard" — do not invent a specific source.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Create budget allocation and monitoring schedule based on:\n\n${context}`,
        temperature: GENERATION_SETTINGS.synthesis.temperature,
        maxOutputTokens: SECTION_MAX_TOKENS.budgetAndMonitoring,
      }),
      'budgetAndMonitoring',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('budgetAndMonitoring', error);
    throw error;
  }
}

// =============================================================================
// Phase 3: Executive Summary
// =============================================================================

export async function synthesizeExecutiveSummary(
  context: string,
): Promise<SynthesisResult<Phase3ExecutiveSummaryOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase3ExecutiveSummarySchema,
        system: `You are a media strategy director writing an executive summary of a completed media plan.

TASK: Write a concise executive summary that accurately reflects the actual plan data provided below.

RULES:
- The overview must reference specific platforms, budget amounts, and expected outcomes from the plan
- recommendedMonthlyBudget MUST match the actual budget from the plan
- topPriorities must be specific and actionable, not generic advice
- timelineToResults must be realistic given the phased rollout plan
- primaryObjective should cite specific numbers (leads, SQLs, CAC) from the performance model
- You MUST use the exact validated performance targets provided in the "Validated Performance Targets" section of the context. Do not substitute industry benchmarks, round numbers, or estimate different values.
- The primaryObjective MUST state the exact CPL, SQL volume, customer count, and CAC from the validated targets.
- recommendedMonthlyBudget MUST exactly match the validated monthly budget — not a rounded or estimated version.
- Do not mention a CAC target that differs from the computed CAC in the performance model.
- If a number appears in the "Validated Performance Targets" section, use that exact number.
- When SAM data is available in context, include the serviceable addressable market size and annual contract value to frame the opportunity.
- When sensitivity analysis scenarios are available, reference the base case for primary targets and acknowledge worst case as the contingency floor.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT fabricate source names, report titles, or citations. If stating a general industry benchmark, say "industry standard" — do not invent a specific source.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Write an executive summary for this completed media plan:\n\n${context}`,
        temperature: 0.4,
        maxOutputTokens: 2048,
      }),
      'executiveSummary',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('executiveSummary', error);
    throw error;
  }
}

// =============================================================================
// Phase 3: Risk Monitoring
// =============================================================================

export async function synthesizeRiskMonitoring(
  context: string,
): Promise<SynthesisResult<Phase3RiskMonitoringOutput>> {
  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: anthropic(SONNET_MODEL),
        schema: phase3RiskMonitoringSchema,
        system: `You are a risk management specialist for paid advertising campaigns.

TASK: Identify specific risks and assumptions for this media plan based on the actual plan data.

RULES:
- Must cover at least 4 of 6 categories: budget, creative, audience, platform, compliance, market
- Every risk MUST be specific to this client — no generic risks like "ad costs may increase"
- Reference concrete plan elements: actual platform names, budget amounts, CAC targets, audience sizes
- Each risk needs both a mitigation (proactive) AND contingency (reactive) strategy
- Assumptions must be specific dependencies that could invalidate the plan
- Severity and likelihood must be justified by the plan data
- For each risk, provide a numerical probability (1-5, where 1=rare, 5=almost certain) AND impact (1-5, where 1=negligible, 5=catastrophic). The system will compute P×I scores — do NOT compute them yourself.
- Each risk MUST include an earlyWarningIndicator: a specific metric threshold that signals this risk is materializing (e.g., "CPL exceeds $120 for 5+ consecutive days", "Creative CTR drops below 0.8%")
- Each risk MUST include a monitoringFrequency: how often to check this indicator (daily, weekly, or monthly)
- Budget and audience risks should be monitored daily. Creative risks weekly. Market and compliance risks monthly.
- Do NOT include citation markers like [1], [5], [8], or any bracketed numbers in the output. If referencing a benchmark or data source, name it inline (e.g., "per WordStream 2025 industry benchmarks") or omit the reference entirely. Raw citation markers are not useful to the end user.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT fabricate source names, report titles, or citations. If stating a general industry benchmark, say "industry standard" — do not invent a specific source.
- Key assumptions about conversion rates, CAC, CPL, and SQL volume must be consistent with the validated performance targets provided in context. Do not assume conversion rates that differ from the computed model.
- When ICP risk scores are provided in the context, INHERIT those risk assessments. Any risk scored ≥13 (high/critical) in the ICP analysis must appear in the media plan risk section with specific mitigations.
- Add campaign-specific risks ON TOP of inherited ICP risks (e.g., creative fatigue, platform-specific algorithm risks, budget pacing risks).
- Use numerical severity scoring where possible — reference the probability × impact framework from the ICP analysis.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Identify risks and assumptions for this media plan:\n\n${context}`,
        temperature: GENERATION_SETTINGS.synthesis.temperature,
        maxOutputTokens: SECTION_MAX_TOKENS.riskMonitoring,
      }),
      'riskMonitoring',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(SONNET_MODEL, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model: SONNET_MODEL,
    };
  } catch (error) {
    logError('riskMonitoring', error);
    throw error;
  }
}
