import {
  ALL_POSITIONING_SECTION_IDS,
  ALL_POSITIONING_SECTION_LABELS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  readVerificationFlag,
  readVerificationTier,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';

export interface ProfileVerificationSummary {
  sectionId: AllPositioningSectionId;
  sectionTitle: string;
  verificationTier: VerificationTier;
  verificationFlag: VerificationFlag | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getProfileVerificationSummaries(
  insights: Record<string, unknown> | null,
): ProfileVerificationSummary[] {
  if (!insights) {
    return [];
  }

  const summaries: ProfileVerificationSummary[] = [];

  for (const sectionId of ALL_POSITIONING_SECTION_IDS) {
    const rawInsight = insights[sectionId];
    if (!isRecord(rawInsight)) {
      continue;
    }

    const verificationFlag = readVerificationFlag(rawInsight.verificationFlag);
    const verificationTier =
      readVerificationTier(rawInsight.verificationTier) ??
      verificationFlag?.tier ??
      null;

    if (!verificationTier) {
      continue;
    }

    summaries.push({
      sectionId,
      sectionTitle:
        nonEmptyString(rawInsight.sectionTitle) ??
        ALL_POSITIONING_SECTION_LABELS[sectionId],
      verificationTier,
      verificationFlag,
    });
  }

  return summaries;
}
