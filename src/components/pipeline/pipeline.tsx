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
            {/* Stage pill */}
            <div
              className="flex items-center gap-2.5"
              style={{
                padding: "8px 16px",
                background: isActive
                  ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.1))"
                  : isComplete
                    ? "rgba(34,197,94,0.1)"
                    : "transparent",
                borderRadius: 8,
                border: `1px solid ${
                  isActive
                    ? "rgba(59,130,246,0.3)"
                    : isComplete
                      ? "rgba(34,197,94,0.2)"
                      : "transparent"
                }`,
              }}
            >
              {/* Status dot */}
              <div className="relative">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isComplete ? "#22c55e" : isActive ? "#3b82f6" : "#333",
                  }}
                />

                {/* Pulse ring for active stage */}
                {isActive && (
                  <motion.div
                    animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "#3b82f6",
                    }}
                  />
                )}
              </div>

              {/* Stage label */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isComplete ? "#22c55e" : isActive ? "#fff" : "#666",
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
                  background: "#222",
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
                    background: "#22c55e",
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
