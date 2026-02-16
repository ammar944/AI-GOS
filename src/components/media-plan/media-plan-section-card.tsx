"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RESEARCH_SHELL_CLASS } from "@/components/strategic-research/ui-tokens";

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

interface MediaPlanSectionCardProps {
  sectionNumber: number;
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}

export function MediaPlanSectionCard({
  sectionNumber,
  icon: Icon,
  label,
  children,
}: MediaPlanSectionCardProps) {
  return (
    <motion.section
      variants={cardVariant}
      className={cn(RESEARCH_SHELL_CLASS, "p-6 md:p-8")}
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-4 border-b border-[var(--border-subtle)] pb-5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
          style={{ background: "var(--accent-blue)", color: "white" }}
        >
          {sectionNumber}
        </span>
        <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--accent-blue)" }} />
        <h2
          className="text-xl font-semibold leading-tight"
          style={{
            color: "var(--text-heading)",
            fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
            letterSpacing: "-0.02em",
          }}
        >
          {label}
        </h2>
      </div>

      {/* Content */}
      <div className="mt-2">{children}</div>
    </motion.section>
  );
}
