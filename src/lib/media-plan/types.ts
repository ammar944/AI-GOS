// Media Plan MVP - Type Definitions

// =============================================================================
// Form Input Types
// =============================================================================

export interface NicheFormData {
  industry: string;
  audience: string;
  icp: string; // Ideal Customer Profile
}

export interface BriefingFormData {
  budget: number;
  offerPrice: number;
  salesCycleLength: SalesCycleLength;
}

export type SalesCycleLength =
  | "less_than_7_days"
  | "7_to_14_days"
  | "14_to_30_days"
  | "more_than_30_days";

export const SALES_CYCLE_OPTIONS: { value: SalesCycleLength; label: string }[] = [
  { value: "less_than_7_days", label: "Less than 7 days" },
  { value: "7_to_14_days", label: "7-14 days" },
  { value: "14_to_30_days", label: "14-30 days" },
  { value: "more_than_30_days", label: "30+ days" },
];

// =============================================================================
// Pipeline Stage Types
// =============================================================================

// Stage 1: Extract - Structured data from form inputs
export interface ExtractedData {
  industry: {
    name: string;
    vertical: string;
    subNiche: string;
  };
  audience: {
    demographics: string;
    psychographics: string;
    painPoints: string[];
  };
  icp: {
    description: string;
    characteristics: string[];
    buyingBehavior: string;
  };
  budget: {
    total: number;
    currency: string;
  };
  offer: {
    price: number;
    type: "low_ticket" | "mid_ticket" | "high_ticket";
  };
  salesCycle: {
    length: SalesCycleLength;
    daysEstimate: number;
    complexity: "simple" | "moderate" | "complex";
  };
}

// Stage 2: Research - Market research with sources
export interface ResearchData {
  marketOverview: {
    size: string;
    trends: string[];
    growth: string;
  };
  competitors: {
    name: string;
    positioning: string;
    channels: string[];
  }[];
  benchmarks: {
    cpc: { low: number; high: number; average: number };
    cpm: { low: number; high: number; average: number };
    ctr: { low: number; high: number; average: number };
    conversionRate: { low: number; high: number; average: number };
  };
  audienceInsights: {
    platforms: string[];
    contentPreferences: string[];
    peakEngagementTimes: string[];
  };
  sources: {
    title: string;
    url: string;
  }[];
}

// Stage 3: Logic - Business decisions and calculations
export interface LogicData {
  platforms: {
    name: string;
    priority: "primary" | "secondary";
    reason: string;
    budgetPercentage: number;
  }[];
  budgetAllocation: {
    platform: string;
    amount: number;
    percentage: number;
  }[];
  funnelType: {
    name: string;
    stages: string[];
    reason: string;
  };
  kpiTargets: {
    metric: string;
    target: number;
    unit: string;
    rationale: string;
  }[];
}

// Stage 4: Synthesize - Final blueprint
export interface MediaPlanBlueprint {
  executiveSummary: string;
  platformStrategy: {
    platform: string;
    rationale: string;
    tactics: string[];
    budget: number;
  }[];
  budgetBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    notes: string;
  }[];
  funnelStrategy: {
    type: string;
    stages: {
      name: string;
      objective: string;
      channels: string[];
      content: string[];
    }[];
  };
  adAngles: {
    angle: string;
    hook: string;
    targetEmotion: string;
    example: string;
  }[];
  kpiTargets: {
    metric: string;
    target: string;
    benchmark: string;
  }[];
  sources: {
    title: string;
    url: string;
  }[];
  metadata: {
    generatedAt: string;
    totalCost: number;
    processingTime: number;
  };
}

// =============================================================================
// Pipeline State & Progress
// =============================================================================

export type PipelineStage = "extract" | "research" | "logic" | "synthesize" | "complete";

export interface PipelineProgress {
  currentStage: PipelineStage;
  completedStages: PipelineStage[];
  startTime: number;
  stageStartTime: number;
  error?: string;
}

export interface PipelineResult {
  success: boolean;
  blueprint?: MediaPlanBlueprint;
  error?: string;
  metadata: {
    totalTime: number;
    totalCost: number;
    stageTimings: Record<PipelineStage, number>;
  };
}

// =============================================================================
// API Types
// =============================================================================

export interface GenerateMediaPlanRequest {
  niche: NicheFormData;
  briefing: BriefingFormData;
}

export interface GenerateMediaPlanResponse {
  success: boolean;
  blueprint?: MediaPlanBlueprint;
  error?: string;
}
