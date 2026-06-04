import { createPerplexity } from '@ai-sdk/perplexity';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import {
  emitArtifactProgress,
  emitRunnerProgress,
  extractJson,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import type { ResearchResult } from '../supabase';
import type { RunnerTelemetry } from '../telemetry';

const DEFAULT_DEEP_RESEARCH_MODEL = 'sonar-pro';
const FALLBACK_DEEP_RESEARCH_MODEL = 'sonar';
const DEFAULT_DEEP_RESEARCH_MAX_TOKENS = 20000;
const DEFAULT_DEEP_RESEARCH_TIMEOUT_MS = 900000;
const DEFAULT_DEEP_RESEARCH_REPAIR_TIMEOUT_MS = 120000;
const DEFAULT_DEEP_RESEARCH_REPAIR_MAX_TOKENS = 12000;
const MINIMUM_CITED_SOURCES = 10;
const MINIMUM_GROUNDED_EVIDENCE = 16;
const MINIMUM_INTELLIGENCE_TOPICS = 6;
const TOPIC_FANOUT_GROUPS = [
  {
    label: 'company-market-buyers',
    topics: ['company_truth', 'market_category', 'buyer_icp'],
    focus: 'company truth, category boundaries, buyer segments, ICP details, and public customer proof',
  },
  {
    label: 'competitors-pricing-offer',
    topics: ['competitors', 'pricing_packaging', 'offer_diagnostic'],
    focus: 'competitor alternatives, pricing and packaging, differentiators, implementation proof, and offer constraints',
  },
  {
    label: 'voc-demand-events',
    topics: ['voice_of_customer', 'demand_intent', 'recent_events'],
    focus: 'review or forum language, demand-intent signals, launch/news/recent events, and external market context',
  },
] as const;

const intelligenceTopicValues = [
  'company_truth',
  'market_category',
  'buyer_icp',
  'competitors',
  'voice_of_customer',
  'demand_intent',
  'offer_diagnostic',
  'pricing_packaging',
  'recent_events',
] as const;

type IntelligenceTopic = (typeof intelligenceTopicValues)[number];

interface CapturedDeepResearchSource {
  title: string;
  url: string;
}

interface DeepResearchMinimumsReport {
  coveredTopics: string[];
  passed: boolean;
  sourceCount: number;
  evidenceCount: number;
  fabricatedMatches: string[];
  ungroundedSourceUrls: string[];
  ungroundedEvidenceUrls: string[];
  errors: string[];
}

interface SonarSourceLike {
  sourceType?: unknown;
  title?: unknown;
  url?: unknown;
}

interface SonarUsageLike {
  inputTokens?: unknown;
  outputTokens?: unknown;
  totalTokens?: unknown;
  inputTokenDetails?: {
    cacheReadTokens?: unknown;
    cacheWriteTokens?: unknown;
  };
}

interface SonarGenerationResult {
  text: string;
  output?: unknown;
  sources?: SonarSourceLike[];
  finishReason?: unknown;
  rawFinishReason?: unknown;
  usage?: SonarUsageLike;
  totalUsage?: SonarUsageLike;
  providerMetadata?: unknown;
}

const onboardingFieldSchema = z.object({
  value: z.union([z.string(), z.null()]).describe('Verified field value, or null when not found in cited evidence.'),
  confidence: z.number().describe('Confidence from 0-100. Use 0 when value is null.'),
  sourceUrl: z.union([z.string(), z.null()]).describe('Cited source URL supporting the field, or null.'),
  reasoning: z.string().describe('Concise explanation of why the field is supported or unavailable.'),
});

const deepResearchEvidenceSchema = z.object({
  claim: z.string().describe('Specific supported claim.'),
  source: z.string().describe('Source title or publisher.'),
  url: z.string().describe('Exact cited source URL supporting this evidence.'),
  quote: z.string().describe('Grounded excerpt or concise paraphrase from the cited source.'),
  confidence: z.number().describe('Confidence from 0-100.'),
});

const intelligenceTopicSchema = z.object({
  topic: z.enum(intelligenceTopicValues).describe('Topic bucket this evidence should feed downstream.'),
  summary: z.string().describe('Source-grounded topic summary or an explicit evidence gap.'),
  evidence: z.array(deepResearchEvidenceSchema).describe('Topic-specific sourced claims.'),
});

const deepResearchCorpusSchema = z.object({
  corpus: z.object({
    company: z.string().describe('Clean company name.'),
    category: z.string().describe('Specific product or market category.'),
    researchSummary: z.string().describe('Evidence-grounded research summary.'),
    sources: z.array(z.object({
      title: z.string().describe('Source title.'),
      url: z.string().describe('Exact cited source URL.'),
      whyItMatters: z.string().describe('Why this source matters for the corpus.'),
    })).describe('Cited sources used to build the corpus.'),
    evidence: z.array(deepResearchEvidenceSchema).describe('Grounded evidence excerpts from cited sources.'),
    intelligenceTopics: z.array(intelligenceTopicSchema).describe('Typed source-lineaged intelligence base for section drafting and cross-section reasoning.'),
  }),
  onboardingFields: z.object({
    companyName: onboardingFieldSchema,
    businessModel: onboardingFieldSchema,
    industryVertical: onboardingFieldSchema,
    primaryIcpDescription: onboardingFieldSchema,
    jobTitles: onboardingFieldSchema,
    companySize: onboardingFieldSchema,
    geography: onboardingFieldSchema,
    headquartersLocation: onboardingFieldSchema,
    productDescription: onboardingFieldSchema,
    coreDeliverables: onboardingFieldSchema,
    pricingTiers: onboardingFieldSchema,
    valueProp: onboardingFieldSchema,
    guarantees: onboardingFieldSchema,
    topCompetitors: onboardingFieldSchema,
    uniqueEdge: onboardingFieldSchema,
    marketProblem: onboardingFieldSchema,
    situationBeforeBuying: onboardingFieldSchema,
    desiredTransformation: onboardingFieldSchema,
    commonObjections: onboardingFieldSchema,
    brandPositioning: onboardingFieldSchema,
    testimonialQuote: onboardingFieldSchema,
    caseStudiesUrl: onboardingFieldSchema,
    testimonialsUrl: onboardingFieldSchema,
    pricingUrl: onboardingFieldSchema,
    demoUrl: onboardingFieldSchema,
  }),
});

type DeepResearchCorpusOutput = z.infer<typeof deepResearchCorpusSchema>;
type DeepResearchEvidence = DeepResearchCorpusOutput['corpus']['evidence'][number];
type DeepResearchTopic = DeepResearchCorpusOutput['corpus']['intelligenceTopics'][number];

const deepResearchTopicSupplementSchema = z.object({
  evidence: z.array(deepResearchEvidenceSchema).describe('High-signal grounded evidence discovered by the topic fan-out.'),
  intelligenceTopics: z.array(intelligenceTopicSchema).describe('Topic-specific intelligence discovered by the topic fan-out.'),
});

type DeepResearchTopicSupplementOutput = z.infer<typeof deepResearchTopicSupplementSchema>;

const DEEP_RESEARCH_SYSTEM_PROMPT = `You are AI-GOS's Deep Research Agent for a supervised GTM workspace.

MISSION
Run one evidence-grounded company/category research pass that extracts and verifies company context for onboarding.
Do not write GTM section cards. Do not synthesize market, ICP, competitor, offer, keyword, or VoC sections.
Your job is to build the company corpus that later section-specific synthesis jobs will use one by one.

STYLE
- Be specific, executive, and useful. No generic strategy filler.
- Every major claim must be backed by a source, quote, user-provided context, or explicit "insufficient evidence" marker.
- Do not invent market size, pricing, CAC, ROAS, search volume, competitor claims, or customer quotes.
- If source coverage is thin, say exactly what is missing and still provide the best grounded diagnosis.
- Keep output concise but complete enough to complete onboarding and seed later section synthesis.

OUTPUT
Return ONLY valid JSON. No markdown fences. Shape:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}],
    "intelligenceTopics": [{
      "topic": "company_truth | market_category | buyer_icp | competitors | voice_of_customer | demand_intent | offer_diagnostic | pricing_packaging | recent_events",
      "summary": "source-grounded topic summary or explicit evidence gap",
      "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
    }]
  },
  "onboardingFields": {
    "companyName": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "businessModel": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "industryVertical": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "primaryIcpDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "jobTitles": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "companySize": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "geography": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "headquartersLocation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "productDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "coreDeliverables": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingTiers": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "valueProp": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "guarantees": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "topCompetitors": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "uniqueEdge": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "marketProblem": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "situationBeforeBuying": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "desiredTransformation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "commonObjections": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "brandPositioning": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialQuote": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "caseStudiesUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialsUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "demoUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"}
  }
}

ONBOARDING FIELD RULES
- onboardingFields is required. This is the field payload the user reviews before section synthesis.
- Only populate a field when the value is supported by a source in corpus.sources/evidence or by the supplied user context.
- Use concise, normalized field values. Do not paste the same homepage meta description into multiple fields.
- For companyName, return the clean company name, not the page title or SEO title.
- For productDescription, say what the product does in one concise sentence.
- For primaryIcpDescription, describe the buyer/user segment, not a generic customer count claim.
- For coreDeliverables, list concrete product capabilities/features.
- For fields that are not publicly discoverable, set value null, confidence 0, sourceUrl null, and explain the gap.

CORPUS DEPTH RULES
- Build a multi-topic intelligence base, not a single homepage summary.
- corpus.sources must include at least ${MINIMUM_CITED_SOURCES} unique real cited URLs.
- corpus.evidence plus intelligenceTopics[].evidence must include at least ${MINIMUM_GROUNDED_EVIDENCE} grounded evidence items.
- intelligenceTopics must cover at least ${MINIMUM_INTELLIGENCE_TOPICS} distinct topics from: company_truth, market_category, buyer_icp, competitors, voice_of_customer, demand_intent, offer_diagnostic, pricing_packaging, recent_events.
- Prefer coverage across company truth, market/category, buyers, competitors, pricing/packaging, demand, VoC/reviews/forums, offer/proof, and recent events.
- If a topic has no public evidence, include the topic with a summary that names the evidence gap and leave its evidence array empty.
- Every evidence item must cite a URL from captured Perplexity citations. Do not use model estimates as evidence.

CRITICAL RETURN CONTRACT
- Do not export, attach, or summarize the final JSON as a file.
- The final assistant response itself must contain the complete JSON object.
- The final response must start with "{" and end with "}". No preamble, no completion note, no file path, no markdown.`;

const DEEP_RESEARCH_REPAIR_SYSTEM_PROMPT = `You repair an AI-GOS Deep Research Agent draft into the required onboarding JSON.

Return ONLY valid JSON. No markdown fences, no preamble.

Rules:
- Use only the supplied original user context, captured sources, and incomplete draft.
- Do not invent facts. Unsupported onboarding fields must be {"value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not verified in captured evidence."}.
- Preserve source URLs exactly when used.
- Preserve or rebuild corpus.intelligenceTopics with at least ${MINIMUM_INTELLIGENCE_TOPICS} distinct topic buckets. Topic evidence must use captured citation URLs only.
- If a topic is not publicly supported, include the topic with an explicit evidence-gap summary and an empty evidence array.
- The output shape must match the Deep Research Agent contract:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}],
    "intelligenceTopics": [{
      "topic": "company_truth | market_category | buyer_icp | competitors | voice_of_customer | demand_intent | offer_diagnostic | pricing_packaging | recent_events",
      "summary": "source-grounded topic summary or explicit evidence gap",
      "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
    }]
  },
  "onboardingFields": {
    "companyName": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "businessModel": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "industryVertical": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "primaryIcpDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "jobTitles": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "companySize": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "geography": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "headquartersLocation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "productDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "coreDeliverables": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingTiers": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "valueProp": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "guarantees": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "topCompetitors": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "uniqueEdge": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "marketProblem": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "situationBeforeBuying": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "desiredTransformation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "commonObjections": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "brandPositioning": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialQuote": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "caseStudiesUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialsUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "demoUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"}
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function tryExtractJson(text: string): unknown | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

function readEnvNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readEnvString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : fallback;
}

function getPerplexityApiKey(): string | null {
  const value = process.env.PERPLEXITY_API_KEY?.trim();

  return value && value.length > 0 ? value : null;
}

function getDeepResearchModel(): string {
  return readEnvString('RESEARCH_DEEP_PROGRAM_MODEL', DEFAULT_DEEP_RESEARCH_MODEL);
}

function getDeepResearchModels(): string[] {
  const configured = getDeepResearchModel();

  return configured === FALLBACK_DEEP_RESEARCH_MODEL
    ? [configured]
    : [configured, FALLBACK_DEEP_RESEARCH_MODEL];
}

function getDeepResearchMaxTokens(): number {
  return readEnvNumber(
    'RESEARCH_DEEP_PROGRAM_MAX_TOKENS',
    DEFAULT_DEEP_RESEARCH_MAX_TOKENS,
  );
}

function getDeepResearchTimeoutMs(): number {
  return readEnvNumber(
    'RESEARCH_DEEP_PROGRAM_TIMEOUT_MS',
    DEFAULT_DEEP_RESEARCH_TIMEOUT_MS,
  );
}

function getDeepResearchRepairTimeoutMs(): number {
  return readEnvNumber(
    'RESEARCH_DEEP_PROGRAM_REPAIR_TIMEOUT_MS',
    DEFAULT_DEEP_RESEARCH_REPAIR_TIMEOUT_MS,
  );
}

function getDeepResearchRepairMaxTokens(): number {
  return readEnvNumber(
    'RESEARCH_DEEP_PROGRAM_REPAIR_MAX_TOKENS',
    DEFAULT_DEEP_RESEARCH_REPAIR_MAX_TOKENS,
  );
}

function countUsableOnboardingFields(result: Record<string, unknown>): number {
  const data = isRecord(result.data) ? result.data : result;
  const onboardingFields = isRecord(data.onboardingFields)
    ? data.onboardingFields
    : null;

  if (!onboardingFields) {
    return 0;
  }

  return Object.values(onboardingFields).filter((field) => {
    if (typeof field === 'string') {
      return field.trim().length > 0;
    }

    if (!isRecord(field)) {
      return false;
    }

    return (
      typeof field.value === 'string' &&
      field.value.trim().length > 0
    );
  }).length;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readContextField(context: string, label: string): string | null {
  const line = context
    .split('\n')
    .find((candidate) => candidate.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!line) {
    return null;
  }

  return readString(line.slice(line.indexOf(':') + 1));
}

function inferCompanyNameFromContext(context: string): string | null {
  return (
    readContextField(context, 'Company Name') ??
    readContextField(context, 'Website') ??
    readContextField(context, 'websiteUrl')
  );
}

function getDeepResearchCompanyName(parsed: Record<string, unknown>, context: string): string {
  const corpus = isRecord(parsed.corpus) ? parsed.corpus : null;
  const onboardingFields = isRecord(parsed.onboardingFields) ? parsed.onboardingFields : null;
  const companyNameField = isRecord(onboardingFields?.companyName)
    ? onboardingFields.companyName
    : null;

  return (
    readString(corpus?.company) ??
    readString(companyNameField?.value) ??
    inferCompanyNameFromContext(context) ??
    'Company'
  );
}

function formatSourceLine(source: unknown): string | null {
  if (!isRecord(source)) {
    return null;
  }

  const title = readString(source.title);
  const url = readString(source.url);
  const whyItMatters = readString(source.whyItMatters);

  if (!title && !url) {
    return null;
  }

  return `- ${title ?? url}${url ? ` (${url})` : ''}${whyItMatters ? `: ${whyItMatters}` : ''}`;
}

function formatEvidenceLine(evidence: unknown): string | null {
  if (!isRecord(evidence)) {
    return null;
  }

  const claim = readString(evidence.claim);
  const quote = readString(evidence.quote);
  const source = readString(evidence.source);

  if (!claim && !quote) {
    return null;
  }

  return `- ${claim ?? quote}${source ? ` (${source})` : ''}`;
}

function formatTopicLine(topic: unknown): string | null {
  if (!isRecord(topic)) {
    return null;
  }

  const topicName = readString(topic.topic);
  const summary = readString(topic.summary);
  const evidenceCount = readRecordArray(topic.evidence).length;

  if (topicName === null || summary === null) {
    return null;
  }

  return `- ${topicName}: ${summary}${evidenceCount > 0 ? ` (${evidenceCount} cited evidence item${evidenceCount === 1 ? '' : 's'})` : ''}`;
}

function formatCapturedSources(
  sources: readonly CapturedDeepResearchSource[],
): string {
  if (sources.length === 0) {
    return 'No web sources were captured before repair.';
  }

  return sources
    .slice(0, 24)
    .map((source) => `- ${source.title} (${source.url})`)
    .join('\n');
}

function normalizeUrl(value: unknown): string | null {
  const raw = readString(value);

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }

    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function getUrlHost(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isFabricatedUrl(value: string): boolean {
  const host = getUrlHost(value);

  if (!host) {
    return false;
  }

  return (
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.test') ||
    host.endsWith('.invalid')
  );
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function findFabricatedMatches(value: unknown): string[] {
  return uniqueStrings(
    collectStrings(value).filter((candidate) => {
      const normalizedUrl = normalizeUrl(candidate);

      return (
        candidate.includes('Synthetic:') ||
        candidate.includes('example.com') ||
        (normalizedUrl !== null && isFabricatedUrl(normalizedUrl))
      );
    }),
  );
}

function getCorpusRecord(result: Record<string, unknown>): Record<string, unknown> {
  const data = isRecord(result.data) ? result.data : result;

  return isRecord(data.corpus) ? data.corpus : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function extractCorpusSources(
  result: Record<string, unknown>,
): CapturedDeepResearchSource[] {
  return readRecordArray(getCorpusRecord(result).sources)
    .flatMap((source) => {
      const url = normalizeUrl(source.url);

      if (url === null) {
        return [];
      }

      return [{
        title: readString(source.title) ?? url,
        url,
      }];
    });
}

function extractGroundedEvidenceUrls(result: Record<string, unknown>): string[] {
  const corpus = getCorpusRecord(result);
  const topLevelEvidence = readRecordArray(corpus.evidence);
  const topicEvidence = readRecordArray(corpus.intelligenceTopics).flatMap(
    (topic) => readRecordArray(topic.evidence),
  );
  const seenEvidenceItems = new Set<string>();

  return [...topLevelEvidence, ...topicEvidence].flatMap((evidence) => {
    const url = normalizeUrl(evidence.url);
    const claim = readString(evidence.claim);
    const quote = readString(evidence.quote);

    if (url === null || claim === null || quote === null) {
      return [];
    }

    const evidenceKey = [url, claim.toLowerCase(), quote.toLowerCase()].join('\n');

    if (seenEvidenceItems.has(evidenceKey)) {
      return [];
    }

    seenEvidenceItems.add(evidenceKey);
    return [url];
  });
}

function extractCoveredIntelligenceTopics(result: Record<string, unknown>): string[] {
  return uniqueStrings(
    readRecordArray(getCorpusRecord(result).intelligenceTopics).flatMap((topic) => {
      const topicName = readString(topic.topic);
      const summary = readString(topic.summary);
      const evidence = readRecordArray(topic.evidence);

      return topicName !== null && (summary !== null || evidence.length > 0)
        ? [topicName]
        : [];
    }),
  );
}

function normalizeSourceSet(sources: readonly CapturedDeepResearchSource[]): Set<string> {
  return new Set(
    sources
      .map((source) => normalizeUrl(source.url))
      .filter((url): url is string => url !== null),
  );
}

function toUngroundedUrls(
  urls: string[],
  citationUrls: Set<string>,
): string[] {
  return uniqueStrings(urls.filter((url) => !citationUrls.has(url)));
}

export function validateDeepResearchMinimums(
  result: Record<string, unknown>,
  sonarSources: readonly CapturedDeepResearchSource[],
): DeepResearchMinimumsReport {
  const citationUrls = normalizeSourceSet(sonarSources);
  const sourceUrls = extractCorpusSources(result).map((source) => source.url);
  const evidenceUrls = extractGroundedEvidenceUrls(result);
  const coveredTopics = extractCoveredIntelligenceTopics(result);
  const groundedSourceUrls = uniqueStrings(
    sourceUrls.filter((url) => citationUrls.has(url) && !isFabricatedUrl(url)),
  );
  const groundedEvidenceUrls = evidenceUrls.filter(
    (url) => citationUrls.has(url) && !isFabricatedUrl(url),
  );
  const fabricatedMatches = findFabricatedMatches(result);
  const ungroundedSourceUrls = toUngroundedUrls(sourceUrls, citationUrls);
  const ungroundedEvidenceUrls = toUngroundedUrls(evidenceUrls, citationUrls);
  const errors = [
    groundedSourceUrls.length >= MINIMUM_CITED_SOURCES
      ? null
      : `corpus.sources has ${groundedSourceUrls.length}/${MINIMUM_CITED_SOURCES} real Perplexity-cited URLs`,
    groundedEvidenceUrls.length >= MINIMUM_GROUNDED_EVIDENCE
      ? null
      : `corpus.evidence plus intelligenceTopics[].evidence has ${groundedEvidenceUrls.length}/${MINIMUM_GROUNDED_EVIDENCE} grounded cited excerpts`,
    coveredTopics.length >= MINIMUM_INTELLIGENCE_TOPICS
      ? null
      : `corpus.intelligenceTopics has ${coveredTopics.length}/${MINIMUM_INTELLIGENCE_TOPICS} topic buckets`,
    fabricatedMatches.length === 0
      ? null
      : `corpus contains fabricated or placeholder data: ${fabricatedMatches.join(', ')}`,
    ungroundedSourceUrls.length === 0
      ? null
      : `corpus.sources includes URLs missing from Perplexity citations: ${ungroundedSourceUrls.join(', ')}`,
    ungroundedEvidenceUrls.length === 0
      ? null
      : `corpus.evidence includes URLs missing from Perplexity citations: ${ungroundedEvidenceUrls.join(', ')}`,
  ].filter((error): error is string => error !== null);

  return {
    coveredTopics,
    passed: errors.length === 0,
    sourceCount: groundedSourceUrls.length,
    evidenceCount: groundedEvidenceUrls.length,
    fabricatedMatches,
    ungroundedSourceUrls,
    ungroundedEvidenceUrls,
    errors,
  };
}

function sourceFromSonarSource(source: SonarSourceLike): CapturedDeepResearchSource | null {
  if (source.sourceType !== undefined && source.sourceType !== 'url') {
    return null;
  }

  const url = normalizeUrl(source.url);

  if (url === null) {
    return null;
  }

  return {
    title: readString(source.title) ?? url,
    url,
  };
}

function extractSonarSources(result: SonarGenerationResult): CapturedDeepResearchSource[] {
  const sources = Array.isArray(result.sources) ? result.sources : [];
  const normalized = sources
    .map(sourceFromSonarSource)
    .filter((source): source is CapturedDeepResearchSource => source !== null);

  return dedupeSources(normalized);
}

function dedupeSources(
  sources: readonly CapturedDeepResearchSource[],
): CapturedDeepResearchSource[] {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function mergeSources(
  primary: readonly CapturedDeepResearchSource[],
  supplemental: readonly CapturedDeepResearchSource[],
): CapturedDeepResearchSource[] {
  return dedupeSources([...primary, ...supplemental]);
}

function mergeProviderSourcesIntoCorpus(
  parsed: DeepResearchCorpusOutput,
  sonarSources: readonly CapturedDeepResearchSource[],
): DeepResearchCorpusOutput {
  const existingUrls = new Set(
    parsed.corpus.sources
      .map((source) => normalizeUrl(source.url))
      .filter((url): url is string => url !== null),
  );
  const providerSourceBackfill = sonarSources
    .filter((source) => !existingUrls.has(source.url))
    .map((source) => ({
      title: source.title,
      url: source.url,
      whyItMatters: 'Perplexity sonar citation used to ground the company corpus.',
    }));

  return {
    ...parsed,
    corpus: {
      ...parsed.corpus,
      sources: [...parsed.corpus.sources, ...providerSourceBackfill],
    },
  };
}

function buildPerplexityTelemetry(
  result: SonarGenerationResult,
  model: string,
): RunnerTelemetry {
  const usage = result.totalUsage ?? result.usage;
  const inputTokens = numberOrUndefined(usage?.inputTokens) ?? 0;
  const outputTokens = numberOrUndefined(usage?.outputTokens) ?? 0;
  const totalTokens =
    numberOrUndefined(usage?.totalTokens) ??
    inputTokens +
      outputTokens +
      (numberOrUndefined(usage?.inputTokenDetails?.cacheReadTokens) ?? 0) +
      (numberOrUndefined(usage?.inputTokenDetails?.cacheWriteTokens) ?? 0);

  return {
    model,
    stopReason:
      typeof result.rawFinishReason === 'string'
        ? result.rawFinishReason
        : typeof result.finishReason === 'string'
          ? result.finishReason
          : null,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
      cacheCreationInputTokens: numberOrUndefined(
        usage?.inputTokenDetails?.cacheWriteTokens,
      ),
      cacheReadInputTokens: numberOrUndefined(
        usage?.inputTokenDetails?.cacheReadTokens,
      ),
      serverToolUseCount: readPerplexitySearchCount(result.providerMetadata),
    },
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readPerplexitySearchCount(providerMetadata: unknown): number | undefined {
  if (!isRecord(providerMetadata)) {
    return undefined;
  }

  const perplexity = isRecord(providerMetadata.perplexity)
    ? providerMetadata.perplexity
    : null;
  const usage = isRecord(perplexity?.usage) ? perplexity.usage : null;

  return numberOrUndefined(usage?.numSearchQueries);
}

async function runWithAbortTimeout<T>(
  label: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export function formatDeepResearchArtifactMarkdown(
  parsed: Record<string, unknown>,
  context: string,
): { title: string; markdown: string } {
  const companyName = getDeepResearchCompanyName(parsed, context);
  const corpus = isRecord(parsed.corpus) ? parsed.corpus : parsed;
  const summary =
    readString(corpus.researchSummary) ??
    'Deep Research Agent built the source-backed company corpus for section synthesis.';
  const evidenceLines = Array.isArray(corpus.evidence)
    ? corpus.evidence.map(formatEvidenceLine).filter((line): line is string => Boolean(line))
    : [];
  const topicLines = Array.isArray(corpus.intelligenceTopics)
    ? corpus.intelligenceTopics.map(formatTopicLine).filter((line): line is string => Boolean(line))
    : [];
  const sourceLines = Array.isArray(corpus.sources)
    ? corpus.sources.map(formatSourceLine).filter((line): line is string => Boolean(line))
    : [];
  const sections = [
    `## Deep Research\n\n${summary}`,
    topicLines.length > 0
      ? `### Intelligence Topics\n${topicLines.slice(0, 8).join('\n')}`
      : null,
    evidenceLines.length > 0
      ? `### Evidence Highlights\n${evidenceLines.slice(0, 5).join('\n')}`
      : null,
    sourceLines.length > 0
      ? `### Sources\n${sourceLines.slice(0, 8).join('\n')}`
      : null,
  ].filter((section): section is string => Boolean(section));

  return {
    title: `${companyName} GTM Research`,
    markdown: sections.join('\n\n'),
  };
}

function buildDeepResearchPrompt(context: string): string {
  return `Today is ${new Date().toISOString().slice(0, 10)}.

Use the onboarding/prefill context below as confirmed input. Run the primary Perplexity sonar research pass and build the shared company evidence corpus for onboarding. Separate bounded topic fan-out calls will deepen specific intelligence buckets after this pass. Do not synthesize GTM report sections in this run.

SOURCE AND EVIDENCE GATE
- Build a multi-topic, source-lineaged company corpus that downstream sections can draw from.
- corpus.sources must contain at least ${MINIMUM_CITED_SOURCES} unique real cited URLs from Perplexity sonar citations.
- corpus.evidence plus intelligenceTopics[].evidence must contain at least ${MINIMUM_GROUNDED_EVIDENCE} excerpts or concise paraphrases, each with a URL from corpus.sources.
- corpus.intelligenceTopics must cover at least ${MINIMUM_INTELLIGENCE_TOPICS} distinct topic buckets from company truth, market/category, buyers, competitors, VoC, demand, offer, pricing, and recent events.
- Never use example.com, placeholder URLs, synthetic evidence, or invented claims.
- If a field is not publicly discoverable, use null/0/null and explain the evidence gap.

CONFIRMED CONTEXT
${context}`;
}

function buildTopicFanoutPrompt(input: {
  context: string;
  existingSources: readonly CapturedDeepResearchSource[];
  focus: string;
  label: string;
  topics: readonly IntelligenceTopic[];
}): string {
  return `Today is ${new Date().toISOString().slice(0, 10)}.

Run one focused supplemental Perplexity sonar search for this company corpus topic group.

TOPIC GROUP
- Label: ${input.label}
- Topics: ${input.topics.join(', ')}
- Research focus: ${input.focus}

RULES
- Return ONLY source-lineaged facts for the requested topics.
- Prefer credible new URLs not already captured; reuse existing URLs only when they support new specific evidence.
- Every evidence item must cite a real Perplexity citation URL from this call or from the already captured URL list.
- If a requested topic has no public evidence, include the topic with an explicit evidence-gap summary and an empty evidence array.
- Do not write GTM section cards. Do not invent market size, pricing, review quotes, keyword volume, or competitor claims.

RETURN JSON SHAPE
{
  "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}],
  "intelligenceTopics": [{
    "topic": "${input.topics.join(' | ')}",
    "summary": "source-grounded topic summary or explicit evidence gap",
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
  }]
}

ALREADY CAPTURED URLS
${formatCapturedSources(input.existingSources)}

CONFIRMED CONTEXT
${input.context}`;
}

function evidenceIdentity(evidence: DeepResearchEvidence): string {
  const url = normalizeUrl(evidence.url) ?? evidence.url;

  return [
    url,
    evidence.claim.trim().toLowerCase(),
    evidence.quote.trim().toLowerCase(),
  ].join('\n');
}

function dedupeEvidence(
  evidence: readonly DeepResearchEvidence[],
): DeepResearchEvidence[] {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = evidenceIdentity(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeTopicSummary(existing: string, supplemental: string): string {
  const normalizedExisting = existing.trim();
  const normalizedSupplemental = supplemental.trim();

  if (normalizedSupplemental.length === 0) {
    return normalizedExisting;
  }

  if (
    normalizedExisting.length === 0 ||
    normalizedExisting.toLowerCase() === normalizedSupplemental.toLowerCase()
  ) {
    return normalizedSupplemental;
  }

  if (normalizedExisting.toLowerCase().includes(normalizedSupplemental.toLowerCase())) {
    return normalizedExisting;
  }

  return `${normalizedExisting} Supplemental fan-out: ${normalizedSupplemental}`;
}

function mergeIntelligenceTopics(
  existingTopics: readonly DeepResearchTopic[],
  supplementalTopics: readonly DeepResearchTopic[],
): DeepResearchTopic[] {
  const topicMap = new Map<IntelligenceTopic, DeepResearchTopic>();

  for (const topic of existingTopics) {
    topicMap.set(topic.topic, {
      ...topic,
      evidence: dedupeEvidence(topic.evidence),
    });
  }

  for (const topic of supplementalTopics) {
    const existing = topicMap.get(topic.topic);

    if (existing === undefined) {
      topicMap.set(topic.topic, {
        ...topic,
        evidence: dedupeEvidence(topic.evidence),
      });
      continue;
    }

    topicMap.set(topic.topic, {
      ...existing,
      summary: mergeTopicSummary(existing.summary, topic.summary),
      evidence: dedupeEvidence([...existing.evidence, ...topic.evidence]),
    });
  }

  return intelligenceTopicValues
    .map((topic) => topicMap.get(topic))
    .filter((topic): topic is DeepResearchTopic => topic !== undefined);
}

function mergeTopicSupplementIntoCorpus(
  parsed: DeepResearchCorpusOutput,
  supplement: DeepResearchTopicSupplementOutput,
): DeepResearchCorpusOutput {
  return {
    ...parsed,
    corpus: {
      ...parsed.corpus,
      evidence: dedupeEvidence([
        ...parsed.corpus.evidence,
        ...supplement.evidence,
      ]),
      intelligenceTopics: mergeIntelligenceTopics(
        parsed.corpus.intelligenceTopics,
        supplement.intelligenceTopics,
      ),
    },
  };
}

function parseDeepResearchOutput(value: unknown): DeepResearchCorpusOutput {
  return deepResearchCorpusSchema.parse(value);
}

async function ensureMinimumSonarSources(input: {
  apiKey: string;
  context: string;
  existingSources: CapturedDeepResearchSource[];
  model: string;
  onProgress?: RunnerProgressReporter;
}): Promise<CapturedDeepResearchSource[]> {
  if (input.existingSources.length >= MINIMUM_CITED_SOURCES) {
    return input.existingSources;
  }

  await emitRunnerProgress(
    input.onProgress,
    'analysis',
    `expanding Perplexity citations (${input.existingSources.length}/${MINIMUM_CITED_SOURCES})`,
  );

  const perplexity = createPerplexity({ apiKey: input.apiKey });
  const result = await runWithAbortTimeout(
    'Deep research source expansion',
    getDeepResearchRepairTimeoutMs(),
    (signal) =>
      generateText({
        model: perplexity(input.model),
        prompt: `Find additional real, credible web sources for this company research corpus. Use web search and produce a concise source list. Prefer official product pages, pricing pages, docs, customer proof, and credible third-party profiles. Do not use placeholders.\n\nAlready captured URLs:\n${formatCapturedSources(input.existingSources)}\n\nContext:\n${input.context}`,
        maxOutputTokens: 1000,
        temperature: 0.1,
        abortSignal: signal,
      }),
  );
  const supplementalSources = extractSonarSources(result as SonarGenerationResult);

  return mergeSources(input.existingSources, supplementalSources);
}

interface TopicSupplementResearch {
  output: DeepResearchTopicSupplementOutput;
  rawText: string;
  result: SonarGenerationResult;
  sources: CapturedDeepResearchSource[];
}

async function generateTopicSupplement(input: {
  apiKey: string;
  context: string;
  existingSources: CapturedDeepResearchSource[];
  focus: string;
  label: string;
  model: string;
  onProgress?: RunnerProgressReporter;
  topics: readonly IntelligenceTopic[];
}): Promise<TopicSupplementResearch> {
  await emitRunnerProgress(
    input.onProgress,
    'analysis',
    `expanding corpus topic evidence: ${input.label}`,
  );

  const perplexity = createPerplexity({ apiKey: input.apiKey });
  const result = await runWithAbortTimeout(
    `Deep research topic fan-out (${input.label})`,
    getDeepResearchRepairTimeoutMs(),
    (signal) =>
      generateText({
        model: perplexity(input.model),
        prompt: buildTopicFanoutPrompt({
          context: input.context,
          existingSources: input.existingSources,
          focus: input.focus,
          label: input.label,
          topics: input.topics,
        }),
        output: Output.object({ schema: deepResearchTopicSupplementSchema }),
        maxOutputTokens: getDeepResearchRepairMaxTokens(),
        temperature: 0.1,
        abortSignal: signal,
      }),
  );
  const sonarResult = result as SonarGenerationResult;
  const output = deepResearchTopicSupplementSchema.parse(result.output);

  return {
    output,
    rawText: result.text || JSON.stringify(output),
    result: sonarResult,
    sources: extractSonarSources(sonarResult),
  };
}

async function enrichCorpusWithTopicFanout(input: {
  apiKey: string;
  context: string;
  model: string;
  onProgress?: RunnerProgressReporter;
  parsed: DeepResearchCorpusOutput;
  rawText: string;
  sources: CapturedDeepResearchSource[];
}): Promise<{
  parsed: DeepResearchCorpusOutput;
  rawText: string;
  sources: CapturedDeepResearchSource[];
}> {
  const supplements = await Promise.all(
    TOPIC_FANOUT_GROUPS.map((group) =>
      generateTopicSupplement({
        apiKey: input.apiKey,
        context: input.context,
        existingSources: input.sources,
        focus: group.focus,
        label: group.label,
        model: input.model,
        onProgress: input.onProgress,
        topics: group.topics,
      }),
    ),
  );
  const parsed = supplements.reduce(
    (current, supplement) => mergeTopicSupplementIntoCorpus(current, supplement.output),
    input.parsed,
  );
  const sources = supplements.reduce(
    (current, supplement) => mergeSources(current, supplement.sources),
    input.sources,
  );
  const supplementalText = supplements
    .map((supplement) => supplement.rawText)
    .filter((text) => text.trim().length > 0)
    .join('\n\n--- topic fan-out ---\n\n');

  return {
    parsed,
    rawText: supplementalText.length > 0
      ? `${input.rawText}\n\n--- topic fan-out ---\n\n${supplementalText}`.trim()
      : input.rawText,
    sources,
  };
}

interface GeneratedSonarCorpus {
  model: string;
  parsed: DeepResearchCorpusOutput;
  rawText: string;
  result: SonarGenerationResult;
  sources: CapturedDeepResearchSource[];
}

async function generateStructuredSonarCorpus(input: {
  apiKey: string;
  context: string;
  model: string;
  onProgress?: RunnerProgressReporter;
}): Promise<GeneratedSonarCorpus> {
  const perplexity = createPerplexity({ apiKey: input.apiKey });
  const result = await runWithAbortTimeout(
    'Deep research program',
    getDeepResearchTimeoutMs(),
    (signal) =>
      generateText({
        model: perplexity(input.model),
        system: DEEP_RESEARCH_SYSTEM_PROMPT,
        prompt: buildDeepResearchPrompt(input.context),
        output: Output.object({ schema: deepResearchCorpusSchema }),
        maxOutputTokens: getDeepResearchMaxTokens(),
        temperature: 0.1,
        abortSignal: signal,
      }),
  );
  const sonarResult = result as SonarGenerationResult;
  const parsed = parseDeepResearchOutput(result.output);
  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: input.model,
    onProgress: input.onProgress,
    parsed,
    rawText: result.text || JSON.stringify(parsed),
    sources: extractSonarSources(sonarResult),
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: input.model,
    onProgress: input.onProgress,
  });
  const merged = mergeProviderSourcesIntoCorpus(enriched.parsed, sources);

  return {
    model: input.model,
    parsed: merged,
    rawText: enriched.rawText,
    result: sonarResult,
    sources,
  };
}

async function generateDraftSonarCorpus(input: {
  apiKey: string;
  context: string;
  model: string;
  onProgress?: RunnerProgressReporter;
}): Promise<GeneratedSonarCorpus> {
  const perplexity = createPerplexity({ apiKey: input.apiKey });
  const result = await runWithAbortTimeout(
    'Deep research program',
    getDeepResearchTimeoutMs(),
    (signal) =>
      generateText({
        model: perplexity(input.model),
        system: DEEP_RESEARCH_SYSTEM_PROMPT,
        prompt: buildDeepResearchPrompt(input.context),
        maxOutputTokens: getDeepResearchMaxTokens(),
        temperature: 0.1,
        abortSignal: signal,
      }),
  );
  const sonarResult = result as SonarGenerationResult;
  const sonarSources = extractSonarSources(sonarResult);
  const parsed = tryExtractJson(result.text);

  if (!parsed || !isRecord(parsed)) {
    return repairDeepResearchJson({
      apiKey: input.apiKey,
      context: input.context,
      draftText: result.text,
      model: input.model,
      onProgress: input.onProgress,
      previousResult: sonarResult,
      sources: sonarSources,
    });
  }

  const validated = deepResearchCorpusSchema.safeParse(parsed);
  if (!validated.success) {
    return repairDeepResearchJson({
      apiKey: input.apiKey,
      context: input.context,
      draftText: result.text,
      model: input.model,
      onProgress: input.onProgress,
      previousResult: sonarResult,
      sources: sonarSources,
    });
  }
  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: input.model,
    onProgress: input.onProgress,
    parsed: validated.data,
    rawText: result.text,
    sources: sonarSources,
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: input.model,
    onProgress: input.onProgress,
  });

  return {
    model: input.model,
    parsed: mergeProviderSourcesIntoCorpus(enriched.parsed, sources),
    rawText: enriched.rawText,
    result: sonarResult,
    sources,
  };
}

async function repairDeepResearchJson(input: {
  apiKey: string;
  context: string;
  draftText: string;
  model: string;
  onProgress?: RunnerProgressReporter;
  previousResult: SonarGenerationResult;
  sources: CapturedDeepResearchSource[];
  validationErrors?: string[];
}): Promise<GeneratedSonarCorpus> {
  const perplexity = createPerplexity({ apiKey: input.apiKey });
  const validationInstructions =
    input.validationErrors && input.validationErrors.length > 0
      ? `\n\nFAILED VALIDATION TO FIX\n${input.validationErrors.map((error) => `- ${error}`).join('\n')}\n\nOnly use URLs listed in CAPTURED PERPLEXITY CITATIONS. corpus.sources, corpus.evidence.url, and every intelligenceTopics[].evidence[].url must be one of those captured citation URLs. Produce at least ${MINIMUM_GROUNDED_EVIDENCE} evidence entries across corpus.evidence plus intelligenceTopics[].evidence from those allowed URLs; multiple distinct claims can cite the same allowed URL when supported. Preserve at least ${MINIMUM_INTELLIGENCE_TOPICS} distinct intelligenceTopics.`
      : '';
  const result = await runWithAbortTimeout(
    'Deep research repair',
    getDeepResearchRepairTimeoutMs(),
    (signal) =>
      generateText({
        model: perplexity(input.model),
        system: DEEP_RESEARCH_REPAIR_SYSTEM_PROMPT,
        prompt: `ORIGINAL USER CONTEXT\n${input.context}\n\nCAPTURED PERPLEXITY CITATIONS\n${formatCapturedSources(input.sources)}${validationInstructions}\n\nINCOMPLETE DRAFT / MODEL OUTPUT\n${input.draftText || 'No draft text was produced.'}\n\nRepair this into the required JSON object now. Use only the captured Perplexity citations and original context.`,
        maxOutputTokens: getDeepResearchRepairMaxTokens(),
        temperature: 0,
        abortSignal: signal,
      }),
  );
  const parsed = tryExtractJson(result.text);

  if (!parsed || !isRecord(parsed)) {
    throw new Error('Deep research repair returned no parseable JSON');
  }

  const validated = parseDeepResearchOutput(parsed);
  const sonarResult = result as SonarGenerationResult;
  const baseSources = input.sources.length > 0
    ? input.sources
    : extractSonarSources(sonarResult);
  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: input.model,
    onProgress: input.onProgress,
    parsed: validated,
    rawText: `${input.draftText}\n\n--- repaired JSON ---\n${result.text}`.trim(),
    sources: baseSources,
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: input.model,
    onProgress: input.onProgress,
  });

  return {
    model: input.model,
    parsed: mergeProviderSourcesIntoCorpus(enriched.parsed, sources),
    rawText: enriched.rawText,
    result: {
      ...input.previousResult,
      ...sonarResult,
      totalUsage: sonarResult.totalUsage ?? sonarResult.usage ?? input.previousResult.totalUsage,
    },
    sources,
  };
}

async function repairDeepResearchJsonToMinimums(input: {
  apiKey: string;
  context: string;
  draftText: string;
  model: string;
  onProgress?: RunnerProgressReporter;
  previousResult: SonarGenerationResult;
  sources: CapturedDeepResearchSource[];
  validationErrors: string[];
}): Promise<GeneratedSonarCorpus> {
  const firstRepair = await repairDeepResearchJson(input);
  const firstRepairMinimums = validateDeepResearchMinimums(
    firstRepair.parsed as unknown as Record<string, unknown>,
    firstRepair.sources,
  );

  if (firstRepairMinimums.passed) {
    return firstRepair;
  }

  await emitRunnerProgress(
    input.onProgress,
    'analysis',
    're-repairing corpus against failed citation minimums',
  );

  const secondRepair = await repairDeepResearchJson({
    ...input,
    draftText: firstRepair.rawText || JSON.stringify(firstRepair.parsed),
    previousResult: firstRepair.result,
    validationErrors: firstRepairMinimums.errors,
  });
  const secondRepairMinimums = validateDeepResearchMinimums(
    secondRepair.parsed as unknown as Record<string, unknown>,
    secondRepair.sources,
  );

  if (secondRepairMinimums.passed) {
    return secondRepair;
  }

  throw new Error(
    `Perplexity corpus repair failed deterministic minimums: ${secondRepairMinimums.errors.join('; ')}`,
  );
}

async function generateSonarCorpus(input: {
  apiKey: string;
  context: string;
  onProgress?: RunnerProgressReporter;
}): Promise<GeneratedSonarCorpus> {
  let lastError: unknown;

  for (const model of getDeepResearchModels()) {
    try {
      await emitRunnerProgress(
        input.onProgress,
        'runner',
        `querying Perplexity ${model} for source-lineaged multi-topic corpus`,
      );

      const generated = await runWithBackoff(async () => {
        try {
          return await generateStructuredSonarCorpus({
            apiKey: input.apiKey,
            context: input.context,
            model,
            onProgress: input.onProgress,
          });
        } catch (error) {
          console.warn('[deep-research-program] Structured Perplexity corpus generation failed; retrying with draft JSON extraction', {
            error: error instanceof Error ? error.message : String(error),
            model,
          });
          await emitRunnerProgress(
            input.onProgress,
            'analysis',
            'repairing Perplexity corpus JSON from cited draft',
          );

          return await generateDraftSonarCorpus({
            apiKey: input.apiKey,
            context: input.context,
            model,
            onProgress: input.onProgress,
          });
        }
      }, 'deepResearchProgram');
      const minimums = validateDeepResearchMinimums(
        generated.parsed as unknown as Record<string, unknown>,
        generated.sources,
      );

      if (minimums.passed) {
        return generated;
      }

      await emitRunnerProgress(
        input.onProgress,
        'analysis',
        'repairing corpus against captured Perplexity citations',
      );

      return await repairDeepResearchJsonToMinimums({
        apiKey: input.apiKey,
        context: input.context,
        draftText: generated.rawText || JSON.stringify(generated.parsed),
        model,
        onProgress: input.onProgress,
        previousResult: generated.result,
        sources: generated.sources,
        validationErrors: minimums.errors,
      });
    } catch (error) {
      lastError = error;
      console.warn('[deep-research-program] Perplexity corpus model failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });

      if (model !== FALLBACK_DEEP_RESEARCH_MODEL) {
        await emitRunnerProgress(
          input.onProgress,
          'analysis',
          `falling back to Perplexity ${FALLBACK_DEEP_RESEARCH_MODEL}`,
        );
      }
    }
  }

  throw new Error(
    `Perplexity corpus generation failed for all configured models. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function runDeepResearchProgram(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    const apiKey = getPerplexityApiKey();
    if (!apiKey) {
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'PERPLEXITY_API_KEY is not configured in the research worker environment. Deep research cannot run without Perplexity sonar citations.',
        durationMs: Date.now() - startTime,
      };
    }

    const initialArtifactTitle = `${inferCompanyNameFromContext(context) ?? 'Company'} GTM Research`;
    await emitRunnerProgress(onProgress, 'runner', 'starting company research extraction');
    await emitArtifactProgress(onProgress, {
      type: 'artifact-clear',
      section: 'deepResearchProgram',
      title: initialArtifactTitle,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'researching',
      title: initialArtifactTitle,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-delta',
      section: 'deepResearchProgram',
      title: initialArtifactTitle,
      delta: `# ${initialArtifactTitle}\n\n## Deep Research\n\nPerplexity sonar is building the cited company corpus...`,
    });

    const generated = await generateSonarCorpus({
      apiKey,
      context,
      onProgress,
    });
    const parsedRecord = generated.parsed as unknown as Record<string, unknown>;
    const rawText = generated.rawText;
    await emitRunnerProgress(onProgress, 'analysis', 'validating cited corpus and topic coverage minimums');

    const onboardingFieldCount = countUsableOnboardingFields(parsedRecord);
    if (onboardingFieldCount === 0) {
      console.error('[deep-research-program] Missing onboardingFields payload:', {
        keys: Object.keys(parsedRecord),
      });
      await emitArtifactProgress(onProgress, {
        type: 'artifact-section-state',
        section: 'deepResearchProgram',
        status: 'error',
        title: initialArtifactTitle,
      });
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'Deep research returned no usable onboardingFields. The onboarding review cannot open from shallow prefill data.',
        durationMs: Date.now() - startTime,
        rawText,
        telemetry: buildPerplexityTelemetry(generated.result, generated.model),
      };
    }

    const minimums = validateDeepResearchMinimums(parsedRecord, generated.sources);
    if (!minimums.passed) {
      console.error('[deep-research-program] Perplexity corpus failed minimums:', {
        errors: minimums.errors,
        evidenceCount: minimums.evidenceCount,
        sourceCount: minimums.sourceCount,
      });
      await emitArtifactProgress(onProgress, {
        type: 'artifact-section-state',
        section: 'deepResearchProgram',
        status: 'error',
        title: initialArtifactTitle,
      });
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error: `Perplexity corpus failed deterministic minimums: ${minimums.errors.join('; ')}`,
        durationMs: Date.now() - startTime,
        rawText,
        telemetry: buildPerplexityTelemetry(generated.result, generated.model),
        provenance: {
          status: 'missing',
          citationCount: minimums.sourceCount,
        },
        validation: {
          section: 'deepResearchProgram',
          issues: minimums.errors.map((error) => ({
            code: 'corpus_minimums_failed',
            message: error,
          })),
        },
      };
    }

    const artifact = formatDeepResearchArtifactMarkdown(parsedRecord, context);
    await emitArtifactProgress(onProgress, {
      type: 'artifact-delta',
      section: 'deepResearchProgram',
      title: artifact.title,
      delta: `\n\n${artifact.markdown}`,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'complete',
      title: artifact.title,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-finish',
      section: 'deepResearchProgram',
      title: artifact.title,
    });

    return {
      status: 'complete',
      section: 'deepResearchProgram',
      data: parsedRecord,
      artifact,
      durationMs: Date.now() - startTime,
      rawText,
      citations: generated.sources.map((source, index) => ({
        number: index + 1,
        title: source.title,
        url: source.url,
      })),
      telemetry: buildPerplexityTelemetry(generated.result, generated.model),
      provenance: {
        status: 'sourced',
        citationCount: minimums.sourceCount,
      },
    };
  } catch (error) {
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'error',
      title: `${inferCompanyNameFromContext(context) ?? 'Company'} GTM Research`,
    });
    return {
      status: 'error',
      section: 'deepResearchProgram',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
