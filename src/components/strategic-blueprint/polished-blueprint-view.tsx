"use client";

import { motion } from "framer-motion";
import { easings } from "@/lib/motion";
import { OutputSectionCard } from "@/components/strategic-research/output-section-card";
import {
  STRATEGIC_BLUEPRINT_SECTION_ORDER,
  type StrategicBlueprintOutput,
  type StrategicBlueprintSection,
} from "@/lib/strategic-blueprint/output-types";

export interface PolishedBlueprintViewProps {
  /** The complete strategic blueprint data */
  strategicBlueprint: StrategicBlueprintOutput;
}

// Stagger container variants for child animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Card animation variants with fadeUp
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: easings.out,
    },
  },
};

/**
 * PolishedBlueprintView - Main container component for the complete page.
 *
 * Displays all 5 strategic blueprint sections as polished, read-only cards.
 * Replaces the markdown-based DocumentEditor with a card-based layout
 * that matches the review page aesthetic.
 *
 * Features:
 * - Renders 5 OutputSectionCard components in order
 * - Framer Motion stagger animation on mount
 * - Consistent spacing between cards (space-y-6)
 * - Max-width container matching review page layout
 *
 * Does NOT include:
 * - Header with metadata (stays in parent page.tsx)
 * - Action buttons (stays in parent)
 * - PDF export (parent header)
 */
export function PolishedBlueprintView({
  strategicBlueprint,
}: PolishedBlueprintViewProps) {
  const { metadata } = strategicBlueprint;
  const sectionCitations = metadata.sectionCitations || {};

  /**
   * Get section data by key from the strategic blueprint.
   */
  const getSectionData = (sectionKey: StrategicBlueprintSection): unknown => {
    return strategicBlueprint[sectionKey];
  };

  return (
    <motion.div
      className="mx-auto w-full max-w-5xl space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {STRATEGIC_BLUEPRINT_SECTION_ORDER.map((sectionKey) => (
        <motion.div key={sectionKey} variants={cardVariants}>
          <OutputSectionCard
            sectionKey={sectionKey}
            sectionData={getSectionData(sectionKey)}
            citations={sectionCitations[sectionKey]}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
