import { describe, it, expect } from 'vitest';
import {
  SECTION_PIPELINE,
  getNextSection,
  getSectionIndex,
  isFinalSection,
} from '../pipeline';

// Pipeline order runs synthesis after competitor intel, then turns that context
// into keyword intelligence before offer and media-plan execution.

describe('SECTION_PIPELINE', () => {
  it('has 7 sections in correct order', () => {
    expect(SECTION_PIPELINE).toEqual([
      'industryMarket',
      'icpValidation',
      'competitors',
      'crossAnalysis',
      'keywordIntel',
      'offerAnalysis',
      'mediaPlan',
    ]);
  });
});

describe('getNextSection', () => {
  it('returns icpValidation after industryMarket', () => {
    expect(getNextSection('industryMarket')).toBe('icpValidation');
  });

  it('returns competitors after icpValidation', () => {
    expect(getNextSection('icpValidation')).toBe('competitors');
  });

  it('returns crossAnalysis after competitors', () => {
    expect(getNextSection('competitors')).toBe('crossAnalysis');
  });

  it('returns null after mediaPlan (last section)', () => {
    expect(getNextSection('mediaPlan')).toBeNull();
  });

  it('returns keywordIntel after crossAnalysis', () => {
    expect(getNextSection('crossAnalysis')).toBe('keywordIntel');
  });

  it('returns offerAnalysis after keywordIntel', () => {
    expect(getNextSection('keywordIntel')).toBe('offerAnalysis');
  });

  it('returns mediaPlan after offerAnalysis', () => {
    expect(getNextSection('offerAnalysis')).toBe('mediaPlan');
  });
});

describe('getSectionIndex', () => {
  it('returns 0 for industryMarket', () => {
    expect(getSectionIndex('industryMarket')).toBe(0);
  });

  it('returns 1 for icpValidation', () => {
    expect(getSectionIndex('icpValidation')).toBe(1);
  });

  it('returns 2 for competitors', () => {
    expect(getSectionIndex('competitors')).toBe(2);
  });

  it('returns 3 for crossAnalysis', () => {
    expect(getSectionIndex('crossAnalysis')).toBe(3);
  });

  it('returns 6 for mediaPlan', () => {
    expect(getSectionIndex('mediaPlan')).toBe(6);
  });
});

describe('isFinalSection', () => {
  it('returns true for mediaPlan', () => {
    expect(isFinalSection('mediaPlan')).toBe(true);
  });

  it('returns false for crossAnalysis', () => {
    expect(isFinalSection('crossAnalysis')).toBe(false);
  });

  it('returns false for industryMarket', () => {
    expect(isFinalSection('industryMarket')).toBe(false);
  });
});
