"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ApiErrorDisplay, parseApiError, type ParsedApiError } from "@/components/ui/api-error-display";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput, StrategicBlueprintProgress } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_LABELS } from "@/lib/strategic-blueprint/output-types";
import {
  getOnboardingData,
  setOnboardingData as saveOnboardingData,
  getStrategicBlueprint,
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

export default function GeneratePage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [strategicBlueprint, setStrategicBlueprint] = useState<StrategicBlueprintOutput | null>(null);
  const [blueprintProgress, setBlueprintProgress] = useState<StrategicBlueprintProgress | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [blueprintMeta, setBlueprintMeta] = useState<{ totalTime: number; totalCost: number } | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [initialData, setInitialData] = useState<OnboardingFormData | undefined>(undefined);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

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
    } catch (err) {
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <AlertCircle className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Resume Previous Session?</h2>
                  <p className="text-muted-foreground">
                    We found saved progress from a previous session. Would you like to continue where you left off?
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={handleStartFresh}>
                    Start Fresh
                  </Button>
                  <Button className="flex-1" onClick={handleResume}>
                    Resume
                  </Button>
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Header */}
          <div className="mx-auto max-w-4xl mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Generate Your Strategic Blueprint
            </h1>
            <p className="mt-2 text-muted-foreground">
              Complete the onboarding form to generate your comprehensive Strategic Blueprint
            </p>
            {/* Stage Indicator */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <span className="text-sm font-medium">Onboarding</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 opacity-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  2
                </div>
                <span className="text-sm">Strategic Blueprint</span>
              </div>
            </div>
            {/* Auto-fill Button */}
            <Button variant="outline" size="sm" className="mt-4" onClick={handleAutoFill}>
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-fill with Sample Data
            </Button>
          </div>

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
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-2">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                {/* Spinner */}
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-muted" />
                  <Loader2 className="absolute inset-0 h-20 w-20 animate-spin text-primary" />
                  <FileSearch className="absolute inset-0 m-auto h-8 w-8 text-primary" />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Generating Strategic Blueprint</h2>
                  <p className="text-muted-foreground">
                    Analyzing your market, ICP, offer, and competitive landscape
                  </p>
                </div>

                {/* Stage Indicator */}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Step 2 of 2</Badge>
                  <span className="text-muted-foreground">Strategic Blueprint</span>
                </div>

                {/* Progress */}
                <div className="w-full space-y-3">
                  <Progress value={blueprintProgress?.progressPercentage || 5} className="h-3" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {blueprintProgress?.progressMessage || "Initializing..."}
                    </span>
                    <span className="font-medium">{blueprintProgress?.progressPercentage || 0}%</span>
                  </div>
                </div>

                {/* Completed Sections */}
                {blueprintProgress && blueprintProgress.completedSections.length > 0 && (
                  <div className="w-full text-left">
                    <p className="text-sm font-medium mb-2">Completed sections:</p>
                    <div className="flex flex-wrap gap-2">
                      {blueprintProgress.completedSections.map((section) => (
                        <Badge key={section} variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {STRATEGIC_BLUEPRINT_SECTION_LABELS[section]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Section */}
                {blueprintProgress?.currentSection && (
                  <div className="w-full rounded-lg bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm">
                        Currently generating:{" "}
                        <strong>{STRATEGIC_BLUEPRINT_SECTION_LABELS[blueprintProgress.currentSection]}</strong>
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  This typically takes 1-2 minutes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error State
  if (pageState === "error" && error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Stage Indicator */}
          <div className="mx-auto max-w-5xl mb-8">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">Onboarding</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <span className="text-sm font-medium">Review Research</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 opacity-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                  3
                </div>
                <span className="text-sm">Complete</span>
              </div>
            </div>
          </div>

          {/* Review Component */}
          <div className="mx-auto max-w-5xl">
            <StrategicResearchReview
              strategicBlueprint={strategicBlueprint}
              onApprove={handleApprove}
              onRegenerate={handleRegenerateBlueprint}
            />
          </div>
        </div>
      </div>
    );
  }

  // Complete State - Show Strategic Blueprint
  if (pageState === "complete" && strategicBlueprint) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 md:py-12">
          {/* Success Banner */}
          <div className="mx-auto max-w-5xl mb-8">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Strategic Blueprint Complete!</h2>
                      <p className="text-sm text-muted-foreground">
                        Your comprehensive 5-section Strategic Blueprint is ready
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {blueprintMeta && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{Math.round(blueprintMeta.totalTime / 1000)}s</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          <span>${blueprintMeta.totalCost.toFixed(4)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                        disabled={isSharing || !!shareUrl}
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
                      <Button variant="outline" size="sm" onClick={handleRegenerateBlueprint}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleStartOver}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        New Blueprint
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Completed Stage */}
                <div className="mt-4 pt-4 border-t border-green-500/20">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Strategic Blueprint
                    </Badge>
                  </div>
                </div>

                {/* Share Link Display */}
                {shareUrl && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Shareable Link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 text-sm bg-background border rounded-md"
                      />
                      <Button size="sm" onClick={handleCopyLink}>
                        {shareCopied ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          "Copy"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Anyone with this link can view this blueprint
                    </p>
                  </div>
                )}

                {/* Share Error Display */}
                {shareError && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{shareError}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
