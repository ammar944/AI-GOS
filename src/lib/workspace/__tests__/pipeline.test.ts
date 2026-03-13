import { describe, it, expect } from 'vitest';
import {
  SECTION_PIPELINE,
  getNextSection,
  getSectionIndex,
  isFinalSection,
} from '../pipeline';

describe('SECTION_PIPELINE', () => {
  it('has 6 sections in correct order', () => {
    expect(SECTION_PIPELINE).toEqual([
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
      'keywordIntel',
      'crossAnalysis',
    ]);
  });
});

describe('getNextSection', () => {
  it('returns competitors after industryMarket', () => {
    expect(getNextSection('industryMarket')).toBe('competitors');
  });

  it('returns null after crossAnalysis (last section)', () => {
    expect(getNextSection('crossAnalysis')).toBeNull();
  });

  it('returns crossAnalysis after keywordIntel', () => {
    expect(getNextSection('keywordIntel')).toBe('crossAnalysis');
  });
});

describe('getSectionIndex', () => {
  it('returns 0 for industryMarket', () => {
    expect(getSectionIndex('industryMarket')).toBe(0);
  });

  it('returns 5 for crossAnalysis', () => {
    expect(getSectionIndex('crossAnalysis')).toBe(5);
  });
});

describe('isFinalSection', () => {
  it('returns true for crossAnalysis', () => {
    expect(isFinalSection('crossAnalysis')).toBe(true);
  });

  it('returns false for industryMarket', () => {
    expect(isFinalSection('industryMarket')).toBe(false);
  });
});
