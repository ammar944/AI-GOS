import type { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifacts/artifact-envelope";
import {
  buyerICPBodySchema,
  buyerICPSectionOutputSchema,
  validateBuyerICPMinimums,
  type BuyerICPBody,
  type BuyerICPSectionOutput,
} from "../artifacts/schemas/buyer-icp";
import {
  competitorLandscapeBodySchema,
  competitorLandscapeSectionOutputSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeBody,
  type CompetitorLandscapeSectionOutput,
} from "../artifacts/schemas/competitor-landscape";
import {
  demandIntentBodySchema,
  demandIntentSectionOutputSchema,
  validateDemandIntentMinimums,
  type DemandIntentBody,
  type DemandIntentSectionOutput,
} from "../artifacts/schemas/demand-intent";
import {
  marketCategoryBodySchema,
  marketCategorySectionOutputSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryBody,
  type MarketCategorySectionOutput,
  type ValidationResult,
} from "../artifacts/schemas/market-category";
import {
  offerDiagnosticBodySchema,
  offerDiagnosticSectionOutputSchema,
  validateOfferDiagnosticMinimums,
  type OfferDiagnosticBody,
  type OfferDiagnosticSectionOutput,
} from "../artifacts/schemas/offer-diagnostic";
import {
  paidMediaPlanBodySchema,
  paidMediaPlanSectionOutputSchema,
  validatePaidMediaPlanMinimums,
  type PaidMediaPlanBody,
  type PaidMediaPlanSectionOutput,
} from "../artifacts/schemas/paid-media-plan";
import {
  validateVoiceOfCustomerMinimums,
  voiceOfCustomerBodySchema,
  voiceOfCustomerSectionOutputSchema,
  type VoiceOfCustomerBody,
  type VoiceOfCustomerSectionOutput,
} from "../artifacts/schemas/voice-of-customer";
import { buyerICPFixtureArtifact } from "../fixtures/buyer-icp-artifact";
import { competitorLandscapeFixtureArtifact } from "../fixtures/competitor-landscape-artifact";
import { demandIntentFixtureArtifact } from "../fixtures/demand-intent-artifact";
import { marketCategoryFixtureArtifact } from "../fixtures/market-category-artifact";
import { offerDiagnosticFixtureArtifact } from "../fixtures/offer-diagnostic-artifact";
import { paidMediaPlanFixtureArtifact } from "../fixtures/paid-media-plan-artifact";
import { voiceOfCustomerFixtureArtifact } from "../fixtures/voice-of-customer-artifact";
import {
  sectionIdSchema,
  type SectionId,
} from "../events/activity-event";
import type { ToolName } from "../agents/tools/index";

export interface SectionModelSource {
  title: string;
  url: string;
  publisher?: string;
}

export interface SectionOutput<TBody> {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sources: SectionModelSource[];
  body: TBody;
}

export interface SectionDefinition<TBody, TOutput extends SectionOutput<TBody>> {
  id: SectionId;
  title: string;
  skillSlug: string;
  mission: string;
  outputEmphasis: readonly string[];
  sectionOutputSchemaName: string;
  structuredOutputMaxTokens?: number;
  allowedTools: readonly ToolName[];
  maxExternalLookups: number;
  bodySchema: z.ZodType<TBody>;
  sectionOutputSchema: z.ZodType<TOutput>;
  validateMinimums: (
    artifact: ArtifactEnvelope & { body: TBody },
  ) => ValidationResult;
  fixtureArtifact: ArtifactEnvelope & { body: TBody };
}

export const SECTION_REGISTRY = {
  positioningMarketCategory: {
    id: "positioningMarketCategory",
    title: "Market & Category Intelligence",
    skillSlug: "positioning-market-category",
    mission:
      "Define the market category, the adjacent categories buyers confuse it with, market size and trajectory signals, structural forces moving the market, category maturity with evidence, and 1-3 strategic white-space openings a paid-media-led entrant can exploit in the next six months.",
    outputEmphasis: [
      "category definition",
      "market size + trajectory",
      "structural forces",
      "category maturity",
      "strategic openings",
    ],
    sectionOutputSchemaName: "MarketCategorySectionOutput",
    allowedTools: ["web_search", "firecrawl"],
    maxExternalLookups: 4,
    bodySchema: marketCategoryBodySchema,
    sectionOutputSchema: marketCategorySectionOutputSchema,
    validateMinimums: validateMarketCategoryMinimums,
    fixtureArtifact: marketCategoryFixtureArtifact,
  },
  positioningCompetitorLandscape: {
    id: "positioningCompetitorLandscape",
    title: "Competitor Landscape & Positioning",
    skillSlug: "positioning-competitor-landscape",
    mission:
      "Map 3-7 direct competitors with positioning, pricing, proof, and documented weaknesses; 1-3 adjacent solutions; a 2-axis positioning map with empty quadrants identified; 1-3 differentiation moves a media buyer can write ad copy from; and the proof-asset gaps that need closing.",
    outputEmphasis: [
      "direct competitor set",
      "adjacent solutions",
      "positioning map",
      "differentiation moves",
      "proof gaps",
    ],
    sectionOutputSchemaName: "CompetitorLandscapeSectionOutput",
    structuredOutputMaxTokens: 8192,
    allowedTools: [
      "web_search",
      "firecrawl",
      "adlibrary",
      "google_ads",
      "meta_ads",
      "reviews",
    ],
    maxExternalLookups: 6,
    bodySchema: competitorLandscapeBodySchema,
    sectionOutputSchema: competitorLandscapeSectionOutputSchema,
    validateMinimums: validateCompetitorLandscapeMinimums,
    fixtureArtifact: competitorLandscapeFixtureArtifact,
  },
  positioningBuyerICP: {
    id: "positioningBuyerICP",
    title: "Buyer & ICP Validation",
    skillSlug: "positioning-buyer-icp",
    mission:
      "Pin down the validated ICP firmographics + role-graph, the jobs-to-be-done, top 3-5 pains in real buyer language with triggers, top objections + risk-reversal assets, and qualification filters a media buyer can use in targeting. Disqualify wrong-fit buyers explicitly.",
    outputEmphasis: [
      "validated ICP",
      "jobs-to-be-done",
      "pains + triggers",
      "objections + risk reversal",
      "qualification filters",
    ],
    sectionOutputSchemaName: "BuyerICPSectionOutput",
    allowedTools: ["web_search", "firecrawl"],
    maxExternalLookups: 4,
    bodySchema: buyerICPBodySchema,
    sectionOutputSchema: buyerICPSectionOutputSchema,
    validateMinimums: validateBuyerICPMinimums,
    fixtureArtifact: buyerICPFixtureArtifact,
  },
  positioningVoiceOfCustomer: {
    id: "positioningVoiceOfCustomer",
    title: "Voice of Customer & Objection Evidence",
    skillSlug: "positioning-voice-of-customer",
    mission:
      "Surface verbatim buyer language patterns for pain, solution, and switching motions; the top 5-8 objections with verbatim quotes and the proof that defuses each; and the trust signals buyers weight most.",
    outputEmphasis: [
      "pain language",
      "solution language",
      "switching language",
      "objection bank",
      "trust signals",
    ],
    sectionOutputSchemaName: "VoiceOfCustomerSectionOutput",
    allowedTools: ["web_search", "reviews", "firecrawl"],
    maxExternalLookups: 5,
    bodySchema: voiceOfCustomerBodySchema,
    sectionOutputSchema: voiceOfCustomerSectionOutputSchema,
    validateMinimums: validateVoiceOfCustomerMinimums,
    fixtureArtifact: voiceOfCustomerFixtureArtifact,
  },
  positioningDemandIntent: {
    id: "positioningDemandIntent",
    title: "Demand & Intent Signals",
    skillSlug: "positioning-demand-intent",
    mission:
      "Map 4-7 intent clusters across the funnel, problem-aware queries buyers use before knowing the category, comparison patterns, paid-search ad-copy angles, and content gaps with documented demand.",
    outputEmphasis: [
      "intent clusters",
      "problem-aware queries",
      "comparison queries",
      "paid-search angles",
      "content gaps",
    ],
    sectionOutputSchemaName: "DemandIntentSectionOutput",
    allowedTools: ["web_search", "keyword_ad_probe", "firecrawl"],
    maxExternalLookups: 5,
    bodySchema: demandIntentBodySchema,
    sectionOutputSchema: demandIntentSectionOutputSchema,
    validateMinimums: validateDemandIntentMinimums,
    fixtureArtifact: demandIntentFixtureArtifact,
  },
  positioningOfferDiagnostic: {
    id: "positioningOfferDiagnostic",
    title: "Offer & Performance Diagnostic",
    skillSlug: "positioning-offer-diagnostic",
    mission:
      "Diagnose whether the offer is the paid-media bottleneck: audit offer-market fit, funnel breaks, channel truth, retention health, and red flags with source-backed evidence.",
    outputEmphasis: [
      "offer summary",
      "value equation diagnostic",
      "conversion-path audit",
      "proof gaps",
      "offer moves",
    ],
    sectionOutputSchemaName: "OfferDiagnosticSectionOutput",
    allowedTools: ["web_search", "firecrawl", "pagespeed"],
    maxExternalLookups: 4,
    bodySchema: offerDiagnosticBodySchema,
    sectionOutputSchema: offerDiagnosticSectionOutputSchema,
    validateMinimums: validateOfferDiagnosticMinimums,
    fixtureArtifact: offerDiagnosticFixtureArtifact,
  },
  positioningPaidMediaPlan: {
    id: "positioningPaidMediaPlan",
    title: "Paid Media Plan",
    skillSlug: "positioning-paid-media-plan",
    mission:
      "Synthesize the six committed positioning artifacts and frozen GTM brief into a paid-media plan with a templated campaign spine, evidence-backed angles, filled creative framework, funnel guidance, sales-process assets, channel suggestions, and KPI plan.",
    outputEmphasis: [
      "campaign overview",
      "audiences and creative strategy",
      "angles with copy",
      "competitor review and marketing insights",
      "funnel and channel suggestions",
      "KPIs",
    ],
    sectionOutputSchemaName: "PaidMediaPlanSectionOutput",
    structuredOutputMaxTokens: 8192,
    allowedTools: ["keyword_ad_probe"],
    maxExternalLookups: 2,
    bodySchema: paidMediaPlanBodySchema,
    sectionOutputSchema: paidMediaPlanSectionOutputSchema,
    validateMinimums: validatePaidMediaPlanMinimums,
    fixtureArtifact: paidMediaPlanFixtureArtifact,
  },
} as const satisfies {
  positioningMarketCategory: SectionDefinition<
    MarketCategoryBody,
    MarketCategorySectionOutput
  >;
  positioningCompetitorLandscape: SectionDefinition<
    CompetitorLandscapeBody,
    CompetitorLandscapeSectionOutput
  >;
  positioningBuyerICP: SectionDefinition<BuyerICPBody, BuyerICPSectionOutput>;
  positioningVoiceOfCustomer: SectionDefinition<
    VoiceOfCustomerBody,
    VoiceOfCustomerSectionOutput
  >;
  positioningDemandIntent: SectionDefinition<
    DemandIntentBody,
    DemandIntentSectionOutput
  >;
  positioningOfferDiagnostic: SectionDefinition<
    OfferDiagnosticBody,
    OfferDiagnosticSectionOutput
  >;
  positioningPaidMediaPlan: SectionDefinition<
    PaidMediaPlanBody,
    PaidMediaPlanSectionOutput
  >;
};

export type SupportedSectionId = keyof typeof SECTION_REGISTRY;

export function getSection<TId extends SupportedSectionId>(
  id: TId,
): (typeof SECTION_REGISTRY)[TId] {
  return SECTION_REGISTRY[id];
}

export function isSupportedSectionId(
  value: unknown,
): value is SupportedSectionId {
  return (
    sectionIdSchema.safeParse(value).success &&
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SECTION_REGISTRY, value)
  );
}

export class SectionArtifactValidationError extends Error {
  public readonly errors: string[];
  public readonly sectionId: string;

  public constructor(sectionId: string, errors: readonly string[]) {
    super(
      `Artifact for section ${sectionId} failed persistence validation: ${errors.join("; ")}`,
    );
    this.name = "SectionArtifactValidationError";
    this.sectionId = sectionId;
    this.errors = [...errors];
  }
}

interface PersistableSectionDefinition {
  bodySchema: z.ZodType<Record<string, unknown>>;
  validateMinimums: (
    artifact: ArtifactEnvelope & { body: Record<string, unknown> },
  ) => ValidationResult;
}

function formatZodIssuePath(path: readonly (string | number | symbol)[]): string {
  if (path.length === 0) {
    return "artifact";
  }

  return path.map((part) => String(part)).join(".");
}

function getPersistableSectionDefinition(
  sectionId: SupportedSectionId,
): PersistableSectionDefinition {
  return SECTION_REGISTRY[
    sectionId
  ] as unknown as PersistableSectionDefinition;
}

export function assertSectionArtifactPersistable(
  artifact: ArtifactEnvelope,
): void {
  const envelopeResult = artifactEnvelopeSchema.safeParse(artifact);

  if (!envelopeResult.success) {
    throw new SectionArtifactValidationError(
      "unknown",
      envelopeResult.error.issues.map(
        (issue) => `${formatZodIssuePath(issue.path)}: ${issue.message}`,
      ),
    );
  }

  if (!isSupportedSectionId(envelopeResult.data.sectionId)) {
    throw new SectionArtifactValidationError(envelopeResult.data.sectionId, [
      `Unsupported sectionId ${envelopeResult.data.sectionId}`,
    ]);
  }

  const definition = getPersistableSectionDefinition(
    envelopeResult.data.sectionId,
  );
  const bodyResult = definition.bodySchema.safeParse(envelopeResult.data.body);

  if (!bodyResult.success) {
    throw new SectionArtifactValidationError(
      envelopeResult.data.sectionId,
      bodyResult.error.issues.map(
        (issue) => `body.${formatZodIssuePath(issue.path)}: ${issue.message}`,
      ),
    );
  }

  const minimums = definition.validateMinimums({
    ...envelopeResult.data,
    body: bodyResult.data,
  });

  if (!minimums.ok) {
    throw new SectionArtifactValidationError(
      envelopeResult.data.sectionId,
      minimums.errors,
    );
  }
}
