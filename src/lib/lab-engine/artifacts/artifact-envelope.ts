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

export const researchProvenanceSchema = z.enum([
  "user-supplied",
  "tool-measured",
  "source-reported",
  "model-estimated",
  "unknown",
]);

export const decodeRepairSchema = z
  .object({
    path: z.string().min(1),
    action: z.string().min(1),
    from: z.unknown().optional(),
    to: z.unknown().optional(),
    detail: z.string().min(1).optional(),
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
    targetTrialsPerMonth: z.string().min(1).optional(),
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
    provenance: z
      .object({
        pricingModel: researchProvenanceSchema.optional(),
        conversionPath: researchProvenanceSchema.optional(),
        acv: researchProvenanceSchema.optional(),
        pricingTiers: researchProvenanceSchema.optional(),
        targetPlan: researchProvenanceSchema.optional(),
        avgLtv: researchProvenanceSchema.optional(),
        targetCac: researchProvenanceSchema.optional(),
        targetTrialsPerMonth: researchProvenanceSchema.optional(),
        monthlyAdBudget: researchProvenanceSchema.optional(),
        budgetSplit: researchProvenanceSchema.optional(),
        currentCac: researchProvenanceSchema.optional(),
        monthlyRevenue: researchProvenanceSchema.optional(),
        avgSalesCycle: researchProvenanceSchema.optional(),
        visitorToSignup: researchProvenanceSchema.optional(),
        signupToActivation: researchProvenanceSchema.optional(),
        activationToPaid: researchProvenanceSchema.optional(),
        demoToClose: researchProvenanceSchema.optional(),
        growthTrend: researchProvenanceSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// Operator-supplied customer voice fields (highest provenance).
// These are explicit answers the operator typed in the onboarding brief —
// NOT scraped or inferred. Sections must use them as ground truth.
export const voiceOfClientSchema = z
  .object({
    buyingTriggers: z.string().describe("What triggers a prospect to start looking").optional(),
    commonObjections: z.string().describe("Objections that kill deals").optional(),
    competitorFrustrations: z.string().describe("What buyers hate about competitors").optional(),
    situationBeforeBuying: z.string().describe("Buyer's before-state / pain context").optional(),
    desiredTransformation: z.string().describe("Buyer's desired after-state").optional(),
    easiestToClose: z.string().describe("Which buyer profile closes fastest").optional(),
    bestClientSources: z.string().describe("Where best clients come from").optional(),
    salesProcessOverview: z.string().describe("How deals are run").optional(),
    salesCycleLength: z.string().describe("Typical sales cycle duration").optional(),
    testimonialQuote: z.string().describe("A real customer quote").optional(),
    marketProblem: z.string().describe("The broad market problem being solved").optional(),
    marketBottlenecks: z.string().describe("What slows down buyers in this market").optional(),
    uniqueEdge: z.string().describe("What makes the product uniquely defensible").optional(),
    valueProp: z.string().describe("Core value proposition statement").optional(),
    guarantees: z.string().describe("Risk-reversals or guarantees offered").optional(),
    jobTitles: z.string().describe("Target job titles for outreach").optional(),
  })
  .strict();

// Operator-supplied asset URLs that should be scraped before any web_search.
export const suppliedAssetUrlsSchema = z
  .object({
    caseStudiesUrl: z.string().url().describe("Case studies page URL").optional(),
    pricingUrl: z.string().url().describe("Pricing page URL").optional(),
    testimonialsUrl: z.string().url().describe("Testimonials page URL").optional(),
    demoUrl: z.string().url().describe("Demo / book-a-demo page URL").optional(),
  })
  .strict();

// Operator-supplied channel signals. Distinct from distributionChannels
// (which is the model's working list); channelSignals captures what the
// operator TOLD us they actually do.
export const channelSignalsSchema = z
  .object({
    currentMarketingActivities: z
      .string()
      .describe("What the operator is currently doing for marketing")
      .optional(),
    bestClientSources: z
      .string()
      .describe("Where best clients actually come from")
      .optional(),
  })
  .strict();

export const onboardingSnapshotSchema = z
  .object({
    primaryGoal: z.string().min(1),
    targetSegments: z.array(z.string().min(1)).min(1),
    keyOffers: z.array(z.string().min(1)).min(1),
    distributionChannels: z.array(z.string().min(1)).min(1),
    // When distributionChannels fell back to the hardcoded default because the
    // operator did not supply any channel data, this flag is set to
    // "model-estimated" so sections know NOT to treat it as operator intent.
    distributionChannelsMeta: z.literal("model-estimated").optional(),
    constraints: z.array(z.string().min(1)),
    notes: z.string().min(1),
    salesProcessDocs: z.array(salesProcessDocRefSchema).max(4).optional(),
    salesLoomUrl: z.string().url().optional(),
    gtmMotion: z.enum(["SLG", "PLG"]).optional(),
    creativeCapacity: z.enum(["lean", "standard", "high"]).optional(),
    leadListAvailable: z.boolean().optional(),
    economics: onboardingEconomicsSchema.optional(),
    // GAP 1: operator voice (highest provenance — never inferred)
    voiceOfClient: voiceOfClientSchema.optional(),
    // GAP 4: channel signals (what the operator actually does)
    channelSignals: channelSignalsSchema.optional(),
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
      kind: z.literal("numericAttribution"),
      value: z.string().min(1),
      raw: z.string().min(1),
      assertedSourceUrl: z.string().min(1).optional(),
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
      kind: z.literal("quoteAttribution"),
      value: z.string().min(1),
      raw: z.string().min(1),
      assertedSource: z.string().min(1),
      assertedSourceUrl: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("sourceAttribution"),
      value: z.string().min(1),
      raw: z.string().min(1),
      assertedSourceUrl: z.string().min(1),
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
    tier: z.enum(["verified", "needs_review", "insufficient", "unavailable"]),
    tierRationale: z.string().min(1),
    removedItems: z.array(z.string().min(1)),
    clientQuestions: z.array(z.string().min(1)),
    errorDiagnostics: z
      .object({
        name: z.string().min(1).optional(),
        message: z.string().min(1),
        cause: z.string().min(1).optional(),
        statusCode: z.number().int().positive().optional(),
        responseBody: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
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
            provenance: researchProvenanceSchema.optional(),
          })
          .strict(),
      )
      .optional(),
    committedPositioningArtifacts: z.record(z.string(), z.unknown()).optional(),
    committedPositioningSectionMarkdown: z
      .record(z.string(), z.string())
      .optional(),
    chatRefinement: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe(
        "Operator-supplied refinement for a rerun. Rendered as a binding USER REFINEMENT block in section instructions.",
      )
      .optional(),
    // ARI: research-evidence readiness, passed to paid-media as a COVERAGE
    // annotation (never a gate). When ready=false the plan reasons over the
    // listed thin sections with caution, and the artifact is degraded to
    // needs_review at commit time.
    evidenceCoverage: z
      .object({
        ready: z.boolean(),
        blockedSections: z
          .array(
            z
              .object({
                zone: z.string(),
                reasons: z.array(z.string()),
              })
              .strict(),
          )
          .default([]),
        reasons: z.array(z.string()).default([]),
      })
      .strict()
      .optional(),
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
    // GAP 3: operator-supplied asset URLs that should be scraped before web_search
    suppliedAssetUrls: suppliedAssetUrlsSchema.optional(),
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
    decodeRepairs: z.array(decodeRepairSchema).optional(),
    needs_review: z.boolean().optional(),
    verifierSummary: z.record(z.string(), z.unknown()).optional(),
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
export type VoiceOfClient = z.infer<typeof voiceOfClientSchema>;
export type SuppliedAssetUrls = z.infer<typeof suppliedAssetUrlsSchema>;
export type ChannelSignals = z.infer<typeof channelSignalsSchema>;
export type CorpusExcerpt = z.infer<typeof corpusExcerptSchema>;
export type CorpusSnapshot = z.infer<typeof corpusSnapshotSchema>;
export type ResearchProvenance = z.infer<typeof researchProvenanceSchema>;
export type ResearchInput = z.infer<typeof researchInputSchema>;
export type VerificationReportEnvelope = z.infer<typeof verificationReportSchema>;
export type SectionReviewResult = z.infer<typeof sectionReviewResultSchema>;
export type ArtifactEnvelope = z.infer<typeof artifactEnvelopeSchema>;
export type DecodeRepair = z.infer<typeof decodeRepairSchema>;
export type SectionRunRecord = z.infer<typeof sectionRunRecordSchema>;
export type RunRecordStatus = z.infer<typeof runRecordStatusSchema>;
export type RunRecordSource = z.infer<typeof runRecordSourceSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
