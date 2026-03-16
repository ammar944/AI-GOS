import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const mediaPlanDataSchema = z.object({
  // ── 6-block worker output (from media-plan.ts generateObject) ────
  completedBlocks: z
    .array(z.enum([
      'channelMixBudget', 'audienceCampaign', 'creativeSystem',
      'measurementGuardrails', 'rolloutRoadmap', 'strategySnapshot',
    ]))
    .optional(),
  channelMixBudget: z.record(z.string(), z.unknown()).optional(),
  audienceCampaign: z.record(z.string(), z.unknown()).optional(),
  creativeSystem: z.record(z.string(), z.unknown()).optional(),
  measurementGuardrails: z.record(z.string(), z.unknown()).optional(),
  rolloutRoadmap: z.record(z.string(), z.unknown()).optional(),
  strategySnapshot: z.record(z.string(), z.unknown()).optional(),
  validationWarnings: z.array(z.string()).optional(),

  // ── Legacy/flat worker output (optional) ─────────────────────────
  dataSourced: z
    .object({
      googleAdsConnected: z.boolean().optional(),
      metaAdsConnected: z.boolean().optional(),
      ga4Connected: z.boolean().optional(),
      note: nonEmptyStringSchema,
    })
    .optional(),
  channelPlan: z
    .array(
      z.object({
        platform: nonEmptyStringSchema,
        role: nonEmptyStringSchema.optional(),
        monthlyBudget: z.number().optional(),
        budgetPercentage: z.number().min(0).max(100).optional(),
        campaignStructure: z
          .object({
            campaigns: z
              .array(
                z.object({
                  name: nonEmptyStringSchema,
                  type: nonEmptyStringSchema,
                  dailyBudget: z.number(),
                  targeting: nonEmptyStringSchema,
                  bidStrategy: nonEmptyStringSchema,
                }),
              )
              .optional(),
            totalCampaigns: z.number().optional(),
          })
          .optional(),
        audienceStrategy: z
          .object({
            coldAudiences: z.array(z.string()).optional(),
            warmAudiences: z.array(z.string()).optional(),
            lookalikes: z.array(z.string()).optional(),
          })
          .optional(),
        creativeRequirements: z
          .object({
            formats: z.array(z.string()).optional(),
            quantity: z.number().optional(),
            keyMessage: nonEmptyStringSchema.optional(),
            cta: nonEmptyStringSchema.optional(),
          })
          .optional(),
        expectedPerformance: z
          .object({
            ctr: nonEmptyStringSchema.optional(),
            cpc: nonEmptyStringSchema.optional(),
            cpl: nonEmptyStringSchema.optional(),
            roas: nonEmptyStringSchema.optional(),
            dataSource: nonEmptyStringSchema.optional(),
          })
          .optional(),
        launchWeek: z.number().optional(),
        optimizationCadence: nonEmptyStringSchema.optional(),
      }),
    )
    .min(1)
    .optional(),
  launchSequence: z
    .array(
      z.object({
        week: z.number(),
        actions: nonEmptyStringArraySchema,
        budget: z.number().optional(),
        milestone: nonEmptyStringSchema,
      }),
    )
    .min(1)
    .optional(),
  creativeCalendar: z
    .object({
      week1to2: nonEmptyStringArraySchema.optional(),
      week3to4: nonEmptyStringArraySchema.optional(),
      month2: nonEmptyStringArraySchema.optional(),
    })
    .optional(),
  kpiFramework: z
    .object({
      northStar: nonEmptyStringSchema,
      leadingIndicators: z.array(z.string()).optional(),
      weeklyReview: nonEmptyStringArraySchema,
      monthlyReview: z.array(z.string()).optional(),
      goNoGoCriteria: nonEmptyStringSchema.optional(),
    })
    .optional(),
  budgetSummary: z.object({
    totalMonthly: z.number(),
    byPlatform: z.array(
      z.object({
        platform: nonEmptyStringSchema,
        amount: z.number(),
        percentage: z.number(),
      }),
    ),
    contingency: z.number().optional(),
    note: nonEmptyStringSchema.optional(),
  }).optional(),

  // ── Legacy/alternate fields (optional) ───────────────────────────
  allocations: z
    .array(
      z.object({
        channel: nonEmptyStringSchema,
        percentage: z.number().min(0).max(100),
        spend: nonEmptyStringSchema.optional(),
        rationale: nonEmptyStringSchema.optional(),
      }),
    )
    .optional(),
  totalBudget: nonEmptyStringSchema.optional(),
  timeline: nonEmptyStringArraySchema.optional(),
  kpis: z
    .array(
      z.object({
        channel: nonEmptyStringSchema.optional(),
        metric: nonEmptyStringSchema.optional(),
        target: nonEmptyStringSchema.optional(),
        value: nonEmptyStringSchema.optional(),
      }),
    )
    .optional(),
  testingPlan: nonEmptyStringArraySchema.optional(),

  // ── V3 structured fields (all optional) ──────────────────────────

  executiveSummary: z
    .object({
      overview: nonEmptyStringSchema,
      primaryObjective: nonEmptyStringSchema,
      recommendedMonthlyBudget: z.number(),
      timelineToResults: nonEmptyStringSchema,
      topPriorities: nonEmptyStringArraySchema,
    })
    .optional(),

  platformStrategy: z
    .array(
      z.object({
        platform: nonEmptyStringSchema,
        rationale: nonEmptyStringSchema,
        budgetPercentage: z.number().min(0).max(100),
        monthlySpend: z.number(),
        campaignTypes: nonEmptyStringArraySchema,
        targetingApproach: nonEmptyStringSchema,
        expectedCplRange: z.object({ min: z.number(), max: z.number() }),
        priority: z.enum(['primary', 'secondary', 'testing']),
        adFormats: nonEmptyStringArraySchema,
        placements: nonEmptyStringArraySchema,
        synergiesWithOtherPlatforms: nonEmptyStringSchema,
        competitiveDensity: z.number().min(1).max(10).optional(),
        audienceSaturation: z.enum(['low', 'medium', 'high']).optional(),
        platformRiskFactors: z.array(z.string()).optional(),
        qvcScore: z.number().min(0).max(10).optional(),
        qvcBreakdown: z
          .object({
            targetingPrecision: z.number().min(1).max(10),
            leadQuality: z.number().min(1).max(10),
            costEfficiency: z.number().min(1).max(10),
            competitorPresence: z.number().min(1).max(10),
            creativeFormatFit: z.number().min(1).max(10),
          })
          .optional(),
      }),
    )
    .optional(),

  icpTargeting: z
    .object({
      segments: z.array(
        z.object({
          name: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
          targetingParameters: nonEmptyStringArraySchema,
          estimatedReach: nonEmptyStringSchema,
          funnelPosition: z.enum(['cold', 'warm', 'hot']),
        }),
      ),
      platformTargeting: z.array(
        z.object({
          platform: nonEmptyStringSchema,
          interests: z.array(z.string()),
          jobTitles: z.array(z.string()),
          customAudiences: z.array(z.string()),
          exclusions: z.array(z.string()),
        }),
      ),
      demographics: nonEmptyStringSchema,
      psychographics: nonEmptyStringSchema,
      geographicTargeting: nonEmptyStringSchema,
    })
    .optional(),

  campaignStructure: z
    .object({
      campaigns: z.array(
        z.object({
          name: nonEmptyStringSchema,
          objective: nonEmptyStringSchema,
          platform: nonEmptyStringSchema,
          funnelStage: z.enum(['cold', 'warm', 'hot']),
          dailyBudget: z.number(),
          adSets: z.array(
            z.object({
              name: nonEmptyStringSchema,
              targeting: nonEmptyStringSchema,
              adsToTest: z.number(),
              bidStrategy: nonEmptyStringSchema,
            }),
          ),
        }),
      ),
      namingConvention: z.object({
        campaignPattern: nonEmptyStringSchema,
        adSetPattern: nonEmptyStringSchema,
        adPattern: nonEmptyStringSchema,
        utmStructure: z.object({
          source: nonEmptyStringSchema,
          medium: nonEmptyStringSchema,
          campaign: nonEmptyStringSchema,
          content: nonEmptyStringSchema,
        }),
      }),
      retargetingSegments: z.array(
        z.object({
          name: nonEmptyStringSchema,
          source: nonEmptyStringSchema,
          lookbackDays: z.number(),
          messagingApproach: nonEmptyStringSchema,
        }),
      ),
      negativeKeywords: z.array(
        z.object({
          keyword: nonEmptyStringSchema,
          matchType: z.enum(['exact', 'phrase', 'broad']),
          reason: nonEmptyStringSchema,
        }),
      ),
    })
    .optional(),

  creativeStrategy: z
    .object({
      angles: z.array(
        z.object({
          name: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
          exampleHook: nonEmptyStringSchema,
          bestForFunnelStages: nonEmptyStringArraySchema,
          platforms: nonEmptyStringArraySchema,
        }),
      ),
      formatSpecs: z.array(
        z.object({
          format: nonEmptyStringSchema,
          dimensions: nonEmptyStringSchema,
          platform: nonEmptyStringSchema,
          copyGuideline: nonEmptyStringSchema,
        }),
      ),
      testingPlan: z.array(
        z.object({
          phase: nonEmptyStringSchema,
          variantsToTest: z.number(),
          methodology: nonEmptyStringSchema,
          testingBudget: z.number(),
          durationDays: z.number(),
          successCriteria: nonEmptyStringSchema,
        }),
      ),
      refreshCadence: z.array(
        z.object({
          platform: nonEmptyStringSchema,
          refreshIntervalDays: z.number(),
          fatigueSignals: nonEmptyStringArraySchema,
        }),
      ),
    })
    .optional(),

  budgetAllocation: z
    .object({
      totalMonthlyBudget: z.number(),
      platformBreakdown: z.array(
        z.object({
          platform: nonEmptyStringSchema,
          monthlyBudget: z.number(),
          percentage: z.number(),
        }),
      ),
      dailyCeiling: z.number(),
      rampUpStrategy: nonEmptyStringSchema,
      funnelSplit: z.array(
        z.object({
          stage: z.enum(['cold', 'warm', 'hot']),
          percentage: z.number(),
          rationale: nonEmptyStringSchema,
        }),
      ),
      monthlyRoadmap: z.array(
        z.object({
          month: z.number(),
          budget: z.number(),
          focus: nonEmptyStringSchema,
          scalingTriggers: nonEmptyStringArraySchema,
        }),
      ),
    })
    .optional(),

  campaignPhases: z
    .array(
      z.object({
        name: nonEmptyStringSchema,
        phase: z.number(),
        durationWeeks: z.number(),
        objective: nonEmptyStringSchema,
        activities: nonEmptyStringArraySchema,
        successCriteria: nonEmptyStringArraySchema,
        estimatedBudget: z.number(),
        goNoGoDecision: nonEmptyStringSchema.optional(),
      }),
    )
    .optional(),

  kpiTargets: z
    .array(
      z.object({
        metric: nonEmptyStringSchema,
        target: nonEmptyStringSchema,
        timeframe: nonEmptyStringSchema,
        measurementMethod: nonEmptyStringSchema,
        type: z.enum(['primary', 'secondary']),
        benchmark: nonEmptyStringSchema,
        scenarioThresholds: z
          .object({
            best: nonEmptyStringSchema,
            base: nonEmptyStringSchema,
            worst: nonEmptyStringSchema,
          })
          .optional(),
      }),
    )
    .optional(),

  performanceModel: z
    .object({
      cacModel: z.object({
        targetCAC: z.number(),
        targetCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        expectedMonthlyLeads: z.number(),
        expectedMonthlySQLs: z.number(),
        expectedMonthlyCustomers: z.number(),
        estimatedLTV: z.number(),
        ltvToCacRatio: nonEmptyStringSchema,
      }),
      monitoringSchedule: z.object({
        daily: nonEmptyStringArraySchema,
        weekly: nonEmptyStringArraySchema,
        monthly: nonEmptyStringArraySchema,
      }),
    })
    .optional(),

  riskMonitoring: z
    .object({
      risks: z.array(
        z.object({
          risk: nonEmptyStringSchema,
          category: z.enum([
            'budget',
            'creative',
            'audience',
            'platform',
            'compliance',
            'market',
          ]),
          severity: z.enum(['low', 'medium', 'high']),
          likelihood: z.enum(['low', 'medium', 'high']),
          mitigation: nonEmptyStringSchema,
          contingency: nonEmptyStringSchema,
          earlyWarningIndicator: nonEmptyStringSchema.optional(),
        }),
      ),
      assumptions: nonEmptyStringArraySchema,
    })
    .optional(),
});

export type MediaPlanData = z.infer<typeof mediaPlanDataSchema>;
