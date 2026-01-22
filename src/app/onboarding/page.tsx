import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding entry point - redirects based on user's onboarding status
 * - Not authenticated → /sign-in
 * - Onboarding complete → /dashboard
 * - Onboarding incomplete → /generate
 */
export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check onboarding status from database
  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (profile?.onboarding_completed) {
      // Already completed - go to dashboard
      redirect("/dashboard");
    }
  } catch (error) {
    // If profile doesn't exist or error, proceed to generate
    console.error("[Onboarding] Error checking status:", error);
  }

  // Not completed - go to generate flow
  redirect("/generate");
}
