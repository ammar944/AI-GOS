// Company Intelligence Research Service
// Uses Perplexity via Vercel AI SDK generateObject for structured company extraction

import { generateObject } from 'ai';
import { perplexity, MODELS } from '@/lib/ai/providers';
import { companyResearchSchema, type CompanyResearchOutput, type ResearchedField } from './schemas';
import type {
  PrefillOnboardingInput,
  PrefillOnboardingResponse,
  CompanyResearchResult,
  FieldExtraction,
  ConfidenceLevel,
  DataSource,
} from './types';
import type { OnboardingFormData, CompanySize } from '@/lib/onboarding/types';

/**
 * Research prompt for Perplexity structured extraction.
 * The schema .describe() hints reinforce factual-only behaviour;
 * this prompt provides the research target context.
 */
function buildResearchPrompt(input: PrefillOnboardingInput): string {
  const { websiteUrl, linkedinUrl, companyName } = input;

  return `You are a business researcher extracting factual company information for a marketing onboarding form.

RESEARCH TARGET:
- Website: ${websiteUrl}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ''}
${companyName ? `- Company Name: ${companyName}` : ''}

YOUR TASK:
Research this company thoroughly and extract ONLY verifiable facts. Visit the website, find their LinkedIn, and gather information.

CRITICAL RULES:
1. ONLY include information you can VERIFY from actual sources
2. If you cannot find something, the value MUST be null
3. DO NOT guess, infer, or make up ANY information — null is always better than a guess
4. DO NOT use generic descriptions — be specific to this company
5. Every non-null field MUST have a real sourceUrl pointing to the page where you found it
6. Use the company's own words whenever possible, not your paraphrasing
7. Confidence scores must honestly reflect certainty — do not inflate scores
8. For competitor information, only include if explicitly mentioned or clearly identifiable
9. Include direct quotes for testimonials when available`;
}

/**
 * Map a single ResearchedField to a FieldExtraction, using the model-assessed
 * confidence score and deriving the DataSource from the sourceUrl.
 */
function mapField(
  field: ResearchedField,
  websiteUrl: string,
): FieldExtraction<string> | null {
  if (field.value === null || field.value === '') {
    return null;
  }

  // Map 0-100 numeric confidence to categorical level
  let confidence: ConfidenceLevel;
  if (field.confidence >= 90) {
    confidence = 'high';
  } else if (field.confidence >= 50) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Derive DataSource from sourceUrl
  let source: DataSource = 'search';
  if (field.sourceUrl) {
    if (field.sourceUrl.includes('linkedin.com')) {
      source = 'linkedin';
    } else {
      try {
        const sourceHost = new URL(field.sourceUrl).hostname;
        const companyHost = new URL(websiteUrl).hostname;
        if (sourceHost === companyHost) {
          source = 'website';
        }
      } catch {
        // If URL parsing fails, keep 'search'
      }
    }
  }

  return {
    value: field.value,
    confidence,
    source,
    sourceUrl: field.sourceUrl ?? undefined,
    reasoning: field.reasoning,
  };
}

/**
 * Map structured CompanyResearchOutput to CompanyResearchResult
 */
function mapToResearchResult(
  output: CompanyResearchOutput,
  websiteUrl: string,
): CompanyResearchResult {
  const m = (field: ResearchedField) => mapField(field, websiteUrl);

  return {
    businessName: m(output.companyName),
    websiteUrl: { value: websiteUrl, confidence: 'high', source: 'website' },
    industryVertical: m(output.industry),
    primaryIcpDescription: m(output.targetCustomers),
    jobTitles: m(output.targetJobTitles),
    companySize: m(output.companySize),
    geography: m(output.headquartersLocation),
    productDescription: m(output.productDescription),
    coreDeliverables: m(output.coreFeatures),
    valueProp: m(output.valueProposition),
    pricingInfo: m(output.pricing),
    topCompetitors: m(output.competitors),
    uniqueEdge: m(output.uniqueDifferentiator),
    marketBottlenecks: m(output.marketProblem),
    desiredTransformation: m(output.customerTransformation),
    commonObjections: m(output.commonObjections),
    brandPositioning: m(output.brandPositioning),
    customerVoice: m(output.testimonialQuote),
    detectedCaseStudiesUrl: m(output.caseStudiesUrl),
    detectedTestimonialsUrl: m(output.testimonialsUrl),
    detectedPricingUrl: m(output.pricingUrl),
    detectedDemoUrl: m(output.demoUrl),
  };
}

/**
 * Convert company size string to our enum value
 */
function parseCompanySize(sizeStr: string | null): CompanySize | undefined {
  if (!sizeStr) return undefined;

  const lower = sizeStr.toLowerCase();

  // Remove commas from numbers before parsing (e.g., "10,001" -> "10001")
  const cleanedStr = lower.replace(/,/g, '');

  // Try to extract numbers
  const numbers = cleanedStr.match(/\d+/g)?.map(Number) || [];
  const maxNum = Math.max(...numbers, 0);

  if (lower.includes('solo') || lower.includes('freelance') || maxNum === 1) {
    return 'solo';
  }
  if (maxNum <= 10) return '1-10';
  if (maxNum <= 50) return '11-50';
  if (maxNum <= 200) return '51-200';
  if (maxNum <= 1000) return '201-1000';
  if (maxNum > 1000 || lower.includes('1000+') || lower.includes('enterprise')) {
    return '1000+';
  }

  return undefined;
}

/**
 * Map extracted research to OnboardingFormData structure
 */
function mapToOnboardingData(
  result: CompanyResearchResult
): Partial<OnboardingFormData> {
  const prefilled: Partial<OnboardingFormData> = {
    businessBasics: {
      businessName: result.businessName?.value || '',
      websiteUrl: result.websiteUrl?.value || '',
    },
  };

  // ICP - only include if we have data
  const icpFields = {
    primaryIcpDescription: result.primaryIcpDescription?.value || '',
    industryVertical: result.industryVertical?.value || '',
    jobTitles: result.jobTitles?.value || '',
    companySize: parseCompanySize(result.companySize?.value || null) || '11-50',
    geography: result.geography?.value || '',
    easiestToClose: '', // Requires human input
    buyingTriggers: '', // Requires human input
    bestClientSources: [], // Requires human input
  };

  if (icpFields.primaryIcpDescription || icpFields.industryVertical) {
    prefilled.icp = icpFields;
  }

  // Product & Offer
  const productFields = {
    productDescription: result.productDescription?.value || '',
    coreDeliverables: result.coreDeliverables?.value || '',
    offerPrice: 0, // Requires human input (we don't parse prices)
    pricingModel: 'monthly' as const, // Default
    valueProp: result.valueProp?.value || '',
    currentFunnelType: 'lead_form' as const, // Default
  };

  if (productFields.productDescription || productFields.valueProp) {
    prefilled.productOffer = productFields;
  }

  // Market & Competition
  const marketFields = {
    topCompetitors: result.topCompetitors?.value || '',
    uniqueEdge: result.uniqueEdge?.value || '',
    marketBottlenecks: result.marketBottlenecks?.value || '',
  };

  if (marketFields.topCompetitors || marketFields.uniqueEdge) {
    prefilled.marketCompetition = marketFields;
  }

  // Customer Journey
  const journeyFields = {
    situationBeforeBuying: result.marketBottlenecks?.value || '', // Problem = situation before
    desiredTransformation: result.desiredTransformation?.value || '',
    commonObjections: result.commonObjections?.value || '',
    salesCycleLength: '14_to_30_days' as const, // Default
  };

  if (journeyFields.desiredTransformation || journeyFields.commonObjections) {
    prefilled.customerJourney = journeyFields;
  }

  // Brand & Positioning
  const brandFields = {
    brandPositioning: result.brandPositioning?.value || '',
    customerVoice: result.customerVoice?.value || '',
  };

  if (brandFields.brandPositioning || brandFields.customerVoice) {
    prefilled.brandPositioning = brandFields;
  }

  // Assets & Proof - detected URLs
  const assetFields = {
    caseStudiesUrl: result.detectedCaseStudiesUrl?.value || '',
    testimonialsUrl: result.detectedTestimonialsUrl?.value || '',
    landingPageUrl: result.detectedDemoUrl?.value || '',
  };

  if (Object.values(assetFields).some(v => v)) {
    prefilled.assetsProof = assetFields;
  }

  return prefilled;
}

/**
 * Count fields found vs missing
 */
function countFields(result: CompanyResearchResult): { found: number; missing: number } {
  const fields = Object.values(result);
  const found = fields.filter(f => f !== null).length;
  const missing = fields.filter(f => f === null).length;
  return { found, missing };
}

/**
 * Main research function - uses Perplexity via Vercel AI SDK generateObject
 */
export async function researchCompanyForOnboarding(
  input: PrefillOnboardingInput
): Promise<PrefillOnboardingResponse> {
  console.log('[CompanyIntel] Starting research for:', input.websiteUrl);

  const { object: output, usage } = await generateObject({
    model: perplexity(MODELS.SONAR_PRO),
    schema: companyResearchSchema,
    prompt: buildResearchPrompt(input),
    temperature: 0.1,
    maxOutputTokens: 4000,
  });

  console.log('[CompanyIntel] Perplexity response received', {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });

  // Map to structured result
  const extracted = mapToResearchResult(output, input.websiteUrl);
  const prefilled = mapToOnboardingData(extracted);
  const { found, missing } = countFields(extracted);

  console.log(`[CompanyIntel] Research complete: ${found} fields found, ${missing} missing`);

  // Build warnings
  const warnings: string[] = [];
  if (output.confidenceNotes) {
    warnings.push(output.confidenceNotes);
  }
  if (found < 5) {
    warnings.push('Limited information found. The website may have minimal public content.');
  }

  // Collect source URLs from all non-null fields as citations
  const citations: Array<{ url: string; title?: string; snippet?: string }> = [];
  const seenUrls = new Set<string>();

  for (const field of Object.values(output)) {
    if (typeof field === 'object' && field !== null && 'sourceUrl' in field && field.sourceUrl) {
      if (!seenUrls.has(field.sourceUrl)) {
        seenUrls.add(field.sourceUrl);
        citations.push({ url: field.sourceUrl });
      }
    }
  }

  return {
    extracted,
    prefilled,
    citations,
    summary: {
      fieldsFound: found,
      fieldsMissing: missing,
      primarySource: input.linkedinUrl ? 'multiple' : 'website',
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Quick validation that a URL looks valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a URL looks like a LinkedIn company page
 */
export function isLinkedInCompanyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes('linkedin.com') &&
      parsed.pathname.includes('/company/')
    );
  } catch {
    return false;
  }
}
