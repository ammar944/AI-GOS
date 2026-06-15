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
    expect(patch.markdown).toBe(
      [
        '**Verdict:** Buyer language is under-sourced.',
        '',
        'The run found an evidence gap instead of enough quotes.',
      ].join('\n'),
    );
    expect(patch.verificationTier).toBe('insufficient');
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        confidence: 0.9,
        evidenceGap: true,
      }),
    );
  });

  it('never substitutes review.upgradedMarkdown into the markdown column', (): void => {
    const patch = buildCommitPatch('positioningMarketCategory', {
      sectionTitle: 'Market & Category Intelligence',
      verdict: 'The category wedge is defensible.',
      statusSummary: 'Claims are supported by the committed evidence.',
      body: {
        categoryDefinition: 'A supported category definition.',
      },
      verification: {
        verifiedCount: 8,
        unsupportedCount: 2,
        claims: [],
      },
      review: {
        upgradedMarkdown:
          '# Regenerated prose with an invented $18/seat price.',
        tier: 'needs_review',
        tierRationale: 'One claim needs client proof.',
        removedItems: [],
        clientQuestions: ['Can you confirm seat pricing?'],
      },
      sources: [],
    });

    // The review layer may re-badge (tier merge) but never rewrite the
    // canonical markdown — its output is unverified model prose.
    expect(patch.markdown).toBe(
      [
        '**Verdict:** The category wedge is defensible.',
        '',
        'Claims are supported by the committed evidence.',
      ].join('\n'),
    );
    expect(patch.markdown).not.toContain('$18/seat');
    expect(patch.verificationTier).toBe('needs_review');
  });

  it('clamps the verification flag to the trust-corrected confidence and recomputes the tier', (): void => {
    const patch = buildCommitPatch('positioningPaidMediaPlan', {
      sectionTitle: 'Paid Media Plan',
      verdict: 'Plan is buildable.',
      statusSummary: 'Most claims are supported.',
      body: { campaignOverview: { prose: 'A supported overview.' } },
      verification: {
        verifiedCount: 2,
        unsupportedCount: 1,
        claims: [],
      },
      verifierSummary: {
        computedTrust: {
          claimSupportShare: 0.667,
          confidence: 0.4,
          containmentPassRate: 0.4,
          honestEmptyCore: false,
          livenessPassRate: 0.5,
          quoteForceEmptied: false,
        },
      },
      sources: [],
    });

    // Raw verified share is 2/3 (needs_review); computedTrust 0.4 is the
    // most pessimistic number and wins: confidence clamps, tier recomputes
    // through the existing thresholds (0.4 < 0.5 => insufficient).
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({
        tier: 'insufficient',
        confidence: 0.4,
        verifiedCount: 2,
        unsupportedCount: 1,
      }),
    );
    expect(patch.verificationTier).toBe('insufficient');
  });

  it('ignores a computedTrust confidence above the raw verified share', (): void => {
    const patch = buildCommitPatch('positioningMarketCategory', {
      sectionTitle: 'Market & Category Intelligence',
      verdict: 'Verdict.',
      statusSummary: 'Summary.',
      body: { categoryDefinition: 'A supported category definition.' },
      verification: {
        verifiedCount: 1,
        unsupportedCount: 1,
        claims: [],
      },
      verifierSummary: {
        computedTrust: {
          confidence: 0.9,
        },
      },
      sources: [],
    });

    // Most pessimistic wins: a higher trust number never upgrades the flag.
    expect(patch.verificationFlag).toEqual(
      expect.objectContaining({
        tier: 'needs_review',
        confidence: 0.5,
      }),
    );
    expect(patch.verificationTier).toBe('needs_review');
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

  it('commits an OfferDiagnostic structural-gap artifact as complete + needs_review/insufficient', (): void => {
    // Mirrors the body buildOfferDiagnosticEvidenceGapArtifact produces for a
    // structural floor miss: real rows kept, an honest blockGap injected, a
    // gap-aware verdict/summary, and a low verified share from the gapped block.
    const patch = buildCommitPatch('positioningOfferDiagnostic', {
      sectionTitle: 'Offer Diagnostic',
      verdict:
        'Some offer-diagnostic blocks are below the evidence bar; treat the gapped findings as unproven.',
      statusSummary:
        'The section completed with structural evidence gaps so downstream synthesis can proceed without fabricated rows.',
      confidence: 0.3,
      body: {
        offerMarketFit: {
          prose: 'Fit prose.',
          proofPoints: [],
          blockGap: {
            summary:
              'Only 2 of the required 3 proof points could be sourced from the fetched evidence.',
            foundCount: 2,
            requiredCount: 3,
            sourcingPlan: [
              'Re-run acquisition for offerMarketFit to source 1 more proof points from verified sources.',
            ],
          },
        },
      },
      verification: {
        verifiedCount: 2,
        unsupportedCount: 3,
        claims: [],
      },
      sources: [],
    });

    expect(patch.status).toBe('complete');
    expect(['insufficient', 'needs_review']).toContain(patch.verificationTier);
  });

  it('scrubs internal vocabulary from persisted client-surface data', (): void => {
    const patch = buildCommitPatch('positioningCompetitorLandscape', {
      sectionTitle: 'Competitor Landscape & Positioning',
      verdict: 'Competitors lean on displayable creatives sourced from the corpus.',
      statusSummary: 'Synthesized from web_search and keyword_volume signals.',
      body: {
        adPresence: {
          signals: [
            {
              competitor: 'Acme',
              evidence: 'verifiedCount was 0 across the corpus for this advertiser.',
              sourceUrl: 'https://example.com/ads',
            },
          ],
        },
        adEvidence: {
          advertiserGroups: [
            {
              advertiserName: 'Acme',
              verifiedCount: 4,
              dataGaps: [
                {
                  internalDetail: 'only displayable creatives counted',
                  reason: 'No active ads found.',
                },
              ],
            },
          ],
        },
      },
      verification: { verifiedCount: 4, unsupportedCount: 0, claims: [] },
      sources: [],
    });

    const serialized = JSON.stringify(patch.data);
    for (const token of ['corpus', 'web_search', 'keyword_volume', 'displayable', 'internalDetail']) {
      expect(serialized).not.toContain(token);
    }
    // Honest data + URLs preserved.
    expect(serialized).toContain('https://example.com/ads');
    expect(serialized).toContain('No active ads found.');
    // verdict/summary feeding the markdown column are scrubbed too.
    expect(patch.markdown).not.toContain('displayable');
    expect(patch.markdown).not.toContain('corpus');
  });
});
