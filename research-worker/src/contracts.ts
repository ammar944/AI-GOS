import { z } from 'zod';
import { normalizeResearchSection } from './section-map';
import type { ResearchResult } from './supabase';
import type { RunnerChartTelemetry, RunnerTelemetry } from './telemetry';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).min(1);
const TREND_DIRECTION_ALIASES = new Map<
  string,
  'rising' | 'stable' | 'declining'
>([
  ['rising', 'rising'],
  ['rise', 'rising'],
  ['up', 'rising'],
  ['upward', 'rising'],
  ['growing', 'rising'],
  ['increasing', 'rising'],
  ['stable', 'stable'],
  ['steady', 'stable'],
  ['flat', 'stable'],
  ['neutral', 'stable'],
  ['declining', 'declining'],
  ['decline', 'declining'],
  ['down', 'declining'],
  ['downward', 'declining'],
  ['falling', 'declining'],
  ['decreasing', 'declining'],
]);

const industryResearchDataSchema = z.object({
  categorySnapshot: z.object({
    category: nonEmptyStringSchema,
    marketSize: nonEmptyStringSchema.optional(),
    marketMaturity: z.enum(['early', 'growing', 'saturated']).optional(),
    buyingBehavior: z
      .enum(['impulsive', 'committee_driven', 'roi_based', 'mixed'])
      .optional(),
    awarenessLevel: z.enum(['low', 'medium', 'high']).optional(),
    averageSalesCycle: nonEmptyStringSchema.optional(),
  }),
  painPoints: z.object({
    primary: nonEmptyStringArraySchema,
    secondary: z.array(z.string()).optional(),
    triggers: z.array(z.string()).optional(),
  }),
  marketDynamics: z.object({
    demandDrivers: nonEmptyStringArraySchema,
    buyingTriggers: nonEmptyStringArraySchema,
    barriersToPurchase: nonEmptyStringArraySchema,
  }),
  trendSignals: z
    .array(
      z.object({
        trend: nonEmptyStringSchema,
        direction: z.enum(['rising', 'stable', 'declining']),
        evidence: nonEmptyStringSchema,
      }),
    )
    .optional(),
  messagingOpportunities: z.object({
    angles: z.array(z.string()).optional(),
    summaryRecommendations: nonEmptyStringArraySchema,
  }),
});

const threatAssessmentSchema = z.object({
  threatFactors: z.object({
    marketShareRecognition: z.number().min(1).max(10),
    adSpendIntensity: z.number().min(1).max(10),
    productOverlap: z.number().min(1).max(10),
    priceCompetitiveness: z.number().min(1).max(10),
    growthTrajectory: z.number().min(1).max(10),
  }),
  topAdHooks: z.array(z.string()).optional(),
  likelyResponse: nonEmptyStringSchema.optional(),
  counterPositioning: nonEmptyStringSchema.optional(),
});

const competitorIntelDataSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: nonEmptyStringSchema,
        website: nonEmptyStringSchema,
        positioning: nonEmptyStringSchema,
        price: nonEmptyStringSchema.optional(),
        pricingConfidence: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
        strengths: nonEmptyStringArraySchema,
        weaknesses: nonEmptyStringArraySchema,
        opportunities: nonEmptyStringArraySchema,
        ourAdvantage: nonEmptyStringSchema,
        adActivity: z.object({
          activeAdCount: z.number().int().nonnegative(),
          platforms: nonEmptyStringArraySchema,
          themes: nonEmptyStringArraySchema,
          evidence: nonEmptyStringSchema,
          sourceConfidence: z.enum(['high', 'medium', 'low']),
        }),
        threatAssessment: threatAssessmentSchema.optional(),
      }),
    )
    .min(1),
  marketPatterns: z.array(z.string()).optional(),
  marketStrengths: z.array(z.string()).optional(),
  marketWeaknesses: z.array(z.string()).optional(),
  whiteSpaceGaps: z
    .array(
      z.object({
        gap: nonEmptyStringSchema,
        type: z.enum(['messaging', 'feature', 'audience', 'channel']),
        evidence: nonEmptyStringSchema,
        exploitability: z.number().min(1).max(10),
        impact: z.number().min(1).max(10),
        recommendedAction: nonEmptyStringSchema,
      }),
    )
    .min(1),
  overallLandscape: nonEmptyStringSchema.optional(),
});

const icpValidationDataSchema = z.object({
  validatedPersona: nonEmptyStringSchema,
  demographics: nonEmptyStringSchema,
  channels: nonEmptyStringArraySchema,
  triggers: nonEmptyStringArraySchema,
  objections: nonEmptyStringArraySchema,
  decisionFactors: z
    .array(
      z.object({
        factor: nonEmptyStringSchema,
        relevance: z.number().min(0).max(100),
      }),
    )
    .min(1),
  audienceSize: nonEmptyStringSchema,
  confidenceScore: z.number().min(0).max(100),
  decisionProcess: nonEmptyStringSchema,
  finalVerdict: z
    .object({
      status: z.enum(['validated', 'workable', 'invalid']),
      reasoning: nonEmptyStringSchema,
      recommendations: z.array(z.string()).optional(),
    })
    .optional(),
});

const offerAnalysisDataSchema = z.object({
  offerStrength: z.object({
    painRelevance: z.number().min(1).max(10),
    urgency: z.number().min(1).max(10),
    differentiation: z.number().min(1).max(10),
    tangibility: z.number().min(1).max(10),
    proof: z.number().min(1).max(10),
    pricingLogic: z.number().min(1).max(10),
    overallScore: z.number().min(1).max(10),
  }),
  recommendation: z.object({
    status: z.enum([
      'proceed',
      'needs-work',
      'adjust-messaging',
      'adjust-pricing',
      'icp-refinement-needed',
      'major-offer-rebuild',
      'do-not-launch',
    ]),
    summary: nonEmptyStringSchema,
    topStrengths: nonEmptyStringArraySchema,
    priorityFixes: nonEmptyStringArraySchema,
    recommendedActionPlan: nonEmptyStringArraySchema,
  }),
  redFlags: z
    .array(
      z.object({
        issue: nonEmptyStringSchema,
        severity: z.enum(['high', 'medium', 'low']),
        priority: z.number().int().positive(),
        recommendedAction: nonEmptyStringSchema,
        launchBlocker: z.boolean(),
        evidence: nonEmptyStringSchema.optional(),
      }),
    )
    .min(1),
  pricingAnalysis: z.object({
    currentPricing: nonEmptyStringSchema,
    marketBenchmark: nonEmptyStringSchema,
    pricingPosition: z.enum(['premium', 'mid-market', 'budget', 'unclear']),
    coldTrafficViability: nonEmptyStringSchema,
  }),
  marketFitAssessment: nonEmptyStringSchema,
  messagingRecommendations: nonEmptyStringArraySchema,
});

const strategicSynthesisDataSchema = z.object({
  keyInsights: z
    .array(
      z.object({
        insight: nonEmptyStringSchema,
        source: z
          .enum([
            'industryResearch',
            'competitorIntel',
            'icpValidation',
            'offerAnalysis',
          ])
          .optional(),
        implication: nonEmptyStringSchema,
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1),
  positioningStrategy: z.object({
    recommendedAngle: nonEmptyStringSchema,
    alternativeAngles: nonEmptyStringArraySchema,
    leadRecommendation: nonEmptyStringSchema,
    keyDifferentiator: nonEmptyStringSchema,
  }),
  platformRecommendations: z
    .array(
      z.object({
        platform: nonEmptyStringSchema,
        role: z.enum(['primary', 'secondary', 'testing', 'retargeting']),
        budgetAllocation: nonEmptyStringSchema,
        rationale: nonEmptyStringSchema,
        priority: z.number().int().positive(),
      }),
    )
    .min(1),
  messagingAngles: z
    .array(
      z.object({
        angle: nonEmptyStringSchema,
        targetEmotion: nonEmptyStringSchema,
        exampleHook: nonEmptyStringSchema,
        evidence: nonEmptyStringSchema,
      }),
    )
    .min(1),
  planningContext: z.object({
    monthlyBudget: nonEmptyStringSchema.optional(),
    targetCpl: nonEmptyStringSchema.optional(),
    targetCac: nonEmptyStringSchema.optional(),
    downstreamSequence: z.array(z.enum(['keywordIntel', 'mediaPlan'])).min(1),
  }),
  criticalSuccessFactors: nonEmptyStringArraySchema,
  nextSteps: nonEmptyStringArraySchema,
  strategicNarrative: nonEmptyStringSchema,
  charts: z
    .array(
      z.object({
        chartType: z.enum(['pie', 'radar', 'bar', 'funnel', 'word_cloud']),
        title: nonEmptyStringSchema,
        imageUrl: nonEmptyStringSchema,
        description: nonEmptyStringSchema,
      }),
    )
    .optional(),
});

const keywordOpportunitySchema = z.object({
  keyword: nonEmptyStringSchema,
  searchVolume: z.number().nonnegative(),
  estimatedCpc: nonEmptyStringSchema,
  difficulty: z.enum(['low', 'medium', 'high']),
  priorityScore: z.number().int().min(0).max(100),
  confidence: z.enum(['high', 'medium', 'low']),
});

const keywordIntelDataSchema = z.object({
  totalKeywordsFound: z.number().int().nonnegative(),
  competitorGapCount: z.number().int().nonnegative(),
  campaignGroups: z
    .array(
      z.object({
        campaign: nonEmptyStringSchema,
        intent: nonEmptyStringSchema,
        recommendedMonthlyBudget: z.number().nonnegative(),
        adGroups: z
          .array(
            z.object({
              name: nonEmptyStringSchema,
              recommendedMatchTypes: nonEmptyStringArraySchema,
              keywords: z.array(keywordOpportunitySchema).min(1),
              negativeKeywords: z.array(z.string()),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  topOpportunities: z.array(keywordOpportunitySchema).min(1),
  recommendedStartingSet: z
    .array(
      z.object({
        keyword: nonEmptyStringSchema,
        campaign: nonEmptyStringSchema,
        adGroup: nonEmptyStringSchema,
        recommendedMonthlyBudget: z.number().nonnegative(),
        reason: nonEmptyStringSchema,
        priorityScore: z.number().int().min(0).max(100),
      }),
    )
    .min(1),
  competitorGaps: z
    .array(
      z.object({
        keyword: nonEmptyStringSchema,
        competitorName: nonEmptyStringSchema,
        searchVolume: z.number().nonnegative(),
        estimatedCpc: nonEmptyStringSchema,
        priorityScore: z.number().int().min(0).max(100),
      }),
    ),
  negativeKeywords: z.array(
    z.object({
      keyword: nonEmptyStringSchema,
      reason: nonEmptyStringSchema,
    }),
  ),
  confidenceNotes: z.array(z.string()),
  quickWins: nonEmptyStringArraySchema,
});

const mediaPlanDataSchema = z.object({
  channelPlan: z
    .array(
      z.object({
        platform: nonEmptyStringSchema,
        monthlyBudget: z.number().optional(),
        budgetPercentage: z.number().optional(),
      }),
    )
    .min(1),
  budgetSummary: z.object({
    totalMonthly: z.number(),
    byPlatform: z.array(
      z.object({
        platform: nonEmptyStringSchema,
        amount: z.number(),
        percentage: z.number(),
      }),
    ),
  }),
  launchSequence: z
    .array(
      z.object({
        week: z.number(),
        actions: nonEmptyStringArraySchema,
        milestone: nonEmptyStringSchema,
      }),
    )
    .min(1),
  kpiFramework: z.object({
    northStar: nonEmptyStringSchema,
    weeklyReview: nonEmptyStringArraySchema,
  }),
});

const SECTION_DATA_SCHEMAS = {
  industryResearch: industryResearchDataSchema,
  competitorIntel: competitorIntelDataSchema,
  icpValidation: icpValidationDataSchema,
  offerAnalysis: offerAnalysisDataSchema,
  strategicSynthesis: strategicSynthesisDataSchema,
  keywordIntel: keywordIntelDataSchema,
  mediaPlan: mediaPlanDataSchema,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTrendDirection(
  value: unknown,
): 'rising' | 'stable' | 'declining' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return TREND_DIRECTION_ALIASES.get(value.trim().toLowerCase());
}

function normalizeIndustryResearchPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const trendSignals = Array.isArray(data.trendSignals)
    ? data.trendSignals.map((signal) => {
        if (!isRecord(signal)) {
          return signal;
        }

        const direction =
          normalizeTrendDirection(signal.direction) ??
          normalizeTrendDirection(signal.description);

        return direction
          ? {
              ...signal,
              direction,
            }
          : signal;
      })
    : data.trendSignals;

  return trendSignals === data.trendSignals
    ? data
    : {
        ...data,
        trendSignals,
      };
}

const COMPETITOR_PLATFORM_PATTERNS: Array<[label: string, pattern: RegExp]> = [
  ['LinkedIn', /\blinkedin\b/i],
  ['Google', /\bgoogle\b/i],
  ['Meta', /\bmeta\b|\bfacebook\b|\binstagram\b/i],
  ['YouTube', /\byoutube\b/i],
  ['Reddit', /\breddit\b/i],
  ['TikTok', /\btiktok\b/i],
  ['X', /\btwitter\b|\bx\b/i],
];

function inferCompetitorPlatformsFromEvidence(evidence: unknown): string[] {
  if (typeof evidence !== 'string') {
    return [];
  }

  const platforms: string[] = [];

  for (const [label, pattern] of COMPETITOR_PLATFORM_PATTERNS) {
    if (pattern.test(evidence)) {
      platforms.push(label);
    }
  }

  return platforms;
}

function buildLimitedCoverageEvidence(evidence: unknown): string {
  const trimmed = typeof evidence === 'string' ? evidence.trim() : '';

  if (trimmed.length === 0) {
    return 'Limited coverage: current active ads are not verified.';
  }

  if (/limited coverage/i.test(trimmed)) {
    return trimmed;
  }

  if (/not verified/i.test(trimmed)) {
    return `Limited coverage: ${trimmed}`;
  }

  return `Limited coverage: ${trimmed} Current active ads are not verified.`;
}

function normalizeCompetitorIntelPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(data.competitors)) {
    return data;
  }

  let changed = false;
  const competitors = data.competitors.map((competitor) => {
    if (!isRecord(competitor) || !isRecord(competitor.adActivity)) {
      return competitor;
    }

    const sourceConfidence =
      typeof competitor.adActivity.sourceConfidence === 'string'
        ? competitor.adActivity.sourceConfidence
        : null;
    const evidence = competitor.adActivity.evidence;
    const platforms = Array.isArray(competitor.adActivity.platforms)
      ? competitor.adActivity.platforms.filter(
          (platform): platform is string =>
            typeof platform === 'string' && platform.trim().length > 0,
        )
      : [];
    const inferredPlatforms = inferCompetitorPlatformsFromEvidence(evidence);
    const shouldLimitCoverage =
      sourceConfidence === 'low' ||
      (typeof evidence === 'string' &&
        /historical|limited coverage|not verified/i.test(evidence));
    const normalizedPlatforms =
      platforms.length > 0
        ? platforms
        : inferredPlatforms.length > 0
          ? inferredPlatforms
          : ['Not verified'];

    if (!shouldLimitCoverage && platforms.length > 0) {
      return competitor;
    }

    changed = true;

    return {
      ...competitor,
      adActivity: {
        ...competitor.adActivity,
        platforms: shouldLimitCoverage ? ['Not verified'] : normalizedPlatforms,
        evidence: shouldLimitCoverage
          ? buildLimitedCoverageEvidence(evidence)
          : evidence,
      },
    };
  });

  return changed
    ? {
        ...data,
        competitors,
      }
    : data;
}

function normalizeSectionData(
  section: SectionId,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (section === 'industryResearch') {
    return normalizeIndustryResearchPayload(data);
  }

  if (section === 'competitorIntel') {
    return normalizeCompetitorIntelPayload(data);
  }

  return data;
}

type SectionId = keyof typeof SECTION_DATA_SCHEMAS;

interface ResearchCitation {
  number?: number;
  url: string;
  title?: string;
}

interface FinalizeRunnerResultInput {
  section: string;
  durationMs: number;
  parsed?: unknown;
  rawText?: string;
  parseError?: unknown;
  telemetry?: RunnerTelemetry;
}

function normalizeChartTelemetry(
  charts: unknown,
): RunnerChartTelemetry[] | undefined {
  if (!Array.isArray(charts)) {
    return undefined;
  }

  const normalized: RunnerChartTelemetry[] = [];

  for (const chart of charts) {
      if (!chart || typeof chart !== 'object') {
        continue;
      }

      const record = chart as Record<string, unknown>;
      const chartType =
        typeof record.chartType === 'string' && record.chartType.trim().length > 0
          ? record.chartType
          : null;
      const title =
        typeof record.title === 'string' && record.title.trim().length > 0
          ? record.title
          : null;
      const imageUrl =
        typeof record.imageUrl === 'string' && record.imageUrl.trim().length > 0
          ? record.imageUrl
          : typeof record.url === 'string' && record.url.trim().length > 0
            ? record.url
            : undefined;

      if (!chartType || !title) {
        continue;
      }

      normalized.push({
        chartType,
        title,
        imageUrl,
      });
    }

  return normalized.length > 0 ? normalized : undefined;
}

function buildTelemetry(
  telemetry: RunnerTelemetry | undefined,
  parsed: unknown,
): RunnerTelemetry | undefined {
  const normalizedCharts = normalizeChartTelemetry(
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).charts
      : undefined,
  );

  if (!telemetry && !normalizedCharts) {
    return undefined;
  }

  return {
    ...telemetry,
    charts: telemetry?.charts ?? normalizedCharts,
  };
}

function normalizeCitationRecord(
  citation: unknown,
  index: number,
): ResearchCitation | null {
  if (typeof citation === 'string' && citation.trim().length > 0) {
    return {
      number: index + 1,
      url: citation,
    };
  }

  if (!citation || typeof citation !== 'object') {
    return null;
  }

  const record = citation as Record<string, unknown>;
  if (!record.url || typeof record.url !== 'string' || record.url.trim().length === 0) {
    return null;
  }

  return {
    number:
      typeof record.number === 'number' && Number.isFinite(record.number)
        ? record.number
        : index + 1,
    url: record.url,
    title:
      typeof record.title === 'string' && record.title.trim().length > 0
        ? record.title
        : undefined,
  };
}

function splitPayload(
  parsed: Record<string, unknown>,
): {
  data: Record<string, unknown>;
  citations: ResearchCitation[];
  provenance?: ResearchResult['provenance'];
} {
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'citations' || key === 'sources' || key === 'provenance') {
      continue;
    }

    data[key] = value;
  }

  const rawCitations = Array.isArray(parsed.citations)
    ? parsed.citations
    : Array.isArray(parsed.sources)
      ? parsed.sources
      : [];
  const citations = rawCitations
    .map((citation, index) => normalizeCitationRecord(citation, index))
    .filter((citation): citation is ResearchCitation => Boolean(citation));
  const provenance =
    parsed.provenance &&
    typeof parsed.provenance === 'object' &&
    ((parsed.provenance as Record<string, unknown>).status === 'sourced' ||
      (parsed.provenance as Record<string, unknown>).status === 'missing')
      ? {
          status: (parsed.provenance as Record<string, unknown>).status as
            | 'sourced'
            | 'missing',
          citationCount:
            typeof (parsed.provenance as Record<string, unknown>).citationCount === 'number'
              ? ((parsed.provenance as Record<string, unknown>).citationCount as number)
              : citations.length,
        }
      : {
          status: citations.length > 0 ? ('sourced' as const) : ('missing' as const),
          citationCount: citations.length,
        };

  return {
    data,
    citations,
    provenance,
  };
}

function buildPartialResult(
  section: SectionId,
  durationMs: number,
  rawText: string | undefined,
  issue: {
    code: string;
    message: string;
    path?: string;
  },
  telemetry?: RunnerTelemetry,
): ResearchResult {
  return {
    status: 'partial',
    section,
    durationMs,
    rawText,
    telemetry,
    error: issue.message,
    validation: {
      section,
      issues: [issue],
    },
  };
}

function hasFallbackLanguage(section: SectionId, data: unknown): boolean {
  if (
    section !== 'strategicSynthesis' &&
    section !== 'keywordIntel' &&
    section !== 'mediaPlan'
  ) {
    return false;
  }

  const serialized =
    typeof data === 'string'
      ? data
      : JSON.stringify(data);

  return (
    /\btimed out\b/i.test(serialized) ||
    /\btimeout\b/i.test(serialized) ||
    /\bfallback\b/i.test(serialized) ||
    /\bplaceholder\b/i.test(serialized)
  );
}

export function finalizeRunnerResult(
  input: FinalizeRunnerResultInput,
): ResearchResult {
  const telemetry = buildTelemetry(input.telemetry, input.parsed);
  const normalizedSection = normalizeResearchSection(input.section);
  if (!(normalizedSection in SECTION_DATA_SCHEMAS)) {
    return {
      status: 'error',
      section: normalizedSection,
      durationMs: input.durationMs,
      rawText: input.rawText,
      telemetry,
      error: `Unknown research section: ${input.section}`,
      validation: {
        section: normalizedSection,
        issues: [
          {
            code: 'unknown_section',
            message: `Unknown research section: ${input.section}`,
          },
        ],
      },
    };
  }

  const section = normalizedSection as SectionId;

  if (input.parseError) {
    return buildPartialResult(
      section,
      input.durationMs,
      input.rawText,
      {
        code: 'json_parse',
        message:
          input.parseError instanceof Error
            ? input.parseError.message
            : 'Runner output was not valid JSON.',
      },
      telemetry,
    );
  }

  if (!input.parsed || typeof input.parsed !== 'object' || Array.isArray(input.parsed)) {
    return buildPartialResult(
      section,
      input.durationMs,
      input.rawText,
      {
        code: 'invalid_result',
        message: 'Runner output is not an object payload.',
      },
      telemetry,
    );
  }

  const { data, citations, provenance } = splitPayload(
    input.parsed as Record<string, unknown>,
  );
  const normalizedData = normalizeSectionData(section, data);
  const parseResult = SECTION_DATA_SCHEMAS[section].safeParse(normalizedData);

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return buildPartialResult(
      section,
      input.durationMs,
      input.rawText,
      {
        code: 'schema_validation',
        message: issue?.message ?? 'Runner output failed schema validation.',
        path: issue?.path.map(String).join('.'),
      },
      telemetry,
    );
  }

  if (hasFallbackLanguage(section, parseResult.data)) {
    return buildPartialResult(
      section,
      input.durationMs,
      input.rawText,
      {
        code: 'fallback_language',
        message: 'Fallback or timeout language leaked into the artifact payload.',
      },
      telemetry,
    );
  }

  return {
    status: 'complete',
    section,
    durationMs: input.durationMs,
    data: parseResult.data,
    rawText: input.rawText,
    citations,
    provenance,
    telemetry,
  };
}
