"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Clock,
  Coins,
  Wand2,
  FileSearch,
  Share2,
  Link2,
  Check,
  Download,
  LayoutDashboard,
} from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding";
import { createRoot } from "react-dom/client";
import { PolishedBlueprintView } from "@/components/strategic-blueprint/polished-blueprint-view";
import PdfMarkdownContent from "@/components/strategic-blueprint/pdf-markdown-content";
import { BlueprintDocument } from "@/components/strategic-research";
import { ChatSidebar } from "@/components/chat";
import { SplitChatLayout } from "@/components/layout";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ApiErrorDisplay, parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import { Pipeline, GenerationStats } from "@/components/pipeline";
import { SaaSLaunchBackground, ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader, type GenerateStage } from "@/components/generate";
import { updateOnboardingData as persistOnboardingData, completeOnboarding } from "@/lib/actions/onboarding";
import { saveBlueprint } from "@/lib/actions/blueprints";
import { easings, fadeUp, durations } from "@/lib/motion";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput, StrategicBlueprintProgress, StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import {
  setOnboardingData as saveOnboardingData,
  setStrategicBlueprint as saveStrategicBlueprint,
  clearAllSavedData,
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

// Map page state to header stage
function getHeaderStage(pageState: PageState): GenerateStage {
  switch (pageState) {
    case "onboarding":
      return "onboarding";
    case "generating-blueprint":
      return "generate";
    case "review-blueprint":
      return "review";
    case "complete":
      return "complete";
    case "error":
      return "generate"; // Show generate stage during error
    default:
      return "onboarding";
  }
}

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [strategicBlueprint, setStrategicBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<StrategicBlueprintProgress | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [blueprintMeta, setBlueprintMeta] = useState<{ totalTime: number; totalCost: number } | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [initialData, setInitialData] = useState<OnboardingFormData | undefined>(undefined);

  // Generation elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0);
  const generationStartRef = useRef<number | null>(null);

  // Share state
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Track if user has started filling in onboarding (for exit confirmation)
  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);

  // Streaming state for real-time section display
  const [streamingSections, setStreamingSections] = useState<Map<StrategicBlueprintSection, unknown>>(new Map());
  const [currentStreamingSection, setCurrentStreamingSection] = useState<StrategicBlueprintSection | null>(null);
  const [streamingCost, setStreamingCost] = useState(0);

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

  const handleAutoFill = useCallback(() => {
    setInitialData(SAMPLE_ONBOARDING_DATA);
    setWizardKey((prev) => prev + 1);
  }, []);

  // Persist onboarding data to Supabase on each step change
  const handleStepChange = useCallback(async (_step: number, data: Partial<OnboardingFormData>) => {
    // Mark that user has started filling in data (for exit confirmation)
    setHasStartedOnboarding(true);

    // Debounced save to Supabase - save in background, don't block UI
    try {
      // Map the onboarding form data to the database format
      const dbData = {
        businessBasics: data.businessBasics ? JSON.parse(JSON.stringify(data.businessBasics)) : undefined,
        icpData: data.icp ? JSON.parse(JSON.stringify(data.icp)) : undefined,
        productOffer: data.productOffer ? JSON.parse(JSON.stringify(data.productOffer)) : undefined,
        marketCompetition: data.marketCompetition ? JSON.parse(JSON.stringify(data.marketCompetition)) : undefined,
        customerJourney: data.customerJourney ? JSON.parse(JSON.stringify(data.customerJourney)) : undefined,
        brandPositioning: data.brandPositioning ? JSON.parse(JSON.stringify(data.brandPositioning)) : undefined,
        assetsProof: data.assetsProof ? JSON.parse(JSON.stringify(data.assetsProof)) : undefined,
        budgetTargets: data.budgetTargets ? JSON.parse(JSON.stringify(data.budgetTargets)) : undefined,
        compliance: data.compliance ? JSON.parse(JSON.stringify(data.compliance)) : undefined,
      };

      // Filter out undefined values
      const filteredData = Object.fromEntries(
        Object.entries(dbData).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(filteredData).length > 0) {
        await persistOnboardingData(filteredData);
      }
    } catch (error) {
      // Don't block the UI if save fails - data is also in localStorage
      console.error('[Generate] Failed to persist onboarding data:', error);
    }
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
    setHasStartedOnboarding(false);
    clearAllSavedData();
  }, []);

  const handleRegenerateBlueprint = useCallback(() => {
    if (onboardingData) {
      handleOnboardingComplete(onboardingData);
    }
  }, [onboardingData, handleOnboardingComplete]);

  const handleBackToReview = useCallback(() => {
    setPageState("review-blueprint");
  }, []);

  const handleApprove = useCallback(async (approvedBlueprint: StrategicBlueprintOutput) => {
    // Save approved blueprint to localStorage (offline fallback)
    saveStrategicBlueprint(approvedBlueprint);
    // Update state with approved blueprint
    setStrategicBlueprint(approvedBlueprint);

    // Mark onboarding complete in database
    try {
      await completeOnboarding();
    } catch (err) {
      console.error('[Generate] Failed to complete onboarding:', err);
    }

    // Save blueprint to database
    if (onboardingData) {
      const title = approvedBlueprint.industryMarketOverview?.categorySnapshot?.category ||
                    onboardingData.businessBasics?.businessName ||
                    'Strategic Blueprint';

      try {
        const result = await saveBlueprint({
          title: String(title),
          inputData: onboardingData,
          output: approvedBlueprint,
          metadata: blueprintMeta ? {
            totalTime: blueprintMeta.totalTime,
            totalCost: blueprintMeta.totalCost,
            generatedAt: new Date().toISOString(),
          } : undefined,
        });

        if (result.error) {
          console.error('[Generate] Failed to save blueprint:', result.error);
        }
      } catch (err) {
        console.error('[Generate] Blueprint save error:', err);
      }
    }

    // Transition to complete state
    setPageState("complete");
    // Reset share state when approving new blueprint
    setShareUrl(null);
    setShareError(null);
  }, [onboardingData, blueprintMeta]);

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

  // Export PDF handler
  const handleExportPDF = useCallback(async () => {
    if (!strategicBlueprint) return;

    setIsExporting(true);

    try {
      const [html2canvasModule, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jspdfModule;

      const date = new Date().toISOString().split("T")[0];
      const filename = `Strategic-Blueprint-${date}.pdf`;

      // Create a temporary container for the PDF content
      const container = document.createElement("div");
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 850px;
        background: #ffffff;
      `;
      document.body.appendChild(container);

      // Render the PdfMarkdownContent component into the container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<PdfMarkdownContent strategicBlueprint={strategicBlueprint} />);
        setTimeout(resolve, 300);
      });

      const content = container.firstElementChild as HTMLElement;
      if (!content) {
        throw new Error("Failed to render PDF content");
      }

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      root.unmount();
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 0;

      while (heightLeft > 0) {
        if (pageNumber > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
        pageNumber++;
      }

      pdf.save(filename);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert(`PDF export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  }, [strategicBlueprint]);

  // Compute if user has unsaved progress
  const hasUnsavedProgress = Boolean(
    hasStartedOnboarding ||
    onboardingData ||
    strategicBlueprint ||
    (pageState === "generating-blueprint")
  );

  // Onboarding State
  if (pageState === "onboarding") {
    return (
      <div className="min-h-screen relative flex flex-col" style={{ background: 'rgb(7, 9, 14)' }}>
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={hasUnsavedProgress}
          onExit={handleStartOver}
          exitUrl="/dashboard"
        />

        {/* SaaSLaunch Shader Mesh Background */}
        <ShaderMeshBackground variant="hero" />
        <BackgroundPattern opacity={0.02} />

        <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
          {/* Header - SaaSLaunch Typography */}
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

            {/* Stage Indicator - SaaSLaunch Style */}
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
                    color: 'rgb(54, 94, 255)'
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

            {/* Auto-fill Button - SaaSLaunch Secondary Style */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <MagneticButton
                className="mt-4 h-10 px-5 rounded-full text-sm font-medium flex items-center transition-all duration-200 hover:border-[rgb(54,94,255)] hover:text-[rgb(54,94,255)]"
                onClick={handleAutoFill}
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
            onComplete={handleOnboardingComplete}
            onStepChange={handleStepChange}
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
      <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-base)' }}>
        {/* Persistent Navigation Header - collapsible during generation */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={true}
          onExit={handleStartOver}
          exitUrl="/dashboard"
          collapsible={true}
        />

        {/* SaaSLaunch Shader Mesh Background */}
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
                {/* Header - compact */}
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

  // Error State
  if (pageState === "error" && error) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={hasUnsavedProgress}
          onExit={handleStartOver}
          exitUrl="/dashboard"
        />

        <div className="flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 py-8 max-w-lg">
            <ApiErrorDisplay
              error={error}
              onRetry={handleRetryBlueprint}
              onGoBack={handleStartOver}
            />
          </div>
        </div>
      </div>
    );
  }

  // Review Blueprint State
  if (pageState === "review-blueprint" && strategicBlueprint) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={hasUnsavedProgress}
          onExit={handleStartOver}
          exitUrl="/dashboard"
        />

        {/* Main content area */}
        <div className="flex-1 min-h-0">
          <SplitChatLayout
            chatContent={
              <ChatSidebar
                blueprint={strategicBlueprint as unknown as Record<string, unknown>}
                onBlueprintUpdate={(updated) => setStrategicBlueprint(updated as unknown as StrategicBlueprintOutput)}
              />
            }
            blueprintContent={
              <div className="container mx-auto px-4 py-8 md:py-12 pb-32">
                {/* Review Component */}
                <div className="mx-auto max-w-6xl">
                  <BlueprintDocument
                    strategicBlueprint={strategicBlueprint}
                    onApprove={handleApprove}
                    onRegenerate={handleRegenerateBlueprint}
                  />
                </div>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  // Complete State - Show Strategic Blueprint
  if (pageState === "complete" && strategicBlueprint) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={false}
          exitUrl="/dashboard"
        />

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
                        style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                      >
                        <CheckCircle2 className="h-6 w-6" style={{ color: 'rgb(34, 197, 94)' }} />
                      </div>
                      {/* Subtle pulse ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: '2px solid rgb(34, 197, 94)' }}
                        initial={{ opacity: 0.5, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 1.5, repeat: 2 }}
                      />
                    </div>
                    <div>
                      <h2
                        className="text-xl font-semibold"
                        style={{
                          color: 'var(--text-heading)',
                          fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                        }}
                      >
                        Blueprint Complete
                      </h2>
                      <p
                        className="text-sm"
                        style={{
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
                      >
                        5-section strategic analysis ready
                      </p>
                    </div>
                  </div>

                  {/* Actions - SaaSLaunch styled buttons:
                       1. Back to Dashboard (primary gradient - most important)
                       2. Back to Review (secondary outline)
                       3. Export PDF (secondary outline)
                       4. Share (secondary outline)
                       5. Regenerate (secondary outline)
                       6. New Blueprint (secondary outline)
                  */}
                  <div className="flex flex-wrap items-center gap-3">
                    <a href="/dashboard">
                      <MagneticButton
                        className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2"
                        style={{
                          background: 'var(--gradient-primary)',
                          color: 'white',
                          fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                        }}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Back to Dashboard
                      </MagneticButton>
                    </a>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                      onClick={handleBackToReview}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Review
                    </MagneticButton>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {isExporting ? 'Exporting...' : 'Export PDF'}
                    </MagneticButton>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                      onClick={handleShare}
                      disabled={isSharing || !!shareUrl}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
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
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                      onClick={handleRegenerateBlueprint}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Regenerate
                    </MagneticButton>
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                      onClick={handleStartOver}
                      style={{
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                    >
                      <Wand2 className="h-4 w-4" />
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
                        style={{
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {Math.round(blueprintMeta.totalTime / 1000)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="text-sm font-mono"
                        style={{
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ${blueprintMeta.totalCost.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="text-sm"
                        style={{
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
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
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                      }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Link2 className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                        <span
                          className="font-medium text-sm"
                          style={{
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-sans), Inter, sans-serif',
                          }}
                        >
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
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                        <MagneticButton
                          className="h-9 px-4 rounded-md text-sm font-medium"
                          onClick={handleCopyLink}
                          style={{
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
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
                      <p
                        className="text-xs mt-2"
                        style={{
                          color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
                      >
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
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgb(239, 68, 68)',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <p
                        className="text-sm"
                        style={{
                          color: 'rgb(239, 68, 68)',
                          fontFamily: 'var(--font-sans), Inter, sans-serif',
                        }}
                      >
                        {shareError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GradientBorder>
          </motion.div>

          {/* Polished Blueprint View - Card-based layout */}
          <motion.div
            className="mx-auto max-w-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
          >
            <PolishedBlueprintView strategicBlueprint={strategicBlueprint} />
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}
