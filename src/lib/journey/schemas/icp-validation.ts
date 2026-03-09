import { z } from 'zod';
import {
  nonEmptyStringArraySchema,
  nonEmptyStringSchema,
  scoreBreakdownSchema,
} from './base';

export const icpValidationDataSchema = z.object({
  // ── Streaming base (required) ──────────────────────────────────────
  validatedPersona: nonEmptyStringSchema,
  demographics: nonEmptyStringSchema,
  channels: nonEmptyStringArraySchema,
  triggers: nonEmptyStringArraySchema,
  objections: nonEmptyStringArraySchema,
  decisionFactors: z.array(scoreBreakdownSchema).min(1),
  audienceSize: nonEmptyStringSchema,
  confidenceScore: z.number().min(0).max(100),
  decisionProcess: nonEmptyStringSchema,

  // ── V3 structured fields (optional — populated by extraction post-pass) ──

  coherenceCheck: z
    .object({
      clearlyDefined: z.boolean(),
      reachableThroughPaidChannels: z.boolean(),
      adequateScale: z.boolean(),
      hasPainOfferSolves: z.boolean(),
      hasBudgetAndAuthority: z.boolean(),
    })
    .optional(),

  painSolutionFit: z
    .object({
      primaryPain: nonEmptyStringSchema,
      offerComponentSolvingIt: nonEmptyStringSchema,
      fitAssessment: z.enum(['strong', 'moderate', 'weak']),
      notes: nonEmptyStringSchema,
    })
    .optional(),

  marketReachability: z
    .object({
      metaVolume: z.boolean(),
      linkedInVolume: z.boolean(),
      googleSearchDemand: z.boolean(),
      contradictingSignals: z.array(z.string()),
    })
    .optional(),

  economicFeasibility: z
    .object({
      hasBudget: z.boolean(),
      purchasesSimilar: z.boolean(),
      tamAlignedWithCac: z.boolean(),
      notes: nonEmptyStringSchema,
    })
    .optional(),

  customerPsychographics: z
    .object({
      goalsAndDreams: nonEmptyStringArraySchema,
      fearsAndInsecurities: nonEmptyStringArraySchema,
      embarrassingSituations: nonEmptyStringArraySchema,
      perceivedEnemy: nonEmptyStringSchema,
      failedSolutions: nonEmptyStringArraySchema,
      dayInTheLife: nonEmptyStringSchema,
    })
    .optional(),

  triggerEvents: z
    .array(
      z.object({
        event: nonEmptyStringSchema,
        annualFrequencyEstimate: nonEmptyStringSchema,
        urgencyLevel: z.enum(['immediate', 'near-term', 'planning-cycle']),
        detectionMethod: nonEmptyStringSchema,
        recommendedHook: nonEmptyStringSchema,
      }),
    )
    .optional(),

  segmentSizing: z
    .array(
      z.object({
        totalAddressableAccounts: z.number(),
        totalAddressableContacts: z.number(),
        segmentSharePercent: z.number(),
        priorityTier: z.number(),
        recommendedBudgetWeight: z.number(),
        priorityFactors: z.object({
          painSeverity: z.number().min(1).max(10),
          budgetAuthority: z.number().min(1).max(10),
          reachability: z.number().min(1).max(10),
          triggerFrequency: z.number().min(1).max(10),
        }),
      }),
    )
    .optional(),

  samEstimate: z
    .object({
      totalMatchingCompanies: z.number(),
      filteringFunnel: z.array(
        z.object({
          stage: nonEmptyStringSchema,
          count: z.number(),
          dropOffReason: nonEmptyStringSchema,
        }),
      ),
      estimatedSAMCompanies: z.number(),
      estimatedAnnualContractValue: z.number(),
      confidence: z.enum(['high', 'medium', 'low']),
      dataSources: nonEmptyStringArraySchema,
    })
    .optional(),

  sensitivityAnalysis: z
    .object({
      bestCase: z.object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
      }),
      baseCase: z.object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
        confidencePercent: z.number(),
      }),
      worstCase: z.object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
      }),
      breakEven: z.object({
        maxCPLFor3xLTV: z.number(),
        maxCAC: z.number(),
        minLeadToSqlRate: z.number(),
        budgetFloorForTesting: z.number(),
      }),
    })
    .optional(),

  riskScores: z
    .array(
      z.object({
        risk: nonEmptyStringSchema,
        category: z.enum([
          'audience_reachability',
          'budget_adequacy',
          'pain_strength',
          'competitive_intensity',
          'proof_credibility',
          'platform_policy',
          'seasonality',
          'data_quality',
        ]),
        probability: z.number().min(1).max(5),
        impact: z.number().min(1).max(5),
        earlyWarningIndicator: nonEmptyStringSchema.optional(),
        mitigation: nonEmptyStringSchema.optional(),
        contingency: nonEmptyStringSchema.optional(),
        budgetImpactEstimate: nonEmptyStringSchema.optional(),
      }),
    )
    .optional(),

  finalVerdict: z
    .object({
      status: z.enum(['validated', 'workable', 'invalid']),
      reasoning: nonEmptyStringSchema,
      recommendations: nonEmptyStringArraySchema,
    })
    .optional(),

  // ── V3 additions ───────────────────────────────────────────────────

  buyingCommittee: z
    .array(
      z.object({
        role: nonEmptyStringSchema,
        influence: z.enum(['decision-maker', 'influencer', 'gatekeeper']),
        messagingAngle: nonEmptyStringSchema,
      }),
    )
    .optional(),

  platformAudienceSize: z
    .object({
      meta: z.number().optional(),
      linkedin: z.number().optional(),
      google: z.number().optional(),
    })
    .optional(),
});

export type IcpValidationData = z.infer<typeof icpValidationDataSchema>;
