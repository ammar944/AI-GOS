import { z } from 'zod';
import { normalizeResearchSection } from './section-map';
import type { ResearchResult } from './supabase';
import type { RunnerChartTelemetry, RunnerTelemetry } from './telemetry';

const nonEmptyStringSchema = z.string().trim();
// Relaxed: accept empty arrays — AI may not always have data for every field.
const nonEmptyStringArraySchema = z.array(z.string().trim()).default([]);

/** Flexible enum — normalizes AI output (casing, phrasing) with safe fallback. */
export function flexibleEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
): z.ZodType<T[number]> {
  return z.string().transform((val): T[number] => {
    const lower = val.toLowerCase().trim();
    if ((values as readonly string[]).includes(lower)) return lower as T[number];
    for (const v of values) {
      if (lower.includes(v)) return v;
    }
    return fallback;
  }) as unknown as z.ZodType<T[number]>;
}
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
    marketSize: z.string().optional(),
    marketMaturity: z.enum(['early', 'growing', 'saturated']).optional(),
    buyingBehavior: z.string().optional(),
    awarenessLevel: z.string().optional(),
    averageSalesCycle: z.string().optional(),
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
        direction: z.string().min(1),
        evidence: nonEmptyStringSchema,
      }),
    )
    .optional(),
  messagingOpportunities: z.object({
    angles: z.array(z.string()).optional(),
    summaryRecommendations: nonEmptyStringArraySchema,
  }),
  marketOpportunities: z.array(z.object({
    opportunity: nonEmptyStringSchema,
    size: flexibleEnum(['small', 'medium', 'large'] as const, 'medium'),
    timing: flexibleEnum(['now', '3-6 months', '6-12 months'] as const, 'now'),
    difficulty: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    evidence: nonEmptyStringSchema,
  })).default([]),
});

const threatAssessmentSchema = z.object({
  threatFactors: z.object({
    marketShareRecognition: z.coerce.number().min(0).max(10),
    adSpendIntensity: z.coerce.number().min(0).max(10),
    productOverlap: z.coerce.number().min(0).max(10),
    priceCompetitiveness: z.coerce.number().min(0).max(10),
    growthTrajectory: z.coerce.number().min(0).max(10),
  }),
  topAdHooks: z.array(z.string()).optional(),
  likelyResponse: z.string().optional(),
  counterPositioning: z.string().optional(),
});

const competitorAdCreativeSchema = z.object({
  platform: z.string().min(1),
  id: nonEmptyStringSchema,
  advertiser: nonEmptyStringSchema,
  headline: z.string().optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  format: z.string().min(1),
  isActive: z.boolean(),
  firstSeen: z.string().optional(),
  lastSeen: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  detailsUrl: z.string().optional(),
});

const competitorLibraryLinksSchema = z.object({
  metaLibraryUrl: z.string().optional(),
  linkedInLibraryUrl: z.string().optional(),
  googleAdvertiserUrl: z.string().optional(),
});

const competitorIntelDataSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: nonEmptyStringSchema,
        website: nonEmptyStringSchema,
        positioning: nonEmptyStringSchema,
        price: z.string().optional(),
        pricingConfidence: z.string().optional(),
        strengths: nonEmptyStringArraySchema,
        weaknesses: nonEmptyStringArraySchema,
        opportunities: nonEmptyStringArraySchema,
        ourAdvantage: nonEmptyStringSchema,
        pricingTiers: z.array(z.object({
          name: z.string(),
          price: z.string(),
          description: z.string().optional(),
        })).default([]),
        adActivity: z.object({
          activeAdCount: z.number().int().nonnegative(),
          platforms: nonEmptyStringArraySchema,
          themes: nonEmptyStringArraySchema,
          evidence: nonEmptyStringSchema,
          sourceConfidence: z.string().min(1),
        }),
        threatAssessment: threatAssessmentSchema.optional(),
        adCreatives: z.array(competitorAdCreativeSchema).default([]),
        libraryLinks: competitorLibraryLinksSchema.optional(),
        reviews: z.object({
          trustpilot: z.object({
            rating: z.number().min(0).max(5).optional(),
            reviewCount: z.number().nonnegative().optional(),
            recentThemes: z.array(z.string()).optional(),
            url: z.string().optional(),
          }).optional(),
          g2: z.object({
            rating: z.number().min(0).max(5).optional(),
            reviewCount: z.number().nonnegative().optional(),
            categories: z.array(z.string()).optional(),
            url: z.string().optional(),
          }).optional(),
          capterra: z.object({
            rating: z.number().min(0).max(5).optional(),
            reviewCount: z.number().nonnegative().optional(),
            categories: z.array(z.string()).optional(),
            url: z.string().optional(),
          }).optional(),
          negativeReviews: z.array(z.object({
            text: z.string(),
            rating: z.number().min(1).max(3),
            date: z.string().optional(),
            source: z.enum(['g2', 'capterra', 'trustpilot']),
          })).max(5).optional(),
          // Output validation schema — .min()/.max() OK here (not API-facing)
          gapIntelligence: z.object({
            recurringComplaints: z.array(z.string()),
            exploitAngles: z.array(z.object({
              gap: z.string(),
              whyItMatters: z.string(),
              positioningAngle: z.string(),
              adHook: z.string(),
              confidence: z.enum(['high', 'medium', 'low']),
              evidenceQuotes: z.array(z.string()),
            })).max(3),
          }).optional(),
        }).optional(),
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
        type: z.string().min(1),
        evidence: nonEmptyStringSchema,
        exploitability: z.coerce.number().min(0).max(10),
        impact: z.coerce.number().min(0).max(10),
        recommendedAction: nonEmptyStringSchema,
      }),
    )
    .default([]),
  overallLandscape: z.string().optional(),
  positioningMoves: z.array(z.object({
    move: nonEmptyStringSchema,
    targetCompetitor: nonEmptyStringSchema,
    risk: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    reward: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    playbook: nonEmptyStringSchema,
  })).default([]),
  clientAdInsight: z.object({
    activeAdCount: z.number().int().nonnegative(),
    platforms: z.array(z.string()).default([]),
    themes: z.array(z.string()).default([]),
    evidence: z.string().default(''),
    sourceConfidence: z.string().default('low'),
    adCreatives: z.array(competitorAdCreativeSchema).default([]),
    libraryLinks: competitorLibraryLinksSchema.optional(),
  }).optional(),
  // Cross-competitor review analysis — injected by postProcessSynthesis
  reviewCrossAnalysis: z.object({
    commonWeaknesses: z.array(z.object({
      theme: z.string(),
      affectedCompetitors: z.array(z.string()),
      frequency: z.number(),
      exampleQuote: z.string(),
      leverageAngle: z.string(),
    })),
  }).optional(),
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
      status: z.string().min(1),
      reasoning: nonEmptyStringSchema,
      recommendations: z.array(z.string()).optional(),
    })
    .optional(),
  audienceRefinements: z.array(z.object({
    refinement: nonEmptyStringSchema,
    segment: nonEmptyStringSchema,
    expectedLift: flexibleEnum(['low', 'moderate', 'high'] as const, 'moderate'),
    testMethod: nonEmptyStringSchema,
    risk: nonEmptyStringSchema,
  })).default([]),
  segments: z.array(z.object({
    productLine: nonEmptyStringSchema,
    validatedPersona: nonEmptyStringSchema,
    audienceSize: nonEmptyStringSchema,
    confidence: z.number().min(0).max(100),
    triggers: nonEmptyStringArraySchema,
    objections: nonEmptyStringArraySchema,
  })).optional(),
});

const offerAnalysisDataSchema = z.object({
  offerStrength: z.object({
    painRelevance: z.coerce.number().min(0).max(10),
    urgency: z.coerce.number().min(0).max(10),
    differentiation: z.coerce.number().min(0).max(10),
    tangibility: z.coerce.number().min(0).max(10),
    proof: z.coerce.number().min(0).max(10),
    pricingLogic: z.coerce.number().min(0).max(10),
    overallScore: z.coerce.number().min(0).max(10),
  }),
  recommendation: z.object({
    status: z.string().min(1),
    summary: nonEmptyStringSchema,
    topStrengths: nonEmptyStringArraySchema,
    priorityFixes: nonEmptyStringArraySchema,
    recommendedActionPlan: nonEmptyStringArraySchema,
  }),
  redFlags: z
    .array(
      z.object({
        issue: nonEmptyStringSchema,
        severity: z.string().min(1),
        priority: z.number().int().positive(),
        recommendedAction: nonEmptyStringSchema,
        launchBlocker: z.boolean(),
        evidence: z.string().optional(),
      }),
    )
    .default([]),
  pricingAnalysis: z.object({
    currentPricing: nonEmptyStringSchema,
    pricingSource: z.string().nullable().default(null),
    marketBenchmark: nonEmptyStringSchema,
    pricingPosition: z.string().min(1),
    coldTrafficViability: nonEmptyStringSchema,
    elasticityAssessment: z.object({
      verdict: z.string(),
      signals: z.array(z.object({
        signal: z.string(),
        source: z.string(),
        direction: z.string(),
      })).default([]),
      reasoning: z.string(),
    }).optional(),
  }),
  marketFitAssessment: nonEmptyStringSchema,
  messagingRecommendations: z.array(nonEmptyStringSchema).default([]),
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
        priority: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
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
        role: z.string().min(1),
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
        targetEmotion: z.string().default(''),
        exampleHook: z.string().default(''),
        evidence: z.string().default(''),
      }),
    )
    .min(1),
  planningContext: z.object({
    monthlyBudget: z.string().optional(),
    targetCpl: z.string().optional(),
    targetCac: z.string().optional(),
    estimatedDemoPageCvr: z.number().min(0).max(10).optional().describe('Estimated demo/trial page conversion rate as a percentage (e.g. 3.5 for 3.5%). Must be within industry benchmarks: 2-5% for B2B SaaS demo pages.'),
    downstreamSequence: z.array(z.string()).default(['mediaPlan']),
  }),
  criticalSuccessFactors: nonEmptyStringArraySchema,
  nextSteps: nonEmptyStringArraySchema,
  strategicNarrative: nonEmptyStringSchema,
  charts: z
    .array(
      z.object({
        chartType: flexibleEnum(['pie', 'radar', 'bar', 'funnel', 'word_cloud'] as const, 'bar'),
        title: nonEmptyStringSchema,
        imageUrl: nonEmptyStringSchema,
        description: nonEmptyStringSchema,
      }),
    )
    .optional(),
  readinessScorecard: z.object({
    overallScore: z.coerce.number().min(0).max(10),
    verdict: flexibleEnum(['ready', 'fix-gaps-first', 'needs-work'] as const, 'needs-work'),
    verdictLabel: nonEmptyStringSchema,
    dimensions: z.array(z.object({
      name: nonEmptyStringSchema,
      score: z.coerce.number().min(0).max(10),
      summary: nonEmptyStringSchema,
    })),
  }).optional(),
  topActions: z.object({
    actions: z.array(z.object({
      action: nonEmptyStringSchema,
      source: flexibleEnum(['industry', 'icp', 'competitors', 'offer', 'keywords'] as const, 'industry'),
      priority: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
    })),
  }).optional(),
});

const keywordOpportunitySchema = z.object({
  keyword: nonEmptyStringSchema,
  searchVolume: z.number().nonnegative(),
  estimatedCpc: nonEmptyStringSchema,
  difficulty: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
  priorityScore: z.number().int().min(0).max(100),
  confidence: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
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
  competitorKeywords: z
    .array(
      z.object({
        competitorName: nonEmptyStringSchema,
        competitorDomain: nonEmptyStringSchema,
        topKeywords: z
          .array(
            z.object({
              keyword: nonEmptyStringSchema,
              searchVolume: z.number().nonnegative(),
              estimatedCpc: nonEmptyStringSchema,
            }),
          )
          .max(5),
      }),
    )
    .optional(),
  negativeKeywords: z.array(
    z.object({
      keyword: nonEmptyStringSchema,
      reason: nonEmptyStringSchema,
    }),
  ),
  confidenceNotes: z.array(z.string()),
  quickWins: nonEmptyStringArraySchema,
});

// ── Media Plan Block Schemas (6-block progressive structure) ──

export const channelMixBudgetSchema = z.object({
  platforms: z.array(z.object({
    name: z.string(),
    // 'retargeting' removed 2026-04-19 per Mahdy round 2 — cold-DR default,
    // no retargeting without a confirmed audience pool.
    role: flexibleEnum(['primary-acquisition', 'awareness', 'testing'] as const, 'primary-acquisition'),
    monthlySpend: z.number().min(0),
    percentage: z.number().min(0).max(100),
    // expectedCPL (client-specific target) removed 2026-04-19 per Mahdy feedback —
    // CPL targets depend on offer/creative/sales process, not paid media. Use
    // benchmarkRange on individual KPIs if a range is genuinely useful.
    rationale: z.string(),
  })),
  budgetSummary: z.object({
    totalMonthly: z.number().min(0),
    funnelSplit: z.object({
      awareness: z.number().min(0).max(100),
      consideration: z.number().min(0).max(100),
      conversion: z.number().min(0).max(100),
    }),
    rampUpWeeks: z.number().int().min(1),
  }),
  dailyCeilings: z.array(z.object({
    platform: z.string(),
    dailyBudget: z.number().min(0),
    minimumMet: z.boolean(),
  })),
});

export const audienceCampaignSchema = z.object({
  segments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    targetingParams: z.record(z.string(), z.unknown()),
    estimatedReach: z.string(),
    // 'mid' funnel position removed 2026-04-19 per Mahdy round 2 — cold-DR
    // default, middle-of-funnel segments require a confirmed audience pool.
    funnelPosition: flexibleEnum(['top', 'bottom'] as const, 'top'),
    priority: z.number().int().min(1).max(10),
  })),
  // Max 2 campaigns for DR cold-launch — budget-splitting across 6 campaign
  // types is "super, super thin" per Mahdy.
  campaigns: z.array(z.object({
    platform: z.string(),
    name: z.string(),
    objective: z.string(),
    adSets: z.array(z.object({
      name: z.string(),
      segment: z.string(),
      budget: z.number().min(0),
    })),
    namingConvention: z.string(),
  })).max(2),
  // retargetingSegments removed 2026-04-19 per Mahdy round 2 — no audience
  // pool means no retargeting. Re-introduce behind [hasRetargetingPool:true]
  // metadata flag if/when relevant.
});

export const creativeSystemSchema = z.object({
  angles: z.array(z.object({
    theme: z.string(),
    hook: z.string(),
    messagingApproach: z.string(),
    targetSegment: z.string(),
  })),
  // formatSpecs removed 2026-04-19 per Mahdy round 2 — "this is quite useless,
  // there's gonna be a mix of everything." Creative format is a production
  // detail, not a media plan deliverable.
  testingPlan: z.object({
    firstTests: z.array(z.string()),
    methodology: z.string(),
    minBudgetPerTest: z.number().min(0),
  }),
  refreshCadence: z.object({
    frequencyDays: z.number().int().min(1),
    fatigueSignals: z.array(z.string()),
  }),
});

export const measurementGuardrailsSchema = z.object({
  // 2026-04-19 (Mahdy round 2): kpis + cacFramework REMOVED entirely. Even
  // qualitative KPI drivers are "too much" — publishing anything that looks
  // like a client target is a trap. Replaced with:
  //   - industryBenchmarks: clearly-labeled external ranges (e.g., "MQL-to-SQL
  //     conversion rate: 15-25%, SaaS benchmark"). Max 4.
  //   - salesProcessGuidance: prose on how the CLIENT can improve conversion
  //     via their own sales process (not paid media).
  industryBenchmarks: z.array(z.object({
    metric: z.string(),  // e.g. "MQL-to-SQL conversion rate"
    range: z.string(),   // e.g. "15-25%"
    source: z.string(),  // label like "Industry benchmark" or "SaaS average (HubSpot 2024)"
    note: z.string(),    // context / caveat
  })).max(4),
  salesProcessGuidance: z.object({
    diagnosticNote: z.string(),              // what to look for in current sales process
    improvementLevers: z.array(z.string()),  // how to boost conversion via process
    sopReference: z.string().optional(),     // e.g. "Follow the sales SOP in the shared Google Doc"
  }),
  risks: z.array(z.object({
    risk: z.string(),
    category: flexibleEnum(['budget', 'creative', 'targeting', 'tracking', 'compliance', 'competitive', 'seasonal'] as const, 'competitive'),
    severity: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
    likelihood: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
    mitigation: z.string(),
    earlyWarning: z.string(),
  })),
  trackingRequirements: z.array(z.object({
    platform: z.string(),
    requirement: z.string(),
    status: flexibleEnum(['required', 'recommended', 'optional'] as const, 'recommended'),
  })),
});

export const rolloutRoadmapSchema = z.object({
  phases: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    objectives: z.array(z.string()),
    activities: z.array(z.string()),
    successCriteria: z.array(z.string()),
    budgetAllocation: z.number().min(0),
    goNoGo: z.string(),
  })),
  timeline: z.object({
    totalWeeks: z.number().int().min(1),
    monthlyMilestones: z.array(z.object({
      month: z.number().int().min(1),
      milestone: z.string(),
    })),
  }),
});

export const strategySnapshotSchema = z.object({
  headline: z.string(),
  topPriorities: z.array(z.object({
    priority: z.string(),
    rationale: z.string(),
  })).max(3),
  budgetOverview: z.object({
    total: z.number().min(0), // user's own budget input — NOT a forecast, safe to display
    topPlatform: z.string(),
    timeToFirstResults: z.string(),
  }),
  // expectedOutcomes numeric forecasts removed 2026-04-19 per Mahdy feedback.
  // Replaced with qualitative signals the user can evaluate without being
  // anchored to guesses that depend on the sales process.
  expectedSignals: z.object({
    timeToFirstResults: z.string().optional(),
    qualitativeOutcomes: z.array(z.string()),
  }),
});

export const MEDIA_PLAN_BLOCK_NAMES = [
  'channelMixBudget',
  'audienceCampaign',
  'creativeSystem',
  'measurementGuardrails',
  'rolloutRoadmap',
  'strategySnapshot',
] as const;

export type MediaPlanBlock = (typeof MEDIA_PLAN_BLOCK_NAMES)[number];

const mediaPlanDataSchema = z.object({
  completedBlocks: z.array(z.enum([
    'channelMixBudget', 'audienceCampaign', 'creativeSystem',
    'measurementGuardrails', 'rolloutRoadmap', 'strategySnapshot',
  ])),
  channelMixBudget: channelMixBudgetSchema.optional(),
  audienceCampaign: audienceCampaignSchema.optional(),
  creativeSystem: creativeSystemSchema.optional(),
  measurementGuardrails: measurementGuardrailsSchema.optional(),
  rolloutRoadmap: rolloutRoadmapSchema.optional(),
  strategySnapshot: strategySnapshotSchema.optional(),
  validationWarnings: z.array(z.string()).optional(),
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

/**
 * Ensure a field is a non-empty string array. If missing or empty,
 * returns a single-item array with the given fallback string.
 */
function ensureStringArray(
  value: unknown,
  fallback: string,
): string[] {
  if (Array.isArray(value)) {
    const filtered = value.filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (filtered.length > 0) return filtered;
  }
  return [fallback];
}

function normalizeCompetitorIntelPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!Array.isArray(data.competitors)) {
    return data;
  }

  const competitors = data.competitors.map((competitor) => {
    if (!isRecord(competitor)) {
      return competitor;
    }

    // Fill missing required strings with safe defaults
    const website =
      typeof competitor.website === 'string' && competitor.website.trim().length > 0
        ? competitor.website
        : typeof competitor.domain === 'string' && competitor.domain.trim().length > 0
          ? competitor.domain
          : typeof competitor.url === 'string' && competitor.url.trim().length > 0
            ? competitor.url
            : 'Not available';
    const positioning =
      typeof competitor.positioning === 'string' && competitor.positioning.trim().length > 0
        ? competitor.positioning
        : 'Positioning data not available';
    const ourAdvantage =
      typeof competitor.ourAdvantage === 'string' && competitor.ourAdvantage.trim().length > 0
        ? competitor.ourAdvantage
        : typeof competitor.advantage === 'string' && competitor.advantage.trim().length > 0
          ? competitor.advantage
          : 'Advantage analysis pending';

    // Fill missing required arrays with safe defaults
    const strengths = ensureStringArray(competitor.strengths, 'Data not available');
    const weaknesses = ensureStringArray(competitor.weaknesses, 'Data not available');
    const opportunities = ensureStringArray(competitor.opportunities, 'Further research needed');

    // Normalize adActivity — ensure it's an object with required fields
    const adActivity = isRecord(competitor.adActivity)
      ? competitor.adActivity
      : {
          activeAdCount: 0,
          platforms: ['Not verified'],
          themes: ['Not available'],
          evidence: 'Limited coverage: ad data not collected.',
          sourceConfidence: 'low',
        };

    // Patch missing adActivity fields even when the object exists
    if (typeof adActivity.activeAdCount !== 'number') {
      adActivity.activeAdCount = 0;
    }
    if (typeof adActivity.sourceConfidence !== 'string' || !adActivity.sourceConfidence) {
      adActivity.sourceConfidence = 'low';
    }
    if (typeof adActivity.evidence !== 'string' || !adActivity.evidence.toString().trim()) {
      adActivity.evidence = 'Limited coverage: ad data not collected.';
    }

    const sourceConfidence =
      typeof adActivity.sourceConfidence === 'string'
        ? adActivity.sourceConfidence
        : null;
    const evidence = adActivity.evidence;
    const platforms = Array.isArray(adActivity.platforms)
      ? adActivity.platforms.filter(
          (platform): platform is string =>
            typeof platform === 'string' && platform.trim().length > 0,
        )
      : [];
    const themes = ensureStringArray(adActivity.themes, 'Not available');
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

    return {
      ...competitor,
      website,
      positioning,
      ourAdvantage,
      strengths,
      weaknesses,
      opportunities,
      adActivity: {
        ...adActivity,
        platforms: shouldLimitCoverage ? ['Not verified'] : normalizedPlatforms,
        themes,
        evidence: shouldLimitCoverage
          ? buildLimitedCoverageEvidence(evidence)
          : evidence,
      },
    };
  });

  // Normalize top-level whiteSpaceGaps — default to a generic gap if missing
  const whiteSpaceGaps = Array.isArray(data.whiteSpaceGaps) && data.whiteSpaceGaps.length > 0
    ? data.whiteSpaceGaps
    : [
        {
          gap: 'Insufficient data to identify specific white space gaps',
          type: 'messaging',
          evidence: 'Competitor analysis did not surface clear gaps — further research recommended',
          exploitability: 3,
          impact: 3,
          recommendedAction: 'Conduct deeper competitive analysis with manual review',
        },
      ];

  return {
    ...data,
    competitors,
    whiteSpaceGaps,
  };
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
  fieldProvenance?: ResearchResult['fieldProvenance'];
} {
  const data: Record<string, unknown> = {};

  let fieldProvenance: ResearchResult['fieldProvenance'] | undefined;

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'citations' || key === 'sources' || key === 'provenance') {
      continue;
    }
    // Extract per-field provenance tracking from runner output
    if (key === '_provenance' && Array.isArray(value)) {
      fieldProvenance = value.filter(
        (v): v is NonNullable<ResearchResult['fieldProvenance']>[number] =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as Record<string, unknown>).field === 'string' &&
          typeof (v as Record<string, unknown>).source === 'string',
      );
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
    ...(fieldProvenance && fieldProvenance.length > 0 ? { fieldProvenance } : {}),
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

  // Only flag phrases that indicate the model is admitting to a failure/placeholder,
  // NOT legitimate strategy terms like "fallback channel" or "placeholder creative".
  return (
    /\b(?:request|research|analysis|data)\s+timed?\s*out\b/i.test(serialized) ||
    /\bfallback (?:response|output|result|data|artifact)\b/i.test(serialized) ||
    /\bplaceholder (?:response|output|result|data|text|content)\b/i.test(serialized) ||
    /\bunable to (?:complete|generate|produce|retrieve)\b/i.test(serialized) ||
    /\bno (?:data|results?) (?:available|found|returned)\b/i.test(serialized)
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

  const { data, citations, provenance, fieldProvenance } = splitPayload(
    input.parsed as Record<string, unknown>,
  );
  const normalizedData = normalizeSectionData(section, data);
  const parseResult = SECTION_DATA_SCHEMAS[section].safeParse(normalizedData);

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const path = issue?.path.map(String).join('.') ?? '';
    const baseMessage = issue?.message ?? 'Runner output failed schema validation.';
    const message = path
      ? `Validation failed at "${path}": ${baseMessage}`
      : `Validation failed: ${baseMessage}`;
    return buildPartialResult(
      section,
      input.durationMs,
      input.rawText,
      {
        code: 'schema_validation',
        message,
        path,
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
    ...(fieldProvenance && fieldProvenance.length > 0 ? { fieldProvenance } : {}),
    telemetry,
  };
}
