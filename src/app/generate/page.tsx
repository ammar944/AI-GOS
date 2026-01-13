"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Card, CardContent } from "@/components/ui/card";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ApiErrorDisplay, parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import { Pipeline, GenerationStats, StreamingSectionPreview } from "@/components/pipeline";
import { easings, fadeUp, durations } from "@/lib/motion";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput, StrategicBlueprintProgress, StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import {
  setOnboardingData as saveOnboardingData,
  setStrategicBlueprint as saveStrategicBlueprint,
  clearAllSavedData,
  getSavedProgress,
} from "@/lib/storage/local-storage";

// =============================================================================
// SSE Event Types (match server-side definitions)
// =============================================================================

interface SSESectionStartEvent {
  type: "section-start";
  section: StrategicBlueprintSection;
  label: string;
}

interface SSESectionCompleteEvent {
  type: "section-complete";
  section: StrategicBlueprintSection;
  label: string;
  data: unknown;
}

interface SSEProgressEvent {
  type: "progress";
  percentage: number;
  message: string;
}

interface SSEMetadataEvent {
  type: "metadata";
  elapsedTime: number;
  estimatedCost: number;
  completedSections: number;
  totalSections: number;
}

interface SSEDoneEvent {
  type: "done";
  success: true;
  strategicBlueprint: StrategicBlueprintOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

type SSEEvent =
  | SSESectionStartEvent
  | SSESectionCompleteEvent
  | SSEProgressEvent
  | SSEMetadataEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// =============================================================================
// SSE Parsing Helper
// =============================================================================

function parseSSEEvent(eventStr: string): SSEEvent | null {
  const lines = eventStr.trim().split("\n");
  let eventType = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7);
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (!eventType || !data) return null;

  try {
    return JSON.parse(data) as SSEEvent;
  } catch {
    return null;
  }
}

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

  // Streaming state for real-time section display
  const [streamingSections, setStreamingSections] = useState<Map<StrategicBlueprintSection, unknown>>(new Map());
  const [currentStreamingSection, setCurrentStreamingSection] = useState<StrategicBlueprintSection | null>(null);
  const [streamingCost, setStreamingCost] = useState(0);

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

  // Onboarding complete → Generate Strategic Blueprint (with SSE streaming)
  const handleOnboardingComplete = useCallback(async (data: OnboardingFormData) => {
    setOnboardingData(data);
    saveOnboardingData(data);
    setPageState("generating-blueprint");
    setError(null);
    setStreamingSections(new Map());
    setCurrentStreamingSection(null);
    setStreamingCost(0);
    setBlueprintProgress({
      currentSection: "industryMarketOverview",
      completedSections: [],
      partialOutput: {},
      progressPercentage: 0,
      progressMessage: "Starting Strategic Blueprint generation...",
    });

    try {
      // Use SSE streaming for real-time section updates
      const response = await fetch("/api/strategic-blueprint/generate?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingData: data }),
      });

      // Check if we got a streaming response
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream") && response.body) {
        // Handle SSE streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double newline (SSE event separator)
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const eventStr of events) {
            if (!eventStr.trim()) continue;

            const event = parseSSEEvent(eventStr);
            if (!event) continue;

            switch (event.type) {
              case "section-start":
                setCurrentStreamingSection(event.section);
                setBlueprintProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentSection: event.section,
                        progressMessage: `Generating ${event.label}...`,
                      }
                    : null
                );
                break;

              case "section-complete":
                setStreamingSections((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(event.section, event.data);
                  return newMap;
                });
                setBlueprintProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completedSections: [...prev.completedSections, event.section],
                        partialOutput: {
                          ...prev.partialOutput,
                          [event.section]: event.data,
                        },
                        progressMessage: `Completed ${event.label}`,
                      }
                    : null
                );
                break;

              case "progress":
                setBlueprintProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        progressPercentage: event.percentage,
                        progressMessage: event.message,
                      }
                    : null
                );
                break;

              case "metadata":
                setStreamingCost(event.estimatedCost);
                break;

              case "done":
                setStrategicBlueprint(event.strategicBlueprint);
                saveStrategicBlueprint(event.strategicBlueprint);
                setBlueprintMeta({
                  totalTime: event.metadata.totalTime,
                  totalCost: event.metadata.totalCost,
                });
                setCurrentStreamingSection(null);
                setPageState("review-blueprint");
                break;

              case "error":
                setError({
                  message: event.message,
                  retryable: true,
                });
                setPageState("error");
                break;
            }
          }
        }
      } else {
        // Fallback to non-streaming JSON response (backward compatibility)
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

    // Use streaming cost if available, otherwise estimate based on elapsed time
    const estimatedCost = streamingCost > 0 ? streamingCost : (elapsedTime / 1000) * 0.001;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: durations.normal }}
          >
            <GradientBorder animate={true}>
              <div className="p-6 space-y-6">
                {/* Header - compact */}
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: durations.normal }}
                >
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Generating Blueprint
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
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

                {/* Streaming Section Preview - only show when sections start completing */}
                <AnimatePresence>
                  {streamingSections.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <StreamingSectionPreview
                        sections={streamingSections}
                        currentSection={currentStreamingSection}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
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
          {/* Success Header */}
          <motion.div
            className="mx-auto max-w-5xl mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.normal, ease: easings.out }}
          >
            <GradientBorder>
              <div className="p-6">
                {/* Main header row */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    {/* Success indicator with pulse */}
                    <div className="relative">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ background: 'var(--success-subtle)' }}
                      >
                        <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--success)' }} />
                      </div>
                      {/* Subtle pulse ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: '2px solid var(--success)' }}
                        initial={{ opacity: 0.5, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 1.5, repeat: 2 }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Blueprint Complete
                      </h2>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        5-section strategic analysis ready
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2"
                      onClick={handleShare}
                      disabled={isSharing || !!shareUrl}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                      }}
                    >
                      {isSharing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : shareUrl ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                      {isSharing ? 'Sharing...' : shareUrl ? 'Shared' : 'Share'}
                    </MagneticButton>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2"
                      onClick={handleRegenerateBlueprint}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Regenerate
                    </MagneticButton>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2"
                      onClick={handleStartOver}
                      style={{
                        background: 'var(--gradient-primary)',
                        color: 'white',
                      }}
                    >
                      New Blueprint
                    </MagneticButton>
                  </div>
                </div>

                {/* Stats row */}
                {blueprintMeta && (
                  <motion.div
                    className="flex flex-wrap gap-6 mt-6 pt-6"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="text-sm font-mono"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {Math.round(blueprintMeta.totalTime / 1000)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="text-sm font-mono"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        ${blueprintMeta.totalCost.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        5 sections analyzed
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Share Link Display */}
                <AnimatePresence>
                  {shareUrl && (
                    <motion.div
                      className="mt-6 p-4 rounded-lg"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                      }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
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
                          className="flex-1 px-3 py-2 text-sm rounded-md font-mono"
                          style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <MagneticButton
                          className="h-9 px-4 rounded-md text-sm font-medium"
                          onClick={handleCopyLink}
                          style={{
                            background: 'var(--gradient-primary)',
                            color: 'white',
                          }}
                        >
                          {shareCopied ? (
                            <span className="flex items-center gap-1">
                              <Check className="h-4 w-4" />
                              Copied
                            </span>
                          ) : (
                            "Copy"
                          )}
                        </MagneticButton>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                        Anyone with this link can view this blueprint
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Share Error Display */}
                <AnimatePresence>
                  {shareError && (
                    <motion.div
                      className="mt-4 p-3 rounded-lg"
                      style={{
                        background: 'var(--error-subtle)',
                        border: '1px solid var(--error)',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <p className="text-sm" style={{ color: 'var(--error)' }}>{shareError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GradientBorder>
          </motion.div>

          {/* Strategic Blueprint Display */}
          <motion.div
            className="mx-auto max-w-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
          >
            <StrategicBlueprintDisplay strategicBlueprint={strategicBlueprint} />
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}
