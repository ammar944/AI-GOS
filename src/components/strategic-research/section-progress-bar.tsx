"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/motion";
import type { StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
  keywordIntelligence: "Keyword Intelligence",
};

interface SectionProgressBarProps {
  sections: StrategicBlueprintSection[];
  currentPage: number;
  /** Pass -1 or omit to hide the reviewed count (read-only mode) */
  reviewedCount: number;
}

export function SectionProgressBar({
  sections,
  currentPage,
  reviewedCount,
}: SectionProgressBarProps) {
  const total = sections.length;
  const currentSection = sections[currentPage];
  const progressPercent = ((currentPage + 1) / total) * 100;
  const showReviewedCount = reviewedCount >= 0;

  return (
    <div className="flex items-center gap-3">
      {/* Section counter */}
      <span className="text-[11px] font-medium tabular-nums shrink-0 text-primary font-[family-name:var(--font-mono)]">
        {currentPage + 1}/{total}
      </span>

      {/* Section name */}
      <span className="text-[11px] font-medium truncate text-white/60">
        {SECTION_LABELS[currentSection]}
      </span>

      {/* Thin progress bar */}
      <div className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-blue-light)]"
          animate={{ width: `${progressPercent}%` }}
          transition={springs.smooth}
        />
      </div>

      {/* Review count — hidden in read-only mode */}
      {showReviewedCount && (
        <span className="text-[11px] tabular-nums shrink-0 text-white/20 font-[family-name:var(--font-mono)]">
          {reviewedCount}/{total}
        </span>
      )}
    </div>
  );
}
