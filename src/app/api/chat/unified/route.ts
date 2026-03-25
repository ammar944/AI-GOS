// POST /api/chat/unified
// Unified chat endpoint that branches on `mode` to power normal chat,
// extended thinking, and live Perplexity research — all via a single route.
//
// REQUEST FLOW:
// Frontend → POST /api/chat/unified
//   body: { mode, section, cardContext, activeRunId }
//     ↓
// mode=normal   → Claude Opus (thinking enabled, 5K budget) + tools
// mode=thinking → Claude Opus (thinking enabled, 10K budget) + tools
// mode=research → Perplexity Sonar Pro (sanitized msgs, no tools)
//     ↓
// All modes → toUIMessageStreamResponse() → Frontend

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { z } from 'zod';
import { auth, currentUser } from '@clerk/nextjs/server';
import { anthropic, perplexity, MODELS } from '@/lib/ai/providers';
import { editCard } from '@/lib/ai/tools/edit-card';
import { getActiveProfile, buildProfileContext } from '@/lib/profiles/business-profiles';

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const CardContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  firstParagraph: z.string(),
  fields: z.array(z.string()).optional(),
});

const UnifiedChatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  mode: z.enum(['normal', 'thinking', 'research']),
  section: z.string(),
  cardContext: z.array(CardContextSchema).optional(),
  activeRunId: z.string(),
});

type CardContext = z.infer<typeof CardContextSchema>;

// ---------------------------------------------------------------------------
// Tool registry — keyed by section, returns tools appropriate for that section
// ---------------------------------------------------------------------------

const RESEARCH_SECTIONS = new Set([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
  'mediaPlan',
]);

function hasSectionTools(section: string): boolean {
  return RESEARCH_SECTIONS.has(section);
}

// ---------------------------------------------------------------------------
// System prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  section: string,
  cardContext: CardContext[] | undefined,
  profileCtx?: string,
): string {
  const lines: string[] = [
    'You are a senior paid media strategist embedded inside AI-GOS, a strategic research and planning platform.',
    'You help users understand, refine, and improve their research artifacts.',
    '',
    `## Current Section: ${section}`,
    '',
    'When the user asks to change or improve something in the research, use the `editCard` tool to propose the change.',
    'Always explain what you are changing and why before proposing an edit.',
    'Keep responses focused, direct, and grounded in the data.',
    '',
    '## editCard Field Conventions',
    '- For text/string fields: use the field name directly (e.g. `field: "text"`, `newValue: "new text"`).',
    '- For stat-grid cards (fields containing stats): use dot notation to target a specific stat: `field: "stats.Category"` with `newValue: "New Category Value"` (a plain string).',
    '- For list fields (items): pass the complete updated array as `newValue`.',
    '- Always use the card `id` from the context below.',
  ];

  if (profileCtx) {
    lines.push('', profileCtx);
  }

  if (cardContext && cardContext.length > 0) {
    lines.push('', '## Research Cards in View');
    lines.push('');
    lines.push('The following cards are currently visible to the user:');
    lines.push('');
    for (const card of cardContext) {
      lines.push(`### ${card.title} [id=${card.id}]`);
      if (card.fields && card.fields.length > 0) {
        lines.push(`Fields: ${card.fields.join(', ')}`);
      }
      lines.push(card.firstParagraph);
      lines.push('');
    }
    lines.push(
      'Reference these cards by their `id` when calling `editCard`. Only propose edits to cards the user explicitly asks to change.',
    );
    lines.push('');
    lines.push('**Example:** To change the Category stat in a stat-grid card, call `editCard` with `field: "stats.Category"`, `newValue: "New Value"`, and the card `id`.');
  }

  return lines.join('\n');
}

function buildResearchSystemPrompt(
  section: string,
  cardContext: CardContext[] | undefined,
  profileCtx?: string,
): string {
  const lines: string[] = [
    'You are a research assistant with real-time web access embedded inside AI-GOS.',
    'Your role is to answer questions about current market conditions, competitors, trends, and industry data.',
    '',
    `## Current Section: ${section}`,
    '',
    'Use your web search capabilities to provide accurate, up-to-date information.',
    'Cite your sources. Be concise and specific — the user is a performance marketer, not a casual reader.',
  ];

  if (profileCtx) {
    lines.push('', profileCtx);
  }

  if (cardContext && cardContext.length > 0) {
    lines.push('', '## Research Context');
    lines.push('');
    lines.push('The user is currently viewing this research:');
    lines.push('');
    for (const card of cardContext) {
      lines.push(`### ${card.title}`);
      lines.push(card.firstParagraph);
      lines.push('');
    }
    lines.push('Use this as context when answering questions.');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Message sanitizers
// ---------------------------------------------------------------------------

const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
]);

/**
 * Sanitize messages for Claude:
 * - Strip incomplete tool parts (prevents MissingToolResultsError)
 * - Strip thinking/reasoning parts from non-latest assistant messages
 * - Strip Perplexity [1][2] citation markers from assistant text
 */
function sanitizeForClaude(messages: UIMessage[]): UIMessage[] {
  const CITATION_RE = /\[\d+\]/g;

  // Collect all tool call IDs that have a matching result
  const resolvedToolCallIds = new Set<string>();
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (typeof part === 'object' && part !== null && 'type' in part) {
        const typed = part as Record<string, unknown>;
        // tool-result parts have a toolCallId linking back to the invocation
        if (typed.type === 'tool-result' && typeof typed.toolCallId === 'string') {
          resolvedToolCallIds.add(typed.toolCallId);
        }
      }
    }
  }

  return messages.map((msg) => {
    const filteredParts = msg.parts.filter((part) => {
      if (typeof part !== 'object' || part === null || !('type' in part)) return true;
      const typed = part as Record<string, unknown>;
      const type = typeof typed.type === 'string' ? typed.type : '';

      // Drop ALL incomplete/unresolved tool invocations (prevents MissingToolResultsError)
      if (type === 'tool-invocation') {
        const toolCallId = typeof typed.toolCallId === 'string' ? typed.toolCallId : '';
        const state = typeof typed.state === 'string' ? typed.state : '';
        // Keep only tool invocations that have a matching result OR are fully resolved
        if (state !== 'result' && !resolvedToolCallIds.has(toolCallId)) {
          return false;
        }
      }

      // Drop incomplete tool parts with pending states
      if (type.startsWith('tool-')) {
        const state = typeof typed.state === 'string' ? typed.state : undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) return false;
      }

      // Drop thinking/redacted_thinking parts (unsupported on replay)
      if (type === 'thinking' || type === 'redacted_thinking') return false;

      return true;
    });

    // Strip Perplexity citation markers from assistant text parts
    const cleanedParts = filteredParts.map((part) => {
      if (
        msg.role === 'assistant' &&
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        (part as Record<string, unknown>).type === 'text' &&
        typeof (part as Record<string, unknown>).text === 'string'
      ) {
        const typed = part as Record<string, unknown>;
        return {
          ...typed,
          text: (typed.text as string).replace(CITATION_RE, ''),
        };
      }
      return part;
    });

    return { ...msg, parts: cleanedParts } as UIMessage;
  });
}

/**
 * Sanitize messages for Perplexity:
 * - Text-only user/assistant turns
 * - Strip tool parts, reasoning blocks, and any non-text content
 */
function sanitizeForPerplexity(messages: UIMessage[]): UIMessage[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => {
      const textParts = msg.parts.filter((part) => {
        if (typeof part !== 'object' || part === null || !('type' in part)) return false;
        const typed = part as Record<string, unknown>;
        return typeof typed.type === 'string' && typed.type === 'text';
      });

      return {
        ...msg,
        parts: textParts,
      } as UIMessage;
    })
    .filter((msg) => msg.parts.length > 0);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Auth
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const parsed = UnifiedChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { mode, section, cardContext, activeRunId } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];

  console.log('[chat/unified] request', { userId, mode, section, activeRunId, cardCount: cardContext?.length ?? 0, cardIds: cardContext?.map(c => c.id) });

  // Load business profile + user name for system prompt injection
  const [profile, clerkUser] = await Promise.all([
    getActiveProfile(userId).catch(() => null),
    currentUser().catch(() => null),
  ]);
  const userName = clerkUser?.firstName ?? clerkUser?.username ?? undefined;
  const profileContext = profile ? buildProfileContext(profile, userName) : '';

  // Research mode: Perplexity Sonar Pro — no tools
  if (mode === 'research') {
    if (!process.env.PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'research_unavailable',
          message: 'Research mode unavailable — Perplexity API key not configured',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const sanitized = sanitizeForPerplexity(messages);

    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(sanitized);
    } catch (err) {
      console.error('[chat/unified] convertToModelMessages error (research)', err);
      return new Response(
        JSON.stringify({ error: 'Failed to process message history' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = buildResearchSystemPrompt(section, cardContext, profileContext);

    try {
      const result = streamText({
        model: perplexity(MODELS.SONAR_PRO),
        system: systemPrompt,
        messages: modelMessages,
        maxOutputTokens: 4096,
        onFinish: ({ usage }) => {
          console.log('[chat/unified] research finished', {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          });
        },
      });

      return result.toUIMessageStreamResponse();
    } catch (err) {
      console.error('[chat/unified] Perplexity stream error', err);
      return new Response(
        JSON.stringify({ error: 'research_unavailable', message: 'Research request failed' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Normal / thinking mode: Claude Opus with tool calling
  const budgetTokens = mode === 'thinking' ? 10000 : 5000;
  const sanitized = sanitizeForClaude(messages);

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(sanitized);
  } catch (err) {
    console.error('[chat/unified] convertToModelMessages error (claude)', err);
    return new Response(
      JSON.stringify({ error: 'Failed to process message history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const systemPrompt = buildSystemPrompt(section, cardContext, profileContext);
  const useSectionTools = hasSectionTools(section);

  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: systemPrompt,
    messages: modelMessages,
    ...(useSectionTools ? { tools: { editCard } } : {}),
    stopWhen: stepCountIs(10),
    maxRetries: 0,
    providerOptions: {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens,
        },
      },
    },
    onFinish: ({ usage, steps }) => {
      console.log('[chat/unified] claude finished', {
        mode,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        steps: steps.length,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
