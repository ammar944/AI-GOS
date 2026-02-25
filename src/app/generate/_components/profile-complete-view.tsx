"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Wand2,
  LayoutDashboard,
  BarChart3,
  X,
} from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader } from "@/components/generate";
import { fadeUp, durations, easings } from "@/lib/motion";
import type { GenerateStage } from "@/components/generate";

export interface ProfileCompleteViewProps {
  headerStage: GenerateStage;
  businessName: string;
  showResumeBanner: boolean;
  onGenerate: () => void;
  onUseSampleData: () => void;
  onEditProfile: () => void;
  onResumeMediaPlan: () => void;
  onDismissResumeBanner: () => void;
}

export function ProfileCompleteView({
  headerStage,
  businessName,
  showResumeBanner,
  onGenerate,
  onUseSampleData,
  onEditProfile,
  onResumeMediaPlan,
  onDismissResumeBanner,
}: ProfileCompleteViewProps) {
  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: 'rgb(7, 9, 14)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={false}
        exitUrl="/dashboard"
      />

      <ShaderMeshBackground variant="hero" />
      <BackgroundPattern opacity={0.02} />

      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-lg relative z-10">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: durations.normal }}
          >
            <GradientBorder>
              <div className="p-8 space-y-6 text-center">
                {/* Success indicator */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full"
                      style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                    >
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
                    Business Profile Saved
                  </h2>
                  <p
                    className="mt-2 text-sm"
                    style={{
                      color: 'rgb(205, 208, 213)',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    {businessName}&apos;s profile is complete and ready for blueprint generation.
                  </p>
                </div>

                {/* Stats */}
                <div
                  className="flex items-center justify-center gap-6 py-3 rounded-lg"
                  style={{ background: 'rgba(54, 94, 255, 0.05)', border: '1px solid rgba(54, 94, 255, 0.1)' }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'rgb(34, 197, 94)' }} />
                    <span className="text-sm" style={{ color: 'rgb(205, 208, 213)' }}>
                      9/9 steps complete
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <MagneticButton
                    className="w-full h-12 rounded-full text-base font-medium flex items-center justify-center gap-2"
                    onClick={onGenerate}
                    style={{
                      background: 'var(--gradient-primary)',
                      color: 'white',
                      fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                    }}
                  >
                    <Wand2 className="h-5 w-5" />
                    Generate Strategic Blueprint
                  </MagneticButton>
                  <MagneticButton
                    className="w-full h-10 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
                    onClick={onUseSampleData}
                    style={{
                      border: '1px solid rgb(31, 31, 31)',
                      color: 'rgb(205, 208, 213)',
                      background: 'transparent',
                      fontFamily: 'var(--font-sans), Inter, sans-serif',
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Use Sample Data (FlowMetrics)
                  </MagneticButton>
                  <div className="flex gap-3">
                    <MagneticButton
                      className="flex-1 h-10 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
                      onClick={onEditProfile}
                      style={{
                        border: '1px solid rgb(31, 31, 31)',
                        color: 'rgb(205, 208, 213)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Edit Profile
                    </MagneticButton>
                    <a href="/dashboard" className="flex-1">
                      <MagneticButton
                        className="w-full h-10 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
                        style={{
                          border: '1px solid rgb(31, 31, 31)',
                          color: 'rgb(205, 208, 213)',
                          background: 'transparent',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </MagneticButton>
                    </a>
                  </div>
                </div>
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </div>

      {/* Resume Media Plan Banner */}
      <AnimatePresence>
        {showResumeBanner && (
          <motion.div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: easings.out }}
          >
            <div
              className="flex items-center gap-4 rounded-full px-5 py-3 shadow-lg backdrop-blur-md"
              style={{
                background: 'rgba(20, 23, 30, 0.95)',
                border: '1px solid rgba(54, 94, 255, 0.3)',
              }}
            >
              <BarChart3 className="h-4 w-4 flex-shrink-0" style={{ color: 'rgb(54, 94, 255)' }} />
              <span
                className="text-sm font-medium"
                style={{
                  color: 'rgb(205, 208, 213)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
              >
                You have an in-progress media plan
              </span>
              <MagneticButton
                className="h-8 px-4 rounded-full text-sm font-medium flex items-center gap-1.5"
                onClick={onResumeMediaPlan}
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                }}
              >
                Resume
              </MagneticButton>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                onClick={onDismissResumeBanner}
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'rgb(100, 105, 115)' }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
