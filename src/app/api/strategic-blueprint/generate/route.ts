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
  enrichKeywordIntelligence,
  type StrategicBlueprintOutput,
  type GenerationProgress,
  type EnrichmentResult,
  type ExtractAdHooksResult,
  type KeywordIntelligenceResult,
  type KeywordBusinessContext,
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
  | 'crossAnalysisSynthesis'
  | 'keywordIntelligence';

const SECTION_LABELS: Record<BlueprintSection, string> = {
  industryMarketOverview: 'Industry & Market Overview',
  icpAnalysisValidation: 'ICP Analysis & Validation',
  offerAnalysisViability: 'Offer Analysis & Viability',
  competitorAnalysis: 'Competitor Analysis',
  crossAnalysisSynthesis: 'Cross-Analysis Synthesis',
  keywordIntelligence: 'Keyword Intelligence',
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
  keywordIntelligence: 'keywordIntelligence',
};

const TOTAL_SECTIONS = 6;

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
      let keywordPromise: Promise<KeywordIntelligenceResult | null> | null = null;
      let hookPromise: Promise<ExtractAdHooksResult | null> | null = null;
      let baseCompetitorData: any = null; // Captured from Phase 1 for enrichment merge
      let storedEnrichment: EnrichmentResult | null = null;
      let storedKeywordResult: KeywordIntelligenceResult | null = null;
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
              // Enrichment runs PARALLEL to Phase 2, then feeds into Phase 3 synthesis
              if (progress.section === 'phase1' && progress.status === 'complete' && progress.competitorData) {
                baseCompetitorData = progress.competitorData;
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

                // Start keyword intelligence enrichment in parallel (requires client URL + SpyFu key)
                const clientDomain = onboardingData.businessBasics?.websiteUrl;
                if (clientDomain && process.env.SPYFU_API_KEY) {
                  console.log('[Route] Starting keyword intelligence enrichment (parallel)...');
                  emit({
                    type: 'section-start',
                    section: 'keywordIntelligence',
                    label: SECTION_LABELS.keywordIntelligence,
                  });

                  // Build business context for keyword relevance filtering
                  const keywordBusinessContext: KeywordBusinessContext = {
                    industry: onboardingData.icp?.industryVertical || '',
                    productDescription: onboardingData.productOffer?.productDescription || '',
                    companyName: onboardingData.businessBasics?.businessName || '',
                    competitorNames: progress.competitorData.competitors.map((c: any) => c.name),
                  };

                  keywordPromise = enrichKeywordIntelligence(
                    clientDomain,
                    progress.competitorData.competitors,
                    (msg) => {
                      emit({
                        type: 'progress',
                        percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                        message: msg,
                      });
                    },
                    keywordBusinessContext,
                  ).catch(error => {
                    console.error('[Route] Keyword intelligence failed (non-fatal):', error);
                    return null;
                  });
                }
              }

              // Capture Phase 2 completion
              if (progress.section === 'phase2' && progress.status === 'complete') {
                console.log('[Route] Phase 2 complete');
              }
            };

            // Generate blueprint (Phase 1/2/3)
            // Enrichment callbacks let synthesis access reviews/pricing/ads/keywords
            // with zero delay (enrichment finishes during Phase 2, well before Phase 3)
            const result = await generateStrategicBlueprint(context, {
              onProgress,
              getEnrichedCompetitors: async () => {
                if (!enrichmentPromise || !baseCompetitorData) return undefined;
                const enrichment = await enrichmentPromise;
                storedEnrichment = enrichment;
                console.log(`[Route] Enrichment ready for synthesis: ${enrichment.reviewSuccessCount} reviews, ${enrichment.pricingSuccessCount} pricing, ${enrichment.adSuccessCount} ads`);

                // Start hook extraction in parallel with synthesis (don't await)
                const totalAds = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
                if (totalAds > 0 && !hookPromise) {
                  console.log('[Route] Starting hook extraction parallel to synthesis...');
                  emit({
                    type: 'progress',
                    percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                    message: 'Extracting ad hooks from competitor creatives (parallel)...',
                  });
                  hookPromise = extractAdHooksFromAds(
                    enrichment.competitors,
                    [] // No synthesis hooks yet — will merge after both finish
                  ).catch(error => {
                    console.error('[Route] Hook extraction failed (non-fatal):', error);
                    return null;
                  });
                }

                return {
                  ...baseCompetitorData,
                  competitors: enrichment.competitors,
                } as any;
              },
              getKeywordIntelligence: async () => {
                if (!keywordPromise) return undefined;
                const kwResult = await keywordPromise;
                if (kwResult) {
                  storedKeywordResult = kwResult;
                  completedSections.add('keywordIntelligence');
                  emit({
                    type: 'section-complete',
                    section: 'keywordIntelligence',
                    label: SECTION_LABELS.keywordIntelligence,
                    data: null,
                  });
                  console.log(`[Route] Keyword intelligence ready for synthesis: ${kwResult.keywordIntelligence.metadata.totalKeywordsAnalyzed} keywords`);
                }
                return kwResult?.keywordIntelligence;
              },
            });

            if (!result.success || !result.blueprint) {
              emit({ type: 'error', message: result.error || 'Generation failed' });
              streamClosed = true;
              ctrl.close();
              return;
            }

            // Enrichment + keywords already awaited inside generator via callbacks
            // Re-await is instant (promises already resolved)
            const enrichment = storedEnrichment ?? (enrichmentPromise ? await enrichmentPromise : await enrichCompetitors(
              result.blueprint.competitorAnalysis,
              (msg) => {
                emit({
                  type: 'progress',
                  percentage: Math.round((completedSections.size / TOTAL_SECTIONS) * 100),
                  message: msg,
                });
              }
            ));
            const keywordResult = storedKeywordResult ?? (keywordPromise ? await keywordPromise : null);

            // Debug: Log enrichment result
            const totalEnrichedAds = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
            console.log(`[Route] Enrichment: ${totalEnrichedAds} ads, ${enrichment.reviewSuccessCount}/${enrichment.competitors.length} reviews, ${enrichment.pricingSuccessCount}/${enrichment.competitors.length} pricing`);

            // Synthesis already had enriched data (reviews, pricing, ads, keywords)
            // Hook extraction ran in parallel with synthesis — merge results now
            let finalSynthesis = result.blueprint.crossAnalysisSynthesis;
            let resynthesisCost = 0;

            // Await parallel hook extraction and merge with synthesis hooks
            if (hookPromise) {
              try {
                const hookResult = await hookPromise;
                if (hookResult && hookResult.hooks.length > 0) {
                  const synthesisHooks = finalSynthesis.messagingFramework?.adHooks ?? [];
                  // Extracted/inspired hooks (from ads) take priority, then fill with synthesis-generated hooks
                  const generatedOnly = synthesisHooks.filter(
                    h => !h.source || h.source.type === 'generated'
                  );
                  const mergedHooks = [
                    ...hookResult.hooks, // extracted + inspired (high priority)
                    ...generatedOnly.slice(0, 12 - hookResult.hooks.length),
                  ].slice(0, 12);

                  finalSynthesis = {
                    ...finalSynthesis,
                    messagingFramework: {
                      ...finalSynthesis.messagingFramework!,
                      adHooks: mergedHooks,
                    },
                  };
                  resynthesisCost = hookResult.cost;

                  console.log(`[Route] Hook extraction merged: cost=$${resynthesisCost.toFixed(4)}, extracted=${hookResult.extractedCount}, inspired=${hookResult.inspiredCount}, synthesis-generated=${generatedOnly.length}, final=${mergedHooks.length}`);
                }
              } catch (error) {
                console.error('[Route] Hook extraction merge failed, using synthesis hooks:', error);
              }
            }

            // Build final blueprint with enriched competitors, keyword intelligence, and (potentially) re-synthesized analysis
            const keywordCost = keywordResult?.cost ?? 0;
            const finalBlueprint: StrategicBlueprintOutput = {
              ...result.blueprint,
              competitorAnalysis: {
                ...result.blueprint.competitorAnalysis,
                competitors: enrichment.competitors as any,
              },
              crossAnalysisSynthesis: finalSynthesis,
              ...(keywordResult && { keywordIntelligence: keywordResult.keywordIntelligence }),
              metadata: {
                ...result.blueprint.metadata,
                totalCost: result.blueprint.metadata.totalCost + enrichment.enrichmentCost + resynthesisCost + keywordCost,
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

    // Enrich competitors + keyword intelligence (parallel)
    const clientDomainNonStream = onboardingData.businessBasics?.websiteUrl;
    const keywordBusinessContextNonStream: KeywordBusinessContext = {
      industry: onboardingData.icp?.industryVertical || '',
      productDescription: onboardingData.productOffer?.productDescription || '',
      companyName: onboardingData.businessBasics?.businessName || '',
      competitorNames: result.blueprint.competitorAnalysis.competitors.map((c: any) => c.name),
    };
    const [enrichment, keywordResultNonStream] = await Promise.all([
      enrichCompetitors(result.blueprint.competitorAnalysis),
      (clientDomainNonStream && process.env.SPYFU_API_KEY)
        ? enrichKeywordIntelligence(clientDomainNonStream, result.blueprint.competitorAnalysis.competitors, undefined, keywordBusinessContextNonStream).catch(() => null)
        : Promise.resolve(null),
    ]);

    // Debug: Log enrichment result before merge
    const totalEnrichedAdsNonStream = enrichment.competitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
    console.log(`[Route/NonStream] Enrichment returned ${totalEnrichedAdsNonStream} total ads across ${enrichment.competitors.length} competitors`);
    if (keywordResultNonStream) {
      console.log(`[Route/NonStream] Keyword intelligence: ${keywordResultNonStream.keywordIntelligence.metadata.totalKeywordsAnalyzed} keywords`);
    }

    // Merge enriched data
    const keywordCostNonStream = keywordResultNonStream?.cost ?? 0;
    const finalBlueprint: StrategicBlueprintOutput = {
      ...result.blueprint,
      competitorAnalysis: {
        ...result.blueprint.competitorAnalysis,
        competitors: enrichment.competitors as any,
      },
      ...(keywordResultNonStream && { keywordIntelligence: keywordResultNonStream.keywordIntelligence }),
      metadata: {
        ...result.blueprint.metadata,
        totalCost: result.blueprint.metadata.totalCost + enrichment.enrichmentCost + keywordCostNonStream,
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
