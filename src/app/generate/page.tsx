"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  Coins,
  Wand2,
  FileSearch,
  Share2,
  Link2,
  Check,
  Copy,
  Download,
  LayoutDashboard,
  X,
  BarChart3,
} from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding";
import { createRoot } from "react-dom/client";
import { PaginatedBlueprintView } from "@/components/strategic-blueprint/paginated-blueprint-view";
import PdfMarkdownContent from "@/components/strategic-blueprint/pdf-markdown-content";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import { BlueprintDocument } from "@/components/strategic-research";
import { AgentChat } from "@/components/chat";
import { SplitChatLayout } from "@/components/layout";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ApiErrorDisplay, parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import { Pipeline, GenerationStats } from "@/components/pipeline";
import { SaaSLaunchBackground, ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { GenerateHeader, type GenerateStage } from "@/components/generate";
import { updateOnboardingData as persistOnboardingData, completeOnboarding, getOnboardingStatus } from "@/lib/actions/onboarding";
import { mapDbToFormData, getOnboardingProgress } from "@/lib/onboarding/utils";
import { saveBlueprint, getBlueprintById } from "@/lib/actions/blueprints";
import { easings, fadeUp, durations } from "@/lib/motion";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput, StrategicBlueprintProgress, StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import {
  setOnboardingData as saveOnboardingData,
  setStrategicBlueprint as saveStrategicBlueprint,
  setMediaPlan as saveMediaPlan,
  clearAllSavedData,
  hasSavedProgress,
  getSavedProgress,
} from "@/lib/storage/local-storage";
import { useMediaPlanGeneration } from "@/hooks/use-media-plan-generation";
import { MEDIA_PLAN_STAGES } from "@/lib/media-plan/types";
import { MEDIA_PLAN_SECTION_ORDER, MEDIA_PLAN_SECTION_SHORT_LABELS } from "@/lib/media-plan/section-constants";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import { MediaPlanDocument } from "@/components/media-plan";
import { saveMediaPlanAction, updateMediaPlanAction } from "@/lib/actions/media-plans";

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
  | "profile-complete"
  | "generating-blueprint"
  | "review-blueprint"
  | "complete"
  | "generating-media-plan"
  | "review-media-plan"
  | "media-plan-approved"
  | "error";

// Pipeline stages for generation progress visualization
const BLUEPRINT_STAGES = ["Industry", "ICP", "Offer", "Competitors", "Keywords", "Synthesis"];

// Map page state to header stage
function getHeaderStage(pageState: PageState): GenerateStage {
  switch (pageState) {
    case "onboarding":
      return "onboarding";
    case "profile-complete":
      return "onboarding";
    case "generating-blueprint":
      return "generate";
    case "review-blueprint":
      return "review";
    case "complete":
      return "complete";
    case "generating-media-plan":
      return "generate";
    case "review-media-plan":
      return "review";
    case "media-plan-approved":
      return "complete";
    case "error":
      return "generate";
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
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [savedMediaPlanId, setSavedMediaPlanId] = useState<string | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [initialData, setInitialData] = useState<OnboardingFormData | undefined>(undefined);
  const [initialStep, setInitialStep] = useState<number | undefined>(undefined);
  const [isLoadingSavedData, setIsLoadingSavedData] = useState(true);

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
  // Copy as markdown state
  const [blueprintCopied, setBlueprintCopied] = useState(false);

  // Session resume banner state
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [resumedMediaPlan, setResumedMediaPlan] = useState<MediaPlanOutput | null>(null);

  // Media plan generation
  const mediaPlanGen = useMediaPlanGeneration();

  // Streaming state for real-time section display
  const [streamingSections, setStreamingSections] = useState<Map<StrategicBlueprintSection, unknown>>(new Map());
  const [currentStreamingSection, setCurrentStreamingSection] = useState<StrategicBlueprintSection | null>(null);
  const [streamingCost, setStreamingCost] = useState(0);

  // Track elapsed time during generation (blueprint or media plan)
  useEffect(() => {
    if (pageState === "generating-blueprint" || pageState === "generating-media-plan") {
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

  // Load saved data on mount — handles both onboarding resume and blueprint-to-media-plan flow
  useEffect(() => {
    async function loadSavedData() {
      try {
        // Check for blueprint-to-media-plan query params FIRST
        // This must resolve before we drop the loading screen to prevent
        // a flash of the onboarding wizard
        const params = new URLSearchParams(window.location.search);
        const bpId = params.get('blueprintId');
        const action = params.get('action');

        if (bpId && action === 'media-plan') {
          const bpResult = await getBlueprintById(bpId);
          if (bpResult.data) {
            setStrategicBlueprint(bpResult.data.output);
            setOnboardingData(bpResult.data.input_data);
            setBlueprintId(bpResult.data.id);
            setPageState("complete");
          }
          setIsLoadingSavedData(false);
          return;
        }

        // Normal onboarding flow — load saved data from Supabase
        const result = await getOnboardingStatus();
        if (result.data?.onboardingData) {
          const dbData = result.data.onboardingData;
          const formData = mapDbToFormData(dbData) as OnboardingFormData;
          const progress = getOnboardingProgress(dbData);

          // If onboarding is complete and all 9 sections have data, go to profile-complete
          if (result.data.completed && progress.completedSections === 9) {
            setOnboardingData(formData);
            setInitialData(formData);
            setPageState("profile-complete");
          } else if (progress.completedSections > 0) {
            // Partial data — resume at saved step
            setInitialData(formData);
            setInitialStep(progress.currentStep);
            setWizardKey((prev) => prev + 1);
          }
        }
      } catch (err) {
        console.error("[Generate] Failed to load saved data:", err);
      } finally {
        setIsLoadingSavedData(false);
      }

      // Check for resumable media plan progress in localStorage
      if (hasSavedProgress()) {
        const progress = getSavedProgress();
        if (progress.mediaPlan) {
          setShowResumeBanner(true);
        }
      }
    }

    loadSavedData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoFill = useCallback(() => {
    setInitialData(SAMPLE_ONBOARDING_DATA);
    setWizardKey((prev) => prev + 1);
  }, []);

  // Resume from saved media plan progress
  const handleResumeMediaPlan = useCallback(() => {
    const progress = getSavedProgress();
    if (progress.onboardingData) {
      setOnboardingData(progress.onboardingData);
    }
    if (progress.strategicBlueprint) {
      setStrategicBlueprint(progress.strategicBlueprint);
    }
    if (progress.mediaPlan) {
      setResumedMediaPlan(progress.mediaPlan);
    }
    setShowResumeBanner(false);
    setPageState("review-media-plan");
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
        // _step is the step that was just completed; save next step so user resumes there
        currentStep: Math.min(_step + 1, 8),
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

  // Onboarding complete → Save profile and show intermediate screen
  const handleOnboardingFinish = useCallback(async (data: OnboardingFormData) => {
    setOnboardingData(data);
    saveOnboardingData(data);

    // Persist final data to Supabase
    try {
      const dbData = {
        businessBasics: JSON.parse(JSON.stringify(data.businessBasics)),
        icpData: JSON.parse(JSON.stringify(data.icp)),
        productOffer: JSON.parse(JSON.stringify(data.productOffer)),
        marketCompetition: JSON.parse(JSON.stringify(data.marketCompetition)),
        customerJourney: JSON.parse(JSON.stringify(data.customerJourney)),
        brandPositioning: JSON.parse(JSON.stringify(data.brandPositioning)),
        assetsProof: JSON.parse(JSON.stringify(data.assetsProof)),
        budgetTargets: JSON.parse(JSON.stringify(data.budgetTargets)),
        compliance: JSON.parse(JSON.stringify(data.compliance)),
        currentStep: 8,
      };
      await persistOnboardingData(dbData);
    } catch (err) {
      console.error("[Generate] Failed to persist final onboarding data:", err);
    }

    setPageState("profile-complete");
  }, []);

  // Generate Strategic Blueprint from stored onboarding data (with SSE streaming)
  const handleGenerateBlueprint = useCallback(async () => {
    const data = onboardingData;
    if (!data) return;

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

      // Handle non-OK responses before trying to parse
      if (!response.ok) {
        const text = await response.text();
        let errorMessage: string;
        try {
          const errBody = JSON.parse(text);
          errorMessage = errBody?.error?.message || errBody?.message || `Server error (${response.status})`;
        } catch {
          errorMessage = text || `Server error (${response.status})`;
        }
        setError({ message: errorMessage, retryable: true });
        setPageState("error");
        return;
      }

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
  }, [onboardingData]);

  const handleRetryBlueprint = useCallback(() => {
    handleGenerateBlueprint();
  }, [handleGenerateBlueprint]);

  const handleStartOver = useCallback(() => {
    setPageState("onboarding");
    setOnboardingData(null);
    setStrategicBlueprint(null);
    setBlueprintProgress(null);
    setError(null);
    setBlueprintMeta(null);
    setInitialData(undefined);
    setInitialStep(undefined);
    setWizardKey((prev) => prev + 1);
    setHasStartedOnboarding(false);
    clearAllSavedData();
  }, []);

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
        if (result.data?.id) {
          setBlueprintId(result.data.id);
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

  // Generate Media Plan from approved blueprint
  const handleGenerateMediaPlan = useCallback(async () => {
    if (!strategicBlueprint || !onboardingData) return;

    setPageState("generating-media-plan");
    await mediaPlanGen.generate(strategicBlueprint, onboardingData);

    // Check result after generation completes
    if (mediaPlanGen.error) {
      // Stay on generating-media-plan state — error is shown inline
      return;
    }
  }, [strategicBlueprint, onboardingData, mediaPlanGen]);

  // Save media plan when generation completes
  useEffect(() => {
    if (mediaPlanGen.mediaPlan && pageState === "generating-media-plan") {
      saveMediaPlan(mediaPlanGen.mediaPlan);
      setPageState("review-media-plan");
    }
  }, [mediaPlanGen.mediaPlan, pageState]);

  // Approve media plan — save to localStorage + Supabase, transition to approved state
  const handleApproveMediaPlan = useCallback(async (approvedPlan: MediaPlanOutput) => {
    // Save to localStorage
    saveMediaPlan(approvedPlan);

    // Save to Supabase
    const title = approvedPlan.executiveSummary?.primaryObjective ||
                  onboardingData?.businessBasics?.businessName ||
                  'Media Plan';
    try {
      const mpResult = await saveMediaPlanAction({
        title: String(title),
        blueprintId: blueprintId ?? undefined,
        output: approvedPlan,
        metadata: mediaPlanGen.meta ? {
          totalTime: mediaPlanGen.meta.totalTime,
          totalCost: mediaPlanGen.meta.totalCost,
          generatedAt: new Date().toISOString(),
        } : undefined,
        status: 'approved',
      });
      if (mpResult.data?.id) {
        setSavedMediaPlanId(mpResult.data.id);
      }
    } catch (err) {
      console.error('[Generate] Failed to save media plan:', err);
    }

    setPageState("media-plan-approved");
  }, [onboardingData, mediaPlanGen.meta, blueprintId]);

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
        backgroundColor: null,
        allowTaint: true,
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

  // Copy blueprint as markdown handler
  const handleCopyBlueprint = useCallback(() => {
    if (!strategicBlueprint) return;
    const markdown = generateBlueprintMarkdown(strategicBlueprint);
    navigator.clipboard.writeText(markdown);
    setBlueprintCopied(true);
    setTimeout(() => setBlueprintCopied(false), 2000);
  }, [strategicBlueprint]);

  // Compute if user has unsaved progress
  const hasUnsavedProgress = Boolean(
    hasStartedOnboarding ||
    onboardingData ||
    strategicBlueprint ||
    (pageState === "generating-blueprint")
  );

  // Loading State — while checking for saved onboarding data
  if (isLoadingSavedData && pageState === "onboarding") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'rgb(7, 9, 14)' }}>
        <ShaderMeshBackground variant="hero" />
        <BackgroundPattern opacity={0.02} />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgb(54, 94, 255)' }} />
          <p
            className="text-sm"
            style={{
              color: 'rgb(205, 208, 213)',
              fontFamily: 'var(--font-sans), Inter, sans-serif',
            }}
          >
            Loading your business profile...
          </p>
        </div>
      </div>
    );
  }

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
            initialStep={initialStep}
            onComplete={handleOnboardingFinish}
            onStepChange={handleStepChange}
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
                  onClick={handleResumeMediaPlan}
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
                  onClick={() => setShowResumeBanner(false)}
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

  // Profile Complete — intermediate screen before generating
  if (pageState === "profile-complete") {
    const businessName = onboardingData?.businessBasics?.businessName || initialData?.businessBasics?.businessName || "Your Company";
    return (
      <div className="min-h-screen relative flex flex-col" style={{ background: 'rgb(7, 9, 14)' }}>
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
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
                      onClick={handleGenerateBlueprint}
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
                      onClick={() => {
                        setOnboardingData(SAMPLE_ONBOARDING_DATA);
                        setPageState("profile-complete");
                      }}
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
                        onClick={() => {
                          setInitialData(onboardingData || initialData);
                          setInitialStep(0);
                          setWizardKey((prev) => prev + 1);
                          setPageState("onboarding");
                        }}
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
                  onClick={handleResumeMediaPlan}
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
                  onClick={() => setShowResumeBanner(false)}
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
      <div className="relative flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={hasUnsavedProgress}
          onExit={handleStartOver}
          exitUrl="/dashboard"
        />

        <ShaderMeshBackground variant="page" />
        <BackgroundPattern opacity={0.015} />

        {/* Main content area */}
        <div className="z-10 flex min-h-0 flex-1">
          <SplitChatLayout
            chatContent={
              <AgentChat
                blueprint={strategicBlueprint as unknown as Record<string, unknown>}
                onBlueprintUpdate={(updated) => setStrategicBlueprint(updated as unknown as StrategicBlueprintOutput)}
              />
            }
            blueprintContent={
              <BlueprintDocument
                strategicBlueprint={strategicBlueprint}
                onApprove={handleApprove}

              />
            }
          />
        </div>
      </div>
    );
  }

  // Complete State - Show Strategic Blueprint
  if (pageState === "complete" && strategicBlueprint) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)]">
        {/* Persistent Navigation Header */}
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={false}
          exitUrl="/dashboard"
        />

        <ShaderMeshBackground variant="page" />
        <BackgroundPattern opacity={0.015} />

        <main className="flex-1 min-h-0 flex flex-col relative z-10">
          {/* Success Header */}
          <div className="shrink-0 container mx-auto px-4 py-4">
            <motion.div
              className="mx-auto max-w-5xl"
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        {/* Subtle pulse ring */}
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-green-500"
                          initial={{ opacity: 0.5, scale: 1 }}
                          animate={{ opacity: 0, scale: 1.5 }}
                          transition={{ duration: 1.5, repeat: 2 }}
                        />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white/90 font-[family-name:var(--font-heading)]">
                          Blueprint Complete
                        </h2>
                        <p className="text-sm text-white/40">
                          {strategicBlueprint?.keywordIntelligence ? '6' : '5'}-section strategic analysis ready
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      <MagneticButton
                        className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white transition-opacity duration-200 hover:opacity-90"
                        onClick={handleGenerateMediaPlan}
                      >
                        <Wand2 className="h-4 w-4" />
                        Generate Media Plan
                      </MagneticButton>
                      <a href="/dashboard">
                        <MagneticButton
                          className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Back to Dashboard
                        </MagneticButton>
                      </a>
                      <MagneticButton
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        onClick={handleBackToReview}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Review
                      </MagneticButton>
                      <MagneticButton
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 bg-transparent"
                        onClick={handleCopyBlueprint}
                        style={{
                          border: `1px solid ${blueprintCopied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: blueprintCopied ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {blueprintCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {blueprintCopied ? 'Copied' : 'Copy'}
                      </MagneticButton>
                      <MagneticButton
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                      </MagneticButton>
                      <MagneticButton
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        onClick={handleShare}
                        disabled={isSharing || !!shareUrl}
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
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 text-white/50 border border-white/[0.08] hover:border-blue-500/30 hover:text-blue-400 bg-transparent"
                        onClick={handleStartOver}
                      >
                        <Wand2 className="h-4 w-4" />
                        New Blueprint
                      </MagneticButton>
                    </div>
                  </div>

                  {/* Stats row */}
                  {blueprintMeta && (
                    <motion.div
                      className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/[0.06]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-white/30" />
                        <span className="text-sm font-mono text-white/50">
                          {Math.round(blueprintMeta.totalTime / 1000)}s
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-white/30" />
                        <span className="text-sm font-mono text-white/50">
                          ${blueprintMeta.totalCost.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileSearch className="h-4 w-4 text-white/30" />
                        <span className="text-sm text-white/50">
                          {strategicBlueprint?.keywordIntelligence ? '6' : '5'} sections analyzed
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {/* Share Link Display */}
                  <AnimatePresence>
                    {shareUrl && (
                      <motion.div
                        className="mt-6 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Link2 className="h-4 w-4 text-blue-400" />
                          <span className="font-medium text-sm text-white/80">
                            Shareable Link
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="flex-1 px-3 py-2 text-sm rounded-md bg-white/[0.03] border border-white/[0.08] text-white/80 font-[family-name:var(--font-mono)] outline-none"
                          />
                          <MagneticButton
                            className="h-9 rounded-full px-4 text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 text-white transition-opacity duration-200 hover:opacity-90"
                            onClick={handleCopyLink}
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
                        <p className="text-xs mt-2 text-white/30">
                          Anyone with this link can view this blueprint
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Share Error Display */}
                  <AnimatePresence>
                    {shareError && (
                      <motion.div
                        className="mt-4 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <p className="text-sm text-red-400/80">
                          {shareError}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </GradientBorder>
            </motion.div>
          </div>

          {/* Paginated Blueprint Content - fills remaining space */}
          <div className="flex-1 min-h-0">
            <PaginatedBlueprintView strategicBlueprint={strategicBlueprint} />
          </div>
        </main>
      </div>
    );
  }

  // Generating Media Plan State
  if (pageState === "generating-media-plan") {
    // Map pipeline phase to stage index for the high-level Pipeline component
    const phaseToStageIndex: Record<string, number> = { research: 0, synthesis: 1, validation: 2, final: 3 };
    const mediaPlanStageIndex = mediaPlanGen.currentPhase
      ? phaseToStageIndex[mediaPlanGen.currentPhase] ?? 0
      : 0;
    const mediaPlanTotalStages = MEDIA_PLAN_STAGES.length;
    const completedCount = mediaPlanGen.completedSections.size;
    const totalSections = MEDIA_PLAN_SECTION_ORDER.length;
    // Estimate cost from elapsed time (rough rate until final cost arrives)
    const mediaPlanEstimatedCost = mediaPlanGen.meta?.totalCost ?? (elapsedTime / 1000) * 0.0008;

    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-base)' }}>
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={true}
          onExit={handleStartOver}
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
                      {mediaPlanGen.progress.message || "Starting..."}
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
                      const isComplete = mediaPlanGen.completedSections.has(key);
                      const isActive = mediaPlanGen.activeSections.has(key);
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
                          <span className="truncate">{MEDIA_PLAN_SECTION_SHORT_LABELS[key]}</span>
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
                  {mediaPlanGen.error && (
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
                        {mediaPlanGen.error}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <MagneticButton
                          className="h-8 px-4 rounded-full text-sm font-medium"
                          onClick={handleGenerateMediaPlan}
                          style={{
                            background: 'var(--gradient-primary)',
                            color: 'white',
                          }}
                        >
                          Retry
                        </MagneticButton>
                        <MagneticButton
                          className="h-8 px-4 rounded-full text-sm font-medium"
                          onClick={() => setPageState("complete")}
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

  // Review Media Plan State — paginated review with chat + approve/reject
  const activeMediaPlan = resumedMediaPlan ?? mediaPlanGen.mediaPlan;
  if (pageState === "review-media-plan" && activeMediaPlan) {
    return (
      <div className="relative flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
        <GenerateHeader
          currentStage={getHeaderStage(pageState)}
          hasUnsavedProgress={true}
          onExit={handleStartOver}
          exitUrl="/dashboard"
        />
        <ShaderMeshBackground variant="page" />
        <BackgroundPattern opacity={0.015} />
        <div className="z-10 flex min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
            <MediaPlanDocument
              mediaPlan={activeMediaPlan}
              onApprove={handleApproveMediaPlan}
            />
          </div>
        </div>
      </div>
    );
  }

  // Media Plan Approved State — final success screen
  if (pageState === "media-plan-approved" && mediaPlanGen.mediaPlan) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg-base)' }}>
        <GenerateHeader currentStage={getHeaderStage(pageState)} hasUnsavedProgress={false} exitUrl="/dashboard" />
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
                      {mediaPlanGen.mediaPlan.platformStrategy.length} platforms, {mediaPlanGen.mediaPlan.campaignPhases.length} phases ready for execution.
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
                      onClick={() => setPageState("review-media-plan")}
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

  return null;
}
