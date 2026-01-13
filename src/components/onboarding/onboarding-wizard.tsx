"use client";

import { useState, useCallback } from "react";
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
  onComplete: (data: OnboardingFormData) => void;
  onStepChange?: (step: number, data: Partial<OnboardingFormData>) => void;
}

export function OnboardingWizard({
  initialData,
  onComplete,
  onStepChange,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    ...DEFAULT_ONBOARDING_DATA,
    ...initialData,
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const goToNextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const updateFormData = useCallback(
    <K extends keyof OnboardingFormData>(
      section: K,
      data: OnboardingFormData[K]
    ) => {
      setFormData((prev) => {
        const updated = { ...prev, [section]: data };
        onStepChange?.(currentStep, updated);
        return updated;
      });
    },
    [currentStep, onStepChange]
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
          />
        );
      case "icp":
        return (
          <StepICP
            initialData={formData.icp}
            onSubmit={handleICP}
            onBack={goToPreviousStep}
          />
        );
      case "product_offer":
        return (
          <StepProductOffer
            initialData={formData.productOffer}
            onSubmit={handleProductOffer}
            onBack={goToPreviousStep}
          />
        );
      case "market_competition":
        return (
          <StepMarketCompetition
            initialData={formData.marketCompetition}
            onSubmit={handleMarketCompetition}
            onBack={goToPreviousStep}
          />
        );
      case "customer_journey":
        return (
          <StepCustomerJourney
            initialData={formData.customerJourney}
            onSubmit={handleCustomerJourney}
            onBack={goToPreviousStep}
          />
        );
      case "brand_positioning":
        return (
          <StepBrandPositioning
            initialData={formData.brandPositioning}
            onSubmit={handleBrandPositioning}
            onBack={goToPreviousStep}
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
        {/* Step Counter & Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {Math.round(progress)}% complete
            </span>
          </div>
          {/* Animated Progress Bar - monochrome with green for completion */}
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-hover)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--success)" }}
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
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center gap-2",
                    index !== 0 && "flex-1"
                  )}
                >
                  {/* Connector Line - green for completed */}
                  {index !== 0 && (
                    <div className="absolute left-0 right-0 top-4 -z-10 hidden md:block">
                      <div
                        className="h-0.5 w-full transition-colors duration-300"
                        style={{
                          background: isCompleted
                            ? "var(--success)"
                            : "var(--border-default)",
                        }}
                      />
                    </div>
                  )}

                  {/* Step Circle - monochrome styling, green for complete, white for current */}
                  <motion.div
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
                    )}
                    style={{
                      borderColor: isCompleted
                        ? "var(--success)"
                        : isCurrent
                          ? "rgba(255,255,255,0.3)"
                          : "var(--border-default)",
                      background: isCompleted
                        ? "var(--success)"
                        : isCurrent
                          ? "rgba(255,255,255,0.1)"
                          : "var(--bg-hover)",
                      color: isCompleted
                        ? "#ffffff"
                        : isCurrent
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                    }}
                    animate={
                      isCurrent
                        ? { opacity: [1, 0.7, 1] }
                        : { opacity: 1 }
                    }
                    transition={
                      isCurrent
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.3 }
                    }
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.icon
                    )}
                  </motion.div>

                  {/* Step Label */}
                  <span
                    className={cn(
                      "text-xs transition-colors duration-300",
                      isCurrent ? "font-semibold" : "font-medium"
                    )}
                    style={{
                      color: isCurrent
                        ? "var(--text-primary)"
                        : isCompleted
                          ? "var(--text-secondary)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {step.shortTitle}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Step Indicator - monochrome */}
        <div className="flex items-center gap-3 md:hidden">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "var(--text-primary)",
            }}
          >
            {STEPS[currentStep].icon}
          </div>
          <div>
            <p
              className="text-[16px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {STEPS[currentStep].title}
            </p>
            <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>
              Step {currentStep + 1} of {STEPS.length}
            </p>
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
