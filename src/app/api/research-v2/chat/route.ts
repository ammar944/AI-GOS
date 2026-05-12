import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { classifyIntent } from '@/lib/research-v2/intent-router';
import type {
  AuditContextSummary,
  ChatMessageForRouter,
  SectionSummary,
} from '@/lib/research-v2/intent-router.types';
import { applyPatch } from '@/lib/research-v2/patch-apply';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const chatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(chatTextPartSchema),
});

const chatRequestSchema = z.object({
  runId: z.string().trim().min(1),
  messages: z.array(chatMessageSchema).min(1),
});

type ChatRequestBody = z.infer<typeof chatRequestSchema>;
type ChatRequestMessage = ChatRequestBody['messages'][number];

interface AuditChatInsert {
  run_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: 'rerun' | 'patch' | 'converse';
  target_section?: string | null;
}

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
  const { runId, messages } = body;
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

  const intent = await classifyIntent({
    userMessage: userText,
    auditContext,
    chatHistory,
  });

  if (
    intent.kind === 'patch' &&
    intent.target_section &&
    intent.patch &&
    isRecord(researchResults[intent.target_section])
  ) {
    const wrapper = researchResults[intent.target_section] as Record<
      string,
      unknown
    >;
    const isWrapped = isRecord(wrapper.data);
    const inner = isWrapped
      ? (wrapper.data as Record<string, unknown>)
      : wrapper;

    try {
      const patchedInner = applyPatch(inner, intent.patch);
      const newSection: Record<string, unknown> = isWrapped
        ? { ...wrapper, data: patchedInner }
        : { ...patchedInner };

      // Use the atomic per-section JSONB merge RPC. Writing the whole
      // research_results column back would clobber any concurrent worker
      // section write that landed between our read and write.
      const { error: rpcError } = await supabase.rpc(
        'merge_journey_session_research_result',
        {
          p_user_id: userId,
          p_run_id: runId,
          p_section: intent.target_section,
          p_result: newSection,
        },
      );

      if (rpcError) {
        logSupabaseError(
          'merge_research_results_patch',
          { runId, userId },
          rpcError,
        );
        throw new Error(`Failed to persist patch: ${rpcError.message}`);
      }

      const ackText = `Updated ${intent.target_section} → ${intent.patch.path} = ${JSON.stringify(intent.patch.value)}`;

      const assistantInsert: AuditChatInsert = {
        run_id: runId,
        user_id: userId,
        role: 'assistant',
        content: ackText,
        intent: 'patch',
        target_section: intent.target_section,
      };
      const { error: ackInsertError } = await supabase
        .from('audit_chat_messages')
        .insert(assistantInsert);

      if (ackInsertError) {
        logSupabaseError(
          'insert_patch_ack',
          { runId, userId, role: 'assistant' },
          ackInsertError,
        );
      }

      const ackStream = streamText({
        model: anthropic('claude-haiku-4-5-20251001'),
        system:
          'You are an audit-editing assistant. Output exactly the user-supplied text — no rephrasing, no additions.',
        prompt: ackText,
      });
      return ackStream.toUIMessageStreamResponse();
    } catch (err) {
      console.error('[research-v2/chat] Patch apply failed', {
        runId,
        userId,
        targetSection: intent.target_section,
        path: intent.patch.path,
        message: err instanceof Error ? err.message : String(err),
      });
      // Fall through to converse path so the user still gets a response.
    }
  }

  if (intent.kind === 'rerun' && intent.target_section) {
    // Dispatch synchronously so we can surface a real error to the user
    // instead of telling them the job was queued when it wasn't. A 10s
    // AbortController guards against a stuck worker hanging the chat reply.
    const dispatchUrl = new URL('/api/research-v2/dispatch', req.url).toString();
    const refinement = intent.instruction.trim();

    let dispatchOk = false;
    let dispatchFailureReason: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({
          sectionId: intent.target_section,
          runId,
          chatRefinement: intent.instruction,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        dispatchOk = true;
      } else {
        dispatchFailureReason = `${res.status} ${res.statusText || 'error'}`;
        console.error('[research-v2/chat] Rerun dispatch returned non-ok', {
          runId,
          userId,
          targetSection: intent.target_section,
          status: res.status,
          statusText: res.statusText,
        });
      }
    } catch (dispatchError) {
      const isAbort =
        dispatchError instanceof Error && dispatchError.name === 'AbortError';
      dispatchFailureReason = isAbort
        ? 'timeout after 10s'
        : dispatchError instanceof Error
          ? dispatchError.message
          : String(dispatchError);
      console.error('[research-v2/chat] Rerun dispatch fetch failed', {
        runId,
        userId,
        targetSection: intent.target_section,
        message: dispatchFailureReason,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const ackText = dispatchOk
      ? refinement
        ? `Rerunning ${intent.target_section} with refinement: "${refinement}". Watch the section activity log for live progress.`
        : `Rerunning ${intent.target_section}. Watch the section activity log for live progress.`
      : `Couldn't queue rerun for ${intent.target_section}: ${dispatchFailureReason ?? 'unknown error'}. Please try again.`;

    const assistantInsert: AuditChatInsert = {
      run_id: runId,
      user_id: userId,
      role: 'assistant',
      content: ackText,
      intent: 'rerun',
      target_section: intent.target_section,
    };
    const { error: ackInsertError } = await supabase
      .from('audit_chat_messages')
      .insert(assistantInsert);

    if (ackInsertError) {
      logSupabaseError(
        dispatchOk ? 'insert_rerun_ack' : 'insert_rerun_failure_ack',
        { runId, userId, role: 'assistant' },
        ackInsertError,
      );
    }

    const ackStream = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system:
        'You are an audit-editing assistant. Output exactly the user-supplied text — no rephrasing, no additions.',
      prompt: ackText,
    });
    return ackStream.toUIMessageStreamResponse();
  }

  // Converse path — fall-through default. Ground the model in a slim summary of
  // every section the runner has produced so it can reference specific findings
  // when the user asks follow-up questions. Empty audits (no sections yet) get
  // an explicit note rather than a blank summary.
  const auditSummary = auditContext.sections
    .map(
      (s) =>
        `## ${s.title}\nStatus: ${s.statusSummary}\nKey findings: ${s.keyFindingTitles.join('; ')}`,
    )
    .join('\n\n');

  const conversationSystem = `You are an audit-editing assistant helping a strategist refine a Pre-Pitch Positioning Audit. The user has 6 positioning sections; ${
    auditContext.sections.length > 0
      ? `here is a summary of what's been generated:\n\n${auditSummary}`
      : 'the audit has not generated any sections yet.'
  }

Answer the user's question grounded in the audit above. If they ask for clarification on a section, refer to specific findings. If they ask a question that would require running new research or modifying a section, you may suggest "I can rerun the [section] with that refinement — want me to?" but do not actually trigger anything; this turn is conversational only.`;

  const conversation = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: conversationSystem,
    messages: await convertToModelMessages(body.messages as never),
    async onFinish({ text }) {
      const assistantInsert: AuditChatInsert = {
        run_id: runId,
        user_id: userId,
        role: 'assistant',
        content: text,
        intent: 'converse',
      };
      const { error: assistantInsertError } = await supabase
        .from('audit_chat_messages')
        .insert(assistantInsert);

      if (assistantInsertError) {
        logSupabaseError(
          'insert_assistant_message',
          { runId, userId, role: 'assistant' },
          assistantInsertError,
        );
      }
    },
    onError({ error }) {
      console.error('[research-v2/chat] Converse stream failed', {
        runId,
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return conversation.toUIMessageStreamResponse();
}
