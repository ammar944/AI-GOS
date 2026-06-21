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

export type ValueReadinessLevel = 'rich' | 'adequate' | 'thin' | 'gap';

export interface ValueReadinessBadge {
  /** Strongest per-block readiness present, or null when none self-reported. */
  leadReadiness: ValueReadinessLevel | null;
  /** True when at least one block self-reports "rich" coverage. */
  anyRich: boolean;
  /** Count of committed blocks at each self-reported readiness level. */
  blocksByReadiness: Record<ValueReadinessLevel, number>;
}

function isValueReadinessLevel(value: unknown): value is ValueReadinessLevel {
  return (
    value === 'rich' ||
    value === 'adequate' ||
    value === 'thin' ||
    value === 'gap'
  );
}

function readReadinessCount(
  source: Record<string, unknown>,
  level: ValueReadinessLevel,
): number {
  const raw = source[level];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

// Phase-1 keystone (read side): pull the per-block value-readiness rollup the
// writer stamped into verifierSummary.computedTrust.valueReadiness. Null-tolerant
// — legacy artifacts (no computedTrust / no valueReadiness key) return null and
// the renderer shows nothing new. The split lets the hero surface a "rich" lead
// block even when the section confidence headline is honestly low on one gap.
export function deriveValueReadinessBadge(
  verifierSummary: unknown,
): ValueReadinessBadge | null {
  if (typeof verifierSummary !== 'object' || verifierSummary === null) {
    return null;
  }
  const computedTrust = (verifierSummary as Record<string, unknown>)
    .computedTrust;
  if (typeof computedTrust !== 'object' || computedTrust === null) {
    return null;
  }
  const valueReadiness = (computedTrust as Record<string, unknown>)
    .valueReadiness;
  if (typeof valueReadiness !== 'object' || valueReadiness === null) {
    return null;
  }
  const record = valueReadiness as Record<string, unknown>;
  const blocksRecord =
    typeof record.blocksByReadiness === 'object' &&
    record.blocksByReadiness !== null
      ? (record.blocksByReadiness as Record<string, unknown>)
      : {};
  return {
    leadReadiness: isValueReadinessLevel(record.leadReadiness)
      ? record.leadReadiness
      : null,
    anyRich: record.anyRich === true,
    blocksByReadiness: {
      rich: readReadinessCount(blocksRecord, 'rich'),
      adequate: readReadinessCount(blocksRecord, 'adequate'),
      thin: readReadinessCount(blocksRecord, 'thin'),
      gap: readReadinessCount(blocksRecord, 'gap'),
    },
  };
}
