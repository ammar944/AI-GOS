import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import {
  persistPipelineState,
  readPipelineState,
} from '@/lib/journey/session-state.server';
import {
  getNextSectionId,
  markSectionApproved,
  markSectionRunning,
} from '@/lib/research/pipeline-controller';
import {
  buildCompetitorContext,
  buildIcpContext,
  buildIndustryContext,
  buildKeywordContext,
  buildOfferContext,
  buildSynthesisContext,
} from '@/lib/research/pipeline-context';
import { PIPELINE_SECTION_CONFIG, type PipelineSectionId } from '@/lib/research/pipeline-types';
import { createAdminClient } from '@/lib/supabase/server';

const advancePipelineRequestSchema = z.object({
  runId: z.string().min(1),
});

function createJsonErrorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getSectionResult(
  researchResults: Record<string, unknown>,
  sectionId: PipelineSectionId,
): { data: Record<string, unknown> } {
  const result = researchResults[sectionId];

  if (!isRecord(result) || !isRecord(result.data)) {
    return { data: {} };
  }

  return { data: result.data };
}

function buildContextForSection(
  sectionId: PipelineSectionId,
  onboardingData: Record<string, unknown>,
  researchResults: Record<string, unknown>,
): string {
  switch (sectionId) {
    case 'industryResearch':
      return buildIndustryContext(onboardingData);
    case 'competitorIntel':
      return buildCompetitorContext({
        onboardingData,
        industryResearch: getSectionResult(researchResults, 'industryResearch'),
      });
    case 'icpValidation':
      return buildIcpContext({
        onboardingData,
        industryResearch: getSectionResult(researchResults, 'industryResearch'),
        competitorIntel: getSectionResult(researchResults, 'competitorIntel'),
      });
    case 'offerAnalysis':
      return buildOfferContext({
        onboardingData,
        industryResearch: getSectionResult(researchResults, 'industryResearch'),
        competitorIntel: getSectionResult(researchResults, 'competitorIntel'),
        icpValidation: getSectionResult(researchResults, 'icpValidation'),
      });
    case 'strategicSynthesis':
      return buildSynthesisContext({
        onboardingData,
        industryResearch: getSectionResult(researchResults, 'industryResearch'),
        competitorIntel: getSectionResult(researchResults, 'competitorIntel'),
        icpValidation: getSectionResult(researchResults, 'icpValidation'),
        offerAnalysis: getSectionResult(researchResults, 'offerAnalysis'),
      });
    case 'keywordIntel':
      return buildKeywordContext({
        onboardingData,
        industryResearch: getSectionResult(researchResults, 'industryResearch'),
        competitorIntel: getSectionResult(researchResults, 'competitorIntel'),
        icpValidation: getSectionResult(researchResults, 'icpValidation'),
        offerAnalysis: getSectionResult(researchResults, 'offerAnalysis'),
        strategicSynthesis: getSectionResult(researchResults, 'strategicSynthesis'),
      });
    default: {
      const exhaustiveCheck: never = sectionId;
      throw new Error(`Unknown pipeline section: ${exhaustiveCheck}`);
    }
  }
}

async function readPipelineSessionContext(userId: string): Promise<{
  onboardingData: Record<string, unknown>;
  researchResults: Record<string, unknown>;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('metadata, research_results')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(
      `Failed to read journey session context for user ${userId}: ${error.message}`,
    );
  }

  const metadata = isRecord(data?.metadata) ? data.metadata : {};
  const researchResults = isRecord(data?.research_results)
    ? data.research_results
    : {};

  return {
    onboardingData: isRecord(metadata.onboardingData) ? metadata.onboardingData : {},
    researchResults,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return createJsonErrorResponse('Unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createJsonErrorResponse('Invalid JSON body', 400);
  }

  const parsedBody = advancePipelineRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return createJsonErrorResponse('Invalid request body: runId is required', 400);
  }

  const { runId } = parsedBody.data;

  let pipelineState;
  try {
    pipelineState = await readPipelineState(userId);
  } catch (error) {
    return createJsonErrorResponse(getErrorMessage(error), 500);
  }

  if (!pipelineState || pipelineState.runId !== runId) {
    return createJsonErrorResponse('Run not found or mismatch', 404);
  }

  if (!pipelineState.currentSectionId) {
    return createJsonErrorResponse('No active section', 409);
  }

  const currentSection = pipelineState.sections.find(
    (section) => section.id === pipelineState.currentSectionId,
  );
  const currentStatus = currentSection?.status ?? 'unknown';
  if (!currentSection || currentSection.status !== 'complete') {
    return createJsonErrorResponse(
      `Section ${pipelineState.currentSectionId} is ${currentStatus}, not complete`,
      409,
    );
  }

  let approvedState = markSectionApproved(
    pipelineState,
    pipelineState.currentSectionId,
  );
  const nextSectionId = getNextSectionId(approvedState.approvedSectionIds);

  if (!nextSectionId) {
    const completeState = {
      ...approvedState,
      status: 'complete' as const,
      currentSectionId: null,
    };

    try {
      await persistPipelineState(userId, completeState);
    } catch (error) {
      return createJsonErrorResponse(
        `Failed to persist completed pipeline state for user ${userId} and run ${runId}: ${getErrorMessage(error)}`,
        500,
      );
    }

    return NextResponse.json({ status: 'complete', runId });
  }

  let sessionContext;
  try {
    sessionContext = await readPipelineSessionContext(userId);
  } catch (error) {
    return createJsonErrorResponse(getErrorMessage(error), 500);
  }

  const config = PIPELINE_SECTION_CONFIG[nextSectionId];
  const context = buildContextForSection(
    nextSectionId,
    sessionContext.onboardingData,
    sessionContext.researchResults,
  );
  const dispatchResult = await dispatchResearchForUser(
    config.toolName,
    config.boundaryKey,
    context,
    userId,
    { activeRunId: runId },
  );

  if (dispatchResult.status === 'error') {
    const errorState = {
      ...approvedState,
      status: 'error' as const,
      sections: approvedState.sections.map((section) =>
        section.id === nextSectionId
          ? {
              ...section,
              status: 'error' as const,
              error: dispatchResult.error ?? 'Dispatch failed',
            }
          : section,
      ),
    };

    try {
      await persistPipelineState(userId, errorState);
    } catch (error) {
      return createJsonErrorResponse(
        `Failed to persist pipeline error state for user ${userId} and run ${runId}: ${getErrorMessage(error)}`,
        500,
      );
    }

    return createJsonErrorResponse(
      dispatchResult.error ?? 'Dispatch failed',
      500,
    );
  }

  const runningState = markSectionRunning(
    approvedState,
    nextSectionId,
    dispatchResult.jobId ?? runId,
  );

  try {
    await persistPipelineState(userId, runningState);
  } catch (error) {
    return createJsonErrorResponse(
      `Failed to persist advanced pipeline state for user ${userId} and run ${runId}: ${getErrorMessage(error)}`,
      500,
    );
  }

  return NextResponse.json({
    status: 'advanced',
    runId,
    section: nextSectionId,
  });
}
