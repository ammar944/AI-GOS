import type { RunnerCtx, RunnerDeps, RunnerFn } from './base';
import {
  ADVISOR_PROMPT_ADDENDUM,
  ADVISOR_TOOL,
  buildRunnerTelemetry,
  emitRunnerProgress,
  isAdvisorEnabled,
  type RunnerProgressReporter,
  type RunnerProgressUpdate,
} from '../runner';
import {
  runWithCascade,
  type CascadeAttemptConfig,
  type CascadeAttemptResult,
  type CascadeDeps,
  type CascadeStage,
} from '../runner-cascade';
import { adLibraryTool, spyfuTool, firecrawlExtractTool } from '../tools';
import type { ResearchResult } from '../supabase';
import { COMPETITORS_INTELLIGENCE_SKILL, COMPETITORS_INTELLIGENCE_SKILL_COMPACT } from '../skills/intelligence-skill';
import { loadRunnerPrompt } from '../skills/loader';
import { MODELS } from '../models';

const COMPETITORS_PRIMARY_MODEL =
  process.env.RESEARCH_COMPETITORS_MODEL ?? MODELS.STANDARD;
const COMPETITORS_REPAIR_MODEL =
  process.env.RESEARCH_COMPETITORS_REPAIR_MODEL ??
  process.env.RESEARCH_COMPETITORS_FALLBACK_MODEL ??
  MODELS.STANDARD;
const COMPETITORS_RESCUE_MODEL =
  process.env.RESEARCH_COMPETITORS_RESCUE_MODEL ?? COMPETITORS_REPAIR_MODEL;
const COMPETITORS_PRIMARY_MAX_TOKENS = 4200;
const COMPETITORS_REPAIR_MAX_TOKENS = 4200;
const COMPETITORS_RESCUE_MAX_TOKENS = 4200;
const COMPETITORS_PRIMARY_TIMEOUT_MS = 180_000;
const COMPETITORS_REPAIR_TIMEOUT_MS = 90_000;
const COMPETITORS_RESCUE_TIMEOUT_MS = 60_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;
type CompetitorTool = typeof WEB_SEARCH_TOOL | typeof adLibraryTool | typeof spyfuTool | typeof firecrawlExtractTool;

const COMPETITOR_ANALYSIS_SKILL = `
## Competitive Analysis Domain Knowledge

### Ad Library Interpretation
- 0-5 active ads: testing phase or low investment
- 5-20 active ads: established presence, iterating
- 20-50 active ads: scaling actively, well-funded
- 50+ active ads: dominant advertiser, heavy investment

### Competitive Positioning Frameworks
- Category leader: focuses on market share ("the #1 X")
- Challenger: attacks leader's weakness ("X without the [pain]")
- Niche specialist: owns a segment ("the only X for [ICP]")
- Price disruptor: "enterprise features at SMB prices"

### Review Mining (G2/Capterra) Patterns
- Look for reviews mentioning "switched from X" — reveals switching triggers
- 1-2 star reviews reveal acute pain points = your messaging hooks
- Feature requests in reviews = product gaps = white space opportunity
- "What do you wish it did" reviews = unmet needs your offer should address

### White Space Identification
- Messaging white space: emotional angles no one owns
- Audience white space: ICP sub-segments being ignored
- Channel white space: platforms with weak competitor presence
- Feature white space: capabilities no one talks about in ads
`;

const COMPETITORS_OUTPUT_FORMAT = `OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "competitors": [
    {
      "name": "string",
      "website": "string — official URL",
      "positioning": "string — their core value proposition",
      "price": "string | null — ONLY from firecrawlExtract crawl of their /pricing page. null if not crawled or no pricing found.",
      "pricingConfidence": "high | unknown — 'high' only if firecrawlExtract returned real tier data. 'unknown' otherwise.",
      "pricingSourceUrl": "string | null — the URL you crawled with firecrawlExtract (null if not crawled)",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "opportunities": ["string — exploitable gaps against this competitor"],
      "ourAdvantage": "string — why our client should win against them",
      "adActivity": {
        "activeAdCount": 12,
        "platforms": ["LinkedIn", "Google"],
        "themes": ["string — recurring ad themes"],
        "evidence": "string — how you know this",
        "sourceConfidence": "high | medium | low"
      },
      "adCreatives": [
        {
          "platform": "linkedin | meta | google",
          "id": "string",
          "advertiser": "string",
          "headline": "string",
          "format": "image | video | carousel | text | message | unknown",
          "isActive": true,
          "detailsUrl": "string — link to the ad in the public library"
        }
      ],
      "libraryLinks": {
        "metaLibraryUrl": "string — Meta Ad Library search URL for this competitor",
        "linkedInLibraryUrl": "string — LinkedIn Ad Library search URL for this competitor",
        "googleAdvertiserUrl": "string — Google Ads Transparency URL for this competitor"
      },
      "threatAssessment": {
        "threatFactors": {
          "marketShareRecognition": 1-10,
          "adSpendIntensity": 1-10,
          "productOverlap": 1-10,
          "priceCompetitiveness": 1-10,
          "growthTrajectory": 1-10
        },
        "topAdHooks": ["string"],
        "counterPositioning": "string — how to position against them"
      }
    }
  ],
  "marketPatterns": ["string — patterns across the competitive landscape"],
  "marketStrengths": ["string — what the category does well"],
  "marketWeaknesses": ["string — where positioning or execution is weak"],
  "whiteSpaceGaps": [
    {
      "gap": "string — the whitespace to attack",
      "type": "messaging | feature | audience | channel",
      "evidence": "string — what competitors do instead",
      "exploitability": 1-10,
      "impact": 1-10,
      "recommendedAction": "string"
    }
  ],
  "overallLandscape": "string — summary of competitive landscape",
  "positioningMoves": [
    {
      "move": "string — 1 sentence: the positioning action to take",
      "targetCompetitor": "string — name of the competitor you're countering",
      "risk": "low | medium | high",
      "reward": "low | medium | high",
      "playbook": "string — 1 sentence: execution hint for ad creative or messaging"
    }
  ],
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}`;

const COMPETITORS_PRIMARY_SYSTEM_PROMPT =
  loadRunnerPrompt('competitors-primary.md') +
  '\n\n' +
  COMPETITORS_OUTPUT_FORMAT +
  '\n\n' +
  COMPETITORS_INTELLIGENCE_SKILL;

const COMPETITORS_REPAIR_SYSTEM_PROMPT =
  loadRunnerPrompt('competitors-repair.md') +
  '\n\n' +
  COMPETITORS_OUTPUT_FORMAT +
  '\n\n' +
  COMPETITORS_INTELLIGENCE_SKILL_COMPACT;

const COMPETITORS_RESCUE_SYSTEM_PROMPT =
  loadRunnerPrompt('competitors-rescue.md') +
  '\n\n' +
  COMPETITORS_OUTPUT_FORMAT +
  '\n\n' +
  COMPETITORS_INTELLIGENCE_SKILL_COMPACT;

type CompetitorAttemptMode = 'primary' | 'repair' | 'rescue';

interface CompetitorAttemptConfig {
  mode: CompetitorAttemptMode;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools: CompetitorTool[];
  system: string;
  synthesisMessage: string;
}

interface RunResearchCompetitorsDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  runAttempt?: (
    context: string,
    config: CompetitorAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
  runToolAttempt?: (
    context: string,
    config: CompetitorAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
  runMessageAttempt?: (
    context: string,
    config: CompetitorAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
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

function truncateRecoveryText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  return trimmed.slice(0, maxChars).trimEnd();
}

function buildCompetitorBusinessSnapshot(input: {
  context: string;
  maxLines: number;
  maxChars: number;
}): string | null {
  const trimmedContext = input.context.trim();
  if (trimmedContext.length === 0) {
    return null;
  }

  const businessMarker = 'Business context:';
  const dependenciesMarker = 'Existing persisted research to reuse:';
  const businessMarkerIndex = trimmedContext.indexOf(businessMarker);

  if (businessMarkerIndex >= 0) {
    const afterBusinessMarker = trimmedContext.slice(
      businessMarkerIndex + businessMarker.length,
    );
    const dependenciesIndex = afterBusinessMarker.indexOf(dependenciesMarker);
    const businessSection =
      dependenciesIndex >= 0
        ? afterBusinessMarker.slice(0, dependenciesIndex)
        : afterBusinessMarker;
    const businessLines = businessSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .slice(0, input.maxLines);

    if (businessLines.length > 0) {
      return truncateRecoveryText(
        ['BUSINESS SNAPSHOT:', ...businessLines].join('\n'),
        input.maxChars,
      );
    }
  }

  const compactSummary = truncateRecoveryText(
    trimmedContext.split('\n').map((line) => line.trim()).filter(Boolean).join(' '),
    input.maxChars,
  );

  if (compactSummary.length === 0) {
    return null;
  }

  return `BUSINESS SNAPSHOT:\n- ${compactSummary}`;
}

function buildCompetitorRecoveryContext(input: {
  mode: Exclude<CompetitorAttemptMode, 'primary'>;
  context: string;
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
}): string {
  const limits =
    input.mode === 'rescue'
      ? {
          businessLineCount: 6,
          businessChars: 1_200,
          searchCount: 3,
          sourceCount: 6,
          analysisCount: 3,
          partialDraftChars: 1_200,
        }
      : {
          businessLineCount: 6,
          businessChars: 1_400,
          searchCount: 4,
          sourceCount: 6,
          analysisCount: 4,
          partialDraftChars: 2_500,
        };
  const businessSnapshot = buildCompetitorBusinessSnapshot({
    context: input.context,
    maxLines: limits.businessLineCount,
    maxChars: limits.businessChars,
  });
  const sources = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) => update.phase === 'tool' && update.message.startsWith('source: '),
      )
      .map((update) => update.message),
  ).slice(0, limits.sourceCount);
  const searches = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) => update.phase === 'tool' && update.message.startsWith('searching: '),
      )
      .map((update) => update.message),
  ).slice(0, limits.searchCount);
  const analysisNotes = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) =>
          update.phase === 'analysis' && update.message.startsWith('draft '),
      )
      .map((update) => update.message),
  ).slice(0, limits.analysisCount);
  const partialDraft =
    typeof input.partialDraft === 'string' && input.partialDraft.trim().length > 0
      ? input.partialDraft.trim().slice(0, limits.partialDraftChars)
      : null;

  return [
    'PRIMARY PASS EVIDENCE PACKAGE:',
    businessSnapshot,
    '',
    'RULES:',
    '- Use only the evidence below.',
    '- Do not invent unsupported competitors, pricing, or ad-activity claims.',
    '- PRICING RULE: For each competitor, use firecrawlExtract on their /pricing page (e.g. https://competitor.com/pricing) to get real tier data. If the crawl returns pricing tiers, set price to a summary (e.g. "$5K-$15K/mo"), pricingConfidence to "high", and pricingSourceUrl to the crawled URL.',
    '- If firecrawlExtract fails or returns no pricing data, set price to null, pricingConfidence to "unknown", and pricingSourceUrl to null. NEVER guess or infer pricing from training data.',
    '- Limit firecrawlExtract to at most 3 calls total (one per top competitor) to avoid timeout.',
    '- If direct ad evidence is weak, keep the field but explain the weak evidence briefly.',
    '',
    searches.length > 0 ? `SEARCH QUERIES:\n- ${searches.join('\n- ')}` : null,
    sources.length > 0 ? `CAPTURED SOURCES:\n- ${sources.join('\n- ')}` : null,
    analysisNotes.length > 0 ? `ANALYSIS NOTES:\n- ${analysisNotes.join('\n- ')}` : null,
    partialDraft ? `INCOMPLETE DRAFT TO REPAIR:\n${partialDraft}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Retained for test-signature compatibility. These helpers no longer drive the
// cascade flow (runWithCascade advances on parse-failure OR max_tokens OR
// timeout internally); they stay exported because existing unit tests verify
// their contracts directly.
// ---------------------------------------------------------------------------

export function isCompetitorTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('request timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  );
}

export function shouldRetryCompetitorsWithFallback(input: {
  parseError: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  return Boolean(input.parseError);
}

export function shouldRetryCompetitorsWithRescue(input: {
  parseError: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  return Boolean(input.parseError);
}

// ---------------------------------------------------------------------------
// Cascade stage builders
// ---------------------------------------------------------------------------

const PRIMARY_MODE_LABEL = 'competitor analysis with live data';
const REPAIR_MODE_LABEL = 'competitor analysis (repair pass) from context';
const RESCUE_MODE_LABEL = 'competitor analysis (rescue pass) from context';
const USER_MESSAGE_PREFIX = 'Research competitors for:\n\n';

function buildPrimaryTools(): CompetitorTool[] {
  return [
    WEB_SEARCH_TOOL,
    adLibraryTool,
    spyfuTool,
    firecrawlExtractTool,
    ...(isAdvisorEnabled() ? [ADVISOR_TOOL as unknown as CompetitorTool] : []),
  ];
}

function buildPrimaryStage(): CascadeStage {
  return {
    config: {
      mode: PRIMARY_MODE_LABEL,
      model: COMPETITORS_PRIMARY_MODEL,
      maxTokens: COMPETITORS_PRIMARY_MAX_TOKENS,
      timeoutMs: COMPETITORS_PRIMARY_TIMEOUT_MS,
      tools: buildPrimaryTools(),
      system: `${isAdvisorEnabled() ? ADVISOR_PROMPT_ADDENDUM : ''}${COMPETITOR_ANALYSIS_SKILL}\n\n---\n\n${COMPETITORS_PRIMARY_SYSTEM_PROMPT}`,
      synthesisMessage: 'synthesizing competitor landscape',
      maxToolIterations: 3,
      userMessage: '{{context}}',
    },
    buildContext: (originalContext) => `${USER_MESSAGE_PREFIX}${originalContext}`,
  };
}

function buildRecoveryStage(input: {
  mode: Exclude<CompetitorAttemptMode, 'primary'>;
  modeLabel: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  system: string;
  synthesisMessage: string;
  originalContextRef: { value: string };
  reportProgress: RunnerProgressReporter;
  /** Bridge message emitted when the previous stage timed out. */
  timeoutBridgeMessage: string;
  /** Bridge message emitted when the previous stage hit the token limit / parse failure. */
  tokenLimitBridgeMessage: string;
}): CascadeStage {
  return {
    config: {
      mode: input.modeLabel,
      model: input.model,
      maxTokens: input.maxTokens,
      timeoutMs: input.timeoutMs,
      tools: [],
      system: input.system,
      synthesisMessage: input.synthesisMessage,
      userMessage: '{{context}}',
    },
    buildContext: (originalContext, capturedProgress, partialDraft) => {
      // Decide which bridge message to emit based on whether a partial draft was captured.
      // A truthy partialDraft indicates the previous stage produced text (token-limit / parse
      // failure path). An empty partialDraft means the previous stage timed out.
      const hadPartialDraft =
        typeof partialDraft === 'string' && partialDraft.trim().length > 0;
      const bridgeMessage = hadPartialDraft
        ? input.tokenLimitBridgeMessage
        : input.timeoutBridgeMessage;
      // Fire-and-forget — the wrapped progress reporter is synchronous so messages
      // land in order before the observability wrapper emits `${mode} started`.
      void emitRunnerProgress(input.reportProgress, 'runner', bridgeMessage);
      void emitRunnerProgress(
        input.reportProgress,
        'runner',
        'preparing additional competitor analysis',
      );
      // Use the original context captured before stage entry so recovery context
      // builders see the full business snapshot, not the rewritten user message.
      const recoveryContext = buildCompetitorRecoveryContext({
        mode: input.mode,
        context: input.originalContextRef.value,
        partialDraft,
        progressUpdates: capturedProgress,
      });
      return `${USER_MESSAGE_PREFIX}${recoveryContext}`;
    },
  };
}

// ---------------------------------------------------------------------------
// Bridge: adapt legacy (context, config, onProgress) deps to CascadeDeps
// ---------------------------------------------------------------------------

function extractRawContext(userMessage: string): string {
  return userMessage.startsWith(USER_MESSAGE_PREFIX)
    ? userMessage.slice(USER_MESSAGE_PREFIX.length)
    : userMessage;
}

function toCompetitorAttemptConfig(
  config: CascadeAttemptConfig,
): CompetitorAttemptConfig {
  const mode: CompetitorAttemptMode =
    config.mode === PRIMARY_MODE_LABEL
      ? 'primary'
      : config.mode === REPAIR_MODE_LABEL
        ? 'repair'
        : 'rescue';
  return {
    mode,
    model: config.model,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    tools: config.tools as CompetitorTool[],
    system: config.system,
    synthesisMessage: config.synthesisMessage,
  };
}

function bridgeLegacyDeps(
  deps: RunResearchCompetitorsDeps,
): CascadeDeps {
  const toolBridge =
    deps.runAttempt ?? deps.runToolAttempt
      ? async (
          config: CascadeAttemptConfig,
          onProgress?: RunnerProgressReporter,
        ): Promise<CascadeAttemptResult> => {
          const runner = deps.runAttempt ?? deps.runToolAttempt!;
          return runner(
            extractRawContext(config.userMessage),
            toCompetitorAttemptConfig(config),
            onProgress,
          );
        }
      : undefined;
  const messageBridge =
    deps.runAttempt ?? deps.runMessageAttempt
      ? async (
          config: CascadeAttemptConfig,
          onProgress?: RunnerProgressReporter,
        ): Promise<CascadeAttemptResult> => {
          const runner = deps.runAttempt ?? deps.runMessageAttempt!;
          return runner(
            extractRawContext(config.userMessage),
            toCompetitorAttemptConfig(config),
            onProgress,
          );
        }
      : undefined;

  return {
    now: deps.now,
    parseJson: deps.parseJson,
    runToolAttempt: toolBridge,
    runMessageAttempt: messageBridge,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runResearchCompetitorsWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunResearchCompetitorsDeps = {},
): Promise<ResearchResult> {
  const capturedProgressUpdates: RunnerProgressUpdate[] = [];
  const reportProgress: RunnerProgressReporter = async (update) => {
    capturedProgressUpdates.push(update);
    await onProgress?.(update);
  };

  // Closure-captured context ref so recovery stages can rebuild their evidence
  // package from the ORIGINAL business context, not the rewritten user message.
  const originalContextRef = { value: context };

  const primaryStage = buildPrimaryStage();
  const repairStage = buildRecoveryStage({
    mode: 'repair',
    modeLabel: REPAIR_MODE_LABEL,
    model: COMPETITORS_REPAIR_MODEL,
    maxTokens: COMPETITORS_REPAIR_MAX_TOKENS,
    timeoutMs: COMPETITORS_REPAIR_TIMEOUT_MS,
    system: COMPETITORS_REPAIR_SYSTEM_PROMPT,
    synthesisMessage: 'repairing competitor artifact from captured evidence',
    originalContextRef,
    reportProgress,
    timeoutBridgeMessage:
      'primary competitor pass timed out — repairing artifact from captured evidence',
    tokenLimitBridgeMessage:
      'primary competitor pass hit token limit — repairing artifact from captured evidence',
  });
  const rescueStage = buildRecoveryStage({
    mode: 'rescue',
    modeLabel: RESCUE_MODE_LABEL,
    model: COMPETITORS_RESCUE_MODEL,
    maxTokens: COMPETITORS_RESCUE_MAX_TOKENS,
    timeoutMs: COMPETITORS_RESCUE_TIMEOUT_MS,
    system: COMPETITORS_RESCUE_SYSTEM_PROMPT,
    synthesisMessage: 'synthesizing ultra-compact competitor rescue',
    originalContextRef,
    reportProgress,
    timeoutBridgeMessage:
      'competitor repair pass timed out — retrying with ultra-compact rescue',
    tokenLimitBridgeMessage:
      'competitor repair pass hit token limit — retrying with ultra-compact rescue',
  });

  return runWithCascade(
    context,
    {
      section: 'competitorIntel',
      errorSection: 'competitorIntel',
      initMessage: 'preparing competitor research brief',
      stages: [primaryStage, repairStage, rescueStage],
    },
    reportProgress,
    bridgeLegacyDeps(deps),
  );
}

export async function runResearchCompetitors(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  return runResearchCompetitorsWithDeps(context, onProgress);
}

// Type-check: runResearchCompetitors conforms to RunnerFn when called with a RunnerCtx.
// This is a compile-time assertion — it catches drift between runner signatures
// and the unified contract without forcing immediate migration.
const _runnerFnCheck: (ctx: RunnerCtx, onProgress?: Parameters<RunnerFn>[1]) => ReturnType<RunnerFn> =
  (ctx, onProgress) => runResearchCompetitors(ctx.context, onProgress);
void _runnerFnCheck;
