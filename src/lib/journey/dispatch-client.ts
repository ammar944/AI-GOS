// Client-side helper to dispatch research sections via /api/journey/dispatch.
// Dispatches research sections to the Railway worker via /api/journey/dispatch.

export interface ClientDispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  error?: string;
}

export async function dispatchResearchSection(
  section: string,
  runId: string,
  context: string,
): Promise<ClientDispatchResult> {
  const res = await fetch('/api/journey/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, runId, context }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { status: 'error', section, error: `HTTP ${res.status}: ${body}` };
  }

  return res.json();
}
