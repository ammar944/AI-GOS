import { z } from 'zod';
import { flexibleEnum, nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const strategicInsightSchema = z.object({
  insight: nonEmptyStringSchema,
  source: flexibleEnum(
    ['industryResearch', 'competitorIntel', 'icpValidation', 'offerAnalysis'] as const,
    'industryResearch',
  ).optional(),
  implication: nonEmptyStringSchema,
  priority: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
});

export const positioningStrategySchema = z.object({
  recommendedAngle: nonEmptyStringSchema,
  alternativeAngles: nonEmptyStringArraySchema,
  leadRecommendation: nonEmptyStringSchema,
  keyDifferentiator: nonEmptyStringSchema,
});

export const platformRecommendationSchema = z.object({
  platform: nonEmptyStringSchema,
  role: flexibleEnum(['primary', 'secondary', 'testing', 'retargeting'] as const, 'primary'),
  budgetAllocation: nonEmptyStringSchema,
  rationale: nonEmptyStringSchema,
  priority: z.number().int().positive(),
});

export const messagingAngleSchema = z.object({
  angle: nonEmptyStringSchema,
  targetEmotion: nonEmptyStringSchema,
  exampleHook: nonEmptyStringSchema,
  evidence: nonEmptyStringSchema,
});

export const planningContextSchema = z.object({
  monthlyBudget: nonEmptyStringSchema.optional(),
  targetCpl: nonEmptyStringSchema.optional(),
  targetCac: nonEmptyStringSchema.optional(),
  estimatedDemoPageCvr: z.number().min(0).max(10).optional().describe('Estimated demo/trial page conversion rate as a percentage (e.g. 3.5 for 3.5%). Must be within industry benchmarks: 2-5% for B2B SaaS demo pages.'),
  downstreamSequence: z.array(z.string()).min(1),
});

export const synthesisChartSchema = z.object({
  chartType: flexibleEnum(['pie', 'radar', 'bar', 'funnel', 'word_cloud'] as const, 'bar'),
  title: nonEmptyStringSchema,
  imageUrl: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
});

export const strategicSynthesisDataSchema = z.object({
  keyInsights: z.array(strategicInsightSchema).min(1),
  positioningStrategy: positioningStrategySchema,
  platformRecommendations: z.array(platformRecommendationSchema).min(1),
  messagingAngles: z.array(messagingAngleSchema).min(1),
  planningContext: planningContextSchema,
  criticalSuccessFactors: nonEmptyStringArraySchema,
  nextSteps: nonEmptyStringArraySchema,
  strategicNarrative: nonEmptyStringSchema,
  charts: z.array(synthesisChartSchema).optional(),

  // ── Intelligence: Readiness Scorecard + Top Actions ─────────────────
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

export type StrategicSynthesisData = z.infer<
  typeof strategicSynthesisDataSchema
>;
export type StrategicInsight = z.infer<typeof strategicInsightSchema>;
export type PositioningStrategy = z.infer<typeof positioningStrategySchema>;
export type PlatformRecommendation = z.infer<typeof platformRecommendationSchema>;
export type MessagingAngle = z.infer<typeof messagingAngleSchema>;
export type PlanningContext = z.infer<typeof planningContextSchema>;
