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
// Blocking corpus default. sonar-deep-research stays env-opt-in
// (RESEARCH_DEEP_PROGRAM_MAIN_MODEL): at default effort it ran 152-475s live
// and its output never survived validation, while sonar-pro shipped every
// corpus in ~100s (job timelines 2026-06-10).
const DEFAULT_DEEP_RESEARCH_MAIN_MODEL = 'sonar-pro';
const DEEP_RESEARCH_AGENTIC_MODEL_PREFIX = 'sonar-deep-research';
const FALLBACK_DEEP_RESEARCH_MODEL = 'sonar';
const DEFAULT_DEEP_RESEARCH_MAX_TOKENS = 20000;
// Per-call cap for the main corpus call. Must stay well under the worker's
// 900s job watchdog or the fallback chain can never run before the job dies.
const DEFAULT_DEEP_RESEARCH_TIMEOUT_MS = 240000;
const DEFAULT_DEEP_RESEARCH_REPAIR_TIMEOUT_MS = 120000;
const DEFAULT_DEEP_RESEARCH_REPAIR_MAX_TOKENS = 12000;
const DEEP_RESEARCH_BACKFILL_TIMEOUT_MS = 60000;
const DEEP_RESEARCH_BACKFILL_MAX_TOKENS = 4000;
const DEEP_RESEARCH_MEMO_MODEL = 'sonar-deep-research';
const DEEP_RESEARCH_MEMO_TIMEOUT_MS = 240000;
const DEEP_RESEARCH_MEMO_MAX_TOKENS = 6000;
const DEEP_RESEARCH_MEMO_QUOTE_CHAR_LIMIT = 6000;
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
    focus: "third-party customer reviews and forum complaints ABOUT the company from its users (G2, Capterra, Trustpilot, Reddit user threads) — never the company's own marketing or thought-leadership content about these topics; plus demand-intent signals and recent events",
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

export const deepResearchCorpusSchema = z.object({
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
    // Economics fields the channel-policy engine gates on (W4): extracted
    // when pricing/budget evidence exists, null-with-gap otherwise. Optional
    // so a model omission degrades to an empty field instead of burning a
    // repair round (the prompt still demands both keys).
    acv: onboardingFieldSchema.optional(),
    monthlyAdBudget: onboardingFieldSchema.optional(),
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

export type DeepResearchCorpusOutput = z.infer<typeof deepResearchCorpusSchema>;
type DeepResearchEvidence = DeepResearchCorpusOutput['corpus']['evidence'][number];
type DeepResearchTopic = DeepResearchCorpusOutput['corpus']['intelligenceTopics'][number];
type OnboardingFieldName = keyof DeepResearchCorpusOutput['onboardingFields'];
type OnboardingFieldValue = z.infer<typeof onboardingFieldSchema>;

const deepResearchTopicSupplementSchema = z.object({
  evidence: z.array(deepResearchEvidenceSchema).describe('High-signal grounded evidence discovered by the topic fan-out.'),
  intelligenceTopics: z.array(intelligenceTopicSchema).describe('Topic-specific intelligence discovered by the topic fan-out.'),
});

type DeepResearchTopicSupplementOutput = z.infer<typeof deepResearchTopicSupplementSchema>;

const backfillNullOnboardingFieldsSchema = z.object({
  fields: z.record(z.string(), onboardingFieldSchema).describe('Backfilled values keyed by requested onboardingFields field name.'),
});

type BackfillNullOnboardingFieldsOutput = z.infer<typeof backfillNullOnboardingFieldsSchema>;

const DEEP_RESEARCH_SYSTEM_PROMPT = `You are AI-GOS's Deep Research Agent for a supervised company research workflow.

MISSION
Run one evidence-grounded company/category research pass that extracts and verifies structured company research fields.
Do not write downstream strategy section cards. Do not synthesize market, ICP, competitor, offer, keyword, or VoC sections.
Your job is to build the company corpus that later section-specific synthesis jobs will use one by one.

STYLE
- Be specific, executive, and useful. No generic strategy filler.
- Every major claim must be backed by a source, quote, user-provided context, or explicit "insufficient evidence" marker.
- Do not invent market size, pricing, CAC, ROAS, search volume, competitor claims, or customer quotes.
- If source coverage is thin, say exactly what is missing and still provide the best grounded diagnosis.
- Never reference passes, calls, sweeps, fan-outs, or this research process; describe gaps in client language (e.g. "no public pricing is disclosed").
- Keep output concise but complete enough to complete structured company research fields and seed later section synthesis.

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
    "acv": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "monthlyAdBudget": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
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

FIELD EXTRACTION RULES
- \`onboardingFields\` is an output field-name convention only — 'onboarding' is NOT a research topic. Never research onboarding/user-onboarding unless the company's product is itself an onboarding tool.
- onboardingFields is required. This is the structured field payload the user reviews before section synthesis.
- Only populate a field when the value is supported by a source in corpus.sources/evidence or by the supplied user context.
- Use concise, normalized field values. Do not paste the same homepage meta description into multiple fields.
- For companyName, return the clean company name, not the page title or SEO title.
- For productDescription, say what the product does in one concise sentence.
- For primaryIcpDescription, describe the buyer/user segment, not a generic customer count claim.
- For companySize, return the TARGET CUSTOMER segment's employee-count or revenue band (e.g. "50-500 employees", "$5M-$50M ARR"); NEVER the company's own user/brand/customer-count claims. Null when not disclosed.
- For coreDeliverables, list concrete product capabilities/features.
- For acv, extract the average contract value / typical deal size as a plain USD amount (e.g. "$12,000/yr") when pricing pages, case studies, or cited sources disclose it; deriving an annual figure from published per-seat or per-month pricing is allowed ONLY with the math stated in reasoning. Null when pricing is undisclosed.
- For monthlyAdBudget, populate ONLY when a cited source discloses the company's own paid-ad spend (interviews, case studies, job posts); this is rarely public — null with an explicit gap is the normal answer.
- For topCompetitors, return a clean comma-separated list of competitor COMPANY NAMES only (e.g. "Asana, Monday.com, ClickUp") — no prose, no "and", no descriptions.
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

const DEEP_RESEARCH_REPAIR_SYSTEM_PROMPT = `You repair an AI-GOS Deep Research Agent draft into the required structured company research JSON.

Return ONLY valid JSON. No markdown fences, no preamble.

Rules:
- Use only the supplied original user context, captured sources, and incomplete draft.
- \`onboardingFields\` is an output field-name convention only — 'onboarding' is NOT a research topic. Never research onboarding/user-onboarding unless the company's product is itself an onboarding tool.
- Do not invent facts. Unsupported structured field values must be {"value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not verified in captured evidence."}.
- For companySize, return the TARGET CUSTOMER segment's employee-count or revenue band (e.g. "50-500 employees", "$5M-$50M ARR"); NEVER the company's own user/brand/customer-count claims. Null when not disclosed.
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
    "acv": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "monthlyAdBudget": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
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

function getDeepResearchMainModel(): string {
  return readEnvString(
    'RESEARCH_DEEP_PROGRAM_MAIN_MODEL',
    DEFAULT_DEEP_RESEARCH_MAIN_MODEL,
  );
}

function getDeepResearchModels(): string[] {
  return [
    ...new Set([
      getDeepResearchMainModel(),
      getDeepResearchModel(),
      FALLBACK_DEEP_RESEARCH_MODEL,
    ]),
  ];
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

function buildLowReasoningPerplexityOptions(): {
  perplexity: { reasoning_effort: 'low' };
} {
  return {
    perplexity: {
      reasoning_effort: 'low',
    },
  };
}

/**
 * sonar-deep-research runs an agentic multi-search pass server-side; without
 * an explicit effort cap it defaults to medium/high and takes minutes (the
 * 17s probe that justified it ran at low effort). Pin effort whenever the
 * agentic model is configured so probe and production behave the same.
 */
function buildPerplexityCallOptions(
  model: string,
): { perplexity: { reasoning_effort: string } } | undefined {
  if (!model.startsWith(DEEP_RESEARCH_AGENTIC_MODEL_PREFIX)) {
    return undefined;
  }

  return buildLowReasoningPerplexityOptions();
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

function describeCapturedSources(
  sources: readonly CapturedDeepResearchSource[],
  limit = 4,
): string {
  const hosts = uniqueStrings(
    sources
      .map((source) => getUrlHost(source.url))
      .filter((host): host is string => Boolean(host)),
  );

  if (hosts.length === 0) {
    return 'no sources captured yet';
  }

  const shown = hosts.slice(0, limit).join(', ');
  const remaining = hosts.length - limit;

  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

async function emitMainSweepProgress(
  onProgress: RunnerProgressReporter | undefined,
  result: SonarGenerationResult,
  sources: readonly CapturedDeepResearchSource[],
): Promise<void> {
  const searchCount = readPerplexitySearchCount(result.providerMetadata);
  const searchPart =
    typeof searchCount === 'number' && searchCount > 0
      ? `ran ${searchCount} web searches`
      : 'web sweep complete';

  await emitRunnerProgress(
    onProgress,
    'tool',
    `${searchPart} — captured ${sources.length} sources (${describeCapturedSources(sources)})`,
  );
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

    // Aligned with evidenceIdentity: url + quote, claim excluded.
    const evidenceKey = [url, quote.toLowerCase()].join('\n');

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

function countCorpusRows(parsed: DeepResearchCorpusOutput): number {
  return (
    parsed.corpus.sources.length +
    parsed.corpus.evidence.length +
    parsed.corpus.intelligenceTopics.reduce(
      (sum, topic) => sum + topic.evidence.length,
      0,
    )
  );
}

/**
 * Drop corpus rows whose URL is not in the captured Perplexity citation set.
 * Models routinely add a handful of plausible-but-uncited URLs; failing the
 * whole corpus for them throws away dozens of good cited claims (live probe
 * 2026-06-10: 4 stray URLs killed a 100+-claim corpus after 487s). Strip the
 * uncited rows, keep the grounded corpus — same principle as the section
 * verifier's strip-the-lie repair (ADR-0011).
 */
export function stripUncitedCorpusEntries(
  parsed: DeepResearchCorpusOutput,
  sources: readonly CapturedDeepResearchSource[],
): DeepResearchCorpusOutput {
  const allowed = normalizeSourceSet(sources);
  const isCited = (url: string): boolean => {
    const normalized = normalizeUrl(url);
    return normalized !== null && allowed.has(normalized);
  };

  return {
    ...parsed,
    corpus: {
      ...parsed.corpus,
      sources: parsed.corpus.sources.filter((source) => isCited(source.url)),
      evidence: parsed.corpus.evidence.filter((evidence) => isCited(evidence.url)),
      intelligenceTopics: parsed.corpus.intelligenceTopics.map((topic) => ({
        ...topic,
        evidence: topic.evidence.filter((evidence) => isCited(evidence.url)),
      })),
    },
  };
}

export function validateDeepResearchMinimums(
  result: Record<string, unknown>,
  sonarSources: readonly CapturedDeepResearchSource[],
): DeepResearchMinimumsReport {
  const citationUrls = normalizeSourceSet(sonarSources);
  const sourceUrls = extractCorpusSources(result).map((source) => source.url);
  const evidenceUrls = extractGroundedEvidenceUrls(result);
  const coveredTopics = extractCoveredIntelligenceTopics(result);
  // Count distinct cited URLs the corpus actually grounds (curated sources
  // PLUS evidence-cited URLs). The source minimum used to pass only because
  // uncited provider citations were padded into corpus.sources; now that the
  // backfill is evidence-gated, honest runs must not fail on the same bar.
  const groundedSourceUrls = uniqueStrings(
    [...sourceUrls, ...evidenceUrls].filter(
      (url) => citationUrls.has(url) && !isFabricatedUrl(url),
    ),
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
      : `corpus.sources plus evidence grounds ${groundedSourceUrls.length}/${MINIMUM_CITED_SOURCES} distinct real Perplexity-cited URLs`,
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

// Map of normalizedUrl -> whyItMatters derived from the evidence that cites
// it. Topic evidence wins (it names the intelligence bucket); top-level
// corpus evidence is the fallback label. URLs no evidence row cites are
// absent — they must not be backfilled as zero-contribution source padding.
function buildEvidenceCitationIndex(
  parsed: DeepResearchCorpusOutput,
): Map<string, string> {
  const citedUnder = new Map<string, string>();

  for (const topic of parsed.corpus.intelligenceTopics) {
    for (const evidence of topic.evidence) {
      const url = normalizeUrl(evidence.url);

      if (url !== null && !citedUnder.has(url)) {
        citedUnder.set(url, `Cited under ${topic.topic} evidence.`);
      }
    }
  }

  for (const evidence of parsed.corpus.evidence) {
    const url = normalizeUrl(evidence.url);

    if (url !== null && !citedUnder.has(url)) {
      citedUnder.set(url, 'Cited in the grounded company evidence.');
    }
  }

  return citedUnder;
}

export function mergeProviderSourcesIntoCorpus(
  parsed: DeepResearchCorpusOutput,
  sonarSources: readonly CapturedDeepResearchSource[],
): DeepResearchCorpusOutput {
  const existingUrls = new Set(
    parsed.corpus.sources
      .map((source) => normalizeUrl(source.url))
      .filter((url): url is string => url !== null),
  );
  const citedUnder = buildEvidenceCitationIndex(parsed);
  const providerSourceBackfill = sonarSources
    .filter((source) => !existingUrls.has(source.url))
    .flatMap((source) => {
      const whyItMatters = citedUnder.get(source.url);

      // Only backfill citations at least one evidence row actually cites —
      // uncited provider citations are source-list padding, not grounding.
      if (whyItMatters === undefined) {
        return [];
      }

      return [{
        title: source.title,
        url: source.url,
        whyItMatters,
      }];
    });

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
  outerSignal?: AbortSignal,
): Promise<T> {
  if (outerSignal?.aborted) {
    throw new Error(`${label} aborted before start`);
  }

  const controller = new AbortController();
  const onOuterAbort = () => {
    controller.abort(outerSignal?.reason ?? new Error(`${label} aborted`));
  };
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        outerSignal?.aborted
          ? `${label} aborted by job shutdown`
          : `${label} timed out after ${Math.round(timeoutMs / 1000)}s`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener('abort', onOuterAbort);
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

export function buildDeepResearchPrompt(context: string): string {
  return `Today is ${new Date().toISOString().slice(0, 10)}.

Use the confirmed company context below as input. Run the primary Perplexity sonar research pass and build the shared company evidence corpus for structured company research fields. Separate bounded topic fan-out calls will deepen specific intelligence buckets after this pass. Do not synthesize downstream strategy sections in this run.

\`onboardingFields\` is an output field-name convention only — 'onboarding' is NOT a research topic. Never research onboarding/user-onboarding unless the company's product is itself an onboarding tool.

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
- Never reference passes, calls, sweeps, fan-outs, or this research process; describe gaps in client language (e.g. "no public pricing is disclosed").
- Do not write downstream strategy section cards. Do not invent market size, pricing, review quotes, keyword volume, or competitor claims.

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

function buildCrossSectionDeepResearchMemoPrompt(input: {
  context: string;
  existingSources: readonly CapturedDeepResearchSource[];
}): string {
  return `Today is ${new Date().toISOString().slice(0, 10)}.

Run one additive cross-section research pass for this company corpus.

TASK
Write a cited research memo that downstream GTM sections can reuse. Focus on the strongest source-backed facts across category, buyer, competitors, voice of customer, demand, offer/pricing, and recent events.

RULES
- This is additive research after the primary sonar-pro corpus. Do not repeat generic homepage summary.
- Use current web evidence and cite claims inline with source URLs.
- Do not invent market size, pricing, search volume, customer quotes, competitor claims, people, or named communities.
- If a topic is not publicly supported, state the evidence gap plainly.
- Return prose only. Do not return JSON.

ALREADY CAPTURED URLS
${formatCapturedSources(input.existingSources)}

CONFIRMED CONTEXT
${input.context}`;
}

// Identity is normalized url + normalized quote ONLY. The 5 merge sources
// (main pass, fan-outs, memo, repair) restate the same quote under paraphrased
// claims — including claim text in the key let those duplicates pile up 2-4x
// and flow into every section prompt.
function evidenceIdentity(evidence: DeepResearchEvidence): string {
  const url = normalizeUrl(evidence.url) ?? evidence.url;

  return [url, evidence.quote.trim().toLowerCase()].join('\n');
}

function dedupeEvidence(
  evidence: readonly DeepResearchEvidence[],
): DeepResearchEvidence[] {
  const byKey = new Map<string, DeepResearchEvidence>();

  for (const item of evidence) {
    const key = evidenceIdentity(item);
    const existing = byKey.get(key);

    // Keep the first row; a later duplicate replaces it only when it is more
    // confident (Map.set on an existing key preserves insertion order).
    if (existing === undefined || item.confidence > existing.confidence) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()];
}

function tokenizeSummaryText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

// Fraction of the supplemental summary's tokens already present in the
// existing summary. Above the threshold the supplemental sentence is a
// near-restatement and concatenating it would just double the topic summary.
const SUPPLEMENTAL_SUMMARY_OVERLAP_DROP_THRESHOLD = 0.8;

function supplementalSummaryOverlapRatio(
  existing: string,
  supplemental: string,
): number {
  const supplementalTokens = tokenizeSummaryText(supplemental);

  if (supplementalTokens.length === 0) {
    return 1;
  }

  const existingTokens = new Set(tokenizeSummaryText(existing));
  const overlapping = supplementalTokens.filter((token) =>
    existingTokens.has(token),
  ).length;

  return overlapping / supplementalTokens.length;
}

export function mergeTopicSummary(existing: string, supplemental: string): string {
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

  // Near-duplicate supplemental summaries are dropped, not concatenated —
  // and the join is a plain space so no pipeline vocabulary ("Supplemental
  // fan-out:") ever ships inside a client-facing topic summary.
  if (
    supplementalSummaryOverlapRatio(normalizedExisting, normalizedSupplemental) >
    SUPPLEMENTAL_SUMMARY_OVERLAP_DROP_THRESHOLD
  ) {
    return normalizedExisting;
  }

  return `${normalizedExisting} ${normalizedSupplemental}`;
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

function getFirstUsableMemoSource(
  sources: readonly CapturedDeepResearchSource[],
): CapturedDeepResearchSource | null {
  return (
    sources.find((source) => {
      const normalizedUrl = normalizeUrl(source.url);

      return normalizedUrl !== null && !isFabricatedUrl(normalizedUrl);
    }) ?? null
  );
}

function truncateMemoText(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= DEEP_RESEARCH_MEMO_QUOTE_CHAR_LIMIT) {
    return trimmed;
  }

  return `${trimmed.slice(0, DEEP_RESEARCH_MEMO_QUOTE_CHAR_LIMIT)}\n[truncated from sonar-deep-research memo]`;
}

function appendCrossSectionDeepResearchMemo(input: {
  memoText: string;
  parsed: DeepResearchCorpusOutput;
  sources: readonly CapturedDeepResearchSource[];
}): DeepResearchCorpusOutput {
  const source = getFirstUsableMemoSource(input.sources);
  const memoText = truncateMemoText(input.memoText);

  if (source === null || memoText.length === 0) {
    return input.parsed;
  }

  const memoEvidence: DeepResearchEvidence = {
    claim:
      'sonar-deep-research produced a cited cross-section research memo for downstream GTM section drafting.',
    source: source.title,
    url: source.url,
    // The memo is the researcher's synthesis across sources, not a verbatim
    // excerpt — label it as a sentiment/research summary so it is never
    // presented downstream as a literal source quote.
    quote: `Research memo summary (not a verbatim source quote): ${memoText}`,
    confidence: 80,
  };
  const withMemo = {
    ...input.parsed,
    corpus: {
      ...input.parsed.corpus,
      evidence: dedupeEvidence([...input.parsed.corpus.evidence, memoEvidence]),
    },
  };
  // Source merge runs AFTER the memo evidence lands so the memo's citing
  // source qualifies for the evidence-cited backfill.
  const withSources = mergeProviderSourcesIntoCorpus(withMemo, input.sources);

  return stripUncitedCorpusEntries(withSources, input.sources);
}

// Normalize the model's competitor list into a clean comma-separated list of
// names: split on commas, semicolons, pipes, newlines, "and"/"&" joiners,
// strip list markers, dedupe case-insensitively. The app-side seed splitter
// (corpus-to-research-input) stays as the second net.
export function normalizeTopCompetitorsValue(value: string): string {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const fragment of value.split(/[,;|\n]+/)) {
    for (const part of fragment.split(/\s+(?:and|&)\s+/i)) {
      const name = part.replace(/^[\s\-•*\d.)]+/, '').trim();
      const key = name.toLowerCase();

      if (name.length === 0 || name.length > 80 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      names.push(name);
    }
  }

  return names.join(', ');
}

// Deterministic process-talk scrub: the STYLE prompt rule asks the model not
// to narrate passes/calls/fan-outs, and this post-processor enforces it on
// the persisted corpus (researchSummary, topic summaries, field reasonings).
// Conservative by design — it strips the named process phrases and rewrites
// "deferred to a dedicated ... pass" sentences into plain gap statements; it
// never rewrites evidence claims or quotes.
const PROCESS_TALK_IN_THIS_PATTERN =
  /\s*\bin this (?:(?:research|corpus|sonar|initial|first|current|primary) )?(?:pass|call|run)\b/gi;
const PROCESS_TALK_DEFERRAL_PATTERN =
  /([^.!?\n]*?)\s*\b(?:should|will|can|must|may) be deferred to a dedicated[^.!?\n]*?(?:pass|call|sweep|fan-?outs?)[^.!?\n]*([.!?]|$)/gi;

// Perplexity copies inline citation markers ([40], [49-58], [12, 13]) into the
// prose and evidence text it returns. A standalone bracketed number / number
// range / number list is never legitimate client-facing prose, so strip it
// wherever it lands. When a citation count is known we only need to confirm the
// marker is numeric — out-of-range markers (beyond the citation array length)
// are the worst offenders and are removed by the same rule.
const INLINE_CITATION_MARKER_PATTERN = /\s*\[\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*\]/g;

function stripInlineCitationMarkers(value: string): string {
  if (!value.includes('[')) {
    return value;
  }

  const scrubbed = value
    .replace(INLINE_CITATION_MARKER_PATTERN, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();

  return scrubbed.length > 0 ? scrubbed : value.trim();
}

export function scrubDeepResearchProcessTalk(value: string): string {
  value = stripInlineCitationMarkers(value);
  const scrubbed = value
    .replace(PROCESS_TALK_DEFERRAL_PATTERN, (_match, subject: string, terminator: string) => {
      const leadingWhitespace = /^\s*/.exec(subject)?.[0] ?? '';
      const trimmedSubject = subject.trim();

      return trimmedSubject.length > 0
        ? `${leadingWhitespace}${trimmedSubject} is not disclosed in the cited sources${terminator}`
        : `${leadingWhitespace}Not disclosed in the cited sources${terminator}`;
    })
    .replace(PROCESS_TALK_IN_THIS_PATTERN, '')
    // Tidy the seams the removals leave behind: orphaned punctuation at a
    // sentence start, space-before-punctuation, doubled spaces.
    .replace(/(^|[\n.!?])\s*[,;:]\s*/g, '$1 ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();

  // Never mangle content into nothing: if the scrub leaves an empty string,
  // the original text was load-bearing — keep it.
  return scrubbed.length > 0 ? scrubbed : value.trim();
}

// Named external review/community platforms the model likes to invent as
// "social proof" filler ("High volumes of reviews on G2 and Capterra ...
// active Reddit communities") even when none of the cited sources are from
// those hosts. Each maps to the host token we expect in a real citation.
const EXTERNAL_PLATFORM_HOST_TOKENS: ReadonlyArray<{ pattern: RegExp; hostToken: string }> = [
  { pattern: /\bG2\b/, hostToken: 'g2' },
  { pattern: /\bG2\s*Crowd\b/i, hostToken: 'g2' },
  { pattern: /\bCapterra\b/i, hostToken: 'capterra' },
  { pattern: /\bGetApp\b/i, hostToken: 'getapp' },
  { pattern: /\bTrustRadius\b/i, hostToken: 'trustradius' },
  { pattern: /\bTrustpilot\b/i, hostToken: 'trustpilot' },
  { pattern: /\bGartner\b/i, hostToken: 'gartner' },
  { pattern: /\bReddit\b/i, hostToken: 'reddit' },
  { pattern: /\bQuora\b/i, hostToken: 'quora' },
  { pattern: /\bGlassdoor\b/i, hostToken: 'glassdoor' },
  { pattern: /\bProduct\s*Hunt\b/i, hostToken: 'producthunt' },
  { pattern: /\bHacker\s*News\b/i, hostToken: 'ycombinator' },
];

// Conservative sentence-level trimmer: drop a sentence ONLY when it asserts a
// named external platform (G2/Capterra/Reddit/...) whose host is NOT among the
// corpus's cited source hosts. Allowed tokens are derived from host BASENAMES
// (getUrlHost), not full-URL strings — matching against full URLs would drop
// legitimately-cited sentences. When in doubt the sentence is kept; the
// summary ends at the honest gap rather than inventing a fill.
export function trimUngroundedProse(value: string, allowedHosts: ReadonlySet<string>): string {
  const platformsInPlay = EXTERNAL_PLATFORM_HOST_TOKENS.filter((platform) =>
    platform.pattern.test(value),
  );

  if (platformsInPlay.length === 0) {
    return value;
  }

  // Mask decimal points (4.2 stars, 4.5 on Trustpilot) before sentence
  // splitting — otherwise the splitter treats the "." in a rating as a sentence
  // boundary and a dropped "...a 4" fragment leaves a garbled "2 score." orphan
  // (the dominant real shape of invented social proof carries a decimal rating).
  const DECIMAL_GUARD = '\u0000';
  const guarded = value.replace(/(?<=\d)\.(?=\d)/g, DECIMAL_GUARD);
  const sentences = guarded.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (sentences === null) {
    return value;
  }

  const kept = sentences.filter((sentence) => {
    const unsourcedPlatform = platformsInPlay.some(
      (platform) =>
        platform.pattern.test(sentence) &&
        ![...allowedHosts].some((host) => host.includes(platform.hostToken)),
    );

    return !unsourcedPlatform;
  });

  const trimmed = kept
    .join('')
    .replaceAll(DECIMAL_GUARD, '.')
    .replace(/ {2,}/g, ' ')
    .trim();

  // Never empty out load-bearing prose: if every sentence tripped the guard,
  // keep the original rather than emitting a blank summary.
  return trimmed.length > 0 ? trimmed : value;
}

function collectCorpusSourceHosts(parsed: DeepResearchCorpusOutput): Set<string> {
  const hosts = new Set<string>();

  for (const source of parsed.corpus.sources) {
    const host = getUrlHost(source.url);
    if (host !== null) {
      hosts.add(host);
    }
  }

  return hosts;
}

export function scrubProcessTalkFromCorpus(
  parsed: DeepResearchCorpusOutput,
): DeepResearchCorpusOutput {
  const allowedHosts = collectCorpusSourceHosts(parsed);
  const scrubProse = (text: string): string =>
    trimUngroundedProse(scrubDeepResearchProcessTalk(text), allowedHosts);
  const scrubEvidenceRow = (evidence: DeepResearchEvidence): DeepResearchEvidence => ({
    ...evidence,
    claim: stripInlineCitationMarkers(evidence.claim),
    quote: stripInlineCitationMarkers(evidence.quote),
  });

  const onboardingFields = Object.fromEntries(
    Object.entries(parsed.onboardingFields).map(([fieldName, field]) => [
      fieldName,
      field === undefined
        ? field
        : { ...field, reasoning: scrubDeepResearchProcessTalk(field.reasoning) },
    ]),
  ) as DeepResearchCorpusOutput['onboardingFields'];

  return {
    ...parsed,
    corpus: {
      ...parsed.corpus,
      researchSummary: scrubProse(parsed.corpus.researchSummary),
      evidence: parsed.corpus.evidence.map(scrubEvidenceRow),
      intelligenceTopics: parsed.corpus.intelligenceTopics.map((topic) => ({
        ...topic,
        summary: scrubProse(topic.summary),
        evidence: topic.evidence.map(scrubEvidenceRow),
      })),
    },
    onboardingFields,
  };
}

function normalizeDeepResearchOutput(
  output: DeepResearchCorpusOutput,
): DeepResearchCorpusOutput {
  const topCompetitors = output.onboardingFields.topCompetitors;

  if (typeof topCompetitors.value !== 'string') {
    return output;
  }

  const normalized = normalizeTopCompetitorsValue(topCompetitors.value);

  return {
    ...output,
    onboardingFields: {
      ...output.onboardingFields,
      topCompetitors: {
        ...topCompetitors,
        value: normalized.length > 0 ? normalized : null,
      },
    },
  };
}

function parseDeepResearchOutput(value: unknown): DeepResearchCorpusOutput {
  return normalizeDeepResearchOutput(deepResearchCorpusSchema.parse(value));
}

function readStructuredOutput(result: SonarGenerationResult): unknown {
  // AI SDK v6 exposes `output` as a throwing getter ('No output generated.')
  // when structured parsing failed — guard it so the text fallback can run.
  try {
    return result.output;
  } catch {
    return undefined;
  }
}

function parseRepairDeepResearchOutput(result: SonarGenerationResult): DeepResearchCorpusOutput {
  const structured = deepResearchCorpusSchema.safeParse(readStructuredOutput(result));
  if (structured.success) {
    return normalizeDeepResearchOutput(structured.data);
  }

  const parsed = tryExtractJson(result.text);
  if (!parsed || !isRecord(parsed)) {
    throw new Error('Deep research repair returned no parseable JSON');
  }

  return parseDeepResearchOutput(parsed);
}

function getNullOnboardingFieldNames(
  parsed: DeepResearchCorpusOutput,
): OnboardingFieldName[] {
  return (Object.keys(parsed.onboardingFields) as OnboardingFieldName[]).filter((fieldName) => {
    const field = parsed.onboardingFields[fieldName];

    return field !== undefined && field.value === null;
  });
}

function collectCorpusEvidence(parsed: DeepResearchCorpusOutput): DeepResearchEvidence[] {
  return dedupeEvidence([
    ...parsed.corpus.evidence,
    ...parsed.corpus.intelligenceTopics.flatMap((topic) => topic.evidence),
  ]);
}

function formatBackfillEvidenceTable(parsed: DeepResearchCorpusOutput): string {
  const evidence = collectCorpusEvidence(parsed);

  if (evidence.length === 0) {
    return 'No evidence rows were captured.';
  }

  return evidence
    .map((item, index) => {
      const normalizedUrl = normalizeUrl(item.url) ?? item.url;

      return [
        `Evidence ${index + 1}`,
        `URL: ${normalizedUrl}`,
        `Source: ${item.source}`,
        `Claim: ${item.claim}`,
        `Quote: ${item.quote}`,
      ].join('\n');
    })
    .join('\n\n');
}

function formatAllowedSourceUrls(parsed: DeepResearchCorpusOutput): string {
  const lines = parsed.corpus.sources.flatMap((source) => {
    const url = normalizeUrl(source.url);

    return url === null ? [] : [`- ${url}`];
  });

  return lines.length > 0 ? lines.join('\n') : '- No source URLs available';
}

function buildBackfillPrompt(input: {
  nullFieldNames: readonly OnboardingFieldName[];
  parsed: DeepResearchCorpusOutput;
}): string {
  return `Extract missing structured company research fields from PROVIDED EVIDENCE ONLY.

Do not search the web. Do not use outside knowledge. Do not infer from the company name alone.
Return a value only when the provided claim/quote rows support it.
Every non-null sourceUrl must be copied from ALLOWED SOURCE URLS.
If evidence is missing, return {"value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not verified in captured evidence."}.
For topCompetitors, return competitor company names only as a comma-separated string. Do not include descriptions.
The field name onboardingFields is an output convention only; onboarding is not a research topic.

COMPANY
${input.parsed.corpus.company}

CATEGORY
${input.parsed.corpus.category}

NULL FIELD NAMES TO BACKFILL
${input.nullFieldNames.map((fieldName) => `- ${fieldName}`).join('\n')}

ALLOWED SOURCE URLS
${formatAllowedSourceUrls(input.parsed)}

PROVIDED EVIDENCE
${formatBackfillEvidenceTable(input.parsed)}

Return JSON exactly in this shape:
{
  "fields": {
    "fieldName": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"}
  }
}`;
}

function parseBackfillOutput(result: SonarGenerationResult): BackfillNullOnboardingFieldsOutput | null {
  const structured = backfillNullOnboardingFieldsSchema.safeParse(readStructuredOutput(result));
  if (structured.success) {
    return structured.data;
  }

  const parsed = tryExtractJson(result.text);
  if (!parsed || !isRecord(parsed)) {
    return null;
  }

  const fromText = backfillNullOnboardingFieldsSchema.safeParse(parsed);

  return fromText.success ? fromText.data : null;
}

function buildCorpusSourceUrlMap(parsed: DeepResearchCorpusOutput): Map<string, string> {
  const sourceUrlMap = new Map<string, string>();

  for (const source of parsed.corpus.sources) {
    const normalized = normalizeUrl(source.url);
    if (normalized === null) {
      continue;
    }

    sourceUrlMap.set(normalized, source.url);
  }

  return sourceUrlMap;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceMentionsName(
  name: string,
  evidence: readonly DeepResearchEvidence[],
): boolean {
  const normalizedName = name.toLowerCase();

  return evidence.some((item) => {
    const haystack = `${item.claim}\n${item.quote}`.toLowerCase();

    return haystack.includes(normalizedName);
  });
}

function filterBackfilledCompetitorNames(
  value: string,
  evidence: readonly DeepResearchEvidence[],
): {
  droppedNames: string[];
  survivingNames: string[];
} {
  const names = normalizeTopCompetitorsValue(value)
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const survivingNames = names.filter((name) => evidenceMentionsName(name, evidence));
  const survivingSet = new Set(survivingNames.map((name) => name.toLowerCase()));

  return {
    droppedNames: names.filter((name) => !survivingSet.has(name.toLowerCase())),
    survivingNames,
  };
}

function validateBackfilledField(input: {
  candidate: OnboardingFieldValue | undefined;
  evidence: readonly DeepResearchEvidence[];
  fieldName: OnboardingFieldName;
  sourceUrlMap: ReadonlyMap<string, string>;
}): OnboardingFieldValue | null {
  if (input.candidate === undefined) {
    return null;
  }

  const value = typeof input.candidate.value === 'string'
    ? input.candidate.value.trim()
    : null;
  const sourceUrl = normalizeUrl(input.candidate.sourceUrl);

  if (value === null || value.length === 0 || sourceUrl === null) {
    return null;
  }

  const canonicalSourceUrl = input.sourceUrlMap.get(sourceUrl);
  if (canonicalSourceUrl === undefined) {
    return null;
  }

  if (input.fieldName === 'topCompetitors') {
    const { droppedNames, survivingNames } = filterBackfilledCompetitorNames(
      value,
      input.evidence,
    );

    if (survivingNames.length === 0) {
      return null;
    }

    const reasoningSuffix = droppedNames.length > 0
      ? ` Deterministic check dropped unsupported names: ${droppedNames.join(', ')}.`
      : '';

    return {
      value: survivingNames.join(', '),
      confidence: clampConfidence(input.candidate.confidence),
      sourceUrl: canonicalSourceUrl,
      reasoning: `${input.candidate.reasoning.trim()}${reasoningSuffix}`.trim(),
    };
  }

  return {
    value,
    confidence: clampConfidence(input.candidate.confidence),
    sourceUrl: canonicalSourceUrl,
    reasoning: input.candidate.reasoning.trim(),
  };
}

function applyBackfilledFields(input: {
  backfill: BackfillNullOnboardingFieldsOutput;
  parsed: DeepResearchCorpusOutput;
}): DeepResearchCorpusOutput {
  const nullFieldNames = getNullOnboardingFieldNames(input.parsed);
  const evidence = collectCorpusEvidence(input.parsed);
  const sourceUrlMap = buildCorpusSourceUrlMap(input.parsed);
  const nextFields = { ...input.parsed.onboardingFields };

  for (const fieldName of nullFieldNames) {
    const current = nextFields[fieldName];
    if (current === undefined || current.value !== null) {
      continue;
    }

    const candidate = input.backfill.fields[fieldName];
    const validated = validateBackfilledField({
      candidate,
      evidence,
      fieldName,
      sourceUrlMap,
    });

    if (validated === null) {
      continue;
    }

    nextFields[fieldName] = validated;
  }

  return {
    ...input.parsed,
    onboardingFields: nextFields,
  };
}

function countBackfilledFields(
  before: DeepResearchCorpusOutput,
  after: DeepResearchCorpusOutput,
): number {
  return getNullOnboardingFieldNames(before).filter((fieldName) => {
    const afterField = after.onboardingFields[fieldName];

    return typeof afterField?.value === 'string' && afterField.value.trim().length > 0;
  }).length;
}

export async function backfillNullOnboardingFields(input: {
  apiKey?: string | null;
  onProgress?: RunnerProgressReporter;
  parsed: DeepResearchCorpusOutput;
  abortSignal?: AbortSignal;
}): Promise<DeepResearchCorpusOutput> {
  const nullFieldNames = getNullOnboardingFieldNames(input.parsed);

  if (nullFieldNames.length === 0) {
    return input.parsed;
  }

  if (input.abortSignal?.aborted) {
    throw new Error('Deep research null-field backfill aborted by job shutdown');
  }

  const apiKey = input.apiKey?.trim() || getPerplexityApiKey();
  if (!apiKey) {
    console.warn('[deep-research-program] Skipping null-field backfill: PERPLEXITY_API_KEY is not configured.');
    return input.parsed;
  }

  try {
    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      `backfilling ${nullFieldNames.length} null structured field${nullFieldNames.length === 1 ? '' : 's'} from merged evidence`,
    );

    const perplexity = createPerplexity({ apiKey });
    // z.record compiles to a JSON schema with zero required properties, which
    // Perplexity's constrained decoder satisfies with {"fields": {}} (live-probed
    // 2026-06-10 on sonar AND sonar-pro). Each null field must be a REQUIRED
    // property so the model is forced to answer it (value: null stays legal).
    const backfillCallShape: Record<string, typeof onboardingFieldSchema> = {};
    for (const fieldName of nullFieldNames) {
      backfillCallShape[fieldName] = onboardingFieldSchema;
    }
    const backfillCallSchema = z.object({
      fields: z.object(backfillCallShape),
    });
    const result = await runWithAbortTimeout(
      'Deep research null-field backfill',
      DEEP_RESEARCH_BACKFILL_TIMEOUT_MS,
      (signal) =>
        generateText({
          model: perplexity('sonar-pro'),
          prompt: buildBackfillPrompt({
            nullFieldNames,
            parsed: input.parsed,
          }),
          output: Output.object({ schema: backfillCallSchema }),
          maxOutputTokens: DEEP_RESEARCH_BACKFILL_MAX_TOKENS,
          maxRetries: 0,
          temperature: 0,
          abortSignal: signal,
        }),
      input.abortSignal,
    );
    const backfill = parseBackfillOutput(result as SonarGenerationResult);

    if (process.env.DEBUG_BACKFILL === '1') {
      console.log('[debug-backfill] nullFieldNames:', nullFieldNames.join(','));
      console.log('[debug-backfill] raw text head:', String((result as SonarGenerationResult).text ?? '<no text>').slice(0, 800));
      console.log('[debug-backfill] parsed:', backfill === null ? 'NULL' : JSON.stringify(backfill).slice(0, 1500));
    }

    if (backfill === null) {
      console.warn('[deep-research-program] Null-field backfill returned no parseable structured output; keeping nulls.');
      return input.parsed;
    }

    const backfilled = applyBackfilledFields({
      backfill,
      parsed: input.parsed,
    });
    const filledCount = countBackfilledFields(input.parsed, backfilled);

    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      `backfilled ${filledCount}/${nullFieldNames.length} null structured field${nullFieldNames.length === 1 ? '' : 's'} from merged evidence`,
    );

    return backfilled;
  } catch (error) {
    if (input.abortSignal?.aborted) {
      throw error;
    }

    console.warn('[deep-research-program] Null-field backfill failed; keeping nulls.', {
      error: error instanceof Error ? error.message : String(error),
    });
    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      'null-field backfill failed — continuing with verified null gaps',
    );

    return input.parsed;
  }
}

async function ensureMinimumSonarSources(input: {
  apiKey: string;
  context: string;
  existingSources: CapturedDeepResearchSource[];
  model: string;
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
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
        providerOptions: buildPerplexityCallOptions(input.model),
        abortSignal: signal,
      }),
    input.abortSignal,
  );
  const supplementalSources = extractSonarSources(result as SonarGenerationResult);
  const merged = mergeSources(input.existingSources, supplementalSources);

  await emitRunnerProgress(
    input.onProgress,
    'tool',
    `citations expanded to ${merged.length} sources (${describeCapturedSources(merged)})`,
  );

  return merged;
}

interface TopicSupplementResearch {
  output: DeepResearchTopicSupplementOutput;
  rawText: string;
  result: SonarGenerationResult;
  sources: CapturedDeepResearchSource[];
}

// `result.output` is a THROWING getter when structured parsing failed
// (truncation at the token cap, malformed JSON). Guard it and fall back to
// extracting JSON from the raw text — an unguarded parse here silently
// killed the whole topic group, which is why competitors/pricing topics
// shipped empty.
function parseTopicSupplementOutput(
  result: SonarGenerationResult,
  label: string,
): DeepResearchTopicSupplementOutput {
  const structured = deepResearchTopicSupplementSchema.safeParse(
    readStructuredOutput(result),
  );
  if (structured.success) {
    return structured.data;
  }

  const parsed = tryExtractJson(result.text);
  const fromText = deepResearchTopicSupplementSchema.safeParse(parsed);
  if (fromText.success) {
    return fromText.data;
  }

  throw new Error(
    `Deep research topic fan-out (${label}) returned no parseable structured output`,
  );
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
  abortSignal?: AbortSignal;
}): Promise<TopicSupplementResearch> {
  await emitRunnerProgress(
    input.onProgress,
    'tool',
    `searching the web: ${input.focus}`,
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
        providerOptions: buildPerplexityCallOptions(input.model),
        abortSignal: signal,
      }),
    input.abortSignal,
  );
  const sonarResult = result as SonarGenerationResult;
  const output = parseTopicSupplementOutput(sonarResult, input.label);
  const sources = extractSonarSources(sonarResult);
  const claimCount =
    output.evidence.length +
    output.intelligenceTopics.reduce((sum, topic) => sum + topic.evidence.length, 0);

  await emitRunnerProgress(
    input.onProgress,
    'tool',
    `topic evidence captured: ${input.label} — ${claimCount} claims from ${sources.length} sources (${describeCapturedSources(sources)})`,
  );

  return {
    output,
    rawText: result.text || JSON.stringify(output),
    result: sonarResult,
    sources,
  };
}

// A topic fan-out group is single-shot upstream; one truncated/timed-out call
// used to silently drop the whole group (and with it competitors/pricing
// evidence). Retry a rejected group exactly once before letting allSettled's
// tolerance kick in. Never retry on job abort.
async function generateTopicSupplementWithRetry(
  input: Parameters<typeof generateTopicSupplement>[0],
): Promise<TopicSupplementResearch> {
  try {
    return await generateTopicSupplement(input);
  } catch (error) {
    if (input.abortSignal?.aborted) {
      throw error;
    }

    console.warn('[deep-research-program] topic fan-out group failed; retrying once', {
      error: error instanceof Error ? error.message : String(error),
      label: input.label,
    });
    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      `retrying topic expansion for ${input.label}`,
    );

    return generateTopicSupplement(input);
  }
}

async function enrichCorpusWithDeepResearchMemo(input: {
  apiKey: string;
  context: string;
  generated: GeneratedSonarCorpus;
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<GeneratedSonarCorpus> {
  try {
    await emitRunnerProgress(
      input.onProgress,
      'tool',
      'running additive sonar-deep-research cross-section memo',
    );

    const perplexity = createPerplexity({ apiKey: input.apiKey });
    const result = await runWithAbortTimeout(
      'Deep research cross-section memo',
      DEEP_RESEARCH_MEMO_TIMEOUT_MS,
      (signal) =>
        generateText({
          model: perplexity(DEEP_RESEARCH_MEMO_MODEL),
          prompt: buildCrossSectionDeepResearchMemoPrompt({
            context: input.context,
            existingSources: input.generated.sources,
          }),
          maxOutputTokens: DEEP_RESEARCH_MEMO_MAX_TOKENS,
          temperature: 0.1,
          providerOptions: buildLowReasoningPerplexityOptions(),
          abortSignal: signal,
        }),
      input.abortSignal,
    );
    const sonarResult = result as SonarGenerationResult;
    const memoSources = extractSonarSources(sonarResult);
    if (memoSources.length === 0 || result.text.trim().length === 0) {
      await emitRunnerProgress(
        input.onProgress,
        'analysis',
        'sonar-deep-research memo returned no cited row to append',
      );
      return input.generated;
    }

    const mergedSources = mergeSources(input.generated.sources, memoSources);
    const parsed = appendCrossSectionDeepResearchMemo({
      memoText: result.text,
      parsed: input.generated.parsed,
      sources: mergedSources,
    });

    if (countCorpusRows(parsed) === countCorpusRows(input.generated.parsed)) {
      await emitRunnerProgress(
        input.onProgress,
        'analysis',
        'sonar-deep-research memo returned no cited row to append',
      );
      return input.generated;
    }

    await emitRunnerProgress(
      input.onProgress,
      'tool',
      `sonar-deep-research memo appended from ${memoSources.length} citation source${memoSources.length === 1 ? '' : 's'}`,
    );

    return {
      ...input.generated,
      parsed,
      rawText: `${input.generated.rawText}\n\n--- sonar-deep-research memo ---\n\n${result.text}`.trim(),
      sources: mergedSources,
    };
  } catch (error) {
    console.warn('[deep-research-program] additive sonar-deep-research memo failed; continuing with sonar-pro corpus', {
      error: error instanceof Error ? error.message : String(error),
    });
    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      'sonar-deep-research memo failed — continuing with the sonar-pro corpus',
    );

    return input.generated;
  }
}

async function enrichCorpusWithTopicFanout(input: {
  apiKey: string;
  context: string;
  model: string;
  onProgress?: RunnerProgressReporter;
  parsed: DeepResearchCorpusOutput;
  rawText: string;
  sources: CapturedDeepResearchSource[];
  abortSignal?: AbortSignal;
}): Promise<{
  parsed: DeepResearchCorpusOutput;
  rawText: string;
  sources: CapturedDeepResearchSource[];
}> {
  // allSettled, not all: the supplements are additive enrichment. One flaky
  // supplement must never discard an already-good main corpus (live 2026-06-10:
  // a single 120s supplement timeout threw away an 8-minute corpus and
  // triggered the full draft-retry pyramid).
  const settled = await Promise.allSettled(
    TOPIC_FANOUT_GROUPS.map((group) =>
      generateTopicSupplementWithRetry({
        apiKey: input.apiKey,
        context: input.context,
        existingSources: input.sources,
        focus: group.focus,
        label: group.label,
        model: input.model,
        onProgress: input.onProgress,
        topics: group.topics,
        abortSignal: input.abortSignal,
      }),
    ),
  );
  const supplements: TopicSupplementResearch[] = [];
  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'fulfilled') {
      supplements.push(outcome.value);
      continue;
    }
    const label = TOPIC_FANOUT_GROUPS[index]?.label ?? `group-${index}`;
    console.warn('[deep-research-program] topic fan-out group failed; continuing without it', {
      error:
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      label,
    });
    await emitRunnerProgress(
      input.onProgress,
      'analysis',
      `topic expansion incomplete for ${label} — continuing with captured evidence`,
    );
  }
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
  abortSignal?: AbortSignal;
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
        providerOptions: buildPerplexityCallOptions(input.model),
        abortSignal: signal,
      }),
    input.abortSignal,
  );
  const sonarResult = result as SonarGenerationResult;
  const mainSources = extractSonarSources(sonarResult);
  await emitMainSweepProgress(input.onProgress, sonarResult, mainSources);
  const parsed = parseDeepResearchOutput(result.output);
  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: getDeepResearchModel(),
    onProgress: input.onProgress,
    parsed,
    rawText: result.text || JSON.stringify(parsed),
    sources: mainSources,
    abortSignal: input.abortSignal,
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: getDeepResearchModel(),
    onProgress: input.onProgress,
    abortSignal: input.abortSignal,
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
  abortSignal?: AbortSignal;
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
        providerOptions: buildPerplexityCallOptions(input.model),
        abortSignal: signal,
      }),
    input.abortSignal,
  );
  const sonarResult = result as SonarGenerationResult;
  const sonarSources = extractSonarSources(sonarResult);
  await emitMainSweepProgress(input.onProgress, sonarResult, sonarSources);
  const parsed = tryExtractJson(result.text);

  if (!parsed || !isRecord(parsed)) {
    return repairDeepResearchJson({
      apiKey: input.apiKey,
      context: input.context,
      draftText: result.text,
      model: getDeepResearchModel(),
      onProgress: input.onProgress,
      previousResult: sonarResult,
      sources: sonarSources,
      abortSignal: input.abortSignal,
      enrich: true,
    });
  }

  const validated = deepResearchCorpusSchema.safeParse(parsed);
  if (!validated.success) {
    return repairDeepResearchJson({
      apiKey: input.apiKey,
      context: input.context,
      draftText: result.text,
      model: getDeepResearchModel(),
      onProgress: input.onProgress,
      previousResult: sonarResult,
      sources: sonarSources,
      abortSignal: input.abortSignal,
      enrich: true,
    });
  }
  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: getDeepResearchModel(),
    onProgress: input.onProgress,
    parsed: normalizeDeepResearchOutput(validated.data),
    rawText: result.text,
    sources: sonarSources,
    abortSignal: input.abortSignal,
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: getDeepResearchModel(),
    onProgress: input.onProgress,
    abortSignal: input.abortSignal,
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
  abortSignal?: AbortSignal;
  /**
   * Run the topic fan-out + source top-up after the JSON repair. Only the
   * draft path (where fan-out has not run yet) should set this — repair
   * rounds on an already-enriched corpus must not re-buy 4 Perplexity calls
   * per round (live probe 2026-06-10 ran the fan-out 4x in one job).
   */
  enrich?: boolean;
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
        output: Output.object({ schema: deepResearchCorpusSchema }),
        maxOutputTokens: getDeepResearchRepairMaxTokens(),
        temperature: 0,
        providerOptions: buildPerplexityCallOptions(input.model),
        abortSignal: signal,
      }),
    input.abortSignal,
  );
  const sonarResult = result as SonarGenerationResult;
  const validated = parseRepairDeepResearchOutput(sonarResult);
  const baseSources = input.sources.length > 0
    ? input.sources
    : extractSonarSources(sonarResult);
  const repairRawText = `${input.draftText}\n\n--- repaired JSON ---\n${result.text}`.trim();
  const mergedResult = {
    ...input.previousResult,
    ...sonarResult,
    totalUsage: sonarResult.totalUsage ?? sonarResult.usage ?? input.previousResult.totalUsage,
  };

  if (!input.enrich) {
    const sources = mergeSources(baseSources, extractSonarSources(sonarResult));

    return {
      model: input.model,
      parsed: mergeProviderSourcesIntoCorpus(validated, sources),
      rawText: repairRawText,
      result: mergedResult,
      sources,
    };
  }

  const enriched = await enrichCorpusWithTopicFanout({
    apiKey: input.apiKey,
    context: input.context,
    model: input.model,
    onProgress: input.onProgress,
    parsed: validated,
    rawText: repairRawText,
    sources: baseSources,
    abortSignal: input.abortSignal,
  });
  const sources = await ensureMinimumSonarSources({
    apiKey: input.apiKey,
    context: input.context,
    existingSources: enriched.sources,
    model: input.model,
    onProgress: input.onProgress,
    abortSignal: input.abortSignal,
  });

  return {
    model: input.model,
    parsed: mergeProviderSourcesIntoCorpus(enriched.parsed, sources),
    rawText: enriched.rawText,
    result: mergedResult,
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
  abortSignal?: AbortSignal;
}): Promise<GeneratedSonarCorpus> {
  const firstRepair = await repairDeepResearchJson(input);
  const firstRepairStripped = stripUncitedCorpusEntries(firstRepair.parsed, firstRepair.sources);
  const firstRepairMinimums = validateDeepResearchMinimums(
    firstRepairStripped as unknown as Record<string, unknown>,
    firstRepair.sources,
  );

  if (firstRepairMinimums.passed) {
    return { ...firstRepair, parsed: firstRepairStripped };
  }

  await emitRunnerProgress(
    input.onProgress,
    'analysis',
    'tightening the corpus once more against captured citations',
  );

  const secondRepair = await repairDeepResearchJson({
    ...input,
    draftText: firstRepair.rawText || JSON.stringify(firstRepairStripped),
    previousResult: firstRepair.result,
    validationErrors: firstRepairMinimums.errors,
  });
  const secondRepairStripped = stripUncitedCorpusEntries(secondRepair.parsed, secondRepair.sources);
  const secondRepairMinimums = validateDeepResearchMinimums(
    secondRepairStripped as unknown as Record<string, unknown>,
    secondRepair.sources,
  );

  if (secondRepairMinimums.passed) {
    return { ...secondRepair, parsed: secondRepairStripped };
  }

  throw new Error(
    `Perplexity corpus repair failed deterministic minimums: ${secondRepairMinimums.errors.join('; ')}`,
  );
}

async function generateSonarCorpus(input: {
  apiKey: string;
  context: string;
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<GeneratedSonarCorpus> {
  let lastError: unknown;
  const models = getDeepResearchModels();

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];

    if (input.abortSignal?.aborted) {
      throw new Error('Deep research corpus generation aborted by job shutdown');
    }

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
            abortSignal: input.abortSignal,
          });
        } catch (error) {
          if (input.abortSignal?.aborted) {
            throw error;
          }
          console.warn('[deep-research-program] Structured Perplexity corpus generation failed; retrying with draft JSON extraction', {
            error: error instanceof Error ? error.message : String(error),
            model,
          });
          await emitRunnerProgress(
            input.onProgress,
            'analysis',
            'rebuilding corpus JSON from the cited draft',
          );

          // Never burn the draft retry on the slow agentic model — the fast
          // workhorse rebuilds from the same context in a fraction of the time.
          return await generateDraftSonarCorpus({
            apiKey: input.apiKey,
            context: input.context,
            model: model.startsWith(DEEP_RESEARCH_AGENTIC_MODEL_PREFIX)
              ? getDeepResearchModel()
              : model,
            onProgress: input.onProgress,
            abortSignal: input.abortSignal,
          });
        }
      }, 'deepResearchProgram');
      const strippedParsed = stripUncitedCorpusEntries(generated.parsed, generated.sources);
      const droppedRows = countCorpusRows(generated.parsed) - countCorpusRows(strippedParsed);
      if (droppedRows > 0) {
        await emitRunnerProgress(
          input.onProgress,
          'analysis',
          `dropped ${droppedRows} uncited row${droppedRows === 1 ? '' : 's'} to keep the corpus source-grounded`,
        );
      }
      const minimums = validateDeepResearchMinimums(
        strippedParsed as unknown as Record<string, unknown>,
        generated.sources,
      );

      if (minimums.passed) {
        const memoEnriched = await enrichCorpusWithDeepResearchMemo({
          apiKey: input.apiKey,
          context: input.context,
          generated: { ...generated, parsed: strippedParsed },
          onProgress: input.onProgress,
          abortSignal: input.abortSignal,
        });
        const backfilledParsed = await backfillNullOnboardingFields({
          apiKey: input.apiKey,
          onProgress: input.onProgress,
          parsed: memoEnriched.parsed,
          abortSignal: input.abortSignal,
        });

        return {
          ...memoEnriched,
          parsed: scrubProcessTalkFromCorpus(backfilledParsed),
        };
      }

      await emitRunnerProgress(
        input.onProgress,
        'analysis',
        'tightening corpus against captured Perplexity citations',
      );

      const repaired = await repairDeepResearchJsonToMinimums({
        apiKey: input.apiKey,
        context: input.context,
        draftText: generated.rawText || JSON.stringify(strippedParsed),
        model: getDeepResearchModel(),
        onProgress: input.onProgress,
        previousResult: generated.result,
        sources: generated.sources,
        validationErrors: minimums.errors,
        abortSignal: input.abortSignal,
      });
      const memoEnriched = await enrichCorpusWithDeepResearchMemo({
        apiKey: input.apiKey,
        context: input.context,
        generated: repaired,
        onProgress: input.onProgress,
        abortSignal: input.abortSignal,
      });
      const backfilledParsed = await backfillNullOnboardingFields({
        apiKey: input.apiKey,
        onProgress: input.onProgress,
        parsed: memoEnriched.parsed,
        abortSignal: input.abortSignal,
      });

      return {
        ...memoEnriched,
        parsed: scrubProcessTalkFromCorpus(backfilledParsed),
      };
    } catch (error) {
      lastError = error;
      console.warn('[deep-research-program] Perplexity corpus model failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });

      if (input.abortSignal?.aborted) {
        throw error;
      }

      const nextModel = models[modelIndex + 1];
      if (nextModel) {
        await emitRunnerProgress(
          input.onProgress,
          'analysis',
          `falling back to Perplexity ${nextModel}`,
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
  _chatRefinement?: string,
  abortSignal?: AbortSignal,
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
      abortSignal,
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
          'Deep research returned no usable onboardingFields. The structured field review cannot open from shallow field data.',
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
