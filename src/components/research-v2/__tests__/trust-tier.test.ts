import { describe, it, expect } from 'vitest';

import { deriveTrustTier } from '../trust-tier';
import type { VerificationFlag } from '@/lib/research-v2/verification-tier';

function flag(partial: Partial<VerificationFlag>): VerificationFlag {
  return {
    tier: 'verified',
    verifiedCount: 0,
    unsupportedCount: 0,
    totalClaims: 0,
    confidence: 0,
    needsReviewThreshold: 0.75,
    insufficientThreshold: 0.5,
    evidenceGap: false,
    ...partial,
  };
}

describe('deriveTrustTier', () => {
  it('verified → Complete, no dot, no diagnostic', () => {
    const t = deriveTrustTier(
      flag({ tier: 'verified', verifiedCount: 8, totalClaims: 8, confidence: 1 }),
      'verified',
    );
    expect(t).toMatchObject({
      key: 'complete',
      label: 'Complete',
      showDot: false,
      diagnostic: null,
    });
  });

  it('needs_review with claims → Directional (neutral tone, grounded ratio)', () => {
    const t = deriveTrustTier(
      flag({
        tier: 'needs_review',
        verifiedCount: 6,
        unsupportedCount: 3,
        totalClaims: 9,
        confidence: 6 / 9,
      }),
      'needs_review',
    );
    expect(t.key).toBe('directional');
    expect(t.tone).toBe('neutral');
    expect(t.label).toBe('Directional');
    expect(t.diagnostic).toMatch(/6 of 9 claims/);
  });

  it('insufficient with unsupported load-bearing claims → Needs source check (caution)', () => {
    const t = deriveTrustTier(
      flag({
        tier: 'insufficient',
        verifiedCount: 9,
        unsupportedCount: 1,
        totalClaims: 10,
        confidence: 0.9,
        evidenceGap: true,
      }),
      'insufficient',
    );
    expect(t.key).toBe('source_check');
    expect(t.tone).toBe('caution');
    expect(t.label).toBe('Needs source check');
    expect(t.diagnostic).toMatch(/1 load-bearing claim needs/);
  });

  it('insufficient from thin / zero evidence (no unsupported claims) → Evidence limited', () => {
    const t = deriveTrustTier(
      flag({
        tier: 'insufficient',
        verifiedCount: 0,
        unsupportedCount: 0,
        totalClaims: 0,
        confidence: 0,
        evidenceGap: true,
      }),
      'insufficient',
    );
    expect(t.key).toBe('evidence_limited');
    expect(t.label).toBe('Evidence limited');
  });

  it('falls back to the bare tier when the rich flag is absent (legacy rows)', () => {
    expect(deriveTrustTier(undefined, 'verified').key).toBe('complete');
    expect(deriveTrustTier(undefined, 'needs_review').key).toBe('directional');
    expect(deriveTrustTier(undefined, 'insufficient').key).toBe('evidence_limited');
    // No tier at all defaults to Complete (untiered committed section).
    expect(deriveTrustTier(undefined, undefined).key).toBe('complete');
  });

  it('never emits the internal phrase "needs review" in any buyer label', () => {
    const tiers: Array<VerificationFlag['tier']> = [
      'verified',
      'needs_review',
      'insufficient',
    ];
    for (const tier of tiers) {
      const label = deriveTrustTier(flag({ tier }), tier).label.toLowerCase();
      expect(label).not.toContain('needs review');
    }
  });
});
