"use client";

import { CheckCircle2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StrategicBlueprintSection, Citation } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";
import { CitationBadge, SourcesList } from "./citations";
import { RESEARCH_SHELL_CLASS } from "./ui-tokens";

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
  keywordIntelligence: "Keyword Intelligence",
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
        RESEARCH_SHELL_CLASS,
        "p-6 md:p-8"
      )}
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-4">
          {/* Section number - cyan for active, green for reviewed */}
          <span
            className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium")}
            style={
              isReviewed
                ? {
                    background: 'var(--success-subtle)',
                    color: 'var(--success)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }
                : {
                    background: 'var(--accent-blue)',
                    color: 'white',
                  }
            }
          >
            {isReviewed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              sectionNumber
            )}
          </span>

          {/* Section title */}
          <div>
            <h2
              className="text-xl font-semibold leading-tight"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              {sectionLabel}
            </h2>
            {/* Status indicators - subtle text instead of blue badges */}
            <div className="flex items-center gap-3 mt-1">
              {citations && citations.length > 0 && (
                <CitationBadge count={citations.length} />
              )}
              {hasEdits && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans), Inter, sans-serif',
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Modified
                </span>
              )}
              {isReviewed && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{
                    color: 'var(--success)',
                    fontFamily: 'var(--font-sans), Inter, sans-serif',
                  }}
                >
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
              "gap-1.5 rounded-full border px-3 text-sm transition-colors duration-200",
              isEditing
                ? "border-transparent shadow-[0_0_15px_rgba(54,94,255,0.2)]"
                : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
            )}
            style={isEditing ? {
              background: 'var(--gradient-primary)',
              color: 'white',
            } : undefined}
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

        {/* Mark as Reviewed - positioned at bottom for natural reading flow */}
        {!isReviewed && (
          <div
            className="mt-8 pt-6 flex justify-end"
            style={{ borderTop: '1px solid var(--border-default)' }}
          >
            <Button
              variant="outline"
              onClick={onMarkReviewed}
              className="gap-2 px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderColor: 'var(--success)',
                color: 'var(--success)',
                background: 'var(--success-subtle)',
                fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Reviewed
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
