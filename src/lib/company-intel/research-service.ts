// Company Intelligence Research Service
// Uses Perplexity via OpenRouter to research companies for onboarding auto-fill

import { createOpenRouterClient, MODELS, extractCitations } from '@/lib/openrouter/client';
import type {
  PrefillOnboardingInput,
  PrefillOnboardingResponse,
  CompanyResearchResult,
  RawCompanyExtraction,
  FieldExtraction,
  ConfidenceLevel,
  DataSource,
} from './types';
import type { OnboardingFormData, CompanySize } from '@/lib/onboarding/types';

/**
 * Research prompt for Perplexity
 * Designed to extract factual, verifiable information only
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
2. If you cannot find something, return null for that field
3. DO NOT guess, infer, or make up ANY information
4. DO NOT use generic descriptions - be specific to this company
5. For competitor information, only include if explicitly mentioned or clearly identifiable
6. Include direct quotes for testimonials when available
7. Note URLs for case studies, testimonials, pricing, and demo pages if you find them

EXTRACT THIS INFORMATION (return null if not found):

{
  "company_name": "Official company name",
  "industry": "Primary industry/vertical they operate in",
  "description": "What the company does - from their own description",
  "target_customers": "Who they sell to (industries, company types)",
  "target_job_titles": "Job titles they target (if mentioned)",
  "company_size": "Employee count or range (e.g., '50-100' or '500+')",
  "headquarters_location": "City, State/Country",
  "product_description": "What their product/service does",
  "core_features": "Main features or deliverables they highlight",
  "value_proposition": "Their main value prop or tagline",
  "pricing": "Pricing information if publicly available",
  "competitors": "Named competitors (only if mentioned or obvious)",
  "unique_differentiator": "What makes them different (their words)",
  "market_problem": "The problem they solve (their words)",
  "customer_transformation": "The outcome/result they promise",
  "common_objections": "Any objections they address on site",
  "brand_positioning": "How they position themselves",
  "testimonial_quote": "A real customer quote if found",
  "case_studies_url": "URL to case studies page if exists",
  "testimonials_url": "URL to testimonials/reviews page if exists",
  "pricing_url": "URL to pricing page if exists",
  "demo_url": "URL to demo/trial page if exists",
  "confidence_notes": "Brief notes on what you found vs couldn't verify"
}

Respond with ONLY the JSON object, no other text.`;
}

/**
 * Clean citation markers from Perplexity responses
 * e.g., "All-in-one workspace[2]" -> "All-in-one workspace"
 */
function cleanCitationMarkers(text: string): string {
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Map raw extraction to structured CompanyResearchResult
 */
function mapToResearchResult(
  raw: RawCompanyExtraction,
  websiteUrl: string,
  linkedinUrl?: string
): CompanyResearchResult {
  const createField = <T>(
    value: T | null,
    source: DataSource = 'website'
  ): FieldExtraction<T> | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Clean citation markers if it's a string
    let cleanedValue = value;
    if (typeof value === 'string') {
      cleanedValue = cleanCitationMarkers(value) as T;
      if (cleanedValue === '') return null;
    }

    // Determine confidence based on content characteristics
    let confidence: ConfidenceLevel = 'medium';
    if (typeof cleanedValue === 'string') {
      // High confidence for specific, detailed content
      if (cleanedValue.length > 50 || cleanedValue.includes('"') || cleanedValue.includes('$')) {
        confidence = 'high';
      }
      // Low confidence for vague content
      if (cleanedValue.toLowerCase().includes('likely') || cleanedValue.toLowerCase().includes('probably')) {
        confidence = 'low';
      }
    }
    return { value: cleanedValue, confidence, source };
  };

  // Determine primary source
  const source: DataSource = linkedinUrl ? 'multiple' : 'website';

  return {
    businessName: createField(raw.company_name, source),
    websiteUrl: createField(websiteUrl, 'website'),
    industryVertical: createField(raw.industry, source),
    primaryIcpDescription: createField(raw.target_customers, source),
    jobTitles: createField(raw.target_job_titles, source),
    companySize: createField(raw.company_size, linkedinUrl ? 'linkedin' : 'search'),
    geography: createField(raw.headquarters_location, source),
    productDescription: createField(raw.product_description, 'website'),
    coreDeliverables: createField(raw.core_features, 'website'),
    valueProp: createField(raw.value_proposition, 'website'),
    pricingInfo: createField(raw.pricing, 'website'),
    topCompetitors: createField(raw.competitors, 'search'),
    uniqueEdge: createField(raw.unique_differentiator, 'website'),
    marketBottlenecks: createField(raw.market_problem, 'website'),
    desiredTransformation: createField(raw.customer_transformation, 'website'),
    commonObjections: createField(raw.common_objections, 'website'),
    brandPositioning: createField(raw.brand_positioning, 'website'),
    customerVoice: createField(raw.testimonial_quote, 'website'),
    detectedCaseStudiesUrl: createField(raw.case_studies_url, 'website'),
    detectedTestimonialsUrl: createField(raw.testimonials_url, 'website'),
    detectedPricingUrl: createField(raw.pricing_url, 'website'),
    detectedDemoUrl: createField(raw.demo_url, 'website'),
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
 * Main research function - uses Perplexity to research a company
 */
export async function researchCompanyForOnboarding(
  input: PrefillOnboardingInput
): Promise<PrefillOnboardingResponse> {
  const client = createOpenRouterClient();

  console.log('[CompanyIntel] Starting research for:', input.websiteUrl);

  // Use Perplexity Sonar for web research with citations
  const response = await client.chat({
    model: MODELS.PERPLEXITY_SONAR,
    messages: [
      {
        role: 'user',
        content: buildResearchPrompt(input),
      },
    ],
    temperature: 0.1, // Low temp for factual extraction
    maxTokens: 2000,
    timeout: 60000, // 60s timeout for research
  });

  console.log('[CompanyIntel] Perplexity response received, parsing...');

  // Extract citations from Perplexity response
  const citations = extractCitations(response);

  // Parse the JSON response
  let rawExtraction: RawCompanyExtraction;
  try {
    // Clean the response - remove markdown code blocks if present
    let content = response.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    rawExtraction = JSON.parse(content);
  } catch (error) {
    console.error('[CompanyIntel] Failed to parse response:', error);
    console.error('[CompanyIntel] Raw response:', response.content);

    // Return empty result on parse failure
    return {
      extracted: {
        businessName: null,
        websiteUrl: { value: input.websiteUrl, confidence: 'high', source: 'website' },
        industryVertical: null,
        primaryIcpDescription: null,
        jobTitles: null,
        companySize: null,
        geography: null,
        productDescription: null,
        coreDeliverables: null,
        valueProp: null,
        pricingInfo: null,
        topCompetitors: null,
        uniqueEdge: null,
        marketBottlenecks: null,
        desiredTransformation: null,
        commonObjections: null,
        brandPositioning: null,
        customerVoice: null,
        detectedCaseStudiesUrl: null,
        detectedTestimonialsUrl: null,
        detectedPricingUrl: null,
        detectedDemoUrl: null,
      },
      prefilled: {
        businessBasics: {
          businessName: '',
          websiteUrl: input.websiteUrl,
        },
      },
      citations: citations.map(c => ({
        url: c.url,
        title: c.title,
        snippet: c.snippet,
      })),
      summary: {
        fieldsFound: 1,
        fieldsMissing: 20,
        primarySource: 'website',
      },
      warnings: ['Failed to parse research response. Please fill in fields manually.'],
    };
  }

  // Map to structured result
  const extracted = mapToResearchResult(rawExtraction, input.websiteUrl, input.linkedinUrl);
  const prefilled = mapToOnboardingData(extracted);
  const { found, missing } = countFields(extracted);

  console.log(`[CompanyIntel] Research complete: ${found} fields found, ${missing} missing`);

  // Build warnings
  const warnings: string[] = [];
  if (rawExtraction.confidence_notes) {
    warnings.push(rawExtraction.confidence_notes);
  }
  if (found < 5) {
    warnings.push('Limited information found. The website may have minimal public content.');
  }

  return {
    extracted,
    prefilled,
    citations: citations.map(c => ({
      url: c.url,
      title: c.title,
      snippet: c.snippet,
    })),
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
