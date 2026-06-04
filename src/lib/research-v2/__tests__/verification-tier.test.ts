import { describe, expect, it } from 'vitest';

import {
  deriveVerificationFlag,
  shouldFlagNeedsReview,
} from '../verification-tier';

describe('verification tiering', (): void => {
  it('marks confidence at or above 0.75 as verified', (): void => {
    expect(
      deriveVerificationFlag({ verifiedCount: 3, unsupportedCount: 1 }),
    ).toEqual(
      expect.objectContaining({
        tier: 'verified',
        confidence: 0.75,
        verifiedCount: 3,
        unsupportedCount: 1,
      }),
    );
    expect(
      shouldFlagNeedsReview({ verifiedCount: 3, unsupportedCount: 1 }),
    ).toBe(false);
  });

  it('marks confidence below 0.75 and at least 0.5 as needs_review', (): void => {
    expect(
      deriveVerificationFlag({ verifiedCount: 2, unsupportedCount: 1 }),
    ).toEqual(
      expect.objectContaining({
        tier: 'needs_review',
        confidence: 2 / 3,
      }),
    );
    expect(
      shouldFlagNeedsReview({ verifiedCount: 2, unsupportedCount: 1 }),
    ).toBe(true);
  });

  it('marks confidence below 0.5 as insufficient', (): void => {
    expect(
      deriveVerificationFlag({ verifiedCount: 1, unsupportedCount: 2 }),
    ).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        confidence: 1 / 3,
      }),
    );
    expect(
      shouldFlagNeedsReview({ verifiedCount: 1, unsupportedCount: 2 }),
    ).toBe(true);
  });

  it('marks zero extracted claims as insufficient instead of dividing by zero', (): void => {
    expect(
      deriveVerificationFlag({ verifiedCount: 0, unsupportedCount: 0 }),
    ).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        totalClaims: 0,
        confidence: 0,
      }),
    );
  });

  it('maps body evidenceGap to insufficient even with otherwise high confidence', (): void => {
    expect(
      deriveVerificationFlag({
        verifiedCount: 9,
        unsupportedCount: 1,
        evidenceGap: true,
      }),
    ).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        confidence: 0.9,
        evidenceGap: true,
      }),
    );
  });
});
