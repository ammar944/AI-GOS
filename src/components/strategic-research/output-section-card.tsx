"use client";

import {
  TrendingUp,
  Users,
  Package,
  Swords,
  Lightbulb,
  Search,
} from "lucide-react";
import type { StrategicBlueprintSection, Citation } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";
import { CitationBadge, SourcesList } from "./citations";
import { RESEARCH_SHELL_CLASS } from "./ui-tokens";

// Section icons mapping
const SECTION_ICONS: Record<StrategicBlueprintSection, React.ReactNode> = {
  industryMarketOverview: <TrendingUp className="h-5 w-5" />,
  icpAnalysisValidation: <Users className="h-5 w-5" />,
  offerAnalysisViability: <Package className="h-5 w-5" />,
  competitorAnalysis: <Swords className="h-5 w-5" />,
  crossAnalysisSynthesis: <Lightbulb className="h-5 w-5" />,
  keywordIntelligence: <Search className="h-5 w-5" />,
};

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
 *
 * Follows SaaSLaunch design language:
 * - Card background: var(--bg-card) rgb(12, 14, 19)
 * - Border: var(--border-default) rgb(31, 31, 31)
 * - Section number: var(--accent-blue) rgb(54, 94, 255)
 * - Heading font: var(--font-heading) Instrument Sans
 */
export function OutputSectionCard({
  sectionKey,
  sectionData,
  citations,
}: OutputSectionCardProps) {
  const sectionNumber = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey) + 1;
  const sectionIcon = SECTION_ICONS[sectionKey];
  const sectionLabel = SECTION_LABELS[sectionKey];

  return (
    <section
      id={sectionKey}
      data-section
      className={`${RESEARCH_SHELL_CLASS} rounded-xl p-6 md:p-8`}
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-4">
          {/* Section number - blue accent background */}
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
            style={{
              background: 'var(--accent-blue)',
              color: 'white',
            }}
          >
            {sectionNumber}
          </span>

          {/* Section icon and title */}
          <div className="flex items-center gap-2.5">
            <span style={{ color: 'var(--accent-blue)' }}>
              {sectionIcon}
            </span>
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
          </div>
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
