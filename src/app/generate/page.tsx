"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Clock,
  Coins,
  Wand2,
  FileSearch,
  AlertCircle,
  Share2,
  Link2,
  Check,
} from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding";
import { StrategicBlueprintDisplay } from "@/components/strategic-blueprint/strategic-blueprint-display";
import { StrategicResearchReview } from "@/components/strategic-research";
import { BlueprintChat } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ApiErrorDisplay, parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import { Pipeline, GenerationStats } from "@/components/pipeline";
import { easings, fadeUp, durations } from "@/lib/motion";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput, StrategicBlueprintProgress } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_LABELS } from "@/lib/strategic-blueprint/output-types";
import {
  setOnboardingData as saveOnboardingData,
  setStrategicBlueprint as saveStrategicBlueprint,
  clearAllSavedData,
  getSavedProgress,
} from "@/lib/storage/local-storage";

type PageState =
  | "onboarding"
  | "generating-blueprint"
  | "review-blueprint"
  | "complete"
  | "error";

// Pipeline stages for generation progress visualization
const BLUEPRINT_STAGES = ["Industry", "ICP", "Offer", "Competitors", "Synthesis"];

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [strategicBlueprint, setStrategicBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<StrategicBlueprintProgress | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [blueprintMeta, setBlueprintMeta] = useState<{ totalTime: number; totalCost: number } | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [initialData, setInitialData] = useState<OnboardingFormData | undefined>(undefined);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Generation elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0);
  const generationStartRef = useRef<number | null>(null);

  // Share state
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Check for saved progress on mount
  useEffect(() => {
    const saved = getSavedProgress();
    if (saved.state) {
      if (saved.state.currentStage === "blueprint-complete" && saved.strategicBlueprint && saved.onboardingData) {
        setShowResumePrompt(true);
      }
    }
  }, []);

  // Track elapsed time during generation
  useEffect(() => {
    if (pageState === "generating-blueprint") {
      // Start timer when entering generating state
      generationStartRef.current = Date.now();
      setElapsedTime(0);

      const interval = setInterval(() => {
        if (generationStartRef.current) {
          setElapsedTime(Date.now() - generationStartRef.current);
        }
      }, 100);

      return () => {
        clearInterval(interval);
        generationStartRef.current = null;
      };
    }
  }, [pageState]);

  const handleResume = useCallback(() => {
    const saved = getSavedProgress();
    if (saved.onboardingData) setOnboardingData(saved.onboardingData);
    if (saved.strategicBlueprint) setStrategicBlueprint(saved.strategicBlueprint);

    if (saved.state?.currentStage === "blueprint-complete" && saved.strategicBlueprint) {
      // Resume to review step so user can review before proceeding
      setPageState("review-blueprint");
    }
    setShowResumePrompt(false);
  }, []);

  const handleStartFresh = useCallback(() => {
    clearAllSavedData();
    setShowResumePrompt(false);
  }, []);

  const handleAutoFill = useCallback(() => {
    setInitialData(SAMPLE_ONBOARDING_DATA);
    setWizardKey((prev) => prev + 1);
  }, []);

  // Onboarding complete → Generate Strategic Blueprint
  const handleOnboardingComplete = useCallback(async (data: OnboardingFormData) => {
    setOnboardingData(data);
    saveOnboardingData(data);
    setPageState("generating-blueprint");
    setError(null);
    setBlueprintProgress({
      currentSection: "industryMarketOverview",
      completedSections: [],
      partialOutput: {},
      progressPercentage: 0,
      progressMessage: "Starting Strategic Blueprint generation...",
    });

    try {
      const response = await fetch("/api/strategic-blueprint/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingData: data }),
      });

      const result = await response.json();

      if (result.success && result.strategicBlueprint) {
        setStrategicBlueprint(result.strategicBlueprint);
        saveStrategicBlueprint(result.strategicBlueprint);
        setBlueprintMeta({
          totalTime: result.metadata?.totalTime || 0,
          totalCost: result.metadata?.totalCost || 0,
        });
        setPageState("review-blueprint");
      } else {
        // Parse structured error from API response
        setError(parseApiError(result));
        setPageState("error");
      }
    } catch (err) {
      console.error("Blueprint generation error:", err);
      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
        retryable: true,
      });
      setPageState("error");
    }
  }, []);

  const handleRetryBlueprint = useCallback(() => {
    if (onboardingData) {
      handleOnboardingComplete(onboardingData);
    }
  }, [onboardingData, handleOnboardingComplete]);

  const handleStartOver = useCallback(() => {
    setPageState("onboarding");
    setOnboardingData(null);
    setStrategicBlueprint(null);
    setBlueprintProgress(null);
    setError(null);
    setBlueprintMeta(null);
    setInitialData(undefined);
    setWizardKey((prev) => prev + 1);
    clearAllSavedData();
  }, []);

  const handleRegenerateBlueprint = useCallback(() => {
    if (onboardingData) {
      handleOnboardingComplete(onboardingData);
    }
  }, [onboardingData, handleOnboardingComplete]);

  const handleApprove = useCallback((approvedBlueprint: StrategicBlueprintOutput) => {
    // Save approved blueprint to localStorage
    saveStrategicBlueprint(approvedBlueprint);
    // Update state with approved blueprint
    setStrategicBlueprint(approvedBlueprint);
    // Transition to complete state
    setPageState("complete");
    // Reset share state when approving new blueprint
    setShareUrl(null);
    setShareError(null);
  }, []);

  // Share blueprint
  const handleShare = useCallback(async () => {
    if (!strategicBlueprint) return;

    setIsSharing(true);
    setShareError(null);

    try {
      const response = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: strategicBlueprint }),
      });

      const result = await response.json();

      if (result.success) {
        setShareUrl(result.shareUrl);
      } else {
        setShareError(result.error?.message || "Failed to create share link");
      }
    } catch {
      setShareError("Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  }, [strategicBlueprint]);

  // Copy share link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }, [shareUrl]);

  // Resume Prompt
  if (showResumePrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card
            className="border-2"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--accent-blue)',
            }}
          >
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: 'var(--accent-blue-subtle)' }}
                >
                  <AlertCircle className="h-8 w-8" style={{ color: 'var(--accent-blue)' }} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Resume Previous Session?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    We found saved progress from a previous session. Would you like to continue where you left off?
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <MagneticButton
                    className="flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium"
                    onClick={handleStartFresh}
                    style={{
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      background: 'transparent',
                    }}
                  >
                    Start Fresh
                  </MagneticButton>
                  <MagneticButton
                    className="flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium"
                    onClick={handleResume}
                    style={{
                      background: 'var(--gradient-primary)',
                      color: 'white',
                    }}
                  >
                    Resume
                  </MagneticButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Onboarding State
  if (pageState === "onboarding") {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Header */}
          <motion.div
            className="mx-auto max-w-4xl mb-8 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easings.out }}
          >
            <motion.h1
              className="text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Generate Your Strategic Blueprint
            </motion.h1>
            <motion.p
              className="mt-2"
              style={{ color: 'var(--text-secondary)', fontSize: '15px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Complete the onboarding form to generate your comprehensive Strategic Blueprint
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
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  1
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Onboarding
                </span>
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex items-center gap-2 opacity-50">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  2
                </div>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
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
                className="mt-4 h-9 px-3 rounded-md text-sm font-medium"
                onClick={handleAutoFill}
                style={{
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
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
            onComplete={handleOnboardingComplete}
          />
        </div>
      </div>
    );
  }

  // Generating Blueprint State
  if (pageState === "generating-blueprint") {
    // Calculate current stage index based on completed sections
    const completedCount = blueprintProgress?.completedSections.length ?? 0;
    const currentStageIndex = Math.min(completedCount, BLUEPRINT_STAGES.length - 1);
    const totalSections = BLUEPRINT_STAGES.length;

    // Estimate cost based on elapsed time (rough estimate: ~$0.001 per second)
    const estimatedCost = (elapsedTime / 1000) * 0.001;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: durations.normal }}
          >
            <GradientBorder animate={true}>
              <div className="p-8 space-y-8">
                {/* Header */}
                <motion.div
                  className="text-center space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: durations.normal }}
                >
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Generating Strategic Blueprint
                  </h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Analyzing your market, ICP, offer, and competitive landscape
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

                {/* Generation Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: durations.normal }}
                >
                  <GenerationStats
                    elapsedTime={elapsedTime}
                    estimatedCost={estimatedCost}
                    completedSections={completedCount}
                    totalSections={totalSections}
                  />
                </motion.div>

                {/* Current Section Indicator */}
                {blueprintProgress?.currentSection && (
                  <motion.div
                    className="rounded-lg p-4"
                    style={{ background: 'var(--accent-blue-subtle)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: durations.normal }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-blue)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Currently generating:{" "}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {STRATEGIC_BLUEPRINT_SECTION_LABELS[blueprintProgress.currentSection]}
                        </strong>
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Time estimate */}
                <motion.p
                  className="text-xs text-center"
                  style={{ color: 'var(--text-tertiary)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: durations.normal }}
                >
                  This typically takes 1-2 minutes
                </motion.p>
              </div>
            </GradientBorder>
          </motion.div>
        </div>
      </div>
    );
  }

  // Error State
  if (pageState === "error" && error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <ApiErrorDisplay
            error={error}
            onRetry={handleRetryBlueprint}
            onGoBack={handleStartOver}
          />
        </div>
      </div>
    );
  }

  // Review Blueprint State
  if (pageState === "review-blueprint" && strategicBlueprint) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Stage Indicator */}
          <motion.div
            className="mx-auto max-w-5xl mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  style={{ background: 'var(--success)', color: 'white' }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Onboarding</span>
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  2
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Review Research
                </span>
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex items-center gap-2 opacity-50">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  3
                </div>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Complete</span>
              </div>
            </div>
          </motion.div>

          {/* Review Component */}
          <div className="mx-auto max-w-5xl">
            <StrategicResearchReview
              strategicBlueprint={strategicBlueprint}
              onApprove={handleApprove}
              onRegenerate={handleRegenerateBlueprint}
            />
          </div>

          {/* Blueprint Chat - works with in-memory blueprint, no DB required */}
          <BlueprintChat
            blueprint={strategicBlueprint as unknown as Record<string, unknown>}
            onBlueprintUpdate={(updated) => setStrategicBlueprint(updated as unknown as StrategicBlueprintOutput)}
          />
        </div>
      </div>
    );
  }

  // Complete State - Show Strategic Blueprint
  if (pageState === "complete" && strategicBlueprint) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Success Banner */}
          <motion.div
            className="mx-auto max-w-5xl mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--success)',
                borderWidth: '1px',
              }}
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: 'var(--success-subtle)' }}
                    >
                      <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--success)' }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Strategic Blueprint Complete!
                      </h2>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Your comprehensive 5-section Strategic Blueprint is ready
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {blueprintMeta && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {Math.round(blueprintMeta.totalTime / 1000)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Coins className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>
                            ${blueprintMeta.totalCost.toFixed(4)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                        disabled={isSharing || !!shareUrl}
                        style={{
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          background: 'transparent',
                        }}
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Link...
                          </>
                        ) : shareUrl ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Link Created
                          </>
                        ) : (
                          <>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateBlueprint}
                        style={{
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          background: 'transparent',
                        }}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartOver}
                        style={{
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          background: 'transparent',
                        }}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        New Blueprint
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Completed Stage */}
                <div
                  className="mt-4 pt-4"
                  style={{ borderTop: '1px solid var(--success)' }}
                >
                  <div className="flex items-center gap-3 text-sm">
                    <Badge
                      variant="secondary"
                      className="gap-1"
                      style={{
                        background: 'var(--success-subtle)',
                        color: 'var(--success)',
                        border: '1px solid var(--success)',
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Strategic Blueprint
                    </Badge>
                  </div>
                </div>

                {/* Share Link Display */}
                {shareUrl && (
                  <div
                    className="mt-4 p-4 rounded-lg"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        Shareable Link
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 text-sm rounded-md"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <MagneticButton
                        className="h-9 px-3 rounded-md text-sm font-medium"
                        onClick={handleCopyLink}
                        style={{
                          background: 'var(--gradient-primary)',
                          color: 'white',
                        }}
                      >
                        {shareCopied ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          "Copy"
                        )}
                      </MagneticButton>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                      Anyone with this link can view this blueprint
                    </p>
                  </div>
                )}

                {/* Share Error Display */}
                {shareError && (
                  <div
                    className="mt-4 p-3 rounded-lg"
                    style={{
                      background: 'var(--error-subtle)',
                      border: '1px solid var(--error)',
                    }}
                  >
                    <p className="text-sm" style={{ color: 'var(--error)' }}>{shareError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Strategic Blueprint Display */}
          <div className="mx-auto max-w-5xl">
            <StrategicBlueprintDisplay strategicBlueprint={strategicBlueprint} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
