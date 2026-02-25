"use client";

import { useState, useCallback, useEffect } from "react";
import {
  updateOnboardingData as persistOnboardingData,
  completeOnboarding,
  getOnboardingStatus,
} from "@/lib/actions/onboarding";
import { mapDbToFormData, getOnboardingProgress } from "@/lib/onboarding/utils";
import { saveBlueprint, getBlueprintById } from "@/lib/actions/blueprints";
import { saveMediaPlanAction } from "@/lib/actions/media-plans";
import {
  setOnboardingData as saveOnboardingData,
  setStrategicBlueprint as saveStrategicBlueprint,
  setMediaPlan as saveMediaPlan,
  clearAllSavedData,
  hasSavedProgress,
  getSavedProgress,
} from "@/lib/storage/local-storage";
import { SAMPLE_ONBOARDING_DATA } from "@/lib/onboarding/types";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { MediaPlanOutput } from "@/lib/media-plan/types";

// =============================================================================
// Types
// =============================================================================

export type LoadResult =
  | { type: "blueprint-to-media-plan"; blueprint: StrategicBlueprintOutput; onboardingData: OnboardingFormData; blueprintId: string }
  | { type: "complete-onboarding"; formData: OnboardingFormData }
  | { type: "partial-onboarding"; formData: OnboardingFormData; currentStep: number }
  | { type: "fresh" }
  | { type: "error"; error: unknown };

export interface UseGeneratePersistenceReturn {
  isLoading: boolean;
  loadResult: LoadResult | null;
  wizardKey: number;
  initialData: OnboardingFormData | undefined;
  initialStep: number | undefined;
  showResumeBanner: boolean;
  resumedMediaPlan: MediaPlanOutput | null;
  blueprintId: string | null;
  savedMediaPlanId: string | null;
  hasStartedOnboarding: boolean;
  setHasStartedOnboarding: (v: boolean) => void;
  handleStepChange: (step: number, data: Partial<OnboardingFormData>) => Promise<void>;
  handleOnboardingFinish: (data: OnboardingFormData) => Promise<void>;
  handleApproveBlueprint: (
    blueprint: StrategicBlueprintOutput,
    onboardingData: OnboardingFormData | null,
    meta: { totalTime: number; totalCost: number } | null,
  ) => Promise<void>;
  handleApproveMediaPlan: (
    plan: MediaPlanOutput,
    onboardingData: OnboardingFormData | null,
    meta: { totalTime: number; totalCost: number } | null,
  ) => Promise<void>;
  handleResumeMediaPlan: () => {
    onboardingData: OnboardingFormData | null;
    strategicBlueprint: StrategicBlueprintOutput | null;
    mediaPlan: MediaPlanOutput | null;
  };
  handleStartOver: () => void;
  handleAutoFill: () => void;
  setShowResumeBanner: (v: boolean) => void;
  editProfile: (currentData: OnboardingFormData | undefined) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useGeneratePersistence(): UseGeneratePersistenceReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);

  const [wizardKey, setWizardKey] = useState(0);
  const [initialData, setInitialData] = useState<OnboardingFormData | undefined>(undefined);
  const [initialStep, setInitialStep] = useState<number | undefined>(undefined);

  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [resumedMediaPlan, setResumedMediaPlan] = useState<MediaPlanOutput | null>(null);

  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [savedMediaPlanId, setSavedMediaPlanId] = useState<string | null>(null);

  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    async function loadSavedData() {
      try {
        const params = new URLSearchParams(window.location.search);
        const bpId = params.get("blueprintId");
        const action = params.get("action");

        if (bpId && action === "media-plan") {
          const bpResult = await getBlueprintById(bpId);
          if (bpResult.data) {
            setBlueprintId(bpResult.data.id);
            setLoadResult({
              type: "blueprint-to-media-plan",
              blueprint: bpResult.data.output,
              onboardingData: bpResult.data.input_data,
              blueprintId: bpResult.data.id,
            });
          } else {
            setLoadResult({ type: "fresh" });
          }
          setIsLoading(false);
          return;
        }

        const result = await getOnboardingStatus();
        if (result.data?.onboardingData) {
          const dbData = result.data.onboardingData;
          const formData = mapDbToFormData(dbData) as OnboardingFormData;
          const progress = getOnboardingProgress(dbData);

          if (progress.completedSections === 9) {
            setInitialData(formData);
            setLoadResult({ type: "complete-onboarding", formData });
          } else if (progress.completedSections > 0) {
            setInitialData(formData);
            setInitialStep(progress.currentStep);
            setWizardKey((prev) => prev + 1);
            setLoadResult({ type: "partial-onboarding", formData, currentStep: progress.currentStep });
          } else {
            setLoadResult({ type: "fresh" });
          }
        } else {
          setLoadResult({ type: "fresh" });
        }
      } catch (err) {
        console.error("[Generate] Failed to load saved data:", err);
        setLoadResult({ type: "error", error: err });
      } finally {
        setIsLoading(false);
      }

      if (hasSavedProgress()) {
        const progress = getSavedProgress();
        if (progress.mediaPlan) {
          setShowResumeBanner(true);
        }
      }
    }

    loadSavedData();
  }, []);

  const handleStepChange = useCallback(async (_step: number, data: Partial<OnboardingFormData>) => {
    setHasStartedOnboarding(true);

    try {
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
        currentStep: Math.min(_step + 1, 8),
      };

      const filteredData = Object.fromEntries(
        Object.entries(dbData).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(filteredData).length > 0) {
        await persistOnboardingData(filteredData);
      }
    } catch (error) {
      console.error("[Generate] Failed to persist onboarding data:", error);
    }
  }, []);

  const handleOnboardingFinish = useCallback(async (data: OnboardingFormData) => {
    saveOnboardingData(data);

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
  }, []);

  const handleApproveBlueprint = useCallback(async (
    blueprint: StrategicBlueprintOutput,
    onboardingData: OnboardingFormData | null,
    meta: { totalTime: number; totalCost: number } | null,
  ) => {
    saveStrategicBlueprint(blueprint);

    try {
      await completeOnboarding();
    } catch (err) {
      console.error("[Generate] Failed to complete onboarding:", err);
    }

    if (onboardingData) {
      const title =
        blueprint.industryMarketOverview?.categorySnapshot?.category ||
        onboardingData.businessBasics?.businessName ||
        "Strategic Blueprint";

      try {
        const result = await saveBlueprint({
          title: String(title),
          inputData: onboardingData,
          output: blueprint,
          metadata: meta
            ? { totalTime: meta.totalTime, totalCost: meta.totalCost, generatedAt: new Date().toISOString() }
            : undefined,
        });

        if (result.error) {
          console.error("[Generate] Failed to save blueprint:", result.error);
        }
        if (result.data?.id) {
          setBlueprintId(result.data.id);
        }
      } catch (err) {
        console.error("[Generate] Blueprint save error:", err);
      }
    }
  }, []);

  const handleApproveMediaPlan = useCallback(async (
    plan: MediaPlanOutput,
    onboardingData: OnboardingFormData | null,
    meta: { totalTime: number; totalCost: number } | null,
  ) => {
    saveMediaPlan(plan);

    const title =
      plan.executiveSummary?.primaryObjective ||
      onboardingData?.businessBasics?.businessName ||
      "Media Plan";

    try {
      const mpResult = await saveMediaPlanAction({
        title: String(title),
        blueprintId: blueprintId ?? undefined,
        output: plan,
        metadata: meta
          ? { totalTime: meta.totalTime, totalCost: meta.totalCost, generatedAt: new Date().toISOString() }
          : undefined,
        status: "approved",
      });
      if (mpResult.data?.id) {
        setSavedMediaPlanId(mpResult.data.id);
      }
    } catch (err) {
      console.error("[Generate] Failed to save media plan:", err);
    }
  }, [blueprintId]);

  const handleResumeMediaPlan = useCallback(() => {
    const progress = getSavedProgress();
    if (progress.mediaPlan) {
      setResumedMediaPlan(progress.mediaPlan);
    }
    setShowResumeBanner(false);
    return {
      onboardingData: progress.onboardingData ?? null,
      strategicBlueprint: progress.strategicBlueprint ?? null,
      mediaPlan: progress.mediaPlan ?? null,
    };
  }, []);

  const handleStartOver = useCallback(() => {
    setInitialData(undefined);
    setInitialStep(undefined);
    setWizardKey((prev) => prev + 1);
    setHasStartedOnboarding(false);
    clearAllSavedData();
    setBlueprintId(null);
    setSavedMediaPlanId(null);
    setResumedMediaPlan(null);
    setShowResumeBanner(false);
  }, []);

  const handleAutoFill = useCallback(() => {
    setInitialData(SAMPLE_ONBOARDING_DATA);
    setWizardKey((prev) => prev + 1);
  }, []);

  const editProfile = useCallback((currentData: OnboardingFormData | undefined) => {
    setInitialData(currentData);
    setInitialStep(0);
    setWizardKey((prev) => prev + 1);
  }, []);

  return {
    isLoading,
    loadResult,
    wizardKey,
    initialData,
    initialStep,
    showResumeBanner,
    resumedMediaPlan,
    blueprintId,
    savedMediaPlanId,
    hasStartedOnboarding,
    setHasStartedOnboarding,
    handleStepChange,
    handleOnboardingFinish,
    handleApproveBlueprint,
    handleApproveMediaPlan,
    handleResumeMediaPlan,
    handleStartOver,
    handleAutoFill,
    setShowResumeBanner,
    editProfile,
  };
}
