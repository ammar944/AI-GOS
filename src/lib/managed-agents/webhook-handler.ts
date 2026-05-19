// Pure orchestration logic for the Managed Agents webhook route.
//
// Kept out of the Next.js route file so it is fully unit-testable without
// spinning up a request object. The route module wires this to:
//   - the raw request body (R6)
//   - the configured webhook secret (R6)
//   - the Anthropic API client (R3)
//   - the Supabase admin client (R1, R5)
//
// All four mitigations are exercised here:
//
//   R1: dedupe — primary-key upsert into managed_agents_webhook_events
//       returns "already_processed" if the row existed; we short-circuit.
//   R3: signature-first then fetch-by-id — the route hands us the raw body,
//       we verify, only then ask the client to fetch the full event resource.
//   R5: retry-ceiling — when a save_section_artifact_rejected row count
//       reaches the threshold for a section_run_id, we post user.interrupt
//       and mark the section error.
//   R6: signature verification on raw body; stale or future timestamp -> 401.

import type { ManagedAgentsClient } from './client';
import {
  type SignatureVerificationResult,
  verifyManagedAgentsSignature,
} from './signature';
import {
  sectionArtifactSchemas,
  sectionIdForToolName,
  validateArtifactForSection,
} from './section-artifact-schemas';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

export const DEFAULT_MAX_CUSTOM_TOOL_RETRIES = 3;

export interface WebhookHandlerDeps {
  client: ManagedAgentsClient;
  supabase: WebhookSupabase;
  webhookSecret: string | null;
  /** Override Date.now() / 1000 for tests. */
  nowSeconds?: () => number;
  /** Override the retry ceiling; defaults to 3 or MANAGED_AGENTS_MAX_CUSTOM_TOOL_RETRIES. */
  maxCustomToolRetries?: number;
}

export interface WebhookSupabase {
  /** Insert (with conflict-do-nothing) a row into managed_agents_webhook_events. */
  insertWebhookEvent(row: WebhookEventRow): Promise<{ inserted: boolean; error?: string }>;
  /** Count rows matching (section_run_id, event_type). */
  countWebhookEvents(input: {
    sectionRunId: string;
    eventType: string;
  }): Promise<{ count: number; error?: string }>;
  /** Call commit_artifact_section RPC. */
  commitArtifactSection(input: CommitArtifactSectionInput): Promise<{
    ok: boolean;
    conflict: boolean;
    revision: number;
    error?: string;
  }>;
  /** Look up the (artifact_id, section_type, expectedRevision) for a section_run_id. */
  loadSectionRunContext(sectionRunId: string): Promise<{
    artifactId: string;
    sectionType: PositioningSectionId;
    expectedRevision: number;
    error?: string;
  } | null>;
  /** Update research_section_runs.status when we force-error a section. */
  markSectionError(input: {
    sectionRunId: string;
    error: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }>;
}

export interface CommitArtifactSectionInput {
  artifactId: string;
  zone: PositioningSectionId;
  sectionRunId: string;
  expectedRevision: number;
  patch: {
    status: 'complete' | 'error' | 'partial';
    title?: string | null;
    markdown?: string | null;
    data?: unknown;
    claims?: unknown[];
    sources?: unknown[];
    error?: unknown;
  };
}

export interface WebhookEventRow {
  event_id: string;
  session_id: string;
  session_thread_id: string | null;
  artifact_id: string | null;
  section_run_id: string | null;
  section_type: PositioningSectionId | null;
  event_type: string;
  created_at: string;
  verified_at: string;
  payload: Record<string, unknown>;
}

export interface WebhookEnvelope {
  /** The unique webhook event id (R1 dedupe key). */
  event_id: string;
  /** Anthropic webhook envelope timestamp; should match the signature timestamp. */
  created_at: string;
  /** Type of webhook event (`agent.custom_tool_use.created`, etc.). */
  type: string;
  /** The Managed Agents resource id the event refers to. */
  data: {
    type: string;
    id: string;
    session_id?: string;
    session_thread_id?: string;
    /** Optional resource hint for routing tests. */
    [key: string]: unknown;
  };
}

export type WebhookHandlerResult =
  | {
      status: 200;
      body: {
        received: true;
        processed: boolean;
        reason?: string;
      };
    }
  | {
      status: 401;
      body: { error: 'unauthorized'; reason: string };
    }
  | {
      status: 400;
      body: { error: 'bad_request'; reason: string };
    }
  | {
      status: 500;
      body: { error: 'internal'; reason: string };
    };

interface ParsedEnvelopeOk {
  ok: true;
  envelope: WebhookEnvelope;
}

interface ParsedEnvelopeError {
  ok: false;
  reason: string;
}

function parseEnvelope(rawBody: string): ParsedEnvelopeOk | ParsedEnvelopeError {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch (err) {
    return { ok: false, reason: `body is not JSON: ${(err as Error).message}` };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'body must be a JSON object' };
  }
  const record = value as Record<string, unknown>;
  const eventId = typeof record.event_id === 'string' ? record.event_id : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;
  const type = typeof record.type === 'string' ? record.type : null;
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? (record.data as Record<string, unknown>)
    : null;
  if (!eventId || !createdAt || !type || !data) {
    return {
      ok: false,
      reason: 'missing required fields (event_id, created_at, type, data)',
    };
  }
  const dataType = typeof data.type === 'string' ? data.type : null;
  const dataId = typeof data.id === 'string' ? data.id : null;
  if (!dataType || !dataId) {
    return { ok: false, reason: 'data.type and data.id are required' };
  }
  return {
    ok: true,
    envelope: {
      event_id: eventId,
      created_at: createdAt,
      type,
      data: { ...data, type: dataType, id: dataId },
    },
  };
}

export async function handleManagedAgentsWebhook(
  deps: WebhookHandlerDeps,
  request: {
    rawBody: string;
    signatureHeader: string | null;
  },
): Promise<WebhookHandlerResult> {
  // R6 — signature first.
  const signature: SignatureVerificationResult = verifyManagedAgentsSignature({
    rawBody: request.rawBody,
    signatureHeader: request.signatureHeader,
    secret: deps.webhookSecret,
    nowSeconds: deps.nowSeconds ? deps.nowSeconds() : undefined,
  });
  if (!signature.ok) {
    return {
      status: 401,
      body: { error: 'unauthorized', reason: signature.reason },
    };
  }

  const parsed = parseEnvelope(request.rawBody);
  if (!parsed.ok) {
    return { status: 400, body: { error: 'bad_request', reason: parsed.reason } };
  }
  const envelope = parsed.envelope;

  const inserted = await deps.supabase.insertWebhookEvent({
    event_id: envelope.event_id,
    session_id: typeof envelope.data.session_id === 'string'
      ? envelope.data.session_id
      : '',
    session_thread_id: typeof envelope.data.session_thread_id === 'string'
      ? envelope.data.session_thread_id
      : null,
    artifact_id: null,
    section_run_id: null,
    section_type: null,
    event_type: envelope.type,
    created_at: envelope.created_at,
    verified_at: new Date().toISOString(),
    payload: envelope as unknown as Record<string, unknown>,
  });
  if (inserted.error) {
    return {
      status: 500,
      body: { error: 'internal', reason: `webhook insert failed: ${inserted.error}` },
    };
  }
  if (!inserted.inserted) {
    // R1 — already processed; short-circuit.
    return {
      status: 200,
      body: { received: true, processed: false, reason: 'duplicate' },
    };
  }

  // R3 — only routes that need the full event resource fetch it now.
  if (
    envelope.type === 'agent.custom_tool_use.created' ||
    envelope.type === 'agent.custom_tool_use'
  ) {
    return processCustomToolUse(deps, envelope);
  }

  // All other event types are observable but not action-bearing in P1.
  return { status: 200, body: { received: true, processed: false } };
}

interface CustomToolUseFullEvent {
  id: string;
  type: string;
  name: string;
  input?: Record<string, unknown>;
  session_id?: string;
  session_thread_id?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

async function processCustomToolUse(
  deps: WebhookHandlerDeps,
  envelope: WebhookEnvelope,
): Promise<WebhookHandlerResult> {
  const sessionId =
    typeof envelope.data.session_id === 'string' ? envelope.data.session_id : null;
  if (!sessionId) {
    return {
      status: 400,
      body: { error: 'bad_request', reason: 'custom_tool_use event missing session_id' },
    };
  }

  let fullEvent: CustomToolUseFullEvent;
  try {
    fullEvent = await deps.client.getSessionEvent<CustomToolUseFullEvent>(
      sessionId,
      envelope.data.id,
    );
  } catch (err) {
    return {
      status: 500,
      body: {
        error: 'internal',
        reason: `event fetch failed: ${(err as Error).message}`,
      },
    };
  }

  const sectionId = sectionIdForToolName(fullEvent.name);
  if (!sectionId) {
    // Not a save_section_artifact-family tool — possibly fetch_competitor_ads
    // or another auxiliary. Acknowledge but don't process here in P1.
    return {
      status: 200,
      body: {
        received: true,
        processed: false,
        reason: `unhandled_tool: ${fullEvent.name}`,
      },
    };
  }

  // The agent input is expected to carry section_run_id (the coordinator
  // delegates with that id baked into the user.message it sends each
  // specialist; the specialist passes it back in its custom-tool call).
  const sectionRunId =
    typeof fullEvent.input?.section_run_id === 'string'
      ? fullEvent.input.section_run_id
      : typeof fullEvent.metadata?.section_run_id === 'string'
        ? (fullEvent.metadata.section_run_id as string)
        : null;
  if (!sectionRunId) {
    return {
      status: 400,
      body: {
        error: 'bad_request',
        reason: 'save_section_artifact call missing section_run_id in input/metadata',
      },
    };
  }

  const context = await deps.supabase.loadSectionRunContext(sectionRunId);
  if (!context) {
    return {
      status: 400,
      body: {
        error: 'bad_request',
        reason: `section_run_id ${sectionRunId} not found`,
      },
    };
  }
  if (context.error) {
    return {
      status: 500,
      body: { error: 'internal', reason: context.error },
    };
  }
  if (context.sectionType !== sectionId) {
    return {
      status: 400,
      body: {
        error: 'bad_request',
        reason: `section_run ${sectionRunId} is ${context.sectionType}; tool was ${fullEvent.name} (${sectionId})`,
      },
    };
  }

  const validation = validateArtifactForSection(
    sectionId,
    (fullEvent.input ?? {}).artifact,
  );
  if (!validation.ok) {
    return handleInvalidArtifact({
      deps,
      sessionId,
      sessionThreadId: fullEvent.session_thread_id ?? null,
      customToolUseId: fullEvent.id,
      sectionRunId,
      sectionId,
      repairFeedback: validation.repairFeedback,
    });
  }

  // Commit the artifact through the existing RPC.
  const patch = buildCommitPatch(sectionId, validation.artifact);
  const commit = await deps.supabase.commitArtifactSection({
    artifactId: context.artifactId,
    zone: sectionId,
    sectionRunId,
    expectedRevision: context.expectedRevision,
    patch,
  });
  if (!commit.ok) {
    if (commit.conflict) {
      // The artifact row was concurrently superseded. We still ack the agent
      // with ok:false so it can decide whether to retry — but do not crash.
      await deps.client.sendCustomToolResult(sessionId, {
        customToolUseId: fullEvent.id,
        sessionThreadId: fullEvent.session_thread_id ?? null,
        result: {
          ok: false,
          repair_feedback:
            'Section artifact was superseded by a newer revision while this run was working. Abort this attempt.',
          conflict: true,
        },
      });
      return {
        status: 200,
        body: { received: true, processed: true, reason: 'commit_conflict' },
      };
    }
    return {
      status: 500,
      body: {
        error: 'internal',
        reason: `commit_artifact_section failed: ${commit.error ?? 'unknown'}`,
      },
    };
  }

  await deps.client.sendCustomToolResult(sessionId, {
    customToolUseId: fullEvent.id,
    sessionThreadId: fullEvent.session_thread_id ?? null,
    result: {
      ok: true,
      accepted: true,
      section_type: sectionId,
      revision: commit.revision,
    },
  });

  return {
    status: 200,
    body: { received: true, processed: true },
  };
}

async function handleInvalidArtifact(input: {
  deps: WebhookHandlerDeps;
  sessionId: string;
  sessionThreadId: string | null;
  customToolUseId: string;
  sectionRunId: string;
  sectionId: PositioningSectionId;
  repairFeedback: string;
}): Promise<WebhookHandlerResult> {
  const max =
    input.deps.maxCustomToolRetries ??
    Number(process.env.MANAGED_AGENTS_MAX_CUSTOM_TOOL_RETRIES ?? DEFAULT_MAX_CUSTOM_TOOL_RETRIES);

  const countResult = await input.deps.supabase.countWebhookEvents({
    sectionRunId: input.sectionRunId,
    eventType: 'save_section_artifact_rejected',
  });
  const priorRejections = countResult.count;
  const attempt = priorRejections + 1; // this rejection is the (priorRejections+1)-th

  await input.deps.supabase.insertWebhookEvent({
    event_id: `rejected_${input.customToolUseId}`,
    session_id: input.sessionId,
    session_thread_id: input.sessionThreadId,
    artifact_id: null,
    section_run_id: input.sectionRunId,
    section_type: input.sectionId,
    event_type: 'save_section_artifact_rejected',
    created_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
    payload: { repair_feedback: input.repairFeedback, attempt },
  });

  if (attempt >= max) {
    // R5 — force-error and interrupt.
    await input.deps.supabase.markSectionError({
      sectionRunId: input.sectionRunId,
      error: {
        message: 'save_section_artifact exceeded retry ceiling',
        attempt,
        threshold: max,
        last_repair_feedback: input.repairFeedback,
      },
    });
    if (input.sessionThreadId) {
      try {
        await input.deps.client.interruptThread(
          input.sessionId,
          input.sessionThreadId,
          `Aborting ${input.sectionId} — save_section_artifact has been rejected ${attempt} times.`,
        );
      } catch (err) {
        // Interrupt-best-effort.
        return {
          status: 200,
          body: {
            received: true,
            processed: true,
            reason: `force_error_no_interrupt: ${(err as Error).message}`,
          },
        };
      }
    }
    return {
      status: 200,
      body: { received: true, processed: true, reason: 'retry_ceiling_reached' },
    };
  }

  await input.deps.client.sendCustomToolResult(input.sessionId, {
    customToolUseId: input.customToolUseId,
    sessionThreadId: input.sessionThreadId,
    result: {
      ok: false,
      accepted: false,
      attempt,
      max_attempts: max,
      repair_feedback: input.repairFeedback,
    },
  });

  return {
    status: 200,
    body: { received: true, processed: true, reason: 'repair_requested' },
  };
}

/**
 * Builds the normalized commit_artifact_section patch from a validated
 * section artifact. Mirrors the worker-side projection so the React UI
 * keeps rendering identical content.
 */
export function buildCommitPatch(
  sectionId: PositioningSectionId,
  artifact: unknown,
): CommitArtifactSectionInput['patch'] {
  const a = artifact as Record<string, unknown>;
  const title = typeof a.sectionTitle === 'string'
    ? a.sectionTitle
    : sectionArtifactSchemas[sectionId].label;
  const summary = typeof a.statusSummary === 'string' ? a.statusSummary : null;
  const verdict = typeof a.verdict === 'string' ? a.verdict : null;
  const markdownLines: string[] = [];
  if (verdict) markdownLines.push(`**Verdict:** ${verdict}`);
  if (summary) markdownLines.push('', summary);
  const markdown = markdownLines.join('\n');

  return {
    status: 'complete',
    title,
    markdown,
    data: artifact,
    claims: [],
    sources: Array.isArray(a.sources) ? (a.sources as unknown[]) : [],
    error: null,
  };
}
