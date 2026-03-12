import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  buildRunnerTelemetry,
  createClient,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
  type RunnerProgressUpdate,
} from '../runner';
import { finalizeRunnerResult } from '../contracts';
import { spyfuTool } from '../tools';
import type { ResearchResult } from '../supabase';

const KEYWORDS_PRIMARY_MODEL =
  process.env.RESEARCH_KEYWORDS_MODEL ?? 'claude-sonnet-4-6';
const KEYWORDS_REPAIR_MODEL =
  process.env.RESEARCH_KEYWORDS_REPAIR_MODEL ?? 'claude-sonnet-4-6';
const KEYWORDS_HEURISTIC_MODEL =
  process.env.RESEARCH_KEYWORDS_HEURISTIC_MODEL ?? KEYWORDS_REPAIR_MODEL;
const KEYWORDS_RESCUE_MODEL =
  process.env.RESEARCH_KEYWORDS_RESCUE_MODEL ?? KEYWORDS_REPAIR_MODEL;
const KEYWORDS_PRIMARY_MAX_TOKENS = 4000;
const KEYWORDS_REPAIR_MAX_TOKENS = 3200;
const KEYWORDS_HEURISTIC_MAX_TOKENS = 2600;
const KEYWORDS_RESCUE_MAX_TOKENS = 2200;
const KEYWORDS_PRIMARY_TIMEOUT_MS = 120_000;
const KEYWORDS_REPAIR_TIMEOUT_MS = 90_000;
const KEYWORDS_HEURISTIC_TIMEOUT_MS = 75_000;
const KEYWORDS_RESCUE_TIMEOUT_MS = 75_000;

const KEYWORDS_OUTPUT_FORMAT = `OUTPUT FORMAT:
Respond with JSON only. No preamble. No markdown fences. Start with { and end with }.

{
  "totalKeywordsFound": number,
  "competitorGapCount": number,
  "campaignGroups": [
    {
      "campaign": "string — campaign name",
      "intent": "string — buyer intent / funnel stage",
      "recommendedMonthlyBudget": 1200,
      "adGroups": [
        {
          "name": "string — ad group name",
          "recommendedMatchTypes": ["phrase", "exact"],
          "keywords": [
            {
              "keyword": "string",
              "searchVolume": 1000,
              "difficulty": "low | medium | high",
              "estimatedCpc": "$12.40",
              "priorityScore": 1-100,
              "confidence": "high | medium | low"
            }
          ],
          "negativeKeywords": ["jobs", "free"]
        }
      ]
    }
  ],
  "topOpportunities": [
    {
      "keyword": "string",
      "searchVolume": number,
      "difficulty": "low | medium | high",
      "estimatedCpc": "string e.g. $4.20",
      "priorityScore": 1-100,
      "confidence": "high | medium | low"
    }
  ],
  "recommendedStartingSet": [
    {
      "keyword": "string",
      "campaign": "string",
      "adGroup": "string",
      "recommendedMonthlyBudget": 600,
      "reason": "string — why this is in the starting set",
      "priorityScore": 1-100
    }
  ],
  "competitorGaps": [
    {
      "keyword": "string",
      "competitorName": "string",
      "searchVolume": number,
      "estimatedCpc": "$14.00",
      "priorityScore": 1-100
    }
  ],
  "negativeKeywords": [
    {
      "keyword": "string",
      "reason": "string — why to exclude it"
    }
  ],
  "confidenceNotes": ["string — explain where evidence is directional or weak"],
  "quickWins": ["string — 3 immediately actionable recommendations"],
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}`;

const KEYWORDS_PRIMARY_SYSTEM_PROMPT = `You are a paid search keyword intelligence specialist.

TASK: Find the highest-value paid search keyword opportunities for this business.

RESEARCH FOCUS:
1. Competitor alternative terms ("[competitor] alternative", "[competitor] pricing")
2. Category-intent terms ("b2b saas demand generation agency", "saas paid media agency")
3. Pain-point terms tied to buyer language ("lower CAC", "pipeline attribution", "stop MQLs")
4. Long-tail terms with clear commercial intent

TOOL USAGE:
- Use the spyfu tool once when it can add live keyword or competitor evidence
- If spyfu is unavailable, sparse, or errors, continue using the persisted industry, ICP, offer, strategic, and competitor context already provided

DATA HONESTY:
- Never invent verified search volume or CPC data
- If a metric is unavailable, set "searchVolume" to 0, set "estimatedCpc" to "Not verified", set "confidence" to "low", and explain that in "confidenceNotes"
- If live keyword coverage is sparse, return fewer terms instead of filler rows
- "competitorGaps" may be an empty array when no source-backed gap data exists

SIZE RULES:
- Return at most 2 campaignGroups
- Each campaignGroup may have at most 2 adGroups
- Each adGroup may have at most 4 keywords
- topOpportunities: max 6 entries
- recommendedStartingSet: max 6 entries
- competitorGaps: max 6 entries
- negativeKeywords: max 8 entries
- confidenceNotes: 2-4 entries
- quickWins: exactly 3 entries
- Keep every reason concise and specific
- totalKeywordsFound must equal the total number of keyword objects returned across all campaignGroups
- competitorGapCount must equal competitorGaps.length

${KEYWORDS_OUTPUT_FORMAT}`;

const KEYWORDS_REPAIR_SYSTEM_PROMPT = `You are a paid search keyword strategist repairing a keyword artifact from compact evidence only.

TASK: Finish the keyword intelligence artifact using the evidence package in the user message.

RULES:
- Do not call tools
- Use only the business snapshot, market overview snapshot, ICP validation snapshot, offer analysis snapshot, strategic synthesis snapshot, competitor snapshot, keyword provider status, analysis notes, and incomplete draft provided
- Never invent verified search volume or CPC data
- If metrics are unavailable, set "searchVolume" to 0, set "estimatedCpc" to "Not verified", and set "confidence" to "low"
- Prefer fewer high-intent terms over broad filler coverage
- "competitorGaps" may be an empty array when source-backed gap data is unavailable
- Return at most 2 campaignGroups, 1 adGroup per campaign, and 3 keywords per adGroup
- topOpportunities: max 4 entries
- recommendedStartingSet: max 4 entries
- competitorGaps: max 4 entries and may be [] when no empirical gap evidence exists
- negativeKeywords: max 6 entries
- confidenceNotes: 2-4 entries
- quickWins: exactly 3 entries
- totalKeywordsFound must equal the total number of keyword objects returned across all campaignGroups
- competitorGapCount must equal competitorGaps.length
- Start the response with { and end it with }

${KEYWORDS_OUTPUT_FORMAT}`;

const KEYWORDS_HEURISTIC_SYSTEM_PROMPT = `You are a paid search keyword strategist producing a compact heuristic fallback artifact after live keyword providers failed, were unavailable, or returned sparse evidence.

TASK: Build the smallest strategically useful keyword plan that remains honest about missing empirical data.

MANDATORY HEURISTIC RULES:
- Do not call tools
- Use only the business snapshot, section snapshots, provider status, and incomplete draft provided
- Return fewer terms rather than broader fake coverage
- Prefer these buckets when evidence supports them:
  1. Competitor alternative / pricing intent
  2. Pain-led category intent
  3. Transparent pricing or proof-led evaluation intent
- Never invent numeric search volume or CPC values
- Set "searchVolume" to 0, set "estimatedCpc" to "Not verified", and set "confidence" to "low" for every keyword
- competitorGaps may be []
- Keep grouping strategic, not empirical
- Return exactly 2 campaignGroups
- Return exactly 1 adGroup per campaignGroup
- Return exactly 2 keywords per adGroup
- topOpportunities: exactly 2 entries
- recommendedStartingSet: exactly 2 entries
- negativeKeywords: 2-4 entries
- confidenceNotes: exactly 3 entries
- quickWins: exactly 3 entries
- totalKeywordsFound must equal the total number of keyword objects returned across all campaignGroups
- competitorGapCount must equal competitorGaps.length
- Start the response with { and end it with }

${KEYWORDS_OUTPUT_FORMAT}`;

const KEYWORDS_RESCUE_SYSTEM_PROMPT = `You are a paid search keyword strategist producing an ultra-compact rescue artifact after earlier passes exceeded the output budget.

TASK: Return the same keyword schema in the smallest complete form that still unblocks campaign planning.

MANDATORY COMPRESSION RULES:
- Do not call tools
- Use only the evidence package provided
- Never invent verified search volume or CPC data
- If metrics are unavailable, set "searchVolume" to 0, set "estimatedCpc" to "Not verified", and set "confidence" to "low"
- Prefer fewer high-intent terms over broad filler coverage
- "competitorGaps" may be an empty array when source-backed gap data is unavailable
- Return exactly 2 campaignGroups
- Return exactly 1 adGroup per campaignGroup
- Return exactly 2 keywords per adGroup
- topOpportunities: max 4 entries
- recommendedStartingSet: max 4 entries
- competitorGaps: max 4 entries
- negativeKeywords: max 4 entries
- confidenceNotes: exactly 2 entries
- quickWins: exactly 3 entries
- Keep campaign intent, reasons, and notes to one sentence each
- totalKeywordsFound must equal the total number of keyword objects returned across all campaignGroups
- competitorGapCount must equal competitorGaps.length
- Start the response with { and end it with }

${KEYWORDS_OUTPUT_FORMAT}`;

type KeywordTool = typeof spyfuTool;
type KeywordAttemptMode = 'primary' | 'repair' | 'heuristic' | 'rescue';
type KeywordTimeoutSource =
  | 'worker_timeout'
  | 'request_timeout'
  | 'network_timeout';

type KeywordProviderId =
  | 'spyfu'
  | 'googleKeywordPlanner'
  | 'semrush'
  | 'ahrefs';

interface KeywordProviderStatus {
  id: KeywordProviderId;
  label: string;
  available: boolean;
  reason: string;
}

interface KeywordAttemptConfig {
  mode: KeywordAttemptMode;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools: KeywordTool[];
  system: string;
  synthesisMessage: string;
}

interface RunResearchKeywordsDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  runAttempt?: (
    context: string,
    config: KeywordAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
  runToolAttempt?: (
    context: string,
    config: KeywordAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
  runMessageAttempt?: (
    context: string,
    config: KeywordAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
}

interface KeywordRecoveryContextStats {
  businessLineCount: number;
  sectionSummaryCount: number;
  analysisCount: number;
  partialDraftChars: number;
  totalChars: number;
}

interface KeywordRecoveryContextResult {
  context: string;
  stats: KeywordRecoveryContextStats;
}

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

function asStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function hasGoogleAdsCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

function getKeywordProviderStatuses(): KeywordProviderStatus[] {
  return [
    {
      id: 'spyfu',
      label: 'SpyFu',
      available: Boolean(process.env.SPYFU_API_KEY),
      reason: process.env.SPYFU_API_KEY
        ? 'Configured for live keyword evidence.'
        : 'SpyFu credentials are not configured in this worker.',
    },
    {
      id: 'googleKeywordPlanner',
      label: 'Google Keyword Planner',
      available: false,
      reason: hasGoogleAdsCredentials()
        ? 'Google Ads credentials exist, but a Keyword Planner adapter is not implemented in this worker.'
        : 'Google Keyword Planner is not configured in this worker.',
    },
    {
      id: 'semrush',
      label: 'SEMrush',
      available: false,
      reason: process.env.SEMRUSH_API_KEY
        ? 'SEMrush credentials exist, but a SEMrush keyword adapter is not implemented in this worker.'
        : 'SEMrush is not configured in this worker.',
    },
    {
      id: 'ahrefs',
      label: 'Ahrefs',
      available: false,
      reason: process.env.AHREFS_API_KEY
        ? 'Ahrefs credentials exist, but an Ahrefs keyword adapter is not implemented in this worker.'
        : 'Ahrefs is not configured in this worker.',
    },
  ];
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

function buildKeywordBusinessSnapshot(input: {
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
    trimmedContext
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' '),
    input.maxChars,
  );

  if (compactSummary.length === 0) {
    return null;
  }

  return `BUSINESS SNAPSHOT:\n- ${compactSummary}`;
}

function extractKeywordSectionBlocks(context: string): Record<string, string> {
  const matches = [...context.matchAll(/^## (.+)$/gm)];
  const blocks: Record<string, string> = {};

  for (const [index, match] of matches.entries()) {
    const sectionName = match[1]?.trim();
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      index + 1 < matches.length
        ? (matches[index + 1]?.index ?? context.length)
        : context.length;
    const block = context.slice(startIndex, endIndex).trim();

    if (sectionName && block.length > 0) {
      blocks[sectionName] = block;
    }
  }

  return blocks;
}

function parseKeywordSectionPayload(rawBlock: string | undefined): unknown | null {
  if (!rawBlock) {
    return null;
  }

  try {
    return JSON.parse(rawBlock);
  } catch {
    return null;
  }
}

function buildSnapshotSection(
  title: string,
  lines: Array<string | null>,
): string | null {
  const normalizedLines = lines.filter((line): line is string => Boolean(line));
  if (normalizedLines.length === 0) {
    return null;
  }

  return [title, ...normalizedLines].join('\n');
}

function formatKeywordSummaryLine(
  label: string,
  value: string | null,
  maxChars: number,
): string | null {
  if (!value) {
    return null;
  }

  return `- ${label}: ${truncateRecoveryText(value, maxChars)}`;
}

function summarizeKeywordStrategicSynthesis(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const positioningStrategy = isRecord(payload.positioningStrategy)
    ? payload.positioningStrategy
    : null;
  const recommendedAngle = positioningStrategy
    ? asString(positioningStrategy.recommendedAngle)
    : null;
  const keyDifferentiator = positioningStrategy
    ? asString(positioningStrategy.keyDifferentiator)
    : null;
  const keyInsights = asRecordArray(payload.keyInsights)
    .slice(0, 3)
    .map((insight) => asString(insight.implication) ?? asString(insight.insight))
    .filter((insight): insight is string => Boolean(insight));
  const messagingAngles = asRecordArray(payload.messagingAngles)
    .slice(0, 3)
    .map((angle) => {
      const name = asString(angle.angle);
      const hook = asString(angle.exampleHook);
      if (!name) {
        return null;
      }

      return hook ? `${name}: ${hook}` : name;
    })
    .filter((angle): angle is string => Boolean(angle));
  const platformRecommendations = asRecordArray(payload.platformRecommendations)
    .slice(0, 2)
    .map((platform) => {
      const name = asString(platform.platform);
      const rationale = asString(platform.rationale);
      if (!name) {
        return null;
      }

      return rationale ? `${name}: ${rationale}` : name;
    })
    .filter((platform): platform is string => Boolean(platform));

  return buildSnapshotSection('STRATEGIC SYNTHESIS SNAPSHOT:', [
    formatKeywordSummaryLine('Recommended angle', recommendedAngle, 220),
    formatKeywordSummaryLine('Key differentiator', keyDifferentiator, 220),
    formatKeywordSummaryLine(
      'Search implications',
      keyInsights.length > 0 ? keyInsights.join(' | ') : null,
      320,
    ),
    formatKeywordSummaryLine(
      'Messaging angles',
      messagingAngles.length > 0 ? messagingAngles.join(' || ') : null,
      320,
    ),
    formatKeywordSummaryLine(
      'Priority platforms',
      platformRecommendations.length > 0 ? platformRecommendations.join(' | ') : null,
      260,
    ),
  ]);
}

function summarizeKeywordCompetitorIntel(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const competitors = asRecordArray(payload.competitors)
    .slice(0, 3)
    .map((competitor) => {
      const name = asString(competitor.name);
      if (!name) {
        return null;
      }

      const weakness = asStringArray(competitor.weaknesses, 1)[0] ?? null;
      const advantage = asString(competitor.ourAdvantage);
      const parts = [
        name,
        weakness ? `weakness: ${weakness}` : null,
        advantage ? `our edge: ${advantage}` : null,
      ].filter((part): part is string => Boolean(part));

      return parts.join('; ');
    })
    .filter((competitor): competitor is string => Boolean(competitor));
  const whiteSpaceGaps = asRecordArray(payload.whiteSpaceGaps)
    .slice(0, 3)
    .map((gap) => asString(gap.gap) ?? asString(gap.recommendedAction))
    .filter((gap): gap is string => Boolean(gap));
  const overallLandscape = asString(payload.overallLandscape);

  return buildSnapshotSection('COMPETITOR INTEL SNAPSHOT:', [
    formatKeywordSummaryLine(
      'Competitors',
      competitors.length > 0 ? competitors.join(' || ') : null,
      320,
    ),
    formatKeywordSummaryLine(
      'White-space gaps',
      whiteSpaceGaps.length > 0 ? whiteSpaceGaps.join(' | ') : null,
      260,
    ),
    formatKeywordSummaryLine('Landscape', overallLandscape, 220),
  ]);
}

function summarizeKeywordMarketOverview(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const categorySnapshot = isRecord(payload.categorySnapshot)
    ? payload.categorySnapshot
    : null;
  const painPoints = isRecord(payload.painPoints) ? payload.painPoints : null;
  const marketDynamics = isRecord(payload.marketDynamics) ? payload.marketDynamics : null;
  const category = categorySnapshot ? asString(categorySnapshot.category) : null;
  const marketSize = categorySnapshot ? asString(categorySnapshot.marketSize) : null;
  const primaryPainPoints = painPoints ? asStringArray(painPoints.primary, 2) : [];
  const buyingTriggers = marketDynamics
    ? asStringArray(marketDynamics.buyingTriggers, 2)
    : [];

  return buildSnapshotSection('INDUSTRY RESEARCH SNAPSHOT:', [
    formatKeywordSummaryLine('Category', category, 220),
    formatKeywordSummaryLine('Market size', marketSize, 220),
    formatKeywordSummaryLine(
      'Pain points',
      primaryPainPoints.length > 0 ? primaryPainPoints.join(' | ') : null,
      260,
    ),
    formatKeywordSummaryLine(
      'Buying triggers',
      buyingTriggers.length > 0 ? buyingTriggers.join(' | ') : null,
      260,
    ),
  ]);
}

function summarizeKeywordIcpValidation(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const validatedPersona = asString(payload.validatedPersona);
  const channels = asStringArray(payload.channels, 3);
  const objections = asStringArray(payload.objections, 3);

  return buildSnapshotSection('ICP VALIDATION SNAPSHOT:', [
    formatKeywordSummaryLine('Persona', validatedPersona, 220),
    formatKeywordSummaryLine(
      'Priority channels',
      channels.length > 0 ? channels.join(' | ') : null,
      220,
    ),
    formatKeywordSummaryLine(
      'Core objections',
      objections.length > 0 ? objections.join(' | ') : null,
      320,
    ),
  ]);
}

function summarizeKeywordOfferAnalysis(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const pricingAnalysis = isRecord(payload.pricingAnalysis)
    ? payload.pricingAnalysis
    : null;
  const recommendation = isRecord(payload.recommendation) ? payload.recommendation : null;
  const pricingPosition = pricingAnalysis
    ? asString(pricingAnalysis.pricingPosition)
    : null;
  const recommendationSummary = recommendation
    ? asString(recommendation.summary)
    : null;
  const messagingRecommendations = asStringArray(payload.messagingRecommendations, 3);

  return buildSnapshotSection('OFFER ANALYSIS SNAPSHOT:', [
    formatKeywordSummaryLine('Pricing position', pricingPosition, 160),
    formatKeywordSummaryLine('Recommendation', recommendationSummary, 240),
    formatKeywordSummaryLine(
      'Messaging recommendations',
      messagingRecommendations.length > 0
        ? messagingRecommendations.join(' | ')
        : null,
      320,
    ),
  ]);
}

function buildKeywordProviderStatusBlock(
  providers: KeywordProviderStatus[],
): string {
  const lines = providers.map((provider) =>
    `- ${provider.label}: ${provider.available ? 'available' : `unavailable — ${provider.reason}`}`,
  );

  return ['KEYWORD PROVIDER STATUS:', ...lines].join('\n');
}

function extractKeywordCompetitorNames(context: string): string[] {
  const topCompetitorsMatch = context.match(/^- Top Competitors:\s*(.+)$/m);
  if (!topCompetitorsMatch?.[1]) {
    return [];
  }

  return dedupeStrings(
    topCompetitorsMatch[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function extractKeywordEntriesFromArtifact(
  parsed: unknown,
): Array<Record<string, unknown>> {
  if (!isRecord(parsed)) {
    return [];
  }

  const campaignGroups = asRecordArray(parsed.campaignGroups);

  return campaignGroups.flatMap((campaignGroup) =>
    asRecordArray(campaignGroup.adGroups).flatMap((adGroup) =>
      asRecordArray(adGroup.keywords),
    ),
  );
}

function isCompetitorKeyword(
  keyword: string,
  competitorNames: string[],
): boolean {
  const normalizedKeyword = keyword.toLowerCase();

  if (
    /\balternative\b|\balternatives\b|\bpricing\b|\bvs\b|\bversus\b|\bcompare\b|\bcomparison\b/i.test(
      normalizedKeyword,
    )
  ) {
    return true;
  }

  return competitorNames.some((name) =>
    normalizedKeyword.includes(name.toLowerCase()),
  );
}

function isKeywordArtifactThin(parsed: unknown, context: string): boolean {
  if (!isRecord(parsed)) {
    return false;
  }

  const keywordEntries = extractKeywordEntriesFromArtifact(parsed);
  const campaignGroups = asRecordArray(parsed.campaignGroups);
  const topOpportunities = asRecordArray(parsed.topOpportunities);
  const competitorNames = extractKeywordCompetitorNames(context);
  const competitorKeywordCount = keywordEntries.filter((entry) => {
    const keyword = asString(entry.keyword);
    return keyword ? isCompetitorKeyword(keyword, competitorNames) : false;
  }).length;
  const uniqueIntents = new Set(
    campaignGroups
      .map((campaignGroup) => asString(campaignGroup.intent))
      .filter((intent): intent is string => Boolean(intent)),
  );
  const requiresCompetitorCoverage = competitorNames.length > 0;
  const lacksCompetitorCoverage =
    requiresCompetitorCoverage && competitorKeywordCount < 1;

  return (
    keywordEntries.length < 4 ||
    campaignGroups.length < 2 ||
    uniqueIntents.size < 2 ||
    topOpportunities.length < 2 ||
    lacksCompetitorCoverage
  );
}

function buildKeywordRecoveryContext(input: {
  mode: Exclude<KeywordAttemptMode, 'primary'>;
  context: string;
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
}): KeywordRecoveryContextResult {
  const limits =
    input.mode === 'rescue'
      ? {
          businessLineCount: 6,
          businessChars: 900,
          analysisCount: 2,
          partialDraftChars: 900,
        }
      : input.mode === 'heuristic'
        ? {
            businessLineCount: 8,
            businessChars: 1_400,
            analysisCount: 3,
            partialDraftChars: 1_600,
          }
      : {
          businessLineCount: 8,
          businessChars: 1_200,
          analysisCount: 3,
          partialDraftChars: 1_800,
        };
  const businessSnapshot = buildKeywordBusinessSnapshot({
    context: input.context,
    maxLines: limits.businessLineCount,
    maxChars: limits.businessChars,
  });
  const sectionBlocks = extractKeywordSectionBlocks(input.context);
  const industryResearch = summarizeKeywordMarketOverview(
    parseKeywordSectionPayload(
      sectionBlocks['Industry Research'] ?? sectionBlocks['Market Overview'],
    ),
  );
  const icpValidation = summarizeKeywordIcpValidation(
    parseKeywordSectionPayload(sectionBlocks['ICP Validation']),
  );
  const offerAnalysis = summarizeKeywordOfferAnalysis(
    parseKeywordSectionPayload(sectionBlocks['Offer Analysis']),
  );
  const strategicSynthesis = summarizeKeywordStrategicSynthesis(
    parseKeywordSectionPayload(sectionBlocks['Strategic Synthesis']),
  );
  const competitorIntel = summarizeKeywordCompetitorIntel(
    parseKeywordSectionPayload(sectionBlocks['Competitor Intel']),
  );
  const sectionSummaries =
    input.mode === 'heuristic'
      ? [
          industryResearch,
          icpValidation,
          offerAnalysis,
          strategicSynthesis,
          competitorIntel,
        ].filter((summary): summary is string => Boolean(summary))
      : [strategicSynthesis, competitorIntel].filter(
          (summary): summary is string => Boolean(summary),
        );
  const providerStatusBlock =
    input.mode === 'heuristic'
      ? buildKeywordProviderStatusBlock(getKeywordProviderStatuses())
      : null;
  const analysisNotes = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) =>
          update.phase === 'analysis' &&
          update.message !== 'synthesizing keyword opportunities',
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
    ...sectionSummaries.flatMap((summary) => [summary, '']),
    providerStatusBlock,
    providerStatusBlock ? '' : null,
    'RULES:',
    '- Use only the evidence below.',
    '- Do not call tools.',
    '- If live keyword metrics are unavailable, use searchVolume: 0 and estimatedCpc: "Not verified".',
    '- Keep the artifact compact enough to fit in a single JSON response.',
    '',
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
      sectionSummaryCount: sectionSummaries.length,
      analysisCount: analysisNotes.length,
      partialDraftChars: partialDraft?.length ?? 0,
      totalChars: context.length,
    },
  };
}

function hasKeywordTopLevelFields(parsed: unknown): boolean {
  if (!isRecord(parsed)) {
    return false;
  }

  return [
    'totalKeywordsFound',
    'competitorGapCount',
    'campaignGroups',
    'topOpportunities',
    'recommendedStartingSet',
    'competitorGaps',
    'negativeKeywords',
    'confidenceNotes',
    'quickWins',
  ].every((key) => key in parsed);
}

function getKeywordAttemptConfig(mode: KeywordAttemptMode): KeywordAttemptConfig {
  if (mode === 'rescue') {
    return {
      mode,
      model: KEYWORDS_RESCUE_MODEL,
      maxTokens: KEYWORDS_RESCUE_MAX_TOKENS,
      timeoutMs: KEYWORDS_RESCUE_TIMEOUT_MS,
      tools: [],
      system: KEYWORDS_RESCUE_SYSTEM_PROMPT,
      synthesisMessage: 'synthesizing ultra-compact keyword rescue',
    };
  }

  if (mode === 'heuristic') {
    return {
      mode,
      model: KEYWORDS_HEURISTIC_MODEL,
      maxTokens: KEYWORDS_HEURISTIC_MAX_TOKENS,
      timeoutMs: KEYWORDS_HEURISTIC_TIMEOUT_MS,
      tools: [],
      system: KEYWORDS_HEURISTIC_SYSTEM_PROMPT,
      synthesisMessage: 'synthesizing heuristic keyword fallback',
    };
  }

  if (mode === 'repair') {
    return {
      mode,
      model: KEYWORDS_REPAIR_MODEL,
      maxTokens: KEYWORDS_REPAIR_MAX_TOKENS,
      timeoutMs: KEYWORDS_REPAIR_TIMEOUT_MS,
      tools: [],
      system: KEYWORDS_REPAIR_SYSTEM_PROMPT,
      synthesisMessage: 'repairing keyword artifact from compact evidence',
    };
  }

  return {
    mode,
    model: KEYWORDS_PRIMARY_MODEL,
    maxTokens: KEYWORDS_PRIMARY_MAX_TOKENS,
    timeoutMs: KEYWORDS_PRIMARY_TIMEOUT_MS,
    tools: [spyfuTool],
    system: KEYWORDS_PRIMARY_SYSTEM_PROMPT,
    synthesisMessage: 'synthesizing keyword opportunities',
  };
}

function isKeywordTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('request timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  );
}

function getKeywordTimeoutSource(error: unknown): KeywordTimeoutSource | null {
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

export function shouldRetryKeywordsWithRepair(input: {
  parseError: unknown;
  parsed?: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  if (input.telemetry.stopReason !== 'max_tokens') {
    return false;
  }

  if (input.parseError) {
    return true;
  }

  if (typeof input.parsed !== 'undefined') {
    return !hasKeywordTopLevelFields(input.parsed);
  }

  return false;
}

export function shouldRetryKeywordsWithRescue(input: {
  parseError: unknown;
  parsed?: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  if (input.telemetry.stopReason !== 'max_tokens') {
    return false;
  }

  if (input.parseError) {
    return true;
  }

  if (typeof input.parsed !== 'undefined') {
    return !hasKeywordTopLevelFields(input.parsed);
  }

  return false;
}

function getKeywordResultText(finalMsg: { content: BetaContentBlock[] }): string {
  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}

function areKeywordToolsEnabled(config: KeywordAttemptConfig): boolean {
  return config.tools.length > 0;
}

function buildKeywordAttemptLabel(config: KeywordAttemptConfig): string {
  return `attempt ${config.mode} (model: ${config.model}, tools: ${areKeywordToolsEnabled(config) ? 'enabled' : 'disabled'})`;
}

function buildKeywordRecoveryStatsMessage(
  mode: Exclude<KeywordAttemptMode, 'primary'>,
  stats: KeywordRecoveryContextStats,
): string {
  return `${mode} evidence package prepared (business lines: ${stats.businessLineCount}, section summaries: ${stats.sectionSummaryCount}, analysis notes: ${stats.analysisCount}, draft chars: ${stats.partialDraftChars}, total chars: ${stats.totalChars})`;
}

async function runKeywordToolAttempt(
  context: string,
  config: KeywordAttemptConfig,
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
        messages: [{ role: 'user', content: `Find keyword opportunities for:\n\n${context}` }],
      });
      return Promise.race([
        runStreamedToolRunner(runner, {
          onProgress,
          synthesisMessage: config.synthesisMessage,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Sub-agent timed out after ${config.timeoutMs / 1000}s`,
                ),
              ),
            config.timeoutMs,
          ),
        ),
      ]);
    },
    `researchKeywords:${config.mode}`,
  );

  return {
    resultText: getKeywordResultText(finalMsg),
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

async function runKeywordMessageAttempt(
  context: string,
  config: KeywordAttemptConfig,
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
          messages: [{ role: 'user', content: `Find keyword opportunities for:\n\n${context}` }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Sub-agent timed out after ${config.timeoutMs / 1000}s`,
                ),
              ),
            config.timeoutMs,
          ),
        ),
      ]),
    `researchKeywords:${config.mode}`,
  );

  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return {
    resultText: textBlock?.type === 'text' ? textBlock.text : '',
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

async function runKeywordAttemptWithObservability(
  context: string,
  config: KeywordAttemptConfig,
  onProgress: RunnerProgressReporter | undefined,
  deps: RunResearchKeywordsDeps,
): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const runAttempt =
    deps.runAttempt ??
    (areKeywordToolsEnabled(config)
      ? deps.runToolAttempt ?? runKeywordToolAttempt
      : deps.runMessageAttempt ?? runKeywordMessageAttempt);

  await emitRunnerProgress(
    onProgress,
    'runner',
    `${buildKeywordAttemptLabel(config)} started`,
  );

  try {
    const attemptResult = await runAttempt(context, config, onProgress);
    await emitRunnerProgress(
      onProgress,
      'runner',
      `${buildKeywordAttemptLabel(config)} completed (stop reason: ${attemptResult.telemetry.stopReason ?? 'unknown'})`,
    );
    return attemptResult;
  } catch (error) {
    const timeoutSource = getKeywordTimeoutSource(error);
    if (timeoutSource) {
      await emitRunnerProgress(
        onProgress,
        'runner',
        `${buildKeywordAttemptLabel(config)} timed out (source: ${timeoutSource})`,
      );
    }

    throw error;
  }
}

export async function runResearchKeywordsWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunResearchKeywordsDeps = {},
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
    await emitRunnerProgress(reportProgress, 'runner', 'preparing keyword research brief');
    const providerStatuses = getKeywordProviderStatuses();
    const spyfuProvider = providerStatuses.find(
      (provider) => provider.id === 'spyfu',
    );
    const canRunPrimaryAttempt =
      Boolean(spyfuProvider?.available) ||
      Boolean(deps.runToolAttempt) ||
      Boolean(deps.runAttempt);

    let resultText: string;
    let telemetry: ReturnType<typeof buildRunnerTelemetry>;
    let currentMode: KeywordAttemptMode;

    if (!canRunPrimaryAttempt) {
      currentMode = 'heuristic';
      await emitRunnerProgress(
        reportProgress,
        'runner',
        'live keyword providers unavailable — switching to heuristic fallback',
      );
      for (const provider of providerStatuses.filter((provider) => !provider.available)) {
        await emitRunnerProgress(
          reportProgress,
          'analysis',
          `keyword provider unavailable: ${provider.label}`,
        );
      }

      const heuristicContext = buildKeywordRecoveryContext({
        mode: 'heuristic',
        context,
        progressUpdates: capturedProgressUpdates,
      });
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildKeywordRecoveryStatsMessage('heuristic', heuristicContext.stats),
      );
      const attemptResult = await runKeywordAttemptWithObservability(
        heuristicContext.context,
        getKeywordAttemptConfig('heuristic'),
        reportProgress,
        deps,
      );
      resultText = attemptResult.resultText;
      telemetry = attemptResult.telemetry;
    } else {
      currentMode = 'primary';

      try {
        const attemptResult = await runKeywordAttemptWithObservability(
          context,
          getKeywordAttemptConfig('primary'),
          reportProgress,
          deps,
        );
        resultText = attemptResult.resultText;
        telemetry = attemptResult.telemetry;
      } catch (error) {
        if (!isKeywordTimeoutError(error)) {
          throw error;
        }

        currentMode = 'repair';
        const recoveryContext = buildKeywordRecoveryContext({
          mode: 'repair',
          context,
          progressUpdates: capturedProgressUpdates,
        });

        await emitRunnerProgress(
          reportProgress,
          'runner',
          'primary keyword research pass timed out — repairing artifact from compact evidence',
        );
        await emitRunnerProgress(
          reportProgress,
          'runner',
          buildKeywordRecoveryStatsMessage('repair', recoveryContext.stats),
        );
        const attemptResult = await runKeywordAttemptWithObservability(
          recoveryContext.context,
          getKeywordAttemptConfig('repair'),
          reportProgress,
          deps,
        );
        resultText = attemptResult.resultText;
        telemetry = attemptResult.telemetry;
      }
    }

    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = parseJson(resultText);
    } catch (error) {
      console.error('[keywords] JSON extraction failed:', resultText.slice(0, 300));
      parseError = error;
    }

    if (
      currentMode === 'primary' &&
      !parseError &&
      typeof parsed !== 'undefined' &&
      isKeywordArtifactThin(parsed, context)
    ) {
      currentMode = 'heuristic';
      const heuristicContext = buildKeywordRecoveryContext({
        mode: 'heuristic',
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'keyword research artifact was too thin to trust — switching to heuristic fallback',
      );
      for (const provider of providerStatuses.filter(
        (provider) => provider.id !== 'spyfu' && !provider.available,
      )) {
        await emitRunnerProgress(
          reportProgress,
          'analysis',
          `keyword provider unavailable: ${provider.label}`,
        );
      }
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildKeywordRecoveryStatsMessage('heuristic', heuristicContext.stats),
      );

      const heuristicAttempt = await runKeywordAttemptWithObservability(
        heuristicContext.context,
        getKeywordAttemptConfig('heuristic'),
        reportProgress,
        deps,
      );
      resultText = heuristicAttempt.resultText;
      telemetry = heuristicAttempt.telemetry;
      parsed = undefined;
      parseError = undefined;

      try {
        parsed = parseJson(resultText);
      } catch (error) {
        console.error('[keywords:heuristic] JSON extraction failed:', resultText.slice(0, 300));
        parseError = error;
      }
    }

    if (
      currentMode !== 'heuristic' &&
      shouldRetryKeywordsWithRepair({ parseError, parsed, telemetry })
    ) {
      currentMode = 'repair';
      const recoveryContext = buildKeywordRecoveryContext({
        mode: 'repair',
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'keyword research pass hit token limit — repairing artifact from compact evidence',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildKeywordRecoveryStatsMessage('repair', recoveryContext.stats),
      );
      const repairAttempt = await runKeywordAttemptWithObservability(
        recoveryContext.context,
        getKeywordAttemptConfig('repair'),
        reportProgress,
        deps,
      );
      resultText = repairAttempt.resultText;
      telemetry = repairAttempt.telemetry;
      parsed = undefined;
      parseError = undefined;

      try {
        parsed = parseJson(resultText);
      } catch (error) {
        console.error('[keywords:repair] JSON extraction failed:', resultText.slice(0, 300));
        parseError = error;
      }
    }

    if (shouldRetryKeywordsWithRescue({ parseError, parsed, telemetry })) {
      currentMode = 'rescue';
      const recoveryContext = buildKeywordRecoveryContext({
        mode: 'rescue',
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'keyword repair pass hit token limit — retrying with ultra-compact rescue',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildKeywordRecoveryStatsMessage('rescue', recoveryContext.stats),
      );
      const rescueAttempt = await runKeywordAttemptWithObservability(
        recoveryContext.context,
        getKeywordAttemptConfig('rescue'),
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
        console.error('[keywords:rescue] JSON extraction failed:', resultText.slice(0, 300));
        parseError = error;
      }
    }

    return finalizeRunnerResult({
      section: 'keywordIntel',
      durationMs: now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'keywordIntel',
      error: error instanceof Error ? error.message : String(error),
      durationMs: now() - startTime,
    };
  }
}

export async function runResearchKeywords(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  return runResearchKeywordsWithDeps(context, onProgress);
}
