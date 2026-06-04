import { describe, expect, it } from 'vitest';

import { getProfileVerificationSummaries } from '../profile-verification-summary';

describe('profile verification summaries', (): void => {
  it('extracts persisted verification tiers from saved AI insights', (): void => {
    const verificationFlag = {
      tier: 'needs_review',
      verifiedCount: 2,
      unsupportedCount: 1,
      totalClaims: 3,
      confidence: 2 / 3,
      needsReviewThreshold: 0.75,
      insufficientThreshold: 0.5,
      evidenceGap: false,
    };

    expect(
      getProfileVerificationSummaries({
        positioningMarketCategory: {
          sectionTitle: 'Market & Category Intelligence',
          verificationTier: 'needs_review',
          verificationFlag,
        },
        randomKey: {
          verificationTier: 'insufficient',
        },
      }),
    ).toEqual([
      {
        sectionId: 'positioningMarketCategory',
        sectionTitle: 'Market & Category Intelligence',
        verificationTier: 'needs_review',
        verificationFlag,
      },
    ]);
  });
});
