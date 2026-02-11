import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/actions/onboarding";
import { mapDbToFormData } from "@/lib/onboarding/utils";
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

  const existingData = result.data?.onboardingData
    ? (mapDbToFormData(result.data.onboardingData) as Partial<OnboardingFormData>)
    : null;

  return <EditOnboardingClient initialData={existingData} />;
}
