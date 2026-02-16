// Media Plan Generation API Endpoint
// POST /api/media-plan/generate
// SSE streaming — multi-phase pipeline (Sonar Pro → Claude Sonnet → deterministic validation)

import { NextRequest, NextResponse } from 'next/server';
import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import { runMediaPlanPipeline, type PipelineProgress } from '@/lib/media-plan/pipeline';
import type { MediaPlanSSEEvent } from '@/lib/media-plan/types';
import { createErrorResponse, ErrorCode } from '@/lib/errors';

export const maxDuration = 300; // 5min — sequential Sonnet calls + rate limit retries need headroom

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

    console.log(`[MediaPlan] Starting multi-phase pipeline generation`);

    // SSE streaming response
    const encoder = new TextEncoder();
    let streamClosed = false;

    let controller: ReadableStreamDefaultController;

    const emit = (event: MediaPlanSSEEvent) => {
      if (streamClosed) return;
      try {
        controller.enqueue(encoder.encode(createSSEMessage(event)));
      } catch { /* stream may be closed */ }
    };

    const stream = new ReadableStream({
      async start(ctrl) {
        controller = ctrl;
        try {
          // Run the multi-phase pipeline with per-section SSE events
          const result = await runMediaPlanPipeline(blueprint, onboardingData, {
            onSectionProgress: (progress: PipelineProgress) => {
              if (progress.status === 'start') {
                emit({
                  type: 'section-start',
                  section: progress.section,
                  phase: progress.phase,
                  label: progress.label,
                });
              } else {
                emit({
                  type: 'section-complete',
                  section: progress.section,
                  phase: progress.phase,
                  label: progress.label,
                });
              }
            },
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

          // Emit done with full media plan
          const totalTime = Date.now() - startTime;
          emit({
            type: 'done',
            success: true,
            mediaPlan: result.mediaPlan,
            metadata: {
              totalTime,
              totalCost: result.totalCost,
            },
          });

          console.log(`[MediaPlan] Pipeline complete: ${totalTime}ms, $${result.totalCost.toFixed(4)}`);

          streamClosed = true;
          ctrl.close();
        } catch (error) {
          streamClosed = true;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[MediaPlan] Pipeline error:', errorMessage);
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
