import { describe, expect, it } from 'vitest';

import { buildFrozenGtmBriefThesisPatch } from '../orchestrate-db';

describe('buildFrozenGtmBriefThesisPatch', () => {
  it('adds the reviewed GTM Brief snapshot to an unfrozen thesis', () => {
    const result = buildFrozenGtmBriefThesisPatch({
      existingThesis: { prior: 'keep' },
      gtmBriefSnapshot: { companyName: 'Fellow' },
      gtmBriefReview: { fieldCount: 47 },
      frozenAt: '2026-05-15T12:00:00.000Z',
    });

    expect(result.shouldUpdate).toBe(true);
    expect(result.thesis).toEqual({
      prior: 'keep',
      source: 'onboarding_v2_review',
      frozenAt: '2026-05-15T12:00:00.000Z',
      gtmBriefSnapshot: { companyName: 'Fellow' },
      gtmBriefReview: { fieldCount: 47 },
    });
  });

  it('does not overwrite an already frozen snapshot when onboarding changes later', () => {
    const existingThesis = {
      source: 'onboarding_v2_review',
      frozenAt: '2026-05-15T12:00:00.000Z',
      gtmBriefSnapshot: { companyName: 'Original Fellow' },
      gtmBriefReview: { fieldCount: 47 },
    };

    const result = buildFrozenGtmBriefThesisPatch({
      existingThesis,
      gtmBriefSnapshot: { companyName: 'Edited Later' },
      gtmBriefReview: { fieldCount: 47, edited: true },
      frozenAt: '2026-05-15T13:00:00.000Z',
    });

    expect(result.shouldUpdate).toBe(false);
    expect(result.thesis).toBe(existingThesis);
  });
});
