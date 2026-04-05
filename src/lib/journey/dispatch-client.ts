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

/**
 * Dispatch identity resolution as a silent pre-step, then dispatch the target section.
 * Identity resolution runs the product identity resolver (~3-5s) and stores the result
 * in research_results.identityResolution. The intelligence chain automatically includes
 * it in all downstream contexts.
 *
 * If identity resolution fails or times out, proceeds to the target section anyway
 * (the pipeline works without it, just with lower accuracy).
 */
const IDENTITY_POLL_INTERVAL_MS = 1000;
const IDENTITY_POLL_MAX_WAIT_MS = 20000;

export async function dispatchWithIdentity(
  targetSection: string,
  runId: string,
  context: string,
): Promise<ClientDispatchResult> {
  // Step 1: Dispatch identity resolution
  const identityResult = await dispatchResearchSection('identityResolution', runId, context);

  if (identityResult.status === 'error') {
    // Identity failed to dispatch — proceed without it
    console.warn('[dispatch-client] Identity resolution dispatch failed, proceeding without:', identityResult.error);
    return dispatchResearchSection(targetSection, runId, context);
  }

  // Step 2: Poll for identity resolution completion
  const pollStart = Date.now();
  let identityReady = false;

  while (Date.now() - pollStart < IDENTITY_POLL_MAX_WAIT_MS) {
    await new Promise(resolve => setTimeout(resolve, IDENTITY_POLL_INTERVAL_MS));

    try {
      const checkRes = await fetch(`/api/journey/research-status?runId=${encodeURIComponent(runId)}&section=identityResolution`);
      if (checkRes.ok) {
        const status = await checkRes.json() as { complete: boolean };
        if (status.complete) {
          identityReady = true;
          break;
        }
      }
    } catch {
      // Poll failure is non-fatal — keep trying
    }
  }

  if (!identityReady) {
    console.warn('[dispatch-client] Identity resolution timed out after 15s, proceeding without');
  }

  // Step 3: Dispatch the target section (with or without identity)
  return dispatchResearchSection(targetSection, runId, context);
}
