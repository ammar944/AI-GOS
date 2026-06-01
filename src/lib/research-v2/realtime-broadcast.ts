import type { SectionPartialPublishInput } from './section-partial-broadcaster';
import { makeSectionPartialPayload } from './section-partial-broadcaster';

export class RealtimeBroadcastError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RealtimeBroadcastError';
  }
}

export async function broadcastSectionPartial(
  input: SectionPartialPublishInput,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl === undefined || supabaseUrl.trim().length === 0) {
    throw new RealtimeBroadcastError(
      'NEXT_PUBLIC_SUPABASE_URL is required to broadcast section partials.',
    );
  }

  if (serviceRoleKey === undefined || serviceRoleKey.trim().length === 0) {
    throw new RealtimeBroadcastError(
      'SUPABASE_SERVICE_ROLE_KEY is required to broadcast section partials.',
    );
  }

  const topic = `section-partials:${input.runId}`;
  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
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

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new RealtimeBroadcastError(
      `Supabase realtime broadcast failed for topic ${topic}: status=${response.status} body=${body.slice(0, 300)}`,
    );
  }
}
