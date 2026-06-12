import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import { getRegistrableDomain } from "../../domain-utils";
import {
  VOC_MIN_DOMAINS,
  VOC_MIN_TOP_LEVEL_SOURCES,
} from "../voice-of-customer-floors";
import type { ValidationResult } from "./market-category";
import {
  evidenceBlockGapFieldSchema,
  evidenceBlockGapSchema,
  fourForcesBalanceVerdictSchema,
  keyFindingsSchema,
  strategicInsightSchema,
  validateStrategicInsightMinimums,
  validateStrategicText,
} from "./strategic-insight";

const vocSourceTypes = [
  "g2",
  "capterra",
  "trustpilot",
  "trustradius",
  "reddit",
  "hackernews",
  "sales-call",
  "support-thread",
  "twitter",
  "other",
] as const;
const painIntensities = ["high", "medium", "low"] as const;
const objectionCategories = [
  "price",
  "feature",
  "trust",
  "switching-cost",
  "timing",
  "stakeholder",
  "other",
] as const;
const frequencies = ["recurring", "occasional", "one-off"] as const;
const decisionRoles = ["buyer", "champion", "influencer", "blocker"] as const;

const painQuoteSchema = z
  .object({
    verbatimText: z.string().min(1),
    source: z.enum(vocSourceTypes),
    sourceUrl: z.string().min(1),
    painTheme: z.string().min(1),
    painIntensity: z.enum(painIntensities),
    role: z
      .string()
      .min(1)
      .nullable()
      .transform((value) => value ?? undefined)
      .optional()
      .describe(
        "Reviewer/poster role or handle, where the source discloses it.",
      ),
    date: z
      .string()
      .min(1)
      .nullable()
      .transform((value) => value ?? undefined)
      .optional()
      .describe("Date the quote was posted/observed, where disclosed."),
  })
  .strict();

const objectionSchema = z
  .object({
    objectionText: z.string().min(1),
    category: z.enum(objectionCategories),
    frequency: z.enum(frequencies),
    howToHandle: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const switchingStorySchema = z
  .object({
    priorSolution: z.string().min(1),
    reasonToLeave: z.string().min(1),
    decisionPath: z.string().min(1),
    exampleCompany: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    sourceUrl: z.string().min(1),
  })
  .strict();

const decisionCriterionSchema = z
  .object({
    criterion: z.string().min(1),
    statedBy: z.enum(decisionRoles),
    evidenceQuote: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const successQuoteSchema = z
  .object({
    verbatimText: z.string().min(1),
    source: z.enum(vocSourceTypes),
    sourceUrl: z.string().min(1),
    afterStatePattern: z.string().min(1),
  })
  .strict();

const evidenceGapReportSchema = z
  .object({
    reason: z.literal("insufficient_voice_of_customer_sources"),
    summary: z.string().min(1),
    foundPainQuoteCount: z.number().int().nonnegative(),
    requiredPainQuoteCount: z.number().int().positive(),
    foundDistinctPainSourceCount: z.number().int().nonnegative(),
    requiredDistinctPainSourceCount: z.number().int().positive(),
    observedPainSourceDomains: z.array(z.string().min(1)),
    acquisitionAttempts: z
      .array(
        z
          .object({
            url: z.string().min(1),
            domain: z.string().min(1),
            source: z.string().min(1),
            acquisitionMode: z.enum([
              "review_body",
              "forum_comment",
              "support_thread",
            ]),
            status: z.enum(["succeeded", "failed"]),
            gapReason: z
              .enum([
                "api_error",
                "blocked_js_challenge",
                "empty_markdown",
                "parser_no_match",
                "not_independent",
                "not_product_review",
              ])
              .optional(),
            message: z.string().min(1).optional(),
            title: z.string().min(1).optional(),
          })
          .strict(),
      )
      .optional(),
    acquisitionLedger: z
      .array(
        z
          .object({
            sourceUrl: z.string().min(1),
            domain: z.string().min(1),
            query: z.string().min(1),
            source: z.string().min(1),
            acquisitionMode: z.enum([
              "review_body",
              "forum_comment",
              "support_thread",
            ]),
            evidenceKind: z.enum([
              "review",
              "forum",
              "support-thread",
              "article",
            ]),
            scrapeStatus: z.enum(["succeeded", "failed", "not_attempted"]),
            parserStatus: z.enum(["succeeded", "failed", "not_attempted"]),
            candidateText: z.string().min(1).optional(),
            promotionStatus: z.enum([
              "promoted",
              "rejected",
              "not_applicable",
            ]),
            rejectionReason: z
              .enum([
                "api_error",
                "blocked_js_challenge",
                "empty_markdown",
                "parser_no_match",
                "not_independent",
                "not_product_review",
                "insufficient_candidates",
                "insufficient_independent_domains",
                "no_review_or_forum_surfaces",
                "not_selected",
              ])
              .optional(),
            toolGapReason: z
              .enum([
                "api_error",
                "blocked_js_challenge",
                "empty_markdown",
                "parser_no_match",
                "not_independent",
                "not_product_review",
              ])
              .optional(),
            observedAt: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    sourcingPlan: z.array(z.string().min(1)).min(1),
  })
  .strict();

const blockGapFieldSchema = evidenceBlockGapFieldSchema;

export const voiceOfCustomerBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.nullable().transform((value) => value ?? undefined).optional(),
    retrievalSummary: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    strategicInsight: strategicInsightSchema,
    fourForcesBalanceVerdict: fourForcesBalanceVerdictSchema,
    painLanguage: z
      .object({
        prose: z.string().min(1),
        quotes: z.array(painQuoteSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    objections: z
      .object({
        prose: z.string().min(1),
        items: z.array(objectionSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    switchingStories: z
      .object({
        prose: z.string().min(1),
        stories: z.array(switchingStorySchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    decisionCriteria: z
      .object({
        prose: z.string().min(1),
        criteria: z.array(decisionCriterionSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    successLanguage: z
      .object({
        prose: z.string().min(1),
        quotes: z.array(successQuoteSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    evidenceGap: z.literal(true).optional(),
    evidenceGapReport: evidenceGapReportSchema.optional(),
  })
  .strict();

export type VoiceOfCustomerBlockGap = z.infer<typeof evidenceBlockGapSchema>;

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

export const voiceOfCustomerSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: voiceOfCustomerBodySchema,
  })
  .strict();

export type VoiceOfCustomerBody = z.infer<typeof voiceOfCustomerBodySchema>;
export type VoiceOfCustomerSectionOutput = z.infer<
  typeof voiceOfCustomerSectionOutputSchema
>;
export type VoiceOfCustomerArtifact = ArtifactEnvelope & {
  body: VoiceOfCustomerBody;
};
export type VoiceOfCustomerEvidenceGapReport = z.infer<
  typeof evidenceGapReportSchema
>;
export type VoiceOfCustomerEvidenceGapClassification =
  | {
      ok: true;
      foundPainQuoteCount: number;
      foundDistinctPainSourceCount: number;
      observedPainSourceDomains: string[];
    }
  | {
      ok: false;
      reason:
        | "not_acquisition_insufficiency"
        | "provenance_violation"
        | "structural_corruption";
      errors: string[];
    };

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

function getSourceKey(sourceUrl: string, fallback: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

function getOrderedUniqueSourceKeys(
  quotes: readonly { source: string; sourceUrl: string }[],
): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const quote of quotes) {
    const key = getSourceKey(quote.sourceUrl, quote.source);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    keys.push(key);
  }

  return keys;
}

function isVoiceOfCustomerAcquisitionError(error: string): boolean {
  // Floor numbers are matched as \d+ so these patterns track the shared
  // floors in voice-of-customer-floors.ts without re-pinning the values.
  return (
    /^sources: have \d+, need >=\d+\.$/.test(error) ||
    /^body\.painLanguage\.quotes: have \d+, need >=\d+\.$/.test(error) ||
    /^body\.painLanguage\.quotes: need >=\d+ distinct sources, have \d+\.$/.test(
      error,
    ) ||
    /^body\.painLanguage\.quotes\[\d+\]: sourced from the subject company's own domain \([^)]+\); pain language must come from independent sources, not the audited company's site\.$/.test(
      error,
    ) ||
    /^body\.painLanguage\.quotes: source .+ supplies \d+ of \d+ pain quotes \(a single-source majority\); draw pain language from multiple independent sources\.$/.test(
      error,
    )
  );
}

export function classifyVoiceOfCustomerEvidenceGap({
  artifact,
  errors,
  subjectDomain,
}: {
  artifact: unknown;
  errors: readonly string[];
  subjectDomain: string;
}): VoiceOfCustomerEvidenceGapClassification {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .safeParse(artifact);

  if (!parsedArtifact.success) {
    return {
      ok: false,
      reason: "structural_corruption",
      errors: parsedArtifact.error.issues.map((issue) => issue.message),
    };
  }

  if (
    errors.length === 0 ||
    !errors.every((error) => isVoiceOfCustomerAcquisitionError(error))
  ) {
    return {
      ok: false,
      reason: "not_acquisition_insufficiency",
      errors: [...errors],
    };
  }

  const painQuotes = parsedArtifact.data.body.painLanguage.quotes;
  const observedPainSourceDomains = getOrderedUniqueSourceKeys(painQuotes);

  return {
    ok: true,
    foundPainQuoteCount: painQuotes.length,
    foundDistinctPainSourceCount: observedPainSourceDomains.length,
    observedPainSourceDomains,
  };
}

export function validateVoiceOfCustomerMinimums(
  artifact: ArtifactEnvelope & { body: VoiceOfCustomerBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );
  validateStrategicText(
    errors,
    "body.fourForcesBalanceVerdict.push",
    parsedArtifact.body.fourForcesBalanceVerdict.push,
  );
  validateStrategicText(
    errors,
    "body.fourForcesBalanceVerdict.pull",
    parsedArtifact.body.fourForcesBalanceVerdict.pull,
  );
  validateStrategicText(
    errors,
    "body.fourForcesBalanceVerdict.anxiety",
    parsedArtifact.body.fourForcesBalanceVerdict.anxiety,
  );
  validateStrategicText(
    errors,
    "body.fourForcesBalanceVerdict.habit",
    parsedArtifact.body.fourForcesBalanceVerdict.habit,
  );
  validateStrategicText(
    errors,
    "body.fourForcesBalanceVerdict.balanceVerdict",
    parsedArtifact.body.fourForcesBalanceVerdict.balanceVerdict,
  );

  const allQuoteBlocksGapped =
    parsedArtifact.body.painLanguage.quotes.length === 0 &&
    hasBlockGap(parsedArtifact.body.painLanguage) &&
    parsedArtifact.body.objections.items.length === 0 &&
    hasBlockGap(parsedArtifact.body.objections) &&
    parsedArtifact.body.switchingStories.stories.length === 0 &&
    hasBlockGap(parsedArtifact.body.switchingStories) &&
    parsedArtifact.body.decisionCriteria.criteria.length === 0 &&
    hasBlockGap(parsedArtifact.body.decisionCriteria) &&
    parsedArtifact.body.successLanguage.quotes.length === 0 &&
    hasBlockGap(parsedArtifact.body.successLanguage);
  const hasRetrievalSummary =
    parsedArtifact.body.retrievalSummary !== undefined &&
    parsedArtifact.body.retrievalSummary.trim().length > 0;

  if (
    parsedArtifact.sources.length < VOC_MIN_TOP_LEVEL_SOURCES &&
    !(allQuoteBlocksGapped && hasRetrievalSummary)
  ) {
    errors.push(
      `sources: have ${parsedArtifact.sources.length}, need >=${VOC_MIN_TOP_LEVEL_SOURCES}.`,
    );
  }

  const painQuotes = parsedArtifact.body.painLanguage.quotes;
  const painSourceCount = uniqueCount(
    painQuotes.map((quote) => getSourceKey(quote.sourceUrl, quote.source)),
  );
  if (
    painQuotes.length > 0 &&
    painSourceCount < VOC_MIN_DOMAINS &&
    !(allQuoteBlocksGapped && hasRetrievalSummary)
  ) {
    errors.push(
      `body.painLanguage.quotes: need >=${VOC_MIN_DOMAINS} distinct sources, have ${painSourceCount}.`,
    );
  }

  if (painQuotes.length === 0 && !hasBlockGap(parsedArtifact.body.painLanguage)) {
    errors.push(
      `body.painLanguage.quotes: have 0; add body.painLanguage.blockGap instead of inventing pain quotes.`,
    );
  }

  if (
    parsedArtifact.body.objections.items.length === 0 &&
    !hasBlockGap(parsedArtifact.body.objections)
  ) {
    errors.push(
      "body.objections.items: have 0; add body.objections.blockGap instead of inventing objections.",
    );
  }

  if (
    parsedArtifact.body.switchingStories.stories.length === 0 &&
    !hasBlockGap(parsedArtifact.body.switchingStories)
  ) {
    errors.push(
      "body.switchingStories.stories: have 0; add body.switchingStories.blockGap instead of inventing switching stories.",
    );
  }

  if (
    parsedArtifact.body.decisionCriteria.criteria.length === 0 &&
    !hasBlockGap(parsedArtifact.body.decisionCriteria)
  ) {
    errors.push(
      "body.decisionCriteria.criteria: have 0; add body.decisionCriteria.blockGap instead of inventing decision criteria.",
    );
  }

  if (
    parsedArtifact.body.successLanguage.quotes.length === 0 &&
    !hasBlockGap(parsedArtifact.body.successLanguage)
  ) {
    errors.push(
      "body.successLanguage.quotes: have 0; add body.successLanguage.blockGap instead of inventing success language.",
    );
  }

  if (allQuoteBlocksGapped && !hasRetrievalSummary) {
    errors.push(
      "body.retrievalSummary: required when every VoC quote-bearing block is gapped.",
    );
  }

  if (
    errors.length > 0 &&
    parsedArtifact.body.evidenceGap === true &&
    parsedArtifact.body.evidenceGapReport !== undefined
  ) {
    return { ok: true, errors: [] };
  }

  return { ok: errors.length === 0, errors };
}

/**
 * VoC-specific provenance gate (returned as a ValidationResult so the runner's
 * repair loop retries on failure). Two rules:
 *   1. No pain quote may be sourced from the subject company's own registrable
 *      domain — the subject's homepage/marketing is not buyer pain language.
 *   2. No single source may supply a majority (> floor(n/2)) of the pain quotes.
 */
export function checkVoiceOfCustomerSelfSourcing({
  artifact,
  subjectDomain,
}: {
  artifact: ArtifactEnvelope;
  subjectDomain: string;
}): ValidationResult {
  const parsed = artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .parse(artifact);
  const errors: string[] = [];
  const quotes = parsed.body.painLanguage.quotes;
  const subjectRegistrable = getRegistrableDomain(subjectDomain);

  if (subjectRegistrable !== null) {
    quotes.forEach((quote, index) => {
      const quoteRegistrable = getRegistrableDomain(quote.sourceUrl);

      if (quoteRegistrable !== null && quoteRegistrable === subjectRegistrable) {
        errors.push(
          `body.painLanguage.quotes[${index}]: sourced from the subject company's own domain (${subjectRegistrable}); pain language must come from independent sources, not the audited company's site.`,
        );
      }
    });
  }

  if (quotes.length > 0) {
    const counts = new Map<string, number>();

    for (const quote of quotes) {
      const key = getRegistrableDomain(quote.sourceUrl) ?? quote.sourceUrl;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const majorityThreshold = Math.floor(quotes.length / 2);

    for (const [host, count] of counts) {
      if (count > majorityThreshold) {
        errors.push(
          `body.painLanguage.quotes: source ${host} supplies ${count} of ${quotes.length} pain quotes (a single-source majority); draw pain language from multiple independent sources.`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
