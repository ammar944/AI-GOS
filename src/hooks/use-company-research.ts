'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useCallback, useMemo } from 'react';
import { type DeepPartial } from 'ai';
import { companyResearchSchema, type CompanyResearchOutput } from '@/lib/company-intel/schemas';
import type { OnboardingFormData, CompanySize } from '@/lib/onboarding/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESEARCH_FIELD_KEYS = [
  'companyName', 'industry', 'targetCustomers', 'targetJobTitles',
  'companySize', 'headquartersLocation', 'productDescription', 'coreFeatures',
  'valueProposition', 'pricing', 'competitors', 'uniqueDifferentiator',
  'marketProblem', 'customerTransformation', 'commonObjections',
  'brandPositioning', 'testimonialQuote', 'caseStudiesUrl',
  'testimonialsUrl', 'pricingUrl', 'demoUrl',
] as const;

const TOTAL_FIELDS = RESEARCH_FIELD_KEYS.length; // 21

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCompanySize(sizeStr: string | null | undefined): CompanySize | undefined {
  if (!sizeStr) return undefined;

  const lower = sizeStr.toLowerCase();
  const cleanedStr = lower.replace(/,/g, '');
  const numbers = cleanedStr.match(/\d+/g)?.map(Number) || [];
  const maxNum = Math.max(...numbers, 0);

  if (lower.includes('solo') || lower.includes('freelance') || maxNum === 1) return 'solo';
  if (maxNum <= 10) return '1-10';
  if (maxNum <= 50) return '11-50';
  if (maxNum <= 200) return '51-200';
  if (maxNum <= 1000) return '201-1000';
  if (maxNum > 1000 || lower.includes('1000+') || lower.includes('enterprise')) return '1000+';
  return undefined;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseCompanyResearchReturn {
  /** The partially-streamed research result (fields appear progressively) */
  partialResult: DeepPartial<CompanyResearchOutput> | undefined;
  /** Start researching a company */
  submit: (data: { websiteUrl: string; linkedinUrl?: string }) => void;
  /** Whether research is in progress */
  isLoading: boolean;
  /** Error if research failed */
  error: Error | undefined;
  /** Stop the streaming request */
  stop: () => void;
  /** Count of non-null fields found so far */
  fieldsFound: number;
  /** Total fields in the schema */
  totalFields: number;
  /** Map the current partial result to OnboardingFormData for the wizard */
  mapToFormData: () => Partial<OnboardingFormData> | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompanyResearch(): UseCompanyResearchReturn {
  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/onboarding/research',
    schema: companyResearchSchema,
  });

  // ---- fieldsFound --------------------------------------------------------

  const fieldsFound = useMemo(() => {
    if (!object) return 0;

    let count = 0;
    for (const key of RESEARCH_FIELD_KEYS) {
      const field = object[key];
      if (field?.value != null && field.value !== '') {
        count++;
      }
    }
    return count;
  }, [object]);

  // ---- submit wrapper (normalise URLs) ------------------------------------

  const submit = useCallback(
    (data: { websiteUrl: string; linkedinUrl?: string }) => {
      let url = data.websiteUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      submitObject({
        websiteUrl: url,
        linkedinUrl: data.linkedinUrl?.trim() || undefined,
      });
    },
    [submitObject],
  );

  // ---- mapToFormData ------------------------------------------------------

  const mapToFormData = useCallback((): Partial<OnboardingFormData> | null => {
    if (!object) return null;

    const v = (key: keyof CompanyResearchOutput): string =>
      (object[key] as { value?: string | null } | undefined)?.value ?? '';

    const prefilled: Partial<OnboardingFormData> = {
      businessBasics: {
        businessName: v('companyName'),
        websiteUrl: '', // Will be set by the wizard from the input field
      },
    };

    // ICP
    const icpPrimary = v('targetCustomers');
    const icpIndustry = v('industry');
    if (icpPrimary || icpIndustry) {
      prefilled.icp = {
        primaryIcpDescription: icpPrimary,
        industryVertical: icpIndustry,
        jobTitles: v('targetJobTitles'),
        companySize: parseCompanySize(v('companySize')) || '11-50',
        geography: v('headquartersLocation'),
        easiestToClose: '',
        buyingTriggers: '',
        bestClientSources: [],
      };
    }

    // Product & Offer
    const productDesc = v('productDescription');
    const valueProp = v('valueProposition');
    if (productDesc || valueProp) {
      prefilled.productOffer = {
        productDescription: productDesc,
        coreDeliverables: v('coreFeatures'),
        offerPrice: 0,
        pricingModel: 'monthly',
        valueProp: valueProp,
        currentFunnelType: 'lead_form',
      };
    }

    // Market & Competition
    const competitors = v('competitors');
    const uniqueEdge = v('uniqueDifferentiator');
    if (competitors || uniqueEdge) {
      prefilled.marketCompetition = {
        topCompetitors: competitors,
        uniqueEdge: uniqueEdge,
        marketBottlenecks: v('marketProblem'),
      };
    }

    // Customer Journey
    const transformation = v('customerTransformation');
    const objections = v('commonObjections');
    if (transformation || objections) {
      prefilled.customerJourney = {
        situationBeforeBuying: v('marketProblem'),
        desiredTransformation: transformation,
        commonObjections: objections,
        salesCycleLength: '14_to_30_days',
      };
    }

    // Brand & Positioning
    const brand = v('brandPositioning');
    const testimonial = v('testimonialQuote');
    if (brand || testimonial) {
      prefilled.brandPositioning = {
        brandPositioning: brand,
        customerVoice: testimonial,
      };
    }

    // Assets & Proof (detected URLs)
    const caseStudies = v('caseStudiesUrl');
    const testimonials = v('testimonialsUrl');
    const demo = v('demoUrl');
    if (caseStudies || testimonials || demo) {
      prefilled.assetsProof = {
        caseStudiesUrl: caseStudies,
        testimonialsUrl: testimonials,
        landingPageUrl: demo,
      };
    }

    return prefilled;
  }, [object]);

  return {
    partialResult: object,
    submit,
    isLoading,
    error: error ?? undefined,
    stop,
    fieldsFound,
    totalFields: TOTAL_FIELDS,
    mapToFormData,
  };
}
