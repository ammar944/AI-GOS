/**
 * CANONICAL SOURCE OF TRUTH for research section IDs.
 *
 * All other files that reference research sections (chat-message.tsx,
 * use-research-data.ts, sections/configs.ts, session-state.ts,
 * generate-research.ts, research-progress.tsx) must use these canonical IDs.
 *
 * The research-worker duplicates this mapping in research-worker/src/section-map.ts
 * because it runs as a separate process and cannot import from src/lib/.
 * Keep both files in sync when adding or renaming sections.
 */
export const CANONICAL_RESEARCH_SECTION_ORDER = [
  'industryResearch',
  'competitorIntel',
  'icpValidation',
  'offerAnalysis',
  'strategicSynthesis',
  'keywordIntel',
  'mediaPlan',
] as const;

export type CanonicalResearchSectionId =
  (typeof CANONICAL_RESEARCH_SECTION_ORDER)[number];

export const RESEARCH_CHECKPOINT_SECTION_IDS = [
  'industryResearch',
  'competitorIntel',
  'icpValidation',
  'offerAnalysis',
  'strategicSynthesis',
] as const satisfies ReadonlyArray<CanonicalResearchSectionId>;

const RESEARCH_SECTION_DEPENDENCIES: Record<
  CanonicalResearchSectionId,
  ReadonlyArray<CanonicalResearchSectionId>
> = {
  industryResearch: [],
  competitorIntel: [],
  icpValidation: [],
  offerAnalysis: ['competitorIntel'],
  strategicSynthesis: ['industryResearch', 'competitorIntel', 'icpValidation', 'offerAnalysis'],
  keywordIntel: ['strategicSynthesis'],
  mediaPlan: ['strategicSynthesis', 'keywordIntel'],
};

const LEGACY_TO_CANONICAL_SECTION_MAP: Record<string, CanonicalResearchSectionId> =
  {
    industryMarket: 'industryResearch',
    competitors: 'competitorIntel',
    crossAnalysis: 'strategicSynthesis',
    keywords: 'keywordIntel',
    industryResearch: 'industryResearch',
    competitorIntel: 'competitorIntel',
    icpValidation: 'icpValidation',
    offerAnalysis: 'offerAnalysis',
    strategicSynthesis: 'strategicSynthesis',
    keywordIntel: 'keywordIntel',
    mediaPlan: 'mediaPlan',
  };

export const RESEARCH_SECTION_LABELS: Record<
  CanonicalResearchSectionId,
  string
> = {
  industryResearch: 'Industry Research',
  competitorIntel: 'Competitor Intel',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  strategicSynthesis: 'Strategic Synthesis',
  keywordIntel: 'Keyword Intelligence',
  mediaPlan: 'Media Plan',
};

export function normalizeResearchSectionId(
  sectionId: unknown,
): CanonicalResearchSectionId | null {
  if (typeof sectionId !== 'string') return null;
  const canonical = LEGACY_TO_CANONICAL_SECTION_MAP[sectionId] ?? sectionId;
  if ((CANONICAL_RESEARCH_SECTION_ORDER as readonly string[]).includes(canonical)) {
    return canonical as CanonicalResearchSectionId;
  }
  return null;
}

export function isResearchCheckpointSection(sectionId: unknown): boolean {
  return (
    typeof sectionId === 'string' &&
    (RESEARCH_CHECKPOINT_SECTION_IDS as readonly string[]).includes(sectionId)
  );
}

export function getAffectedResearchSections(
  sectionId: CanonicalResearchSectionId,
): CanonicalResearchSectionId[] {
  const affected = new Set<CanonicalResearchSectionId>([sectionId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const candidate of CANONICAL_RESEARCH_SECTION_ORDER) {
      if (affected.has(candidate)) continue;
      if (RESEARCH_SECTION_DEPENDENCIES[candidate].some((dependency) => affected.has(dependency))) {
        affected.add(candidate);
        changed = true;
      }
    }
  }

  return CANONICAL_RESEARCH_SECTION_ORDER.filter((candidate) => affected.has(candidate));
}

export function normalizeResearchRecord<T>(
  record: Record<string, T> | null | undefined,
): Record<string, T> {
  if (!record) return {};

  const normalized: Record<string, T> = {};
  for (const [sectionId, value] of Object.entries(record)) {
    const normalizedSectionId = normalizeResearchSectionId(sectionId);
    if (!normalizedSectionId) continue;
    normalized[normalizedSectionId] = value;
  }

  return normalized;
}
