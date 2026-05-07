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

/**
 * Sections that fan out in parallel after identity resolves.
 * All four only strictly require the identity card + raw onboarding context —
 * upstream wiki enrichment is a quality lift, not a correctness gate.
 * keywordIntel / crossAnalysis / mediaPlan stay sequential because they
 * need the full research picture.
 */
export const WAVE_1_PARALLEL_SECTIONS = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
] as const;

export type Wave1Section = (typeof WAVE_1_PARALLEL_SECTIONS)[number];

/**
 * Wave-2 sections that can run in parallel after wave-1 completes.
 *
 * `keywordIntel` consumes whatever snapshots exist in the context (its
 * recovery context extractor tolerates a missing Strategic Synthesis block
 * — see `summarizeKeywordStrategicSynthesis` in research-worker/src/runners/
 * keywords.ts, which returns null when the block is absent). `crossAnalysis`
 * (the synthesis runner) only needs the four wave-1 artifacts.
 *
 * Running them serially added ~117s of sequential tail after the user
 * approved offerAnalysis (117s keywords + 117s synthesis). Running them in
 * parallel cuts that tail to ~max(117, 117) ≈ 117s.
 */
export const WAVE_2_PARALLEL_SECTIONS = [
  'keywordIntel',
  'crossAnalysis',
] as const;

export const DEEP_RESEARCH_PROGRAM_SECTIONS = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'crossAnalysis',
  'keywordIntel',
  'offerAnalysis',
] as const;

export type Wave2Section = (typeof WAVE_2_PARALLEL_SECTIONS)[number];

export interface ParallelDispatchResult {
  identity: ClientDispatchResult;
  wave1: Record<Wave1Section, ClientDispatchResult>;
}

/**
 * Dispatch identity first, then fan out the four independent research
 * stages in parallel. Cuts the critical path from ~350s sequential to
 * ~max(industry, icp, competitors, offer) ≈ 130s.
 */
export async function dispatchAllResearchParallel(
  runId: string,
  context: string,
): Promise<ParallelDispatchResult> {
  // Step 1: Dispatch identity and wait until it writes a complete row.
  // Identity is still a blocking pre-step because the wave-1 runners use
  // the identityCard in their context construction.
  const identityResult = await dispatchResearchSection(
    'identityResolution',
    runId,
    context,
  );

  if (identityResult.status === 'error') {
    console.warn(
      '[dispatch-client] Identity dispatch failed — firing wave-1 without identity:',
      identityResult.error,
    );
  } else {
    const pollStart = Date.now();
    while (Date.now() - pollStart < IDENTITY_POLL_MAX_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, IDENTITY_POLL_INTERVAL_MS));
      try {
        const checkRes = await fetch(
          `/api/journey/research-status?runId=${encodeURIComponent(runId)}&section=identityResolution`,
        );
        if (checkRes.ok) {
          const status = (await checkRes.json()) as { complete: boolean };
          if (status.complete) break;
        }
      } catch {
        // keep trying — poll failures are non-fatal
      }
    }
  }

  // Step 2: Fan out wave-1 sections in parallel. Each returns its own
  // { status, section, jobId } — callers can correlate with realtime events.
  const wave1Entries = await Promise.all(
    WAVE_1_PARALLEL_SECTIONS.map(
      async (section) =>
        [section, await dispatchResearchSection(section, runId, context)] as const,
    ),
  );

  const wave1 = Object.fromEntries(wave1Entries) as Record<
    Wave1Section,
    ClientDispatchResult
  >;

  return { identity: identityResult, wave1 };
}

/**
 * Fan out wave-2 sections (keywordIntel, crossAnalysis) in parallel.
 *
 * Called after the user approves `offerAnalysis` — at that point all four
 * wave-1 artifacts exist in research_results, which is everything the two
 * wave-2 runners need. Previously the approval handler ran them serially
 * via the `getNextSection` walk (keywords → synthesis), which added ~117s
 * of tail after offer approval. Firing both now overlaps the wall time.
 */
export async function dispatchWave2Parallel(
  runId: string,
  context: string,
): Promise<Record<Wave2Section, ClientDispatchResult>> {
  const entries = await Promise.all(
    WAVE_2_PARALLEL_SECTIONS.map(
      async (section) =>
        [section, await dispatchResearchSection(section, runId, context)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<Wave2Section, ClientDispatchResult>;
}

/**
 * One-pass Anthropic deep research program. The worker writes six section
 * artifacts from one shared evidence corpus.
 */
export async function dispatchDeepResearchProgram(
  runId: string,
  context: string,
): Promise<ClientDispatchResult> {
  return dispatchResearchSection('deepResearchProgram', runId, context);
}
