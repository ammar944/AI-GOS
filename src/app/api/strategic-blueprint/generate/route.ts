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
import { STRATEGIC_BLUEPRINT_SECTION_LABELS, type StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";

// Vercel Pro tier allows up to 300 seconds (5 minutes) for serverless functions
// Required for 5-section strategic blueprint generation with AI model calls
export const maxDuration = 300;

interface GenerateRequest {
  onboardingData: OnboardingFormData;
}

// =============================================================================
// SSE Event Types
// =============================================================================

interface SSESectionStartEvent {
  type: "section-start";
  section: StrategicBlueprintSection;
  label: string;
}

interface SSESectionCompleteEvent {
  type: "section-complete";
  section: StrategicBlueprintSection;
  label: string;
  data: unknown;
}

interface SSEProgressEvent {
  type: "progress";
  percentage: number;
  message: string;
}

interface SSEMetadataEvent {
  type: "metadata";
  elapsedTime: number;
  estimatedCost: number;
  completedSections: number;
  totalSections: number;
}

interface SSEDoneEvent {
  type: "done";
  success: true;
  strategicBlueprint: unknown;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

type SSEEvent =
  | SSESectionStartEvent
  | SSESectionCompleteEvent
  | SSEProgressEvent
  | SSEMetadataEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// =============================================================================
// SSE Helper
// =============================================================================

function createSSEMessage(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logContext = createLogContext("/api/strategic-blueprint/generate", "POST");

  // Check if streaming is requested
  const url = new URL(request.url);
  const streamRequested = url.searchParams.get("stream") === "true";

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

    // ==========================================================================
    // Streaming Path (SSE)
    // ==========================================================================
    if (streamRequested) {
      const encoder = new TextEncoder();
      let totalCost = 0;
      let lastSection: StrategicBlueprintSection | null = null;
      let lastCompletedCount = 0;

      // Shared state for cleanup - accessible from both start() and cancel()
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let streamClosed = false;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send immediate "started" event so client knows stream is connected
            const startedEvent: SSEProgressEvent = {
              type: "progress",
              percentage: 0,
              message: "Starting Strategic Blueprint generation...",
            };
            controller.enqueue(encoder.encode(createSSEMessage(startedEvent)));

            // Start heartbeat interval to send metadata updates every 3 seconds
            heartbeatInterval = setInterval(() => {
              // Guard against writing to closed stream
              if (streamClosed) return;

              try {
                const elapsedTime = Date.now() - startTime;
                const heartbeatEvent: SSEMetadataEvent = {
                  type: "metadata",
                  elapsedTime,
                  estimatedCost: totalCost,
                  completedSections: lastCompletedCount,
                  totalSections: 5,
                };
                controller.enqueue(encoder.encode(createSSEMessage(heartbeatEvent)));
              } catch {
                // Stream may have closed between check and write, ignore
              }
            }, 3000);

            const result = await generateStrategicBlueprint(onboardingData, {
              onProgress: (progress) => {
                const elapsedTime = Date.now() - startTime;
                lastCompletedCount = progress.completedSections.length;

                // Detect section transitions
                if (progress.currentSection && progress.currentSection !== lastSection) {
                  // If we had a previous section that just completed
                  if (lastSection && progress.completedSections.includes(lastSection)) {
                    const completedData = progress.partialOutput[lastSection];
                    const completeEvent: SSESectionCompleteEvent = {
                      type: "section-complete",
                      section: lastSection,
                      label: STRATEGIC_BLUEPRINT_SECTION_LABELS[lastSection],
                      data: completedData,
                    };
                    controller.enqueue(encoder.encode(createSSEMessage(completeEvent)));
                  }

                  // Emit section-start for the new section
                  const startEvent: SSESectionStartEvent = {
                    type: "section-start",
                    section: progress.currentSection,
                    label: STRATEGIC_BLUEPRINT_SECTION_LABELS[progress.currentSection],
                  };
                  controller.enqueue(encoder.encode(createSSEMessage(startEvent)));
                  lastSection = progress.currentSection;
                }

                // Emit progress event
                const progressEvent: SSEProgressEvent = {
                  type: "progress",
                  percentage: progress.progressPercentage,
                  message: progress.progressMessage,
                };
                controller.enqueue(encoder.encode(createSSEMessage(progressEvent)));

                // Emit metadata event
                const metadataEvent: SSEMetadataEvent = {
                  type: "metadata",
                  elapsedTime,
                  estimatedCost: totalCost,
                  completedSections: progress.completedSections.length,
                  totalSections: 5,
                };
                controller.enqueue(encoder.encode(createSSEMessage(metadataEvent)));
              },
            });

            const duration = Date.now() - startTime;
            totalCost = result.metadata.totalCost;

            if (result.success && result.strategicBlueprint) {
              // Emit final section-complete for the last section if needed
              if (lastSection) {
                const completedData = result.strategicBlueprint[lastSection as keyof typeof result.strategicBlueprint];
                const completeEvent: SSESectionCompleteEvent = {
                  type: "section-complete",
                  section: lastSection,
                  label: STRATEGIC_BLUEPRINT_SECTION_LABELS[lastSection],
                  data: completedData,
                };
                controller.enqueue(encoder.encode(createSSEMessage(completeEvent)));
              }

              // Emit done event
              const doneEvent: SSEDoneEvent = {
                type: "done",
                success: true,
                strategicBlueprint: result.strategicBlueprint,
                metadata: {
                  totalTime: result.metadata.totalTime,
                  totalCost: result.metadata.totalCost,
                },
              };
              controller.enqueue(encoder.encode(createSSEMessage(doneEvent)));

              logInfo(
                {
                  ...logContext,
                  duration,
                  metadata: {
                    totalTime: result.metadata.totalTime,
                    totalCost: result.metadata.totalCost,
                    streaming: true,
                  },
                },
                "Strategic Blueprint generation completed successfully (streaming)"
              );
            } else {
              // Emit error event
              const errorEvent: SSEErrorEvent = {
                type: "error",
                message: result.error || "Strategic Blueprint generation failed",
              };
              controller.enqueue(encoder.encode(createSSEMessage(errorEvent)));

              logError(
                {
                  ...logContext,
                  duration,
                  errorCode: ErrorCode.INTERNAL_ERROR,
                  metadata: result.metadata,
                },
                result.error || "Strategic Blueprint generation failed"
              );
            }

            // Mark stream as closed, clear heartbeat, and close controller
            streamClosed = true;
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            controller.close();
          } catch (error) {
            // Mark stream as closed and clear heartbeat on error
            streamClosed = true;
            if (heartbeatInterval) clearInterval(heartbeatInterval);

            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            const errorEvent: SSEErrorEvent = {
              type: "error",
              message: errorMessage,
            };
            controller.enqueue(encoder.encode(createSSEMessage(errorEvent)));

            logError(
              { ...logContext, errorCode: ErrorCode.INTERNAL_ERROR },
              error instanceof Error ? error : errorMessage
            );

            controller.close();
          }
        },
        // Handle client disconnect - clean up resources to prevent memory leaks
        cancel() {
          streamClosed = true;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // ==========================================================================
    // Non-Streaming Path (JSON) - Backward Compatible
    // ==========================================================================
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
