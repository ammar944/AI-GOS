# Research Pipeline Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the end-to-end research pipeline against silent failures — dispatch retries, Supabase error surfacing, worker job durability, user-visible error states, synthesis readiness gating, and startup environment validation.

**Architecture:** Six independent hardening layers, each targeting a specific failure mode: (1) transient network retry on dispatch, (2) observable Supabase writes with return values, (3) worker job durability via status rows written before execution, (4) explicit user-visible error messaging from the lead agent, (5) synthesis readiness polling from the lead agent before calling `synthesizeResearch`, (6) startup environment validation logged on every cold start.

**Tech Stack:** TypeScript, Zod, Vitest (unit tests in `src/`), Express (worker in `research-worker/`), `@supabase/supabase-js`, Vercel AI SDK `tool()`, existing `createAdminClient()` pattern.

---

### Task 1: Retry Wrapper on dispatch.ts

**Files:**
- Modify: `src/lib/ai/tools/research/dispatch.ts` (full file — add `withRetry` wrapper around the `/run` fetch call)
- Create: `src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts`

**Step 1: Write the test first**

```typescript
// src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth and fetch before importing dispatch
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: build a minimal Response-like object
function makeResponse(status: number, body = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Response;
}

describe('dispatchResearch retry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAILWAY_WORKER_URL = 'http://localhost:3001';
    process.env.RAILWAY_API_KEY = 'dev-secret';
  });

  it('succeeds on the first attempt when /run returns 202', async () => {
    // Health check + dispatch both succeed first try
    mockFetch
      .mockResolvedValueOnce(makeResponse(200)) // /health
      .mockResolvedValueOnce(makeResponse(202)); // /run

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries /run up to 3 times on network error before returning error', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))        // /health ok
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 1
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 2
      .mockRejectedValueOnce(new Error('ECONNREFUSED')); // attempt 3

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    // health + 3 dispatch attempts = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('succeeds on second attempt if first /run throws', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))         // /health ok
      .mockRejectedValueOnce(new Error('fetch failed')) // attempt 1 fails
      .mockResolvedValueOnce(makeResponse(202));         // attempt 2 succeeds

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on a 400 non-retryable worker response', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))         // /health ok
      .mockResolvedValueOnce(makeResponse(400, 'bad')); // /run 400 — not retryable

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    // health + 1 dispatch attempt only (no retry on 4xx)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run the test to confirm it fails (TDD red)**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts`

Expected: Tests fail — retry logic does not exist yet.

**Step 3: Add the retry wrapper to dispatch.ts**

Replace the `try/catch` block around the `/run` fetch (lines 56-77 of the current file) with a `withRetry` helper. The complete updated file:

```typescript
// src/lib/ai/tools/research/dispatch.ts
// Dispatch a research job to the Railway worker.
// Returns immediately (fire-and-forget from the lead agent's perspective).

import { auth } from '@clerk/nextjs/server';

export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  error?: string;
}

// Retry a fetch call up to maxAttempts times on network errors only.
// Does NOT retry on HTTP 4xx/5xx — those are deterministic failures.
async function withRetry(
  fn: () => Promise<Response>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isNetworkError =
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.includes('fetch failed') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('network'));
      if (!isNetworkError || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
      console.warn(`[dispatch] ${label} attempt ${attempt} failed — retrying in ${delay}ms:`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function dispatchResearch(
  tool: string,
  section: string,
  context: string,
): Promise<DispatchResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', section, error: 'Unauthorized' };
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const apiKey = process.env.RAILWAY_API_KEY;

  if (!workerUrl) {
    console.error(
      '[dispatch] RAILWAY_WORKER_URL not set — research cannot run. ' +
      'Set RAILWAY_WORKER_URL in .env.local (run worker with: cd research-worker && npm run dev)'
    );
    return {
      status: 'error',
      section,
      error: 'Research worker not reachable. RAILWAY_WORKER_URL is not configured.',
    };
  }

  // Quick health check — fail fast if worker is unreachable
  try {
    const health = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!health.ok) {
      return { status: 'error', section, error: `Worker unhealthy: ${health.status}` };
    }
  } catch {
    return {
      status: 'error',
      section,
      error: 'Research worker is not reachable. Check RAILWAY_WORKER_URL and ensure the worker is running.',
    };
  }

  const jobId = crypto.randomUUID();

  try {
    const res = await withRetry(
      () =>
        fetch(`${workerUrl}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ tool, context, userId, jobId }),
          signal: AbortSignal.timeout(5000),
        }),
      tool,
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[dispatch] Worker rejected ${tool}: ${res.status} ${body}`);
      return { status: 'error', section, error: `Worker error: ${res.status}` };
    }

    return { status: 'queued', section, jobId };
  } catch (error) {
    console.error(`[dispatch] Failed to reach worker for ${tool} after retries:`, error);
    return {
      status: 'error',
      section,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**Step 4: Run the test to confirm it passes (TDD green)**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts`

Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add src/lib/ai/tools/research/dispatch.ts src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts
git commit -m "feat: add retry wrapper to dispatchResearch — 3 attempts with exponential backoff on network errors"
```

---

### Task 2: Fix Silent Supabase Failures in session-state.server.ts

**Files:**
- Modify: `src/lib/journey/session-state.server.ts` (full file — add retry, return observable result)
- Modify: `src/app/api/journey/stream/route.ts:83-94` (update callers to log the returned error)
- Create: `src/lib/journey/__tests__/session-state-server.test.ts`

**Step 1: Write the test first**

```typescript
// src/lib/journey/__tests__/session-state-server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/nextjs/server so createAdminClient can be imported
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock createAdminClient
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
      upsert: mockUpsert,
    })),
  })),
}));

describe('persistResearchToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { ok: true } on successful write', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-1', { industryMarket: { status: 'complete' } });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns { ok: false, error } when Supabase returns an error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'connection refused', code: '08006' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-2', { industryMarket: { status: 'complete' } });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection refused');
  });

  it('retries once on a transient Supabase error before returning failure', async () => {
    // First call fails, second succeeds
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: null });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-3', { industryMarket: {} });

    expect(result.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('returns { ok: false } after 2 failed attempts', async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: { message: 'timeout again', code: '57014' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-4', { industryMarket: {} });

    expect(result.ok).toBe(false);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run the test to confirm it fails (TDD red)**

Run: `npm run test:run -- src/lib/journey/__tests__/session-state-server.test.ts`

Expected: Tests fail — `persistResearchToSupabase` currently returns `void`, not `{ ok, error }`.

**Step 3: Update session-state.server.ts**

Replace the file entirely:

```typescript
// src/lib/journey/session-state.server.ts
import { createAdminClient } from '@/lib/supabase/server';

// ── Supabase Persistence ───────────────────────────────────────────────────
// Per DISCOVERY.md D11 (REVISED): Fetch-then-merge JSONB metadata column.
//
// Server-only: This file imports @/lib/supabase/server which transitively
// imports @clerk/nextjs/server. Must NOT be imported from client components.

export interface PersistResult {
  ok: boolean;
  error?: string;
}

// Transient Supabase error codes worth retrying (connection/timeout issues)
const RETRYABLE_PG_CODES = new Set(['08006', '08001', '57014', '40001', '40P01']);

function isRetryableSupabaseError(err: { code?: string; message?: string }): boolean {
  if (err.code && RETRYABLE_PG_CODES.has(err.code)) return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('timeout') || msg.includes('connection') || msg.includes('reset');
}

export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
): Promise<PersistResult> {
  try {
    const supabase = createAdminClient();

    // Fetch current metadata (D13: fetch-then-merge pattern)
    const { data: existing } = await supabase
      .from('journey_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const currentMetadata =
      (existing?.metadata as Record<string, unknown>) || {};

    // Shallow merge — new fields overwrite existing, preserving untouched fields
    const merged = {
      ...currentMetadata,
      ...fields,
      lastUpdated: new Date().toISOString(),
    };

    // Upsert (D12: one session per user, UNIQUE on user_id)
    const { error } = await supabase.from('journey_sessions').upsert(
      {
        user_id: userId,
        metadata: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[journey] Supabase persistToSupabase failed:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[journey] Supabase persistence threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}

export async function persistResearchToSupabase(
  userId: string,
  research: Record<string, unknown>,
  attempt = 1,
): Promise<PersistResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('journey_sessions')
      .upsert(
        { user_id: userId, research_output: research, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) {
      const shouldRetry = attempt < 2 && isRetryableSupabaseError(error);
      if (shouldRetry) {
        console.warn(`[journey] Supabase write failed (attempt ${attempt}) — retrying in 1s:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return persistResearchToSupabase(userId, research, attempt + 1);
      }
      console.error(`[journey] persistResearchToSupabase failed after ${attempt} attempt(s):`, error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey] persistResearchToSupabase threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}
```

**Step 4: Update callers in route.ts**

The two fire-and-forget blocks in `src/app/api/journey/stream/route.ts` (lines 83-94) currently swallow errors silently. Update them to log the returned error:

```typescript
// Replace lines 84-88 (persistToSupabase call):
persistToSupabase(userId, askUserFields).then((result) => {
  if (!result.ok) {
    console.error('[journey/stream] askUser persist failed:', result.error);
  }
});

// Replace lines 92-94 (persistResearchToSupabase call):
persistResearchToSupabase(userId, researchOutputs).then((result) => {
  if (!result.ok) {
    console.error('[journey/stream] research persist failed:', result.error);
  }
});
```

**Step 5: Run the tests to confirm passing (TDD green)**

Run: `npm run test:run -- src/lib/journey/__tests__/session-state-server.test.ts`

Expected: All 4 tests pass.

**Step 6: Commit**

```bash
git add src/lib/journey/session-state.server.ts src/lib/journey/__tests__/session-state-server.test.ts src/app/api/journey/stream/route.ts
git commit -m "feat: observable Supabase writes in session-state.server — return PersistResult, retry on transient errors, log failures"
```

---

### Task 3: Fix Worker setImmediate — Write Job Status Before Execution

**Files:**
- Modify: `research-worker/src/supabase.ts` — add `writeJobStatus()` function
- Modify: `research-worker/src/index.ts` — replace `setImmediate` with job-status-anchored execution

**Context:** The current `setImmediate(async () => { ... })` pattern means if the worker process crashes between returning 202 and the callback firing, the job is permanently lost with no trace. The fix writes a `{ status: 'running' }` row to Supabase synchronously before returning 202. If the process crashes, the row stays as `running` indefinitely — detectable by a future monitoring pass.

**Step 1: Add writeJobStatus to research-worker/src/supabase.ts**

Append the following function to the existing file (do not replace — preserve `writeResearchResult`):

```typescript
// research-worker/src/supabase.ts (append after writeResearchResult)

export type JobStatus = 'running' | 'complete' | 'error';

export interface JobStatusRow {
  status: JobStatus;
  tool: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Write a job status entry into journey_sessions.job_status JSONB column.
 * Called synchronously before the job runs (status: 'running') and again
 * on completion or failure. This anchors every job in Supabase so crashes
 * leave a detectable 'running' record rather than silent data loss.
 */
export async function writeJobStatus(
  userId: string,
  jobId: string,
  row: JobStatusRow,
): Promise<void> {
  const supabase = getClient();

  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, job_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !session) {
    console.error(`[supabase] writeJobStatus: no session for user ${userId}:`, fetchError?.message);
    return;
  }

  const existing = (session.job_status as Record<string, unknown>) ?? {};
  const updated = { ...existing, [jobId]: row };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ job_status: updated })
    .eq('id', session.id);

  if (updateError) {
    console.error(`[supabase] writeJobStatus failed for job ${jobId}:`, updateError.message);
  }
}
```

**Step 2: Update research-worker/src/index.ts — replace setImmediate**

Replace the `/run` route handler (lines 68-101) with this durable pattern:

```typescript
// research-worker/src/index.ts — /run route (replace existing handler)
app.post('/run', requireApiKey, async (req: express.Request, res: express.Response) => {
  const { tool, context, userId, jobId } = req.body as RunJobRequest;

  if (!tool || !context || !userId || !jobId) {
    res.status(400).json({ error: 'tool, context, userId, jobId are required' });
    return;
  }

  const runner = TOOL_RUNNERS[tool];
  if (!runner) {
    res.status(400).json({ error: `Unknown tool: ${tool}` });
    return;
  }

  // Write job status to Supabase BEFORE returning 202.
  // If the process crashes after this point, the row stays as 'running'
  // — detectable rather than silently lost.
  try {
    await writeJobStatus(userId, jobId, {
      status: 'running',
      tool,
      startedAt: new Date().toISOString(),
    });
  } catch (statusErr) {
    // Non-fatal — log and proceed. Research is more important than status tracking.
    console.error(`[worker] writeJobStatus failed for ${jobId}:`, statusErr);
  }

  // Return 202 now — job continues asynchronously in background
  res.status(202).json({ status: 'accepted', jobId });

  // Run the job in a detached async context. This is intentional — we've
  // already committed the job to Supabase above, so crashes are observable.
  void (async () => {
    console.log(`[worker] Starting ${tool} for user ${userId} (job ${jobId})`);
    const startMs = Date.now();
    try {
      const result = await runner(context);
      await writeResearchResult(userId, result.section, result);
      await writeJobStatus(userId, jobId, {
        status: 'complete',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
      });
      console.log(`[worker] Completed ${tool} for user ${userId} in ${result.durationMs}ms`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Unhandled error in ${tool}:`, error);
      await writeResearchResult(userId, tool, {
        status: 'error',
        section: tool,
        error: errorMsg,
        durationMs: Date.now() - startMs,
      });
      await writeJobStatus(userId, jobId, {
        status: 'error',
        tool,
        startedAt: new Date(startMs).toISOString(),
        completedAt: new Date().toISOString(),
        error: errorMsg,
      });
    }
  })();
});
```

Also add the `writeJobStatus` import to the top of `research-worker/src/index.ts`:

```typescript
import { writeResearchResult, writeJobStatus, type ResearchResult } from './supabase';
```

**Step 3: Add the job_status column migration note**

The `job_status` JSONB column must exist on `journey_sessions`. Add a comment block to the top of `research-worker/src/supabase.ts` documenting the required schema:

```typescript
// Required Supabase column (add via migration if not present):
// ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS job_status JSONB DEFAULT '{}';
```

**Step 4: Build the worker to verify TypeScript compiles**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker && npx tsc --noEmit`

Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add research-worker/src/supabase.ts research-worker/src/index.ts
git commit -m "feat: anchor worker jobs in Supabase before execution — replace setImmediate with durable job_status pattern"
```

---

### Task 4: User-Visible Error States in Lead Agent System Prompt

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts` — update the research error handling paragraph

**Context:** The current prompt (line 210) says: `"When research errors return { status: 'error' }, acknowledge in one sentence ('One research track hit an issue — I'll work with what we have') then continue as normal."` This is deliberately vague — agents follow it literally and move on without surfacing what failed. The fix makes the agent name which section failed and state explicitly what it's doing instead.

**Step 1: Update the research error handling rule in the system prompt**

In `src/lib/ai/prompts/lead-agent-system.ts`, locate line 210 (the `{ status: 'error' }` paragraph) and replace it:

Current text:
```
- When research errors return `{ status: 'error' }`, acknowledge in one sentence ("One research track hit an issue — I'll work with what we have") then continue as normal. Do not dwell on it.
```

Replace with:
```
- When a research tool returns `{ status: 'error' }`, you MUST surface it explicitly in chat. Name the failed section and explain what you're doing with available data. Use this pattern:

  "Research on [section] didn't complete — [brief reason if error message is informative, otherwise omit]. I'll build the strategy from the data I have on [what's available]."

  Then immediately continue: ask the next onboarding question or share a preliminary insight. Do NOT say "everything is fine" or imply the research completed. Do NOT re-run the tool automatically — the system will surface a retry option. Never go silent after a tool error.
```

**Step 2: Verify the system prompt still exports correctly**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds (no TypeScript errors).

**Step 3: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "feat: surface research tool errors explicitly in lead agent — name failed section and state fallback strategy"
```

---

### Task 5: Synthesis Readiness Polling Before synthesizeResearch

**Files:**
- Create: `src/lib/journey/research-readiness.ts` — polls Supabase for completed research sections
- Create: `src/lib/journey/__tests__/research-readiness.test.ts`
- Modify: `src/lib/ai/tools/research/synthesize-research.ts` — gate synthesis on readiness check

**Context:** Currently `synthesizeResearch` is dispatched by the lead agent as soon as the 4 prior tools return `{ status: 'queued' }`. But the Railway worker may still be running those sections. The system prompt says "only call when all 4 prior tools have completed successfully" — but the agent has no mechanism to verify this. The fix adds a readiness poll: query `journey_sessions.research_results` for the 4 prerequisite sections before dispatching synthesis. If not ready after 5 minutes, dispatch anyway with a warning.

**Step 1: Write the test first**

```typescript
// src/lib/journey/__tests__/research-readiness.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}));

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      single: mockSingle,
    })),
  })),
}));

describe('waitForResearchReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when all 4 sections are already complete', async () => {
    mockSingle.mockResolvedValue({
      data: {
        research_results: {
          industryMarket: { status: 'complete' },
          competitors: { status: 'complete' },
          icpValidation: { status: 'complete' },
          offerAnalysis: { status: 'complete' },
        },
      },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.completedSections).toHaveLength(4);
  });

  it('polls and resolves when sections complete during wait', async () => {
    // First poll: 2 sections complete
    // Second poll: all 4 complete
    mockSingle
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: { status: 'complete' },
            competitors: { status: 'complete' },
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: { status: 'complete' },
            competitors: { status: 'complete' },
            icpValidation: { status: 'complete' },
            offerAnalysis: { status: 'complete' },
          },
        },
        error: null,
      });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });

  it('resolves with timedOut: true when timeout is exceeded', async () => {
    // Always incomplete
    mockSingle.mockResolvedValue({
      data: {
        research_results: {
          industryMarket: { status: 'complete' },
          // others missing
        },
      },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('resolves with timedOut: true when Supabase session not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    // No session = no research results = treat as timed out
    expect(result.timedOut).toBe(true);
  });
});
```

**Step 2: Run the test to confirm it fails (TDD red)**

Run: `npm run test:run -- src/lib/journey/__tests__/research-readiness.test.ts`

Expected: Module not found — `research-readiness.ts` does not exist yet.

**Step 3: Create research-readiness.ts**

```typescript
// src/lib/journey/research-readiness.ts
// Polls Supabase for research section completion before synthesis is dispatched.
// Server-only — imports createAdminClient from @/lib/supabase/server.

import { createAdminClient } from '@/lib/supabase/server';

export const SYNTHESIS_PREREQUISITES = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
] as const;

export type PrerequisiteSection = (typeof SYNTHESIS_PREREQUISITES)[number];

export interface ReadinessResult {
  ready: boolean;
  timedOut: boolean;
  completedSections: PrerequisiteSection[];
  missingSections: PrerequisiteSection[];
}

export interface ReadinessOptions {
  pollIntervalMs?: number; // default: 30_000 (30s)
  timeoutMs?: number;      // default: 300_000 (5 min)
}

/**
 * Polls journey_sessions.research_results until all 4 synthesis prerequisites
 * have status: 'complete', or until the timeout elapses.
 *
 * If the timeout elapses, resolves with timedOut: true so the caller can
 * proceed with whatever data is available rather than blocking indefinitely.
 */
export async function waitForResearchReadiness(
  userId: string,
  options: ReadinessOptions = {},
): Promise<ReadinessResult> {
  const {
    pollIntervalMs = 30_000,
    timeoutMs = 300_000,
  } = options;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await checkReadiness(userId);

    if (result.ready) return result;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remaining)));
  }

  // Final check after timeout — return whatever state we have
  const finalResult = await checkReadiness(userId);
  return { ...finalResult, timedOut: !finalResult.ready };
}

async function checkReadiness(userId: string): Promise<ReadinessResult> {
  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !session) {
    return {
      ready: false,
      timedOut: false,
      completedSections: [],
      missingSections: [...SYNTHESIS_PREREQUISITES],
    };
  }

  const results = (session.research_results as Record<string, { status: string }>) ?? {};

  const completedSections = SYNTHESIS_PREREQUISITES.filter(
    (section) => results[section]?.status === 'complete',
  );
  const missingSections = SYNTHESIS_PREREQUISITES.filter(
    (section) => results[section]?.status !== 'complete',
  );

  return {
    ready: missingSections.length === 0,
    timedOut: false,
    completedSections,
    missingSections,
  };
}
```

**Step 4: Gate synthesize-research.ts on readiness**

Replace `src/lib/ai/tools/research/synthesize-research.ts` with a version that waits for readiness before dispatching:

```typescript
// src/lib/ai/tools/research/synthesize-research.ts
// Research Tool: Cross-Analysis Synthesis
// Async: waits for prerequisites, then dispatches to Railway worker

import { tool } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { dispatchResearch } from './dispatch';
import { waitForResearchReadiness } from '@/lib/journey/research-readiness';

export const synthesizeResearch = tool({
  description:
    'Synthesise all completed research into a cross-analysis strategic summary. ' +
    'Runs a sub-agent to produce: key insights, recommended platforms, strategic narrative, ' +
    'and media buying priorities. ' +
    'ONLY call this after all 4 prior research tools have completed successfully. ' +
    'Pass summaries of all 4 prior research outputs in the context parameter.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled context including onboarding fields AND summaries of all 4 completed research sections',
      ),
  }),
  execute: async ({ context }) => {
    const { userId } = await auth();
    if (!userId) {
      return { status: 'error', section: 'crossAnalysis', error: 'Unauthorized' };
    }

    // Poll Supabase until all 4 prerequisites are complete (max 5 min)
    const readiness = await waitForResearchReadiness(userId);

    if (!readiness.ready) {
      console.warn(
        '[synthesizeResearch] Proceeding despite incomplete prerequisites:',
        readiness.missingSections,
      );
    }

    return dispatchResearch('synthesizeResearch', 'crossAnalysis', context);
  },
});
```

**Step 5: Run tests to confirm passing (TDD green)**

Run: `npm run test:run -- src/lib/journey/__tests__/research-readiness.test.ts`

Expected: All 4 tests pass.

**Step 6: Commit**

```bash
git add src/lib/journey/research-readiness.ts src/lib/journey/__tests__/research-readiness.test.ts src/lib/ai/tools/research/synthesize-research.ts
git commit -m "feat: gate synthesizeResearch on Supabase readiness poll — 30s interval, 5min timeout, proceeds with warning on timeout"
```

---

### Task 6: Environment Validation for RAILWAY_WORKER_URL

**Files:**
- Modify: `src/lib/env.ts` — add `RAILWAY_WORKER_URL` to optional server vars with a specific warning
- Modify: `src/app/api/journey/stream/route.ts` — call `validateWorkerUrl()` at route cold start
- Create: `src/lib/__tests__/env-worker.test.ts` — test the worker URL validation

**Context:** `RAILWAY_WORKER_URL` is already checked in `dispatch.ts` at call time, but the `console.error` there fires per-request after the user has already started a journey. The fix adds a startup-time validation that logs a clear, actionable warning on every cold start — visible in deployment logs and local dev — so operators discover the missing variable before a user hits the failure.

**Step 1: Write the test first**

```typescript
// src/lib/__tests__/env-worker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateWorkerUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns configured: true when RAILWAY_WORKER_URL is set', async () => {
    process.env.RAILWAY_WORKER_URL = 'https://my-worker.railway.app';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(true);
  });

  it('returns configured: false and a helpful message when RAILWAY_WORKER_URL is missing', async () => {
    delete process.env.RAILWAY_WORKER_URL;
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(false);
    expect(result.message).toContain('RAILWAY_WORKER_URL');
    expect(result.message).toContain('research');
  });

  it('returns configured: false when RAILWAY_WORKER_URL is empty string', async () => {
    process.env.RAILWAY_WORKER_URL = '';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(false);
  });

  it('returns configured: false when RAILWAY_WORKER_URL is whitespace only', async () => {
    process.env.RAILWAY_WORKER_URL = '   ';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(false);
  });
});
```

**Step 2: Run the test to confirm it fails (TDD red)**

Run: `npm run test:run -- src/lib/__tests__/env-worker.test.ts`

Expected: `validateWorkerUrl` is not exported from `src/lib/env.ts`.

**Step 3: Add validateWorkerUrl to env.ts**

Append to `src/lib/env.ts` (after the existing `hasEnv` function):

```typescript
// src/lib/env.ts (append after hasEnv)

export interface WorkerUrlValidationResult {
  configured: boolean;
  message?: string;
}

/**
 * Validates that RAILWAY_WORKER_URL is configured.
 * Call this at route cold-start to surface the missing var in deployment logs
 * before a user request hits the dispatch layer and fails silently.
 *
 * @returns { configured: true } if set and non-empty
 * @returns { configured: false, message } with actionable instructions if missing
 */
export function validateWorkerUrl(): WorkerUrlValidationResult {
  const url = getEnv('RAILWAY_WORKER_URL');
  if (url) {
    return { configured: true };
  }
  return {
    configured: false,
    message:
      'RAILWAY_WORKER_URL is not set — all research dispatches will fail silently. ' +
      'Local dev: cd research-worker && npm run dev, then set RAILWAY_WORKER_URL=http://localhost:3001 in .env.local. ' +
      'Production: set RAILWAY_WORKER_URL to your deployed Railway service URL.',
  };
}
```

**Step 4: Call validateWorkerUrl at route startup**

Add a module-level validation call to `src/app/api/journey/stream/route.ts`. Add this block immediately after the imports (before the `export const maxDuration` line):

```typescript
// src/app/api/journey/stream/route.ts (add after imports)
import { validateWorkerUrl } from '@/lib/env';

// Validate RAILWAY_WORKER_URL at module load time (fires on cold start).
// If missing, logs an actionable error before any user request hits dispatch.
const workerValidation = validateWorkerUrl();
if (!workerValidation.configured) {
  console.error('[journey/stream] STARTUP WARNING:', workerValidation.message);
}
```

**Step 5: Run all tests to confirm nothing regressed**

Run: `npm run test:run -- src/lib/__tests__/env-worker.test.ts`

Expected: All 4 tests pass.

Run: `npm run test:run`

Expected: Full test suite passes. No regressions.

**Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/__tests__/env-worker.test.ts src/app/api/journey/stream/route.ts
git commit -m "feat: startup validation for RAILWAY_WORKER_URL — actionable console.error on cold start when research worker is unconfigured"
```

---

## Final Verification

**Step 1: Full build**

Run: `npm run build`

Expected: Exit 0. No TypeScript errors. No missing module errors.

**Step 2: Full test suite**

Run: `npm run test:run`

Expected: All tests pass. New tests added:
- `src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts` (4 tests)
- `src/lib/journey/__tests__/session-state-server.test.ts` (4 tests)
- `src/lib/journey/__tests__/research-readiness.test.ts` (4 tests)
- `src/lib/__tests__/env-worker.test.ts` (4 tests)

**Step 3: Worker TypeScript check**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main/research-worker && npx tsc --noEmit`

Expected: No errors.

**Step 4: Supabase schema reminder**

The `job_status` column added in Task 3 requires a migration if not present:

```sql
ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS job_status JSONB DEFAULT '{}';
```

Run this against your Supabase project before deploying Task 3 to production.

---

## What This Sprint Does NOT Cover

- Google Ads or Meta Ads integrations
- Thinking block / agent intelligence changes
- Blueprint section generation
- Dead-letter queue or alerting (PagerDuty / Slack notifications on failures)
- Automatic job retry initiated from the lead agent (deferred — requires job ID tracking across turns)
- Worker health dashboard or admin UI
