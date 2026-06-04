import { describe, expect, it } from 'vitest';

import {
  CROSS_SECTION_REASONING_SECTION_ID,
  FIRST_READER_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SYNTHESIS_SECTION_ID,
  READER_SECTION_IDS,
  getReaderSectionFromParam,
} from '../reader-sections';

describe('reader section helpers', () => {
  it('orders post-six sections as thinker, synthesis, then media plan', (): void => {
    expect(READER_SECTION_IDS).toHaveLength(9);
    expect(READER_SECTION_IDS.at(-3)).toBe(CROSS_SECTION_REASONING_SECTION_ID);
    expect(READER_SECTION_IDS.at(-2)).toBe(POSITIONING_SYNTHESIS_SECTION_ID);
    expect(READER_SECTION_IDS.at(-1)).toBe(PAID_MEDIA_PLAN_SECTION_ID);
  });

  it('restores valid deep-linked sections and falls back to section one', (): void => {
    expect(getReaderSectionFromParam('positioningVoiceOfCustomer')).toBe(
      'positioningVoiceOfCustomer',
    );
    expect(getReaderSectionFromParam(PAID_MEDIA_PLAN_SECTION_ID)).toBe(
      PAID_MEDIA_PLAN_SECTION_ID,
    );
    expect(getReaderSectionFromParam(CROSS_SECTION_REASONING_SECTION_ID)).toBe(
      CROSS_SECTION_REASONING_SECTION_ID,
    );
    expect(getReaderSectionFromParam(POSITIONING_SYNTHESIS_SECTION_ID)).toBe(
      POSITIONING_SYNTHESIS_SECTION_ID,
    );
    expect(getReaderSectionFromParam('unknown-section')).toBe(
      FIRST_READER_SECTION_ID,
    );
    expect(getReaderSectionFromParam(null)).toBe(FIRST_READER_SECTION_ID);
  });
});
