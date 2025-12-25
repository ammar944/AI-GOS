// API Route for Full Media Plan Generation
import { NextResponse } from "next/server";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import { generateMediaPlan } from "@/lib/media-plan/pipeline/media-plan-generator";
import {
  createErrorResponse,
  ErrorCode,
  mapFailureReasonToCode,
  getHttpStatusForCode,
} from "@/lib/errors";
import { createLogContext, logError, logInfo } from "@/lib/logger";

// Vercel Pro tier allows up to 300 seconds (5 minutes) for serverless functions
// Required for 11-section media plan generation with per-section 45s timeout + retries
export const maxDuration = 300;

export async function POST(request: Request) {
  const startTime = Date.now();
  const logContext = createLogContext("/api/media-plan/full-plan", "POST");

  try {
    const body = await request.json();
    const onboardingData = body.onboardingData as OnboardingFormData;
    const strategicBlueprint = body.strategicBlueprint as StrategicBlueprintOutput | undefined;

    // Validate required fields
    if (!onboardingData) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "Onboarding data is required"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate business basics
    if (!onboardingData.businessBasics?.businessName?.trim()) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "Business name is required"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate ICP
    if (!onboardingData.icp?.primaryIcpDescription?.trim()) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "ICP description is required"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate product/offer
    if (!onboardingData.productOffer?.productDescription?.trim()) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "Product description is required"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate budget
    if (!onboardingData.budgetTargets?.monthlyAdBudget || onboardingData.budgetTargets.monthlyAdBudget <= 0) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "Valid monthly ad budget is required"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Generate the full media plan (with optional strategic blueprint context)
    const result = await generateMediaPlan(onboardingData, { strategicBlueprint });
    const duration = Date.now() - startTime;

    if (result.success && result.mediaPlan) {
      logInfo(
        { ...logContext, duration, metadata: { sectionsCompleted: result.metadata.completedSections.length } },
        "Media plan generation completed successfully"
      );

      return NextResponse.json({
        success: true,
        mediaPlan: result.mediaPlan,
        metadata: result.metadata,
      });
    } else {
      // Map the failure reason to an error code
      const errorCode = mapFailureReasonToCode(result.metadata.failureReason);
      const httpStatus = getHttpStatusForCode(errorCode);

      logError(
        {
          ...logContext,
          duration,
          errorCode,
          section: result.failedSection,
          metadata: {
            completedSections: result.metadata.completedSections,
            failureReason: result.metadata.failureReason,
          },
        },
        result.error || "Failed to generate media plan"
      );

      const errorResponse = createErrorResponse(
        errorCode,
        result.error || "Failed to generate media plan",
        {
          section: result.failedSection,
          completedSections: result.metadata.completedSections,
        }
      );

      return NextResponse.json(errorResponse, { status: httpStatus });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    logError(
      { ...logContext, duration, errorCode: ErrorCode.INTERNAL_ERROR },
      error instanceof Error ? error : errorMessage
    );

    const errorResponse = createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      errorMessage
    );

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
