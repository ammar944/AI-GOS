"use client";

import { useState, useCallback, useEffect } from "react";
import { useGeneratePageState } from "@/hooks/use-generate-page-state";
import { useBlueprintGeneration } from "@/hooks/use-blueprint-generation";
import { useBlueprintShare } from "@/hooks/use-blueprint-share";
import { useGeneratePersistence } from "@/hooks/use-generate-persistence";
import { useElapsedTimer } from "@/hooks/use-elapsed-timer";
import { useMediaPlanGeneration } from "@/hooks/use-media-plan-generation";
import { setMediaPlan as saveMediaPlan } from "@/lib/storage/local-storage";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import {
  GenerateLoading,
  OnboardingView,
  ProfileCompleteView,
  BlueprintGeneratingView,
  ErrorView,
  BlueprintReviewView,
  BlueprintCompleteView,
  MediaPlanGeneratingView,
  MediaPlanReviewView,
  MediaPlanApprovedView,
} from "./_components";

export default function GeneratePage() {
  // ── Hooks ──────────────────────────────────────────────────────────────
  const { pageState, setPageState, headerStage } = useGeneratePageState();
  const blueprint = useBlueprintGeneration();
  const share = useBlueprintShare();
  const persist = useGeneratePersistence();
  const mediaPlanGen = useMediaPlanGeneration();
  const mediaPlanElapsed = useElapsedTimer(pageState === "generating-media-plan");

  // ── Local state ────────────────────────────────────────────────────────
  const [onboardingData, setOnboardingData] = useState<OnboardingFormData | null>(null);
  const [mediaPlanOverride, setMediaPlanOverride] = useState<MediaPlanOutput | null>(null);

  // ── Mount: apply persistence load result ───────────────────────────────
  useEffect(() => {
    if (!persist.loadResult) return;

    switch (persist.loadResult.type) {
      case "blueprint-to-media-plan":
        blueprint.setStrategicBlueprint(persist.loadResult.blueprint);
        setOnboardingData(persist.loadResult.onboardingData);
        setPageState("complete");
        break;
      case "complete-onboarding":
        setOnboardingData(persist.loadResult.formData);
        setPageState("profile-complete");
        break;
      case "partial-onboarding":
        // initialData/initialStep already set inside the hook
        break;
      case "fresh":
      case "error":
        break;
    }
  }, [persist.loadResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-transition: media plan generation complete ────────────────────
  useEffect(() => {
    if (mediaPlanGen.mediaPlan && pageState === "generating-media-plan") {
      saveMediaPlan(mediaPlanGen.mediaPlan);
      setPageState("review-media-plan");
    }
  }, [mediaPlanGen.mediaPlan, pageState, setPageState]);

  // ── Derived state ──────────────────────────────────────────────────────
  const hasUnsavedProgress = Boolean(
    persist.hasStartedOnboarding ||
    onboardingData ||
    blueprint.strategicBlueprint ||
    pageState === "generating-blueprint"
  );

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleOnboardingFinish = useCallback(async (data: OnboardingFormData) => {
    setOnboardingData(data);
    await persist.handleOnboardingFinish(data);
    setPageState("profile-complete");
  }, [persist, setPageState]);

  const handleGenerateBlueprint = useCallback(async () => {
    if (!onboardingData) return;
    setPageState("generating-blueprint");
    const result = await blueprint.generate(onboardingData);
    if (result.success) {
      setPageState("review-blueprint");
    } else {
      setPageState("error");
    }
  }, [onboardingData, blueprint, setPageState]);

  const handleApprove = useCallback(async (approved: StrategicBlueprintOutput) => {
    blueprint.setStrategicBlueprint(approved);
    await persist.handleApproveBlueprint(approved, onboardingData, blueprint.blueprintMeta);
    setPageState("complete");
    share.resetShareState();
  }, [blueprint, persist, onboardingData, share, setPageState]);

  const handleGenerateMediaPlan = useCallback(async () => {
    if (!blueprint.strategicBlueprint || !onboardingData) return;
    setPageState("generating-media-plan");
    await mediaPlanGen.generate(blueprint.strategicBlueprint, onboardingData);
  }, [blueprint.strategicBlueprint, onboardingData, mediaPlanGen, setPageState]);

  const handleApproveMediaPlan = useCallback(async (plan: MediaPlanOutput) => {
    await persist.handleApproveMediaPlan(plan, onboardingData, mediaPlanGen.meta);
    setPageState("media-plan-approved");
  }, [persist, onboardingData, mediaPlanGen.meta, setPageState]);

  const handleMediaPlanChatUpdate = useCallback((updated: Record<string, unknown>) => {
    setMediaPlanOverride(updated as unknown as MediaPlanOutput);
  }, []);

  const handleResumeMediaPlan = useCallback(() => {
    const progress = persist.handleResumeMediaPlan();
    if (progress.onboardingData) setOnboardingData(progress.onboardingData);
    if (progress.strategicBlueprint) blueprint.setStrategicBlueprint(progress.strategicBlueprint);
    setPageState("review-media-plan");
  }, [persist, blueprint, setPageState]);

  const handleStartOver = useCallback(() => {
    setPageState("onboarding");
    setOnboardingData(null);
    setMediaPlanOverride(null);
    blueprint.reset();
    share.resetShareState();
    mediaPlanGen.reset();
    persist.handleStartOver();
  }, [setPageState, blueprint, share, mediaPlanGen, persist]);

  const handleUseSampleData = useCallback(() => {
    setOnboardingData(SAMPLE_ONBOARDING_DATA);
    setPageState("profile-complete");
  }, [setPageState]);

  const handleEditProfile = useCallback(() => {
    persist.editProfile(onboardingData || persist.initialData);
    setPageState("onboarding");
  }, [persist, onboardingData, setPageState]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (persist.isLoading && pageState === "onboarding") {
    return <GenerateLoading />;
  }

  switch (pageState) {
    case "onboarding":
      return (
        <OnboardingView
          headerStage={headerStage}
          hasUnsavedProgress={hasUnsavedProgress}
          wizardKey={persist.wizardKey}
          initialData={persist.initialData}
          initialStep={persist.initialStep}
          showResumeBanner={persist.showResumeBanner}
          onAutoFill={persist.handleAutoFill}
          onComplete={handleOnboardingFinish}
          onStepChange={persist.handleStepChange}
          onResumeMediaPlan={handleResumeMediaPlan}
          onDismissResumeBanner={() => persist.setShowResumeBanner(false)}
          onStartOver={handleStartOver}
        />
      );

    case "profile-complete":
      return (
        <ProfileCompleteView
          headerStage={headerStage}
          businessName={
            onboardingData?.businessBasics?.businessName ||
            persist.initialData?.businessBasics?.businessName ||
            "Your Company"
          }
          showResumeBanner={persist.showResumeBanner}
          onGenerate={handleGenerateBlueprint}
          onUseSampleData={handleUseSampleData}
          onEditProfile={handleEditProfile}
          onResumeMediaPlan={handleResumeMediaPlan}
          onDismissResumeBanner={() => persist.setShowResumeBanner(false)}
        />
      );

    case "generating-blueprint":
      return (
        <BlueprintGeneratingView
          headerStage={headerStage}
          blueprintProgress={blueprint.blueprintProgress}
          elapsedTime={blueprint.elapsedTime}
          streamingCost={blueprint.streamingCost}
          onStartOver={handleStartOver}
        />
      );

    case "error":
      if (!blueprint.error) return null;
      return (
        <ErrorView
          headerStage={headerStage}
          error={blueprint.error}
          hasUnsavedProgress={hasUnsavedProgress}
          onRetry={handleGenerateBlueprint}
          onStartOver={handleStartOver}
        />
      );

    case "review-blueprint":
      if (!blueprint.strategicBlueprint) return null;
      return (
        <BlueprintReviewView
          headerStage={headerStage}
          hasUnsavedProgress={hasUnsavedProgress}
          strategicBlueprint={blueprint.strategicBlueprint}
          onApprove={handleApprove}
          onBlueprintUpdate={(updated) => blueprint.setStrategicBlueprint(updated)}
          onStartOver={handleStartOver}
        />
      );

    case "complete":
      if (!blueprint.strategicBlueprint) return null;
      return (
        <BlueprintCompleteView
          headerStage={headerStage}
          strategicBlueprint={blueprint.strategicBlueprint}
          blueprintMeta={blueprint.blueprintMeta}
          isSharing={share.isSharing}
          shareUrl={share.shareUrl}
          shareCopied={share.shareCopied}
          shareError={share.shareError}
          blueprintCopied={share.blueprintCopied}
          onGenerateMediaPlan={handleGenerateMediaPlan}
          onBackToReview={() => setPageState("review-blueprint")}
          onShare={() => share.handleShare(blueprint.strategicBlueprint!)}
          onCopyLink={share.handleCopyLink}
          onCopyBlueprint={() => share.handleCopyBlueprint(blueprint.strategicBlueprint!)}
          onStartOver={handleStartOver}
        />
      );

    case "generating-media-plan":
      return (
        <MediaPlanGeneratingView
          headerStage={headerStage}
          elapsedTime={mediaPlanElapsed}
          progressMessage={mediaPlanGen.progress.message}
          currentPhase={mediaPlanGen.currentPhase}
          completedSections={mediaPlanGen.completedSections}
          activeSections={mediaPlanGen.activeSections}
          error={mediaPlanGen.error}
          meta={mediaPlanGen.meta}
          onRetry={handleGenerateMediaPlan}
          onBackToComplete={() => setPageState("complete")}
          onStartOver={handleStartOver}
        />
      );

    case "review-media-plan": {
      const activeMediaPlan = mediaPlanOverride ?? persist.resumedMediaPlan ?? mediaPlanGen.mediaPlan;
      if (!activeMediaPlan) return null;
      return (
        <MediaPlanReviewView
          headerStage={headerStage}
          activeMediaPlan={activeMediaPlan}
          savedMediaPlanId={persist.savedMediaPlanId || ""}
          onboardingData={onboardingData as unknown as Record<string, unknown>}
          onApprove={handleApproveMediaPlan}
          onMediaPlanChatUpdate={handleMediaPlanChatUpdate}
          onStartOver={handleStartOver}
        />
      );
    }

    case "media-plan-approved":
      if (!mediaPlanGen.mediaPlan) return null;
      return (
        <MediaPlanApprovedView
          headerStage={headerStage}
          mediaPlan={mediaPlanGen.mediaPlan}
          onBackToReview={() => setPageState("review-media-plan")}
        />
      );

    default:
      return null;
  }
}
