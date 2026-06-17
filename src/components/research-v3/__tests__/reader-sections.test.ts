import { describe, expect, it } from 'vitest';

import {
  FIRST_READER_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  READER_SECTION_IDS,
  getReaderSectionFromParam,
} from '../reader-sections';

describe('reader section helpers', () => {
  it('orders sections in research pipeline order with paid media last', (): void => {
    expect(READER_SECTION_IDS).toHaveLength(7);
    expect(READER_SECTION_IDS.slice(0, 6)).toEqual([
      'positioningMarketCategory',
      'positioningBuyerICP',
      'positioningCompetitorLandscape',
      'positioningVoiceOfCustomer',
      'positioningDemandIntent',
      'positioningOfferDiagnostic',
    ]);
    expect(READER_SECTION_IDS.at(-1)).toBe(PAID_MEDIA_PLAN_SECTION_ID);
  });

  it('restores valid deep-linked sections and falls back to section one', (): void => {
    expect(getReaderSectionFromParam('positioningVoiceOfCustomer')).toBe(
      'positioningVoiceOfCustomer',
    );
    expect(getReaderSectionFromParam(PAID_MEDIA_PLAN_SECTION_ID)).toBe(
      PAID_MEDIA_PLAN_SECTION_ID,
    );
    expect(getReaderSectionFromParam('unknown-section')).toBe(
      FIRST_READER_SECTION_ID,
    );
    expect(getReaderSectionFromParam(null)).toBe(FIRST_READER_SECTION_ID);
  });
});
