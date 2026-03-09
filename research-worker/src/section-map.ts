/**
 * Mirror of canonical section IDs from src/lib/journey/research-sections.ts.
 * The worker runs as a separate process and cannot import from src/lib/,
 * so these mappings are duplicated here. Keep both files in sync.
 */
export const TOOL_SECTION_MAP = {
  researchIndustry: 'industryResearch',
  researchCompetitors: 'competitorIntel',
  researchICP: 'icpValidation',
  researchOffer: 'offerAnalysis',
  synthesizeResearch: 'strategicSynthesis',
  researchKeywords: 'keywordIntel',
  researchMediaPlan: 'mediaPlan',
} as const;

const LEGACY_TO_CANONICAL_SECTION_MAP: Record<string, string> = {
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

export function normalizeResearchSection(section: string): string {
  return LEGACY_TO_CANONICAL_SECTION_MAP[section] ?? section;
}

export function normalizeResearchRecord<T>(
  record: Record<string, T> | null | undefined,
): Record<string, T> {
  if (!record) return {};

  const normalized: Record<string, T> = {};
  for (const [section, value] of Object.entries(record)) {
    normalized[normalizeResearchSection(section)] = value;
  }

  return normalized;
}
