// POST /api/chat/unified
// Unified chat endpoint that branches on `mode` to power the four chat surfaces:
//   - standard    → Sonnet, editCard + updateField, no thinking
//   - thinking    → Opus, no tools, extended thinking 10K budget
//   - refine-card → Sonnet, editCard forced, no thinking (optional explicit mode)
//   - research    → Perplexity Sonar Pro, no tools (unchanged)
//
// REQUEST FLOW:
// Frontend → POST /api/chat/unified
//   body: { mode, section, cardContext, activeRunId }
//     ↓
// MODE_CONFIG resolves model, tools, thinking budget, and system-prompt fragment
//     ↓
// System prompt assembled as [stable prefix (cached) + dynamic suffix] and
// passed as a multi-part `system` array with an Anthropic cache breakpoint so
// persona + behavioral contract + tool conventions + profile context are
// cached between turns of the same session.
//     ↓
// All modes → toUIMessageStreamResponse() → Frontend

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { z } from 'zod';
import { auth, currentUser } from '@clerk/nextjs/server';
import { anthropic, perplexity, MODELS } from '@/lib/ai/providers';
import { editCard } from '@/lib/ai/tools/edit-card';
import { updateField } from '@/lib/ai/tools/update-field';
import { getActiveProfile, buildProfileContext } from '@/lib/profiles/business-profiles';
import {
  buildResearchContext,
  type ResearchSection,
} from '@/lib/workspace/context-builder';

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Model IDs (locked gates — spec 2026-04-20)
// ---------------------------------------------------------------------------
// Hardcoded rather than added to global MODELS map (out of scope for A1).
// If MODELS is updated later, swap the literals for the named constant.
const MODEL_SONNET_CHAT = 'claude-sonnet-4-6';
const MODEL_OPUS_THINKING = 'claude-opus-4-7';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const CardContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  firstParagraph: z.string(),
  fields: z.array(z.string()).optional(),
});

// Accept 'normal' as a deprecated alias so B1/B2 frontend changes can land
// independently. The alias is normalized to 'standard' at the top of the
// handler with a console.warn.
const UnifiedChatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  mode: z.enum(['normal', 'standard', 'thinking', 'refine-card', 'research']),
  section: z.string(),
  cardContext: z.array(CardContextSchema).optional(),
  activeRunId: z.string(),
  // A2: optional runId for research evidence injection. `activeRunId` above
  // is the frontend's notion of the current UI-level run; `runId` is the
  // session `run_id` that research_telemetry / journey_sessions rows key
  // off of. They're usually the same value, but the frontend passes both
  // so the backend doesn't have to guess. Nullable so old clients still work.
  runId: z.string().nullable().optional(),
});

type CardContext = z.infer<typeof CardContextSchema>;
type ChatMode = 'standard' | 'thinking' | 'refine-card' | 'research';

// ---------------------------------------------------------------------------
// Mode routing
// ---------------------------------------------------------------------------

interface ModeConfigEntry {
  model: string;
  tools: 'all' | 'none';
  thinkingBudgetTokens: number | null;
  systemPromptFragment: string;
}

const MODE_CONFIG: Record<ChatMode, ModeConfigEntry> = {
  standard: {
    model: MODEL_SONNET_CHAT,
    tools: 'all',
    thinkingBudgetTokens: null,
    systemPromptFragment:
      '## Mode: Standard Chat\n' +
      'Answer the user directly. Only call `editCard` when the user explicitly asks to change a card. Do not volunteer edits.',
  },
  thinking: {
    model: MODEL_OPUS_THINKING,
    tools: 'none',
    thinkingBudgetTokens: 10000,
    systemPromptFragment:
      '## Mode: Extended Thinking\n' +
      'Read-only reasoning mode. Do NOT call tools. The user wants your analysis of the research in view. Reason step by step, cite card IDs in brackets like `[card:<id>]` when referencing specific evidence, and deliver a structured answer.',
  },
  'refine-card': {
    model: MODEL_SONNET_CHAT,
    tools: 'all',
    thinkingBudgetTokens: null,
    systemPromptFragment:
      '## Mode: Refine Card\n' +
      'You are refining a specific card. The user\'s message contains a `[card:<id>]` tag identifying the target card. Extract that id and call `editCard` with that `cardId` and only the field the user asked to change. Do NOT edit other cards. Do NOT refactor unrelated fields. One-sentence `explanation` that names what changed and why.',
  },
  research: {
    // Research mode is handled by a separate branch (Perplexity). Model id
    // here is informational only — the handler uses MODELS.SONAR_PRO.
    model: MODELS.SONAR_PRO,
    tools: 'none',
    thinkingBudgetTokens: null,
    systemPromptFragment: '',
  },
};

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

// Mirror of the `ResearchSection` union in `src/lib/workspace/context-builder.ts`.
// Includes `identityResolution` (not in RESEARCH_SECTIONS because it doesn't
// carry card-edit tools, but its telemetry payload is still useful context).
const KNOWN_RESEARCH_SECTIONS = new Set<string>([
  'identityResolution',
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
  'mediaPlan',
]);

function hasSectionTools(section: string): boolean {
  return RESEARCH_SECTIONS.has(section);
}

/**
 * Resolve the tool map for a given mode + section.
 * - 'none'  → no tools (thinking, research)
 * - 'all'   → editCard + updateField (standard, refine-card)
 *
 * `refine-card` intentionally keeps updateField available — a refine request
 * can escalate into a profile update if the user says "update my value prop
 * to match". Gating it out would force mode-switching mid-conversation.
 */
function resolveTools(mode: ChatMode, section: string) {
  const cfg = MODE_CONFIG[mode];
  if (cfg.tools === 'none') return undefined;
  if (!hasSectionTools(section)) return undefined;
  return { editCard, updateField };
}

// ---------------------------------------------------------------------------
// System prompt builders
// ---------------------------------------------------------------------------

// Stable prefix: persona + behavioral contract + tool conventions + profile.
// This block is cacheable via Anthropic prompt caching — it does not change
// within a conversation.
function buildStablePrefix(profileCtx: string | undefined): string {
  const lines: string[] = [
    '## Persona',
    'You are a senior paid media strategist embedded inside AIGOS. You speak to a performance marketer, not a casual reader. Assume domain fluency.',
    '',
    '## Behavioral Contract',
    '- Be direct. Start with the answer or the action. No fluff openers like "Great question", "Excellent idea", or "I\'d be happy to". If the user\'s premise is wrong, say so before doing the work.',
    '- If you do not have data to support a claim, say so explicitly. Never invent statistics, pricing, revenue figures, market share numbers, or company facts.',
    '- When asserting a fact about a company, market, or competitor, cite the research card id in brackets (format: `[card:<id>]`), or explicitly state "from your profile" when the fact comes from the business profile context. If no source exists, mark the claim as your best inference.',
    '- Surgical changes only. If the user asks to edit a specific field, change only that field. Never drive-by refactor unrelated fields.',
    '- Prefer deletion and concision. Two or three short paragraphs usually beat a long list.',
    '',
    '## Tool Conventions',
    '',
    '### `editCard`',
    '- Call `editCard` only when the user explicitly asks to change a card.',
    '- For text/string fields: `field: "text"`, `newValue: "<new text>"`.',
    '- For stat-grid cards: use dot notation — `field: "stats.Category"`, `newValue: "<new value as string>"`.',
    '- For list fields (items): pass the complete updated array as `newValue`.',
    '- Always use the card `id` from the card context block below.',
    '- One-sentence `explanation` naming what changed and why.',
    '',
    '### `updateField`',
    '- Propose an update to the user\'s onboarding profile (source-of-truth for their business). User must accept or reject the proposal — do not assume it is applied.',
    '- Call only when the user explicitly asks to update their offer, ICP, pricing, value prop, or another onboarding field. Never on casual questions.',
    '- One-sentence `reason` explaining why this change improves the offer.',
  ];

  if (profileCtx) {
    lines.push('', profileCtx);
  }

  return lines.join('\n');
}

// Dynamic suffix: card context + research evidence + mode-specific fragment.
// Not cached — these change per turn and per run.
function buildDynamicSuffix(
  section: string,
  cardContext: CardContext[] | undefined,
  modeFragment: string,
  researchBlocks?: {
    researchEvidence: string;
    documentExcerpts: string;
    meetingInsights: string;
  },
): string {
  const lines: string[] = [
    `## Current Section: ${section}`,
  ];

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
  }

  // A2: Research evidence injection. Three optional blocks sourced by
  // buildResearchContext() — telemetry extras, uploaded docs, sales calls.
  // Each block is already internally truncated by the context-builder.
  if (researchBlocks) {
    for (const block of [
      researchBlocks.researchEvidence,
      researchBlocks.documentExcerpts,
      researchBlocks.meetingInsights,
    ]) {
      if (block) {
        lines.push('', block);
      }
    }
  }

  if (modeFragment) {
    lines.push('', modeFragment);
  }

  return lines.join('\n');
}

function buildResearchSystemPrompt(
  section: string,
  cardContext: CardContext[] | undefined,
  profileCtx?: string,
): string {
  const lines: string[] = [
    'You are a research assistant with real-time web access embedded inside AIGOS.',
    'Your role is to answer questions about current market conditions, competitors, trends, and industry data.',
    '',
    '## Behavioral Contract',
    '- Be direct. Start with the answer. No fluff openers.',
    '- Never fabricate statistics, pricing, or company facts. If sources disagree, say so.',
    '- Cite every non-trivial claim with its source URL. Prefer primary sources.',
    '- If you cannot find data, say "I could not find a verified source for this" — never guess.',
    '',
    `## Current Section: ${section}`,
    '',
    'Use your web search capabilities to provide accurate, up-to-date information. Be concise and specific — the user is a performance marketer.',
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

  const { section, cardContext, activeRunId } = parsed.data;
  const runId = parsed.data.runId ?? activeRunId ?? null;
  const rawMode = parsed.data.mode;
  const messages = parsed.data.messages as UIMessage[];

  // Normalize deprecated 'normal' → 'standard' (back-compat for B1/B2 rollout).
  let mode: ChatMode;
  if (rawMode === 'normal') {
    console.warn('[chat/unified] deprecated mode="normal" received; normalizing to "standard"');
    mode = 'standard';
  } else {
    mode = rawMode;
  }

  console.log('[chat/unified] request', {
    userId,
    mode,
    rawMode,
    section,
    activeRunId,
    cardCount: cardContext?.length ?? 0,
    cardIds: cardContext?.map((c) => c.id),
  });

  // Load business profile + user name for system prompt injection
  const [profile, clerkUser] = await Promise.all([
    getActiveProfile(userId).catch(() => null),
    currentUser().catch(() => null),
  ]);
  const userName = clerkUser?.firstName ?? clerkUser?.username ?? undefined;
  const profileContext = profile ? buildProfileContext(profile, userName) : '';

  // Research mode: Perplexity Sonar Pro — no tools, no cache (Perplexity has
  // no Anthropic-style prompt cache). Unchanged behavior.
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
          console.log('[chat-cache]', {
            mode,
            provider: 'perplexity',
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
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

  // Claude branches (standard / thinking / refine-card)
  const cfg = MODE_CONFIG[mode];
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

  const stablePrefix = buildStablePrefix(profileContext);

  // A2: Build research evidence context. Claude branches only — Perplexity
  // has its own live web search. Mode-gated to standard/thinking/refine-card
  // (the Claude modes); research mode returned above. The context-builder
  // swallows per-source errors internally, so this call never throws.
  // runId may be null (old clients); context-builder handles that.
  const researchSection = KNOWN_RESEARCH_SECTIONS.has(section)
    ? (section as ResearchSection)
    : null;
  const researchContext = await buildResearchContext({
    userId,
    runId,
    section: researchSection,
  });

  const dynamicSuffix = buildDynamicSuffix(
    section,
    cardContext,
    cfg.systemPromptFragment,
    {
      researchEvidence: researchContext.researchEvidence,
      documentExcerpts: researchContext.documentExcerpts,
      meetingInsights: researchContext.meetingInsights,
    },
  );
  const tools = resolveTools(mode, section);

  // Prompt caching: AI SDK v6 types `system` as
  //   string | SystemModelMessage | Array<SystemModelMessage>
  // where SystemModelMessage = { role: 'system', content: string, providerOptions? }.
  // We send two system messages: a stable one carrying the Anthropic
  // `cacheControl: { type: 'ephemeral' }` breakpoint, followed by a dynamic
  // suffix. The Anthropic provider reads `providerOptions.anthropic.cacheControl`
  // off each message and emits `cache_control` on the underlying block.
  const systemMessages = [
    {
      role: 'system' as const,
      content: stablePrefix,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' as const } },
      },
    },
    {
      role: 'system' as const,
      content: dynamicSuffix,
    },
  ];

  const providerOptions = cfg.thinkingBudgetTokens != null
    ? {
        anthropic: {
          thinking: {
            type: 'enabled' as const,
            budgetTokens: cfg.thinkingBudgetTokens,
          },
        },
      }
    : undefined;

  const result = streamText({
    model: anthropic(cfg.model),
    system: systemMessages,
    messages: modelMessages,
    ...(tools ? { tools } : {}),
    stopWhen: stepCountIs(10),
    maxRetries: 0,
    ...(providerOptions ? { providerOptions } : {}),
    onFinish: ({ usage, steps }) => {
      console.log('[chat-cache]', {
        mode,
        model: cfg.model,
        cacheCreationInputTokens: (usage as { cacheCreationInputTokens?: number })?.cacheCreationInputTokens ?? 0,
        cacheReadInputTokens: (usage as { cacheReadInputTokens?: number })?.cacheReadInputTokens ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        steps: steps.length,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
