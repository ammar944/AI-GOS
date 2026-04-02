import type { SectionKey, SectionPhase } from './types';

// Pipeline order: competitors before offer so the offer runner gets
// verified competitor pricing via the intelligence chain in dispatch/route.ts.
export const SECTION_PIPELINE: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
  'mediaPlan',
];

/** Research sections shown in workspace tabs — excludes Media Plan */
export const RESEARCH_SECTIONS: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
];

export function getNextSection(current: SectionKey): SectionKey | null {
  const index = SECTION_PIPELINE.indexOf(current);
  if (index === -1 || index === SECTION_PIPELINE.length - 1) return null;
  return SECTION_PIPELINE[index + 1];
}

export function getSectionIndex(section: SectionKey): number {
  return SECTION_PIPELINE.indexOf(section);
}

export function isFinalSection(section: SectionKey): boolean {
  return section === SECTION_PIPELINE[SECTION_PIPELINE.length - 1];
}

export function createInitialSectionStates(): Record<SectionKey, SectionPhase> {
  const states = {} as Record<SectionKey, SectionPhase>;
  for (const key of SECTION_PIPELINE) {
    states[key] = 'queued';
  }
  return states;
}
