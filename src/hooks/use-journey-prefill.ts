'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useCallback, useMemo } from 'react';
import type { DeepPartial } from 'ai';
import { companyResearchSchema, type CompanyResearchOutput } from '@/lib/company-intel/schemas';
import { createJourneyGuardedFetch } from '@/lib/journey/http';

// Aligned with companyResearchSchema field names (matches lead agent FIELD_LABELS)
const RESEARCH_FIELD_KEYS = [
  // Business Basics
  'companyName',
  'businessModel',
  'industryVertical',
  // ICP
  'primaryIcpDescription',
  'jobTitles',
  'companySize',
  'geography',
  'headquartersLocation',
  // Product & Offer
  'productDescription',
  'coreDeliverables',
  'pricingTiers',
  'valueProp',
  'guarantees',
  // Market & Competition
  'topCompetitors',
  'uniqueEdge',
  'marketProblem',
  // Customer Journey
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  // Brand
  'brandPositioning',
  'testimonialQuote',
  // Asset URLs
  'caseStudiesUrl',
  'testimonialsUrl',
  'pricingUrl',
  'demoUrl',
] as const;

export interface UseJourneyPrefillReturn {
  partialResult: DeepPartial<CompanyResearchOutput> | undefined;
  submit: (data: { websiteUrl: string; linkedinUrl?: string }) => void;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  fieldsFound: number;
}

function normalizeOptionalUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

export function useJourneyPrefill(): UseJourneyPrefillReturn {
  const guardedFetch = useMemo(
    () => createJourneyGuardedFetch('Website analysis'),
    [],
  );

  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/journey/prefill',
    schema: companyResearchSchema,
    fetch: guardedFetch,
  });

  const fieldsFound = useMemo(() => {
    if (!object) return 0;

    let count = 0;
    for (const key of RESEARCH_FIELD_KEYS) {
      const field = object[key];
      if (field?.value != null && field.value !== '') count++;
    }
    return count;
  }, [object]);

  const submit = useCallback(
    (data: { websiteUrl: string; linkedinUrl?: string }) => {
      const websiteUrl = normalizeOptionalUrl(data.websiteUrl);
      if (!websiteUrl) return;

      submitObject({
        websiteUrl,
        linkedinUrl: normalizeOptionalUrl(data.linkedinUrl),
      });
    },
    [submitObject],
  );

  return {
    partialResult: object,
    submit,
    isLoading,
    error: error ?? undefined,
    stop,
    fieldsFound,
  };
}
