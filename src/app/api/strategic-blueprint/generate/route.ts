// Strategic Blueprint Generation API Endpoint
// POST /api/strategic-blueprint/generate
// Uses Vercel AI SDK with Perplexity + Claude

import { NextRequest, NextResponse } from 'next/server';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import {
  generateStrategicBlueprint,
  createBusinessContext,
  validateOnboardingData,
  enrichCompetitors,
  type StrategicBlueprintOutput,
  type GenerationProgress,
  type EnrichmentResult,
} from '@/lib/ai';
import {
  createErrorResponse,
  ErrorCode,
  getHttpStatusForCode,
} from '@/lib/errors';
import { createLogContext, logError, logInfo } from '@/lib/logger';

// Vercel Pro tier allows up to 300 seconds (5 minutes)
export const maxDuration = 300;

// =============================================================================
// Types
// =============================================================================

interface GenerateRequest {
  onboardingData: OnboardingFormData;
}

type BlueprintSection =
  | 'industryMarketOverview'
  | 'icpAnalysisValidation'
  | 'offerAnalysisViability'
  | 'competitorAnalysis'
  | 'crossAnalysisSynthesis';

const SECTION_LABELS: Record<BlueprintSection, string> = {
  industryMarketOverview: 'Industry & Market Overview',
  icpAnalysisValidation: 'ICP Analysis & Validation',
  offerAnalysisViability: 'Offer Analysis & Viability',
  competitorAnalysis: 'Competitor Analysis',
  crossAnalysisSynthesis: 'Cross-Analysis Synthesis',
};

// =============================================================================
// SSE Event Types
// =============================================================================

interface SSEProgressEvent {
  type: 'progress';
  phase: number;
  section: string;
  message: string;
  elapsedTime: number;
  estimatedCost: number;
}

interface SSESectionCompleteEvent {
  type: 'section-complete';
  section: BlueprintSection;
  label: string;
}

interface SSEDoneEvent {
  type: 'done';
  success: true;
  strategicBlueprint: StrategicBlueprintOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

interface SSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

type SSEEvent = SSEProgressEvent | SSESectionCompleteEvent | SSEDoneEvent | SSEErrorEvent;

function createSSEMessage(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logContext = createLogContext('/api/strategic-blueprint/generate', 'POST');

  // Check if streaming is requested
  const url = new URL(request.url);
  const streamRequested = url.searchParams.get('stream') === 'true';

  try {
    const body = (await request.json()) as GenerateRequest;
    const { onboardingData } = body;

    // Validate input
    if (!onboardingData) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, 'Missing onboardingData'),
        { status: 400 }
      );
    }

    const validation = validateOnboardingData(onboardingData);
    if (!validation.valid) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.INVALID_INPUT, validation.errors.join('; ')),
        { status: 400 }
      );
    }

    // Build context string
    const context = createBusinessContext(onboardingData);

    // =========================================================================
    // Streaming Response with PARALLEL ENRICHMENT
    // Enrichment starts after Phase 1 completes, runs parallel to Phase 2/3
    // =========================================================================
    if (streamRequested) {
      const encoder = new TextEncoder();
      let streamClosed = false;
      let enrichmentPromise: Promise<EnrichmentResult> | null = null;
      let enrichmentCostEstimate = 0;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Progress callback for SSE updates - also triggers early enrichment
            const onProgress = (progress: GenerationProgress) => {
              if (streamClosed) return;

              const event: SSEProgressEvent = {
                type: 'progress',
                phase: progress.phase,
                section: progress.section,
                message: progress.message,
                elapsedTime: progress.elapsedMs,
                estimatedCost: progress.cost,
              };
              controller.enqueue(encoder.encode(createSSEMessage(event)));

              // START ENRICHMENT EARLY: When Phase 1 completes, kick off enrichment
              // This runs PARALLEL to Phase 2/3, saving ~40-60 seconds
              if (progress.section === 'phase1' && progress.status === 'complete' && progress.competitorData) {
                console.log('[Route] Phase 1 complete - starting enrichment in parallel with Phase 2/3');
                const enrichStartEvent: SSEProgressEvent = {
                  type: 'progress',
                  phase: 1,
                  section: 'enrichment',
                  message: 'Starting competitor enrichment (parallel)...',
                  elapsedTime: progress.elapsedMs,
                  estimatedCost: progress.cost,
                };
                controller.enqueue(encoder.encode(createSSEMessage(enrichStartEvent)));

                // Start enrichment - don't await, let it run parallel
                enrichmentPromise = enrichCompetitors(
                  progress.competitorData,
                  (msg) => {
                    if (streamClosed) return;
                    const enrichEvent: SSEProgressEvent = {
                      type: 'progress',
                      phase: 1, // Keep as phase 1 since it started there
                      section: 'enrichment',
                      message: msg,
                      elapsedTime: Date.now() - startTime,
                      estimatedCost: enrichmentCostEstimate,
                    };
                    controller.enqueue(encoder.encode(createSSEMessage(enrichEvent)));
                  }
                );
              }

              // Send section-complete when a section finishes
              if (progress.status === 'complete' && progress.section !== 'phase1' && progress.section !== 'phase2' && progress.section !== 'error') {
                const sectionKey = progress.section as BlueprintSection;
                if (SECTION_LABELS[sectionKey]) {
                  const completeEvent: SSESectionCompleteEvent = {
                    type: 'section-complete',
                    section: sectionKey,
                    label: SECTION_LABELS[sectionKey],
                  };
                  controller.enqueue(encoder.encode(createSSEMessage(completeEvent)));
                }
              }
            };

            // Generate blueprint (Phase 1/2/3)
            const result = await generateStrategicBlueprint(context, { onProgress });

            if (!result.success || !result.blueprint) {
              const errorEvent: SSEErrorEvent = {
                type: 'error',
                message: result.error || 'Generation failed',
              };
              controller.enqueue(encoder.encode(createSSEMessage(errorEvent)));
              streamClosed = true;
              controller.close();
              return;
            }

            // Wait for enrichment to complete (it started during Phase 1)
            let enrichment: EnrichmentResult;
            if (enrichmentPromise) {
              console.log('[Route] Waiting for parallel enrichment to complete...');
              enrichment = await enrichmentPromise;
            } else {
              // Fallback: if enrichment didn't start early, do it now
              console.log('[Route] Enrichment did not start early - running now');
              enrichment = await enrichCompetitors(
                result.blueprint.competitorAnalysis,
                (msg) => {
                  if (streamClosed) return;
                  const event: SSEProgressEvent = {
                    type: 'progress',
                    phase: 3,
                    section: 'enrichment',
                    message: msg,
                    elapsedTime: Date.now() - startTime,
                    estimatedCost: result.blueprint!.metadata.totalCost,
                  };
                  controller.enqueue(encoder.encode(createSSEMessage(event)));
                }
              );
            }

            // Debug: Log enrichment result before merge
            const totalEnrichedAds = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
            console.log(`[Route] Enrichment returned ${totalEnrichedAds} total ads across ${enrichment.competitors.length} competitors`);

            // Merge enriched competitors into blueprint
            const finalBlueprint: StrategicBlueprintOutput = {
              ...result.blueprint,
              competitorAnalysis: {
                ...result.blueprint.competitorAnalysis,
                competitors: enrichment.competitors as any,
              },
              metadata: {
                ...result.blueprint.metadata,
                totalCost: result.blueprint.metadata.totalCost + enrichment.enrichmentCost,
                processingTime: Date.now() - startTime,
              },
            };

            // Debug: Verify ads are in final blueprint
            const finalBlueprintAds = finalBlueprint.competitorAnalysis.competitors.reduce(
              (sum: number, c: any) => sum + (c.adCreatives?.length ?? 0), 0
            );
            console.log(`[Route] Final blueprint contains ${finalBlueprintAds} total ads`);

            // Send done event
            const doneEvent: SSEDoneEvent = {
              type: 'done',
              success: true,
              strategicBlueprint: finalBlueprint,
              metadata: {
                totalTime: finalBlueprint.metadata.processingTime,
                totalCost: finalBlueprint.metadata.totalCost,
              },
            };
            controller.enqueue(encoder.encode(createSSEMessage(doneEvent)));

            logInfo(
              {
                ...logContext,
                duration: Date.now() - startTime,
                metadata: { totalTime: finalBlueprint.metadata.processingTime, totalCost: finalBlueprint.metadata.totalCost },
              },
              'Strategic Blueprint generated (streaming)'
            );

            streamClosed = true;
            controller.close();
          } catch (error) {
            streamClosed = true;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Direct console output for debugging
            console.error('\n[BLUEPRINT_GENERATION_ERROR]', errorMessage);
            console.error('[FULL_ERROR]', error);
            const errorEvent: SSEErrorEvent = {
              type: 'error',
              message: errorMessage,
            };
            controller.enqueue(encoder.encode(createSSEMessage(errorEvent)));
            logError({ ...logContext, errorCode: ErrorCode.INTERNAL_ERROR }, error instanceof Error ? error : errorMessage);
            controller.close();
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
    }

    // =========================================================================
    // Non-Streaming Response
    // =========================================================================
    const result = await generateStrategicBlueprint(context);

    if (!result.success || !result.blueprint) {
      const errorCode = ErrorCode.INTERNAL_ERROR;
      logError({ ...logContext, duration: Date.now() - startTime, errorCode }, result.error || 'Generation failed');
      return NextResponse.json(
        createErrorResponse(errorCode, result.error || 'Generation failed'),
        { status: getHttpStatusForCode(errorCode) }
      );
    }

    // Enrich competitors
    const enrichment = await enrichCompetitors(result.blueprint.competitorAnalysis);

    // Debug: Log enrichment result before merge
    const totalEnrichedAdsNonStream = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
    console.log(`[Route/NonStream] Enrichment returned ${totalEnrichedAdsNonStream} total ads across ${enrichment.competitors.length} competitors`);

    // Merge enriched data
    const finalBlueprint: StrategicBlueprintOutput = {
      ...result.blueprint,
      competitorAnalysis: {
        ...result.blueprint.competitorAnalysis,
        competitors: enrichment.competitors as any,
      },
      metadata: {
        ...result.blueprint.metadata,
        totalCost: result.blueprint.metadata.totalCost + enrichment.enrichmentCost,
        processingTime: Date.now() - startTime,
      },
    };

    // Debug: Verify ads are in final blueprint
    const finalBlueprintAdsNonStream = finalBlueprint.competitorAnalysis.competitors.reduce(
      (sum: number, c: any) => sum + (c.adCreatives?.length ?? 0), 0
    );
    console.log(`[Route/NonStream] Final blueprint contains ${finalBlueprintAdsNonStream} total ads`);

    logInfo(
      {
        ...logContext,
        duration: Date.now() - startTime,
        metadata: { totalTime: finalBlueprint.metadata.processingTime, totalCost: finalBlueprint.metadata.totalCost },
      },
      'Strategic Blueprint generated'
    );

    return NextResponse.json({
      success: true,
      strategicBlueprint: finalBlueprint,
      metadata: {
        totalTime: finalBlueprint.metadata.processingTime,
        totalCost: finalBlueprint.metadata.totalCost,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError({ ...logContext, duration, errorCode: ErrorCode.INTERNAL_ERROR }, error instanceof Error ? error : errorMessage);
    return NextResponse.json(
      createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage),
      { status: 500 }
    );
  }
}
