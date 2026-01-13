"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { durations } from "@/lib/motion";
import {
  STRATEGIC_BLUEPRINT_SECTION_LABELS,
  STRATEGIC_BLUEPRINT_SECTION_ORDER,
  type StrategicBlueprintSection,
} from "@/lib/strategic-blueprint/output-types";

interface StreamingSectionPreviewProps {
  /** Map of completed sections with their data */
  sections: Map<StrategicBlueprintSection, unknown>;
  /** Currently generating section (null if not generating) */
  currentSection: StrategicBlueprintSection | null;
  /** Optional className for the container */
  className?: string;
}

/**
 * Minimal section progress display.
 * Shows completed sections with checkmarks, current section with indicator.
 */
export function StreamingSectionPreview({
  sections,
  currentSection,
  className,
}: StreamingSectionPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new sections complete
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [sections.size]);

  return (
    <div
      ref={containerRef}
      className={cn("max-h-[200px] overflow-y-auto", className)}
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border-default) transparent",
      }}
    >
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {STRATEGIC_BLUEPRINT_SECTION_ORDER.map((section) => {
            const isComplete = sections.has(section);
            const isCurrent = section === currentSection;

            // Only show completed or current sections
            if (!isComplete && !isCurrent) return null;

            return (
              <motion.div
                key={section}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast }}
                className="flex items-center gap-3 py-1.5"
              >
                {/* Status indicator - opacity fade, no scale animations */}
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--success)" }}
                    />
                  ) : (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--text-secondary)" }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className="text-sm"
                  style={{
                    color: isComplete
                      ? "var(--text-secondary)"
                      : "var(--text-primary)",
                  }}
                >
                  {STRATEGIC_BLUEPRINT_SECTION_LABELS[section]}
                </span>

                {/* Status text */}
                {isCurrent && !isComplete && (
                  <motion.span
                    className="text-xs ml-auto"
                    style={{ color: "var(--text-tertiary)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    generating
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
