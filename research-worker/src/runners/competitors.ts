import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  buildRunnerTelemetry,
  createClient,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressUpdate,
  type RunnerProgressReporter,
} from '../runner';
import { finalizeRunnerResult } from '../contracts';
import { adLibraryTool, spyfuTool } from '../tools';
import type { ResearchResult } from '../supabase';

const COMPETITORS_PRIMARY_MODEL =
  process.env.RESEARCH_COMPETITORS_MODEL ?? 'claude-sonnet-4-6';
const COMPETITORS_REPAIR_MODEL =
  process.env.RESEARCH_COMPETITORS_REPAIR_MODEL ??
  process.env.RESEARCH_COMPETITORS_FALLBACK_MODEL ??
  'claude-sonnet-4-6';
const COMPETITORS_RESCUE_MODEL =
  process.env.RESEARCH_COMPETITORS_RESCUE_MODEL ?? COMPETITORS_REPAIR_MODEL;
const COMPETITORS_PRIMARY_MAX_TOKENS = 5600;
const COMPETITORS_REPAIR_MAX_TOKENS = 4200;
const COMPETITORS_RESCUE_MAX_TOKENS = 4200;
const COMPETITORS_PRIMARY_TIMEOUT_MS = 180_000;
const COMPETITORS_REPAIR_TIMEOUT_MS = 90_000;
const COMPETITORS_RESCUE_TIMEOUT_MS = 60_000;
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as const;
type CompetitorTool = typeof WEB_SEARCH_TOOL | typeof adLibraryTool | typeof spyfuTool;

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
      "price": "string — pricing tier or 'See pricing page'",
      "pricingConfidence": "high | medium | low | unknown",
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
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}`;

const COMPETITORS_PRIMARY_SYSTEM_PROMPT = `You are an expert competitive analyst researching the competitor landscape for a paid media strategy.

TASK: Research competitors to inform paid media positioning and messaging.

CRITICAL — COMPETITOR DISAMBIGUATION:
- When multiple companies share a similar name, identify which one operates in the SAME product category and serves the SAME target audience as the business being analyzed
- Verify each competitor's PRIMARY product/service matches the market segment described in the context
- Exclude companies that are homonyms serving completely different industries
- ALWAYS include the competitor's official website URL
- When in doubt between similar-named companies, choose the one with the most similar target customer, product category, and go-to-market approach

TOOL USAGE PLAN — SPEED IS CRITICAL (aim for < 90 seconds total):
1. Use ONE web_search to identify the top 3-5 direct competitors with positioning and review signals — combine terms to reduce calls
2. Use ONE follow-up web_search ONLY if the first search missed a known competitor from the user's context
3. Use adLibraryTool for the SINGLE highest-threat competitor only — skip ad library for others and generate libraryLinks from name/domain
4. Do NOT use spyfuTool unless the user's context explicitly requests keyword spend data
5. MAX 3 total tool calls. Once you have positioning + review evidence for 3-5 competitors, STOP searching and START writing JSON.

SPEED RULES:
- You MUST start producing JSON output within 3 tool calls — do not keep searching
- If you have evidence for 3+ competitors, that is enough — start writing
- Combine search queries (e.g. "CompA vs CompB vs CompC pricing reviews") to reduce round-trips
- Skip adLibraryTool entirely if the first web search already surfaces ad activity evidence
- adActivity.platforms must never be empty; if a platform is not verified, use ["Not verified"] and explain that in adActivity.evidence
- Treat adActivity.activeAdCount as observed ad-library records, not verified always-on live ads, unless the evidence explicitly says the coverage is current and verified
- adActivity.evidence must state one of: Verified, Partial coverage, Limited coverage, or Not verified

RESEARCH FOCUS:
- Competitor positioning and messaging
- Strengths and weaknesses from G2, Capterra reviews
- Market patterns and gaps (white space)
- Ad strategies and creative angles
- Counter-positioning: explicitly state our angle against each competitor

COMPETITOR THREAT ASSESSMENT:
For the top 2 threats, score these 5 threat factors (1-10 each):
- marketShareRecognition: Brand recognition and market share
- adSpendIntensity: Estimated monthly ad spend level
- productOverlap: Feature overlap with client offer
- priceCompetitiveness: Price competitiveness vs client
- growthTrajectory: Funding, hiring, feature velocity
- If adActivity.sourceConfidence is low or adActivity.evidence says limited coverage / historical only / not verified, keep adSpendIntensity conservative (4 or below) and state uncertainty in the competitor narrative
- Do not claim channel white space from low-confidence ad evidence alone
- For lower-priority competitors, threatAssessment may be omitted when the core positioning picture is already strong

WHITE SPACE ANALYSIS:
Identify gaps using this framework:
1. Messaging White Space — messaging angles NO competitor is using
2. Feature/Capability White Space — capabilities unaddressed or addressed poorly
3. Audience White Space — ICP sub-segments competitors are ignoring
4. Channel White Space — platforms with few active competitor ads

COMPRESSION RULES:
- Return 3-5 direct competitors — 3 is enough if evidence is strong
- Keep "positioning", "ourAdvantage", "overallLandscape", and whitespace "recommendedAction" to 1 sentence max
- Limit competitor "strengths", "weaknesses", and "opportunities" to 2 concise bullets each
- Limit "marketPatterns", "marketStrengths", and "marketWeaknesses" to 2 bullets each
- Limit "whiteSpaceGaps" to the 2 highest-impact gaps
- Limit citations to the 4 most relevant sources
- If ad tools are sparse, keep the structured field and explain the evidence briefly instead of writing long prose

${COMPETITORS_OUTPUT_FORMAT}`;

const COMPETITORS_REPAIR_SYSTEM_PROMPT = `You are an expert competitive analyst producing a fast first-pass competitor artifact for a paid media strategist.

TASK: Repair and finish a competitor artifact from an incomplete draft and evidence log gathered in the primary pass.

RULES:
- Do not call tools or do new research
- Use only the evidence package provided in the user message
- Identify exactly 5 direct competitors with official URLs when evidence supports it
- Prioritize positioning, weaknesses, and review-backed signals already present in the evidence package
- If a specific data point is unavailable, use a conservative fallback such as "See pricing page"
- adActivity.platforms must never be empty; if a platform is not verified, use ["Not verified"] and state that in adActivity.evidence
- Treat adActivity.activeAdCount as observed ad records, not verified active live ads, unless the evidence explicitly says coverage is current and verified
- Make the white-space gaps concrete and actionable for paid media messaging
- Do not use inline citations, XML tags, or markdown inside string fields
- Keep each sentence compact enough to fit in a single complete JSON response
- Limit every competitor to:
  - 2 strengths
  - 2 weaknesses
  - 2 opportunities
  - 2 ad themes
  - 2 top ad hooks
- Limit marketPatterns, marketStrengths, and marketWeaknesses to 2 bullets each
- Limit whiteSpaceGaps to the 3 highest-impact gaps
- Limit citations to the 6 most relevant sources

${COMPETITORS_OUTPUT_FORMAT}`;

const COMPETITORS_RESCUE_SYSTEM_PROMPT = `You are an expert competitive analyst producing an ultra-compact competitor artifact when prior attempts exceeded the output budget.

TASK: Return the same schema as requested, but in the smallest complete form that still supports paid media decisions.

MANDATORY COMPRESSION RULES:
- Do not call tools or do new research
- Use only the evidence package provided in the user message
- Return exactly 5 competitors
- No preamble, no markdown, no inline citations, no XML tags
- adActivity.platforms must never be empty; if a platform is not verified, use ["Not verified"]
- Use "Limited coverage" or "Not verified" language in adActivity.evidence whenever the ad data is sparse or historical only
- Keep positioning, ourAdvantage, adActivity.evidence, threatAssessment.counterPositioning, overallLandscape, whitespace evidence, and recommendedAction to 18 words max each
- strengths: exactly 2 items
- weaknesses: exactly 2 items
- opportunities: exactly 2 items
- adActivity.themes: exactly 2 items
- threatAssessment.topAdHooks: exactly 2 items
- marketPatterns: exactly 2 items
- marketStrengths: exactly 2 items
- marketWeaknesses: exactly 2 items
- whiteSpaceGaps: exactly 3 items
- citations: at most 6 items
- Use short plain-language summaries only
- Start the response with { and end it with }

${COMPETITORS_OUTPUT_FORMAT}`;

type CompetitorAttemptMode = 'primary' | 'repair' | 'rescue';
type CompetitorTimeoutSource = 'worker_timeout' | 'request_timeout' | 'network_timeout';

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

interface CompetitorRecoveryContextStats {
  businessLineCount: number;
  searchCount: number;
  sourceCount: number;
  analysisCount: number;
  partialDraftChars: number;
  totalChars: number;
}

interface CompetitorRecoveryContextResult {
  context: string;
  stats: CompetitorRecoveryContextStats;
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
}): CompetitorRecoveryContextResult {
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
  const context = [
    'PRIMARY PASS EVIDENCE PACKAGE:',
    businessSnapshot,
    '',
    'RULES:',
    '- Use only the evidence below.',
    '- Do not invent unsupported competitors, pricing, or ad-activity claims.',
    '- If pricing is unclear, use "See pricing page" and low confidence.',
    '- If direct ad evidence is weak, keep the field but explain the weak evidence briefly.',
    '',
    searches.length > 0 ? `SEARCH QUERIES:\n- ${searches.join('\n- ')}` : null,
    sources.length > 0 ? `CAPTURED SOURCES:\n- ${sources.join('\n- ')}` : null,
    analysisNotes.length > 0 ? `ANALYSIS NOTES:\n- ${analysisNotes.join('\n- ')}` : null,
    partialDraft ? `INCOMPLETE DRAFT TO REPAIR:\n${partialDraft}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n');

  return {
    context,
    stats: {
      businessLineCount: businessSnapshot
        ? businessSnapshot
            .split('\n')
            .filter((line) => line.trim().startsWith('- ')).length
        : 0,
      searchCount: searches.length,
      sourceCount: sources.length,
      analysisCount: analysisNotes.length,
      partialDraftChars: partialDraft?.length ?? 0,
      totalChars: context.length,
    },
  };
}

function hasCompetitorRecoveryEvidence(input: {
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

function getCompetitorAttemptConfig(
  mode: CompetitorAttemptMode,
): CompetitorAttemptConfig {
  if (mode === 'rescue') {
    return {
      mode,
      model: COMPETITORS_RESCUE_MODEL,
      maxTokens: COMPETITORS_RESCUE_MAX_TOKENS,
      timeoutMs: COMPETITORS_RESCUE_TIMEOUT_MS,
      tools: [],
      system: COMPETITORS_RESCUE_SYSTEM_PROMPT,
      synthesisMessage: 'synthesizing ultra-compact competitor rescue',
    };
  }

  if (mode === 'repair') {
    return {
      mode,
      model: COMPETITORS_REPAIR_MODEL,
      maxTokens: COMPETITORS_REPAIR_MAX_TOKENS,
      timeoutMs: COMPETITORS_REPAIR_TIMEOUT_MS,
      tools: [],
      system: COMPETITORS_REPAIR_SYSTEM_PROMPT,
      synthesisMessage: 'repairing competitor artifact from captured evidence',
    };
  }

  return {
    mode,
    model: COMPETITORS_PRIMARY_MODEL,
    maxTokens: COMPETITORS_PRIMARY_MAX_TOKENS,
    timeoutMs: COMPETITORS_PRIMARY_TIMEOUT_MS,
    tools: [WEB_SEARCH_TOOL, adLibraryTool, spyfuTool],
    system: `${COMPETITOR_ANALYSIS_SKILL}\n\n---\n\n${COMPETITORS_PRIMARY_SYSTEM_PROMPT}`,
    synthesisMessage: 'synthesizing competitor landscape',
  };
}

export function isCompetitorTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('request timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  );
}

function getCompetitorTimeoutSource(
  error: unknown,
): CompetitorTimeoutSource | null {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('sub-agent timed out after')) {
    return 'worker_timeout';
  }

  if (normalized.includes('request timed out')) {
    return 'request_timeout';
  }

  if (normalized.includes('network timeout')) {
    return 'network_timeout';
  }

  return normalized.includes('timeout') ? 'request_timeout' : null;
}

export function shouldRetryCompetitorsWithFallback(input: {
  parseError: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  if (!input.parseError) {
    return false;
  }

  // Retry on truncation (max_tokens) OR when the model finished but
  // produced non-JSON output (end_turn / tool_use). The repair pass
  // uses a no-tool prompt with the captured evidence, which is far
  // more likely to produce valid JSON than the primary tool-using pass.
  return true;
}

export function shouldRetryCompetitorsWithRescue(input: {
  parseError: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  if (!input.parseError) {
    return false;
  }

  // Same rationale: always attempt rescue when repair also fails to
  // parse. The rescue pass uses an ultra-compact prompt with hard
  // word limits, maximizing the chance of a complete JSON response.
  return true;
}

function getCompetitorResultText(finalMsg: { content: BetaContentBlock[] }): string {
  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}

function areCompetitorToolsEnabled(config: CompetitorAttemptConfig): boolean {
  return config.tools.length > 0;
}

function buildCompetitorAttemptLabel(config: CompetitorAttemptConfig): string {
  const modeLabel =
    config.mode === 'primary'
      ? 'competitor analysis'
      : config.mode === 'repair'
        ? 'competitor analysis (repair pass)'
        : 'competitor analysis (rescue pass)';
  const toolsLabel = areCompetitorToolsEnabled(config) ? 'with live data' : 'from context';
  return `${modeLabel} ${toolsLabel}`;
}

function buildCompetitorRecoveryStatsMessage(
  _mode: Exclude<CompetitorAttemptMode, 'primary'>,
  _stats: CompetitorRecoveryContextStats,
): string {
  return 'preparing additional competitor analysis';
}

async function runCompetitorToolAttempt(
  context: string,
  config: CompetitorAttemptConfig,
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
        messages: [{ role: 'user', content: `Research competitors for:\n\n${context}` }],
      });
      return Promise.race([
        runStreamedToolRunner(runner, {
          onProgress,
          synthesisMessage: config.synthesisMessage,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`)),
            config.timeoutMs,
          ),
        ),
      ]);
    },
    `researchCompetitors:${config.mode}`,
  );

  return {
    resultText: getCompetitorResultText(finalMsg),
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

async function runCompetitorMessageAttempt(
  context: string,
  config: CompetitorAttemptConfig,
  onProgress?: RunnerProgressReporter,
): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const client = createClient();
  await emitRunnerProgress(onProgress, 'analysis', config.synthesisMessage);

  const finalMsg = await runWithBackoff(
    () =>
      Promise.race([
        client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens,
          system: config.system,
          messages: [{ role: 'user', content: `Research competitors for:\n\n${context}` }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`)),
            config.timeoutMs,
          ),
        ),
      ]),
    `researchCompetitors:${config.mode}`,
  );

  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return {
    resultText: textBlock?.type === 'text' ? textBlock.text : '',
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

async function runCompetitorAttemptWithObservability(
  context: string,
  config: CompetitorAttemptConfig,
  onProgress: RunnerProgressReporter | undefined,
  deps: RunResearchCompetitorsDeps,
): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const runAttempt =
    deps.runAttempt ??
    (areCompetitorToolsEnabled(config)
      ? deps.runToolAttempt ?? runCompetitorToolAttempt
      : deps.runMessageAttempt ?? runCompetitorMessageAttempt);

  await emitRunnerProgress(
    onProgress,
    'runner',
    `${buildCompetitorAttemptLabel(config)} started`,
  );

  try {
    const attemptResult = await runAttempt(context, config, onProgress);
    await emitRunnerProgress(
      onProgress,
      'runner',
      `${buildCompetitorAttemptLabel(config)} complete`,
    );
    return attemptResult;
  } catch (error) {
    const timeoutSource = getCompetitorTimeoutSource(error);
    if (timeoutSource) {
      await emitRunnerProgress(
        onProgress,
        'runner',
        `${buildCompetitorAttemptLabel(config)} timed out`,
      );
    }

    throw error;
  }
}

async function runCompetitorRepairWithTimeoutFallback(input: {
  context: string;
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
  reportProgress: RunnerProgressReporter;
  deps: RunResearchCompetitorsDeps;
}): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const repairContext = buildCompetitorRecoveryContext({
    mode: 'repair',
    context: input.context,
    partialDraft: input.partialDraft,
    progressUpdates: input.progressUpdates,
  });

  await emitRunnerProgress(
    input.reportProgress,
    'runner',
    buildCompetitorRecoveryStatsMessage('repair', repairContext.stats),
  );

  try {
    return await runCompetitorAttemptWithObservability(
      repairContext.context,
      getCompetitorAttemptConfig('repair'),
      input.reportProgress,
      input.deps,
    );
  } catch (error) {
    if (!isCompetitorTimeoutError(error)) {
      throw error;
    }

    const rescueContext = buildCompetitorRecoveryContext({
      mode: 'rescue',
      context: input.context,
      partialDraft: input.partialDraft,
      progressUpdates: input.progressUpdates,
    });

    await emitRunnerProgress(
      input.reportProgress,
      'runner',
      'competitor repair pass timed out — retrying with ultra-compact rescue',
    );
    await emitRunnerProgress(
      input.reportProgress,
      'runner',
      buildCompetitorRecoveryStatsMessage('rescue', rescueContext.stats),
    );

    return runCompetitorAttemptWithObservability(
      rescueContext.context,
      getCompetitorAttemptConfig('rescue'),
      input.reportProgress,
      input.deps,
    );
  }
}

export async function runResearchCompetitorsWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunResearchCompetitorsDeps = {},
): Promise<ResearchResult> {
  const now = deps.now ?? (() => Date.now());
  const parseJson = deps.parseJson ?? extractJson;
  const startTime = now();
  const capturedProgressUpdates: RunnerProgressUpdate[] = [];
  const reportProgress: RunnerProgressReporter = async (update) => {
    capturedProgressUpdates.push(update);
    await onProgress?.(update);
  };

  try {
    await emitRunnerProgress(reportProgress, 'runner', 'preparing competitor research brief');

    let resultText: string;
    let telemetry: ReturnType<typeof buildRunnerTelemetry>;
    let alreadyRecovered = false;
    try {
      const attemptResult = await runCompetitorAttemptWithObservability(
        context,
        getCompetitorAttemptConfig('primary'),
        reportProgress,
        deps,
      );
      resultText = attemptResult.resultText;
      telemetry = attemptResult.telemetry;
    } catch (error) {
      if (!isCompetitorTimeoutError(error)) {
        throw error;
      }

      await emitRunnerProgress(
        reportProgress,
        'runner',
        hasCompetitorRecoveryEvidence({
          progressUpdates: capturedProgressUpdates,
        })
          ? 'primary competitor pass timed out — repairing artifact from captured evidence'
          : 'primary competitor pass timed out — retrying with compact repair',
      );
      const attemptResult = await runCompetitorRepairWithTimeoutFallback({
        context,
        progressUpdates: capturedProgressUpdates,
        reportProgress,
        deps,
      });
      resultText = attemptResult.resultText;
      telemetry = attemptResult.telemetry;
      alreadyRecovered = true;
    }

    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = parseJson(resultText);
    } catch (error) {
      console.error('[competitors] JSON extraction failed:', resultText.slice(0, 300));
      parseError = error;
    }

    // Only attempt repair if the PRIMARY pass completed (not timed out).
    // The timeout handler above already runs repair → rescue, so retrying
    // here would create an infinite loop.
    if (!alreadyRecovered && shouldRetryCompetitorsWithFallback({ parseError, telemetry })) {
      const retryReason =
        telemetry.stopReason === 'max_tokens'
          ? 'primary competitor pass hit token limit'
          : 'primary competitor pass produced non-JSON output';
      await emitRunnerProgress(
        reportProgress,
        'runner',
        `${retryReason} — repairing artifact from captured evidence`,
      );
      const repairAttempt = await runCompetitorRepairWithTimeoutFallback({
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
        reportProgress,
        deps,
      });
      resultText = repairAttempt.resultText;
      telemetry = repairAttempt.telemetry;
      parsed = undefined;
      parseError = undefined;

      try {
        parsed = parseJson(resultText);
      } catch (error) {
        console.error('[competitors:repair] JSON extraction failed:', resultText.slice(0, 300));
        parseError = error;
      }
    }

    if (!alreadyRecovered && shouldRetryCompetitorsWithRescue({ parseError, telemetry })) {
      const recoveryContext = buildCompetitorRecoveryContext({
        mode: 'rescue',
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'competitor repair pass hit token limit — retrying with ultra-compact rescue',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildCompetitorRecoveryStatsMessage('rescue', recoveryContext.stats),
      );
      const rescueAttempt = await runCompetitorAttemptWithObservability(
        recoveryContext.context,
        getCompetitorAttemptConfig('rescue'),
        reportProgress,
        deps,
      );
      resultText = rescueAttempt.resultText;
      telemetry = rescueAttempt.telemetry;
      parsed = undefined;
      parseError = undefined;

      try {
        parsed = parseJson(resultText);
      } catch (error) {
        console.error('[competitors:rescue] JSON extraction failed:', resultText.slice(0, 300));
        parseError = error;
      }
    }

    return finalizeRunnerResult({
      section: 'competitorIntel',
      durationMs: now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'competitorIntel',
      error: error instanceof Error ? error.message : String(error),
      durationMs: now() - startTime,
    };
  }
}

export async function runResearchCompetitors(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  return runResearchCompetitorsWithDeps(context, onProgress);
}
