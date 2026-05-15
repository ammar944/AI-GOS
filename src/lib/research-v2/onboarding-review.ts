import {
  SECTION_META,
  type OnboardingFieldPrefillMetadata,
  type OnboardingFieldReview,
  type OnboardingFieldReviewState,
  type OnboardingPrefillMetadata,
  type OnboardingReviewMetadata,
  type OnboardingV2Data,
} from './onboarding-v2-types';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

const EMPTY_COUNTS: Record<OnboardingFieldReviewState, number> = {
  'AI-filled': 0,
  'User-edited': 0,
  Missing: 0,
  'Needs review': 0,
};

function isEmptyValue(value: OnboardingV2Data[keyof OnboardingV2Data]): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return String(value ?? '').trim().length === 0;
}

function normalizeValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean).join('|').toLowerCase();
  }
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeConfidence(confidence: number | null): number | null {
  if (confidence === null || !Number.isFinite(confidence)) return null;
  if (confidence > 1) return confidence / 100;
  return confidence;
}

function fieldStateForValue(
  value: OnboardingV2Data[keyof OnboardingV2Data],
  metadata: OnboardingFieldPrefillMetadata | undefined,
): OnboardingFieldReviewState {
  if (isEmptyValue(value)) return 'Missing';
  if (!metadata) return 'User-edited';
  if (normalizeValue(value) !== normalizeValue(metadata.value)) return 'User-edited';

  const confidence = normalizeConfidence(metadata.confidence);
  if (
    confidence === null ||
    confidence < LOW_CONFIDENCE_THRESHOLD ||
    !metadata.sourceUrl?.trim()
  ) {
    return 'Needs review';
  }

  return 'AI-filled';
}

export function getOnboardingFieldCount(): number {
  return SECTION_META.reduce((count, section) => count + section.fields.length, 0);
}

export function buildOnboardingReviewMetadata(
  data: OnboardingV2Data,
  prefillMetadata: OnboardingPrefillMetadata = {},
): OnboardingReviewMetadata {
  const fields: Partial<Record<keyof OnboardingV2Data, OnboardingFieldReview>> = {};
  const counts: Record<OnboardingFieldReviewState, number> = { ...EMPTY_COUNTS };
  const pinnedFieldKeys: Array<keyof OnboardingV2Data> = [];

  for (const section of SECTION_META) {
    for (const field of section.fields) {
      const value = data[field.key];
      const metadata = prefillMetadata[field.key];
      const state = fieldStateForValue(value, metadata);
      counts[state] += 1;
      if (state === 'Missing' || state === 'Needs review') {
        pinnedFieldKeys.push(field.key);
      }
      fields[field.key] = {
        key: field.key,
        label: field.label,
        sectionId: section.id,
        sectionTitle: section.title,
        state,
        value: Array.isArray(value) ? value : String(value ?? ''),
        aiValue: metadata?.value ?? null,
        confidence: normalizeConfidence(metadata?.confidence ?? null),
        sourceUrl: metadata?.sourceUrl ?? null,
        reasoning: metadata?.reasoning ?? null,
      };
    }
  }

  return {
    source: 'onboarding_v2_review',
    fieldCount: getOnboardingFieldCount(),
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    pinnedFieldKeys,
    counts,
    fields,
  };
}
