import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const strategicInsightSchema = z.object({
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
});

export const positioningStrategySchema = z.object({
  recommendedAngle: nonEmptyStringSchema,
  alternativeAngles: nonEmptyStringArraySchema,
  leadRecommendation: nonEmptyStringSchema,
  keyDifferentiator: nonEmptyStringSchema,
});

export const platformRecommendationSchema = z.object({
  platform: nonEmptyStringSchema,
  role: z.enum(['primary', 'secondary', 'testing', 'retargeting']),
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
  downstreamSequence: z.array(z.enum(['keywordIntel', 'mediaPlan'])).min(1),
});

export const synthesisChartSchema = z.object({
  chartType: z.enum(['pie', 'radar', 'bar', 'funnel', 'word_cloud']),
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
});

export type StrategicSynthesisData = z.infer<
  typeof strategicSynthesisDataSchema
>;
export type StrategicInsight = z.infer<typeof strategicInsightSchema>;
export type PositioningStrategy = z.infer<typeof positioningStrategySchema>;
export type PlatformRecommendation = z.infer<typeof platformRecommendationSchema>;
export type MessagingAngle = z.infer<typeof messagingAngleSchema>;
export type PlanningContext = z.infer<typeof planningContextSchema>;
