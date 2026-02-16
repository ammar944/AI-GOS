"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Globe,
  Target,
  LayoutGrid,
  Palette,
  DollarSign,
  CalendarClock,
  BarChart3,
  Calculator,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import { MediaPlanSectionCard } from "./media-plan-section-card";
import { MediaPlanSectionContent } from "./section-content";

// ---------------------------------------------------------------------------
// Section metadata
// ---------------------------------------------------------------------------

type MediaPlanSectionKey =
  | "executiveSummary"
  | "platformStrategy"
  | "icpTargeting"
  | "campaignStructure"
  | "creativeStrategy"
  | "budgetAllocation"
  | "campaignPhases"
  | "kpiTargets"
  | "performanceModel"
  | "riskMonitoring";

interface SectionMeta {
  label: string;
  icon: LucideIcon;
}

const MEDIA_PLAN_SECTION_ORDER: MediaPlanSectionKey[] = [
  "executiveSummary",
  "platformStrategy",
  "icpTargeting",
  "campaignStructure",
  "creativeStrategy",
  "budgetAllocation",
  "campaignPhases",
  "kpiTargets",
  "performanceModel",
  "riskMonitoring",
];

const MEDIA_PLAN_SECTION_META: Record<MediaPlanSectionKey, SectionMeta> = {
  executiveSummary: { label: "Executive Summary", icon: FileText },
  platformStrategy: { label: "Platform Strategy", icon: Globe },
  icpTargeting: { label: "ICP Targeting", icon: Target },
  campaignStructure: { label: "Campaign Structure", icon: LayoutGrid },
  creativeStrategy: { label: "Creative Strategy", icon: Palette },
  budgetAllocation: { label: "Budget Allocation", icon: DollarSign },
  campaignPhases: { label: "Campaign Phases", icon: CalendarClock },
  kpiTargets: { label: "KPI Targets", icon: BarChart3 },
  performanceModel: { label: "Performance Model", icon: Calculator },
  riskMonitoring: { label: "Risk & Monitoring", icon: ShieldAlert },
};

// ---------------------------------------------------------------------------
// Container animation
// ---------------------------------------------------------------------------

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MediaPlanViewProps {
  mediaPlan: MediaPlanOutput;
}

export function MediaPlanView({ mediaPlan }: MediaPlanViewProps) {
  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {MEDIA_PLAN_SECTION_ORDER.map((key, idx) => {
        const meta = MEDIA_PLAN_SECTION_META[key];
        return (
          <MediaPlanSectionCard
            key={key}
            sectionNumber={idx + 1}
            icon={meta.icon}
            label={meta.label}
          >
            <MediaPlanSectionContent sectionKey={key} mediaPlan={mediaPlan} />
          </MediaPlanSectionCard>
        );
      })}
    </motion.div>
  );
}
