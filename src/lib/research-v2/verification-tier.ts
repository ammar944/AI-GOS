export const VERIFIED_MIN_CONFIDENCE = 0.75;
export const INSUFFICIENT_MAX_CONFIDENCE = 0.5;

export type VerificationTier = 'verified' | 'needs_review' | 'insufficient';

export interface VerificationFlag {
  tier: VerificationTier;
  verifiedCount: number;
  unsupportedCount: number;
  totalClaims: number;
  confidence: number;
  needsReviewThreshold: number;
  insufficientThreshold: number;
  evidenceGap: boolean;
}

export interface VerificationTierInput {
  verifiedCount: unknown;
  unsupportedCount: unknown;
  evidenceGap?: unknown;
}

export interface BuildVerificationFlagInput {
  verification: unknown;
  evidenceGap?: unknown;
}

export type VerificationTierCounts = Record<VerificationTier, number>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return 0;
  }

  return value;
}

function normalizeConfidence(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeThreshold(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

export function readVerificationTier(value: unknown): VerificationTier | null {
  if (
    value === 'verified' ||
    value === 'needs_review' ||
    value === 'insufficient'
  ) {
    return value;
  }

  return null;
}

export function deriveVerificationFlag(
  input: VerificationTierInput,
): VerificationFlag {
  const verifiedCount = normalizeCount(input.verifiedCount);
  const unsupportedCount = normalizeCount(input.unsupportedCount);
  const totalClaims = verifiedCount + unsupportedCount;
  const confidence = totalClaims === 0 ? 0 : verifiedCount / totalClaims;
  const evidenceGap = input.evidenceGap === true;
  const tier: VerificationTier =
    evidenceGap || confidence < INSUFFICIENT_MAX_CONFIDENCE
      ? 'insufficient'
      : confidence < VERIFIED_MIN_CONFIDENCE
        ? 'needs_review'
        : 'verified';

  return {
    tier,
    verifiedCount,
    unsupportedCount,
    totalClaims,
    confidence,
    needsReviewThreshold: VERIFIED_MIN_CONFIDENCE,
    insufficientThreshold: INSUFFICIENT_MAX_CONFIDENCE,
    evidenceGap,
  };
}

export function shouldFlagNeedsReview(input: VerificationTierInput): boolean {
  return deriveVerificationFlag(input).tier !== 'verified';
}

export function buildVerificationFlag(
  input: BuildVerificationFlagInput,
): VerificationFlag | null {
  const verification = isRecord(input.verification) ? input.verification : null;
  const evidenceGap = input.evidenceGap === true;

  if (!verification && !evidenceGap) {
    return null;
  }

  return deriveVerificationFlag({
    verifiedCount: verification?.verifiedCount,
    unsupportedCount: verification?.unsupportedCount,
    evidenceGap,
  });
}

export function readVerificationFlag(value: unknown): VerificationFlag | null {
  if (!isRecord(value)) {
    return null;
  }

  const tier = readVerificationTier(value.tier);
  if (!tier) {
    return null;
  }

  const verifiedCount = normalizeCount(value.verifiedCount);
  const unsupportedCount = normalizeCount(value.unsupportedCount);
  const totalClaims = normalizeCount(value.totalClaims);
  const derivedTotalClaims = verifiedCount + unsupportedCount;
  const fallbackConfidence =
    derivedTotalClaims === 0 ? 0 : verifiedCount / derivedTotalClaims;

  return {
    tier,
    verifiedCount,
    unsupportedCount,
    totalClaims: totalClaims > 0 ? totalClaims : derivedTotalClaims,
    confidence: normalizeConfidence(value.confidence, fallbackConfidence),
    needsReviewThreshold: normalizeThreshold(
      value.needsReviewThreshold,
      VERIFIED_MIN_CONFIDENCE,
    ),
    insufficientThreshold: normalizeThreshold(
      value.insufficientThreshold,
      INSUFFICIENT_MAX_CONFIDENCE,
    ),
    evidenceGap: value.evidenceGap === true,
  };
}

export function createEmptyVerificationTierCounts(): VerificationTierCounts {
  return {
    verified: 0,
    needs_review: 0,
    insufficient: 0,
  };
}
