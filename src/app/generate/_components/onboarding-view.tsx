"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Wand2, BarChart3, X } from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader } from "@/components/generate";
import { easings } from "@/lib/motion";
import type { GenerateStage } from "@/components/generate";
import type { OnboardingFormData } from "@/lib/onboarding/types";

export interface OnboardingViewProps {
  headerStage: GenerateStage;
  hasUnsavedProgress: boolean;
  wizardKey: number;
  initialData: OnboardingFormData | undefined;
  initialStep: number | undefined;
  showResumeBanner: boolean;
  onAutoFill: () => void;
  onComplete: (data: OnboardingFormData) => void;
  onStepChange: (step: number, data: Partial<OnboardingFormData>) => void;
  onResumeMediaPlan: () => void;
  onDismissResumeBanner: () => void;
  onStartOver: () => void;
}

export function OnboardingView({
  headerStage,
  hasUnsavedProgress,
  wizardKey,
  initialData,
  initialStep,
  showResumeBanner,
  onAutoFill,
  onComplete,
  onStepChange,
  onResumeMediaPlan,
  onDismissResumeBanner,
  onStartOver,
}: OnboardingViewProps) {
  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: 'rgb(7, 9, 14)' }}>
      <GenerateHeader
        currentStage={headerStage}
        hasUnsavedProgress={hasUnsavedProgress}
        onExit={onStartOver}
        exitUrl="/dashboard"
      />

      <ShaderMeshBackground variant="hero" />
      <BackgroundPattern opacity={0.02} />

      <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Header */}
        <motion.div
          className="mx-auto max-w-4xl mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easings.out }}
        >
          <motion.h1
            className="text-3xl font-bold tracking-tight md:text-4xl"
            style={{
              color: 'rgb(252, 252, 250)',
              fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            Your Strategy Starts With Research
          </motion.h1>
          <motion.p
            className="mt-4 max-w-[600px] mx-auto"
            style={{
              color: 'rgb(205, 208, 213)',
              fontSize: '16px',
              lineHeight: '1.6em',
              fontFamily: 'var(--font-sans), Inter, sans-serif',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Complete the onboarding to uncover market demand, competitive gaps, and a proven ICP and offer direction.
          </motion.p>

          {/* Stage Indicator */}
          <motion.div
            className="flex items-center justify-center gap-4 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                style={{
                  background: 'rgba(54, 94, 255, 0.15)',
                  border: '1px solid rgb(54, 94, 255)',
                  color: 'rgb(54, 94, 255)',
                }}
              >
                1
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgb(252, 252, 250)' }}>
                Onboarding
              </span>
            </div>
            <ArrowRight className="h-4 w-4" style={{ color: 'rgb(49, 53, 63)' }} />
            <div className="flex items-center gap-2 opacity-50">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                style={{
                  background: 'rgb(20, 23, 30)',
                  color: 'rgb(100, 105, 115)',
                  border: '1px solid rgb(31, 31, 31)',
                }}
              >
                2
              </div>
              <span className="text-sm" style={{ color: 'rgb(100, 105, 115)' }}>
                Strategic Blueprint
              </span>
            </div>
          </motion.div>

          {/* Auto-fill Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <MagneticButton
              className="mt-4 h-10 px-5 rounded-full text-sm font-medium flex items-center transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
              onClick={onAutoFill}
              style={{
                border: '1px solid rgb(31, 31, 31)',
                color: 'rgb(252, 252, 250)',
                background: 'transparent',
              }}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-fill with Sample Data
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Wizard */}
        <OnboardingWizard
          key={wizardKey}
          initialData={initialData}
          initialStep={initialStep}
          onComplete={onComplete}
          onStepChange={onStepChange}
        />
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
