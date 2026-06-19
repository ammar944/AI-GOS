import { describe, expect, it } from 'vitest';

import type {
  ArtifactEnvelope,
  VerificationReportEnvelope,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { SectionId } from '@/lib/lab-engine/events/activity-event';

import {
  deriveDowngradeNeedsReview,
  deriveWave2TrustConfidence,
  hasHonestEmptyCore,
} from '../run-section';
import type { SourceLivenessResult } from '../verification/source-liveness';

function buildVerificationReport({
  unsupportedCount,
  verifiedCount,
}: {
  unsupportedCount: number;
  verifiedCount: number;
}): VerificationReportEnvelope {
  return {
    claims: [
      ...Array.from({ length: verifiedCount }, (_, index) => ({
        claim: {
          kind: 'quote' as const,
          raw: `Verified sourced claim ${index + 1}`,
          value: `Verified sourced claim ${index + 1}`,
        },
        matchedSourceRef: {
          excerptIndex: 0,
          kind: 'corpusExcerpt' as const,
          sourceUrl: 'https://example.com/source',
        },
        status: 'verified' as const,
      })),
      ...Array.from({ length: unsupportedCount }, (_, index) => ({
        claim: {
          kind: 'numeric' as const,
          raw: `Unsupported numeric claim ${index + 1}`,
          value: `${index + 1}`,
        },
        reason: 'no_match' as const,
        status: 'unsupported' as const,
      })),
    ],
    unsupportedCount,
    verifiedCount,
  };
}

function buildArtifact({
  body,
  sectionId,
  verification,
}: {
  body: Record<string, unknown>;
  sectionId: SectionId;
  verification: VerificationReportEnvelope;
}): ArtifactEnvelope {
  return {
    body,
    confidence: 1,
    createdAt: '2026-06-12T00:00:00.000Z',
    id: 'artifact-tier-honesty',
    runId: 'run-tier-honesty',
    sectionId,
    sectionTitle: 'Tier Honesty Fixture',
    sources: [
      {
        id: 'source-1',
        observedAt: '2026-06-12T00:00:00.000Z',
        title: 'Fixture source',
        url: 'https://example.com/source',
      },
    ],
    statusSummary: 'Fixture status.',
    verdict: 'Fixture verdict.',
    verification,
  };
}

function buildSourceLivenessResult(
  input: Partial<SourceLivenessResult> = {},
): SourceLivenessResult {
  return {
    body: {},
    checkedUrls: [],
    containmentPassRate: 1,
    droppedRows: [],
    downgradedRows: [],
    livenessPassRate: 1,
    livenessUnknownRows: [],
    networkUnavailable: false,
    ...input,
  };
}

describe('tier honesty trust derivation', (): void => {
  it('does not apply the 0.4 honest-empty-core cap to non-empty CompetitorLandscape bodies with peripheral gap notes', (): void => {
    const body = {
      adEvidence: {
        advertiserGroups: [
          {
            advertiserName: 'Asana',
            dataGaps: [
              {
                reason:
                  'Evidence gap: LinkedIn library probe returned no displayable rows.',
              },
            ],
            verifiedCount: 116,
          },
        ],
        prose:
          'Evidence gap disclosed for one ad-library surface; verified competitor evidence remains available.',
      },
      competitorSet: {
        competitors: [
          {
            name: 'Asana',
            sourceUrl: 'https://asana.com/',
          },
        ],
        prose: 'Asana is a named competitor with sourced positioning evidence.',
      },
    };
    const artifact = buildArtifact({
      body,
      sectionId: 'positioningCompetitorLandscape',
      verification: buildVerificationReport({
        unsupportedCount: 16,
        verifiedCount: 116,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: hasHonestEmptyCore(body),
      quoteForceEmptied: false,
      sectionId: 'positioningCompetitorLandscape',
      sourceLiveness: buildSourceLivenessResult(),
    });

    expect(trust?.honestEmptyCore).toBe(false);
    expect(trust?.claimSupportShare).toBeCloseTo(116 / 132, 6);
    expect(trust?.confidence).toBeCloseTo(116 / 132, 6);
    expect(trust?.confidence).toBeGreaterThan(0.4);
  });

  it('keeps the 0.4 cap when the core evidence block is genuinely gap-substituted', (): void => {
    const body = {
      shareOfVoice: {
        blockGap: {
          foundCount: 0,
          requiredCount: 3,
          summary:
            'Rows in this block were removed before publishing because their cited sources could not be verified live.',
        },
        prose:
          'Rows in this block were removed before publishing because their cited sources could not be verified live.',
        slices: [],
      },
    };
    const artifact = buildArtifact({
      body,
      sectionId: 'positioningCompetitorLandscape',
      verification: buildVerificationReport({
        unsupportedCount: 1,
        verifiedCount: 9,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: hasHonestEmptyCore(body),
      quoteForceEmptied: false,
      sectionId: 'positioningCompetitorLandscape',
      sourceLiveness: buildSourceLivenessResult(),
    });

    expect(trust?.honestEmptyCore).toBe(true);
    expect(trust?.claimSupportShare).toBe(0.9);
    expect(trust?.confidence).toBe(0.4);
  });

  it('treats small-N JS-walled containment failures as unknown instead of binding the confidence min', (): void => {
    const artifact = buildArtifact({
      body: {
        keywordDemand: {
          keywords: [{ keyword: 'airtable automation' }],
        },
      },
      sectionId: 'positioningDemandIntent',
      verification: buildVerificationReport({
        unsupportedCount: 1,
        verifiedCount: 8,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: false,
      quoteForceEmptied: false,
      sectionId: 'positioningDemandIntent',
      sourceLiveness: buildSourceLivenessResult({
        checkedUrls: [
          {
            containmentChecked: true,
            containmentPassed: true,
            livenessPassed: true,
            sourceUrl: 'https://example.com/source',
            status: 200,
          },
          {
            containmentChecked: true,
            containmentPassed: false,
            livenessPassed: true,
            sourceUrl: 'https://www.youtube.com/watch?v=fixture',
            status: 200,
          },
        ],
        containmentPassRate: 0.5,
      }),
    });

    expect(trust?.claimSupportShare).toBeCloseTo(8 / 9, 6);
    expect(trust?.containmentKnownRate).toBe(1);
    expect(trust?.smallNContainmentUnknownCount).toBe(1);
    expect(trust?.confidence).toBeCloseTo(8 / 9, 6);
  });

  it('keeps BuyerICP decorative-citation containment failures at 0.1-class', (): void => {
    const artifact = buildArtifact({
      body: {
        icpExistenceCheck: {
          firmographicCuts: [{ cutType: 'industry', value: 'SaaS' }],
        },
      },
      sectionId: 'positioningBuyerICP',
      verification: buildVerificationReport({
        unsupportedCount: 0,
        verifiedCount: 10,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: false,
      quoteForceEmptied: false,
      sectionId: 'positioningBuyerICP',
      sourceLiveness: buildSourceLivenessResult({
        checkedUrls: Array.from({ length: 10 }, (_, index) => ({
          containmentChecked: true,
          containmentPassed: index === 0,
          livenessPassed: true,
          sourceUrl:
            index % 2 === 0
              ? `https://plain-blog-${index}.example.com/post`
              : `https://wiki-${index}.example.org/page`,
          status: 200,
        })),
        containmentPassRate: 0.1,
      }),
    });

    expect(trust?.claimSupportShare).toBe(1);
    expect(trust?.containmentKnownRate).toBe(0.1);
    expect(trust?.smallNContainmentUnknownCount).toBe(0);
    expect(trust?.confidence).toBe(0.1);
  });

  it('lifts BuyerICP confidence off the containment floor when rows were kept-and-downgraded', (): void => {
    const artifact = buildArtifact({
      body: {
        personaReality: {
          personas: [
            {
              name: 'Lauren Feeney',
              sourceUrl: 'https://next.ramp.com/customers/perplexity',
              verification: { outcome: 'downgraded', reach: 'uncontained' },
            },
          ],
        },
      },
      sectionId: 'positioningBuyerICP',
      verification: buildVerificationReport({
        unsupportedCount: 5,
        verifiedCount: 5,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: false,
      quoteForceEmptied: false,
      sectionId: 'positioningBuyerICP',
      sourceLiveness: buildSourceLivenessResult({
        checkedUrls: Array.from({ length: 10 }, (_, index) => ({
          containmentChecked: true,
          containmentPassed: index === 0,
          livenessPassed: true,
          sourceUrl: `https://plain-blog-${index}.example.com/post`,
          status: 200,
        })),
        containmentPassRate: 0.1,
        downgradedRows: [
          {
            path: 'body.personaReality.personas[0]',
            strippedRow: {
              summary: 'Lauren Feeney, Controller at Perplexity',
              originalTier: 'hard_evidence',
              droppedReason: 'containment-mismatch: not on live page',
              sourceUrl: 'https://next.ramp.com/customers/perplexity',
            },
          },
        ],
      }),
    });

    // Containment "failures" that were deliberately kept-and-downgraded must not
    // re-tank the floor; confidence tracks the claim-support share instead.
    expect(trust?.claimSupportShare).toBeCloseTo(0.5, 6);
    expect(trust?.confidence).toBeCloseTo(0.5, 6);
  });

  it('caps the downgrade confidence lift at a directional ceiling when containment is poor', (): void => {
    const artifact = buildArtifact({
      body: {
        personaReality: {
          personas: [
            {
              name: 'Lauren Feeney',
              sourceUrl: 'https://next.ramp.com/customers/perplexity',
              verification: { outcome: 'downgraded', reach: 'uncontained' },
            },
          ],
        },
      },
      sectionId: 'positioningBuyerICP',
      verification: buildVerificationReport({
        unsupportedCount: 1,
        verifiedCount: 19,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: false,
      quoteForceEmptied: false,
      sectionId: 'positioningBuyerICP',
      sourceLiveness: buildSourceLivenessResult({
        checkedUrls: Array.from({ length: 10 }, (_, index) => ({
          containmentChecked: true,
          containmentPassed: index === 0,
          livenessPassed: true,
          sourceUrl: `https://plain-blog-${index}.example.com/post`,
          status: 200,
        })),
        containmentPassRate: 0.1,
        downgradedRows: [
          {
            path: 'body.personaReality.personas[0]',
            strippedRow: {
              summary: 'Lauren Feeney, Controller at Perplexity',
              originalTier: 'hard_evidence',
              droppedReason: 'containment-mismatch: not on live page',
              sourceUrl: 'https://next.ramp.com/customers/perplexity',
            },
          },
        ],
      }),
    });

    // claimSupportShare is 19/20 = 0.95, but containment is 0.1 — a single
    // downgraded row must not let a low-containment section read 0.95. The lift
    // is bounded by a directional ceiling.
    expect(trust?.claimSupportShare).toBeCloseTo(0.95, 6);
    expect(trust?.confidence).toBeCloseTo(0.6, 6);
  });

  // R1: a committed deadline-exhaustion honest-gap body (every block empty +
  // gap-substituted) tiers as an honest gap (needs_review/insufficient) — it
  // has an honest empty core and its confidence is capped at 0.4, never the
  // verified tier.
  it('tiers a deadline-exhaustion honest-gap body as honest-empty-core, not verified', (): void => {
    const note = 'evidence gap: section exceeded its time budget — rerun to retry';
    const gapBlock = (requiredCount: number) => ({
      summary: note,
      foundCount: 0,
      requiredCount,
      sourcingPlan: ['Rerun this section to retry — it exceeded its time budget'],
    });
    const body = {
      offerMarketFit: { prose: note, proofPoints: [], blockGap: gapBlock(3) },
      funnelDiagnosis: { prose: note, breaks: [], blockGap: gapBlock(2) },
      channelTruth: { prose: note, channels: [], blockGap: gapBlock(3) },
      retentionHealth: { prose: note, signals: [], blockGap: gapBlock(1) },
      redFlags: { prose: note, items: [], blockGap: gapBlock(3) },
    };
    const artifact = buildArtifact({
      body,
      sectionId: 'positioningOfferDiagnostic',
      verification: buildVerificationReport({
        unsupportedCount: 0,
        verifiedCount: 1,
      }),
    });
    const trust = deriveWave2TrustConfidence({
      artifact,
      honestEmptyCore: hasHonestEmptyCore(body),
      quoteForceEmptied: false,
      sectionId: 'positioningOfferDiagnostic',
      sourceLiveness: buildSourceLivenessResult(),
    });

    expect(trust?.honestEmptyCore).toBe(true);
    expect(trust?.confidence).toBeLessThanOrEqual(0.4);
  });
});

describe('deriveDowngradeNeedsReview', (): void => {
  it('relaxes the review badge only for a clean downgrade with kept personas', (): void => {
    expect(
      deriveDowngradeNeedsReview({ personaCount: 3, hasProvenanceConcern: false }),
    ).toBe(false);
  });

  it('keeps the review badge when the persona gap dominates', (): void => {
    expect(
      deriveDowngradeNeedsReview({ personaCount: 0, hasProvenanceConcern: false }),
    ).toBe(true);
  });

  it('keeps the review badge when a provenance/attribution strip fired', (): void => {
    expect(
      deriveDowngradeNeedsReview({ personaCount: 3, hasProvenanceConcern: true }),
    ).toBe(true);
  });
});
