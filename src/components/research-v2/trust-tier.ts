import type {
  VerificationFlag,
  VerificationTier,
} from '@/lib/research-v2/verification-tier';

// Buyer-facing trust language. The verifier works in three internal tiers
// (verified / needs_review / insufficient); collapsing them to a binary
// "Complete vs Complete — needs review" made every finished audit read as a
// wall of failures. This maps the SAME signal to honest, non-alarming labels:
// each tier maps to a distinct truthful badge, no gap is hidden, but a finished
// deliverable reads like a finished deliverable.
export type TrustTierKey =
  | 'complete'
  | 'directional'
  | 'evidence_limited'
  | 'source_check';

export type TrustTierTone = 'positive' | 'neutral' | 'caution';

export interface TrustTier {
  key: TrustTierKey;
  label: string;
  tone: TrustTierTone;
  /** Rail dot: hidden for a fully-grounded section, shown otherwise. */
  showDot: boolean;
  /** One quiet line for a collapsed diagnostic / aria — never inline chrome. */
  diagnostic: string | null;
}

const COMPLETE: TrustTier = {
  key: 'complete',
  label: 'Complete',
  tone: 'positive',
  showDot: false,
  diagnostic: null,
};

// Prefers the rich verificationFlag (claim counts) and degrades to the bare
// tier when only that was persisted (legacy rows). Deterministic — same inputs
// always produce the same buyer label.
export function deriveTrustTier(
  flag: VerificationFlag | undefined,
  tier: VerificationTier | undefined,
): TrustTier {
  const resolvedTier = flag?.tier ?? tier ?? 'verified';

  if (resolvedTier === 'verified') return COMPLETE;

  if (resolvedTier === 'needs_review') {
    return {
      key: 'directional',
      label: 'Directional',
      tone: 'neutral',
      showDot: true,
      diagnostic:
        flag && flag.totalClaims > 0
          ? `${flag.verifiedCount} of ${flag.totalClaims} claims independently grounded`
          : 'Sound direction; confirm specifics before acting',
    };
  }

  // insufficient — split by whether load-bearing claims were actively
  // unverified (needs sourcing) vs the evidence base being thin (directional).
  if (flag && flag.unsupportedCount > 0) {
    const n = flag.unsupportedCount;
    return {
      key: 'source_check',
      label: 'Needs source check',
      tone: 'caution',
      showDot: true,
      diagnostic: `${n} load-bearing ${n === 1 ? 'claim needs' : 'claims need'} an independent source`,
    };
  }

  return {
    key: 'evidence_limited',
    label: 'Evidence limited',
    tone: 'caution',
    showDot: true,
    diagnostic: 'Thin third-party evidence — treat as directional',
  };
}

export function trustTierDotClass(tone: TrustTierTone): string {
  return tone === 'caution' ? 'bg-amber-500' : 'bg-muted-foreground/40';
}
