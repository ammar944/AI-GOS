// POST /api/journey/stream
// Streaming chat endpoint for the v2 journey experience.
// Uses Claude Opus 4.6 with adaptive thinking for conversational strategy sessions.

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';
import { askUser } from '@/lib/ai/tools/ask-user';
import { extractAskUserResults, persistToSupabase } from '@/lib/journey/session-state';

export const maxDuration = 300;

interface JourneyStreamRequest {
  messages: UIMessage[];
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse request ───────────────────────────────────────────────────────
  const body: JourneyStreamRequest = await request.json();

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: 'messages array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Sanitize messages ───────────────────────────────────────────────────
  // Strip tool parts that never completed to prevent MissingToolResultsError
  // when convertToModelMessages encounters tool calls without results.
  const INCOMPLETE_TOOL_STATES = new Set([
    'input-streaming',
    'input-available',
    'approval-requested',
  ]);

  const sanitizedMessages = body.messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => {
      if (
        typeof part === 'object' &&
        'type' in part &&
        typeof part.type === 'string' &&
        part.type.startsWith('tool-') &&
        part.type !== 'tool-invocation'
      ) {
        const state = (part as Record<string, unknown>).state as string | undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) {
          return false; // Drop incomplete tool parts
        }
      }
      return true;
    }),
  })) as UIMessage[];

  // ── Persist askUser results from previous round trips ──────────────────
  const askUserFields = extractAskUserResults(body.messages);
  if (Object.keys(askUserFields).length > 0) {
    // Fire-and-forget — do not await, do not block the response
    persistToSupabase(userId, askUserFields).catch(() => {
      // Already handled internally with console.error
    });
  }

  // ── Stream ──────────────────────────────────────────────────────────────
  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: LEAD_AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(sanitizedMessages),
    tools: { askUser },
    stopWhen: stepCountIs(15),
    temperature: 0.3,
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
      },
    },
    onFinish: async ({ usage, steps }) => {
      console.log('[journey] stream finished', {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        steps: steps.length,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
