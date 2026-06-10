import type { ReactElement } from 'react';

import type { VerificationReportEnvelope } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  buildVerificationFlag,
  readVerificationFlag,
  readVerificationTier,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';
import { cn } from '@/lib/utils';

export interface VerificationTierBadgeProps {
  verification?: VerificationReportEnvelope | null;
  verificationTier?: VerificationTier | null;
  verificationFlag?: VerificationFlag | null;
  evidenceGap?: boolean;
  className?: string;
}

const TIER_STYLES: Record<VerificationTier, string> = {
  verified: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  needs_review: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  insufficient: 'border-red-500/20 bg-red-500/10 text-red-400',
};

function pluralizeUnsupported(count: number): string {
  return count === 1 ? '1 unsupported claim' : `${count} unsupported claims`;
}

function pluralizeSupported(count: number): string {
  return count === 1 ? '1 supported' : `${count} supported`;
}

function formatPercent(value: number): number {
  return Math.round(value * 100);
}

function tierLabel(tier: VerificationTier): string {
  if (tier === 'verified') return 'Verified';
  if (tier === 'needs_review') return 'Needs review';
  return 'Insufficient evidence';
}

function badgeLabel(input: {
  tier: VerificationTier;
  flag: VerificationFlag | null;
}): string {
  if (!input.flag) {
    return tierLabel(input.tier);
  }

  const grounded = `${formatPercent(input.flag.confidence)}% grounded`;
  if (input.tier === 'verified') {
    return `${tierLabel(input.tier)} · ${pluralizeSupported(
      input.flag.verifiedCount,
    )} · ${grounded}`;
  }

  if (input.flag.evidenceGap) {
    return `${tierLabel(input.tier)} · Declared evidence gap · ${grounded}`;
  }

  return `${tierLabel(input.tier)} · ${pluralizeUnsupported(
    input.flag.unsupportedCount,
  )} · ${grounded}`;
}

function resolveVerificationBadge(input: VerificationTierBadgeProps): {
  tier: VerificationTier;
  flag: VerificationFlag | null;
} | null {
  const persistedTier = readVerificationTier(input.verificationTier);
  const persistedFlag = readVerificationFlag(input.verificationFlag);
  const fallbackFlag = buildVerificationFlag({
    verification: input.verification,
    evidenceGap: input.evidenceGap,
  });
  const flag = persistedFlag ?? fallbackFlag;
  const tier = persistedTier ?? flag?.tier ?? null;

  if (!tier) {
    return null;
  }

  return {
    tier,
    flag: flag ? { ...flag, tier } : null,
  };
}

export function VerificationTierBadge(
  props: VerificationTierBadgeProps,
): ReactElement | null {
  const resolved = resolveVerificationBadge(props);

  if (!resolved) {
    return null;
  }

  const label = badgeLabel(resolved);

  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-1 text-[12px] font-medium',
        TIER_STYLES[resolved.tier],
        props.className,
      )}
    >
      {label}
    </span>
  );
}
