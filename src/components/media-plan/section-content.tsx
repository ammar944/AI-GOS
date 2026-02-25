import type { MediaPlanSectionKey } from "@/lib/media-plan/section-constants";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import {
  ExecutiveSummaryContent,
  PlatformStrategyContent,
  ICPTargetingContent,
  CampaignStructureContent,
  CreativeStrategyContent,
  BudgetAllocationContent,
  CampaignPhasesContent,
  KPITargetsContent,
  PerformanceModelContent,
  RiskMonitoringContent,
} from "./sections";

interface MediaPlanSectionContentProps {
  sectionKey: MediaPlanSectionKey;
  mediaPlan: MediaPlanOutput;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

export function MediaPlanSectionContent({
  sectionKey,
  mediaPlan,
  isEditing,
  onFieldChange,
}: MediaPlanSectionContentProps) {
  switch (sectionKey) {
    case "executiveSummary":
      return <ExecutiveSummaryContent data={mediaPlan.executiveSummary} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "platformStrategy":
      return <PlatformStrategyContent data={mediaPlan.platformStrategy} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "icpTargeting":
      return <ICPTargetingContent data={mediaPlan.icpTargeting} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "campaignStructure":
      return <CampaignStructureContent data={mediaPlan.campaignStructure} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "creativeStrategy":
      return <CreativeStrategyContent data={mediaPlan.creativeStrategy} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "budgetAllocation":
      return <BudgetAllocationContent data={mediaPlan.budgetAllocation} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "campaignPhases":
      return <CampaignPhasesContent data={mediaPlan.campaignPhases} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "kpiTargets":
      return <KPITargetsContent data={mediaPlan.kpiTargets} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "performanceModel":
      return <PerformanceModelContent data={mediaPlan.performanceModel} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "riskMonitoring":
      return <RiskMonitoringContent data={mediaPlan.riskMonitoring} isEditing={isEditing} onFieldChange={onFieldChange} />;
    default:
      return null;
  }
}
