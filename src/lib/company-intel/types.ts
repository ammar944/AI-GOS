// Company Intelligence Types
// For auto-filling onboarding from website + LinkedIn research

import type { OnboardingFormData } from '@/lib/onboarding/types';

/**
 * Confidence level for extracted data
 * - high: Explicitly stated in source
 * - medium: Strongly implied or partially found
 * - low: Inferred from limited context
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Source where the data was found
 */
export type DataSource = 'website' | 'linkedin' | 'search' | 'multiple';

/**
 * Metadata for a single extracted field
 */
export interface FieldExtraction<T = string> {
  value: T;
  confidence: ConfidenceLevel;
  source: DataSource;
  /** Specific URL or source reference */
  sourceUrl?: string;
  /** Why the model extracted this value or why it is null */
  reasoning?: string;
}

/**
 * Result of company research - partial onboarding data with metadata
 * Each field is either null (not found) or has value + confidence + source
 */
export interface CompanyResearchResult {
  // Step 1: Business Basics
  businessName: FieldExtraction<string> | null;
  websiteUrl: FieldExtraction<string> | null;

  // Step 2: ICP
  industryVertical: FieldExtraction<string> | null;
  primaryIcpDescription: FieldExtraction<string> | null;
  jobTitles: FieldExtraction<string> | null;
  companySize: FieldExtraction<string> | null;
  geography: FieldExtraction<string> | null;

  // Step 3: Product & Offer
  productDescription: FieldExtraction<string> | null;
  coreDeliverables: FieldExtraction<string> | null;
  valueProp: FieldExtraction<string> | null;
  pricingInfo: FieldExtraction<string> | null;

  // Step 4: Market & Competition
  topCompetitors: FieldExtraction<string> | null;
  uniqueEdge: FieldExtraction<string> | null;
  marketBottlenecks: FieldExtraction<string> | null;

  // Step 5: Customer Journey
  desiredTransformation: FieldExtraction<string> | null;
  commonObjections: FieldExtraction<string> | null;

  // Step 6: Brand & Positioning
  brandPositioning: FieldExtraction<string> | null;
  customerVoice: FieldExtraction<string> | null;

  // Step 7: Assets (detected URLs)
  detectedCaseStudiesUrl: FieldExtraction<string> | null;
  detectedTestimonialsUrl: FieldExtraction<string> | null;
  detectedPricingUrl: FieldExtraction<string> | null;
  detectedDemoUrl: FieldExtraction<string> | null;
}

/**
 * Full response from the prefill service
 */
export interface PrefillOnboardingResponse {
  /** Successfully extracted data */
  extracted: CompanyResearchResult;

  /** Pre-filled form data ready to use */
  prefilled: Partial<OnboardingFormData>;

  /** Citations/sources from research */
  citations: Array<{
    url: string;
    title?: string;
    snippet?: string;
  }>;

  /** Summary of what was found vs not found */
  summary: {
    fieldsFound: number;
    fieldsMissing: number;
    primarySource: DataSource;
  };

  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Input for the prefill service
 */
export interface PrefillOnboardingInput {
  websiteUrl: string;
  linkedinUrl?: string;
  /** Optional: company name if known (helps research) */
  companyName?: string;
}

