'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { useCallback, useMemo } from 'react';
import { type DeepPartial } from 'ai';
import {
  STEP_SUGGESTION_SCHEMAS,
  type SuggestableStep,
  type SuggestedField,
} from '@/lib/company-intel/step-schemas';
import type { OnboardingFormData } from '@/lib/onboarding/types';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseStepSuggestionReturn {
  /** The partially-streamed suggestion result */
  suggestions: DeepPartial<Record<string, SuggestedField>> | undefined;
  /** Trigger suggestion generation */
  submit: (formData: Partial<OnboardingFormData>) => void;
  /** Whether suggestions are being generated */
  isLoading: boolean;
  /** Error if suggestion failed */
  error: Error | undefined;
  /** Stop the streaming request */
  stop: () => void;
  /** Count of suggestion fields received so far */
  fieldsFound: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStepSuggestion(step: SuggestableStep): UseStepSuggestionReturn {
  const { object, submit: submitObject, isLoading, error, stop } = useObject({
    api: '/api/onboarding/suggest',
    schema: STEP_SUGGESTION_SCHEMAS[step],
  });

  // ---- fieldsFound ----------------------------------------------------------

  const fieldsFound = useMemo(() => {
    if (!object) return 0;

    let count = 0;
    const entries = Object.values(object) as Array<DeepPartial<SuggestedField> | undefined>;
    for (const field of entries) {
      if (field?.value != null && field.value !== '') {
        count++;
      }
    }
    return count;
  }, [object]);

  // ---- submit wrapper -------------------------------------------------------

  const submit = useCallback(
    (formData: Partial<OnboardingFormData>) => {
      submitObject({ step, formData });
    },
    [submitObject, step],
  );

  return {
    suggestions: object as DeepPartial<Record<string, SuggestedField>> | undefined,
    submit,
    isLoading,
    error: error ?? undefined,
    stop,
    fieldsFound,
  };
}
