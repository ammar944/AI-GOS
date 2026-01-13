"use client";

import { CheckCircle2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StrategicBlueprintSection, Citation } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";
import { CitationBadge, SourcesList } from "./citations";

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
};

export interface DocumentSectionProps {
  sectionKey: StrategicBlueprintSection;
  sectionData: unknown;
  isReviewed: boolean;
  isEditing: boolean;
  hasEdits: boolean;
  citations?: Citation[];
  onMarkReviewed: () => void;
  onToggleEdit: () => void;
  onFieldChange: (fieldPath: string, newValue: unknown) => void;
}

export function DocumentSection({
  sectionKey,
  sectionData,
  isReviewed,
  isEditing,
  hasEdits,
  citations,
  onMarkReviewed,
  onToggleEdit,
  onFieldChange,
}: DocumentSectionProps) {
  const sectionNumber = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey) + 1;
  const sectionLabel = SECTION_LABELS[sectionKey];

  return (
    <section
      id={sectionKey}
      data-section
      className={cn(
        "scroll-mt-6 mb-6 rounded-xl",
        "bg-[var(--bg-card)] border border-[var(--border-default)]",
        "shadow-[var(--shadow-card)]",
        "p-6 md:p-8"
      )}
    >
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Section number - monochrome design */}
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
              isReviewed
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-[var(--text-primary)] text-black"
            )}
          >
            {isReviewed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              sectionNumber
            )}
          </span>

          {/* Section title */}
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {sectionLabel}
            </h2>
            {/* Status indicators - subtle text instead of blue badges */}
            <div className="flex items-center gap-3 mt-1">
              {citations && citations.length > 0 && (
                <CitationBadge count={citations.length} />
              )}
              {hasEdits && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Pencil className="h-3 w-3" />
                  Modified
                </span>
              )}
              {isReviewed && (
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Reviewed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions - right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Edit button */}
          <Button
            variant={isEditing ? "default" : "ghost"}
            size="sm"
            onClick={onToggleEdit}
            className={cn(
              "gap-1.5 text-sm",
              isEditing
                ? "bg-[var(--text-primary)] text-black hover:bg-[var(--text-secondary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            {isEditing ? (
              <>
                <Check className="h-4 w-4" />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Edit
              </>
            )}
          </Button>

          {/* Mark as reviewed button */}
          {!isReviewed && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkReviewed}
              className="gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-green-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Reviewed
            </Button>
          )}
        </div>
      </div>

      {/* Section Content - always visible */}
      <div className="mt-6">
        <SectionContentRenderer
          sectionKey={sectionKey}
          data={sectionData}
          isEditing={isEditing}
          onFieldChange={onFieldChange}
        />

        {/* Sources list */}
        {citations && citations.length > 0 && (
          <SourcesList citations={citations} sectionLabel={sectionLabel} />
        )}
      </div>
    </section>
  );
}
