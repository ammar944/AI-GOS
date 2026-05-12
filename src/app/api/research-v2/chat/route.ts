import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@clerk/nextjs/server';
import { type ModelMessage, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
  intent?: 'converse';
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

function buildEchoMessages(userText: string): ModelMessage[] {
  return [
    {
      role: 'user',
      content: userText,
    },
  ];
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
    .select('run_id')
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

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system:
      'You are an audit artifact editing assistant. This route is in stub mode: acknowledge receipt, summarize the requested edit, and explain that execution paths will be enabled next.',
    messages: buildEchoMessages(userText),
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
      console.error('[research-v2/chat] Assistant stream failed', {
        runId,
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
