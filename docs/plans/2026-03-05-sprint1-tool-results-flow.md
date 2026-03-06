# Sprint 1: Tool Results Flow Back to Model

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make research tool results return as actual tool outputs that the model can see and reason about, instead of fire-and-forget dispatches.

**Architecture:** Replace fire-and-forget dispatch with a polling harness. Fast tools (<10s) run inline. Medium tools (10-60s) poll Railway every 5s. Timeouts return partial results. All errors return structured error objects per Manus's error preservation pattern.

**Tech Stack:** Vercel AI SDK v6, Next.js App Router, Railway Express worker, Supabase, Claude Opus 4.6

---

## Current State (The Problem)

All 7 research tools call `dispatchResearch()` from `src/lib/ai/tools/research/dispatch.ts`. That function POSTs to the Railway worker `/run` and returns `{ status: 'queued', section, jobId }` immediately. The model receives only this receipt — it **never sees** actual research data.

The Railway worker runs the sub-agent in a detached async (`void (async () => { ... })()`), then writes results to `journey_sessions.research_results` JSONB in Supabase. The frontend reads via `useResearchData()` hook. The model is completely blind to its own research.

### What Must NOT Change
- Railway worker behavior — still writes to Supabase (frontend Realtime depends on this)
- Tool names and `inputSchema` shapes — KV-cache compatibility for Sprint 2
- `competitorFastHits` — already runs inline with 30s timeout, not touched
- `askUser` — interactive tool, not a research tool
- Existing `dispatchResearch()` function — still used by `dispatchAndWait`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/journey/read-research-result.ts` | Create | Supabase read for polling |
| `src/lib/ai/tools/research/poll-result.ts` | Create | Poll Supabase for job completion |
| `src/lib/ai/tools/research/error-response.ts` | Create | Structured error builder (Manus pattern) |
| `src/lib/ai/tools/research/dispatch-and-wait.ts` | Create | Combines dispatch + poll |
| `src/lib/ai/tools/research/research-industry.ts` | Modify | Use `dispatchAndWait` instead of `dispatchResearch` |
| `src/lib/ai/tools/research/research-competitors.ts` | Modify | Use `dispatchAndWait` |
| `src/lib/ai/tools/research/research-icp.ts` | Modify | Use `dispatchAndWait` |
| `src/lib/ai/tools/research/research-offer.ts` | Modify | Use `dispatchAndWait` |
| `src/lib/ai/tools/research/research-keywords.ts` | Modify | Use `dispatchAndWait` |
| `src/lib/ai/tools/research/synthesize-research.ts` | Modify | Use `dispatchAndWait`, remove `waitForResearchReadiness` |
| `src/lib/ai/tools/research/research-media-plan.ts` | Modify | Use `dispatchAndWait` |
| `research-worker/src/index.ts` | Modify | Add `GET /health` endpoint |

---

### Task 1: Create Supabase read function for polling

**Files:**
- Create: `src/lib/journey/read-research-result.ts`
- Test: `src/lib/journey/__tests__/read-research-result.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/journey/__tests__/read-research-result.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('readResearchResult', () => {
  it('returns null when no session exists', async () => {
    const { readResearchResult } = await import('../read-research-result');
    const result = await readResearchResult('user-123', 'industryMarket');
    expect(result).toBeNull();
  });

  it('returns section data when research_results contains the section', async () => {
    const { readResearchResult } = await import('../read-research-result');
    const result = await readResearchResult('user-123', 'industryMarket');
    // Will fail — function doesn't exist yet
    expect(result).toBeDefined();
  });
});

describe('readJobStatus', () => {
  it('returns null when no job exists', async () => {
    const { readJobStatus } = await import('../read-research-result');
    const result = await readJobStatus('user-123', 'job-uuid');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/read-research-result.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/journey/read-research-result.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface JobStatusRow {
  status: 'running' | 'complete' | 'error';
  tool: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export async function readResearchResult(
  userId: string,
  section: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const results = data.research_results as Record<string, unknown> | null;
  return results?.[section] ?? null;
}

export async function readJobStatus(
  userId: string,
  jobId: string,
): Promise<JobStatusRow | null> {
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('job_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const statuses = data.job_status as Record<string, JobStatusRow> | null;
  return statuses?.[jobId] ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/read-research-result.test.ts`
Expected: PASS (with mocked Supabase)

**Step 5: Commit**

```bash
git add src/lib/journey/read-research-result.ts src/lib/journey/__tests__/read-research-result.test.ts
git commit -m "feat: add Supabase read functions for research result polling"
```

---

### Task 2: Create structured error response builder

**Files:**
- Create: `src/lib/ai/tools/research/error-response.ts`
- Test: `src/lib/ai/tools/research/__tests__/error-response.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/tools/research/__tests__/error-response.test.ts
import { describe, it, expect } from 'vitest';
import { buildErrorResponse } from '../error-response';

describe('buildErrorResponse', () => {
  it('returns structured error with all fields', () => {
    const result = buildErrorResponse(
      'researchIndustry',
      'Railway worker returned 503 after 3 retries',
      35000,
    );

    expect(result).toEqual({
      error: true,
      attempted: 'researchIndustry',
      reason: 'Railway worker returned 503 after 3 retries',
      duration: '35.0s',
      suggestion: expect.any(String),
      canRetry: false,
    });
  });

  it('marks retryable errors correctly', () => {
    const result = buildErrorResponse(
      'researchICP',
      'Rate limited',
      5000,
      { canRetry: true },
    );
    expect(result.canRetry).toBe(true);
  });

  it('includes custom suggestion when provided', () => {
    const result = buildErrorResponse(
      'researchOffer',
      'Timeout',
      120000,
      { suggestion: 'Try with less context' },
    );
    expect(result.suggestion).toBe('Try with less context');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/error-response.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/tools/research/error-response.ts

export interface ToolErrorResult {
  error: true;
  attempted: string;
  reason: string;
  duration: string;
  suggestion: string;
  canRetry: boolean;
}

interface ErrorOpts {
  canRetry?: boolean;
  suggestion?: string;
}

const DEFAULT_SUGGESTIONS: Record<string, string> = {
  researchIndustry: 'Proceed with onboarding. Industry research can be retried later.',
  researchCompetitors: 'Continue with other research. Competitor data is supplementary.',
  researchICP: 'Use training knowledge for ICP validation. Live data enhances but isn\'t required.',
  researchOffer: 'Proceed with synthesis using available data.',
  synthesizeResearch: 'Review individual research sections directly instead of synthesis.',
  researchKeywords: 'Skip keyword intel. Core strategy doesn\'t depend on it.',
  researchMediaPlan: 'Build media plan from synthesis data without live platform benchmarks.',
};

export function buildErrorResponse(
  tool: string,
  reason: string,
  durationMs: number,
  opts?: ErrorOpts,
): ToolErrorResult {
  return {
    error: true,
    attempted: tool,
    reason,
    duration: `${(durationMs / 1000).toFixed(1)}s`,
    suggestion: opts?.suggestion ?? DEFAULT_SUGGESTIONS[tool] ?? 'Continue with available data.',
    canRetry: opts?.canRetry ?? false,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/error-response.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/tools/research/error-response.ts src/lib/ai/tools/research/__tests__/error-response.test.ts
git commit -m "feat: add structured error response builder (Manus pattern)"
```

---

### Task 3: Create poll-result utility

**Files:**
- Create: `src/lib/ai/tools/research/poll-result.ts`
- Test: `src/lib/ai/tools/research/__tests__/poll-result.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/tools/research/__tests__/poll-result.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/journey/read-research-result', () => ({
  readJobStatus: vi.fn(),
  readResearchResult: vi.fn(),
}));

describe('pollForResult', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns complete when job finishes on first poll', async () => {
    const { readJobStatus, readResearchResult } = await import(
      '@/lib/journey/read-research-result'
    );
    vi.mocked(readJobStatus).mockResolvedValueOnce({
      status: 'complete',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    vi.mocked(readResearchResult).mockResolvedValueOnce({
      status: 'complete',
      data: { categorySnapshot: {} },
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
      maxWaitMs: 1000,
    });

    expect(result.status).toBe('complete');
    expect(result.data).toBeDefined();
  });

  it('returns timeout when maxWaitMs exceeded', async () => {
    const { readJobStatus } = await import('@/lib/journey/read-research-result');
    vi.mocked(readJobStatus).mockResolvedValue({
      status: 'running',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
      maxWaitMs: 50,
    });

    expect(result.status).toBe('timeout');
  });

  it('returns error when job fails', async () => {
    const { readJobStatus } = await import('@/lib/journey/read-research-result');
    vi.mocked(readJobStatus).mockResolvedValueOnce({
      status: 'error',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
      error: 'Sub-agent timed out',
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
    });

    expect(result.status).toBe('error');
    expect(result.error).toBe('Sub-agent timed out');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/poll-result.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/tools/research/poll-result.ts
import { readJobStatus, readResearchResult } from '@/lib/journey/read-research-result';

export interface PollOptions {
  maxWaitMs?: number;   // Default: 120_000 (2 minutes)
  intervalMs?: number;  // Default: 5_000 (5 seconds)
}

export interface PollResult {
  status: 'complete' | 'timeout' | 'error';
  data?: unknown;
  error?: string;
  durationMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollForResult(
  userId: string,
  section: string,
  jobId: string,
  opts?: PollOptions,
): Promise<PollResult> {
  const maxWaitMs = opts?.maxWaitMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 5_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const jobStatus = await readJobStatus(userId, jobId);

    if (jobStatus?.status === 'complete') {
      const researchData = await readResearchResult(userId, section);
      return {
        status: 'complete',
        data: researchData,
        durationMs: Date.now() - startTime,
      };
    }

    if (jobStatus?.status === 'error') {
      return {
        status: 'error',
        error: jobStatus.error ?? 'Research job failed',
        durationMs: Date.now() - startTime,
      };
    }

    // Still running — wait and poll again
    await sleep(intervalMs);
  }

  // Timeout — try to read whatever partial data exists
  const partialData = await readResearchResult(userId, section);
  return {
    status: 'timeout',
    data: partialData,
    durationMs: Date.now() - startTime,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/poll-result.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/tools/research/poll-result.ts src/lib/ai/tools/research/__tests__/poll-result.test.ts
git commit -m "feat: add Supabase polling utility for research job results"
```

---

### Task 4: Create dispatchAndWait function

**Files:**
- Create: `src/lib/ai/tools/research/dispatch-and-wait.ts`
- Test: `src/lib/ai/tools/research/__tests__/dispatch-and-wait.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/ai/tools/research/__tests__/dispatch-and-wait.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../dispatch', () => ({
  dispatchResearch: vi.fn(),
}));
vi.mock('../poll-result', () => ({
  pollForResult: vi.fn(),
}));

describe('dispatchAndWait', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches then polls and returns complete result', async () => {
    const { dispatchResearch } = await import('../dispatch');
    const { pollForResult } = await import('../poll-result');

    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
    });
    vi.mocked(pollForResult).mockResolvedValueOnce({
      status: 'complete',
      data: { categorySnapshot: { category: 'B2B SaaS' } },
      durationMs: 15000,
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait('researchIndustry', 'industryMarket', 'context');

    expect(result.status).toBe('complete');
    expect(result.data).toEqual({ categorySnapshot: { category: 'B2B SaaS' } });
  });

  it('returns structured error when dispatch fails', async () => {
    const { dispatchResearch } = await import('../dispatch');
    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'error',
      section: 'industryMarket',
      error: 'Worker unreachable',
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait('researchIndustry', 'industryMarket', 'context');

    expect(result.status).toBe('error');
    expect(result.errorDetail?.error).toBe(true);
  });

  it('returns partial result on timeout', async () => {
    const { dispatchResearch } = await import('../dispatch');
    const { pollForResult } = await import('../poll-result');

    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
    });
    vi.mocked(pollForResult).mockResolvedValueOnce({
      status: 'timeout',
      data: null,
      durationMs: 120000,
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait('researchIndustry', 'industryMarket', 'context');

    expect(result.status).toBe('partial');
    expect(result.gaps).toContain('Timed out after 120.0s');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/dispatch-and-wait.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/tools/research/dispatch-and-wait.ts
import { dispatchResearch } from './dispatch';
import { pollForResult } from './poll-result';
import { buildErrorResponse, type ToolErrorResult } from './error-response';

export interface ResearchToolResult {
  status: 'complete' | 'partial' | 'error';
  section: string;
  data?: unknown;
  gaps?: string[];
  errorDetail?: ToolErrorResult;
  durationMs: number;
}

export async function dispatchAndWait(
  tool: string,
  section: string,
  context: string,
): Promise<ResearchToolResult> {
  const startTime = Date.now();

  // Step 1: Dispatch to Railway worker
  const dispatchResult = await dispatchResearch(tool, section, context);

  if (dispatchResult.status === 'error') {
    return {
      status: 'error',
      section,
      errorDetail: buildErrorResponse(
        tool,
        dispatchResult.error ?? 'Dispatch failed',
        Date.now() - startTime,
      ),
      durationMs: Date.now() - startTime,
    };
  }

  // Step 2: Poll Supabase for result
  const jobId = dispatchResult.jobId!;
  const userId = dispatchResult.userId ?? '';

  const pollResult = await pollForResult(userId, section, jobId);

  if (pollResult.status === 'complete') {
    return {
      status: 'complete',
      section,
      data: pollResult.data,
      durationMs: pollResult.durationMs,
    };
  }

  if (pollResult.status === 'error') {
    return {
      status: 'error',
      section,
      errorDetail: buildErrorResponse(
        tool,
        pollResult.error ?? 'Research job failed',
        pollResult.durationMs,
      ),
      durationMs: pollResult.durationMs,
    };
  }

  // Timeout — return whatever partial data we have
  return {
    status: 'partial',
    section,
    data: pollResult.data,
    gaps: [`Timed out after ${(pollResult.durationMs / 1000).toFixed(1)}s`],
    durationMs: pollResult.durationMs,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/dispatch-and-wait.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/tools/research/dispatch-and-wait.ts src/lib/ai/tools/research/__tests__/dispatch-and-wait.test.ts
git commit -m "feat: add dispatchAndWait combining dispatch + poll"
```

---

### Task 5: Update dispatch.ts to expose userId

**Files:**
- Modify: `src/lib/ai/tools/research/dispatch.ts`

**Step 1: Update DispatchResult to include userId**

The `dispatchAndWait` function needs `userId` for polling. Currently `dispatchResearch` gets it from `auth()` but doesn't return it.

```typescript
// In dispatch.ts, update DispatchResult:
export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  userId?: string;  // ← ADD THIS
  error?: string;
}
```

Then in the return statement of `dispatchResearch`, add `userId` to the returned object.

**Step 2: Run existing test to verify no regression**

Run: `npm run test:run -- src/lib/ai/tools/research/__tests__/dispatch-retry.test.ts`
Expected: PASS (existing tests unaffected)

**Step 3: Commit**

```bash
git add src/lib/ai/tools/research/dispatch.ts
git commit -m "feat: expose userId in DispatchResult for polling"
```

---

### Task 6: Update all research tools to use dispatchAndWait

**Files:**
- Modify: `src/lib/ai/tools/research/research-industry.ts` (and all 6 other tool files)

**Step 1: Update research-industry.ts as template**

```typescript
// src/lib/ai/tools/research/research-industry.ts
import { tool } from 'ai';
import { z } from 'zod';
import { dispatchAndWait } from './dispatch-and-wait';

export const researchIndustry = tool({
  description:
    'Research the industry landscape and market dynamics for the client\'s business. ' +
    'Runs a Claude sub-agent with live web search to gather: market trends, ' +
    'pain points, buying behaviours, seasonality, and demand drivers. ' +
    'Call this as soon as businessModel and industry are collected.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchAndWait('researchIndustry', 'industryMarket', context);
  },
});
```

**Step 2: Apply same pattern to all other research tools**

Each tool file changes ONE line: `dispatchResearch` → `dispatchAndWait` (and the import).

Files to update:
- `research-competitors.ts`: `dispatchAndWait('researchCompetitors', 'competitors', context)`
- `research-icp.ts`: `dispatchAndWait('researchICP', 'icpValidation', context)`
- `research-offer.ts`: `dispatchAndWait('researchOffer', 'offerAnalysis', context)`
- `synthesize-research.ts`: `dispatchAndWait('synthesizeResearch', 'crossAnalysis', context)` — also remove `waitForResearchReadiness()` call since model now controls sequencing
- `research-keywords.ts`: `dispatchAndWait('researchKeywords', 'keywordIntel', context)`
- `research-media-plan.ts`: `dispatchAndWait('researchMediaPlan', 'mediaPlan', context)`

**Step 3: Run full test suite**

Run: `npm run test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ai/tools/research/
git commit -m "feat: switch all research tools from fire-and-forget to dispatchAndWait"
```

---

### Task 7: Add health check endpoint to Railway worker

**Files:**
- Modify: `research-worker/src/index.ts`

**Step 1: Add GET /health**

```typescript
// In research-worker/src/index.ts, after existing routes:
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
```

**Step 2: Verify manually**

Run: `cd research-worker && npm run dev` → `curl http://localhost:3001/health`
Expected: `{ "status": "ok", "uptime": ..., "timestamp": "..." }`

**Step 3: Commit**

```bash
git add research-worker/src/index.ts
git commit -m "feat: add /health endpoint to Railway worker"
```

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Research tool `execute()` returns actual data | Log tool output in route.ts `onFinish` |
| 2 | Model references research findings in responses | Manual test — ask about industry after research |
| 3 | Timeout returns `{ status: 'partial', data, gaps }` | Mock slow worker, verify partial result |
| 4 | Errors return structured `{ error: true, ... }` | Mock worker failure, verify error shape |
| 5 | Railway worker still writes to Supabase | Check Supabase after tool call |
| 6 | Frontend `useResearchData()` still works | Manual test — verify research cards appear |
| 7 | `competitorFastHits` unchanged | Verify tool runs inline as before |
| 8 | All tool names/schemas unchanged | Diff tool registrations vs before |
| 9 | `npm run build` passes | CI check |
| 10 | `npm run test:run` passes | CI check |

## Risks and Mitigations

1. **Vercel function timeout**: 300s maxDuration gives headroom, but 7 sequential research calls could exceed. **Mitigation**: Model runs research between questions (not all at once). Each poll takes 60-120s max.
2. **Supabase polling load**: 5s intervals × active polls = manageable. **Mitigation**: `pollForResult` exits immediately on complete/error, doesn't keep polling.
3. **Worker race condition**: Worker writes result after we stop polling. **Mitigation**: Timeout returns `{ status: 'partial' }` with whatever data exists. Data isn't lost — frontend still gets it via Realtime.
4. **userId availability**: `dispatchAndWait` needs userId from `dispatch.ts`. **Mitigation**: Task 5 adds userId to DispatchResult.

## Execution Order

Tasks 1-3 are independent foundations. Task 4 combines them. Task 5 is a small change to dispatch.ts. Task 6 is the big integration. Task 7 is a standalone worker enhancement.

Recommended: 1 → 2 → 3 → 4 → 5 → 6 → 7
