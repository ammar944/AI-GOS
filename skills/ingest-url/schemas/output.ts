import { z } from "zod";

export const gtmBriefFieldKeys = [
  "companyName",
  "companyUrl",
  "category",
  "market",
  "industryVertical",
  "geography",
  "hqLocation",
  "productDescription",
  "targetCustomer",
  "coreDeliverables",
  "useCases",
  "corePromise",
  "firstValueMoment",
  "activationEvent",
  "retentionDrivers",
  "cta",
  "packaging",
  "pricingModel",
  "pricingTiers",
  "targetPlan",
  "primaryIcpDescription",
  "icpSegment",
  "jobTitles",
  "icpRoles",
  "companySize",
  "buyingCommittee",
  "buyingTriggers",
  "icpPains",
  "icpTriggers",
  "currentAlternative",
  "awarenessLevel",
  "icpObjections",
  "salesMotion",
  "gtmMotion",
  "conversionPath",
  "landingPages",
  "salesHandoff",
  "lifecycleConstraints",
  "avgAcv",
  "acv",
  "avgCustomerLtv",
  "ltv",
  "targetCac",
  "cacTarget",
  "monthlyAdBudget",
  "monthlyBudget",
  "currentCac",
  "monthlyRevenue",
  "salesCycleLength",
  "salesCycle",
  "marginAssumptions",
  "topCompetitors",
  "knownCompetitors",
  "alternatives",
  "uniqueEdge",
  "categoryFrames",
  "differentiation",
  "lossReasons",
  "competitorStrengths",
  "testimonials",
  "caseStudies",
  "logos",
  "metrics",
  "claims",
  "styleReferences",
  "brandPositioning",
  "tone",
  "forbiddenClaims",
  "compliance",
  "brandGeography",
  "timeline",
  "goals",
  "pipelineTarget",
  "campaignObjective",
  "expectedOutput",
  "targetMarket",
  "launchUrgency",
  "commonObjections",
  "keyPromises",
  "channels",
  "channelBudgetSplit",
  "whatIsWorking",
  "whatIsNotWorking",
  "visitorToSignupPct",
  "signupToActivationPct",
  "activationToPaidPct",
  "demoToCloseRate",
  "last3to6MoGrowthTrend",
] as const;

const placeholderPattern = /^(unknown|tbd|n\/a|na|not found|scaffold)$/i;

function rejectPlaceholder(value: string, context: z.RefinementCtx): void {
  if (placeholderPattern.test(value.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Placeholder value is not allowed: ${value}`,
    });
  }
}

export const sourcedClaimSchema = z
  .object({
    value: z.string().min(1).superRefine(rejectPlaceholder),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const prefilledFieldSchema = z
  .object({
    field_key: z.enum(gtmBriefFieldKeys),
    label: z.string().min(1).superRefine(rejectPlaceholder),
    value: z.string().min(1).superRefine(rejectPlaceholder),
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(sourcedClaimSchema).min(1),
    reason: z.string().min(1).superRefine(rejectPlaceholder),
  })
  .strict();

export const discoveredPageSchema = z
  .object({
    url: z.string().url(),
    page_type: z.enum([
      "homepage",
      "pricing",
      "product",
      "customers",
      "case_study",
      "about",
      "demo",
      "other",
    ]),
    title: sourcedClaimSchema.optional(),
    excerpt: sourcedClaimSchema.optional(),
  })
  .strict();

export const ingestUrlOutputSchema = z
  .object({
    run_id: z.string().min(1).superRefine(rejectPlaceholder),
    stage: z.literal("discover-url"),
    input_url: z.string().url(),
    canonical_url: sourcedClaimSchema,
    company_name: sourcedClaimSchema,
    discovered_pages: z.array(discoveredPageSchema),
    prefilled_fields: z.array(prefilledFieldSchema),
    unresolved_fields: z.array(z.string().min(1).superRefine(rejectPlaceholder)),
    generated_at: z.string().datetime(),
  })
  .strict();

export type GtmBriefFieldKey = (typeof gtmBriefFieldKeys)[number];
export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;
export type PrefilledField = z.infer<typeof prefilledFieldSchema>;
export type IngestUrlOutput = z.infer<typeof ingestUrlOutputSchema>;
