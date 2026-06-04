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
});
