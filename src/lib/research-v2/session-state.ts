import type { OnboardingV2Data } from './onboarding-v2-types';
import type { ResearchV2State } from './state-machine';

export interface PersistedResearchV2Session {
  runId: string;
  researchResults: Record<string, unknown> | null;
  onboardingData: Record<string, unknown> | null;
  jobStatus: Record<string, unknown> | null;
  artifactSections?: Record<string, unknown> | null;
  cachedOnboardingData?: Record<string, unknown> | null;
}

function hasPositioningEntry(value: Record<string, unknown> | null): boolean {
  return value
    ? Object.keys(value).some((key) => key.startsWith('positioning'))
    : false;
}

function hasPersistedOnboardingData(
  onboardingData: Record<string, unknown> | null,
): boolean {
  return Boolean(onboardingData && Object.keys(onboardingData).length > 0);
}

/**
 * Infers the visible /research-v3 state from persisted session data.
 *
 * Flow (LOCK 2026-06-24): there is no corpus-before-onboarding gate.
 * 1. Any positioning result/job means the audit reader should be shown.
 * 2. Saved onboarding data means the onboarding has already been completed
 *    (sections were orchestrated), so show the reader.
 * 3. Otherwise the user is still in the onboarding phase. The wizard is
 *    user-filled from blank; a profile's cached onboarding (the operator's
 *    OWN prior input, never a corpus prefill) may seed the form.
 */
export function inferPersistedResearchV2State({
  runId,
  researchResults,
  onboardingData,
  jobStatus,
  artifactSections,
  cachedOnboardingData,
}: PersistedResearchV2Session): ResearchV2State | null {
  if (runId.trim().length === 0) return null;

  if (
    hasPositioningEntry(researchResults) ||
    hasPositioningEntry(jobStatus) ||
    hasPositioningEntry(artifactSections ?? null)
  ) {
    return { kind: 'sections', runId, currentSection: null };
  }

  if (hasPersistedOnboardingData(onboardingData)) {
    return { kind: 'sections', runId, currentSection: null };
  }

  return {
    kind: 'onboarding',
    runId,
    initialData: cachedOnboardingData as Partial<OnboardingV2Data> | undefined,
  };
}