import {
  researchInputSchema,
  type CorpusExcerpt,
  type OnboardingSnapshot,
  type ResearchInput,
  type SourceRef,
} from "../lab-engine/artifacts/artifact-envelope";
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
  return trimmed.length === 0 ? null : trimmed;
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
  observedAt,
  sourceRecords,
  uploadedDocuments,
  websiteUrl,
}: {
  companyName: string;
  observedAt: string;
  sourceRecords: Record<string, unknown>[];
  uploadedDocuments: readonly UploadedDocumentContext[];
  websiteUrl: string;
}): SourceRef[] {
  const sources = sourceRecords.flatMap((source, index): SourceRef[] => {
    const url = getValidUrl(firstString(source.url, source.sourceUrl));

    if (url === null) {
      return [];
    }

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
  sources,
}: {
  evidence: Record<string, unknown>;
  sources: SourceRef[];
}): SourceRef {
  const evidenceUrl = getValidUrl(firstString(evidence.url, evidence.sourceUrl));
  const evidenceTitle = firstString(evidence.source, evidence.title);
  const matchingUrlSource = sources.find((source) => source.url === evidenceUrl);

  if (matchingUrlSource !== undefined) {
    return matchingUrlSource;
  }

  const matchingTitleSource = sources.find(
    (source) => evidenceTitle !== null && source.title === evidenceTitle,
  );

  return matchingTitleSource ?? sources[0]!;
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

  const source = findSourceForEvidence({ evidence, sources });
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

function buildCorpusExcerpts({
  evidenceRecords,
  observedAt,
  sources,
  uploadedDocuments,
}: {
  evidenceRecords: Record<string, unknown>[];
  observedAt: string;
  sources: SourceRef[];
  uploadedDocuments: readonly UploadedDocumentContext[];
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

  return [...evidenceExcerpts, ...uploadedDocumentExcerpts];
}

function withFallback(values: string[], fallback: string): string[] {
  return values.length > 0 ? values : [fallback];
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
  const sourceRecords = asRecordArray(corpus.sources);
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
  const sources = buildSources({
    companyName,
    observedAt,
    sourceRecords,
    uploadedDocuments,
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
      distributionChannels: withFallback(
        firstStringArray(
          getValue(onboardingData, "distributionChannels"),
          getValue(onboardingData, "distribution_channels"),
        ),
        defaultDistributionChannel,
      ),
      constraints: firstStringArray(
        getValue(onboardingData, "constraints"),
        getFieldValue(onboardingFields, "constraints"),
      ),
      notes: researchSummary,
      ...mediaPlanBriefFields,
    },
    corpus: {
      excerpts: buildCorpusExcerpts({
        evidenceRecords: asRecordArray(corpus.evidence),
        observedAt,
        sources,
        uploadedDocuments,
      }),
    },
    sources,
    competitorAds: [],
  });
}
