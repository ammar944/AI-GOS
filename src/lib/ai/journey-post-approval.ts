import type { JourneyStateSnapshot } from '@/lib/ai/journey-state';
import { JOURNEY_WAVE_TWO_REQUIREMENTS } from '@/lib/journey/field-catalog';

export type PostApprovalNextField =
  | 'topCompetitors'
  | 'productDescription'
  | 'primaryIcpDescription'
  | 'pricingContext'
  | null;

export interface PostApprovalPlan {
  missingInputs: string[];
  nextField: PostApprovalNextField;
  nextWaveReady: boolean;
}

export interface PostCompetitorPlan {
  missingInputs: string[];
  nextField: Exclude<PostApprovalNextField, 'topCompetitors'>;
  nextWaveReady: boolean;
}

function isCollected(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function getPostApprovalPlan(
  snapshot: JourneyStateSnapshot,
): PostApprovalPlan {
  const fields = snapshot.collectedFields;
  const missingInputs: string[] = [];
  let nextField: PostApprovalNextField = null;

  for (const requirement of JOURNEY_WAVE_TWO_REQUIREMENTS) {
    const isReady = requirement.fieldKeys.some((fieldKey) =>
      isCollected(fields[fieldKey]),
    );

    if (isReady) {
      continue;
    }

    missingInputs.push(requirement.label);
    nextField ??= requirement.key;
  }

  return {
    missingInputs,
    nextField,
    nextWaveReady: missingInputs.length === 0,
  };
}

export function getPostCompetitorPlan(
  snapshot: JourneyStateSnapshot,
): PostCompetitorPlan {
  const fields = snapshot.collectedFields;
  const missingInputs: string[] = [];
  let nextField: PostCompetitorPlan['nextField'] = null;

  for (const requirement of JOURNEY_WAVE_TWO_REQUIREMENTS.filter(
    (item) => item.key !== 'topCompetitors',
  )) {
    const isReady = requirement.fieldKeys.some((fieldKey) =>
      isCollected(fields[fieldKey]),
    );

    if (isReady) {
      continue;
    }

    missingInputs.push(requirement.label);
    nextField ??= requirement.key as PostCompetitorPlan['nextField'];
  }

  return {
    missingInputs,
    nextField,
    nextWaveReady: missingInputs.length === 0,
  };
}
