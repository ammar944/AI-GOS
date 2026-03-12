import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  persistPipelineState,
  readPipelineState,
} from '@/lib/journey/session-state.server';
import { normalizeResearchSectionId } from '@/lib/journey/research-sections';
import { createAdminClient } from '@/lib/supabase/server';
import { invalidateDownstream } from '@/lib/research/pipeline-controller';
import { PIPELINE_SECTION_ORDER, type PipelineSectionId } from '@/lib/research/pipeline-types';
import {
  applyEditedSectionData,
  mergeSectionResult,
} from '@/lib/research/section-edits';

const patchSectionRequestSchema = z.object({
  runId: z.string().trim().min(1),
  sectionId: z.enum(PIPELINE_SECTION_ORDER),
  updates: z.record(z.string(), z.unknown()),
});

export async function PATCH(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = patchSectionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'runId, sectionId, updates required' },
      { status: 400 },
    );
  }

  const { runId, sectionId, updates } = parsed.data;

  try {
    const pipelineState = await readPipelineState(userId);
    if (!pipelineState || pipelineState.runId !== runId) {
      return NextResponse.json(
        { error: 'Run not found or mismatch' },
        { status: 404 },
      );
    }

    const canonicalSectionId = normalizeResearchSectionId(sectionId);
    if (!canonicalSectionId || canonicalSectionId === 'mediaPlan') {
      return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: sessionData, error: sessionError } = await supabase
      .from('journey_sessions')
      .select('research_results')
      .eq('user_id', userId)
      .single();

    if (sessionError) {
      return NextResponse.json(
        { error: `Failed to read research results: ${sessionError.message}` },
        { status: 500 },
      );
    }

    const { mergedData, mergedResult } = mergeSectionResult(
      (sessionData?.research_results as Record<string, unknown> | null | undefined) ?? {},
      canonicalSectionId,
      runId,
      updates,
    );

    const { error: writeError } = await supabase.rpc(
      'merge_journey_session_research_result',
      {
        p_user_id: userId,
        p_section: canonicalSectionId,
        p_result: mergedResult,
      },
    );

    if (writeError) {
      return NextResponse.json(
        { error: `Failed to persist section update: ${writeError.message}` },
        { status: 500 },
      );
    }

    const updatedState = applyEditedSectionData(
      pipelineState,
      canonicalSectionId as PipelineSectionId,
      mergedData,
    );
    const invalidatedState = invalidateDownstream(
      updatedState,
      canonicalSectionId as PipelineSectionId,
    );
    await persistPipelineState(userId, invalidatedState);

    return NextResponse.json({
      status: 'updated',
      sectionId: canonicalSectionId,
      data: mergedData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected section update error';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
