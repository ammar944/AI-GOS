import type { SectionKey, SectionPhase } from './types';

// Pipeline order: competitors before offer so the offer runner gets
// verified competitor pricing via the intelligence chain in dispatch/route.ts.
export const SECTION_PIPELINE: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'crossAnalysis',
  'keywordIntel',
  'offerAnalysis',
  'mediaPlan',
];

/** Human-readable labels for pipeline sections (UI + API errors). */
export const SECTION_PIPELINE_LABELS: Record<SectionKey, string> = {
  industryMarket: 'Market & Category',
  icpValidation: 'Buyer & ICP',
  competitors: 'Competitors',
  crossAnalysis: 'VOC & Objections',
  keywordIntel: 'Demand & Intent',
  offerAnalysis: 'Offer Diagnostic',
  mediaPlan: 'Media Plan',
  scripts: 'Scripts',
};

/**
 * All workspace sections including scripts phase.
 * Used for tab visibility — scripts sits after mediaPlan.
 * Scripts are NOT part of the research pipeline (different API + data model).
 */
export const WORKSPACE_SECTIONS: SectionKey[] = [
  ...SECTION_PIPELINE,
  'scripts',
];

/**
 * Mapping from canonical research section IDs (used by the journey chat tools)
 * to boundary/pipeline IDs (used by the workspace + scripts pipeline).
 * Some sections store results under canonical names, so we check both.
 */
const CANONICAL_ALIASES: Record<string, string[]> = {
  industryMarket: ['industryResearch'],
  competitors: ['competitorIntel'],
  crossAnalysis: ['strategicSynthesis'],
  mediaPlan: ['mediaPlan'],
  icpValidation: ['icpValidation'],
  offerAnalysis: ['offerAnalysis'],
  keywordIntel: ['keywordIntel'],
};

type ResearchSectionEntry = { data?: unknown; status?: string };

function isComplete(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as ResearchSectionEntry;
  return e.status === 'complete' && e.data != null;
}

/**
 * True when every SECTION_PIPELINE key in research_results is complete with data.
 * Checks both boundary IDs (industryMarket) and canonical IDs (industryResearch)
 * because the journey flow may store results under either naming convention.
 * Used to gate script generation and session pickers.
 */
export function getResearchPipelineReadiness(rawResults: Record<string, unknown> | null | undefined): {
  ready: boolean;
  missingSections: SectionKey[];
  completedSectionKeys: SectionKey[];
} {
  const results = rawResults ?? {};
  const missing: SectionKey[] = [];
  const completed: SectionKey[] = [];

  for (const key of SECTION_PIPELINE) {
    // Check the primary boundary key first
    let found = isComplete(results[key]);

    // Fall back to canonical aliases if the boundary key isn't found
    if (!found) {
      const aliases = CANONICAL_ALIASES[key];
      if (aliases) {
        found = aliases.some((alias) => isComplete(results[alias]));
      }
    }

    if (found) {
      completed.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    ready: missing.length === 0,
    missingSections: missing,
    completedSectionKeys: completed,
  };
}

/** Research sections shown in workspace tabs — excludes Media Plan */
export const RESEARCH_SECTIONS: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'crossAnalysis',
  'keywordIntel',
  'offerAnalysis',
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
  for (const key of WORKSPACE_SECTIONS) {
    states[key] = 'queued';
  }
  return states;
}
