import {
  buildRunnerTelemetry,
  emitRunnerProgress,
  type RunnerProgressReporter,
  type RunnerProgressUpdate,
} from '../runner';
import {
  isCascadeTimeoutError,
  runWithCascade,
  type CascadeAttemptConfig,
  type CascadeAttemptResult,
  type CascadeDeps,
  type CascadeStage,
} from '../runner-cascade';
import { INDUSTRY_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
import { MODELS } from '../models';

const INDUSTRY_PRIMARY_MODEL =
  process.env.RESEARCH_INDUSTRY_MODEL ?? MODELS.FAST;
const INDUSTRY_REPAIR_MODEL =
  process.env.RESEARCH_INDUSTRY_REPAIR_MODEL ?? MODELS.STANDARD;
const INDUSTRY_PRIMARY_MAX_TOKENS = 5000;
const INDUSTRY_REPAIR_MAX_TOKENS = 4000;
const INDUSTRY_PRIMARY_TIMEOUT_MS = 120_000;
const INDUSTRY_REPAIR_TIMEOUT_MS = 90_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;

export const INDUSTRY_PRIMARY_SYSTEM_PROMPT = `You are an expert market researcher with real-time web search capabilities.

TASK: Research the industry and market landscape to inform a paid media strategy.

RESEARCH FOCUS:
- Current market trends and statistics (2024+)
- Pain points sourced from G2, Capterra, Reddit, and community forums
- Buying behaviors and triggers specific to this market
- Seasonal patterns and sales cycles
- Demand drivers and barriers

TOOL USAGE:
Use the web_search tool to gather live market data. Run up to 3 focused searches:
1. Industry overview, market size, and key demand drivers
2. Customer pain points and complaints (search G2/Reddit/forums)
3. Buying behavior, decision process, and seasonal patterns

SPEED RULES:
- Optimize for a fast, decision-useful first pass instead of exhaustive coverage
- Stop searching once you have enough evidence to fill the schema confidently
- Prefer concise evidence over long narrative explanations
- If 2 focused searches already support the schema, skip the third search

QUALITY STANDARDS:
- Be specific with real data points and statistics
- Include statistics when available
- Source pain points from actual customer feedback
- Make insights actionable for paid media targeting
- Derive the market category from the business context first. Use product description, ICP, pricing, and stated goals to scope the niche before researching market size.
- Normalize categorical fields to the allowed enums instead of descriptive prose
- For trendSignals, the enum key must be "direction" exactly. Never use "description", "status", or another alias for the trend direction field.
- Market-size honesty rules:
  - Prefer category-specific SAM first.
  - If SAM is unavailable, use "Estimated SAM:" or "Proxy estimate:" with a brief derivation note.
  - Use "TAM context:" only when citing a broader parent market, and explicitly note that it is not the direct niche size.
  - Never serialize a parent-market TAM as the direct market size for the niche category.
  - ARITHMETIC CHECK: After writing your market size derivation (e.g. "X establishments × $Y spend × Z% adoption"), multiply out each factor and confirm the final number matches. If the multiplication does not equal your stated figure, correct it before outputting.
- Use these mappings:
  - marketMaturity: early = category education still required, growing = active demand with expanding competition, saturated = mature crowded category
  - buyingBehavior: impulsive = single-buyer / low-friction, committee_driven = multi-stakeholder consensus, roi_based = finance-led justification dominates, mixed = no single motion dominates
  - awarenessLevel: low = unaware or problem-aware, medium = solution-aware, high = product-aware or most-aware

SALES CYCLE CROSS-REFERENCE:
If the client has provided their sales cycle length in the context above, use it as a baseline. Your estimated sales cycle should not exceed 2x the client's stated length without explicit market evidence justifying the difference. If no client-stated sales cycle is provided, estimate based on market research only.

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object containing your findings. Structure:
{
  "categorySnapshot": {
    "category": "string — specific market category name",
    "marketSize": "string — MUST start with one of: 'SAM:', 'Estimated SAM:', 'Proxy estimate:', or 'TAM context:'",
    "marketMaturity": "early | growing | saturated",
    "buyingBehavior": "impulsive | committee_driven | roi_based | mixed",
    "awarenessLevel": "low | medium | high",
    "averageSalesCycle": "string — typical sales cycle length"
  },
  "painPoints": {
    "primary": ["string — top pain points (4-6 items)"],
    "secondary": ["string — secondary pain points (2-4 items)"],
    "triggers": ["string — events that trigger purchase consideration"]
  },
  "marketDynamics": {
    "demandDrivers": ["string — key demand drivers fueling the market (3-5 items)"],
    "buyingTriggers": ["string — specific events/moments that trigger a purchase decision (3-5 items)"],
    "barriersToPurchase": ["string — common objections and friction points that delay or prevent purchase (3-5 items)"]
  },
  "trendSignals": [
    {
      "trend": "string — name of the trend",
      "direction": "rising | stable | declining",
      "evidence": "string — brief supporting data point or source"
    }
  ],
  "messagingOpportunities": {
    "angles": ["string — strong messaging angles for paid ads"],
    "summaryRecommendations": ["string — actionable recommendations for paid media strategy"]
  },
  "marketOpportunities": [
    {
      "opportunity": "string — 1 sentence: market gap or opening for paid media",
      "size": "small | medium | large",
      "timing": "now | 3-6 months | 6-12 months",
      "difficulty": "low | medium | high",
      "evidence": "string — 1 sentence: which research finding supports this"
    }
  ],
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}

${INDUSTRY_INTELLIGENCE_SKILL}`;

const INDUSTRY_REPAIR_SYSTEM_PROMPT = `You are an expert market researcher repairing an incomplete market-overview artifact from captured evidence.

TASK: Produce the same JSON schema requested in the original run, but use ONLY the evidence package provided in the user message.

RULES:
- Do not call tools or do new research
- Use only the captured search/source/analysis evidence
- No preamble, no markdown, no code fences
- Keep every string compact and decision-useful
- Limit trendSignals to the 5 strongest trends
- Limit citations to the 8 most relevant sources
- For trendSignals, use the key "direction" exactly
- Market-size honesty still applies in repair mode:
  - Prefer "SAM:" first.
  - Use "Estimated SAM:" or "Proxy estimate:" when you are inferring from narrower evidence.
  - If only a broad parent-market figure exists, label it "TAM context:" and state that it is not the direct niche size.
- Start the response with { and end it with }

${INDUSTRY_PRIMARY_SYSTEM_PROMPT.slice(
  INDUSTRY_PRIMARY_SYSTEM_PROMPT.indexOf('After completing your research'),
)}

${INDUSTRY_INTELLIGENCE_SKILL}`;

// ---------------------------------------------------------------------------
// Deps interface — preserves the existing WithDeps contract for tests
// ---------------------------------------------------------------------------

interface RunResearchIndustryDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  /**
   * Legacy injectable for tests. Signature: (context, config, onProgress).
   * Bridged to CascadeDeps.runToolAttempt internally.
   */
  runAttempt?: (
    context: string,
    config: IndustryAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
}

/** Internal config shape — kept for the runAttempt bridge. */
interface IndustryAttemptConfig {
  mode: 'primary' | 'repair';
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools: Array<typeof WEB_SEARCH_TOOL>;
  system: string;
  synthesisMessage: string;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tokenizeMarketScope(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.endsWith('ies') && token.length > 3) {
        return `${token.slice(0, -3)}y`;
      }

      if (token.endsWith('s') && token.length > 3) {
        return token.slice(0, -1);
      }

      return token;
    });
}

function getSignificantCategoryTokens(category: string | null): string[] {
  if (!category) {
    return [];
  }

  const ignoredTokens = new Set([
    'a',
    'an',
    'and',
    'b2b',
    'b2c',
    'for',
    'in',
    'market',
    'of',
    'platform',
    'platforms',
    'saas',
    'service',
    'services',
    'software',
    'solution',
    'solutions',
    'the',
    'tool',
    'tools',
  ]);

  return [...new Set(tokenizeMarketScope(category))].filter(
    (token) => !ignoredTokens.has(token),
  );
}

function isLikelyParentMarketReference(
  marketSize: string,
  category: string | null,
): boolean {
  const normalizedMarketSize = marketSize.toLowerCase();
  if (/\btam\b/i.test(marketSize)) {
    return true;
  }

  if (!normalizedMarketSize.includes('market')) {
    return false;
  }

  const significantTokens = getSignificantCategoryTokens(category);
  if (significantTokens.length === 0) {
    return true;
  }

  const marketTokens = new Set(tokenizeMarketScope(marketSize));
  const matchedTokenCount = significantTokens.filter((token) =>
    marketTokens.has(token),
  ).length;

  return matchedTokenCount < Math.min(2, significantTokens.length);
}

function normalizeIndustryMarketSizeLabel(input: {
  marketSize: string;
  category: string | null;
}): string {
  const trimmed = input.marketSize.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (
    /^sam:/i.test(trimmed) ||
    /^estimated sam:/i.test(trimmed) ||
    /^proxy estimate:/i.test(trimmed) ||
    /^tam context:/i.test(trimmed)
  ) {
    return trimmed;
  }

  if (/proxy/i.test(trimmed)) {
    return `Proxy estimate: ${trimmed}`;
  }

  if (/\bsam\b/i.test(trimmed)) {
    return /estimate/i.test(trimmed)
      ? `Estimated SAM: ${trimmed}`
      : `SAM: ${trimmed}`;
  }

  if (isLikelyParentMarketReference(trimmed, input.category)) {
    const suffix = /parent market, not direct niche size/i.test(trimmed)
      ? ''
      : ' (parent market, not direct niche size)';
    return `TAM context: ${trimmed}${suffix}`;
  }

  return `Estimated SAM: ${trimmed}`;
}

function normalizeIndustryPayload(parsed: unknown): unknown {
  if (!isRecord(parsed) || !isRecord(parsed.categorySnapshot)) {
    return parsed;
  }

  const marketSize = asString(parsed.categorySnapshot.marketSize);
  if (!marketSize) {
    return parsed;
  }

  const category = asString(parsed.categorySnapshot.category);

  return {
    ...parsed,
    categorySnapshot: {
      ...parsed.categorySnapshot,
      marketSize: normalizeIndustryMarketSizeLabel({
        marketSize,
        category,
      }),
    },
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function buildIndustryRecoveryContext(input: {
  context: string;
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
}): string {
  const searches = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) => update.phase === 'tool' && update.message.startsWith('searching: '),
      )
      .map((update) => update.message),
  ).slice(0, 4);
  const sources = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) => update.phase === 'tool' && update.message.startsWith('source: '),
      )
      .map((update) => update.message),
  ).slice(0, 8);
  const analysisNotes = dedupeStrings(
    input.progressUpdates
      .filter((update) => update.phase === 'analysis')
      .map((update) => update.message),
  ).slice(0, 6);
  const partialDraft =
    typeof input.partialDraft === 'string' && input.partialDraft.trim().length > 0
      ? input.partialDraft.trim().slice(0, 4_500)
      : null;

  return [
    'BUSINESS CONTEXT:',
    input.context,
    '',
    'RULES:',
    '- Use only the evidence below.',
    '- Do not invent unsupported statistics or source-backed claims.',
    '- Scope the market category to the business context before describing the size.',
    '- If exact market size is uncertain, prefer an Estimated SAM or Proxy estimate over a broad parent-market TAM.',
    '- If only a parent-market figure exists, label it as TAM context and state that it is not the direct niche size.',
    '',
    searches.length > 0 ? `SEARCH QUERIES:\n- ${searches.join('\n- ')}` : null,
    sources.length > 0 ? `CAPTURED SOURCES:\n- ${sources.join('\n- ')}` : null,
    analysisNotes.length > 0 ? `ANALYSIS NOTES:\n- ${analysisNotes.join('\n- ')}` : null,
    partialDraft ? `INCOMPLETE DRAFT TO REPAIR:\n${partialDraft}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n');
}

function hasIndustryRecoveryEvidence(input: {
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
}): boolean {
  const hasPartialDraft =
    typeof input.partialDraft === 'string' && input.partialDraft.trim().length > 0;
  const sourceCount = input.progressUpdates.filter(
    (update) => update.phase === 'tool' && update.message.startsWith('source: '),
  ).length;

  return hasPartialDraft || sourceCount >= 3;
}

// ---------------------------------------------------------------------------
// Cascade stage definitions
// ---------------------------------------------------------------------------

function buildPrimaryStage(): CascadeStage {
  return {
    config: {
      mode: 'industry:primary',
      model: INDUSTRY_PRIMARY_MODEL,
      maxTokens: INDUSTRY_PRIMARY_MAX_TOKENS,
      timeoutMs: INDUSTRY_PRIMARY_TIMEOUT_MS,
      tools: [WEB_SEARCH_TOOL],
      system: INDUSTRY_PRIMARY_SYSTEM_PROMPT,
      synthesisMessage: 'synthesizing market overview',
      maxToolIterations: 3,
      userMessage: '{{context}}',
    },
    buildContext: (originalContext) =>
      `Research the industry and market for:\n\n${originalContext}`,
  };
}

function buildRepairStage(): CascadeStage {
  return {
    config: {
      mode: 'industry:repair',
      model: INDUSTRY_REPAIR_MODEL,
      maxTokens: INDUSTRY_REPAIR_MAX_TOKENS,
      timeoutMs: INDUSTRY_REPAIR_TIMEOUT_MS,
      tools: [],
      system: INDUSTRY_REPAIR_SYSTEM_PROMPT,
      synthesisMessage: 'repairing market overview from captured evidence',
      userMessage: '{{context}}',
    },
    buildContext: (originalContext, capturedProgress, partialDraft) => {
      const recoveryContext = buildIndustryRecoveryContext({
        context: originalContext,
        partialDraft,
        progressUpdates: capturedProgress,
      });
      return `Research the industry and market for:\n\n${recoveryContext}`;
    },
    recoveryMessage: undefined, // emitted dynamically below
  };
}

// ---------------------------------------------------------------------------
// Bridge: adapt legacy runAttempt(context, config, onProgress) to CascadeDeps
// ---------------------------------------------------------------------------

function bridgeLegacyRunAttempt(
  legacyRunAttempt: NonNullable<RunResearchIndustryDeps['runAttempt']>,
  capturedProgressRef: { updates: RunnerProgressUpdate[] },
): CascadeDeps {
  // The CascadeAttemptConfig uses userMessage as the full context string
  // (built by stage.buildContext and substituted via {{context}}).
  // We reconstruct an IndustryAttemptConfig for the legacy function.
  return {
    runToolAttempt: async (
      config: CascadeAttemptConfig,
      onProgress?: RunnerProgressReporter,
    ): Promise<CascadeAttemptResult> => {
      const legacyConfig: IndustryAttemptConfig = {
        mode: 'primary',
        model: config.model,
        maxTokens: config.maxTokens,
        timeoutMs: config.timeoutMs,
        tools: config.tools.length > 0 ? [WEB_SEARCH_TOOL] : [],
        system: config.system,
        synthesisMessage: config.synthesisMessage,
      };
      // The context was embedded into userMessage by buildContext.
      // Strip the "Research the industry and market for:\n\n" prefix to get
      // the raw context that the legacy function expects.
      const contextPrefix = 'Research the industry and market for:\n\n';
      const rawContext = config.userMessage.startsWith(contextPrefix)
        ? config.userMessage.slice(contextPrefix.length)
        : config.userMessage;
      return legacyRunAttempt(rawContext, legacyConfig, onProgress);
    },
    runMessageAttempt: async (
      config: CascadeAttemptConfig,
      onProgress?: RunnerProgressReporter,
    ): Promise<CascadeAttemptResult> => {
      const legacyConfig: IndustryAttemptConfig = {
        mode: 'repair',
        model: config.model,
        maxTokens: config.maxTokens,
        timeoutMs: config.timeoutMs,
        tools: [],
        system: config.system,
        synthesisMessage: config.synthesisMessage,
      };
      const contextPrefix = 'Research the industry and market for:\n\n';
      const rawContext = config.userMessage.startsWith(contextPrefix)
        ? config.userMessage.slice(contextPrefix.length)
        : config.userMessage;
      return legacyRunAttempt(rawContext, legacyConfig, onProgress);
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runResearchIndustryWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunResearchIndustryDeps = {},
): Promise<import('../supabase').ResearchResult> {
  // Capture progress for recovery context builders.
  const capturedProgressRef: { updates: RunnerProgressUpdate[] } = { updates: [] };
  const wrappedProgress: RunnerProgressReporter = async (update) => {
    capturedProgressRef.updates.push(update);
    await onProgress?.(update);
  };

  // Build CascadeDeps — either from a legacy runAttempt injection or defaults.
  const cascadeDeps: CascadeDeps = deps.runAttempt
    ? { ...bridgeLegacyRunAttempt(deps.runAttempt, capturedProgressRef), now: deps.now, parseJson: deps.parseJson }
    : { now: deps.now, parseJson: deps.parseJson };

  // Build stages with dynamic recovery messages.
  // The repair stage recovery message depends on whether evidence was captured,
  // so we override it after building via a closure over capturedProgressRef.
  const primaryStage = buildPrimaryStage();
  const repairStage: CascadeStage = {
    ...buildRepairStage(),
    buildContext: (originalContext, capturedProgress, partialDraft) => {
      const recoveryContext = buildIndustryRecoveryContext({
        context: originalContext,
        partialDraft,
        progressUpdates: capturedProgress,
      });
      return `Research the industry and market for:\n\n${recoveryContext}`;
    },
  };

  // Emit the dynamic repair recovery message before the repair stage runs.
  // We distinguish two transitions into repair:
  //   - timeout (no partialDraft yet): "timed out — repairing..."
  //   - token limit / parse failure (partialDraft present): "hit token limit — repairing..."
  const repairStageWithMessage: CascadeStage = {
    ...repairStage,
    buildContext: (originalContext, capturedProgress, partialDraft) => {
      const hasEvidence = hasIndustryRecoveryEvidence({
        partialDraft,
        progressUpdates: capturedProgress,
      });
      const isTokenLimitTransition = typeof partialDraft === 'string' && partialDraft.trim().length > 0;
      const recoveryMessage = isTokenLimitTransition
        ? 'market overview pass hit token limit — repairing artifact from captured evidence'
        : hasEvidence
          ? 'primary market overview pass timed out — repairing artifact from captured evidence'
          : 'primary market overview pass timed out — retrying with compact repair';
      // Fire-and-forget — emitRunnerProgress is async but progress ordering is
      // best-effort in the cascade; the message lands before the attempt starts.
      void emitRunnerProgress(wrappedProgress, 'runner', recoveryMessage);
      return repairStage.buildContext(originalContext, capturedProgress, partialDraft);
    },
  };

  return runWithCascade(
    context,
    {
      section: 'industryResearch',
      errorSection: 'industryResearch',
      initMessage: 'preparing market overview brief',
      stages: [primaryStage, repairStageWithMessage],
      normalizePayload: normalizeIndustryPayload,
    },
    wrappedProgress,
    cascadeDeps,
  );
}

export async function runResearchIndustry(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<import('../supabase').ResearchResult> {
  return runResearchIndustryWithDeps(context, onProgress);
}
