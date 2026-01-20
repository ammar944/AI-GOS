"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PipelineProps {
  stages: string[];
  currentStageIndex: number; // 0-based, -1 for not started
  className?: string;
}

export function Pipeline({ stages, currentStageIndex, className }: PipelineProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-2 lg:gap-0", className)}
      style={{
        padding: "20px 24px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 12,
        border: "1px solid var(--border-default)",
      }}
    >
      {stages.map((stage, i) => {
        const isComplete = i < currentStageIndex;
        const isActive = i === currentStageIndex;

        return (
          <div key={stage} className="flex items-center">
            {/* Stage pill - SaaSLaunch blue for active/complete */}
            <div
              className="flex items-center gap-2.5"
              style={{
                padding: "8px 16px",
                background: isActive
                  ? "rgba(54, 94, 255, 0.1)"
                  : isComplete
                    ? "rgba(34, 197, 94, 0.08)"
                    : "transparent",
                borderRadius: 8,
                border: `1px solid ${
                  isActive
                    ? "rgba(54, 94, 255, 0.3)"
                    : isComplete
                      ? "rgba(34, 197, 94, 0.2)"
                      : "transparent"
                }`,
              }}
            >
              {/* Status dot - blue for active, green for complete */}
              <div className="relative">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isComplete ? "rgb(34, 197, 94)" : isActive ? "rgb(54, 94, 255)" : "rgb(49, 53, 63)",
                  }}
                />

                {/* Pulse ring for active stage - SaaSLaunch blue */}
                {isActive && (
                  <motion.div
                    animate={{ opacity: [0.6, 0.2, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      inset: -3,
                      borderRadius: "50%",
                      border: "1px solid rgba(54, 94, 255, 0.5)",
                    }}
                  />
                )}
              </div>

              {/* Stage label - SaaSLaunch typography */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isComplete ? "rgb(34, 197, 94)" : isActive ? "var(--accent-blue)" : "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {stage}
              </span>
            </div>

            {/* Connection line */}
            {i < stages.length - 1 && (
              <div
                className="hidden lg:block relative"
                style={{
                  width: 32,
                  height: 2,
                  background: "var(--border-default)",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: isComplete ? "0%" : "-100%" }}
                  transition={{ duration: 0.5 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgb(34, 197, 94)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
