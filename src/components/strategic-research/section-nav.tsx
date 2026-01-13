"use client";

import { cn } from "@/lib/utils";
import type { StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";

const SECTION_NAV_ITEMS: { id: StrategicBlueprintSection; label: string }[] = [
  { id: "industryMarketOverview", label: "Industry & Market" },
  { id: "icpAnalysisValidation", label: "ICP Analysis" },
  { id: "offerAnalysisViability", label: "Offer Analysis" },
  { id: "competitorAnalysis", label: "Competitors" },
  { id: "crossAnalysisSynthesis", label: "Synthesis" },
];

interface SectionNavProps {
  activeSection: StrategicBlueprintSection;
  reviewedSections: Set<StrategicBlueprintSection>;
  onNavigate?: (sectionId: StrategicBlueprintSection) => void;
}

export function SectionNav({ activeSection, reviewedSections, onNavigate }: SectionNavProps) {
  const handleClick = (sectionId: StrategicBlueprintSection) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigate?.(sectionId);
  };

  return (
    <nav className="sticky top-6 hidden xl:block">
      <div
        className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] shadow-[var(--shadow-card)]"
      >
      <div className="space-y-1">
        {SECTION_NAV_ITEMS.map((section, i) => {
          const isActive = activeSection === section.id;
          const isReviewed = reviewedSections.has(section.id);

          return (
            <button
              key={section.id}
              onClick={() => handleClick(section.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-all duration-200",
                "rounded-lg text-left",
                "hover:bg-[var(--bg-hover)]",
                isActive
                  ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]"
              )}
            >
              {/* Section number indicator */}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[var(--text-primary)] text-black"
                    : isReviewed
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-[var(--border-default)] text-[var(--text-tertiary)]"
                )}
              >
                {isReviewed && !isActive ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="truncate">{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Progress summary */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="text-xs text-[var(--text-quaternary)] mb-2">Review Progress</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(reviewedSections.size / 5) * 100}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
            {reviewedSections.size}/5
          </span>
        </div>
      </div>
      </div>
    </nav>
  );
}
