// Media Plan — barrel export

export { buildMediaPlanContext } from './context-builder';
export type { MediaPlanContext } from './context-builder';

export { generateMediaPlan } from './generator';

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
