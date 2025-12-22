// API Route: POST /api/media-plan/generate
// Generates a media plan from form inputs

import { NextResponse } from "next/server";
import { runMediaPlanPipeline } from "@/lib/media-plan/pipeline";
import type {
  GenerateMediaPlanRequest,
  GenerateMediaPlanResponse,
  NicheFormData,
  BriefingFormData,
  SalesCycleLength,
} from "@/lib/media-plan/types";

// Timeout for the entire pipeline (60 seconds as per MVP requirements)
const PIPELINE_TIMEOUT = 60000;

// Valid sales cycle values
const VALID_SALES_CYCLES: SalesCycleLength[] = [
  "less_than_7_days",
  "7_to_14_days",
  "14_to_30_days",
  "more_than_30_days",
];

function validateNicheForm(data: unknown): data is NicheFormData {
  if (!data || typeof data !== "object") return false;
  const niche = data as Record<string, unknown>;
  return (
    typeof niche.industry === "string" &&
    niche.industry.trim().length > 0 &&
    typeof niche.audience === "string" &&
    niche.audience.trim().length > 0 &&
    typeof niche.icp === "string" &&
    niche.icp.trim().length > 0
  );
}

function validateBriefingForm(data: unknown): data is BriefingFormData {
  if (!data || typeof data !== "object") return false;
  const briefing = data as Record<string, unknown>;
  return (
    typeof briefing.budget === "number" &&
    briefing.budget > 0 &&
    typeof briefing.offerPrice === "number" &&
    briefing.offerPrice > 0 &&
    typeof briefing.salesCycleLength === "string" &&
    VALID_SALES_CYCLES.includes(briefing.salesCycleLength as SalesCycleLength)
  );
}

export async function POST(request: Request): Promise<NextResponse<GenerateMediaPlanResponse>> {
  try {
    // Parse request body
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { niche, briefing } = body as GenerateMediaPlanRequest;

    // Validate niche form
    if (!validateNicheForm(niche)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid niche form data. Required: industry, audience, icp (all non-empty strings)",
        },
        { status: 400 }
      );
    }

    // Validate briefing form
    if (!validateBriefingForm(briefing)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid briefing form data. Required: budget (number > 0), offerPrice (number > 0), salesCycleLength (valid option)",
        },
        { status: 400 }
      );
    }

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, PIPELINE_TIMEOUT);

    try {
      // Run the pipeline
      const result = await runMediaPlanPipeline(niche, briefing, {
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "Pipeline failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        blueprint: result.blueprint,
      });
    } catch (pipelineError) {
      clearTimeout(timeoutId);

      if (abortController.signal.aborted) {
        return NextResponse.json(
          { success: false, error: "Request timed out. Please try again." },
          { status: 504 }
        );
      }

      throw pipelineError;
    }
  } catch (error) {
    console.error("Media plan generation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Optionally handle other methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      message: "Media Plan Generator API",
      usage: "POST /api/media-plan/generate with { niche, briefing } body",
    },
    { status: 200 }
  );
}
