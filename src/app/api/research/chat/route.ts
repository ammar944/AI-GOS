import { auth } from '@clerk/nextjs/server';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MODELS, anthropic } from '@/lib/ai/providers';
import {
  persistPipelineState,
  readPipelineState,
} from '@/lib/journey/session-state.server';
import { normalizeResearchSectionId } from '@/lib/journey/research-sections';
import { invalidateDownstream } from '@/lib/research/pipeline-controller';
import {
  PIPELINE_SECTION_CONFIG,
  PIPELINE_SECTION_ORDER,
  type PipelineSectionId,
} from '@/lib/research/pipeline-types';
import {
  applyEditedSectionData,
  mergeSectionResult,
} from '@/lib/research/section-edits';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
]);

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  parts: z.array(z.object({}).passthrough()),
}).passthrough();

const researchChatRequestSchema = z.object({
  runId: z.string().trim().min(1),
  sectionId: z.enum(PIPELINE_SECTION_ORDER),
  messages: z.array(uiMessageSchema),
});

function buildSystemPrompt(
  sectionDisplayName: string,
  sectionData: Record<string, unknown>,
): string {
  const serializedData = JSON.stringify(sectionData, null, 2);
  const currentData =
    serializedData.length > 4000
      ? `${serializedData.slice(0, 4000)}\n...`
      : serializedData;

  return `You are refining the "${sectionDisplayName}" section of a research blueprint.

Current section data:
${currentData}

Stay scoped to this section. Be concise. When the user asks for a change, call editSection with only the fields that need to change.`;
}

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => {
      if (
        typeof part === 'object' &&
        'type' in part &&
        typeof part.type === 'string' &&
        part.type.startsWith('tool-') &&
        part.type !== 'tool-invocation'
      ) {
        const state = (part as Record<string, unknown>).state;
        if (typeof state === 'string' && INCOMPLETE_TOOL_STATES.has(state)) {
          return false;
        }
      }

      return true;
    }),
  })) as UIMessage[];
}

async function readResearchResultsForUser(
  userId: string,
): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to read research results: ${error.message}`);
  }

  return (
    (data?.research_results as Record<string, unknown> | null | undefined) ?? {}
  );
}

export async function POST(request: Request): Promise<Response> {
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

  const parsed = researchChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'messages, runId, and sectionId are required' },
      { status: 400 },
    );
  }

  const { messages, runId, sectionId } = parsed.data;

  try {
    const pipelineState = await readPipelineState(userId);
    if (!pipelineState || pipelineState.runId !== runId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const canonicalSectionId = normalizeResearchSectionId(sectionId);
    if (!canonicalSectionId || canonicalSectionId === 'mediaPlan') {
      return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 });
    }

    const researchResults = await readResearchResultsForUser(userId);
    const { mergedData: sectionData } = mergeSectionResult(
      researchResults,
      canonicalSectionId,
      runId,
      {},
    );
    const sectionConfig = PIPELINE_SECTION_CONFIG[canonicalSectionId];
    const sanitizedMessages = sanitizeMessages(messages as unknown as UIMessage[]);

    const result = streamText({
      model: anthropic(MODELS.CLAUDE_SONNET),
      system: buildSystemPrompt(sectionConfig.displayName, sectionData),
      messages: await convertToModelMessages(sanitizedMessages),
      tools: {
        editSection: tool({
          description: 'Update the current research section data based on user feedback',
          inputSchema: z.object({
            sectionId: z.enum(PIPELINE_SECTION_ORDER),
            updates: z.record(z.string(), z.unknown()),
            summary: z.string(),
          }),
          execute: async ({ sectionId: editSectionId, updates, summary }) => {
            const normalizedSectionId = normalizeResearchSectionId(editSectionId);
            if (!normalizedSectionId || normalizedSectionId === 'mediaPlan') {
              throw new Error(`Invalid sectionId: ${editSectionId}`);
            }

            const latestResearchResults = await readResearchResultsForUser(userId);
            const { mergedData, mergedResult } = mergeSectionResult(
              latestResearchResults,
              normalizedSectionId,
              runId,
              updates,
            );

            const supabase = createAdminClient();
            const { error: writeError } = await supabase.rpc(
              'merge_journey_session_research_result',
              {
                p_user_id: userId,
                p_section: normalizedSectionId,
                p_result: mergedResult,
              },
            );

            if (writeError) {
              throw new Error(
                `Failed to persist section update: ${writeError.message}`,
              );
            }

            const latestPipelineState = await readPipelineState(userId);
            if (!latestPipelineState || latestPipelineState.runId !== runId) {
              throw new Error(`Run mismatch while editing section ${normalizedSectionId}`);
            }

            const updatedState = applyEditedSectionData(
              latestPipelineState,
              normalizedSectionId as PipelineSectionId,
              mergedData,
            );
            const invalidatedState = invalidateDownstream(
              updatedState,
              normalizedSectionId as PipelineSectionId,
            );
            await persistPipelineState(userId, invalidatedState);

            return {
              status: 'updated',
              sectionId: normalizedSectionId,
              data: mergedData,
              summary,
            };
          },
        }),
      },
      stopWhen: stepCountIs(3),
      temperature: 0.3,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected research chat error';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
