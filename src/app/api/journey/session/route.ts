import { auth } from '@clerk/nextjs/server';
import { hydrateOnboardingState } from '@/lib/journey/session-state';
import { persistToSupabase } from '@/lib/journey/session-state.server';

interface JourneySessionPatchRequest {
  sessionId?: string;
  state?: unknown;
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: JourneySessionPatchRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return new Response(JSON.stringify({ error: 'sessionId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const state = hydrateOnboardingState(body.state);
  if (!state) {
    return new Response(JSON.stringify({ error: 'A valid journey state snapshot is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await persistToSupabase(userId, state, body.sessionId);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error ?? 'Failed to persist session state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
