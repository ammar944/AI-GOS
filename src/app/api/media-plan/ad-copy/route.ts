// Ad Copy Generation API Endpoint
// POST /api/media-plan/ad-copy
// SSE streaming — single-phase generateObject

import { NextRequest, NextResponse } from "next/server";
import type { MediaPlanOutput } from "@/lib/media-plan/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import { buildAdCopyContext } from "@/lib/media-plan/ad-copy-context-builder";
import { generateAdCopy } from "@/lib/media-plan/ad-copy-generator";
import type { AdCopySSEEvent } from "@/lib/media-plan/ad-copy-types";
import { createErrorResponse, ErrorCode } from "@/lib/errors";

export const maxDuration = 120;

// =============================================================================
// SSE Helper
// =============================================================================

function createSSEMessage(event: AdCopySSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// =============================================================================
// Types
// =============================================================================

interface GenerateRequest {
  mediaPlan: MediaPlanOutput;
  blueprint: StrategicBlueprintOutput;
  onboardingData: OnboardingFormData;
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as GenerateRequest;
    const { mediaPlan, blueprint, onboardingData } = body;

    // Validate inputs
    if (!mediaPlan) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, "Missing media plan data"),
        { status: 400 }
      );
    }

    if (!blueprint) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, "Missing blueprint data"),
        { status: 400 }
      );
    }

    if (!onboardingData) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.INVALID_INPUT,
          "Missing onboarding data"
        ),
        { status: 400 }
      );
    }

    // Build focused context
    const { contextString, tokenEstimate } = buildAdCopyContext(
      mediaPlan,
      blueprint,
      onboardingData
    );
    console.log(
      `[AdCopy] Context built: ${contextString.length} chars, ~${tokenEstimate} tokens`
    );

    // SSE streaming response
    const encoder = new TextEncoder();
    let streamClosed = false;

    // Declared here so emit can reference it
    let controller: ReadableStreamDefaultController;

    const emit = (event: AdCopySSEEvent) => {
      if (streamClosed) return;
      controller.enqueue(encoder.encode(createSSEMessage(event)));
    };

    const stream = new ReadableStream({
      async start(ctrl) {
        controller = ctrl;
        try {
          // Progress: building context
          emit({
            type: "progress",
            percentage: 10,
            message: "Building ad copy context from media plan...",
          });

          // Progress: generating
          emit({
            type: "progress",
            percentage: 30,
            message:
              "Generating platform-specific ad copy with Claude Sonnet...",
          });

          // Generate ad copy
          const { adCopy, usage } = await generateAdCopy(contextString, {
            signal: request.signal,
          });

          // Progress: finalizing
          emit({
            type: "progress",
            percentage: 90,
            message: `Ad copy generated (${adCopy.copySets.length} angle sets). Finalizing...`,
          });

          // Emit done with full ad copy output
          const totalTime = Date.now() - startTime;
          emit({
            type: "done",
            success: true,
            adCopy,
            metadata: {
              totalTime,
              totalCost: adCopy.metadata.totalCost,
            },
          });

          console.log(
            `[AdCopy] Generation complete: ${totalTime}ms, ${usage.inputTokens}+${usage.outputTokens} tokens, $${adCopy.metadata.totalCost.toFixed(4)}`
          );

          streamClosed = true;
          ctrl.close();
        } catch (error) {
          streamClosed = true;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("[AdCopy] Generation error:", errorMessage);
          try {
            ctrl.enqueue(
              encoder.encode(
                createSSEMessage({ type: "error", message: errorMessage })
              )
            );
          } catch {
            /* stream may already be closed */
          }
          ctrl.close();
        }
      },
      cancel() {
        streamClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[AdCopy] Route error:", errorMessage);
    return NextResponse.json(
      createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage),
      { status: 500 }
    );
  }
}
