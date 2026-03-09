// POST /api/journey/stream
// Streaming chat endpoint for the v2 journey experience.
// Uses Claude Opus 4.6 with adaptive thinking for conversational strategy sessions.

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import {
  LEAD_AGENT_SYSTEM_PROMPT,
  buildResumeContext,
} from '@/lib/ai/prompts/lead-agent-system';
import { askUser } from '@/lib/ai/tools/ask-user';
import { competitorFastHits } from '@/lib/ai/tools/competitor-fast-hits';
import { scrapeClientSite } from '@/lib/ai/tools/scrape-client-site';
import {
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
  researchMediaPlan,
} from '@/lib/ai/tools/research';
import { extractAskUserResults, extractResearchOutputs } from '@/lib/journey/session-state';
import { persistToSupabase, persistResearchToSupabase } from '@/lib/journey/session-state.server';
import { validateWorkerUrl } from '@/lib/env';
import { parseCollectedFields } from '@/lib/ai/journey-state';
import { detectCompetitorMentions } from '@/lib/ai/competitor-detector';

// Validate RAILWAY_WORKER_URL at module load time (fires on cold start).
// If missing, logs an actionable error before any user request hits dispatch.
const workerValidation = validateWorkerUrl();
if (!workerValidation.configured) {
  console.error('[journey/stream] STARTUP WARNING:', workerValidation.message);
}

export const maxDuration = 300;

interface JourneyStreamRequest {
  messages: UIMessage[];
  resumeState?: Record<string, unknown>;
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
  let body: JourneyStreamRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

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

  // ── Extract last user message for competitor detection ───────────────────────
  const lastUserMessage = sanitizedMessages.findLast((m) => m.role === 'user');
  const lastUserText =
    lastUserMessage?.parts
      .filter(
        (p): p is { type: 'text'; text: string } =>
          typeof p === 'object' && p !== null && (p as { type: string }).type === 'text',
      )
      .map((p) => p.text)
      .join(' ') ?? '';

  // ── Persist askUser results from previous round trips ──────────────────
  const askUserFields = extractAskUserResults(body.messages);
  if (Object.keys(askUserFields).length > 0) {
    // Fire-and-forget — do not await, do not block the response
    persistToSupabase(userId, askUserFields).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] askUser persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] askUser persist threw:', err);
    });
  }

  // ── Persist research outputs from completed tools ───────────────────────
  const researchOutputs = extractResearchOutputs(body.messages);
  if (Object.keys(researchOutputs).length > 0) {
    persistResearchToSupabase(userId, researchOutputs).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] research persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] research persist threw:', err);
    });
  }

  // ── Build system prompt (augment with resume context if present) ────────
  let systemPrompt = LEAD_AGENT_SYSTEM_PROMPT;
  if (
    body.resumeState &&
    typeof body.resumeState === 'object' &&
    Object.keys(body.resumeState).length > 0
  ) {
    systemPrompt += buildResumeContext(body.resumeState);
  }

  // ── Prefill detection ──────────────────────────────────────────────────────
  // Detect if this is the first request and the user's message contains prefill data.
  // Prefill messages start with "Here's what I found about the company:" and are sent
  // as plain text (not askUser tool results), so parseCollectedFields won't count them.
  // We inject an explicit directive telling the agent to fire researchIndustry immediately.
  const userMessages = sanitizedMessages.filter((m) => m.role === 'user');
  const isFirstRequest = userMessages.length === 1;
  const PREFILL_PREFIX = "Here's what I found about the company:";
  const isPrefillMessage = isFirstRequest && lastUserText.startsWith(PREFILL_PREFIX);

  // ── Derive per-request state snapshot ──────────────────────────────────────
  const journeySnap = parseCollectedFields(sanitizedMessages);

  // For the competitor dedup guard, scan raw messages (not sanitized) so that
  // in-flight competitorFastHits calls (state: input-available) are not missed.
  // Sanitized messages strip input-available parts, which would cause double-firing.
  const rawSnap = parseCollectedFields(body.messages as UIMessage[]);

  // Stage 2: competitor detection — inject instruction if new competitor found
  const competitorDetection = lastUserText
    ? detectCompetitorMentions(lastUserText)
    : null;

  const competitorAlreadyCalled =
    competitorDetection !== null &&
    rawSnap.competitorFastHitsCalledFor.has(competitorDetection.domain);

  if (
    competitorDetection !== null &&
    !competitorAlreadyCalled
  ) {
    const domainLabel = competitorDetection.inferredDomain
      ? `${competitorDetection.domain} (inferred from "${competitorDetection.rawMention}")`
      : competitorDetection.domain;

    systemPrompt += `\n\n## Stage 2 Directive (this request only)\n\nThe user's latest message contains a competitor reference: **${competitorDetection.rawMention}**. Extracted domain: \`${competitorDetection.domain}\` ${competitorDetection.inferredDomain ? '(inferred — verify if incorrect)' : ''}.\n\nIMPORTANTLY: Call \`competitorFastHits\` with \`competitorUrl: "${competitorDetection.domain}"\` as your FIRST action in this response — before writing any text. After the tool completes, briefly acknowledge the finding (1-2 sentences) then continue with the next onboarding question. Domain used: ${domainLabel}.`;
  }

  // Strategist Mode guard: prevent askUser calls after synthesis completes
  if (journeySnap.synthComplete) {
    systemPrompt += `\n\n## Strategist Mode (enforced)\n\nSynthesis is complete. You are now in Strategist Mode. ABSOLUTE RULES:\n- Do NOT call \`askUser\` to collect more onboarding fields. The onboarding phase is over.\n- Do NOT call any research tools again — all research has been dispatched.\n- Respond to the user's strategic questions with specific, opinionated recommendations.\n- If the user asks a question that requires data you don't have, acknowledge the gap and give your best take based on what was collected.`;
  }

  // Prefill research trigger: when user accepted prefill data, inject explicit instruction
  // to fire researchIndustry immediately. This parallels the Stage 2 / Strategist Mode pattern.
  if (isPrefillMessage) {
    systemPrompt += `\n\n## Prefill Research Directive (this request only)

The user's message contains structured prefill data that was reviewed and accepted through the UI. ALL prefill fields are confirmed — do NOT re-ask or re-confirm any of them.

ACTION REQUIRED: Call \`researchIndustry\` as your FIRST action in this response. The prefill data provides businessModel and industry context — that is sufficient to trigger industry research. Pass the relevant context from the prefill fields.

After calling researchIndustry:
1. Say "Building your market overview now..." (one sentence, no more)
2. Share 2-3 sentences of preliminary strategic observations from the prefill data
3. STOP. Do NOT ask the user any questions while research is running.
4. Wait for the research results to arrive before continuing.

The user will review research results in an artifact panel and click "Looks Good" when satisfied. When you receive their approval message, acknowledge briefly and tell them you're preparing the next section.`;
  }

  // Check if industryMarket research has completed and user hasn't responded yet
  const industryResultMsgIndex = sanitizedMessages.findIndex((m) =>
    m.role === 'assistant' &&
    m.parts.some((p) => {
      const part = p as Record<string, unknown>;
      return (
        part.type === 'tool-researchIndustry' &&
        part.state === 'output-available'
      );
    })
  );

  const userRespondedToIndustry =
    industryResultMsgIndex !== -1 &&
    sanitizedMessages
      .slice(industryResultMsgIndex + 1)
      .some((m) => m.role === 'user');

  if (industryResultMsgIndex !== -1 && !userRespondedToIndustry && !journeySnap.synthComplete) {
    systemPrompt += `\n\n## Section Review Directive (this request only)

Industry research (Section 1: Market Overview) results have arrived and are displayed in the artifact panel. The user can see the full research document.

YOUR RESPONSE: "Take a look at the market overview in the panel. If everything looks right, hit 'Looks Good' — or tell me what you'd like me to change."

Keep it to 1-2 sentences. Do NOT summarize the research (they can read it). Do NOT ask new onboarding questions yet.`;
  }

  // ── Stream ──────────────────────────────────────────────────────────────
  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: systemPrompt,
    messages: await convertToModelMessages(sanitizedMessages),
    maxRetries: 0,
    tools: {
      askUser,
      competitorFastHits,
      scrapeClientSite,
      researchIndustry,
      researchCompetitors,
      researchICP,
      researchOffer,
      synthesizeResearch,
      researchKeywords,
      researchMediaPlan,
    },
    stopWhen: stepCountIs(25),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 },
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
