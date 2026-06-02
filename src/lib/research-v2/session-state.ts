import type { CorpusSourceLink, ResearchV2State } from './state-machine';
import type { CorpusOnboardingField } from './prefill-from-corpus';
import { prefillFromCorpusWithMetadata } from './prefill-from-corpus';

export interface PersistedResearchV2Session {
  runId: string;
  researchResults: Record<string, unknown> | null;
  onboardingData: Record<string, unknown> | null;
  jobStatus: Record<string, unknown> | null;
  artifactSections?: Record<string, unknown> | null;
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

function readCorpus(
  researchResults: Record<string, unknown> | null,
): { status?: string; data?: unknown } | null {
  const value = researchResults?.deepResearchProgram;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as { status?: string; data?: unknown };
}

function readCorpusOnboardingFields(
  corpusData: unknown,
): Record<string, CorpusOnboardingField> | null {
  if (!corpusData || typeof corpusData !== 'object' || Array.isArray(corpusData)) {
    return null;
  }

  const onboardingFields = (corpusData as Record<string, unknown>).onboardingFields;
  if (
    !onboardingFields ||
    typeof onboardingFields !== 'object' ||
    Array.isArray(onboardingFields)
  ) {
    return null;
  }

  return onboardingFields as Record<string, CorpusOnboardingField>;
}

/**
 * Extracts the corpus's cited sources so they survive into resumed state.
 *
 * Worker shape is `corpus.data.corpus.sources` (array of
 * `{ title, url, whyItMatters }`). The frontend previously dropped this on
 * the floor; threading it through lets the GTM brief review render a
 * persistent "Researched N sources" surface across reload/resume.
 */
function readCorpusSources(corpusData: unknown): CorpusSourceLink[] {
  if (!corpusData || typeof corpusData !== 'object' || Array.isArray(corpusData)) {
    return [];
  }

  const inner = (corpusData as Record<string, unknown>).corpus;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
    return [];
  }

  const sources = (inner as Record<string, unknown>).sources;
  if (!Array.isArray(sources)) return [];

  const seen = new Set<string>();
  const links: CorpusSourceLink[] = [];
  for (const entry of sources) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const whyItMatters =
      typeof record.whyItMatters === 'string' ? record.whyItMatters.trim() : '';
    links.push({
      title: title || url,
      url,
      ...(whyItMatters ? { whyItMatters } : {}),
    });
  }

  return links;
}

/**
 * Infers the visible /research-v2 state from persisted session data.
 *
 * The ordering intentionally mirrors the page contract:
 * 1. Any positioning result/job means the audit reader should be shown.
 * 2. Saved onboarding data means the review has already been completed.
 * 3. A complete corpus means the GTM Brief Review should be shown.
 * 4. Missing or incomplete corpus means the corpus phase is still active.
 */
export function inferPersistedResearchV2State({
  runId,
  researchResults,
  onboardingData,
  jobStatus,
  artifactSections,
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

  const corpus = readCorpus(researchResults);
  if (!corpus || corpus.status !== 'complete') {
    return { kind: 'corpus', runId, phase: 'streaming' };
  }

  const onboardingFields = readCorpusOnboardingFields(corpus.data);
  const prefill = onboardingFields
    ? prefillFromCorpusWithMetadata(onboardingFields)
    : { data: {}, metadata: {} };
  const corpusSources = readCorpusSources(corpus.data);

  return {
    kind: 'onboarding',
    runId,
    prefill: prefill.data,
    prefillMetadata: prefill.metadata,
    corpusSources,
  };
}
