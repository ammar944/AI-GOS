"use client";

import { motion } from "framer-motion";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { Pipeline, GenerationStats } from "@/components/pipeline";
import { GenerateHeader } from "@/components/generate";
import { fadeUp, durations } from "@/lib/motion";
import { BLUEPRINT_STAGES } from "@/hooks/use-generate-page-state";
import type { GenerateStage } from "@/components/generate";
import type { StrategicBlueprintProgress } from "@/lib/strategic-blueprint/output-types";

export interface BlueprintGeneratingViewProps {
  headerStage: GenerateStage;
  blueprintProgress: StrategicBlueprintProgress | null;
  elapsedTime: number;
  streamingCost: number;
  onStartOver: () => void;
}

export function BlueprintGeneratingView({
  headerStage,
  blueprintProgress,
  elapsedTime,
  streamingCost,
  onStartOver,
}: BlueprintGeneratingViewProps) {
  const completedCount = blueprintProgress?.completedSections.length ?? 0;
  const currentStageIndex = Math.min(completedCount, BLUEPRINT_STAGES.length - 1);
  const totalSections = BLUEPRINT_STAGES.length;
  const estimatedCost = streamingCost > 0 ? streamingCost : (elapsedTime / 1000) * 0.001;

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
                {/* Header */}
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
                    Generating Blueprint
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    {blueprintProgress?.progressMessage || "Starting..."}
                  </p>
                </motion.div>

                {/* Pipeline Progress */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: durations.normal }}
                >
                  <Pipeline
                    stages={BLUEPRINT_STAGES}
                    currentStageIndex={currentStageIndex}
                  />
                </motion.div>

                {/* Inline Stats */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: durations.normal }}
                >
                  <GenerationStats
                    elapsedTime={elapsedTime}
                    estimatedCost={estimatedCost}
                    completedSections={completedCount}
                    totalSections={totalSections}
                  />
                </motion.div>
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
