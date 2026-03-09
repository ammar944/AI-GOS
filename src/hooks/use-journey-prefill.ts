'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useCallback, useMemo } from 'react';
import type { DeepPartial } from 'ai';
import { companyResearchSchema, type CompanyResearchOutput } from '@/lib/company-intel/schemas';

const RESEARCH_FIELD_KEYS = [
  'companyName',
  'industry',
  'targetCustomers',
  'targetJobTitles',
  'companySize',
  'headquartersLocation',
  'productDescription',
  'coreFeatures',
  'valueProposition',
  'pricing',
  'competitors',
  'uniqueDifferentiator',
  'marketProblem',
  'customerTransformation',
  'commonObjections',
  'brandPositioning',
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
  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/journey/prefill',
    schema: companyResearchSchema,
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
