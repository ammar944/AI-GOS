import { describe, it, expect } from 'vitest';
import {
  SECTION_PIPELINE,
  getNextSection,
  getSectionIndex,
  isFinalSection,
} from '../pipeline';

describe('SECTION_PIPELINE', () => {
  it('has 8 sections in correct order', () => {
    expect(SECTION_PIPELINE).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
      'crossAnalysis',
      'keywordIntel',
      'mediaPlan',
    ]);
  });
});

describe('getNextSection', () => {
  it('returns industryMarket after deepResearchProgram', () => {
    expect(getNextSection('deepResearchProgram')).toBe('industryMarket');
  });

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

  it('returns keywordIntel after crossAnalysis', () => {
    expect(getNextSection('crossAnalysis')).toBe('keywordIntel');
  });

  it('returns offerAnalysis after keywordIntel', () => {
    expect(getNextSection('offerAnalysis')).toBe('crossAnalysis');
  });

  it('returns mediaPlan after keywordIntel', () => {
    expect(getNextSection('keywordIntel')).toBe('mediaPlan');
  });
});

describe('getSectionIndex', () => {
  it('returns 0 for deepResearchProgram', () => {
    expect(getSectionIndex('deepResearchProgram')).toBe(0);
  });

  it('returns 1 for industryMarket', () => {
    expect(getSectionIndex('industryMarket')).toBe(1);
  });

  it('returns 2 for icpValidation', () => {
    expect(getSectionIndex('icpValidation')).toBe(2);
  });

  it('returns 3 for competitors', () => {
    expect(getSectionIndex('competitors')).toBe(3);
  });

  it('returns 4 for offerAnalysis', () => {
    expect(getSectionIndex('offerAnalysis')).toBe(4);
  });

  it('returns 5 for crossAnalysis', () => {
    expect(getSectionIndex('crossAnalysis')).toBe(5);
  });

  it('returns 7 for mediaPlan', () => {
    expect(getSectionIndex('mediaPlan')).toBe(7);
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
