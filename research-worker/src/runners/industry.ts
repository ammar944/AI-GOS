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
import { loadRunnerPrompt } from '../skills/loader';
import { MODELS } from '../models';

const INDUSTRY_PRIMARY_MODEL =
  process.env.RESEARCH_INDUSTRY_MODEL ?? MODELS.FAST;
const INDUSTRY_REPAIR_MODEL =
  process.env.RESEARCH_INDUSTRY_REPAIR_MODEL ?? MODELS.STANDARD;
const INDUSTRY_PRIMARY_MAX_TOKENS = 8000;
const INDUSTRY_REPAIR_MAX_TOKENS = 4000;
const INDUSTRY_PRIMARY_TIMEOUT_MS = 120_000;
const INDUSTRY_REPAIR_TIMEOUT_MS = 90_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;

export const INDUSTRY_PRIMARY_SYSTEM_PROMPT =
  `${loadRunnerPrompt('industry-system')}\n${INDUSTRY_INTELLIGENCE_SKILL}`;

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
      // Trailing reinforcement: models follow recent instructions strongly, so
      // repeating the JSON-only constraint at the END of the user message (in
      // addition to the TOP of the system prompt) dramatically cuts the rate
      // at which the primary pass drifts into markdown + forces a 90s repair.
      `Research the industry and market for:\n\n${originalContext}\n\nOUTPUT REMINDER: Respond with ONLY the JSON object. Start the response with \`{\` and end with \`}\`. No markdown code fences. No preamble. No trailing commentary.`,
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
