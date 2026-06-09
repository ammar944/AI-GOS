import { describe, expect, it } from 'vitest';

import { buildCommitPatch } from '../commit-patch';

describe('buildCommitPatch', (): void => {
  it('persists VoC evidence gaps as insufficient even when review says verified', (): void => {
    const patch = buildCommitPatch('positioningVoiceOfCustomer', {
      sectionTitle: 'Voice of Customer & Objection Evidence',
      verdict: 'Buyer language is under-sourced.',
      statusSummary: 'The run found an evidence gap instead of enough quotes.',
      body: {
        evidenceGap: true,
      },
      verification: {
        verifiedCount: 9,
        unsupportedCount: 1,
        claims: [],
      },
      review: {
        upgradedMarkdown: 'Reviewed VoC markdown.',
        tier: 'verified',
        tierRationale: 'The prose is clean.',
        removedItems: [],
        clientQuestions: [],
      },
      sources: [],
    });

    expect(patch.status).toBe('complete');
    expect(patch.markdown).toBe('Reviewed VoC markdown.');
    expect(patch.verificationTier).toBe('insufficient');
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        confidence: 0.9,
        evidenceGap: true,
      }),
    );
  });

  it('does not let unavailable review metadata downgrade deterministic verified output', (): void => {
    const patch = buildCommitPatch('positioningMarketCategory', {
      sectionTitle: 'Market & Category Intelligence',
      verdict: 'The category claims are source-backed.',
      statusSummary: 'All extracted claims are supported.',
      body: {
        categoryDefinition: 'A supported category definition.',
      },
      verification: {
        verifiedCount: 10,
        unsupportedCount: 0,
        claims: [],
      },
      review: {
        upgradedMarkdown: 'Original verified markdown.',
        tier: 'unavailable',
        tierRationale:
          'Agentic review unavailable: Failed to process successful response',
        removedItems: [],
        clientQuestions: [],
        errorDiagnostics: {
          message: 'Failed to process successful response',
          name: 'AI_NoObjectGeneratedError',
        },
      },
      sources: [],
    });

    expect(patch.markdown).toBe(
      [
        '**Verdict:** The category claims are source-backed.',
        '',
        'All extracted claims are supported.',
      ].join('\n'),
    );
    expect(patch.verificationTier).toBe('verified');
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({
        confidence: 1,
        evidenceGap: false,
        tier: 'verified',
        totalClaims: 10,
        unsupportedCount: 0,
        verifiedCount: 10,
      }),
    );
  });

  it('degrades verified paid-media to needs_review when inputs were degraded', (): void => {
    const patch = buildCommitPatch(
      'positioningPaidMediaPlan',
      {
        sectionTitle: 'Paid Media Plan',
        statusSummary: 'Paid-media plan committed.',
        body: { campaignOverview: { prose: 'A supported overview.' } },
        verification: {
          verifiedCount: 10,
          unsupportedCount: 0,
          claims: [],
        },
        sources: [],
      },
      { degradeToNeedsReview: true },
    );

    expect(patch.verificationTier).toBe('needs_review');
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({ tier: 'needs_review' }),
    );
  });

  it('does not upgrade genuinely-insufficient paid-media when degrading', (): void => {
    const patch = buildCommitPatch(
      'positioningPaidMediaPlan',
      {
        sectionTitle: 'Paid Media Plan',
        statusSummary: 'Evidence gap.',
        body: { evidenceGap: true },
        verification: {
          verifiedCount: 1,
          unsupportedCount: 9,
          claims: [],
        },
        sources: [],
      },
      { degradeToNeedsReview: true },
    );

    expect(patch.verificationTier).toBe('insufficient');
  });

  it('leaves verified paid-media verified when not degrading', (): void => {
    const patch = buildCommitPatch('positioningPaidMediaPlan', {
      sectionTitle: 'Paid Media Plan',
      statusSummary: 'All supported.',
      body: { campaignOverview: { prose: 'A supported overview.' } },
      verification: {
        verifiedCount: 10,
        unsupportedCount: 0,
        claims: [],
      },
      sources: [],
    });

    expect(patch.verificationTier).toBe('verified');
  });
});
