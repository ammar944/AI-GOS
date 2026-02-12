// Media Plan — barrel export

export { buildMediaPlanContext } from './context-builder';
export type { MediaPlanContext } from './context-builder';

export { generateMediaPlan } from './generator';

export { mediaPlanSchema } from './schemas';

export type {
  MediaPlanOutput,
  MediaPlanMetadata,
  MediaPlanSection,
  MediaPlanSSEEvent,
  MediaPlanSSESectionStartEvent,
  MediaPlanSSEProgressEvent,
  MediaPlanSSESectionCompleteEvent,
  MediaPlanSSEDoneEvent,
  MediaPlanSSEErrorEvent,
  MediaPlanGeneratorResult,
  MediaPlanGenerateInput,
  MediaPlanExecutiveSummary,
  PlatformStrategy,
  BudgetAllocation,
  CampaignPhase,
  KPITarget,
} from './types';

export {
  MEDIA_PLAN_SECTION_LABELS,
  MEDIA_PLAN_STAGES,
} from './types';
