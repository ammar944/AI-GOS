import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/actions/onboarding";
import { EditOnboardingClient } from "./client";
import type { OnboardingFormData } from "@/lib/onboarding/types";

/**
 * Edit Onboarding Page - Allows users to update their onboarding data
 */
export default async function EditOnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch existing onboarding data from database
  const result = await getOnboardingStatus();

  if (result.error) {
    console.error("[EditOnboarding] Error fetching data:", result.error);
    // Redirect to generate if there's an issue
    redirect("/generate");
  }

  // Map the database format back to form format (cast via unknown for JSON data)
  const existingData = result.data?.onboardingData
    ? ({
        businessBasics: result.data.onboardingData.businessBasics,
        icp: result.data.onboardingData.icpData,
        productOffer: result.data.onboardingData.productOffer,
        marketCompetition: result.data.onboardingData.marketCompetition,
        customerJourney: result.data.onboardingData.customerJourney,
        brandPositioning: result.data.onboardingData.brandPositioning,
        assetsProof: result.data.onboardingData.assetsProof,
        budgetTargets: result.data.onboardingData.budgetTargets,
        compliance: result.data.onboardingData.compliance,
      } as unknown as Partial<OnboardingFormData>)
    : null;

  return <EditOnboardingClient initialData={existingData} />;
}
