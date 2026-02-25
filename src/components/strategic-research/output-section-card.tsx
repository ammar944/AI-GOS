"use client";

import type { StrategicBlueprintSection, Citation } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";
import { CitationBadge, SourcesList } from "./citations";
import { SECTION_ACCENT_COLORS } from "./ui-tokens";

// Section labels
const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
  keywordIntelligence: "Keyword Intelligence",
};

export interface OutputSectionCardProps {
  /** The section key to identify which section to render */
  sectionKey: StrategicBlueprintSection;
  /** The section data to display */
  sectionData: unknown;
  /** Citations for this section (sections 1-4 have citations from research agents) */
  citations?: Citation[];
}

/**
 * OutputSectionCard - Read-only section card for the complete blueprint view.
 *
 * Key differences from DocumentSection/SectionCard:
 * - No edit button, no "Mark as Reviewed" button
 * - Always expanded (no collapse/expand toggle)
 * - Simpler header with just section number, icon, and label
 * - Uses SectionContentRenderer for content display (read-only)
 * - Includes SourcesList for citations
 */
export function OutputSectionCard({
  sectionKey,
  sectionData,
  citations,
}: OutputSectionCardProps) {
  const sectionNumber = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey) + 1;
  const sectionLabel = SECTION_LABELS[sectionKey];

  const accentColors = SECTION_ACCENT_COLORS[sectionKey];

  return (
    <section
      id={sectionKey}
      data-section
      className="rounded-xl border border-[rgba(255,255,255,0.06)] p-8 md:p-10"
      style={{
        borderTopColor: accentColors.base + "4D",
        borderTopWidth: "2px",
      }}
    >
      {/* Section Header */}
      <div className="mb-12 flex items-start justify-between gap-4">
        <div>
          <span
            className="text-[13px] font-normal tabular-nums mr-[10px]"
            style={{ color: accentColors.text }}
          >
            {String(sectionNumber).padStart(2, "0")}
          </span>
          <h2 className="inline font-[family-name:var(--font-heading)] text-[22px] font-medium tracking-[-0.025em] text-[rgb(252,252,250)]">
            {sectionLabel}
          </h2>
        </div>

        {/* Citation count badge */}
        {citations && citations.length > 0 && (
          <CitationBadge count={citations.length} />
        )}
      </div>

      {/* Section Content - read-only, no editing */}
      <div className="mt-6">
        <SectionContentRenderer
          sectionKey={sectionKey}
          data={sectionData}
          isEditing={false}
          onFieldChange={() => {}}
        />

        {/* Sources list */}
        {citations && citations.length > 0 && (
          <SourcesList citations={citations} sectionLabel={sectionLabel} />
        )}
      </div>
    </section>
  );
}
