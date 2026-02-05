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
  extractAdHooksFromAds,
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

// Map generator section names → frontend BlueprintSection keys
const GENERATOR_TO_SECTION: Record<string, BlueprintSection> = {
  industryMarket: 'industryMarketOverview',
  industryMarketOverview: 'industryMarketOverview',
  icpValidation: 'icpAnalysisValidation',
  icpAnalysisValidation: 'icpAnalysisValidation',
  offerAnalysis: 'offerAnalysisViability',
  offerAnalysisViability: 'offerAnalysisViability',
  competitorAnalysis: 'competitorAnalysis',
  crossAnalysis: 'crossAnalysisSynthesis',
  crossAnalysisSynthesis: 'crossAnalysisSynthesis',
};

const TOTAL_SECTIONS = 5;

// =============================================================================
// SSE Event Types (must match frontend generate/page.tsx definitions)
// =============================================================================

interface SSESectionStartEvent {
  type: 'section-start';
  section: BlueprintSection;
  label: string;
}

interface SSESectionCompleteEvent {
  type: 'section-complete';
  section: BlueprintSection;
  label: string;
  data: unknown;
}

interface SSEProgressEvent {
  type: 'progress';
  percentage: number;
  message: string;
}

interface SSEMetadataEvent {
  type: 'metadata';
  elapsedTime: number;
  estimatedCost: number;
  completedSections: number;
  totalSections: number;
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

type SSEEvent =
  | SSESectionStartEvent
  | SSESectionCompleteEvent
  | SSEProgressEvent
  | SSEMetadataEvent
  | SSEDoneEvent
  | SSEErrorEvent;

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
      const completedSections = new Set<BlueprintSection>();

      // Helper to send SSE and track completions
      const emit = (event: SSEEvent) => {
        if (streamClosed) return;
        controller.enqueue(encoder.encode(createSSEMessage(event)));
      };

      // Declared here so emit can reference it
      let controller: ReadableStreamDefaultController;

      const stream = new ReadableStream({
        async start(ctrl) {
          controller = ctrl;
          try {
            // Progress callback — translates generator events into frontend SSE events
            const onProgress = (progress: GenerationProgress) => {
              if (streamClosed) return;

              const mappedSection = GENERATOR_TO_SECTION[progress.section];

              // Section starting → emit section-start
              if (progress.status === 'starting' && mappedSection) {
                emit({
                  type: 'section-start',
                  section: mappedSection,
                  label: SECTION_LABELS[mappedSection],
                });
              }

              // Always emit a progress event with percentage and message
              const pct = Math.round((completedSections.size / TOTAL_SECTIONS) * 100);
              emit({
                type: 'progress',
                percentage: pct,
                message: progress.message,
              });

              // Section complete → emit section-complete + metadata
              if (progress.status === 'complete' && mappedSection) {
                completedSections.add(mappedSection);
                emit({
                  type: 'section-complete',
                  section: mappedSection,
                  label: SECTION_LABELS[mappedSection],
                  data: null, // Section data arrives in the final 'done' event
                });
                emit({
                  type: 'metadata',
                  elapsedTime: progress.elapsedMs,
                  estimatedCost: progress.cost,
                  completedSections: completedSections.size,
                  totalSections: TOTAL_SECTIONS,
                });
              }

              // START ENRICHMENT EARLY: When Phase 1 completes, kick off enrichment
              // This runs PARALLEL to Phase 2/3, saving ~40-60 seconds
              if (progress.section === 'phase1' && progress.status === 'complete' && progress.competitorData) {
                console.log('[Route] Phase 1 complete - starting enrichment in parallel with Phase 2/3');
                emit({
                  type: 'progress',
                  percentage: pct,
                  message: 'Starting competitor enrichment (parallel)...',
                });

                // Start enrichment - don't await, let it run parallel
                enrichmentPromise = enrichCompetitors(
                  progress.competitorData,
                  (msg) => {
                    emit({
                      type: 'progress',
                      percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                      message: msg,
                    });
                  }
                );
              }

              // Capture Phase 2 completion
              if (progress.section === 'phase2' && progress.status === 'complete') {
                console.log('[Route] Phase 2 complete');
              }
            };

            // Generate blueprint (Phase 1/2/3)
            const result = await generateStrategicBlueprint(context, { onProgress });

            if (!result.success || !result.blueprint) {
              emit({ type: 'error', message: result.error || 'Generation failed' });
              streamClosed = true;
              ctrl.close();
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
                  emit({
                    type: 'progress',
                    percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                    message: msg,
                  });
                }
              );
            }

            // Debug: Log enrichment result
            const totalEnrichedAds = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
            console.log(`[Route] Enrichment returned ${totalEnrichedAds} total ads across ${enrichment.competitors.length} competitors`);

            // RE-RUN SYNTHESIS with enriched competitor data
            let finalSynthesis = result.blueprint.crossAnalysisSynthesis;
            let resynthesisCost = 0;

            // LIGHTWEIGHT HOOK EXTRACTION (replaces full re-synthesis for ~80% cost/time reduction)
            if (totalEnrichedAds > 0) {
              console.log('[Route] Extracting hooks from competitor ads (lightweight)...');

              emit({
                type: 'progress',
                percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                message: 'Extracting ad hooks from competitor creatives...',
              });

              try {
                const extractionStart = Date.now();
                const extractionResult = await extractAdHooksFromAds(
                  enrichment.competitors,
                  finalSynthesis.messagingFramework?.adHooks ?? []
                );

                // Update only adHooks field with extracted hooks
                finalSynthesis = {
                  ...finalSynthesis,
                  messagingFramework: {
                    ...finalSynthesis.messagingFramework!,
                    adHooks: extractionResult.hooks,
                  },
                };
                resynthesisCost = extractionResult.cost;

                console.log(`[Route] Hook extraction complete in ${Date.now() - extractionStart}ms, cost: $${resynthesisCost.toFixed(4)}, extracted: ${extractionResult.extractedCount}, inspired: ${extractionResult.inspiredCount}`);
              } catch (error) {
                console.error('[Route] Hook extraction failed, using original hooks:', error);
              }
            }

            // Build final blueprint with enriched competitors and (potentially) re-synthesized analysis
            const finalBlueprint: StrategicBlueprintOutput = {
              ...result.blueprint,
              competitorAnalysis: {
                ...result.blueprint.competitorAnalysis,
                competitors: enrichment.competitors as any,
              },
              crossAnalysisSynthesis: finalSynthesis,
              metadata: {
                ...result.blueprint.metadata,
                totalCost: result.blueprint.metadata.totalCost + enrichment.enrichmentCost + resynthesisCost,
                processingTime: Date.now() - startTime,
              },
            };

            // Debug: Verify ads are in final blueprint
            const finalBlueprintAds = finalBlueprint.competitorAnalysis.competitors.reduce(
              (sum: number, c: any) => sum + (c.adCreatives?.length ?? 0), 0
            );
            console.log(`[Route] Final blueprint contains ${finalBlueprintAds} total ads`);

            // Send done event
            emit({
              type: 'done',
              success: true,
              strategicBlueprint: finalBlueprint,
              metadata: {
                totalTime: finalBlueprint.metadata.processingTime,
                totalCost: finalBlueprint.metadata.totalCost,
              },
            });

            logInfo(
              {
                ...logContext,
                duration: Date.now() - startTime,
                metadata: { totalTime: finalBlueprint.metadata.processingTime, totalCost: finalBlueprint.metadata.totalCost },
              },
              'Strategic Blueprint generated (streaming)'
            );

            streamClosed = true;
            ctrl.close();
          } catch (error) {
            streamClosed = true;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('\n[BLUEPRINT_GENERATION_ERROR]', errorMessage);
            console.error('[FULL_ERROR]', error);
            try {
              ctrl.enqueue(encoder.encode(createSSEMessage({ type: 'error', message: errorMessage })));
            } catch { /* stream may already be closed */ }
            logError({ ...logContext, errorCode: ErrorCode.INTERNAL_ERROR }, error instanceof Error ? error : errorMessage);
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
