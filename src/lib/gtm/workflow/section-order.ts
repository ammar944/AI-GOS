import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export const RESEARCH_SECTION_ORDER = [
  'research-market-category',
  'research-buyer-icp',
  'research-competitors',
  'research-voc',
  'research-demand-intent',
  'research-offer-funnel',
] as const satisfies readonly GtmStageKey[];

export type ResearchSectionStage = (typeof RESEARCH_SECTION_ORDER)[number];

export function isResearchSectionStage(stage: GtmStageKey): stage is ResearchSectionStage {
  return (RESEARCH_SECTION_ORDER as readonly GtmStageKey[]).includes(stage);
}
