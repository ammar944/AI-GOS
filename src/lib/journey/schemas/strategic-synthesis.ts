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
  downstreamSequence: z.array(z.enum(['keywordIntel', 'mediaPlan'])).min(1),
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
});

export type StrategicSynthesisData = z.infer<
  typeof strategicSynthesisDataSchema
>;
export type StrategicInsight = z.infer<typeof strategicInsightSchema>;
export type PositioningStrategy = z.infer<typeof positioningStrategySchema>;
export type PlatformRecommendation = z.infer<typeof platformRecommendationSchema>;
export type MessagingAngle = z.infer<typeof messagingAngleSchema>;
export type PlanningContext = z.infer<typeof planningContextSchema>;
