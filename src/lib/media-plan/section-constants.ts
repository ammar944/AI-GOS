// Media Plan section metadata — single source of truth
// Replaces duplicated definitions in media-plan-view.tsx and section-content.tsx

import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Globe,
  Target,
  LayoutGrid,
  Palette,
  DollarSign,
  CalendarClock,
  BarChart3,
  Calculator,
  ShieldAlert,
} from "lucide-react";

// =============================================================================
// Section Key
// =============================================================================

export type MediaPlanSectionKey =
  | "executiveSummary"
  | "platformStrategy"
  | "icpTargeting"
  | "campaignStructure"
  | "creativeStrategy"
  | "budgetAllocation"
  | "campaignPhases"
  | "kpiTargets"
  | "performanceModel"
  | "riskMonitoring";

// =============================================================================
// Order
// =============================================================================

export const MEDIA_PLAN_SECTION_ORDER: MediaPlanSectionKey[] = [
  "executiveSummary",
  "platformStrategy",
  "icpTargeting",
  "campaignStructure",
  "creativeStrategy",
  "budgetAllocation",
  "campaignPhases",
  "kpiTargets",
  "performanceModel",
  "riskMonitoring",
];

// =============================================================================
// Labels
// =============================================================================

export const MEDIA_PLAN_SECTION_LABELS: Record<MediaPlanSectionKey, string> = {
  executiveSummary: "Executive Summary",
  platformStrategy: "Platform Strategy",
  icpTargeting: "ICP Targeting",
  campaignStructure: "Campaign Structure",
  creativeStrategy: "Creative Strategy",
  budgetAllocation: "Budget Allocation",
  campaignPhases: "Campaign Phases",
  kpiTargets: "KPI Targets",
  performanceModel: "Performance Model",
  riskMonitoring: "Risk & Monitoring",
};

/** Short labels for pagination dots / compact UI */
export const MEDIA_PLAN_SECTION_SHORT_LABELS: Record<MediaPlanSectionKey, string> = {
  executiveSummary: "Summary",
  platformStrategy: "Platforms",
  icpTargeting: "ICP",
  campaignStructure: "Campaigns",
  creativeStrategy: "Creative",
  budgetAllocation: "Budget",
  campaignPhases: "Phases",
  kpiTargets: "KPIs",
  performanceModel: "Performance",
  riskMonitoring: "Risks",
};

// =============================================================================
// Icons
// =============================================================================

export const MEDIA_PLAN_SECTION_ICONS: Record<MediaPlanSectionKey, LucideIcon> = {
  executiveSummary: FileText,
  platformStrategy: Globe,
  icpTargeting: Target,
  campaignStructure: LayoutGrid,
  creativeStrategy: Palette,
  budgetAllocation: DollarSign,
  campaignPhases: CalendarClock,
  kpiTargets: BarChart3,
  performanceModel: Calculator,
  riskMonitoring: ShieldAlert,
};
