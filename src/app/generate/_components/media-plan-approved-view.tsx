"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeft, LayoutDashboard } from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader } from "@/components/generate";
import { fadeUp, durations } from "@/lib/motion";
import type { GenerateStage } from "@/components/generate";
import type { MediaPlanOutput } from "@/lib/media-plan/types";

export interface MediaPlanApprovedViewProps {
  headerStage: GenerateStage;
  mediaPlan: MediaPlanOutput;
  onBackToReview: () => void;
}

export function MediaPlanApprovedView({
  headerStage,
  mediaPlan,
  onBackToReview,
}: MediaPlanApprovedViewProps) {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-base)' }}>
      <GenerateHeader currentStage={headerStage} hasUnsavedProgress={false} exitUrl="/dashboard" />
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.015} />
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-lg relative z-10">
          <motion.div variants={fadeUp} initial="initial" animate="animate" transition={{ duration: durations.normal }}>
            <GradientBorder>
              <div className="p-8 space-y-6 text-center">
                {/* Success indicator */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                      <CheckCircle2 className="h-8 w-8" style={{ color: 'rgb(34, 197, 94)' }} />
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px solid rgb(34, 197, 94)' }}
                      initial={{ opacity: 0.5, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      transition={{ duration: 1.5, repeat: 2 }}
                    />
                  </div>
                </div>
                <div>
                  <h2
                    className="text-2xl font-bold"
                    style={{
                      color: 'rgb(252, 252, 250)',
                      fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Media Plan Approved
                  </h2>
                  <p
                    className="mt-2 text-sm"
                    style={{
                      color: 'rgb(205, 208, 213)',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    {mediaPlan.platformStrategy.length} platforms, {mediaPlan.campaignPhases.length} phases ready for execution.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <a href="/dashboard" className="w-full">
                    <MagneticButton
                      className="w-full h-12 rounded-full text-base font-medium flex items-center justify-center gap-2"
                      style={{
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                      }}
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      Back to Dashboard
                    </MagneticButton>
                  </a>
                  <MagneticButton
                    className="w-full h-10 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
                    onClick={onBackToReview}
                    style={{
                      border: '1px solid rgb(31, 31, 31)',
                      color: 'rgb(205, 208, 213)',
                      background: 'transparent',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Review
                  </MagneticButton>
                </div>
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
