// POST /api/journey/stream
// Streaming chat endpoint for the Journey workspace agent.
// Uses the AI SDK ToolLoopAgent so workspace chat, artifact edits, and research
// requests run through one explicit agent/tool loop.

import { ToolLoopAgent, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import {
  JOURNEY_CHAT_SYSTEM_PROMPT,
  buildResumeContext,
} from '@/lib/ai/prompts/journey-chat-system';
import {
  sanitizeJourneyMessages,
} from '@/lib/ai/journey-stream-prep';
import { askUser } from '@/lib/ai/tools/ask-user';
import { competitorFastHits } from '@/lib/ai/tools/competitor-fast-hits';
import { scrapeClientSite } from '@/lib/ai/tools/scrape-client-site';
import { updateField } from '@/lib/ai/tools/update-field';
import { editCard } from '@/lib/ai/tools/edit-card';
import { runDeepResearchProgram } from '@/lib/ai/tools/research';
import { extractAskUserResults, extractResearchOutputs } from '@/lib/journey/session-state';
import { persistToSupabase, persistResearchToSupabase } from '@/lib/journey/session-state.server';
import { validateWorkerUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/server';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import { parseCollectedFields } from '@/lib/ai/journey-state';
import { extractBaselineMetrics } from '@/lib/journey/baseline-metrics';
import { SECTION_META } from '@/lib/journey/section-meta';

// Validate RAILWAY_WORKER_URL at module load time (fires on cold start).
// If missing, logs an actionable error before any user request hits dispatch.
const workerValidation = validateWorkerUrl();
if (!workerValidation.configured) {
  console.error('[journey/stream] STARTUP WARNING:', workerValidation.message);
}

export const maxDuration = 300;

interface SectionCardContext {
  id: string;
  cardType: string;
  label: string;
  content: Record<string, unknown>;
}

interface JourneyStreamRequest {
  activeRunId?: string | null;
  messages: UIMessage[];
  resumeState?: Record<string, unknown>;
  /** Current section key for workspace chat context */
  currentSection?: string;
  /** Cards visible in the current section — injected into system prompt */
  sectionCards?: SectionCardContext[];
  /** Extended reasoning mode for deeper analysis */
  deepResearch?: boolean;
  /** Workspace chat mode from the report rail. */
  workspaceChatMode?: 'normal' | 'thinking' | 'research';
}

interface SavedJourneyContext {
  metadata: Record<string, unknown> | null;
  researchResults: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compactValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed || null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(', ');
    return joined.length > 500 ? `${joined.slice(0, 500)}...` : joined || null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const serialized = JSON.stringify(value) ?? String(value);
  return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
}

async function readSavedJourneyContext(
  userId: string,
  runId: string | null | undefined,
): Promise<SavedJourneyContext | null> {
  if (!runId) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('metadata, research_results')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to read journey session context for run ${runId}: ${error.message}`,
    );
  }

  return {
    metadata: isRecord(data?.metadata) ? data.metadata : null,
    researchResults: isRecord(data?.research_results) ? data.research_results : null,
  };
}

function formatSavedJourneyContext(context: SavedJourneyContext | null): string {
  if (!context) {
    return '';
  }

  const lines: string[] = [];
  const ignoredMetadataKeys = new Set([
    'activeJourneyRunId',
    'lastUpdated',
    'researchPipeline',
  ]);

  if (context.metadata) {
    const fieldLines = Object.entries(context.metadata)
      .filter(([key]) => !ignoredMetadataKeys.has(key))
      .map(([key, value]) => {
        const compact = compactValue(value);
        if (!compact) {
          return null;
        }
        return `- ${JOURNEY_FIELD_LABELS[key] ?? key}: ${compact}`;
      })
      .filter((line): line is string => line !== null)
      .slice(0, 24);

    if (fieldLines.length > 0) {
      lines.push('## Saved Onboarding/Profile Context', ...fieldLines);
    }
  }

  if (context.researchResults) {
    const resultLines = Object.entries(context.researchResults)
      .map(([key, value]) => {
        if (!isRecord(value)) {
          return null;
        }
        const status = compactValue(value.status) ?? 'unknown';
        const data = isRecord(value.data) ? Object.keys(value.data).slice(0, 12) : [];
        return `- ${key}: ${status}${data.length > 0 ? `; data keys: ${data.join(', ')}` : ''}`;
      })
      .filter((line): line is string => line !== null)
      .slice(0, 16);

    if (resultLines.length > 0) {
      lines.push('', '## Saved Research Artifact Index', ...resultLines);
    }
  }

  return lines.join('\n');
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

  const requestMessages = body.messages as UIMessage[];
  const isWorkspaceReportChat =
    typeof body.currentSection === 'string' &&
    body.currentSection.trim().length > 0;

  // ── Prepare model replay messages ───────────────────────────────────────
  const modelMessages = sanitizeJourneyMessages(requestMessages);

  // ── Persist askUser results from previous round trips ──────────────────
  const askUserFields = extractAskUserResults(requestMessages);
  if (Object.keys(askUserFields).length > 0) {
    // Fire-and-forget — do not await, do not block the response
    persistToSupabase(userId, askUserFields, body.activeRunId ?? undefined).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] askUser persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] askUser persist threw:', err);
    });
  }

  // ── Persist research outputs from completed tools ───────────────────────
  const researchOutputs = extractResearchOutputs(requestMessages);
  if (Object.keys(researchOutputs).length > 0) {
    persistResearchToSupabase(userId, researchOutputs, body.activeRunId ?? undefined).then((result) => {
      if (!result.ok) {
        console.error('[journey/stream] research persist failed:', result.error);
      }
    }).catch((err) => {
      console.error('[journey/stream] research persist threw:', err);
    });
  }

  // ── Build system prompt (augment with resume context if present) ────────
  let systemPrompt = JOURNEY_CHAT_SYSTEM_PROMPT;
  if (
    body.resumeState &&
    typeof body.resumeState === 'object' &&
    Object.keys(body.resumeState).length > 0
  ) {
    systemPrompt += buildResumeContext(body.resumeState);
  }

  if (isWorkspaceReportChat && body.activeRunId) {
    try {
      const savedContext = await readSavedJourneyContext(userId, body.activeRunId);
      const formattedContext = formatSavedJourneyContext(savedContext);
      if (formattedContext) {
        systemPrompt += `\n\n${formattedContext}`;
      }
    } catch (error) {
      console.warn('[journey/stream] saved workspace context unavailable:', {
        activeRunId: body.activeRunId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const journeySnap = parseCollectedFields(requestMessages);

  // Strategist Mode guard: unlock after synthesis and keyword intel complete
  if (journeySnap.strategistModeReady) {
    systemPrompt += `\n\n## Strategist Mode (enforced)\n\nThe full downstream research sequence is complete. You are now in Strategist Mode. ABSOLUTE RULES:\n- Do NOT call \`askUser\` to collect more profile fields. The profile intake phase is over.\n- Do NOT call any research tools again — all research has been dispatched.\n- Respond to the user's strategic questions with specific, opinionated recommendations.\n- If the user asks a question that requires data you don't have, acknowledge the gap and give your best take based on what was collected.`;
  }

  // ── Offer refinement mode ──────────────────────────────────────────────
  // Detect if the RightRail chat contains offer score data (seeded by frontend).
  // If so, append refinement instructions so the assistant knows to use updateField.
  const isRefinementChat = requestMessages.some(
    (m) =>
      m.role === 'assistant' &&
      m.parts.some((p) => {
        if (typeof p !== 'object' || !p || !('type' in p)) return false;
        const typed = p as { type: string; text?: string };
        return (
          typed.type === 'text' &&
          typeof typed.text === 'string' &&
          typed.text.includes('/10') &&
          (typed.text.includes('scored') || typed.text.includes('Score:') || typed.text.includes('Breakdown:'))
        );
      }),
  );

  if (isRefinementChat) {
    systemPrompt += `\n\n## Offer Refinement Mode

You are helping the user improve their offer based on scoring data visible in the conversation.
Rules:
1. Reference specific dimensions that scored low
2. Suggest concrete field updates — always name the field key (valueProp, productDescription, coreDeliverables, pricingTiers, etc.)
3. Call updateField ONLY after the user confirms ("yes", "do it", "update it", etc.)
4. After 2-3 field updates, suggest re-running offer analysis to see the new score
5. Base suggestions on the conversation context — never fabricate metrics
6. If the user says "re-run" or "re-analyze", call runDeepResearchProgram with the current offer context and requested scope.`;
  }

  // ── Extended reasoning mode ────────────────────────────────────────────
  const isDeepResearch = body.deepResearch === true;
  if (isDeepResearch) {
    systemPrompt += `\n\n## Extended Reasoning Mode (active)

The user has enabled extended reasoning. You MUST:
- Think deeply and thoroughly before responding — use extended reasoning
- Provide comprehensive, analytical responses with specific evidence
- Cross-reference data points across sections when available
- Surface non-obvious insights, patterns, and strategic implications
- Structure responses with clear headers and organized thinking
- When proposing changes, explain the strategic rationale in detail
- Challenge assumptions and flag risks the user may not have considered

Do NOT give surface-level or generic responses. Every response should demonstrate senior strategist-level depth.`;
  }

  if (isWorkspaceReportChat) {
    const workspaceMode = body.workspaceChatMode ?? 'normal';
    const sectionLabel =
      SECTION_META[body.currentSection ?? '']?.label ?? body.currentSection;

    systemPrompt += `\n\n## Manus For GTM Workspace Mode (active)

The user is inside the /journey report workspace, not an onboarding wizard.

Product vision:
1. Deep research saves company/context evidence.
2. That evidence fills company/profile context.
3. Completed profile context drives one-by-one GTM report section synthesis.
4. The UI should feel like Cursor/Codex generating and editing a report: cards on the canvas, chat beside them, explicit edits and further research on request.

Current section in view: ${sectionLabel}
Workspace chat mode: ${workspaceMode}

Rules:
- Do not restart the old conversational onboarding flow.
- Use the visible section cards as the source of truth. Cite card IDs when you reference a specific card.
- If the user asks to edit the report, call \`editCard\` and propose exactly the requested change.
- If the user asks to update company/profile context, call \`updateField\` and propose the profile change.
- If the user asks to research further, rerun, refresh, verify, find sources, or go deeper on company context, call \`runDeepResearchProgram\` with the current company context, current section, visible card summaries, and the user's requested scope.
- Research dispatch is asynchronous. After calling \`runDeepResearchProgram\`, say that the corpus refresh is queued and updated context will persist when Supabase receives the worker results.
- Never fabricate market facts, competitor claims, pricing, benchmarks, or citations. If evidence is missing, say what is missing.`;
  }

  // ── Workspace card context injection ───────────────────────────────────
  // When the right-rail chat sends sectionCards, inject them so the assistant can
  // reference and edit specific card data.
  const sectionCards = body.sectionCards;
  const currentSectionKey = body.currentSection;
  if (
    Array.isArray(sectionCards) &&
    sectionCards.length > 0 &&
    currentSectionKey
  ) {
    const sectionLabel =
      SECTION_META[currentSectionKey]?.label ?? currentSectionKey;

    // Serialize card data compactly — only include fields the AI needs
    const cardSummaries = sectionCards.map((card) => {
      const contentStr = JSON.stringify(card.content, null, 0);
      // Cap individual card content at 2000 chars to keep prompt manageable
      const truncated =
        contentStr.length > 2000
          ? contentStr.slice(0, 2000) + '...(truncated)'
          : contentStr;
      return `### ${card.label} [id=${card.id}, type=${card.cardType}]\n${truncated}`;
    });

    systemPrompt += `\n\n## Current Section Artifacts — ${sectionLabel}

The user is viewing the following research cards in the artifact panel. Use this data to answer questions accurately. When the user asks to change something, use the \`editCard\` tool with the card's \`id\` and the specific \`field\` to update.

${cardSummaries.join('\n\n')}`;
  }

  // ── Stream ──────────────────────────────────────────────────────────────
  const journeyAgent = new ToolLoopAgent({
    id: 'journey-workspace-agent',
    model: anthropic(MODELS.CLAUDE_OPUS),
    instructions: systemPrompt,
    experimental_context: {
      activeRunId: body.activeRunId ?? null,
      // Baseline metrics extracted from the user's profile fields
      // (currentCac, avgCustomerLtv, leadToCustomerRate, last12MoGrowthRate).
      // The dispatch helpers in src/lib/ai/tools/research/dispatch.ts read
      // this off the experimental_context and forward it to the Railway
      // worker so the runners can render the BASELINE METRICS DATA INTEGRITY
      // block in their system prompts. Without this wiring, every research
      // tool call would treat metrics as NOT PROVIDED and the fabrication
      // fix would be dead code.
      baselineMetrics: extractBaselineMetrics(journeySnap.collectedFields),
    },
    maxRetries: 0,
    tools: {
      askUser,
      competitorFastHits,
      scrapeClientSite,
      editCard,
      updateField,
      runDeepResearchProgram,
    },
    stopWhen: stepCountIs(25),
    providerOptions: {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: isDeepResearch ? 16000 : 5000,
        },
      },
    },
    onFinish: async ({ totalUsage, steps }) => {
      console.log('[journey] stream finished', {
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        steps: steps.length,
      });
    },
  });

  const result = await journeyAgent.stream({
    messages: await convertToModelMessages(modelMessages),
  });

  return result.toUIMessageStreamResponse();
}
