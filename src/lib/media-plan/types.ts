// Media Plan Output Types
// Canonical types for the media plan generation pipeline

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

// =============================================================================
// Media Plan Output Structure (placeholder — will be refined)
// =============================================================================

export interface MediaPlanExecutiveSummary {
  /** High-level strategy overview */
  overview: string;
  /** Primary objective */
  primaryObjective: string;
  /** Recommended total monthly budget */
  recommendedMonthlyBudget: number;
  /** Expected timeline to first results */
  timelineToResults: string;
  /** Top 3 strategic priorities */
  topPriorities: string[];
}

export interface PlatformStrategy {
  /** Platform name (e.g., "Meta", "LinkedIn", "Google") */
  platform: string;
  /** Why this platform for this client */
  rationale: string;
  /** Budget allocation percentage (0-100) */
  budgetPercentage: number;
  /** Monthly spend for this platform */
  monthlySpend: number;
  /** Campaign types to run */
  campaignTypes: string[];
  /** Target audience description for this platform */
  targetingApproach: string;
  /** Expected CPL range */
  expectedCplRange: { min: number; max: number };
  /** Priority level */
  priority: 'primary' | 'secondary' | 'testing';
}

export interface BudgetAllocation {
  /** Total monthly budget */
  totalMonthlyBudget: number;
  /** Budget by platform */
  platformBreakdown: {
    platform: string;
    monthlyBudget: number;
    percentage: number;
  }[];
  /** Recommended daily budget ceiling */
  dailyCeiling: number;
  /** Budget ramp-up recommendation */
  rampUpStrategy: string;
}

export interface CampaignPhase {
  /** Phase name (e.g., "Foundation", "Scale", "Optimize") */
  name: string;
  /** Phase number (1-based) */
  phase: number;
  /** Duration in weeks */
  durationWeeks: number;
  /** Primary objective for this phase */
  objective: string;
  /** Key activities during this phase */
  activities: string[];
  /** Success criteria for moving to next phase */
  successCriteria: string[];
  /** Estimated budget for this phase */
  estimatedBudget: number;
}

export interface KPITarget {
  /** KPI name */
  metric: string;
  /** Target value */
  target: string;
  /** Timeframe for achieving target */
  timeframe: string;
  /** How this will be measured */
  measurementMethod: string;
}

export interface MediaPlanOutput {
  /** Executive summary of the media plan */
  executiveSummary: MediaPlanExecutiveSummary;
  /** Per-platform strategy breakdown */
  platformStrategy: PlatformStrategy[];
  /** Overall budget allocation */
  budgetAllocation: BudgetAllocation;
  /** Phased campaign rollout */
  campaignPhases: CampaignPhase[];
  /** KPI targets and measurement */
  kpiTargets: KPITarget[];
  /** Generation metadata (populated post-generation, not part of AI output) */
  metadata: MediaPlanMetadata;
}

// =============================================================================
// Metadata
// =============================================================================

export interface MediaPlanMetadata {
  /** When the media plan was generated */
  generatedAt: string;
  /** Output structure version */
  version: string;
  /** Total processing time in ms */
  processingTime: number;
  /** Total cost of AI calls */
  totalCost: number;
  /** Model used for generation */
  modelUsed: string;
  /** ID of the source blueprint (for traceability) */
  sourceBlueprintId?: string;
}

// =============================================================================
// Section Constants
// =============================================================================

export type MediaPlanSection = 'mediaPlan';

export const MEDIA_PLAN_SECTION_LABELS: Record<MediaPlanSection, string> = {
  mediaPlan: 'Media Plan',
};

export const MEDIA_PLAN_STAGES = ['Media Plan'] as const;

// =============================================================================
// SSE Event Types (match blueprint protocol)
// =============================================================================

export interface MediaPlanSSESectionStartEvent {
  type: 'section-start';
  section: MediaPlanSection;
  label: string;
}

export interface MediaPlanSSEProgressEvent {
  type: 'progress';
  percentage: number;
  message: string;
}

export interface MediaPlanSSESectionCompleteEvent {
  type: 'section-complete';
  section: MediaPlanSection;
  label: string;
  data: unknown;
}

export interface MediaPlanSSEDoneEvent {
  type: 'done';
  success: true;
  mediaPlan: MediaPlanOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

export interface MediaPlanSSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

export type MediaPlanSSEEvent =
  | MediaPlanSSESectionStartEvent
  | MediaPlanSSEProgressEvent
  | MediaPlanSSESectionCompleteEvent
  | MediaPlanSSEDoneEvent
  | MediaPlanSSEErrorEvent;

// =============================================================================
// Generator Types
// =============================================================================

export interface MediaPlanGeneratorResult {
  success: boolean;
  mediaPlan?: MediaPlanOutput;
  error?: string;
}

export interface MediaPlanGenerateInput {
  blueprint: StrategicBlueprintOutput;
  onboardingData: OnboardingFormData;
}
