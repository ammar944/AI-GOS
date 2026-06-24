import {
  researchInputSchema,
  type CorpusExcerpt,
  type OnboardingSnapshot,
  type ResearchProvenance,
  type ResearchInput,
  type SourceRef,
  type VoiceOfClient,
  type ChannelSignals,
  type SuppliedAssetUrls,
} from "../lab-engine/artifacts/artifact-envelope";
import {
  getRegistrableDomain,
  getRegistrableDomainBrandToken,
  isSameRegistrableDomain,
  normalizeBrandToken,
} from "../lab-engine/domain-utils";
import { sectionIds, type SectionId } from "../lab-engine/events/activity-event";
import { cleanAdvertiserQuery } from "../lab-engine/agents/tools/advertiser-match";
import { isNonAnswer } from "./non-answer";
import {
  buildUploadedDocumentSourceUrl,
  trimUploadedDocumentExcerpt,
  type UploadedDocumentContext,
} from "./uploaded-document-context";

export interface CorpusToResearchInputParams {
  runId: string;
  deepResearchProgramData: unknown;
  onboardingData?: unknown;
  uploadedDocuments?: readonly UploadedDocumentContext[];
  now?: () => Date;
}

const defaultCompanyStage = "growth";
const defaultDistributionChannel = "paid-search";
const sectionScopeKeywords = {
  positioningMarketCategory: [
    "category",
    "market",
    "segment",
    "industry",
    "tam",
    "sam",
  ],
  positioningBuyerICP: [
    "icp",
    "persona",
    "buyer",
    "role",
    "title",
    "jtbd",
    "pain",
    "use case",
  ],
  positioningCompetitorLandscape: [
    "competitor",
    "alternative",
    "vs",
    "comparison",
    "pricing",
    "feature",
  ],
  positioningVoiceOfCustomer: [
    "quote",
    "review",
    "testimonial",
    "feedback",
    "complaint",
    "g2",
    "trustpilot",
  ],
  positioningDemandIntent: [
    "search",
    "keyword",
    "serp",
    "demand",
    "volume",
    "intent",
  ],
  positioningOfferDiagnostic: [
    "offer",
    "price",
    "plan",
    "tier",
    "trial",
    "pricing",
    "guarantee",
  ],
  positioningPaidMediaPlan: [
    "campaign",
    "paid",
    "channel",
    "creative",
    "kpi",
    "funnel",
    "audience",
  ],
} as const satisfies Record<SectionId, readonly string[]>;

const topicSectionMap: Partial<Record<string, SectionId>> = {
  buyer_icp: "positioningBuyerICP",
  competitors: "positioningCompetitorLandscape",
  demand_intent: "positioningDemandIntent",
  market_category: "positioningMarketCategory",
  offer_diagnostic: "positioningOfferDiagnostic",
  pricing_packaging: "positioningOfferDiagnostic",
  voice_of_customer: "positioningVoiceOfCustomer",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || isNonAnswer(trimmed)) {
    return null;
  }

  return trimmed;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const stringValue = asString(value);

    if (stringValue !== null) {
      return stringValue;
    }
  }

  return null;
}

function splitStringList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const stringItem = asString(item);
      return stringItem === null ? [] : [stringItem];
    });
  }

  const stringValue = asString(value);
  return stringValue === null ? [] : splitStringList(stringValue);
}

function firstStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    const arrayValue = stringArrayFromUnknown(value);

    if (arrayValue.length > 0) {
      return arrayValue;
    }
  }

  return [];
}

function getValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function getFieldValue(
  onboardingFields: Record<string, unknown>,
  key: string,
): unknown {
  const field = asRecord(onboardingFields[key]);
  return field.value;
}

// GAP 2: returns field value AND preserves sourceUrl/confidence metadata.
function getFieldWithMeta(
  onboardingFields: Record<string, unknown>,
  key: string,
): { value: unknown; sourceUrl: string | null } {
  const field = asRecord(onboardingFields[key]);
  return {
    value: field.value,
    sourceUrl: getValidUrl(field.sourceUrl),
  };
}

// GAP 2: collect sourceUrls from brief fields for injection into sources[].
function collectBriefFieldSourceUrls(
  onboardingFields: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  const urls: string[] = [];
  for (const key of keys) {
    const meta = getFieldWithMeta(onboardingFields, key);
    if (meta.sourceUrl !== null) {
      urls.push(meta.sourceUrl);
    }
  }
  return urls;
}

// GAP 1: build voiceOfClient from onboardingData.
function buildVoiceOfClientFields(
  onboardingData: Record<string, unknown>,
): { voiceOfClient?: VoiceOfClient } {
  const fields: Partial<VoiceOfClient> = {};
  const mapping: Array<[keyof VoiceOfClient, string[]]> = [
    ["buyingTriggers", ["buyingTriggers", "buying_triggers"]],
    ["commonObjections", ["commonObjections", "common_objections"]],
    ["competitorFrustrations", ["competitorFrustrations", "competitor_frustrations"]],
    ["situationBeforeBuying", ["situationBeforeBuying", "situation_before_buying"]],
    ["desiredTransformation", ["desiredTransformation", "desired_transformation"]],
    ["easiestToClose", ["easiestToClose", "easiest_to_close"]],
    ["bestClientSources", ["bestClientSources", "best_client_sources"]],
    ["salesProcessOverview", ["salesProcessOverview", "sales_process_overview"]],
    ["salesCycleLength", ["salesCycleLength", "sales_cycle_length"]],
    ["testimonialQuote", ["testimonialQuote", "testimonial_quote"]],
    ["marketProblem", ["marketProblem", "market_problem"]],
    ["marketBottlenecks", ["marketBottlenecks", "market_bottlenecks"]],
    ["uniqueEdge", ["uniqueEdge", "unique_edge"]],
    ["valueProp", ["valueProp", "value_prop"]],
    ["guarantees", ["guarantees"]],
    ["jobTitles", ["jobTitles", "job_titles"]],
  ];
  for (const [outputKey, inputKeys] of mapping) {
    const value = firstString(...inputKeys.map((k) => getValue(onboardingData, k)));
    if (value !== null) {
      fields[outputKey] = value;
    }
  }
  if (Object.keys(fields).length === 0) return {};
  return { voiceOfClient: fields };
}

// GAP 4: build channelSignals from onboardingData.
function buildChannelSignalsFields(
  onboardingData: Record<string, unknown>,
): { channelSignals?: ChannelSignals } {
  const currentMarketingActivities = firstString(
    getValue(onboardingData, "currentMarketingActivities"),
    getValue(onboardingData, "current_marketing_activities"),
  );
  const bestClientSources = firstString(
    getValue(onboardingData, "bestClientSources"),
    getValue(onboardingData, "best_client_sources"),
  );
  if (currentMarketingActivities === null && bestClientSources === null) return {};
  const signals: ChannelSignals = {};
  if (currentMarketingActivities !== null) signals.currentMarketingActivities = currentMarketingActivities;
  if (bestClientSources !== null) signals.bestClientSources = bestClientSources;
  return { channelSignals: signals };
}

// GAP 3: build suppliedAssetUrls from onboardingData.
function buildSuppliedAssetUrlsFields(
  onboardingData: Record<string, unknown>,
): { suppliedAssetUrls?: SuppliedAssetUrls } {
  const fields: Partial<SuppliedAssetUrls> = {};
  const mapping: Array<[keyof SuppliedAssetUrls, string[]]> = [
    ["caseStudiesUrl", ["caseStudiesUrl", "case_studies_url"]],
    ["pricingUrl", ["pricingUrl", "pricing_url"]],
    ["testimonialsUrl", ["testimonialsUrl", "testimonials_url"]],
    ["demoUrl", ["demoUrl", "demo_url"]],
  ];
  for (const [outputKey, inputKeys] of mapping) {
    const url = getValidUrl(firstString(...inputKeys.map((k) => getValue(onboardingData, k))));
    if (url !== null) {
      fields[outputKey] = url;
    }
  }
  if (Object.keys(fields).length === 0) return {};
  return { suppliedAssetUrls: fields };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return slug.length === 0 ? "unknown" : slug;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getValidUrl(value: unknown): string | null {
  const candidate = asString(value);

  if (candidate === null) {
    return null;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function parseSalesProcessDocs(value: unknown): NonNullable<
  OnboardingSnapshot["salesProcessDocs"]
> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);
    const label = firstString(record.label, record.name, record.title);
    const url = getValidUrl(firstString(record.url, record.href, record.sourceUrl));

    if (label === null || url === null) {
      return [];
    }

    return [{ label, url }];
  }).slice(0, 4);
}

function parseGtmMotion(value: unknown): OnboardingSnapshot["gtmMotion"] {
  const motion = asString(value)?.toUpperCase();

  if (motion === "SLG" || motion === "PLG") {
    return motion;
  }

  if (motion === "SALES_LED" || motion === "SALES-LED") {
    return "SLG";
  }

  if (motion === "PRODUCT_LED" || motion === "PRODUCT-LED") {
    return "PLG";
  }

  return undefined;
}

function parseCreativeCapacity(
  value: unknown,
): OnboardingSnapshot["creativeCapacity"] {
  const capacity = asString(value)?.toLowerCase();

  if (
    capacity === "lean" ||
    capacity === "standard" ||
    capacity === "high"
  ) {
    return capacity;
  }

  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = asString(value)?.toLowerCase();

  if (normalized === "yes" || normalized === "true") {
    return true;
  }

  if (normalized === "no" || normalized === "false") {
    return false;
  }

  return undefined;
}

function buildMediaPlanBriefFields(
  onboardingData: Record<string, unknown>,
): Partial<
  Pick<
    OnboardingSnapshot,
    | "salesProcessDocs"
    | "salesLoomUrl"
    | "gtmMotion"
    | "creativeCapacity"
    | "leadListAvailable"
  >
> {
  const salesProcessDocs = parseSalesProcessDocs(
    getValue(onboardingData, "salesProcessDocs") ??
      getValue(onboardingData, "sales_process_docs"),
  );
  const salesLoomUrl = getValidUrl(
    firstString(
      getValue(onboardingData, "salesLoomUrl"),
      getValue(onboardingData, "sales_loom_url"),
    ),
  );
  const gtmMotion =
    parseGtmMotion(getValue(onboardingData, "gtmMotion")) ??
    parseGtmMotion(getValue(onboardingData, "salesMotion"));
  const creativeCapacity = parseCreativeCapacity(
    getValue(onboardingData, "creativeCapacity") ??
      getValue(onboardingData, "creative_capacity"),
  );
  const leadListAvailable = parseBoolean(
    getValue(onboardingData, "leadListAvailable") ??
      getValue(onboardingData, "lead_list_available"),
  );

  return {
    ...(salesProcessDocs.length === 0 ? {} : { salesProcessDocs }),
    ...(salesLoomUrl === null ? {} : { salesLoomUrl }),
    ...(gtmMotion === undefined ? {} : { gtmMotion }),
    ...(creativeCapacity === undefined ? {} : { creativeCapacity }),
    ...(leadListAvailable === undefined ? {} : { leadListAvailable }),
  };
}

function buildEconomicsBriefFields(
  onboardingData: Record<string, unknown>,
): Partial<Pick<OnboardingSnapshot, "economics">> {
  type EconomicsSnapshot = NonNullable<OnboardingSnapshot["economics"]>;
  type EconomicsFieldKey = Exclude<keyof EconomicsSnapshot, "provenance">;
  const fieldSpecs = [
    ["pricingModel", ["pricingModel", "pricing_model"]],
    ["conversionPath", ["conversionPath", "conversion_path"]],
    ["acv", ["acv"]],
    ["pricingTiers", ["pricingTiers", "pricing_tiers"]],
    ["targetPlan", ["targetPlan", "target_plan"]],
    ["avgLtv", ["avgLtv", "avg_ltv"]],
    ["targetCac", ["targetCac", "target_cac"]],
    ["targetTrialsPerMonth", ["targetTrialsPerMonth", "target_trials_per_month"]],
    ["monthlyAdBudget", ["monthlyAdBudget", "monthly_ad_budget"]],
    ["budgetSplit", ["budgetSplit", "budget_split"]],
    ["currentCac", ["currentCac", "current_cac"]],
    ["monthlyRevenue", ["monthlyRevenue", "monthly_revenue"]],
    ["avgSalesCycle", ["avgSalesCycle", "avg_sales_cycle"]],
    ["visitorToSignup", ["visitorToSignup", "visitor_to_signup"]],
    ["signupToActivation", ["signupToActivation", "signup_to_activation"]],
    ["activationToPaid", ["activationToPaid", "activation_to_paid"]],
    ["demoToClose", ["demoToClose", "demo_to_close"]],
    ["growthTrend", ["growthTrend", "growth_trend"]],
  ] as const satisfies readonly (readonly [
    EconomicsFieldKey,
    readonly string[],
  ])[];
  const economics: Partial<Omit<EconomicsSnapshot, "provenance">> = {};
  const provenance: Partial<Record<EconomicsFieldKey, ResearchProvenance>> = {};

  for (const [outputKey, inputKeys] of fieldSpecs) {
    const value = firstString(
      ...inputKeys.map((inputKey) => getValue(onboardingData, inputKey)),
    );

    if (value !== null) {
      economics[outputKey] = value;
      provenance[outputKey] = "user-supplied";
    }
  }

  return Object.keys(economics).length === 0
    ? {}
    : {
        economics: {
          ...economics,
          provenance,
        },
      };
}

function resolveUrl({
  fallbackUrl,
  field,
  slug,
  value,
}: {
  field: string;
  value: unknown;
  fallbackUrl?: string | null;
  slug: string;
}): string {
  const validUrl = getValidUrl(value);

  if (validUrl !== null) {
    return validUrl;
  }

  if (fallbackUrl !== undefined && fallbackUrl !== null) {
    return fallbackUrl;
  }

  throw new Error(
    `Missing valid URL for ${field}; no corpus source URL was available for ${slug}`,
  );
}

function buildResearchSummary({
  corpus,
  data,
  productDescription,
}: {
  corpus: Record<string, unknown>;
  data: Record<string, unknown>;
  productDescription: string;
}): string {
  return (
    firstString(corpus.researchSummary, data.researchSummary) ??
    productDescription
  );
}

function buildSources({
  companyName,
  evidenceRecords,
  observedAt,
  sourceRecords,
  uploadedDocuments,
  websiteUrl,
  briefFieldSourceUrls,
}: {
  companyName: string;
  evidenceRecords: Record<string, unknown>[];
  observedAt: string;
  sourceRecords: Record<string, unknown>[];
  uploadedDocuments: readonly UploadedDocumentContext[];
  websiteUrl: string;
  // GAP 2: sourceUrls scraped from brief field metadata (user-supplied provenance)
  briefFieldSourceUrls?: readonly string[];
}): SourceRef[] {
  const sourceUrls = new Set<string>();
  const corpusSources = sourceRecords.flatMap((source, index): SourceRef[] => {
    const url = getValidUrl(firstString(source.url, source.sourceUrl));

    if (url === null) {
      return [];
    }

    sourceUrls.add(url);
    const title = firstString(source.title, source.source, source.name) ?? url;
    const publisher = firstString(source.publisher);

    return [
      {
        id: firstString(source.id) ?? `source_${slugify(title)}_${index + 1}`,
        title,
        url,
        ...(publisher === null ? {} : { publisher }),
        observedAt,
      },
    ];
  });
  const evidenceSources = evidenceRecords.flatMap((evidence, index): SourceRef[] => {
    const url = getValidUrl(firstString(evidence.url, evidence.sourceUrl));

    if (url === null || sourceUrls.has(url)) {
      return [];
    }

    sourceUrls.add(url);
    const title = firstString(evidence.source, evidence.title) ?? url;

    return [
      {
        id: `source_${slugify(title)}_evidence_${index + 1}`,
        title,
        url,
        observedAt,
      },
    ];
  });
  // GAP 2: inject brief field sourceUrls as user-supplied SourceRefs
  const briefFieldSources: SourceRef[] = (briefFieldSourceUrls ?? []).flatMap(
    (url, index): SourceRef[] => {
      if (sourceUrls.has(url)) return [];
      sourceUrls.add(url);
      return [
        {
          id: `source_brief_field_${index + 1}`,
          title: `Operator-supplied: ${url}`,
          url,
          publisher: "Operator brief",
          observedAt,
        },
      ];
    },
  );

  const sources = [...corpusSources, ...evidenceSources, ...briefFieldSources];

  const uploadedDocumentSources = uploadedDocuments.map((document, index) => ({
    id: `source_uploaded_${slugify(document.fileName)}_${index + 1}`,
    title: `Uploaded document: ${document.fileName}`,
    url: buildUploadedDocumentSourceUrl(document.id),
    publisher: "User upload",
    observedAt,
  }));

  const baseSources =
    sources.length > 0
      ? sources
      : [
          {
            id: `source_${slugify(companyName)}_website`,
            title: `${companyName} website`,
            url: websiteUrl,
            observedAt,
          },
        ];

  return [...baseSources, ...uploadedDocumentSources];
}

function findSourceForEvidence({
  evidence,
  index,
  observedAt,
  sources,
}: {
  evidence: Record<string, unknown>;
  index: number;
  observedAt: string;
  sources: SourceRef[];
}): SourceRef | null {
  const evidenceUrl = getValidUrl(firstString(evidence.url, evidence.sourceUrl));
  const evidenceTitle = firstString(evidence.source, evidence.title);
  const matchingUrlSource = sources.find((source) => source.url === evidenceUrl);

  if (matchingUrlSource !== undefined) {
    return matchingUrlSource;
  }

  const matchingTitleSource = sources.find(
    (source) => evidenceTitle !== null && source.title === evidenceTitle,
  );

  if (matchingTitleSource !== undefined) {
    return matchingTitleSource;
  }

  if (evidenceUrl !== null) {
    const title = evidenceTitle ?? evidenceUrl;

    return {
      id: `source_${slugify(title)}_evidence_${index + 1}`,
      title,
      url: evidenceUrl,
      observedAt,
    };
  }

  return null;
}

function buildEvidenceExcerpt({
  evidence,
  index,
  observedAt,
  sources,
}: {
  evidence: Record<string, unknown>;
  index: number;
  observedAt: string;
  sources: SourceRef[];
}): CorpusExcerpt | null {
  const claim = firstString(evidence.claim, evidence.summary, evidence.text);
  const quote = firstString(evidence.quote, evidence.evidence, evidence.snippet);

  if (claim === null && quote === null) {
    return null;
  }

  const source = findSourceForEvidence({
    evidence,
    index,
    observedAt,
    sources,
  });

  if (source === null) {
    return null;
  }

  const title = firstString(evidence.title, evidence.source) ?? source.title;
  const text = normalizeWhitespace(
    [claim, quote].filter((part): part is string => part !== null).join(" — "),
  );

  return {
    id: firstString(evidence.id) ?? `excerpt_evidence_${index + 1}`,
    sourceId: source.id,
    sourceUrl: source.url,
    title,
    text,
    observedAt,
  };
}

function getTopicSectionId(topic: string | null): SectionId | null {
  if (topic === null) {
    return null;
  }

  return topicSectionMap[topic] ?? null;
}

function buildTopicEvidenceRecords(
  topicRecords: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return topicRecords.flatMap((topicRecord, topicIndex) => {
    const topic = firstString(topicRecord.topic);
    const summary = firstString(topicRecord.summary);
    const sectionId = getTopicSectionId(topic);
    const recordSlug = slugify(topic ?? `topic-${topicIndex + 1}`);
    const topicEvidence = asRecordArray(topicRecord.evidence).map(
      (evidence, evidenceIndex) => ({
        ...evidence,
        id:
          firstString(evidence.id) ??
          `excerpt_topic_${recordSlug}_${sectionId ?? "shared"}_${evidenceIndex + 1}`,
        title: firstString(evidence.title) ?? `Corpus topic: ${topic ?? "general"}`,
        topic,
        ...(sectionId === null ? {} : { sectionId }),
      }),
    );

    const summaryUrl = firstString(topicRecord.url, topicRecord.sourceUrl);

    if (summary === null || summaryUrl === null) {
      return topicEvidence;
    }

    return [
      {
        claim: `Corpus topic: ${topic ?? `topic ${topicIndex + 1}`}`,
        id: `excerpt_topic_${recordSlug}_${sectionId ?? "shared"}_summary`,
        quote: summary,
        source: `Corpus topic: ${topic ?? "general"}`,
        title: `Corpus topic: ${topic ?? "general"}`,
        topic,
        ...(sectionId === null ? {} : { sectionId }),
        url: summaryUrl,
      },
      ...topicEvidence,
    ];
  });
}

function buildCorpusExcerpts({
  evidenceRecords,
  observedAt,
  sources,
  uploadedDocuments,
  companyName,
  productDescription,
  websiteUrl,
}: {
  evidenceRecords: Record<string, unknown>[];
  observedAt: string;
  sources: SourceRef[];
  uploadedDocuments: readonly UploadedDocumentContext[];
  companyName: string;
  productDescription: string;
  websiteUrl: string;
}): CorpusExcerpt[] {
  const evidenceExcerpts = evidenceRecords.flatMap((evidence, index) => {
    const excerpt = buildEvidenceExcerpt({
      evidence,
      index,
      observedAt,
      sources,
    });

    return excerpt === null ? [] : [excerpt];
  });
  const uploadedDocumentExcerpts = uploadedDocuments.map((document, index) => {
    const sourceId = `source_uploaded_${slugify(document.fileName)}_${index + 1}`;
    const sourceUrl = buildUploadedDocumentSourceUrl(document.id);

    return {
      id: `excerpt_uploaded_${slugify(document.fileName)}_${index + 1}`,
      sourceId,
      sourceUrl,
      title: `Uploaded document: ${document.fileName}`,
      text: trimUploadedDocumentExcerpt(document.parsedMarkdown),
      observedAt,
    };
  });

  const excerpts = [...evidenceExcerpts, ...uploadedDocumentExcerpts];

  // No corpus run and no uploaded docs: seed one excerpt from the operator's
  // own onboarding (website + product description). This is user-supplied
  // context — same provenance class as uploaded documents — and keeps
  // corpusSnapshotSchema.min(1) intact without fabricating research. The
  // agentic sections still research live with tools; this is the floor that
  // lets the ResearchInput validate in the no-corpus interim.
  if (excerpts.length === 0) {
    const websiteSource = sources.find(
      (source) => source.url === websiteUrl,
    );
    if (websiteSource !== undefined) {
      excerpts.push({
        id: `excerpt_${slugify(companyName)}_website_onboarding`,
        sourceId: websiteSource.id,
        sourceUrl: websiteUrl,
        title: `${companyName} website (operator-supplied)`,
        text: productDescription || `${companyName} onboarding brief`,
        observedAt,
      });
    }
  }

  return excerpts;
}

function excerptMatchesKeywords(
  excerpt: CorpusExcerpt,
  keywords: readonly string[],
): boolean {
  const haystack = `${excerpt.title} ${excerpt.text}`.toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function getExplicitExcerptSectionId(excerpt: CorpusExcerpt): SectionId | null {
  return (
    sectionIds.find((sectionId) => excerpt.id.includes(`_${sectionId}_`)) ?? null
  );
}

function excerptTargetsSection(
  excerpt: CorpusExcerpt,
  sectionId: SectionId,
): boolean {
  if (excerpt.id.includes("_shared_")) {
    return false;
  }

  const explicitSectionId = getExplicitExcerptSectionId(excerpt);

  if (explicitSectionId !== null) {
    return explicitSectionId === sectionId;
  }

  return excerptMatchesKeywords(excerpt, sectionScopeKeywords[sectionId]);
}

function excerptMatchesAnySection(excerpt: CorpusExcerpt): boolean {
  return sectionIds.some((sectionId) => excerptTargetsSection(excerpt, sectionId));
}

function dedupeCorpusExcerpts(
  excerpts: readonly CorpusExcerpt[],
): CorpusExcerpt[] {
  const seenIds = new Set<string>();

  return excerpts.filter((excerpt) => {
    if (seenIds.has(excerpt.id)) {
      return false;
    }

    seenIds.add(excerpt.id);
    return true;
  });
}

function buildSectionScopedCorpusExcerpts(
  excerpts: readonly CorpusExcerpt[],
): Record<SectionId, CorpusExcerpt[]> {
  const sharedExcerpts = excerpts.filter(
    (excerpt) => !excerptMatchesAnySection(excerpt),
  );
  const scopedEntries = sectionIds.map(
    (sectionId): [SectionId, CorpusExcerpt[]] => {
      const sectionExcerpts = excerpts.filter((excerpt) =>
        excerptTargetsSection(excerpt, sectionId),
      );

      return [
        sectionId,
        dedupeCorpusExcerpts([...sectionExcerpts, ...sharedExcerpts]),
      ];
    },
  );

  return Object.fromEntries(scopedEntries) as Record<SectionId, CorpusExcerpt[]>;
}

function countDroppedEvidenceExcerpts({
  evidenceRecords,
  observedAt,
  sources,
}: {
  evidenceRecords: Record<string, unknown>[];
  observedAt: string;
  sources: SourceRef[];
}): number {
  return evidenceRecords.filter((evidence, index) => {
    const claim = firstString(evidence.claim, evidence.summary, evidence.text);
    const quote = firstString(evidence.quote, evidence.evidence, evidence.snippet);

    if (claim === null && quote === null) {
      return false;
    }

    return (
      findSourceForEvidence({
        evidence,
        index,
        observedAt,
        sources,
      }) === null
    );
  }).length;
}

function withFallback(values: string[], fallback: string): string[] {
  return values.length > 0 ? values : [fallback];
}

const competitorListEnumeratorPattern =
  /(?:^|\s)\d+[.)]\s+|(?:^|\n)\s*[•*\-]\s+/u;
const competitorListDelimiterPattern =
  /(?:^|\s)\d+[.)]\s+|(?:^|\n)\s*[•*\-]\s+|\n+/u;

function splitCompetitorSeedCandidates(rawTopCompetitors: string): string[] {
  const normalized = rawTopCompetitors.replace(/\r\n?/gu, "\n").trim();

  if (normalized.length === 0) {
    return [];
  }

  if (competitorListEnumeratorPattern.test(normalized)) {
    return normalized.split(competitorListDelimiterPattern);
  }

  // Corpus-extracted prose lists arrive as "X and Y" / "X & Y" with no commas.
  // The compound string would otherwise become ONE advertiser query that the
  // ad probe matches nothing on (live run 9a9412a2: advertiser literally named
  // "SinglePlatform and restaurantji.com", 0 creatives).
  return normalized.split(/[\n,]+|\s+(?:and|&)\s+/iu);
}

function stripCompetitorListMarker(value: string): string {
  return value
    .trim()
    .replace(/^\d+[.)]\s+/u, "")
    .replace(/^[•*\-]\s+/u, "")
    .trim();
}

function stripCompetitorDescriptor(value: string): string {
  return (value.split("(")[0] ?? value).replace(/[;,.]+$/u, "").trim();
}

function getExplicitDomainFromText(value: string): string | null {
  const match = value.match(
    /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+(?:[/?#][^\s),;]*)?/iu,
  );

  return match === null ? null : getRegistrableDomain(match[0]);
}

function getExplicitDomainFromCompetitorItem({
  name,
  value,
}: {
  name: string;
  value: string;
}): string | null {
  const stripped = stripCompetitorListMarker(value);
  const lowerStripped = stripped.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerStripped.startsWith(lowerName)) {
    return getExplicitDomainFromText(stripped.slice(name.length));
  }

  return getExplicitDomainFromText(stripped);
}

function explicitDomainSafelyMatchesCompetitor({
  domain,
  name,
}: {
  domain: string;
  name: string;
}): boolean {
  const cleanNameToken = normalizeBrandToken(
    cleanAdvertiserQuery(name).split(/\s+/u)[0] ?? "",
  );
  const domainToken = getRegistrableDomainBrandToken(domain);

  return (
    cleanNameToken.length >= 3 &&
    domainToken.length >= 3 &&
    cleanNameToken === domainToken
  );
}

type CompetitorSeedDomainResolvedBy = "name-shape" | "corpus";

export type CompetitorSeedDomainResolution =
  | { domain: string; resolvedBy: CompetitorSeedDomainResolvedBy }
  | { domain?: undefined; resolvedBy: "none" };

interface CompetitorSeedDomainResolutionInput {
  clientDomain?: string;
  corpusDomains: readonly string[];
  name: string;
}

function getBareDomainFromSeedName(name: string): string | null {
  if (!/[.]/u.test(name)) {
    return null;
  }

  const candidate = name.trim();

  if (/[/\s]/u.test(candidate)) {
    return null;
  }

  return getRegistrableDomain(candidate);
}

function extractRegistrableDomainsFromText(value: string): string[] {
  const matches = value.matchAll(
    /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+(?:[/?#][^\s"',<>)\]}]*)?/giu,
  );
  const domains: string[] = [];

  for (const match of matches) {
    const candidate = match[0];
    const domain = getRegistrableDomain(candidate);

    if (domain !== null) {
      domains.push(domain);
    }
  }

  return domains;
}

function extractRegistrableDomainsFromValue(value: unknown): string[] {
  if (typeof value === "string") {
    return extractRegistrableDomainsFromText(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractRegistrableDomainsFromValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) =>
      extractRegistrableDomainsFromValue(item),
    );
  }

  return [];
}

function buildCorpusDomainCandidates(
  records: readonly Record<string, unknown>[],
): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];

  for (const record of records) {
    for (const domain of extractRegistrableDomainsFromValue(record)) {
      if (seen.has(domain)) {
        continue;
      }

      seen.add(domain);
      domains.push(domain);
    }
  }

  return domains;
}

function getUnambiguousCorpusDomainForName({
  clientDomain,
  corpusDomains,
  name,
}: CompetitorSeedDomainResolutionInput): string | undefined {
  const nameToken = normalizeBrandToken(
    cleanAdvertiserQuery(name).split(/\s+/u)[0] ?? "",
  );

  if (nameToken.length < 3) {
    return undefined;
  }

  const clientRegistrableDomain =
    clientDomain === undefined ? null : getRegistrableDomain(clientDomain);
  const matchingDomains = new Set(
    corpusDomains.filter(
      (domain) =>
        domain !== clientRegistrableDomain &&
        getRegistrableDomainBrandToken(domain) === nameToken,
    ),
  );

  return matchingDomains.size === 1
    ? Array.from(matchingDomains)[0]
    : undefined;
}

export function resolveCompetitorSeedDomain({
  clientDomain,
  corpusDomains,
  name,
}: CompetitorSeedDomainResolutionInput): CompetitorSeedDomainResolution {
  const bareDomain = getBareDomainFromSeedName(name);

  if (
    bareDomain !== null &&
    !isSameRegistrableDomain(bareDomain, clientDomain)
  ) {
    return { domain: bareDomain, resolvedBy: "name-shape" };
  }

  const corpusDomain = getUnambiguousCorpusDomainForName({
    clientDomain,
    corpusDomains,
    name,
  });

  return corpusDomain === undefined
    ? { resolvedBy: "none" }
    : { domain: corpusDomain, resolvedBy: "corpus" };
}

/**
 * Parse the onboarding `topCompetitors` free-text field into competitor seeds for
 * the deterministic ad probe. Numbered/bulleted lists are split only on list
 * markers and newlines so commas/semicolons inside parenthetical descriptions do
 * not become bogus advertiser names. Legacy unnumbered strings fall back to comma
 * splitting. Domain enrichment is CONSERVATIVE: keep safe explicit brief
 * domains, then resolve bare-domain names, then attach a corpus/evidence domain
 * only when exactly one non-client registrable domain has the same brand token.
 */
export function buildCompetitorSeeds({
  clientDomain,
  corpusRecords,
  rawTopCompetitors,
}: {
  clientDomain?: string;
  corpusRecords: readonly Record<string, unknown>[];
  rawTopCompetitors: string | undefined;
}): { name: string; domain?: string; provenance: "user-supplied" }[] {
  if (rawTopCompetitors === undefined || rawTopCompetitors.trim() === "") {
    return [];
  }

  const corpusDomains = buildCorpusDomainCandidates(corpusRecords);
  const seen = new Set<string>();
  const seeds: { name: string; domain?: string; provenance: "user-supplied" }[] =
    [];

  for (const rawName of splitCompetitorSeedCandidates(rawTopCompetitors)) {
    const stripped = stripCompetitorDescriptor(
      stripCompetitorListMarker(rawName),
    );

    if (stripped.length === 0) {
      continue;
    }

    // Reduce to the clean brand token before it becomes the ad-library search
    // query — "Confluence (Atlassian) - enterprise wiki/docs" -> "Confluence".
    // The live probe matched nothing on the decorated literal (2026-06-01 audit).
    const name = cleanAdvertiserQuery(stripped);

    if (name.length === 0) {
      continue;
    }

    const explicitDomain = getExplicitDomainFromCompetitorItem({
      name,
      value: rawName,
    });

    const key = name.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const domain =
      explicitDomain !== null &&
      explicitDomainSafelyMatchesCompetitor({ domain: explicitDomain, name }) &&
      !isSameRegistrableDomain(explicitDomain, clientDomain)
        ? explicitDomain
        : undefined;
    const seedDomain =
      domain ??
      resolveCompetitorSeedDomain({
        clientDomain,
        corpusDomains,
        name,
      }).domain;

    seeds.push({
      name,
      ...(seedDomain === undefined ? {} : { domain: seedDomain }),
      provenance: "user-supplied",
    });

    if (seeds.length >= 5) {
      break;
    }
  }

  return seeds;
}

export function corpusToResearchInput(
  params: CorpusToResearchInputParams,
): ResearchInput {
  const observedAt = (params.now ?? (() => new Date()))().toISOString();
  const data = asRecord(params.deepResearchProgramData);
  const corpus = asRecord(data.corpus);
  const onboardingFields = asRecord(data.onboardingFields);
  const onboardingData = asRecord(params.onboardingData);
  const companyName =
    firstString(
      getFieldValue(onboardingFields, "companyName"),
      getValue(onboardingData, "companyName"),
      getValue(onboardingData, "company_name"),
    ) ?? "Unknown company";
  const companySlug = slugify(companyName);
  const category =
    firstString(
      getValue(onboardingData, "industry"),
      getFieldValue(onboardingFields, "industryVertical"),
      getValue(onboardingData, "industryVertical"),
      getValue(onboardingData, "industry_vertical"),
    ) ?? "Unknown category";
  const productDescription =
    firstString(
      getFieldValue(onboardingFields, "productDescription"),
      getValue(onboardingData, "productDescription"),
      getValue(onboardingData, "product_description"),
    ) ?? "No product description was provided in the corpus.";
  const targetCustomer =
    firstString(
      getValue(onboardingData, "idealCustomer"),
      getFieldValue(onboardingFields, "primaryIcpDescription"),
      getValue(onboardingData, "primaryIcpDescription"),
      getValue(onboardingData, "primary_icp_description"),
    ) ?? "No target customer was provided in the corpus.";
  const researchSummary = buildResearchSummary({
    corpus,
    data,
    productDescription,
  });
  const mediaPlanBriefFields = buildMediaPlanBriefFields(onboardingData);
  const economicsBriefFields = buildEconomicsBriefFields(onboardingData);
  const sourceRecords = asRecordArray(corpus.sources);
  const evidenceRecords = asRecordArray(corpus.evidence);
  const topicRecords = asRecordArray(corpus.intelligenceTopics);
  const allEvidenceRecords = [
    ...evidenceRecords,
    ...buildTopicEvidenceRecords(topicRecords),
  ];
  const uploadedDocuments = params.uploadedDocuments ?? [];
  const firstCorpusSourceUrl = sourceRecords
    .map((source) => getValidUrl(firstString(source.url, source.sourceUrl)))
    .find((url): url is string => url !== null);
  const websiteUrl = resolveUrl({
    field: "company.websiteUrl",
    value: firstString(
      getValue(onboardingData, "websiteUrl"),
      getValue(onboardingData, "website_url"),
      getFieldValue(onboardingFields, "websiteUrl"),
    ),
    fallbackUrl: firstCorpusSourceUrl,
    slug: companySlug,
  });
  // GAP 2: collect sourceUrls from onboarding field metadata for provenance injection
  const briefFieldSourceUrls = collectBriefFieldSourceUrls(onboardingFields, [
    "buyingTriggers", "commonObjections", "competitorFrustrations",
    "situationBeforeBuying", "desiredTransformation", "easiestToClose",
    "bestClientSources", "salesProcessOverview", "salesCycleLength",
    "testimonialQuote", "marketProblem", "marketBottlenecks",
    "uniqueEdge", "valueProp", "guarantees", "jobTitles",
    "caseStudiesUrl", "pricingUrl", "testimonialsUrl", "demoUrl",
  ]);

  const sources = buildSources({
    companyName,
    evidenceRecords: allEvidenceRecords,
    observedAt,
    sourceRecords,
    uploadedDocuments,
    websiteUrl,
    briefFieldSourceUrls,
  });
  const droppedEvidenceExcerptCount = countDroppedEvidenceExcerpts({
    evidenceRecords: allEvidenceRecords,
    observedAt,
    sources,
  });
  const corpusExcerpts = buildCorpusExcerpts({
    evidenceRecords: allEvidenceRecords,
    observedAt,
    sources,
    uploadedDocuments,
    companyName,
    productDescription,
    websiteUrl,
  });
  return researchInputSchema.parse({
    runId: params.runId,
    fixtureId: `brand_${companySlug}`,
    company: {
      id: `company_${companySlug}`,
      name: companyName,
      websiteUrl,
      category,
      description: productDescription,
      stage: defaultCompanyStage,
      targetCustomer,
    },
    onboarding: {
      primaryGoal:
        firstString(
          getValue(onboardingData, "primaryGoal90Days"),
          getValue(onboardingData, "primaryGoal"),
          getValue(onboardingData, "primary_goal"),
        ) ?? researchSummary,
      targetSegments: withFallback(
        firstStringArray(
          getValue(onboardingData, "targetSegments"),
          getValue(onboardingData, "target_segments"),
          getFieldValue(onboardingFields, "primaryIcpDescription"),
        ),
        targetCustomer,
      ),
      keyOffers: firstStringArray(
        getValue(onboardingData, "coreFeatures"),
        getFieldValue(onboardingFields, "coreDeliverables"),
        getValue(onboardingData, "coreDeliverables"),
        getValue(onboardingData, "core_deliverables"),
        productDescription,
      ),
      // GAP 4: detect when we fell back to the hardcoded default channel
      ...(() => {
        const operatorChannels = firstStringArray(
          getValue(onboardingData, "distributionChannels"),
          getValue(onboardingData, "distribution_channels"),
        );
        if (operatorChannels.length > 0) {
          return { distributionChannels: operatorChannels };
        }
        return {
          distributionChannels: [defaultDistributionChannel],
          distributionChannelsMeta: "model-estimated" as const,
        };
      })(),
      constraints: firstStringArray(
        getValue(onboardingData, "constraints"),
        getFieldValue(onboardingFields, "constraints"),
      ),
      notes: researchSummary,
      ...mediaPlanBriefFields,
      ...economicsBriefFields,
      // GAP 1: operator voice (highest provenance)
      ...buildVoiceOfClientFields(onboardingData),
      // GAP 4: channel signals
      ...buildChannelSignalsFields(onboardingData),
    },
    corpus: {
      excerpts: corpusExcerpts,
      sectionExcerpts: buildSectionScopedCorpusExcerpts(corpusExcerpts),
    },
    sources,
    competitorAds: [],
    competitorSeeds: buildCompetitorSeeds({
      clientDomain: websiteUrl,
      corpusRecords: [...sourceRecords, ...allEvidenceRecords],
      rawTopCompetitors:
        firstString(
          getFieldValue(onboardingFields, "topCompetitors"),
          getValue(onboardingData, "topCompetitors"),
          getValue(onboardingData, "top_competitors"),
        ) ?? undefined,
    }),
    // GAP 3: operator-supplied asset URLs
    ...buildSuppliedAssetUrlsFields(onboardingData),
    ...(droppedEvidenceExcerptCount === 0
      ? {}
      : {
          _capabilities: {
            capabilityGaps: [
              {
                class: "evidence_excerpt_dropped",
                reason: "no_source_url",
                count: droppedEvidenceExcerptCount,
              },
            ],
          },
        }),
  });
}
