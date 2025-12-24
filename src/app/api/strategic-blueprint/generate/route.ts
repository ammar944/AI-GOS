// Strategic Blueprint Generation API Endpoint
// POST /api/strategic-blueprint/generate

import { NextRequest, NextResponse } from "next/server";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { generateStrategicBlueprint } from "@/lib/strategic-blueprint/pipeline/strategic-blueprint-generator";

// Increase timeout for long-running generation
export const maxDuration = 300; // 5 minutes

interface GenerateRequest {
  onboardingData: OnboardingFormData;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const { onboardingData } = body;

    // Validate required fields
    if (!onboardingData) {
      return NextResponse.json(
        { success: false, error: "Missing onboardingData in request body" },
        { status: 400 }
      );
    }

    // Validate critical fields exist
    const requiredFields = [
      { path: "businessBasics.businessName", value: onboardingData.businessBasics?.businessName },
      { path: "icp.primaryIcpDescription", value: onboardingData.icp?.primaryIcpDescription },
      { path: "productOffer.productDescription", value: onboardingData.productOffer?.productDescription },
    ];

    for (const field of requiredFields) {
      if (!field.value || (typeof field.value === "string" && !field.value.trim())) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field.path}` },
          { status: 400 }
        );
      }
    }

    // Generate Strategic Blueprint
    const result = await generateStrategicBlueprint(onboardingData);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Strategic Blueprint generation failed",
          metadata: result.metadata,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      strategicBlueprint: result.strategicBlueprint,
      metadata: {
        totalTime: result.metadata.totalTime,
        totalCost: result.metadata.totalCost,
      },
    });
  } catch (error) {
    console.error("Strategic Blueprint API Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
