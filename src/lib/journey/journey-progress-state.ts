// Journey-wide progress state — unifies onboarding, blueprint, and media plan
// into a single progress model for the three-stage indicator.

import { REQUIRED_FIELDS, type OnboardingState } from './session-state';
import { BLUEPRINT_STAGES } from '@/hooks/use-generate-page-state';
import {
  MEDIA_PLAN_SECTION_ORDER,
  MEDIA_PLAN_SECTION_LABELS,
  type MediaPlanSectionKey,
} from '@/lib/media-plan/section-constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export type JourneyMacroStage = 'onboarding' | 'strategic-blueprint' | 'media-plan';

export type StageStatus = 'pending' | 'active' | 'completed';

export interface SubStage {
  key: string;
  label: string;
  status: StageStatus;
}

export interface MacroStageProgress {
  stage: JourneyMacroStage;
  label: string;
  status: StageStatus;
  substages: SubStage[];
  completedCount: number;
  totalCount: number;
}

export interface JourneyProgress {
  stages: MacroStageProgress[];
  currentStageIndex: number; // 0-2, -1 if nothing started
  overallProgress: number; // 0-100
}

// ── Input types (what consumers pass in) ──────────────────────────────────────

export interface JourneyProgressInput {
  /** Onboarding state from session (null = not started) */
  onboardingState: Partial<OnboardingState> | null;
  /** Set of completed blueprint section keys (e.g. "Industry", "ICP") */
  completedBlueprintSections: Set<string>;
  /** Whether blueprint is currently generating */
  isBlueprintGenerating: boolean;
  /** Set of completed media plan section keys */
  completedMediaPlanSections: Set<MediaPlanSectionKey>;
  /** Whether media plan is currently generating */
  isMediaPlanGenerating: boolean;
  /** Whether blueprint has been approved/completed */
  isBlueprintComplete: boolean;
  /** Whether media plan has been approved */
  isMediaPlanComplete: boolean;
}

// ── Friendly labels for onboarding required fields ────────────────────────────

const ONBOARDING_FIELD_LABELS: Record<string, string> = {
  businessModel: 'Business Model',
  industry: 'Industry',
  icpDescription: 'Ideal Customer',
  productDescription: 'Product/Service',
  competitors: 'Competitors',
  offerPricing: 'Pricing',
  marketingChannels: 'Channels',
  goals: 'Goals',
};

// ── Core computation ──────────────────────────────────────────────────────────

export function computeJourneyProgress(input: JourneyProgressInput): JourneyProgress {
  const {
    onboardingState,
    completedBlueprintSections,
    isBlueprintGenerating,
    completedMediaPlanSections,
    isMediaPlanGenerating,
    isBlueprintComplete,
    isMediaPlanComplete,
  } = input;

  // ── Onboarding substages ────────────────────────────────────────────────
  const onboardingCompleted = REQUIRED_FIELDS.filter((field) => {
    if (!onboardingState) return false;
    const val = onboardingState[field];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });

  const onboardingSubstages: SubStage[] = REQUIRED_FIELDS.map((field) => {
    const isFieldComplete = onboardingCompleted.includes(field);
    return {
      key: field,
      label: ONBOARDING_FIELD_LABELS[field] ?? field,
      status: isFieldComplete ? 'completed' : 'pending',
    };
  });

  const isOnboardingComplete =
    onboardingState?.phase === 'complete' || onboardingCompleted.length === REQUIRED_FIELDS.length;

  // ── Blueprint substages ─────────────────────────────────────────────────
  const blueprintSubstages: SubStage[] = BLUEPRINT_STAGES.map((stage) => ({
    key: stage,
    label: stage,
    status: completedBlueprintSections.has(stage)
      ? 'completed'
      : isBlueprintGenerating && !completedBlueprintSections.has(stage)
        ? 'pending'
        : 'pending',
  }));

  // Mark the first non-completed section as active during generation
  if (isBlueprintGenerating) {
    const firstPending = blueprintSubstages.find((s) => s.status === 'pending');
    if (firstPending) firstPending.status = 'active';
  }

  // ── Media plan substages ────────────────────────────────────────────────
  const mediaPlanSubstages: SubStage[] = MEDIA_PLAN_SECTION_ORDER.map((key) => ({
    key,
    label: MEDIA_PLAN_SECTION_LABELS[key],
    status: completedMediaPlanSections.has(key)
      ? 'completed'
      : 'pending',
  }));

  if (isMediaPlanGenerating) {
    const firstPending = mediaPlanSubstages.find((s) => s.status === 'pending');
    if (firstPending) firstPending.status = 'active';
  }

  // ── Determine macro stage statuses ──────────────────────────────────────
  const onboardingStatus: StageStatus = isOnboardingComplete
    ? 'completed'
    : onboardingCompleted.length > 0
      ? 'active'
      : 'active'; // Always at least active (user lands on onboarding first)

  const blueprintStatus: StageStatus = isBlueprintComplete || isMediaPlanComplete || isMediaPlanGenerating
    ? 'completed'
    : isBlueprintGenerating || completedBlueprintSections.size > 0
      ? 'active'
      : isOnboardingComplete
        ? 'active'
        : 'pending';

  const mediaPlanStatus: StageStatus = isMediaPlanComplete
    ? 'completed'
    : isMediaPlanGenerating || completedMediaPlanSections.size > 0
      ? 'active'
      : isBlueprintComplete
        ? 'active'
        : 'pending';

  // ── Build stages array ──────────────────────────────────────────────────
  const stages: MacroStageProgress[] = [
    {
      stage: 'onboarding',
      label: 'Onboarding',
      status: onboardingStatus,
      substages: onboardingSubstages,
      completedCount: onboardingCompleted.length,
      totalCount: REQUIRED_FIELDS.length,
    },
    {
      stage: 'strategic-blueprint',
      label: 'Strategic Blueprint',
      status: blueprintStatus,
      substages: blueprintSubstages,
      completedCount: completedBlueprintSections.size,
      totalCount: BLUEPRINT_STAGES.length,
    },
    {
      stage: 'media-plan',
      label: 'Media Plan',
      status: mediaPlanStatus,
      substages: mediaPlanSubstages,
      completedCount: completedMediaPlanSections.size,
      totalCount: MEDIA_PLAN_SECTION_ORDER.length,
    },
  ];

  // ── Current stage index (rightmost active or first pending) ─────────────
  let currentStageIndex = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].status === 'active') {
      currentStageIndex = i;
      break;
    }
  }

  // ── Overall progress (weighted: onboarding 20%, blueprint 40%, media plan 40%)
  const onboardingPct = onboardingCompleted.length / REQUIRED_FIELDS.length;
  const blueprintPct = completedBlueprintSections.size / BLUEPRINT_STAGES.length;
  const mediaPlanPct = completedMediaPlanSections.size / MEDIA_PLAN_SECTION_ORDER.length;

  const overallProgress = Math.round(
    onboardingPct * 20 + blueprintPct * 40 + mediaPlanPct * 40
  );

  return { stages, currentStageIndex, overallProgress };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function getCurrentStage(progress: JourneyProgress): MacroStageProgress {
  return progress.stages[progress.currentStageIndex];
}

export function getStageProgress(
  progress: JourneyProgress,
  stage: JourneyMacroStage
): MacroStageProgress | undefined {
  return progress.stages.find((s) => s.stage === stage);
}

export function getOverallProgress(progress: JourneyProgress): number {
  return progress.overallProgress;
}
