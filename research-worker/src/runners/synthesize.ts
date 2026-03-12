import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  buildRunnerTelemetry,
  createClient,
  emitRunnerProgress,
  extractJson,
  runWithBackoff,
  type RunnerProgressReporter,
  type RunnerProgressUpdate,
} from '../runner';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';

const SYNTHESIS_PRIMARY_MODEL =
  process.env.RESEARCH_SYNTHESIS_MODEL ?? 'claude-sonnet-4-6';
const SYNTHESIS_REPAIR_MODEL =
  process.env.RESEARCH_SYNTHESIS_REPAIR_MODEL ?? 'claude-sonnet-4-6';
const SYNTHESIS_PRIMARY_MAX_TOKENS = 6000;
const SYNTHESIS_REPAIR_MAX_TOKENS = 3500;
const SYNTHESIS_PRIMARY_TIMEOUT_MS = 120_000;
const SYNTHESIS_REPAIR_TIMEOUT_MS = 75_000;

const PAID_ADS_SKILL = `
## Paid Media Domain Knowledge

### Creative Performance Patterns
- Hook quality determines 80% of ad performance — first 3 seconds on video, first line on static
- Pain-agitation-solution outperforms feature-benefit for B2B
- Social proof (customer logos, review counts) lifts CTR 15-25% on landing pages
- Specificity beats generality: "$47K saved" > "save money", "3x faster" > "saves time"

### Budget Allocation by Funnel Stage
- Awareness (cold traffic): 50-60% of budget
- Consideration (warm/retargeting): 25-30%
- Conversion (hot retargeting): 15-20%
`;

const SYNTHESIS_OUTPUT_FORMAT = `OUTPUT FORMAT:
Once you have finished the analysis, respond with a single JSON object. Structure:
{
  "keyInsights": [
    {
      "insight": "string — specific actionable insight",
      "source": "industryResearch | icpValidation | offerAnalysis | competitorIntel",
      "implication": "string — what this means for paid media strategy",
      "priority": "high | medium | low"
    }
  ],
  "positioningStrategy": {
    "recommendedAngle": "string — primary positioning hypothesis",
    "alternativeAngles": ["string — 2-3 alternatives to test"],
    "leadRecommendation": "string — why the recommended angle was chosen",
    "keyDifferentiator": "string — the single strongest differentiator to lead with"
  },
  "platformRecommendations": [
    {
      "platform": "string — platform name",
      "role": "primary | secondary | testing",
      "budgetAllocation": "string — percentage and dollar amount",
      "rationale": "string — why this platform for this audience",
      "priority": 1
    }
  ],
  "messagingAngles": [
    {
      "angle": "string — specific messaging angle",
      "targetEmotion": "string — emotional driver",
      "exampleHook": "string — example ad hook using this angle",
      "evidence": "string — research evidence supporting this angle"
    }
  ],
  "criticalSuccessFactors": ["string — 3-5 factors that will determine campaign success"],
  "nextSteps": ["string — 5-7 specific actions achievable in the next 2 weeks"],
  "planningContext": {
    "monthlyBudget": "string — current monthly budget if known",
    "targetCpl": "string — target CPL if known",
    "targetCac": "string — target CAC if known",
    "downstreamSequence": ["keywordIntel", "mediaPlan"]
  },
  "strategicNarrative": "string — 1-2 short paragraphs covering the complete paid media strategy",
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}`;

const SYNTHESIS_PRIMARY_SYSTEM_PROMPT = `You are synthesizing research into an actionable paid media strategy.

TASK: Create a strategic cross-analysis that connects all research insights into actionable strategy.

SYNTHESIS APPROACH:
1. Extract 4-5 key insights (at least one from each research section)
2. Develop a clear positioning strategy with 2 alternatives to test
3. Mine competitor data for positioning gold — at least ONE key insight must reference specific competitor weaknesses or review data
4. Identify the strongest messaging angles supported by the research

BUDGET ALLOCATION RULES:
When recommending platform allocation, follow these budget-tier rules:

- UNDER $2,000/month: Recommend 1 PRIMARY platform only (70-80% of budget). Allocate remaining 20-30% to ONE secondary platform for retargeting only. Do NOT split across 3+ platforms. State explicitly: "At this budget level, concentrate spend for faster learning."

- $2,000-$5,000/month: Recommend 1 primary (50-60%) + 1 secondary (25-30%) + 1 testing (10-20%). Only recommend 3 platforms if each gets minimum $500/month.

- $5,000-$15,000/month: Full multi-platform testing viable. Recommend allocation based on audience concentration and intent signals.

- OVER $15,000/month: Recommend aggressive multi-platform strategy with dedicated budgets per funnel stage.

MINIMUM VIABLE SPEND PER PLATFORM:
- LinkedIn Ads: $500/month minimum for B2B
- Google Search: $500/month minimum for competitive terms
- Meta Ads: $300/month minimum for retargeting, $1,000+ for prospecting

If the client's total budget does not support minimum viable spend on a platform, do NOT recommend that platform.

KEY INSIGHTS REQUIREMENTS:
- At least one insight from industry research
- At least one insight from ICP validation
- At least one insight from offer analysis
- At least one insight from competitor research
- Each insight must be actionable for paid media

POSITIONING STRATEGY:
- Identify the strongest differentiation angle from the research
- Provide 2-3 alternative positioning hypotheses to test
- Recommend which to lead with and why

MESSAGING ANGLES:
- Map at least 2 messaging angles explicitly as objection -> counter-angle -> supporting proof
- Use real buyer-language objections from ICP validation when they exist
- The exampleHook must directly answer the objection, not restate the positioning line
- The evidence field must name both the objection and the proof signal
- Keep each angle to 1 sentence plus 1 short proof line

PLATFORM RECOMMENDATIONS:
- Match platform to where the ICP actually spends time
- Calculate and show per-platform dollar amounts (not just percentages)
- Explain why each recommended platform fits this audience

COMPRESSION RULES:
- criticalSuccessFactors: 3-4 items max
- nextSteps: 4 items max
- strategicNarrative: 1-2 short paragraphs
- citations: max 4 items, only when they change decision quality
- Omit charts entirely in this speed-preserving pass

${SYNTHESIS_OUTPUT_FORMAT}`;

const SYNTHESIS_REPAIR_SYSTEM_PROMPT = `You are synthesizing research into an actionable paid media strategy from compact evidence only.

TASK: Repair and finish the strategic synthesis artifact using the evidence package in the user message.

RULES:
- Do not call tools
- Use only the business snapshot, section snapshots, and analysis notes provided
- Keep the final JSON compact and decision-useful
- Omit charts entirely
- Use citations only if they are explicitly present in the evidence package
- Map at least 2 messaging angles explicitly as objection -> counter-angle -> supporting proof
- The evidence field for those angles must name the objection and the proof signal
- Start the response with { and end it with }

${SYNTHESIS_OUTPUT_FORMAT}`;

type SynthesisAttemptMode = 'primary' | 'repair';
type SynthesisTimeoutSource = 'worker_timeout' | 'request_timeout' | 'network_timeout';

interface SynthesisAttemptConfig {
  mode: SynthesisAttemptMode;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools: Array<{ name: string }>;
  system: string;
  synthesisMessage: string;
}

interface RunSynthesizeResearchDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
  runAttempt?: (
    context: string,
    config: SynthesisAttemptConfig,
    onProgress?: RunnerProgressReporter,
    ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
  runMessageAttempt?: (
    context: string,
    config: SynthesisAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<{
    resultText: string;
    telemetry: ReturnType<typeof buildRunnerTelemetry>;
  }>;
}

interface SynthesisRecoveryContextStats {
  businessLineCount: number;
  sectionSummaryCount: number;
  citationCount: number;
  analysisCount: number;
  partialDraftChars: number;
  totalChars: number;
}

interface SynthesisRecoveryContextResult {
  context: string;
  stats: SynthesisRecoveryContextStats;
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

function buildSynthesisBusinessSnapshot(input: {
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

function extractSynthesisSectionBlocks(context: string): Record<string, string> {
  const matches = [...context.matchAll(/^## (.+)$/gm)];
  const blocks: Record<string, string> = {};

  for (const [index, match] of matches.entries()) {
    const sectionName = match[1]?.trim();
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex =
      index + 1 < matches.length ? (matches[index + 1]?.index ?? context.length) : context.length;
    const block = context.slice(startIndex, endIndex).trim();

    if (sectionName && block.length > 0) {
      blocks[sectionName] = block;
    }
  }

  return blocks;
}

function parseSynthesisSectionPayload(rawBlock: string | undefined): unknown | null {
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

function buildTruncatedSummaryLine(
  label: string,
  value: string | null,
  maxChars: number,
): string | null {
  if (!value) {
    return null;
  }

  return `- ${label}: ${truncateRecoveryText(value, maxChars)}`;
}

function summarizeMarketOverview(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const categorySnapshot = isRecord(payload.categorySnapshot)
    ? payload.categorySnapshot
    : null;
  const painPoints = isRecord(payload.painPoints) ? payload.painPoints : null;
  const marketDynamics = isRecord(payload.marketDynamics) ? payload.marketDynamics : null;
  const trendSignals = asRecordArray(payload.trendSignals).slice(0, 2);
  const category = categorySnapshot ? asString(categorySnapshot.category) : null;
  const buyingBehavior = categorySnapshot
    ? asString(categorySnapshot.buyingBehavior)
    : null;
  const primaryPainPoints = painPoints ? asStringArray(painPoints.primary, 3) : [];
  const demandDrivers = marketDynamics
    ? asStringArray(marketDynamics.demandDrivers, 2)
    : [];
  const trends = trendSignals
    .map((trend) => {
      const name = asString(trend.trend);
      const evidence = asString(trend.evidence);

      if (!name) {
        return null;
      }

      return evidence ? `${name}: ${evidence}` : name;
    })
    .filter((trend): trend is string => Boolean(trend));

  return buildSnapshotSection('MARKET OVERVIEW SNAPSHOT:', [
    buildTruncatedSummaryLine('Category', category, 180),
    buildTruncatedSummaryLine('Buying behavior', buyingBehavior, 140),
    buildTruncatedSummaryLine(
      'Primary pain points',
      primaryPainPoints.length > 0 ? primaryPainPoints.join(' | ') : null,
      240,
    ),
    buildTruncatedSummaryLine(
      'Demand drivers',
      demandDrivers.length > 0 ? demandDrivers.join(' | ') : null,
      220,
    ),
    buildTruncatedSummaryLine(
      'Trend signals',
      trends.length > 0 ? trends.join(' || ') : null,
      240,
    ),
  ]);
}

function summarizeCompetitorIntel(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const competitors = asRecordArray(payload.competitors).slice(0, 3);
  const competitorLines = competitors
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
    .filter((line): line is string => Boolean(line));
  const gaps = asRecordArray(payload.whiteSpaceGaps)
    .slice(0, 2)
    .map((gap) => asString(gap.gap) ?? asString(gap.recommendedAction))
    .filter((gap): gap is string => Boolean(gap));
  const landscape = asString(payload.overallLandscape);

  return buildSnapshotSection('COMPETITOR INTEL SNAPSHOT:', [
    buildTruncatedSummaryLine(
      'Competitors',
      competitorLines.length > 0 ? competitorLines.join(' || ') : null,
      260,
    ),
    buildTruncatedSummaryLine(
      'White-space gaps',
      gaps.length > 0 ? gaps.join(' | ') : null,
      220,
    ),
    buildTruncatedSummaryLine('Landscape', landscape, 180),
  ]);
}

function summarizeIcpValidation(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const validatedPersona = asString(payload.validatedPersona);
  const channels = asStringArray(payload.channels, 3);
  const objections = asStringArray(payload.objections, 3);
  const decisionFactors = asRecordArray(payload.decisionFactors)
    .slice(0, 3)
    .map((factor) => asString(factor.factor))
    .filter((factor): factor is string => Boolean(factor));
  const finalVerdict = isRecord(payload.finalVerdict) ? payload.finalVerdict : null;
  const verdictStatus = finalVerdict ? asString(finalVerdict.status) : null;
  const verdictReasoning = finalVerdict ? asString(finalVerdict.reasoning) : null;

  return buildSnapshotSection('ICP VALIDATION SNAPSHOT:', [
    buildTruncatedSummaryLine('Persona', validatedPersona, 200),
    buildTruncatedSummaryLine(
      'Priority channels',
      channels.length > 0 ? channels.join(' | ') : null,
      180,
    ),
    buildTruncatedSummaryLine(
      'Core objections',
      objections.length > 0 ? objections.join(' | ') : null,
      260,
    ),
    buildTruncatedSummaryLine(
      'Decision factors',
      decisionFactors.length > 0 ? decisionFactors.join(' | ') : null,
      220,
    ),
    buildTruncatedSummaryLine(
      'Verdict',
      verdictStatus
        ? `${verdictStatus}${verdictReasoning ? ` — ${verdictReasoning}` : ''}`
        : null,
      220,
    ),
  ]);
}

function summarizeOfferAnalysis(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const recommendation = isRecord(payload.recommendation) ? payload.recommendation : null;
  const pricingAnalysis = isRecord(payload.pricingAnalysis) ? payload.pricingAnalysis : null;
  const recommendationStatus = recommendation ? asString(recommendation.status) : null;
  const recommendationSummary = recommendation ? asString(recommendation.summary) : null;
  const priorityFixes = recommendation
    ? asStringArray(recommendation.priorityFixes, 3)
    : [];
  const messagingRecommendations = asStringArray(payload.messagingRecommendations, 3);
  const pricingPosition = pricingAnalysis ? asString(pricingAnalysis.pricingPosition) : null;
  const marketFitAssessment = asString(payload.marketFitAssessment);

  return buildSnapshotSection('OFFER ANALYSIS SNAPSHOT:', [
    buildTruncatedSummaryLine(
      'Recommendation',
      recommendationStatus
        ? `${recommendationStatus}${recommendationSummary ? ` — ${recommendationSummary}` : ''}`
        : null,
      240,
    ),
    buildTruncatedSummaryLine('Pricing position', pricingPosition, 140),
    buildTruncatedSummaryLine(
      'Priority fixes',
      priorityFixes.length > 0 ? priorityFixes.join(' | ') : null,
      220,
    ),
    buildTruncatedSummaryLine(
      'Messaging recommendations',
      messagingRecommendations.length > 0 ? messagingRecommendations.join(' | ') : null,
      240,
    ),
    buildTruncatedSummaryLine('Market fit', marketFitAssessment, 220),
  ]);
}

function collectSectionCitations(payload: unknown): string[] {
  if (!isRecord(payload)) {
    return [];
  }

  const rawCitations = Array.isArray(payload.citations)
    ? payload.citations
    : Array.isArray(payload.sources)
      ? payload.sources
      : [];

  return rawCitations
    .map((citation) => {
      if (typeof citation === 'string') {
        return asString(citation);
      }

      if (!isRecord(citation)) {
        return null;
      }

      const title = asString(citation.title);
      const url = asString(citation.url);

      if (title && url) {
        return `${title} (${url})`;
      }

      return url ?? title;
    })
    .filter((citation): citation is string => Boolean(citation));
}

function buildSynthesisRecoveryContext(input: {
  context: string;
  partialDraft?: string;
  progressUpdates: RunnerProgressUpdate[];
}): SynthesisRecoveryContextResult {
  const businessSnapshot = buildSynthesisBusinessSnapshot({
    context: input.context,
    maxLines: 8,
    maxChars: 1_800,
  });
  const sectionBlocks = extractSynthesisSectionBlocks(input.context);
  const marketOverview = summarizeMarketOverview(
    parseSynthesisSectionPayload(sectionBlocks['Market Overview']),
  );
  const competitorIntel = summarizeCompetitorIntel(
    parseSynthesisSectionPayload(sectionBlocks['Competitor Intel']),
  );
  const icpValidation = summarizeIcpValidation(
    parseSynthesisSectionPayload(sectionBlocks['ICP Validation']),
  );
  const offerAnalysis = summarizeOfferAnalysis(
    parseSynthesisSectionPayload(sectionBlocks['Offer Analysis']),
  );
  const sectionSummaries = [
    marketOverview,
    competitorIntel,
    icpValidation,
    offerAnalysis,
  ].filter((summary): summary is string => Boolean(summary));
  const citations = dedupeStrings(
    [
      ...collectSectionCitations(parseSynthesisSectionPayload(sectionBlocks['Market Overview'])),
      ...collectSectionCitations(parseSynthesisSectionPayload(sectionBlocks['Competitor Intel'])),
      ...collectSectionCitations(parseSynthesisSectionPayload(sectionBlocks['ICP Validation'])),
      ...collectSectionCitations(parseSynthesisSectionPayload(sectionBlocks['Offer Analysis'])),
    ],
  ).slice(0, 4);
  const analysisNotes = dedupeStrings(
    input.progressUpdates
      .filter(
        (update) =>
          update.phase === 'analysis' &&
          update.message !== 'synthesizing strategic narrative' &&
          (update.message.startsWith('draft ') || update.message.includes('objection')),
      )
      .map((update) => update.message),
  ).slice(0, 4);
  const partialDraft =
    typeof input.partialDraft === 'string' && input.partialDraft.trim().length > 0
      ? input.partialDraft.trim().slice(0, 2_500)
      : null;
  const context = [
    'PRIMARY PASS EVIDENCE PACKAGE:',
    businessSnapshot,
    '',
    ...sectionSummaries.flatMap((summary) => [summary, '']),
    'RULES:',
    '- Use only the evidence below.',
    '- Do not call tools or generate charts.',
    '- Omit charts instead of blocking the artifact.',
    '- Keep the strategy specific enough to unblock downstream keyword planning.',
    '',
    citations.length > 0 ? `CAPTURED CITATIONS:\n- ${citations.join('\n- ')}` : null,
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
      citationCount: citations.length,
      analysisCount: analysisNotes.length,
      partialDraftChars: partialDraft?.length ?? 0,
      totalChars: context.length,
    },
  };
}

function getSynthesisAttemptConfig(mode: SynthesisAttemptMode): SynthesisAttemptConfig {
  if (mode === 'repair') {
    return {
      mode,
      model: SYNTHESIS_REPAIR_MODEL,
      maxTokens: SYNTHESIS_REPAIR_MAX_TOKENS,
      timeoutMs: SYNTHESIS_REPAIR_TIMEOUT_MS,
      tools: [],
      system: SYNTHESIS_REPAIR_SYSTEM_PROMPT,
      synthesisMessage: 'repairing strategic synthesis without charts',
    };
  }

    return {
      mode,
      model: SYNTHESIS_PRIMARY_MODEL,
      maxTokens: SYNTHESIS_PRIMARY_MAX_TOKENS,
      timeoutMs: SYNTHESIS_PRIMARY_TIMEOUT_MS,
      tools: [],
      system: `${PAID_ADS_SKILL}\n\n---\n\n${SYNTHESIS_PRIMARY_SYSTEM_PROMPT}`,
      synthesisMessage: 'synthesizing strategic narrative',
    };
}

function getSynthesisResultText(finalMsg: { content: BetaContentBlock[] }): string {
  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : '';
}

function areSynthesisToolsEnabled(config: SynthesisAttemptConfig): boolean {
  return config.tools.length > 0;
}

function buildSynthesisAttemptLabel(config: SynthesisAttemptConfig): string {
  return `attempt ${config.mode} (model: ${config.model}, tools: ${areSynthesisToolsEnabled(config) ? 'enabled' : 'disabled'})`;
}

function buildSynthesisRecoveryStatsMessage(
  stats: SynthesisRecoveryContextStats,
): string {
  return `repair evidence package prepared (business lines: ${stats.businessLineCount}, section summaries: ${stats.sectionSummaryCount}, citations: ${stats.citationCount}, analysis notes: ${stats.analysisCount}, draft chars: ${stats.partialDraftChars}, total chars: ${stats.totalChars})`;
}

function extractSynthesisObjections(context: string): string[] {
  const sectionBlocks = extractSynthesisSectionBlocks(context);
  const icpValidation = parseSynthesisSectionPayload(sectionBlocks['ICP Validation']);

  if (!isRecord(icpValidation)) {
    return [];
  }

  return asStringArray(icpValidation.objections, 3);
}

function shouldRetrySynthesisForObjectionCarryThrough(
  parsed: unknown,
  context: string,
): boolean {
  if (!isRecord(parsed)) {
    return false;
  }

  const objections = extractSynthesisObjections(context);
  if (objections.length === 0) {
    return false;
  }

  const messagingAngles = asRecordArray(parsed.messagingAngles);
  const requiredMappedAngles = Math.min(2, objections.length);
  if (messagingAngles.length < requiredMappedAngles) {
    return true;
  }

  const objectionTokens = objections.map((objection) =>
    objection
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 4),
  );
  const objectionMappedAngles = messagingAngles.filter((angle) => {
    const angleName = asString(angle.angle);
    const evidence = asString(angle.evidence);
    const exampleHook = asString(angle.exampleHook);
    if (!evidence || !exampleHook) {
      return false;
    }

    if (/objection:/i.test(evidence) && /proof:/i.test(evidence)) {
      return true;
    }

    const combinedText = [angleName, evidence, exampleHook]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return objectionTokens.some((tokens) => {
      const overlapCount = tokens.filter((token) => combinedText.includes(token)).length;
      return overlapCount >= Math.min(2, tokens.length);
    });
  });

  return objectionMappedAngles.length < requiredMappedAngles;
}

function isSynthesisTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('request timed out') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  );
}

function getSynthesisTimeoutSource(error: unknown): SynthesisTimeoutSource | null {
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

function shouldRetrySynthesisWithRepair(input: {
  parseError: unknown;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}): boolean {
  if (!input.parseError) {
    return false;
  }

  return input.telemetry.stopReason === 'max_tokens';
}

async function runSynthesisMessageAttempt(
  context: string,
  config: SynthesisAttemptConfig,
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
          messages: [
            {
              role: 'user',
              content: `Synthesize all research into a cross-analysis strategic summary:\n\n${context}`,
            },
          ],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Sub-agent timed out after ${config.timeoutMs / 1000}s`)),
            config.timeoutMs,
          ),
        ),
      ]),
    `synthesizeResearch:${config.mode}`,
  );

  const textBlock = finalMsg.content.findLast((block) => block.type === 'text');
  return {
    resultText: textBlock?.type === 'text' ? textBlock.text : '',
    telemetry: buildRunnerTelemetry(finalMsg),
  };
}

async function runSynthesisAttemptWithObservability(
  context: string,
  config: SynthesisAttemptConfig,
  onProgress: RunnerProgressReporter | undefined,
  deps: RunSynthesizeResearchDeps,
): Promise<{
  resultText: string;
  telemetry: ReturnType<typeof buildRunnerTelemetry>;
}> {
  const runAttempt =
    deps.runAttempt ?? deps.runMessageAttempt ?? runSynthesisMessageAttempt;

  await emitRunnerProgress(
    onProgress,
    'runner',
    `${buildSynthesisAttemptLabel(config)} started`,
  );

  try {
    const attemptResult = await runAttempt(context, config, onProgress);
    await emitRunnerProgress(
      onProgress,
      'runner',
      `${buildSynthesisAttemptLabel(config)} completed (stop reason: ${attemptResult.telemetry.stopReason ?? 'unknown'})`,
    );
    return attemptResult;
  } catch (error) {
    const timeoutSource = getSynthesisTimeoutSource(error);
    if (timeoutSource) {
      await emitRunnerProgress(
        onProgress,
        'runner',
        `${buildSynthesisAttemptLabel(config)} timed out (source: ${timeoutSource})`,
      );
    }

    throw error;
  }
}

export async function runSynthesizeResearchWithDeps(
  context: string,
  onProgress?: RunnerProgressReporter,
  deps: RunSynthesizeResearchDeps = {},
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
    await emitRunnerProgress(reportProgress, 'runner', 'preparing strategic synthesis brief');

    let resultText: string;
    let telemetry: ReturnType<typeof buildRunnerTelemetry>;
    let currentMode: SynthesisAttemptMode = 'primary';
    try {
      const attemptResult = await runSynthesisAttemptWithObservability(
        context,
        getSynthesisAttemptConfig('primary'),
        reportProgress,
        deps,
      );
      resultText = attemptResult.resultText;
      telemetry = attemptResult.telemetry;
    } catch (error) {
        if (!isSynthesisTimeoutError(error)) {
          throw error;
        }

        currentMode = 'repair';
        const recoveryContext = buildSynthesisRecoveryContext({
          context,
          progressUpdates: capturedProgressUpdates,
        });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'primary strategic synthesis pass timed out — repairing artifact without charts',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildSynthesisRecoveryStatsMessage(recoveryContext.stats),
      );
      const attemptResult = await runSynthesisAttemptWithObservability(
        recoveryContext.context,
        getSynthesisAttemptConfig('repair'),
        reportProgress,
        deps,
      );
      resultText = attemptResult.resultText;
      telemetry = attemptResult.telemetry;
    }

    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = parseJson(resultText);
    } catch (error) {
      parseError = error;
    }

    if (
      currentMode === 'primary' &&
      !parseError &&
      typeof parsed !== 'undefined' &&
      shouldRetrySynthesisForObjectionCarryThrough(parsed, context)
    ) {
      currentMode = 'repair';
      const recoveryContext = buildSynthesisRecoveryContext({
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'strategic synthesis messaging angles missed objection carry-through — repairing artifact without charts',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildSynthesisRecoveryStatsMessage(recoveryContext.stats),
      );
      const repairAttempt = await runSynthesisAttemptWithObservability(
        recoveryContext.context,
        getSynthesisAttemptConfig('repair'),
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
        parseError = error;
      }
    }

    if (shouldRetrySynthesisWithRepair({ parseError, telemetry })) {
      currentMode = 'repair';
      const recoveryContext = buildSynthesisRecoveryContext({
        context,
        partialDraft: resultText,
        progressUpdates: capturedProgressUpdates,
      });

      await emitRunnerProgress(
        reportProgress,
        'runner',
        'strategic synthesis pass hit token limit — repairing artifact without charts',
      );
      await emitRunnerProgress(
        reportProgress,
        'runner',
        buildSynthesisRecoveryStatsMessage(recoveryContext.stats),
      );
      const repairAttempt = await runSynthesisAttemptWithObservability(
        recoveryContext.context,
        getSynthesisAttemptConfig('repair'),
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
        parseError = error;
      }
    }

    return finalizeRunnerResult({
      section: 'strategicSynthesis',
      durationMs: now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'strategicSynthesis',
      error: error instanceof Error ? error.message : String(error),
      durationMs: now() - startTime,
    };
  }
}

export async function runSynthesizeResearch(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  return runSynthesizeResearchWithDeps(context, onProgress);
}
