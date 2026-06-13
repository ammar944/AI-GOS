import { auth } from '@clerk/nextjs/server';
import type { ModelMessage } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createPositioningOrchestratorAgent,
  extractOrchestratorSideEffects,
  type OrchestratorSideEffect,
} from '@/lib/research-v2/agents/positioning-orchestrator';
import type {
  AuditContextSummary,
  ChatMessageForRouter,
  SectionSummary,
} from '@/lib/research-v2/intent-router.types';
import { applyPatch } from '@/lib/research-v2/patch-apply';
import { commitChatPatchAuto } from '@/lib/research-v2/chat-write-through';
import {
  STRATEGY_BRIEF_SECTION_ID,
  strategyBriefArtifactSchema,
  type StrategyBriefArtifact,
} from '@/lib/research-v2/strategy-brief/schema';
import { createAdminClient } from '@/lib/supabase/server';

type ChatPatchSupabase = Parameters<typeof commitChatPatchAuto>[0];

// The positioning orchestrator is the only chat command surface; every turn
// runs through it. The earlier legacy intent-router branch is gone.
const ORCHESTRATOR_TIMEOUT_MS = 45_000;
const DISPATCH_TIMEOUT_MS = 10_000;

export const maxDuration = 60;

const chatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  parts: z.array(chatTextPartSchema),
});

const chatRequestSchema = z.object({
  runId: z.string().trim().min(1),
  messages: z.array(chatMessageSchema).min(1),
  // P2b — selection context: the section the user is currently viewing
  // in the artifact UI. Passed through to the orchestrator's system
  // prompt so commands like "tighten this claim" resolve to the right
  // zone without forcing the user to name it.
  focusedZone: z.string().trim().min(1).optional(),
});

const draftStrategyBriefPayloadSchema = z.object({
  refinement: z.string().trim().min(1).max(2000).nullable().optional(),
});

const reviseStrategyBriefPayloadSchema = z.object({
  patches: z
    .array(
      z.object({
        path: z.string().trim().min(1),
        value: z.string(),
      }),
    )
    .min(1),
  changelogSummary: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
});

type ChatRequestBody = z.infer<typeof chatRequestSchema>;
type ChatRequestMessage = ChatRequestBody['messages'][number];
type ReviseStrategyBriefPayload = z.infer<
  typeof reviseStrategyBriefPayloadSchema
>;

interface AuditChatInsert {
  run_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: 'rerun' | 'patch' | 'converse';
  target_section?: string | null;
}

interface ChatSideEffectContext {
  userId: string;
  runId: string;
  supabase: ChatPatchSupabase;
  researchResults: Record<string, unknown>;
  requestUrl: string;
  cookieHeader: string;
}

interface SupabaseQueryError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface SupabaseMaybeSingleResponse {
  data: unknown;
  error: SupabaseQueryError | null;
}

type ParentArtifactLookup =
  | { ok: true; parentAuditRunId: string }
  | { ok: false; reason: string };

type StrategyBriefLookup =
  | { ok: true; artifact: StrategyBriefArtifact }
  | { ok: false; reason: string };

type StrategyBriefRevision =
  | { ok: true; artifact: StrategyBriefArtifact }
  | { ok: false; reason: string };

const POSITIONING_SECTION_KEYS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractText(message: ChatRequestMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim();
}

function findLastUserMessage(
  messages: ChatRequestMessage[],
): ChatRequestMessage | null {
  return [...messages].reverse().find((message) => message.role === 'user') ?? null;
}

/**
 * Build slim per-section summaries from journey_sessions.research_results so the
 * intent classifier can pick the most relevant target_section. Each runner
 * writes its payload under a key like `positioningMarketCategory` with either
 * the artifact directly or wrapped in { data: {...} } — handle both shapes.
 */
function extractSectionSummaries(
  researchResults: Record<string, unknown>,
): SectionSummary[] {
  return POSITIONING_SECTION_KEYS.filter((key) => researchResults[key]).map(
    (key) => {
      const raw = researchResults[key];
      const wrapper = isRecord(raw) ? raw : {};
      const inner = isRecord(wrapper.data) ? wrapper.data : wrapper;

      const title =
        (typeof inner.sectionTitle === 'string' && inner.sectionTitle.trim()) ||
        key;
      const statusSummary =
        (typeof inner.statusSummary === 'string' && inner.statusSummary.trim()) ||
        '';
      const keyFindingTitles = Array.isArray(inner.keyFindings)
        ? (inner.keyFindings as Array<unknown>)
            .map((finding) =>
              isRecord(finding) && typeof finding.title === 'string'
                ? finding.title.trim()
                : '',
            )
            .filter((t): t is string => t.length > 0)
        : [];

      return { sectionId: key, title, statusSummary, keyFindingTitles };
    },
  );
}

function logSupabaseError(
  operation: string,
  fields: { runId: string; userId: string; role?: AuditChatInsert['role'] },
  error: { message?: string; code?: string; details?: string; hint?: string },
): void {
  console.error('[research-v2/chat] Supabase operation failed', {
    operation,
    runId: fields.runId,
    userId: fields.userId,
    role: fields.role,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

async function postInternalJson(
  ctx: ChatSideEffectContext,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const dispatchUrl = new URL(path, ctx.requestUrl).toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DISPATCH_TIMEOUT_MS,
  );

  try {
    return await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ctx.cookieHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatDispatchError(error: unknown): string {
  const isAbort = error instanceof Error && error.name === 'AbortError';
  if (isAbort) {
    return `dispatch timeout after ${DISPATCH_TIMEOUT_MS / 1000}s`;
  }

  return error instanceof Error ? error.message : String(error);
}

function readParentArtifactId(data: unknown): string | null {
  const id = isRecord(data) ? data.id : null;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function readStrategyBriefData(data: unknown): unknown {
  return isRecord(data) ? data.data : null;
}

async function loadParentArtifactForSideEffect(
  ctx: ChatSideEffectContext,
): Promise<ParentArtifactLookup> {
  const response = (await ctx.supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('run_id', ctx.runId)
    .maybeSingle()) as SupabaseMaybeSingleResponse;

  if (response.error) {
    return {
      ok: false,
      reason: `parent artifact lookup failed: ${response.error.message}`,
    };
  }

  const parentAuditRunId = readParentArtifactId(response.data);
  if (parentAuditRunId === null) {
    return { ok: false, reason: 'parent artifact not found' };
  }

  return { ok: true, parentAuditRunId };
}

async function loadCommittedStrategyBrief(
  ctx: ChatSideEffectContext,
  parentAuditRunId: string,
): Promise<StrategyBriefLookup> {
  const response = (await ctx.supabase
    .from('research_artifact_sections')
    .select('data')
    .eq('artifact_id', parentAuditRunId)
    .eq('zone', STRATEGY_BRIEF_SECTION_ID)
    .maybeSingle()) as SupabaseMaybeSingleResponse;

  if (response.error) {
    return {
      ok: false,
      reason: `strategy brief lookup failed: ${response.error.message}`,
    };
  }

  const rawArtifact = readStrategyBriefData(response.data);
  if (rawArtifact === null) {
    return { ok: false, reason: 'no committed strategy brief to revise' };
  }

  const parsed = strategyBriefArtifactSchema.safeParse(rawArtifact);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `committed strategy brief is invalid: ${parsed.error.message}`,
    };
  }

  return { ok: true, artifact: parsed.data };
}

function applyStrategyBriefRevision(
  artifact: StrategyBriefArtifact,
  payload: ReviseStrategyBriefPayload,
): StrategyBriefRevision {
  let patchedRecord = structuredClone(artifact) as unknown as Record<
    string,
    unknown
  >;

  try {
    for (const patch of payload.patches) {
      patchedRecord = applyPatch(patchedRecord, {
        path: `body.${patch.path}`,
        value: patch.value,
      });
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const patched = strategyBriefArtifactSchema.safeParse(patchedRecord);
  if (!patched.success) {
    return {
      ok: false,
      reason: `revision produced invalid brief: ${patched.error.message}`,
    };
  }

  const nextRevision =
    (patched.data.body.changelog.at(-1)?.revision ?? 0) + 1;
  const revised = strategyBriefArtifactSchema.safeParse({
    ...patched.data,
    body: {
      ...patched.data.body,
      changelog: [
        ...patched.data.body.changelog,
        {
          revision: nextRevision,
          summary: payload.changelogSummary,
          rationale: payload.rationale,
          at: new Date().toISOString(),
        },
      ],
    },
  });

  if (!revised.success) {
    return {
      ok: false,
      reason: `revision produced invalid brief: ${revised.error.message}`,
    };
  }

  return { ok: true, artifact: revised.data };
}

function strategyBriefToPatchedSection(
  artifact: StrategyBriefArtifact,
): Record<string, unknown> {
  return {
    title: artifact.sectionTitle,
    markdown: `${artifact.verdict}\n\n${artifact.statusSummary}`,
    data: artifact,
    claims: [],
    sources: artifact.sources,
  };
}

/**
 * Phase 4: translate an orchestrator-emitted intent (`rerun_section` /
 * `edit_claim` / `edit_narrative`) into a real side-effect: dispatch route
 * call for reruns, atomic JSONB merge for surgical edits. Narration-only
 * intents (`explain_source`, `summarize_artifact`) are no-ops here — they
 * are answered in the assistant's text reply.
 *
 * Failures are logged but do not throw — the assistant's text response has
 * already been streamed, so the user sees the orchestrator's intent stated
 * even if the side-effect step fails. The caller decides how to surface it.
 */
export async function applyOrchestratorSideEffect(
  effect: OrchestratorSideEffect,
  ctx: ChatSideEffectContext,
): Promise<{ ok: boolean; reason?: string }> {
  if (effect.intent === 'rerun_section') {
    const zone =
      typeof effect.payload.zone === 'string' ? effect.payload.zone : null;
    const refinement =
      typeof effect.payload.refinement === 'string'
        ? effect.payload.refinement
        : null;
    const usePartialContext = effect.payload.usePartialContext === true;
    if (!zone) return { ok: false, reason: 'rerun_section missing zone' };

    // Phase 5 — always route rerun intents through /rerun-section so the
    // abort-then-dispatch sequence is consistent. /dispatch returns 409 for
    // already-running sections; /rerun-section aborts the in-flight run
    // first, mints a new section_run_id, and dispatches. The
    // usePartialContext flag controls whether we additionally inject the
    // prior partial markdown as <previous_attempt_partial> context.
    const requestBody: Record<string, unknown> = {
      runId: ctx.runId,
      zone,
      usePartialContext,
      ...(refinement ? { refinement } : {}),
    };
    try {
      const res = await postInternalJson(
        ctx,
        '/api/research-v2/rerun-section',
        requestBody,
      );
      // 409 from the dispatch route means "already running" — the worker
      // is already processing this zone, so the user's rerun intent is
      // satisfied. Treat it as a successful outcome, not a failure.
      if (res.status === 409) {
        return { ok: true, reason: 'already running' };
      }
      if (!res.ok) {
        return {
          ok: false,
          reason: `dispatch ${res.status} ${res.statusText || 'error'}`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: formatDispatchError(err),
      };
    }
  }

  if (effect.intent === 'draft_strategy_brief') {
    const parsed = draftStrategyBriefPayloadSchema.safeParse(effect.payload);
    if (!parsed.success) {
      return {
        ok: false,
        reason: `draft_strategy_brief invalid payload: ${parsed.error.message}`,
      };
    }

    const refinement = parsed.data.refinement?.trim();
    const requestBody: Record<string, unknown> = {
      runId: ctx.runId,
      ...(refinement === undefined || refinement === ''
        ? {}
        : { refinement }),
    };

    try {
      const res = await postInternalJson(
        ctx,
        '/api/research-v2/strategy-brief',
        requestBody,
      );
      if (res.ok || res.status === 202) {
        return { ok: true };
      }

      return {
        ok: false,
        reason: `strategy-brief dispatch failed: ${res.status} ${res.statusText || 'error'}`,
      };
    } catch (err) {
      return {
        ok: false,
        reason: formatDispatchError(err),
      };
    }
  }

  if (effect.intent === 'revise_strategy_brief') {
    const parsed = reviseStrategyBriefPayloadSchema.safeParse(effect.payload);
    if (!parsed.success) {
      return {
        ok: false,
        reason: `revise_strategy_brief invalid payload: ${parsed.error.message}`,
      };
    }

    const parentLookup = await loadParentArtifactForSideEffect(ctx);
    if (!parentLookup.ok) {
      return { ok: false, reason: parentLookup.reason };
    }

    const briefLookup = await loadCommittedStrategyBrief(
      ctx,
      parentLookup.parentAuditRunId,
    );
    if (!briefLookup.ok) {
      return { ok: false, reason: briefLookup.reason };
    }

    const revision = applyStrategyBriefRevision(
      briefLookup.artifact,
      parsed.data,
    );
    if (!revision.ok) {
      return { ok: false, reason: revision.reason };
    }

    const writeResult = await commitChatPatchAuto(ctx.supabase, {
      userId: ctx.userId,
      runId: ctx.runId,
      zone: STRATEGY_BRIEF_SECTION_ID,
      patchedSection: strategyBriefToPatchedSection(revision.artifact),
    });

    if (!writeResult.ok) {
      return { ok: false, reason: `write_through: ${writeResult.reason}` };
    }

    return { ok: true };
  }

  if (effect.intent === 'edit_claim' || effect.intent === 'edit_narrative') {
    const zone =
      typeof effect.payload.zone === 'string' ? effect.payload.zone : null;
    if (!zone) return { ok: false, reason: `${effect.intent} missing zone` };

    const wrapper = isRecord(ctx.researchResults[zone])
      ? (ctx.researchResults[zone] as Record<string, unknown>)
      : null;
    if (!wrapper) {
      return {
        ok: false,
        reason: `${effect.intent}: zone ${zone} not yet generated`,
      };
    }
    const isWrapped = isRecord(wrapper.data);
    const inner = isWrapped
      ? (wrapper.data as Record<string, unknown>)
      : wrapper;

    // Build a structured patch the existing applyPatch helper can apply.
    // The patch path grammar (src/lib/research-v2/patch-apply.ts) uses
    // bracket index syntax: `keyFindings[0].title`, NOT `keyFindings.0.title`.
    // edit_claim: when claimId is "kf-<n>", patch the n-th key finding's title.
    // edit_narrative: patch `artifact.markdown` — that's the rendered field
    // the workspace UI displays (see writeResearchResult in the worker:
    // `artifact: { title, markdown }`).
    let patchPath: string | null = null;
    let patchValue: unknown = null;
    if (effect.intent === 'edit_claim') {
      const claimId =
        typeof effect.payload.claimId === 'string'
          ? effect.payload.claimId
          : null;
      const newText =
        typeof effect.payload.newText === 'string'
          ? effect.payload.newText
          : null;
      if (!claimId || newText === null) {
        return { ok: false, reason: 'edit_claim missing claimId or newText' };
      }
      const match = /^kf-(\d+)$/.exec(claimId);
      if (!match) {
        return {
          ok: false,
          reason: `edit_claim: only kf-<idx> claim ids are supported in Phase 4 (got "${claimId}")`,
        };
      }
      patchPath = `keyFindings[${match[1]}].title`;
      patchValue = newText;
    } else {
      const patch =
        typeof effect.payload.patch === 'string'
          ? effect.payload.patch
          : null;
      if (patch === null) {
        return { ok: false, reason: 'edit_narrative missing patch' };
      }
      patchPath = 'artifact.markdown';
      patchValue = patch;
    }

    try {
      const patchedInner = applyPatch(inner, {
        path: patchPath,
        value: patchValue,
      });
      const newSection: Record<string, unknown> = isWrapped
        ? { ...wrapper, data: patchedInner }
        : { ...patchedInner };

      // Phase 3: write through the normalized research_artifact_sections row
      // (source of truth for the artifact UI) before mirroring into the legacy
      // journey_sessions.research_results JSONB. commitChatPatchAuto handles
      // the section_run_id + expectedRevision lookup so the chat route stays
      // ignorant of artifact internals.
      const writeResult = await commitChatPatchAuto(
        ctx.supabase,
        {
          userId: ctx.userId,
          runId: ctx.runId,
          zone,
          patchedSection: newSection,
        },
      );
      if (!writeResult.ok) {
        return { ok: false, reason: `write_through: ${writeResult.reason}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // explain_source and summarize_artifact are narration-only — handled
  // inline in the orchestrator's text response.
  return { ok: true };
}

/**
 * Phase 4 turn runner. Streams the positioning orchestrator agent and writes
 * the assistant turn + applies side-effects in onFinish.
 *
 * Why onFinish vs synchronous side-effects: the existing intent-router runs
 * BEFORE the stream so it can dispatch upfront. The orchestrator decides
 * which tool(s) to call DURING the stream, so side-effects can only be
 * applied after toolResults resolves. The SSE response is kept open until
 * onFinish settles, so failures still log but the user has already received
 * the assistant's narration.
 */
async function runOrchestratorTurn(opts: {
  userId: string;
  runId: string;
  supabase: ReturnType<typeof createAdminClient>;
  researchResults: Record<string, unknown>;
  chatHistory: ChatMessageForRouter[];
  userText: string;
  auditContext: AuditContextSummary;
  req: Request;
  /** P2b — zone the user is currently viewing in the artifact UI. */
  focusedZone?: string;
}): Promise<Response> {
  const {
    userId,
    runId,
    supabase,
    researchResults,
    chatHistory,
    userText,
    auditContext,
    req,
    focusedZone,
  } = opts;

  const auditSummary = auditContext.sections
    .map(
      (s) =>
        `## ${s.title}\nStatus: ${s.statusSummary}\nKey findings: ${s.keyFindingTitles.join('; ')}`,
    )
    .join('\n\n');

  // System message carries per-request audit state. The agent's persistent
  // role lives in its `instructions` (set in the constructor). Combining the
  // two keeps the agent reusable across runs.
  const baseMessages: ModelMessage[] = [
    {
      role: 'system',
      content: `Current artifact (run ${runId}):\n\n${auditSummary || 'No sections generated yet.'}`,
    },
    // P2b — selection context. When the user says "tighten this claim",
    // "cite source", "rerun this section", they mean the section they're
    // currently viewing in the artifact. Surface that here so the
    // orchestrator's editClaim / editNarrative / rerunSection tools can
    // resolve "this" → focusedZone without forcing the user to name the
    // section explicitly.
    ...(focusedZone
      ? [{
          role: 'system' as const,
          content: `The user is currently viewing the "${focusedZone}" zone of the artifact. When their request uses "this", "here", or otherwise omits the zone, default to "${focusedZone}". If they explicitly name a different zone, use that one instead.`,
        }]
      : []),
    ...chatHistory.map<ModelMessage>((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Defensive: if the history fetch returned empty or lagged behind the
  // just-inserted user row, the orchestrator would lose the user's actual
  // instruction. Append the validated request text when it isn't already
  // the last message. classifyIntent uses userText directly for the same
  // reason — we mirror that guarantee here.
  const lastMsg = baseMessages.at(-1);
  const messages: ModelMessage[] =
    lastMsg &&
    lastMsg.role === 'user' &&
    typeof lastMsg.content === 'string' &&
    lastMsg.content === userText
      ? baseMessages
      : [...baseMessages, { role: 'user', content: userText }];

  // Compose the abort signal from a 45s timeout AND the inbound request
  // signal. AbortSignal.any() (Node 20+) fires when EITHER aborts. This
  // closes the quota-leak window when the client disconnects mid-turn —
  // previously only the internal timer could abort the agent.
  const timeoutSignal = AbortSignal.timeout(ORCHESTRATOR_TIMEOUT_MS);
  const combinedSignal: AbortSignal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any([timeoutSignal, req.signal])
      : timeoutSignal;
  const positioningOrchestratorAgent = createPositioningOrchestratorAgent();

  // P1 fix: collect tool results across EVERY step via onStepFinish.
  // StreamTextResult.toolResults only carries the FINAL step's results,
  // and the final step in a ToolLoopAgent turn is post-tool narration with
  // zero tool calls — so reading from there missed every actionable
  // intent. onStepFinish runs after each LLM step (tool-calling and
  // narration alike) and the per-step `toolResults` is the source of truth.
  const collectedToolResults: Array<{ output?: unknown }> = [];

  let result: Awaited<ReturnType<typeof positioningOrchestratorAgent.stream>>;
  try {
    result = await positioningOrchestratorAgent.stream({
      messages,
      abortSignal: combinedSignal,
      onStepFinish: (step) => {
        const stepResults = (step as { toolResults?: unknown }).toolResults;
        if (Array.isArray(stepResults)) {
          for (const tr of stepResults) {
            if (isRecord(tr)) {
              collectedToolResults.push(tr as { output?: unknown });
            }
          }
        }
      },
    });
  } catch (err) {
    console.error('[research-v2/chat orchestrator] stream() failed', {
      runId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: 'Orchestrator failed to start',
        runId,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const cookieHeader = req.headers.get('cookie') ?? '';
  const requestUrl = req.url;

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      // Extract assistant text from the UI message parts so it can be
      // persisted for history. UI message parts have a discriminated `type`
      // — collect every text part in order.
      const assistantText =
        responseMessage && Array.isArray(responseMessage.parts)
          ? responseMessage.parts
              .filter(
                (
                  part,
                ): part is Extract<
                  (typeof responseMessage.parts)[number],
                  { type: 'text' }
                > => isRecord(part) && part.type === 'text',
              )
              .map((part) => (typeof part.text === 'string' ? part.text : ''))
              .join('')
              .trim()
          : '';

      if (assistantText.length > 0) {
        const assistantInsert: AuditChatInsert = {
          run_id: runId,
          user_id: userId,
          role: 'assistant',
          content: assistantText,
          intent: 'converse',
        };
        const { error: assistantInsertError } = await supabase
          .from('audit_chat_messages')
          .insert(assistantInsert);
        if (assistantInsertError) {
          logSupabaseError(
            'insert_orchestrator_assistant',
            { runId, userId, role: 'assistant' },
            assistantInsertError,
          );
        }
      }

      const effects = extractOrchestratorSideEffects(collectedToolResults);
      const failureReasons: string[] = [];
      for (const effect of effects) {
        const outcome = await applyOrchestratorSideEffect(effect, {
          userId,
          runId,
          supabase,
          researchResults,
          requestUrl,
          cookieHeader,
        });
        if (!outcome.ok) {
          console.error(
            '[research-v2/chat orchestrator] side-effect failed',
            {
              runId,
              userId,
              intent: effect.intent,
              reason: outcome.reason,
            },
          );
          failureReasons.push(
            `${effect.intent} failed: ${outcome.reason ?? 'unknown error'}`,
          );
        }
      }

      // P2 fix: surface side-effect failures back to the user. The SSE
      // stream has already closed, so we can't append to the current
      // assistant turn — instead we persist a follow-up assistant message
      // that the workspace UI will render on its next history refresh.
      if (failureReasons.length > 0) {
        const failureInsert: AuditChatInsert = {
          run_id: runId,
          user_id: userId,
          role: 'assistant',
          content: `⚠️ Orchestrator side-effect(s) could not complete: ${failureReasons.join('; ')}`,
          intent: 'converse',
        };
        const { error: failureInsertError } = await supabase
          .from('audit_chat_messages')
          .insert(failureInsert);
        if (failureInsertError) {
          logSupabaseError(
            'insert_orchestrator_failure_followup',
            { runId, userId, role: 'assistant' },
            failureInsertError,
          );
        }
      }
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid JSON body',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const parsedBody = chatRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'Invalid chat request body',
        issues: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const body = parsedBody.data;
  const { runId, messages, focusedZone } = body;
  const lastUserMessage = findLastUserMessage(messages);
  const userText = lastUserMessage ? extractText(lastUserMessage) : '';

  if (!lastUserMessage || userText.length === 0) {
    return NextResponse.json(
      {
        error: 'Missing latest user text message',
        runId,
        messageCount: messages.length,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from('journey_sessions')
    .select('run_id, research_results')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (sessionError) {
    logSupabaseError('read_journey_session', { runId, userId }, sessionError);
    return NextResponse.json(
      {
        error: 'Failed to verify audit run ownership',
        runId,
        details: sessionError.message,
      },
      { status: 500 },
    );
  }

  if (!session) {
    return NextResponse.json(
      {
        error: 'Audit run not found for current user',
        runId,
      },
      { status: 404 },
    );
  }

  const userInsert: AuditChatInsert = {
    run_id: runId,
    user_id: userId,
    role: 'user',
    content: userText,
  };
  const { error: userInsertError } = await supabase
    .from('audit_chat_messages')
    .insert(userInsert);

  if (userInsertError) {
    logSupabaseError(
      'insert_user_message',
      { runId, userId, role: 'user' },
      userInsertError,
    );
    return NextResponse.json(
      {
        error: 'Failed to persist user chat message',
        runId,
        details: userInsertError.message,
      },
      { status: 500 },
    );
  }

  // Build audit context + load recent chat history for the intent classifier.
  const researchResults = isRecord(session.research_results)
    ? (session.research_results as Record<string, unknown>)
    : {};
  const auditContext: AuditContextSummary = {
    runId,
    sections: extractSectionSummaries(researchResults),
  };

  const { data: historyRows } = await supabase
    .from('audit_chat_messages')
    .select('role, content')
    .eq('run_id', runId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(6);

  const chatHistory: ChatMessageForRouter[] = (historyRows ?? [])
    .filter(
      (row): row is { role: 'user' | 'assistant'; content: string } =>
        (row.role === 'user' || row.role === 'assistant') &&
        typeof row.content === 'string',
    )
    .map((row) => ({ role: row.role, content: row.content }))
    .reverse();

  // Phase 7: every turn runs through the ToolLoopAgent. The agent's 5
  // meta-tools (rerunSection / editClaim / editNarrative / explainSource /
  // summarizeArtifact) handle the entire chat command surface. Side-effects
  // are applied here via extractOrchestratorSideEffects →
  // applyOrchestratorSideEffect; the legacy intent-router branch is gone.
  return await runOrchestratorTurn({
    userId,
    runId,
    supabase,
    researchResults,
    chatHistory,
    userText,
    auditContext,
    req,
    focusedZone,
  });

}
