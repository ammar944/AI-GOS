import { describe, expect, it } from 'vitest';
import {
  RESEARCH_CHECKPOINT_SECTION_IDS,
  getAffectedResearchSections,
  isResearchCheckpointSection,
} from '../research-sections';

describe('research section review helpers', () => {
  it('marks only major research cards as review checkpoints', () => {
    expect(RESEARCH_CHECKPOINT_SECTION_IDS).toEqual([
      'industryResearch',
      'competitorIntel',
      'icpValidation',
      'offerAnalysis',
      'strategicSynthesis',
    ]);
    expect(isResearchCheckpointSection('industryResearch')).toBe(true);
    expect(isResearchCheckpointSection('keywordIntel')).toBe(false);
    expect(isResearchCheckpointSection('mediaPlan')).toBe(false);
  });

  it('returns only the invalidated downstream chain for a revised section', () => {
    expect(getAffectedResearchSections('icpValidation')).toEqual([
      'icpValidation',
      'strategicSynthesis',
      'keywordIntel',
      'mediaPlan',
    ]);

    expect(getAffectedResearchSections('competitorIntel')).toEqual([
      'competitorIntel',
      'offerAnalysis',
      'strategicSynthesis',
      'keywordIntel',
      'mediaPlan',
    ]);
  });
});
