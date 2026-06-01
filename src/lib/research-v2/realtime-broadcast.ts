import type { SectionPartialPublishInput } from './section-partial-broadcaster';
import { makeSectionPartialPayload } from './section-partial-broadcaster';

export interface RealtimeBroadcastErrorContext {
  channel?: string;
  originalMessage?: string;
  responseBody?: string;
  runId?: string;
  sectionId?: string;
  seq?: number;
  status?: number;
  topic?: string;
}

export class RealtimeBroadcastError extends Error {
  public readonly context: RealtimeBroadcastErrorContext;

  public constructor(
    message: string,
    context: RealtimeBroadcastErrorContext = {},
  ) {
    super(message);
    this.name = 'RealtimeBroadcastError';
    this.context = context;
  }
}

export async function broadcastSectionPartial(
  input: SectionPartialPublishInput,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const topic = `section-partials:${input.runId}`;
  const context = buildRealtimeBroadcastContext(input, topic);

  if (supabaseUrl === undefined || supabaseUrl.trim().length === 0) {
    throw new RealtimeBroadcastError(
      'NEXT_PUBLIC_SUPABASE_URL is required to broadcast section partials.',
      context,
    );
  }

  if (serviceRoleKey === undefined || serviceRoleKey.trim().length === 0) {
    throw new RealtimeBroadcastError(
      'SUPABASE_SERVICE_ROLE_KEY is required to broadcast section partials.',
      context,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: 'partial',
            payload: makeSectionPartialPayload(input),
          },
        ],
      }),
    });
  } catch (error: unknown) {
    const originalMessage = describeError(error);
    throw new RealtimeBroadcastError(
      `Supabase realtime broadcast failed for topic ${topic}: ${originalMessage}`,
      {
        ...context,
        originalMessage,
      },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const responseBody = body.slice(0, 300);
    throw new RealtimeBroadcastError(
      `Supabase realtime broadcast failed for topic ${topic}: status=${response.status} body=${responseBody}`,
      {
        ...context,
        originalMessage: `HTTP ${response.status}`,
        responseBody,
        status: response.status,
      },
    );
  }
}

function buildRealtimeBroadcastContext(
  input: SectionPartialPublishInput,
  topic: string,
): RealtimeBroadcastErrorContext {
  return {
    channel: topic,
    runId: input.runId,
    sectionId: input.sectionId,
    seq: input.seq,
    topic,
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
