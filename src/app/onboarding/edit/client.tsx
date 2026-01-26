"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Wand2 } from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { updateOnboardingData as persistOnboardingData } from "@/lib/actions/onboarding";
import { setOnboardingData as saveOnboardingData } from "@/lib/storage/local-storage";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { easings } from "@/lib/motion";

interface Props {
  initialData: Partial<OnboardingFormData> | null;
}

export function EditOnboardingClient({ initialData }: Props) {
  const router = useRouter();
  const [wizardKey, setWizardKey] = useState(0);

  // Persist onboarding data to Supabase on each step change
  const handleStepChange = useCallback(async (_step: number, data: Partial<OnboardingFormData>) => {
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
      };

      const filteredData = Object.fromEntries(
        Object.entries(dbData).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(filteredData).length > 0) {
        await persistOnboardingData(filteredData);
      }
    } catch (error) {
      console.error('[EditOnboarding] Failed to persist data:', error);
    }
  }, []);

  // Handle completion - save to localStorage and redirect to generate
  const handleComplete = useCallback((data: OnboardingFormData) => {
    saveOnboardingData(data);
    // Redirect to generate page to create new blueprint with updated data
    router.push("/generate");
  }, [router]);

  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: 'rgb(7, 9, 14)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <MagneticButton
              className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
              onClick={() => router.push("/dashboard")}
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
                fontFamily: "var(--font-sans), Inter, sans-serif",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </MagneticButton>

            <h1
              className="text-lg font-semibold"
              style={{
                color: "var(--text-heading)",
                fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
              }}
            >
              Edit Business Profile
            </h1>

            <div className="w-[140px]" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Background */}
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
            Update Your Business Profile
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
            Review and update your business information to generate more accurate blueprints.
          </motion.p>
        </motion.div>

        {/* Wizard */}
        <OnboardingWizard
          key={wizardKey}
          initialData={initialData as OnboardingFormData}
          onComplete={handleComplete}
          onStepChange={handleStepChange}
        />
      </div>
    </div>
  );
}
