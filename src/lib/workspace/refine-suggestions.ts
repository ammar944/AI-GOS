import type { SectionKey } from '@/lib/workspace/types';

/**
 * Three short suggested refinement prompts per section. Clicking one pre-fills
 * the inline refine input. User can also type free text to override.
 *
 * Bundle spec ref: preview/component-inputs-refine.html + 03-design-system-spec.md
 * ("Inline refine — 3 suggested prompt chips + free text input → streams back").
 */
export const REFINE_SUGGESTIONS: Record<SectionKey, string[]> = {
  industryMarket: [
    'Cite a more recent TAM source',
    'Split the growth drivers by region',
    'Add a sub-segment we missed',
  ],
  icpValidation: [
    'Sharpen the trigger events',
    'Add a new objection and rebuttal',
    'Narrow the audience size range',
  ],
  competitors: [
    'Exclude enterprise-only competitors',
    'Add a mid-market alternative',
    'Deepen the counter-positioning',
  ],
  offerAnalysis: [
    'Reprice against premium benchmark',
    'Swap in a different positioning angle',
    'Strengthen the cold-traffic viability',
  ],
  keywordIntel: [
    'Drop the branded-defense keywords',
    'Add long-tail buyer-intent queries',
    'Re-score by commercial viability',
  ],
  crossAnalysis: [
    'Sharpen the strategic thesis',
    'Rank the opportunities by urgency',
    'Flag the biggest blind spot',
  ],
  mediaPlan: [
    'Rebalance budget toward top-ROAS channel',
    'Add a retargeting phase',
    'Compress the timeline by one phase',
  ],
  scripts: [
    'Punch up the hook',
    'Shorten to 30 seconds',
    'Make it sound less AI',
  ],
};

export function suggestionsForSection(key: SectionKey): string[] {
  return REFINE_SUGGESTIONS[key] ?? [];
}
