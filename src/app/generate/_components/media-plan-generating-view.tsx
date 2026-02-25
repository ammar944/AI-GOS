"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { Pipeline, GenerationStats } from "@/components/pipeline";
import { GenerateHeader } from "@/components/generate";
import { fadeUp, durations } from "@/lib/motion";
import { MEDIA_PLAN_STAGES } from "@/lib/media-plan/types";
import { MEDIA_PLAN_SECTION_ORDER, MEDIA_PLAN_SECTION_SHORT_LABELS } from "@/lib/media-plan/section-constants";
import type { GenerateStage } from "@/components/generate";
import type { MediaPlanSectionKey } from "@/lib/media-plan/section-constants";

export interface MediaPlanGeneratingViewProps {
  headerStage: GenerateStage;
  elapsedTime: number;
  progressMessage: string;
  currentPhase: string | null;
  completedSections: Set<string>;
  activeSections: Set<string>;
  error: string | null;
  meta: { totalCost: number } | null;
  onRetry: () => void;
  onBackToComplete: () => void;
  onStartOver: () => void;
}

export function MediaPlanGeneratingView({
  headerStage,
  elapsedTime,
  progressMessage,
  currentPhase,
  completedSections,
  activeSections,
  error,
  meta,
  onRetry,
  onBackToComplete,
  onStartOver,
}: MediaPlanGeneratingViewProps) {
  const phaseToStageIndex: Record<string, number> = { research: 0, synthesis: 1, validation: 2, final: 3 };
  const mediaPlanStageIndex = currentPhase ? phaseToStageIndex[currentPhase] ?? 0 : 0;
  const completedCount = completedSections.size;
  const totalSections = MEDIA_PLAN_SECTION_ORDER.length;
  const mediaPlanEstimatedCost = meta?.totalCost ?? (elapsedTime / 1000) * 0.0008;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-base)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={true}
        onExit={onStartOver}
        exitUrl="/dashboard"
        collapsible={true}
      />

      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: durations.normal }}
          >
            <GradientBorder animate={true}>
              <div className="p-6 space-y-6">
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: durations.normal }}
                >
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      color: 'var(--text-heading)',
                      fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                    }}
                  >
                    Generating Media Plan
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    {progressMessage || "Starting..."}
                  </p>
                </motion.div>

                {/* High-level phase Pipeline */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: durations.normal }}
                >
                  <Pipeline
                    stages={[...MEDIA_PLAN_STAGES]}
                    currentStageIndex={mediaPlanStageIndex}
                  />
                </motion.div>

                {/* Per-section progress grid */}
                <motion.div
                  className="grid grid-cols-5 gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: durations.normal }}
                >
                  {MEDIA_PLAN_SECTION_ORDER.map((key) => {
                    const isComplete = completedSections.has(key);
                    const isActive = activeSections.has(key);
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
                        style={{
                          background: isComplete
                            ? 'rgba(34, 197, 94, 0.1)'
                            : isActive
                              ? 'rgba(54, 94, 255, 0.1)'
                              : 'var(--bg-elevated)',
                          border: `1px solid ${
                            isComplete
                              ? 'rgba(34, 197, 94, 0.3)'
                              : isActive
                                ? 'rgba(54, 94, 255, 0.3)'
                                : 'var(--border-subtle)'
                          }`,
                          color: isComplete
                            ? 'rgb(34, 197, 94)'
                            : isActive
                              ? 'rgb(54, 94, 255)'
                              : 'var(--text-tertiary)',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                        ) : (
                          <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: 'var(--border-subtle)' }} />
                        )}
                        <span className="truncate">{MEDIA_PLAN_SECTION_SHORT_LABELS[key as MediaPlanSectionKey]}</span>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Inline Stats */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: durations.normal }}
                >
                  <GenerationStats
                    elapsedTime={elapsedTime}
                    estimatedCost={mediaPlanEstimatedCost}
                    completedSections={completedCount}
                    totalSections={totalSections}
                  />
                </motion.div>

                {/* Error inline */}
                {error && (
                  <motion.div
                    className="p-4 rounded-lg"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgb(239, 68, 68)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-sm" style={{ color: 'rgb(239, 68, 68)' }}>
                      {error}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <MagneticButton
                        className="h-8 px-4 rounded-full text-sm font-medium"
                        onClick={onRetry}
                        style={{
                          background: 'var(--gradient-primary)',
                          color: 'white',
                        }}
                      >
                        Retry
                      </MagneticButton>
                      <MagneticButton
                        className="h-8 px-4 rounded-full text-sm font-medium"
                        onClick={onBackToComplete}
                        style={{
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          background: 'transparent',
                        }}
                      >
                        Back
                      </MagneticButton>
                    </div>
                  </motion.div>
                )}
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
