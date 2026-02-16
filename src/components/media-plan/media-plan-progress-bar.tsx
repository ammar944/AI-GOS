"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/motion";
import type { MediaPlanSectionKey } from "@/lib/media-plan/section-constants";
import { MEDIA_PLAN_SECTION_LABELS } from "@/lib/media-plan/section-constants";

interface MediaPlanProgressBarProps {
  sections: MediaPlanSectionKey[];
  currentPage: number;
  reviewedCount: number;
}

export function MediaPlanProgressBar({
  sections,
  currentPage,
  reviewedCount,
}: MediaPlanProgressBarProps) {
  const total = sections.length;
  const currentSection = sections[currentPage];
  const progressPercent = ((currentPage + 1) / total) * 100;

  return (
    <div className="flex items-center gap-3">
      {/* Section counter */}
      <span
        className="text-[11px] font-medium tabular-nums shrink-0"
        style={{
          color: "var(--accent-blue)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {currentPage + 1}/{total}
      </span>

      {/* Section name */}
      <span
        className="text-[11px] font-medium truncate"
        style={{
          color: "var(--text-secondary)",
          fontFamily: 'var(--font-sans), Inter, sans-serif',
        }}
      >
        {MEDIA_PLAN_SECTION_LABELS[currentSection]}
      </span>

      {/* Thin progress bar */}
      <div
        className="flex-1 h-[3px] rounded-full overflow-hidden"
        style={{ background: "var(--border-subtle)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "var(--gradient-primary)",
          }}
          animate={{ width: `${progressPercent}%` }}
          transition={springs.smooth}
        />
      </div>

      {/* Review count */}
      <span
        className="text-[11px] tabular-nums shrink-0"
        style={{
          color: "var(--text-quaternary)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {reviewedCount}/{total}
      </span>
    </div>
  );
}
