"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PipelineProps {
  stages: string[];
  currentStageIndex: number; // 0-based, -1 for not started
  className?: string;
}

export function Pipeline({ stages, currentStageIndex, className }: PipelineProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-3", className)}
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
        const isPending = i > currentStageIndex;

        return (
          <div key={stage} className="flex items-center gap-3">
            {/* Stage pill with improved visual hierarchy */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-all duration-300",
                "border backdrop-blur-sm",
                isActive && "shadow-sm",
                isPending && "opacity-60"
              )}
              style={{
                background: isActive
                  ? "linear-gradient(135deg, rgba(54, 94, 255, 0.12) 0%, rgba(54, 94, 255, 0.06) 100%)"
                  : isComplete
                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)"
                    : "rgba(255,255,255,0.02)",
                borderColor: isActive
                  ? "rgba(54, 94, 255, 0.4)"
                  : isComplete
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(255,255,255,0.06)",
              }}
            >
              {/* Status indicator */}
              <div className="relative flex items-center justify-center w-5 h-5">
                {isComplete ? (
                  // Checkmark for completed stages
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgb(34, 197, 94)",
                    }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </motion.div>
                ) : (
                  // Dot for active/pending stages
                  <div className="relative">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: isActive
                          ? "rgb(54, 94, 255)"
                          : "rgb(71, 76, 89)",
                      }}
                    />

                    {/* Subtle pulse for active stage - no overlapping border */}
                    {isActive && (
                      <motion.div
                        animate={{
                          scale: [1, 1.8, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: "rgb(54, 94, 255)",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Stage label */}
              <span
                className="text-sm whitespace-nowrap font-medium transition-colors"
                style={{
                  color: isComplete
                    ? "rgb(34, 197, 94)"
                    : isActive
                      ? "var(--accent-blue)"
                      : "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {stage}
              </span>
            </motion.div>

            {/* Connection line - only on large screens, hidden on wrap */}
            {i < stages.length - 1 && (
              <div className="hidden lg:block relative w-8 h-0.5 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isComplete ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full origin-left"
                  style={{
                    background: "linear-gradient(90deg, rgba(34, 197, 94, 0.6) 0%, rgba(34, 197, 94, 0.3) 100%)",
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
