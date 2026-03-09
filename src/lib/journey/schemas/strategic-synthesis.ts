import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const strategicInsightSchema = z.object({
  insight: nonEmptyStringSchema,
  source: z
    .enum(['industryResearch', 'icpValidation', 'offerAnalysis', 'competitorIntel'])
    .optional(),
  implication: nonEmptyStringSchema,
  priority: z.enum(['high', 'medium', 'low']),
});

export const recommendedPlatformSchema = z.object({
  platform: z
    .enum(['Meta', 'LinkedIn', 'Google', 'YouTube', 'TikTok'])
    .or(nonEmptyStringSchema),
  reasoning: nonEmptyStringSchema,
  priority: z.enum(['primary', 'secondary', 'testing']),
});

export const adHookSchema = z.object({
  hook: nonEmptyStringSchema,
  technique: z.enum([
    'controversial',
    'revelation',
    'myth-bust',
    'status-quo-challenge',
    'curiosity-gap',
    'story',
    'fear',
    'social-proof',
    'urgency',
    'authority',
    'comparison',
  ]),
  targetAwareness: z.enum([
    'unaware',
    'problem-aware',
    'solution-aware',
    'product-aware',
    'most-aware',
  ]),
  source: z
    .object({
      type: z.enum(['extracted', 'inspired', 'generated']),
      competitors: z.array(z.string()).optional(),
      platform: z.enum(['linkedin', 'meta', 'google']).optional(),
    })
    .optional(),
});

export const messagingAngleSchema = z.object({
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  targetEmotion: nonEmptyStringSchema,
  exampleHeadline: nonEmptyStringSchema,
});

export const proofPointDetailedSchema = z.object({
  claim: nonEmptyStringSchema,
  evidence: nonEmptyStringSchema,
  source: nonEmptyStringSchema.optional(),
});

export const objectionHandlerSchema = z.object({
  objection: nonEmptyStringSchema,
  response: nonEmptyStringSchema,
  reframe: nonEmptyStringSchema,
});

export const budgetAllocationSchema = z.object({
  platform: nonEmptyStringSchema,
  percentage: z.number().min(0).max(100),
  reasoning: nonEmptyStringSchema,
});

export const strategicSynthesisDataSchema = z.object({
  keyInsights: z.array(strategicInsightSchema).min(1),
  recommendedPositioning: nonEmptyStringSchema,
  positioningStrategy: z.object({
    primary: nonEmptyStringSchema,
    alternatives: nonEmptyStringArraySchema,
    differentiators: nonEmptyStringArraySchema,
    avoidPositions: nonEmptyStringArraySchema,
  }),
  recommendedPlatforms: z.array(recommendedPlatformSchema).min(1),
  potentialBlockers: nonEmptyStringArraySchema,
  nextSteps: nonEmptyStringArraySchema,
  criticalSuccessFactors: nonEmptyStringArraySchema.optional(),
  messagingFramework: z.object({
    coreMessage: nonEmptyStringSchema,
    supportingMessages: nonEmptyStringArraySchema.optional(),
    proofPoints: nonEmptyStringArraySchema.optional(),
    tonalGuidelines: nonEmptyStringArraySchema.optional(),

    // V1 restores
    adHooks: z.array(adHookSchema).optional(),
    angles: z.array(messagingAngleSchema).optional(),
    proofPointsDetailed: z.array(proofPointDetailedSchema).optional(),
    objectionHandlers: z.array(objectionHandlerSchema).optional(),
  }),

  // V3 addition
  budgetAllocationRecommendation: z.array(budgetAllocationSchema).optional(),
});

export type StrategicSynthesisData = z.infer<
  typeof strategicSynthesisDataSchema
>;
