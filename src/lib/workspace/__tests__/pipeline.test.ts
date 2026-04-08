import { describe, it, expect } from 'vitest';
import {
  SECTION_PIPELINE,
  getNextSection,
  getSectionIndex,
  isFinalSection,
} from '../pipeline';

// Pipeline order was reordered so the offer runner gets verified competitor
// pricing via the intelligence chain. icpValidation now precedes competitors,
// and competitors precedes offerAnalysis.

describe('SECTION_PIPELINE', () => {
  it('has 7 sections in correct order', () => {
    expect(SECTION_PIPELINE).toEqual([
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
      'keywordIntel',
      'crossAnalysis',
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

  it('returns offerAnalysis after competitors', () => {
    expect(getNextSection('competitors')).toBe('offerAnalysis');
  });

  it('returns null after mediaPlan (last section)', () => {
    expect(getNextSection('mediaPlan')).toBeNull();
  });

  it('returns mediaPlan after crossAnalysis', () => {
    expect(getNextSection('crossAnalysis')).toBe('mediaPlan');
  });

  it('returns crossAnalysis after keywordIntel', () => {
    expect(getNextSection('keywordIntel')).toBe('crossAnalysis');
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

  it('returns 5 for crossAnalysis', () => {
    expect(getSectionIndex('crossAnalysis')).toBe(5);
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
