// Media Plan Chat Tools -- barrel export and factory function

export { summarizeMediaPlan, getAffectedValidators, applyMediaPlanEdit } from './utils';
export { runValidationCascade, deriveOfferPrice, deriveRetentionMultiplier } from './validation-cascade';
export type {
  MediaPlanPendingEdit,
  ValidatorCategory,
  ValidationCascadeResult,
  ValidationAutoFix,
  BudgetSimulationResult,
  SimulatedCACSnapshot,
} from './types';

import { createSearchMediaPlanTool } from './search-media-plan';
import { createEditMediaPlanTool } from './edit-media-plan';
import { createExplainMediaPlanTool } from './explain-media-plan';
import { createRecalculateTool } from './recalculate';
import { createSimulateBudgetChangeTool } from './simulate-budget-change';
import { createWebResearchTool } from '@/lib/ai/chat-tools/web-research';
import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

/**
 * Create all chat tools for a given media plan context.
 * Returns a tools object suitable for streamText().
 */
export function createMediaPlanChatTools(
  mediaPlanId: string,
  mediaPlan: MediaPlanOutput,
  onboardingData: OnboardingFormData,
) {
  const mediaPlanRecord = mediaPlan as unknown as Record<string, unknown>;

  return {
    searchMediaPlan: createSearchMediaPlanTool(mediaPlanRecord),
    editMediaPlan: createEditMediaPlanTool(mediaPlanRecord),
    explainMediaPlan: createExplainMediaPlanTool(mediaPlanRecord),
    recalculate: createRecalculateTool(mediaPlan, onboardingData),
    simulateBudgetChange: createSimulateBudgetChangeTool(mediaPlan, onboardingData),
    webResearch: createWebResearchTool(),
  };
}

export type MediaPlanChatTools = ReturnType<typeof createMediaPlanChatTools>;
