// API Route for Full Media Plan Generation
import { NextResponse } from "next/server";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import { generateMediaPlan } from "@/lib/media-plan/pipeline/media-plan-generator";

// Vercel Pro tier allows up to 300 seconds (5 minutes) for serverless functions
// Required for 11-section media plan generation with per-section 45s timeout + retries
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const onboardingData = body.onboardingData as OnboardingFormData;
    const strategicBlueprint = body.strategicBlueprint as StrategicBlueprintOutput | undefined;

    // Validate required fields
    if (!onboardingData) {
      return NextResponse.json(
        { success: false, error: "Onboarding data is required" },
        { status: 400 }
      );
    }

    // Validate business basics
    if (!onboardingData.businessBasics?.businessName?.trim()) {
      return NextResponse.json(
        { success: false, error: "Business name is required" },
        { status: 400 }
      );
    }

    // Validate ICP
    if (!onboardingData.icp?.primaryIcpDescription?.trim()) {
      return NextResponse.json(
        { success: false, error: "ICP description is required" },
        { status: 400 }
      );
    }

    // Validate product/offer
    if (!onboardingData.productOffer?.productDescription?.trim()) {
      return NextResponse.json(
        { success: false, error: "Product description is required" },
        { status: 400 }
      );
    }

    // Validate budget
    if (!onboardingData.budgetTargets?.monthlyAdBudget || onboardingData.budgetTargets.monthlyAdBudget <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid monthly ad budget is required" },
        { status: 400 }
      );
    }

    // Generate the full media plan (with optional strategic blueprint context)
    const result = await generateMediaPlan(onboardingData, { strategicBlueprint });

    if (result.success && result.mediaPlan) {
      return NextResponse.json({
        success: true,
        mediaPlan: result.mediaPlan,
        metadata: result.metadata,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to generate media plan" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Media plan generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
