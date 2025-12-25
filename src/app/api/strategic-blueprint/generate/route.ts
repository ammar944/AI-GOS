// Strategic Blueprint Generation API Endpoint
// POST /api/strategic-blueprint/generate

import { NextRequest, NextResponse } from "next/server";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { generateStrategicBlueprint } from "@/lib/strategic-blueprint/pipeline/strategic-blueprint-generator";
import {
  createErrorResponse,
  ErrorCode,
  getHttpStatusForCode,
} from "@/lib/errors";
import { createLogContext, logError, logInfo } from "@/lib/logger";

// Vercel Pro tier allows up to 300 seconds (5 minutes) for serverless functions
// Required for 5-section strategic blueprint generation with AI model calls
export const maxDuration = 300;

interface GenerateRequest {
  onboardingData: OnboardingFormData;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logContext = createLogContext("/api/strategic-blueprint/generate", "POST");

  try {
    const body = (await request.json()) as GenerateRequest;
    const { onboardingData } = body;

    // Validate required fields
    if (!onboardingData) {
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        "Missing onboardingData in request body"
      );
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate critical fields exist
    const requiredFields = [
      { path: "businessBasics.businessName", value: onboardingData.businessBasics?.businessName },
      { path: "icp.primaryIcpDescription", value: onboardingData.icp?.primaryIcpDescription },
      { path: "productOffer.productDescription", value: onboardingData.productOffer?.productDescription },
    ];

    for (const field of requiredFields) {
      if (!field.value || (typeof field.value === "string" && !field.value.trim())) {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          `Missing required field: ${field.path}`
        );
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Generate Strategic Blueprint
    const result = await generateStrategicBlueprint(onboardingData);
    const duration = Date.now() - startTime;

    if (!result.success) {
      // Determine error code based on error message patterns
      let errorCode = ErrorCode.INTERNAL_ERROR;
      const errorMessage = result.error || "Strategic Blueprint generation failed";

      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        errorCode = ErrorCode.TIMEOUT;
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        errorCode = ErrorCode.RATE_LIMITED;
      } else if (errorMessage.includes("circuit")) {
        errorCode = ErrorCode.CIRCUIT_OPEN;
      } else if (errorMessage.includes("validation") || errorMessage.includes("schema")) {
        errorCode = ErrorCode.VALIDATION_FAILED;
      } else if (errorMessage.includes("parse") || errorMessage.includes("JSON")) {
        errorCode = ErrorCode.PARSE_ERROR;
      } else if (errorMessage.includes("API") || errorMessage.includes("status")) {
        errorCode = ErrorCode.API_ERROR;
      }

      const httpStatus = getHttpStatusForCode(errorCode);

      logError(
        {
          ...logContext,
          duration,
          errorCode,
          metadata: result.metadata,
        },
        errorMessage
      );

      const errorResponse = createErrorResponse(
        errorCode,
        errorMessage
      );

      return NextResponse.json(errorResponse, { status: httpStatus });
    }

    logInfo(
      {
        ...logContext,
        duration,
        metadata: {
          totalTime: result.metadata.totalTime,
          totalCost: result.metadata.totalCost,
        },
      },
      "Strategic Blueprint generation completed successfully"
    );

    return NextResponse.json({
      success: true,
      strategicBlueprint: result.strategicBlueprint,
      metadata: {
        totalTime: result.metadata.totalTime,
        totalCost: result.metadata.totalCost,
      },
    });
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
