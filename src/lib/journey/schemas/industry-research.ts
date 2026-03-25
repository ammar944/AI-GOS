import { z } from 'zod';
import { flexibleEnum, nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const industryResearchDataSchema = z.object({
  categorySnapshot: z.object({
    category: nonEmptyStringSchema,
    marketSize: nonEmptyStringSchema.optional(),
    marketMaturity: flexibleEnum(['early', 'growing', 'saturated'] as const, 'growing').optional(),
    awarenessLevel: flexibleEnum(['low', 'medium', 'high'] as const, 'medium').optional(),
    buyingBehavior: flexibleEnum(
      ['impulsive', 'committee_driven', 'roi_based', 'mixed'] as const,
      'mixed',
    ).optional(),
    averageSalesCycle: nonEmptyStringSchema.optional(),
    seasonality: nonEmptyStringSchema.optional(),
  }),
  marketDynamics: z.object({
    demandDrivers: nonEmptyStringArraySchema,
    buyingTriggers: nonEmptyStringArraySchema,
    barriersToPurchase: nonEmptyStringArraySchema,
    macroRisks: z
      .object({
        regulatoryConcerns: nonEmptyStringSchema,
        marketDownturnRisks: nonEmptyStringSchema,
        industryConsolidation: nonEmptyStringSchema,
      })
      .optional(),
  }),
  painPoints: z.object({
    primary: nonEmptyStringArraySchema,
    secondary: nonEmptyStringArraySchema.optional(),
  }),
  messagingOpportunities: z.object({
    summaryRecommendations: nonEmptyStringArraySchema,
  }),
  psychologicalDrivers: z
    .object({
      drivers: nonEmptyStringArraySchema,
    })
    .optional(),
  psychologicalDriversDetailed: z
    .object({
      drivers: z.array(
        z.object({
          driver: nonEmptyStringSchema,
          description: nonEmptyStringSchema,
        })
      ),
    })
    .optional(),
  audienceObjections: nonEmptyStringArraySchema.optional(),
  audienceObjectionsDetailed: z
    .array(
      z.object({
        objection: nonEmptyStringSchema,
        howToAddress: nonEmptyStringSchema,
      })
    )
    .optional(),
  trendSignals: z
    .array(
      z.object({
        trend: nonEmptyStringSchema,
        direction: flexibleEnum(['rising', 'declining', 'stable'] as const, 'stable'),
        evidence: nonEmptyStringSchema,
      })
    )
    .optional(),
  seasonalityCalendar: z
    .array(
      z.object({
        month: z.number().min(1).max(12),
        intensity: z.coerce.number().min(0).max(10),
        notes: nonEmptyStringSchema,
      })
    )
    .optional(),
});

export type IndustryResearchData = z.infer<typeof industryResearchDataSchema>;
