// Media Plan Generation API Endpoint
// POST /api/media-plan/generate
// SSE streaming — single-phase generateObject with Claude Sonnet

import { NextRequest, NextResponse } from 'next/server';
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import { buildMediaPlanContext } from '@/lib/media-plan/context-builder';
import { generateMediaPlan } from '@/lib/media-plan/generator';
import type { MediaPlanSSEEvent } from '@/lib/media-plan/types';
import { MEDIA_PLAN_SECTION_LABELS } from '@/lib/media-plan/types';
import { createErrorResponse, ErrorCode } from '@/lib/errors';

export const maxDuration = 120;

// =============================================================================
// SSE Helper
// =============================================================================

function createSSEMessage(event: MediaPlanSSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// =============================================================================
// Types
// =============================================================================

interface GenerateRequest {
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
    const { blueprint, onboardingData } = body;

    // Validate inputs
    if (!blueprint) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, 'Missing blueprint data'),
        { status: 400 },
      );
    }

    if (!onboardingData) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, 'Missing onboarding data'),
        { status: 400 },
      );
    }

    // Build focused context
    const { contextString, tokenEstimate } = buildMediaPlanContext(blueprint, onboardingData);
    console.log(`[MediaPlan] Context built: ${contextString.length} chars, ~${tokenEstimate} tokens`);

    // SSE streaming response
    const encoder = new TextEncoder();
    let streamClosed = false;

    // Declared here so emit can reference it
    let controller: ReadableStreamDefaultController;

    const emit = (event: MediaPlanSSEEvent) => {
      if (streamClosed) return;
      controller.enqueue(encoder.encode(createSSEMessage(event)));
    };

    const stream = new ReadableStream({
      async start(ctrl) {
        controller = ctrl;
        try {
          // Emit section-start
          emit({
            type: 'section-start',
            section: 'mediaPlan',
            label: MEDIA_PLAN_SECTION_LABELS.mediaPlan,
          });

          // Generate media plan with progress callbacks
          const result = await generateMediaPlan(contextString, {
            onProgress: (message, percentage) => {
              emit({
                type: 'progress',
                percentage,
                message,
              });
            },
          });

          if (!result.success || !result.mediaPlan) {
            emit({ type: 'error', message: result.error || 'Media plan generation failed' });
            streamClosed = true;
            ctrl.close();
            return;
          }

          // Emit section-complete
          emit({
            type: 'section-complete',
            section: 'mediaPlan',
            label: MEDIA_PLAN_SECTION_LABELS.mediaPlan,
            data: null,
          });

          // Emit done with full media plan
          const totalTime = Date.now() - startTime;
          emit({
            type: 'done',
            success: true,
            mediaPlan: result.mediaPlan,
            metadata: {
              totalTime,
              totalCost: result.mediaPlan.metadata.totalCost,
            },
          });

          console.log(`[MediaPlan] Generation complete: ${totalTime}ms, $${result.mediaPlan.metadata.totalCost.toFixed(4)}`);

          streamClosed = true;
          ctrl.close();
        } catch (error) {
          streamClosed = true;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[MediaPlan] Generation error:', errorMessage);
          try {
            ctrl.enqueue(encoder.encode(createSSEMessage({ type: 'error', message: errorMessage })));
          } catch { /* stream may already be closed */ }
          ctrl.close();
        }
      },
      cancel() {
        streamClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MediaPlan] Route error:', errorMessage);
    return NextResponse.json(
      createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage),
      { status: 500 },
    );
  }
}
