import { z } from "zod";

import {
  activityEventSchema,
  isoDateSchema,
  isoDateTimeSchema,
  sectionIdSchema,
} from "../events/activity-event";

export const sourceRefSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
    observedAt: isoDateTimeSchema,
  })
  .strict();

export const competitorAdSchema = z
  .object({
    id: z.string().min(1),
    competitorName: z.string().min(1),
    platform: z.enum(["google", "meta", "linkedin"]),
    headline: z.string().min(1),
    body: z.string().min(1),
    landingUrl: z.string().url().nullable(),
    firstSeen: isoDateSchema.nullable(),
    lastSeen: isoDateSchema.nullable(),
    creativeUrl: z.string().url().nullable(),
    sourceUrl: z.string().url(),
    angle: z.string().min(1),
  })
  .strict();

export const companyProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    websiteUrl: z.string().url(),
    category: z.string().min(1),
    description: z.string().min(1),
    stage: z.string().min(1),
    targetCustomer: z.string().min(1),
  })
  .strict();

export const salesProcessDocRefSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

const onboardingEconomicsSchema = z
  .object({
    pricingModel: z.string().min(1).optional(),
    conversionPath: z.string().min(1).optional(),
    acv: z.string().min(1).optional(),
    pricingTiers: z.string().min(1).optional(),
    targetPlan: z.string().min(1).optional(),
    avgLtv: z.string().min(1).optional(),
    targetCac: z.string().min(1).optional(),
    monthlyAdBudget: z.string().min(1).optional(),
    budgetSplit: z.string().min(1).optional(),
    currentCac: z.string().min(1).optional(),
    monthlyRevenue: z.string().min(1).optional(),
    avgSalesCycle: z.string().min(1).optional(),
    visitorToSignup: z.string().min(1).optional(),
    signupToActivation: z.string().min(1).optional(),
    activationToPaid: z.string().min(1).optional(),
    demoToClose: z.string().min(1).optional(),
    growthTrend: z.string().min(1).optional(),
  })
  .strict();

export const onboardingSnapshotSchema = z
  .object({
    primaryGoal: z.string().min(1),
    targetSegments: z.array(z.string().min(1)).min(1),
    keyOffers: z.array(z.string().min(1)).min(1),
    distributionChannels: z.array(z.string().min(1)).min(1),
    constraints: z.array(z.string().min(1)),
    notes: z.string().min(1),
    salesProcessDocs: z.array(salesProcessDocRefSchema).max(4).optional(),
    salesLoomUrl: z.string().url().optional(),
    gtmMotion: z.enum(["SLG", "PLG"]).optional(),
    creativeCapacity: z.enum(["lean", "standard", "high"]).optional(),
    leadListAvailable: z.boolean().optional(),
    economics: onboardingEconomicsSchema.optional(),
  })
  .strict();

export const corpusExcerptSchema = z
  .object({
    id: z.string().min(1),
    sourceUrl: z.string().url(),
    title: z.string().min(1),
    text: z.string().min(1),
    observedAt: isoDateTimeSchema,
    sourceId: z.string().min(1),
  })
  .strict();

export const corpusSnapshotSchema = z
  .object({
    excerpts: z.array(corpusExcerptSchema).min(1),
    sectionExcerpts: z
      .record(sectionIdSchema, z.array(corpusExcerptSchema))
      .optional(),
  })
  .strict();

const verificationClaimSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("numeric"),
      value: z.string().min(1),
      raw: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("quote"),
      value: z.string().min(1),
      raw: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("url"),
      value: z.string().min(1),
      raw: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("entityName"),
      value: z.string().min(1),
      raw: z.string().min(1),
    })
    .strict(),
]);

const verificationSourceRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("toolResult"),
      toolName: z.string().min(1),
      stepIndex: z.number().int().nonnegative(),
      field: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("corpusExcerpt"),
      excerptIndex: z.number().int().nonnegative(),
      sourceUrl: z.string().url(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("userProvided"),
      field: z.string().min(1).optional(),
    })
    .strict(),
]);

const verificationClaimVerdictSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("verified"),
      claim: verificationClaimSchema,
      matchedSourceRef: verificationSourceRefSchema,
      entailmentVerdict: z
        .enum(["supported", "user_asserted"])
        .optional(),
      entailmentRationale: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal("unsupported"),
      claim: verificationClaimSchema,
      reason: z.enum(["no_match", "partial_match"]),
      entailmentVerdict: z.literal("refuted").optional(),
      entailmentRationale: z.string().min(1).optional(),
    })
    .strict(),
]);

export const verificationReportSchema = z
  .object({
    verifiedCount: z.number().int().nonnegative(),
    unsupportedCount: z.number().int().nonnegative(),
    claims: z.array(verificationClaimVerdictSchema),
  })
  .strict();

export const sectionReviewResultSchema = z
  .object({
    upgradedMarkdown: z.string().min(1),
    tier: z.enum(["verified", "needs_review", "insufficient"]),
    tierRationale: z.string().min(1),
    removedItems: z.array(z.string().min(1)),
    clientQuestions: z.array(z.string().min(1)),
  })
  .strict();

export const strategicCritiqueItemSchema = z
  .object({
    path: z.string().min(1),
    text: z.string().min(1),
    verdict: z.enum([
      "passes",
      "knew_that",
      "too_vague",
      "summary",
      "unsupported",
    ]),
    action: z.enum(["kept", "deepened", "cut"]),
    rationale: z.string().min(1),
  })
  .strict();

export const strategicCritiqueSchema = z
  .object({
    target: z.literal("cross_section_reasoning"),
    checkedAt: isoDateTimeSchema,
    modelId: z.string().min(1),
    summary: z.string().min(1),
    items: z.array(strategicCritiqueItemSchema).min(1).max(24),
  })
  .strict();

export const researchInputSchema = z
  .object({
    runId: z.string().min(1),
    fixtureId: z.string().min(1),
    company: companyProfileSchema,
    onboarding: onboardingSnapshotSchema,
    corpus: corpusSnapshotSchema,
    sources: z.array(sourceRefSchema).min(1),
    competitorAds: z.array(competitorAdSchema).max(5),
    // Competitor names (from the onboarding brief, optionally enriched with a
    // corpus-derived domain) used to seed the deterministic competitor ad probe.
    // Distinct from competitorAds, which carries already-fetched ad creatives
    // (fixture/preview context). The live probe reads BOTH.
    competitorSeeds: z
      .array(
        z
          .object({
            name: z.string().min(1),
            domain: z.string().min(1).optional(),
          })
          .strict(),
      )
      .optional(),
    committedPositioningArtifacts: z.record(z.string(), z.unknown()).optional(),
    crossSectionReasoningArtifact: z.unknown().optional(),
    _capabilities: z
      .object({
        capabilityGaps: z.array(
          z
            .object({
              class: z.literal("evidence_excerpt_dropped"),
              reason: z.literal("no_source_url"),
              count: z.number().int().positive(),
            })
            .strict(),
        ),
      })
      .strict()
      .optional(),
  })
  .strict();

export const artifactEnvelopeSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    sectionId: sectionIdSchema,
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(sourceRefSchema).min(1),
    body: z
      .record(z.string(), z.unknown())
      .refine((body) => Object.keys(body).length > 0, "Body cannot be empty"),
    verification: verificationReportSchema.optional(),
    review: sectionReviewResultSchema.optional(),
    strategicCritique: strategicCritiqueSchema.optional(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const sectionRunRecordSchema = z
  .object({
    sectionId: sectionIdSchema,
    status: z.enum(["idle", "running", "completed", "failed"]),
    artifact: artifactEnvelopeSchema.nullable().optional(),
    startedAt: isoDateTimeSchema.nullable().optional(),
    completedAt: isoDateTimeSchema.nullable().optional(),
    error: z.string().min(1).nullable(),
  })
  .strict();

export const runRecordStatusSchema = z.enum([
  "idle",
  "running",
  "completed",
  "failed",
]);

export const runRecordSourceSchema = z.enum(["live", "recording"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferRunRecordSource(
  value: Record<string, unknown>,
  runIdHint?: string,
): z.infer<typeof runRecordSourceSchema> {
  const id = typeof value.id === "string" ? value.id : runIdHint;

  return id?.startsWith("recording_") === true ? "recording" : "live";
}

export function migrateRunRecordInput(
  value: unknown,
  runIdHint?: string,
): unknown {
  if (!isRecord(value) || value.source !== undefined) {
    return value;
  }

  return {
    ...value,
    source: inferRunRecordSource(value, runIdHint),
  };
}

const runRecordBaseSchema = z
  .object({
    id: z.string().min(1),
    fixtureId: z.string().min(1),
    source: runRecordSourceSchema,
    status: runRecordStatusSchema,
    selectedSectionIds: z.array(sectionIdSchema).min(1),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    input: researchInputSchema,
    sections: z.record(z.string(), sectionRunRecordSchema),
    events: z.array(activityEventSchema),
  })
  .strict()
  .superRefine((record, context) => {
    for (const [sectionKey, sectionRecord] of Object.entries(record.sections)) {
      if (sectionKey !== sectionRecord.sectionId) {
        context.addIssue({
          code: "custom",
          message: `Section key ${sectionKey} does not match sectionId ${sectionRecord.sectionId}`,
          path: ["sections", sectionKey, "sectionId"],
        });
      }
    }
  });

export const runRecordSchema = z.preprocess(
  (value) => migrateRunRecordInput(value),
  runRecordBaseSchema,
);

export type SourceRef = z.infer<typeof sourceRefSchema>;
export type CompetitorAd = z.infer<typeof competitorAdSchema>;
export type CompanyProfile = z.infer<typeof companyProfileSchema>;
export type OnboardingSnapshot = z.infer<typeof onboardingSnapshotSchema>;
export type CorpusExcerpt = z.infer<typeof corpusExcerptSchema>;
export type CorpusSnapshot = z.infer<typeof corpusSnapshotSchema>;
export type ResearchInput = z.infer<typeof researchInputSchema>;
export type VerificationReportEnvelope = z.infer<typeof verificationReportSchema>;
export type SectionReviewResult = z.infer<typeof sectionReviewResultSchema>;
export type StrategicCritique = z.infer<typeof strategicCritiqueSchema>;
export type ArtifactEnvelope = z.infer<typeof artifactEnvelopeSchema>;
export type SectionRunRecord = z.infer<typeof sectionRunRecordSchema>;
export type RunRecordStatus = z.infer<typeof runRecordStatusSchema>;
export type RunRecordSource = z.infer<typeof runRecordSourceSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
