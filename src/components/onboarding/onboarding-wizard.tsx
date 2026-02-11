"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Package,
  TrendingUp,
  Route,
  Sparkles,
  FileCheck,
  Target,
  Shield,
  Check,
} from "lucide-react";
import { GradientBorder } from "@/components/ui/gradient-border";
import { fadeUp, easings } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { StepBusinessBasics } from "./step-business-basics";
import { StepICP } from "./step-icp";
import { StepProductOffer } from "./step-product-offer";
import { StepMarketCompetition } from "./step-market-competition";
import { StepCustomerJourney } from "./step-customer-journey";
import { StepBrandPositioning } from "./step-brand-positioning";
import { StepAssetsProof } from "./step-assets-proof";
import { StepBudgetTargets } from "./step-budget-targets";
import { StepCompliance } from "./step-compliance";

import type {
  OnboardingFormData,
  OnboardingStep,
  BusinessBasicsData,
  ICPData,
  ProductOfferData,
  MarketCompetitionData,
  CustomerJourneyData,
  BrandPositioningData,
  AssetsProofData,
  BudgetTargetsData,
  ComplianceData,
} from "@/lib/onboarding/types";
import { DEFAULT_ONBOARDING_DATA } from "@/lib/onboarding/types";

// Step configuration with icons
const STEPS: {
  id: OnboardingStep;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "business_basics",
    title: "Business Basics",
    shortTitle: "Business",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: "icp",
    title: "Ideal Customer",
    shortTitle: "ICP",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "product_offer",
    title: "Product & Offer",
    shortTitle: "Product",
    icon: <Package className="h-4 w-4" />,
  },
  {
    id: "market_competition",
    title: "Market & Competition",
    shortTitle: "Market",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: "customer_journey",
    title: "Customer Journey",
    shortTitle: "Journey",
    icon: <Route className="h-4 w-4" />,
  },
  {
    id: "brand_positioning",
    title: "Brand & Positioning",
    shortTitle: "Brand",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: "assets_proof",
    title: "Assets & Proof",
    shortTitle: "Assets",
    icon: <FileCheck className="h-4 w-4" />,
  },
  {
    id: "budget_targets",
    title: "Budget & Targets",
    shortTitle: "Budget",
    icon: <Target className="h-4 w-4" />,
  },
  {
    id: "compliance",
    title: "Compliance",
    shortTitle: "Compliance",
    icon: <Shield className="h-4 w-4" />,
  },
];

interface OnboardingWizardProps {
  initialData?: Partial<OnboardingFormData>;
  initialStep?: number;
  onComplete: (data: OnboardingFormData) => void;
  onStepChange?: (step: number, data: Partial<OnboardingFormData>) => void;
}

export function OnboardingWizard({
  initialData,
  initialStep,
  onComplete,
  onStepChange,
}: OnboardingWizardProps) {
  const startStep = initialStep ?? 0;
  const [currentStep, setCurrentStep] = useState(startStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    // Pre-mark steps 0 through initialStep - 1 as completed
    const set = new Set<number>();
    for (let i = 0; i < startStep; i++) set.add(i);
    return set;
  });
  // Track the highest step reached to allow forward navigation to visited steps
  const [highestStepReached, setHighestStepReached] = useState(startStep);
  const [formData, setFormData] = useState<OnboardingFormData>({
    ...DEFAULT_ONBOARDING_DATA,
    ...initialData,
  });

  // Track if form data was updated by user action (not initialization)
  const isUserAction = useRef(false);
  const pendingStepChange = useRef<{ step: number; data: OnboardingFormData } | null>(null);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Call onStepChange after state updates (outside of render)
  useEffect(() => {
    if (pendingStepChange.current && isUserAction.current) {
      const { step, data } = pendingStepChange.current;
      onStepChange?.(step, data);
      pendingStepChange.current = null;
    }
  }, [formData, onStepChange]);

  const goToNextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      // Mark the current step as completed before advancing
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Update highest step reached if we're going further than before
      setHighestStepReached((prev) => Math.max(prev, nextStep));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  // Navigate to a specific step (any step up to highestStepReached)
  const goToStep = useCallback((stepIndex: number) => {
    // Allow navigation to any step up to the highest step reached
    // This enables going back AND forward to previously visited steps
    if (stepIndex <= highestStepReached) {
      setCurrentStep(stepIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [highestStepReached]);

  const updateFormData = useCallback(
    <K extends keyof OnboardingFormData>(
      section: K,
      data: OnboardingFormData[K]
    ) => {
      isUserAction.current = true;
      setFormData((prev) => {
        const updated = { ...prev, [section]: data };
        // Queue the step change to be called in useEffect (after render)
        pendingStepChange.current = { step: currentStep, data: updated };
        return updated;
      });
    },
    [currentStep]
  );

  /**
   * Bulk update form data from AI prefill
   * Deep merges prefilled data into existing formData (only non-empty values)
   */
  const bulkUpdateFormData = useCallback(
    (prefilled: Partial<OnboardingFormData>) => {
      isUserAction.current = true;
      setFormData((prev) => {
        const updated = { ...prev };

        // Deep merge each section, only updating non-empty values
        (Object.keys(prefilled) as Array<keyof OnboardingFormData>).forEach((section) => {
          const prefilledSection = prefilled[section];
          if (!prefilledSection) return;

          const currentSection = updated[section] as Record<string, unknown>;
          const mergedSection = { ...currentSection };

          Object.entries(prefilledSection).forEach(([key, value]) => {
            // Only update if value is non-empty
            if (value !== undefined && value !== null && value !== "") {
              // For arrays, only update if array has items
              if (Array.isArray(value) && value.length === 0) return;
              // For numbers, 0 is valid
              if (typeof value === "number" || value) {
                mergedSection[key] = value;
              }
            }
          });

          (updated[section] as Record<string, unknown>) = mergedSection;
        });

        pendingStepChange.current = { step: currentStep, data: updated };
        return updated;
      });
    },
    [currentStep]
  );

  // Step handlers
  const handleBusinessBasics = (data: BusinessBasicsData) => {
    updateFormData("businessBasics", data);
    goToNextStep();
  };

  const handleICP = (data: ICPData) => {
    updateFormData("icp", data);
    goToNextStep();
  };

  const handleProductOffer = (data: ProductOfferData) => {
    updateFormData("productOffer", data);
    goToNextStep();
  };

  const handleMarketCompetition = (data: MarketCompetitionData) => {
    updateFormData("marketCompetition", data);
    goToNextStep();
  };

  const handleCustomerJourney = (data: CustomerJourneyData) => {
    updateFormData("customerJourney", data);
    goToNextStep();
  };

  const handleBrandPositioning = (data: BrandPositioningData) => {
    updateFormData("brandPositioning", data);
    goToNextStep();
  };

  const handleAssetsProof = (data: AssetsProofData) => {
    updateFormData("assetsProof", data);
    goToNextStep();
  };

  const handleBudgetTargets = (data: BudgetTargetsData) => {
    updateFormData("budgetTargets", data);
    goToNextStep();
  };

  const handleCompliance = (data: ComplianceData) => {
    const finalData = { ...formData, compliance: data };
    setFormData(finalData);
    onComplete(finalData);
  };

  // Render current step content
  function renderStepContent() {
    switch (STEPS[currentStep].id) {
      case "business_basics":
        return (
          <StepBusinessBasics
            initialData={formData.businessBasics}
            onSubmit={handleBusinessBasics}
            onPrefillAll={bulkUpdateFormData}
          />
        );
      case "icp":
        return (
          <StepICP
            initialData={formData.icp}
            onSubmit={handleICP}
            onBack={goToPreviousStep}
            wizardFormData={formData}
          />
        );
      case "product_offer":
        return (
          <StepProductOffer
            initialData={formData.productOffer}
            onSubmit={handleProductOffer}
            onBack={goToPreviousStep}
            wizardFormData={formData}
          />
        );
      case "market_competition":
        return (
          <StepMarketCompetition
            initialData={formData.marketCompetition}
            onSubmit={handleMarketCompetition}
            onBack={goToPreviousStep}
            wizardFormData={formData}
          />
        );
      case "customer_journey":
        return (
          <StepCustomerJourney
            initialData={formData.customerJourney}
            onSubmit={handleCustomerJourney}
            onBack={goToPreviousStep}
            wizardFormData={formData}
          />
        );
      case "brand_positioning":
        return (
          <StepBrandPositioning
            initialData={formData.brandPositioning}
            onSubmit={handleBrandPositioning}
            onBack={goToPreviousStep}
            wizardFormData={formData}
          />
        );
      case "assets_proof":
        return (
          <StepAssetsProof
            initialData={formData.assetsProof}
            onSubmit={handleAssetsProof}
            onBack={goToPreviousStep}
          />
        );
      case "budget_targets":
        return (
          <StepBudgetTargets
            initialData={formData.budgetTargets}
            onSubmit={handleBudgetTargets}
            onBack={goToPreviousStep}
          />
        );
      case "compliance":
        return (
          <StepCompliance
            initialData={formData.compliance}
            onSubmit={handleCompliance}
            onBack={goToPreviousStep}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Progress Header */}
      <div className="space-y-4">
        {/* Step Counter & Progress Bar - SaaSLaunch Style */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium" style={{ color: "rgb(252, 252, 250)" }}>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span style={{ color: "rgb(100, 105, 115)" }}>
              {Math.round(progress)}% complete
            </span>
          </div>
          {/* Animated Progress Bar - SaaSLaunch primary blue */}
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgb(20, 23, 30)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: easings.out }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="hidden md:block">
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const isCurrent = index === currentStep;
              // A step is clickable if it's within the highest step reached
              const isClickable = index <= highestStepReached;
              const isFuture = !isClickable;
              // Completed = user pressed Continue on this step
              const isCompleted = completedSteps.has(index);
              // Current and making progress (first time at this step) = WHITE glow
              const isCurrentNew = isCurrent && currentStep === highestStepReached;
              // Current but revisiting (went back) = BLUE hue
              const isCurrentRevisiting = isCurrent && currentStep < highestStepReached;
              // Completed and not current = show checkmark
              const showCheckmark = isCompleted && !isCurrent;
              // Visited but ahead of current position (not current)
              const isVisitedAhead = !isCurrent && index > currentStep && index <= highestStepReached;
              // Completed and behind current (not current)
              const isCompletedBehind = isCompleted && !isCurrent && index < currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center gap-2",
                    index !== 0 && "flex-1"
                  )}
                >
                  {/* Connector Line - SaaSLaunch blue for completed */}
                  {index !== 0 && (
                    <div className="absolute left-0 right-0 top-4 -z-10 hidden md:block">
                      <div
                        className="h-0.5 w-full transition-colors duration-300"
                        style={{
                          background: isCompletedBehind || isVisitedAhead || isCompleted
                            ? "rgb(54, 94, 255)"
                            : "rgb(31, 31, 31)",
                        }}
                      />
                    </div>
                  )}

                  {/* Step Circle - SaaSLaunch styling */}
                  <motion.button
                    type="button"
                    onClick={() => isClickable && goToStep(index)}
                    disabled={!isClickable}
                    aria-label={
                      isCurrentNew
                        ? `Current step: ${step.title}`
                        : isCurrentRevisiting
                          ? `Reviewing: ${step.title}`
                        : showCheckmark
                          ? `Go to ${step.title} (completed)`
                          : isVisitedAhead
                            ? `Go to ${step.title} (visited)`
                            : `${step.title} (not yet available)`
                    }
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full border-2",
                      "transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(54,94,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(7,9,14)]",
                      isClickable && "cursor-pointer hover:scale-110",
                      isFuture && "cursor-not-allowed"
                    )}
                    style={{
                      // Priority: isCurrentNew (white) > isCurrentRevisiting (blue) > showCheckmark > isVisitedAhead > future
                      borderColor: isCurrentNew
                        ? "rgb(205, 208, 213)"
                        : isCurrentRevisiting
                          ? "rgb(54, 94, 255)"
                        : showCheckmark
                          ? "rgb(54, 94, 255)"
                          : isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "rgb(31, 31, 31)",
                      background: isCurrentNew
                        ? "rgb(205, 208, 213)"
                        : isCurrentRevisiting
                          ? "rgba(54, 94, 255, 0.15)"
                        : showCheckmark
                          ? "rgb(54, 94, 255)"
                          : isVisitedAhead
                            ? "rgba(54, 94, 255, 0.15)"
                            : "rgb(20, 23, 30)",
                      color: isCurrentNew
                        ? "rgb(20, 23, 30)"
                        : isCurrentRevisiting
                          ? "rgb(54, 94, 255)"
                        : showCheckmark
                          ? "#ffffff"
                          : isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "rgb(100, 105, 115)",
                      boxShadow: isCurrentNew
                        ? "0 0 0 3px rgba(205, 208, 213, 0.2)"
                        : (isCurrentRevisiting || isVisitedAhead)
                          ? "0 0 8px rgba(54, 94, 255, 0.4)"
                          : undefined,
                    }}
                    animate={
                      isCurrent
                        ? { scale: [1, 1.05, 1] }
                        : { scale: 1 }
                    }
                    transition={
                      isCurrent
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.3 }
                    }
                    whileHover={isClickable ? { scale: 1.1 } : undefined}
                    whileTap={isClickable ? { scale: 0.95 } : undefined}
                  >
                    {/* Show checkmark only for completed steps that are NOT current */}
                    {showCheckmark ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.icon
                    )}
                  </motion.button>

                  {/* Step Label - SaaSLaunch styling */}
                  <span
                    onClick={() => isClickable && goToStep(index)}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Go to ${step.title}` : undefined}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        goToStep(index);
                      }
                    }}
                    className={cn(
                      "text-xs transition-all duration-200",
                      isCurrent ? "font-bold" : "font-medium",
                      isClickable && "cursor-pointer hover:text-[rgb(252,252,250)]",
                      isFuture && "cursor-not-allowed",
                      "focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-2"
                    )}
                    style={{
                      // Priority: isCurrentNew (white) > isCurrentRevisiting (blue) > showCheckmark > isVisitedAhead > future
                      color: isCurrentNew
                        ? "rgb(252, 252, 250)"
                        : isCurrentRevisiting
                          ? "rgb(54, 94, 255)"
                        : showCheckmark
                          ? "rgb(205, 208, 213)"
                          : isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "rgb(100, 105, 115)",
                      textShadow: isCurrentNew
                        ? "0 0 8px rgba(205, 208, 213, 0.5)"
                        : undefined,
                    }}
                  >
                    {step.shortTitle}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Step Indicator with Navigation - SaaSLaunch Style */}
        <div className="space-y-3 md:hidden">
          {/* Current Step Info */}
          {(() => {
            const isRevisiting = currentStep < highestStepReached;
            return (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    background: isRevisiting ? "rgba(54, 94, 255, 0.15)" : "rgb(205, 208, 213)",
                    borderColor: isRevisiting ? "rgb(54, 94, 255)" : "rgb(205, 208, 213)",
                    color: isRevisiting ? "rgb(54, 94, 255)" : "rgb(20, 23, 30)",
                    boxShadow: isRevisiting
                      ? "0 0 8px rgba(54, 94, 255, 0.4)"
                      : "0 0 0 3px rgba(205, 208, 213, 0.2)",
                  }}
                >
                  {STEPS[currentStep].icon}
                </div>
                <div>
                  <p
                    className="text-[16px] font-bold"
                    style={{ color: isRevisiting ? "rgb(54, 94, 255)" : "rgb(252, 252, 250)" }}
                  >
                    {STEPS[currentStep].title}
                  </p>
                  <p className="text-[14px]" style={{ color: "rgb(100, 105, 115)" }}>
                    {isRevisiting ? "Reviewing • " : ""}Step {currentStep + 1} of {STEPS.length}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Horizontal Scrollable Step Pills */}
          <div className="relative -mx-4 px-4">
            <div
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {STEPS.map((step, index) => {
                const isCurrent = index === currentStep;
                // A step is clickable if it's within the highest step reached
                const isClickable = index <= highestStepReached;
                const isFuture = !isClickable;
                // Completed = user pressed Continue on this step
                const isCompleted = completedSteps.has(index);
                // Current and making progress (first time at this step) = WHITE glow
                const isCurrentNew = isCurrent && currentStep === highestStepReached;
                // Current but revisiting (went back) = BLUE hue
                const isCurrentRevisiting = isCurrent && currentStep < highestStepReached;
                // Completed and not current = show checkmark
                const showCheckmark = isCompleted && !isCurrent;
                // Visited but ahead of current position (not current)
                const isVisitedAhead = !isCurrent && index > currentStep && index <= highestStepReached;

                return (
                  <motion.button
                    key={step.id}
                    type="button"
                    onClick={() => isClickable && goToStep(index)}
                    disabled={!isClickable}
                    aria-label={
                      isCurrentNew
                        ? `Current step: ${step.title}`
                        : isCurrentRevisiting
                          ? `Reviewing: ${step.title}`
                        : showCheckmark
                          ? `Go to ${step.title} (completed)`
                          : isVisitedAhead
                            ? `Go to ${step.title} (visited)`
                            : `${step.title} (not yet available)`
                    }
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs whitespace-nowrap min-h-[36px]",
                      "border-2 transition-all duration-200 flex-shrink-0",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                      isClickable && "cursor-pointer active:scale-95",
                      isFuture && "cursor-not-allowed opacity-50",
                      isCurrent ? "font-bold" : "font-medium"
                    )}
                    style={{
                      // Priority: isCurrentNew (white) > isCurrentRevisiting (blue) > showCheckmark > isVisitedAhead > future
                      borderColor: isCurrentNew
                        ? "rgb(205, 208, 213)"
                        : isCurrentRevisiting
                          ? "rgb(54, 94, 255)"
                        : showCheckmark
                          ? "rgb(54, 94, 255)"
                          : isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "var(--border-default)",
                      background: isCurrentNew
                        ? "rgb(205, 208, 213)"
                        : isCurrentRevisiting
                          ? "rgba(54, 94, 255, 0.15)"
                        : showCheckmark
                          ? "rgba(54, 94, 255, 0.15)"
                          : isVisitedAhead
                            ? "rgba(54, 94, 255, 0.15)"
                            : "var(--bg-hover)",
                      color: isCurrentNew
                        ? "rgb(20, 23, 30)"
                        : isCurrentRevisiting
                          ? "rgb(54, 94, 255)"
                        : showCheckmark
                          ? "rgb(54, 94, 255)"
                          : isVisitedAhead
                            ? "rgb(54, 94, 255)"
                            : "var(--text-tertiary)",
                      boxShadow: isCurrentNew
                        ? "0 0 0 3px rgba(205, 208, 213, 0.2)"
                        : (isCurrentRevisiting || isVisitedAhead)
                          ? "0 0 8px rgba(54, 94, 255, 0.4)"
                          : undefined,
                    }}
                    whileTap={isClickable ? { scale: 0.95 } : undefined}
                    animate={
                      isCurrent
                        ? { scale: [1, 1.02, 1] }
                        : { scale: 1 }
                    }
                    transition={
                      isCurrent
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.3 }
                    }
                  >
                    {/* Show checkmark only for completed steps that are NOT current */}
                    {showCheckmark ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 flex items-center justify-center">
                        {index + 1}
                      </span>
                    )}
                    <span>{step.shortTitle}</span>
                  </motion.button>
                );
              })}
            </div>
            {/* Fade gradient on right edge to indicate scrollability */}
            <div
              className="absolute right-4 top-0 bottom-2 w-8 pointer-events-none"
              style={{
                background: "linear-gradient(to right, transparent, var(--bg-elevated))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Form Card */}
      <GradientBorder className="overflow-hidden">
        <motion.div
          key={currentStep}
          className="p-6 md:p-8"
          style={{ background: "var(--bg-elevated)" }}
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.6, ease: easings.out }}
        >
          {renderStepContent()}
        </motion.div>
      </GradientBorder>
    </div>
  );
}
