import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { persistPipelineState } from '@/lib/journey/session-state.server';
import {
  createInitialPipelineState,
  markSectionRunning,
} from '@/lib/research/pipeline-controller';
import { buildIndustryContext } from '@/lib/research/pipeline-context';

const startPipelineRequestSchema = z.object({
  onboardingData: z.record(z.string(), z.unknown()),
});

function createJsonErrorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function createStartErrorState(runId: string) {
  return {
    ...createInitialPipelineState(runId),
    status: 'error' as const,
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

  const parsedBody = startPipelineRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return createJsonErrorResponse(
      'Invalid request body: onboardingData is required',
      400,
    );
  }

  const { onboardingData } = parsedBody.data;
  const runId = crypto.randomUUID();
  const firstSectionId = 'industryResearch';
  const initialState = createInitialPipelineState(runId);
  const context = buildIndustryContext(onboardingData);
  const dispatchResult = await dispatchResearchForUser(
    'researchIndustry',
    'industryMarket',
    context,
    userId,
    { activeRunId: runId },
  );

  if (dispatchResult.status === 'error') {
    const errorState = createStartErrorState(runId);

    try {
      await persistPipelineState(userId, errorState);
    } catch (error) {
      return createJsonErrorResponse(
        `Failed to persist pipeline start error state for user ${userId} and run ${runId}: ${getErrorMessage(error)}`,
        500,
      );
    }

    return createJsonErrorResponse(
      dispatchResult.error ?? 'Failed to dispatch industry research',
      500,
    );
  }

  const runningState = markSectionRunning(
    initialState,
    firstSectionId,
    dispatchResult.jobId ?? runId,
  );

  try {
    await persistPipelineState(userId, runningState, { onboardingData });
  } catch (error) {
    return createJsonErrorResponse(
      `Failed to persist pipeline start state for user ${userId} and run ${runId}: ${getErrorMessage(error)}`,
      500,
    );
  }

  return NextResponse.json({
    status: 'started',
    runId,
    section: firstSectionId,
  });
}
