// Media Plan — barrel export

export { buildMediaPlanContext } from './context-builder';
export type { MediaPlanContext } from './context-builder';

// Legacy single-call generator (kept for backward compatibility)
export { generateMediaPlan } from './generator';

// New multi-phase pipeline
export { runMediaPlanPipeline } from './pipeline';
export type { PipelineProgress, PipelineOptions, PipelineResult } from './pipeline';

export {
  mediaPlanSchema,
  executiveSummarySchema,
  platformStrategySchema,
  icpTargetingSchema,
  campaignStructureSchema,
  creativeStrategySchema,
  budgetAllocationSchema,
  campaignPhaseSchema,
  kpiTargetSchema,
  performanceModelSchema,
  riskMonitoringSchema,
} from './schemas';

export type {
  // Core output
  MediaPlanOutput,
  MediaPlanMetadata,
  MediaPlanGeneratorResult,
  MediaPlanGenerateInput,

  // Section types
  MediaPlanExecutiveSummary,
  PlatformStrategy,
  ICPTargeting,
  AudienceSegment,
  PlatformTargeting,
  CampaignStructure,
  CampaignTemplate,
  AdSetTemplate,
  NamingConvention,
  RetargetingSegment,
  NegativeKeyword,
  CreativeStrategy,
  CreativeAngle,
  FormatSpec,
  CreativeTestingPlan,
  CreativeRefreshCadence,
  BrandGuideline,
  BudgetAllocation,
  FunnelSplit,
  MonthlyRoadmap,
  CampaignPhase,
  KPITarget,
  PerformanceModel,
  CACModel,
  MonitoringSchedule,
  RiskMonitoring,
  Risk,

  // SSE events
  MediaPlanSection,
  MediaPlanSSEEvent,
  MediaPlanSSESectionStartEvent,
  MediaPlanSSEProgressEvent,
  MediaPlanSSESectionCompleteEvent,
  MediaPlanSSEDoneEvent,
  MediaPlanSSEErrorEvent,
} from './types';

export {
  MEDIA_PLAN_SECTION_LABELS,
  MEDIA_PLAN_STAGES,
} from './types';

// Validation (exported for testing)
export {
  validateAndFixBudget,
  computeCACModel,
  validateCrossSection,
  reconcileKPITargets,
  estimateRetentionMultiplier,
} from './validation';
export type { CACModelInput, BudgetValidationResult, CrossSectionValidationResult } from './validation';

export { createApprovedMediaPlan } from './approval';
export type { ApprovedMediaPlanMetadata } from './approval';

export type { MediaPlanSectionKey } from './section-constants';
export { MEDIA_PLAN_SECTION_ORDER, MEDIA_PLAN_SECTION_SHORT_LABELS, MEDIA_PLAN_SECTION_ICONS } from './section-constants';

export type { AdCopyOutput, AdCopySSEEvent, AngleCopySet, PlatformCopyVariant, MetaAdCopy, GoogleRSACopy, LinkedInAdCopy, TikTokAdCopy, YouTubeAdCopy } from './ad-copy-types';
