"use client";

import {
  IndustryMarketContent,
  ICPAnalysisContent,
  OfferAnalysisContent,
  CompetitorAnalysisContent,
  CrossAnalysisContent,
  KeywordIntelligenceContent,
} from "./sections";
import type {
  StrategicBlueprintSection,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
  KeywordIntelligence,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Main Section Content Renderer
// =============================================================================

export interface SectionContentRendererProps {
  sectionKey: StrategicBlueprintSection;
  data: unknown;
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

export function SectionContentRenderer({
  sectionKey,
  data,
  isEditing,
  onFieldChange,
}: SectionContentRendererProps) {
  switch (sectionKey) {
    case "industryMarketOverview":
      return <IndustryMarketContent data={data as IndustryMarketOverview} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "icpAnalysisValidation":
      return <ICPAnalysisContent data={data as ICPAnalysisValidation} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "offerAnalysisViability":
      return <OfferAnalysisContent data={data as OfferAnalysisViability} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "competitorAnalysis":
      return <CompetitorAnalysisContent data={data as CompetitorAnalysis} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "crossAnalysisSynthesis":
      return <CrossAnalysisContent data={data as CrossAnalysisSynthesis} isEditing={isEditing} onFieldChange={onFieldChange} />;
    case "keywordIntelligence":
      return <KeywordIntelligenceContent data={data as KeywordIntelligence} isEditing={isEditing} onFieldChange={onFieldChange} />;
    default:
      return <div className="text-[var(--text-tertiary)]">Unknown section type</div>;
  }
}
