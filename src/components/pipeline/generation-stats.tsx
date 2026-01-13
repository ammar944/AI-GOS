"use client";

import { motion } from "framer-motion";
import { Clock, Coins, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { fadeUp, durations } from "@/lib/motion";

interface GenerationStatsProps {
  elapsedTime: number; // milliseconds
  estimatedCost: number; // dollars
  completedSections: number;
  totalSections: number;
  className?: string;
}

export function GenerationStats({
  elapsedTime,
  estimatedCost,
  completedSections,
  totalSections,
  className,
}: GenerationStatsProps) {
  // Calculate elapsed seconds
  const elapsedSeconds = Math.floor(elapsedTime / 1000);

  // Calculate rate (sections per minute)
  const elapsedMinutes = elapsedTime / 60000;
  const rate = elapsedMinutes > 0 ? Math.round((completedSections / elapsedMinutes) * 10) / 10 : 0;

  // Format cost as $0.0000
  const formattedCost = `$${estimatedCost.toFixed(4)}`;

  // Format progress as "X/Y"
  const progressText = `${completedSections}/${totalSections}`;

  // Format rate
  const rateText = `${rate}/min`;

  return (
    <motion.div
      className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ duration: durations.normal }}
    >
      {/* Time */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <StatCard
          value={elapsedSeconds}
          label="Time (seconds)"
          icon={<Clock className="h-5 w-5" style={{ color: "var(--accent-blue)" }} />}
          delay={0}
        />
      </div>

      {/* Cost */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="relative overflow-hidden p-6">
          <div className="mb-4" style={{ opacity: 0.6 }}>
            <Coins className="h-5 w-5" style={{ color: "var(--accent-purple)" }} />
          </div>
          <div
            className="font-mono text-[42px] font-bold"
            style={{
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-mono)",
              background: "var(--gradient-text)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {formattedCost}
          </div>
          <div
            className="text-[13px] font-medium mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Estimated Cost
          </div>
        </div>
      </div>

      {/* Progress */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="relative overflow-hidden p-6">
          <div className="mb-4" style={{ opacity: 0.6 }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: "var(--success)" }} />
          </div>
          <div
            className="font-mono text-[42px] font-bold"
            style={{
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-mono)",
              background: "var(--gradient-text)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {progressText}
          </div>
          <div
            className="text-[13px] font-medium mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Sections Complete
          </div>
        </div>
      </div>

      {/* Rate */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="relative overflow-hidden p-6">
          <div className="mb-4" style={{ opacity: 0.6 }}>
            <Zap className="h-5 w-5" style={{ color: "var(--warning)" }} />
          </div>
          <div
            className="font-mono text-[42px] font-bold"
            style={{
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-mono)",
              background: "var(--gradient-text)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {rateText}
          </div>
          <div
            className="text-[13px] font-medium mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Processing Rate
          </div>
        </div>
      </div>
    </motion.div>
  );
}
