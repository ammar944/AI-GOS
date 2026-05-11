# Research Performance + Chat-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut full-audit wall time from ~30 min to ~3 min AND enable chat-driven editing (rerun/patch/converse) of generated artifacts. Speed first, then chat — edit UX is gated on section speed.

**Architecture:** Three speed moves (token cap, search cap, parallel section dispatch) reduce per-section work and parallelize across the 6 positioning runners. Then a new `/api/research-v2/chat` endpoint with a Sonnet intent classifier routes user messages to one of three actions: re-dispatch a section with a refinement instruction, surgical JSONB patch of a specific finding, or pure streaming conversation. One unified chat thread per audit run, persisted in a new `audit_chat_messages` table.

**Tech Stack:** Next.js 16, Vercel AI SDK v6 (`@ai-sdk/anthropic`, `useChat`, `DefaultChatTransport`, `streamText`, `toUIMessageStreamResponse`), Anthropic Claude (Sonnet for classifier + converse; Opus for sections), Supabase (Postgres + Realtime), Railway worker (research-worker/, separate Node process), Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-11-research-perf-and-chat-edit-design.md` (committed `fa650daa`).

**Prior shipped work** this plan builds on: `6038a367` (frontend phase union) → `cd28348b` (worker dedup + heartbeat) → `9895f7e5` (runStreamingAttempt) → `1bf5c91b` (dispatcher swap).

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260512_audit_chat_messages.sql` | New table `audit_chat_messages` keyed by `run_id`; chat thread storage |
| `src/app/api/research-v2/chat/route.ts` | POST chat endpoint — persists messages, runs intent router, branches to rerun/patch/converse |
| `src/lib/research-v2/intent-router.ts` | Pure function: classifies a user message into `{kind, target_section, instruction, patch}` via a Sonnet call; exported and testable |
| `src/lib/research-v2/intent-router.types.ts` | Shared types (`IntentKind`, `IntentResult`, `IntentRouterInput`) so frontend + route can both import |
| `src/lib/research-v2/patch-apply.ts` | Pure function: applies a structured patch (`{path, value}`) to a section's JSONB; path validator + safe upsert |
| `src/lib/research-v2/__tests__/intent-router.test.ts` | Vitest fixture for 15-20 user messages → expected classifications |
| `src/lib/research-v2/__tests__/patch-apply.test.ts` | Vitest for path-application correctness, invalid-path rejection, JSONB roundtrip |
| `research-worker/src/__tests__/journey-section-chat-refinement.test.ts` | Vitest: when `chatRefinement` is passed, it appears in the system prompt or user message |
| `src/components/research-v2/chat-thread.tsx` | NEW (replaces stubbed pieces of `chat-message.tsx` if appropriate) — unified audit chat UI; uses `useChat` + `DefaultChatTransport` pointed at `/api/research-v2/chat` |

### Files to modify

| Path | Change |
|---|---|
| `research-worker/src/runners/journey-section-synthesis.ts` | Reduce `JOURNEY_SECTION_MAX_TOKENS` 18000 → 10000; tighten `SYSTEM_PROMPT` JSON shape; add web-search cap to 2; accept `chatRefinement` and prepend to mission |
| `research-worker/src/index.ts` | Accept optional `chatRefinement` field on `/run` request; pass to runners; add configurable concurrency cap (default 6) via `WORKER_RUN_CONCURRENCY` env var + simple semaphore |
| `src/app/research-v2/page.tsx` | On corpus complete, dispatch all 6 positioning sections concurrently (currently sequential per click); guarded by feature flag `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS` |
| `src/components/research-v2/run-section-button.tsx` | When parallel mode is on, button is informational only (sections auto-dispatch); preserve manual click as fallback |
| `src/app/api/research-v2/dispatch/route.ts` | Accept optional `chatRefinement: string` field; pass through to worker `/run` payload |
| `src/lib/journey/server/dispatch-research.ts` | Same — propagate `chatRefinement` through the dispatch helper |
| `src/components/research-v2/section-shell.tsx` | Mount `chat-thread.tsx` as the unified audit chat surface (one instance per audit, not per section) |
| `src/app/api/research-v2/refine/route.ts` | Delete — superseded by `/chat` (one final cleanup commit) |

### Files NOT to touch

- `research-worker/src/runner-cascade.ts` — locked from Wave 2/3 work; do not regress streaming
- `research-worker/src/emit-progress.ts` — locked from Wave 1
- `src/lib/journey/research-job-activity-core.ts` and `thinking-block.tsx` — locked from Wave 1 (activity log rendering)
- All non-positioning runners (`deep-research-program.ts`, `meeting-extract.ts`, `journey-section-synthesis.ts` only for the surgical edits above)

---

## Wave 1: Worker speed tweaks (atoms 1-2)

These are surgical config changes in one file. Sonnet, fast.

### Task 1: Tighten section token budget + JSON schema

**Files:**
- Modify: `research-worker/src/runners/journey-section-synthesis.ts`

- [ ] **Step 1: Read the current state of the constants and system prompt**

Run: `sed -n '17,22p' research-worker/src/runners/journey-section-synthesis.ts` and `sed -n '75,105p' research-worker/src/runners/journey-section-synthesis.ts`.

Expected: see `JOURNEY_SECTION_MAX_TOKENS = Number(process.env.RESEARCH_JOURNEY_SECTION_MAX_TOKENS ?? 18000)` and the `SYSTEM_PROMPT` literal.

- [ ] **Step 2: Reduce the default max-tokens**

In `research-worker/src/runners/journey-section-synthesis.ts`, change:
```ts
const JOURNEY_SECTION_MAX_TOKENS = Number(process.env.RESEARCH_JOURNEY_SECTION_MAX_TOKENS ?? 18000);
```
to:
```ts
const JOURNEY_SECTION_MAX_TOKENS = Number(process.env.RESEARCH_JOURNEY_SECTION_MAX_TOKENS ?? 10000);
```

Rationale: env var still overrides; default drops ~44%.

- [ ] **Step 3: Tighten the JSON schema in SYSTEM_PROMPT**

In the same file, find the SYSTEM_PROMPT literal that begins with `You are AI-GOS's Anthropic Platform Skills section synthesis orchestrator.` In the "Rules:" block, replace the existing rules section with:

```
Rules:
- Every important claim needs evidence or an explicit gap.
- Make the output read like a GTM strategist report artifact, not a JSON form fill.
- If the corpus lacks evidence, name the missing source and continue with a bounded recommendation.
- Keep findings concrete and client-useful.
- HARD LIMITS for v1: at most 5 keyFindings, 4 evidenceQuotes, 6 sources, 5 recommendedMoves, 5 risksOrGaps.
- Be concise. Prefer one sharp sentence over three average ones.
- Output JSON only. No explanatory prose.
```

- [ ] **Step 4: Run worker build**

Run: `cd research-worker && npm run build`
Expected: PASS (exit 0). Baseline-only errors. No new errors.

- [ ] **Step 5: Run existing worker tests (no regression)**

Run: `cd research-worker && npx vitest run`
Expected: all existing tests pass. The new constraint isn't behavior-tested directly (it's a prompt constraint), so no test addition here — atom 12 verifies output empirically.

- [ ] **Step 6: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add research-worker/src/runners/journey-section-synthesis.ts
git commit -m "$(cat <<'EOF'
perf(research-worker): cap section max_tokens 10k + tighten JSON schema

Drop JOURNEY_SECTION_MAX_TOKENS default 18000 → 10000 and add hard
limits to the SYSTEM_PROMPT (≤5 keyFindings, ≤4 evidenceQuotes, ≤6
sources, etc.) to reduce per-section output generation time. Env var
still overrides for callers that need verbose output.

First speed move of research-perf-and-chat-edit plan (atom 1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: Add web-search cap instruction

**Files:**
- Modify: `research-worker/src/runners/journey-section-synthesis.ts` (SYSTEM_PROMPT only)

- [ ] **Step 1: Add the search cap to the system prompt**

In `research-worker/src/runners/journey-section-synthesis.ts`, in the SYSTEM_PROMPT literal, insert this paragraph immediately after `Use those skills as the specialist-agent methodology layer.` and before `Use web search only where the provided corpus is insufficient or needs freshness checks.`:

Replace:
```
Use those skills as the specialist-agent methodology layer. Use web search only where the provided corpus is insufficient or needs freshness checks. Use code execution only for scratch organization/validation.
```

With:
```
Use those skills as the specialist-agent methodology layer. The corpus is your primary source — synthesize from it by default. You may call web_search AT MOST TWICE per section, and only when the corpus is genuinely missing a specific data point (e.g., a freshness check on a market size figure or a competitor's latest pricing). If a needed data point is missing from both corpus and your search budget, mark it in 'risksOrGaps' and continue. Use code execution only for scratch organization/validation.
```

- [ ] **Step 2: Run worker build**

Run: `cd research-worker && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add research-worker/src/runners/journey-section-synthesis.ts
git commit -m "$(cat <<'EOF'
perf(research-worker): cap web_search to 2 per section (prompt-level)

Add explicit instruction to SYSTEM_PROMPT: corpus-first, at most 2 web
searches per section, only for freshness checks or genuinely missing
data points. Missing-data gaps go to risksOrGaps rather than triggering
more searches. Soft cap (instruction-level, not enforced tool config);
empirical validation in atom 12.

Second speed move (atom 2).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 2: Parallel section dispatch (atoms 3-4)

### Task 3: Frontend — dispatch all 6 sections in parallel after corpus

**Files:**
- Modify: `src/app/research-v2/page.tsx`
- Modify: `src/components/research-v2/run-section-button.tsx`

This atom MUST route through `/ui-ux-pro-max` for the section-list visual treatment (will 6 sections all going at once feel chaotic? what's the loading state per section?), then implement via the `frontend` agent, then run `/design-review`. The skill steps below are scaffolding — the actual UX call happens during execution.

- [ ] **Step 1: Run /ui-ux-pro-max for the parallel-sections state**

Prompt for the skill: "On `/research-v2`, after corpus completes, all 6 positioning sections currently sit in a list waiting for a 'Run section' click each. We're switching to auto-dispatch: all 6 fire concurrently the moment corpus finishes. Each takes 90-120s. Design call: what's the loading affordance per section in the list view (animated state? row-level activity preview?), and does the 'Run section' button still exist as a manual fallback for re-running?"

Document the design output in the commit message of step 7.

- [ ] **Step 2: Read the current corpus-complete handler**

Run: `sed -n '320,360p' src/app/research-v2/page.tsx`
Expected: see the `dispatch({ type: 'CORPUS_COMPLETE', prefill })` site and surrounding handler.

Note: the page uses a `useReducer` state machine. `CORPUS_COMPLETE` is the action that transitions corpus → sections phase.

- [ ] **Step 3: Add a feature flag**

In `.env.example` (or wherever client-side flags live), add:
```
NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS=true
```

In `src/app/research-v2/page.tsx`, at the top of the file, add:
```ts
const PARALLEL_SECTIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS === 'true';
```

- [ ] **Step 4: Add parallel-dispatch function**

Add this function near the existing dispatch helpers (around the same area as the corpus dispatch at line ~270):

```ts
const dispatchAllPositioningSections = async (runId: string): Promise<void> => {
  const sectionIds = [
    'positioningMarketCategory',
    'positioningBuyerICP',
    'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer',
    'positioningDemandIntent',
    'positioningOfferDiagnostic',
  ] as const;

  await Promise.allSettled(
    sectionIds.map((sectionId) =>
      fetch('/api/research-v2/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, runId }),
      }),
    ),
  );
};
```

Use `Promise.allSettled` — we want every dispatch attempted even if one fails. Failures surface via the activity log.

- [ ] **Step 5: Wire into corpus-complete**

Find the existing CORPUS_COMPLETE dispatch site (around line 331-336 per the earlier grep). After the `dispatch({ type: 'CORPUS_COMPLETE', prefill: ... })` call, add:

```ts
if (PARALLEL_SECTIONS_ENABLED && runId) {
  void dispatchAllPositioningSections(runId);
}
```

The `void` is intentional — fire-and-forget; the activity log shows progress, no need to await.

- [ ] **Step 6: Update run-section-button.tsx for parallel mode**

In `src/components/research-v2/run-section-button.tsx`, find the button's enabled state. When `PARALLEL_SECTIONS_ENABLED` is true AND the section status is `queued` (dispatched but not yet started by worker), the button should show "Queued…" instead of "Run section". When status is `running`, show "Researching…" (existing behavior). When `complete`, show "Re-run" (manual fallback for chat-rerun integration coming in atom 9).

Exact change: at the top of `run-section-button.tsx`, add the flag import (or duplicate the env-var read since it's a client component):

```ts
const PARALLEL_SECTIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS === 'true';
```

In the button's label logic, add a `queued` branch:
```tsx
if (status === 'queued' && PARALLEL_SECTIONS_ENABLED) {
  return 'Queued…';
}
```

- [ ] **Step 7: Run frontend tsc**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit`
Expected: baseline only — no new errors. Same ~65 errors in pre-existing test files (per `.claude/rules/learned-patterns.md`).

- [ ] **Step 8: Run /design-review**

Prompt: "Review the parallel-sections UX change on /research-v2: after corpus completes, all 6 sections dispatch concurrently. Check visual hierarchy, status affordances per section, what happens when one section completes 30s before another, animation smoothness during streaming."

Address any blocking review notes inline before commit.

- [ ] **Step 9: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/app/research-v2/page.tsx \
        src/components/research-v2/run-section-button.tsx \
        .env.example
git commit -m "$(cat <<'EOF'
perf(research-v2): dispatch all 6 positioning sections concurrently

When NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS=true, all 6 sections fire the
moment corpus completes (Promise.allSettled). User no longer needs to
click 'Run section' 6 times. run-section-button.tsx renders 'Queued…'
for sections that are dispatched but not yet running.

UX call routed through /ui-ux-pro-max + /design-review per the locked
workspace frontend protocol.

Third speed move (atom 3) — full-audit wall time drops from ~30min
(6 × ~5min sequential clicks) to ~5min (longest section) before token+
search caps land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Worker concurrency cap

**Files:**
- Modify: `research-worker/src/index.ts`

- [ ] **Step 1: Write a unit test for the concurrency cap**

Create `research-worker/src/__tests__/concurrency-cap.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSemaphore } from '../utils/semaphore';

describe('createSemaphore', () => {
  it('admits up to N concurrent holders', async () => {
    const sem = createSemaphore(2);
    const log: string[] = [];
    const task = async (id: string) => {
      const release = await sem.acquire();
      log.push(`enter ${id}`);
      await new Promise((r) => setTimeout(r, 50));
      log.push(`exit ${id}`);
      release();
    };
    await Promise.all([task('a'), task('b'), task('c'), task('d')]);
    expect(log[0]).toBe('enter a');
    expect(log[1]).toBe('enter b');
    expect(log[2]).toBe('exit a');
    expect(log[3]).toBe('enter c');
    expect(log[4]).toBe('exit b');
    expect(log[5]).toBe('enter d');
  });

  it('releases waiters as holders exit', async () => {
    const sem = createSemaphore(1);
    const order: number[] = [];
    const ops = Array.from({ length: 5 }, (_, i) => async () => {
      const release = await sem.acquire();
      order.push(i);
      await new Promise((r) => setTimeout(r, 10));
      release();
    });
    await Promise.all(ops.map((op) => op()));
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npx vitest run src/__tests__/concurrency-cap.test.ts`
Expected: FAIL (`createSemaphore` does not exist).

- [ ] **Step 3: Implement the semaphore**

Create `research-worker/src/utils/semaphore.ts`:

```ts
/**
 * Minimal counting semaphore. Returns a release function from acquire().
 * Waiters are admitted in FIFO order as holders release.
 */
export function createSemaphore(max: number) {
  let available = max;
  const waiters: Array<() => void> = [];

  const acquire = (): Promise<() => void> => {
    return new Promise((resolve) => {
      const tryAdmit = () => {
        if (available > 0) {
          available -= 1;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            available += 1;
            const next = waiters.shift();
            if (next) next();
          });
        } else {
          waiters.push(tryAdmit);
        }
      };
      tryAdmit();
    });
  };

  return { acquire };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npx vitest run src/__tests__/concurrency-cap.test.ts`
Expected: PASS (2/2 tests).

- [ ] **Step 5: Wire semaphore into /run handler**

In `research-worker/src/index.ts`, near the top after imports, add:

```ts
import { createSemaphore } from './utils/semaphore';

const WORKER_RUN_CONCURRENCY = Number(process.env.WORKER_RUN_CONCURRENCY ?? 6);
const runSemaphore = createSemaphore(WORKER_RUN_CONCURRENCY);
```

In the `app.post('/run', ...)` handler (around line 162), wrap the existing body with semaphore acquisition. Find the start of the async handler and add `const releaseSlot = await runSemaphore.acquire();` immediately inside the try block. In the finally block at the end (or after the response is sent), call `releaseSlot()`.

Exact location: at the top of the handler's main try block, before any work happens. At the end of the handler (after the response is sent or error returned), in a finally clause, release.

If the handler doesn't already have a try/finally, add one:

```ts
app.post('/run', requireApiKey, async (req: express.Request, res: express.Response) => {
  const releaseSlot = await runSemaphore.acquire();
  try {
    // ... existing body ...
  } finally {
    releaseSlot();
  }
});
```

- [ ] **Step 6: Run worker build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npm run build`
Expected: PASS.

- [ ] **Step 7: Run all worker tests (no regression)**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npx vitest run`
Expected: all tests pass (including 13 from prior waves + 2 new from semaphore).

- [ ] **Step 8: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add research-worker/src/utils/semaphore.ts \
        research-worker/src/__tests__/concurrency-cap.test.ts \
        research-worker/src/index.ts
git commit -m "$(cat <<'EOF'
feat(research-worker): WORKER_RUN_CONCURRENCY cap (default 6)

Add a minimal FIFO semaphore at research-worker/src/utils/semaphore.ts
and wire it into /run so concurrent dispatches don't thunder the
Anthropic API. Default cap is 6 (matches the positioning section count);
overridable via WORKER_RUN_CONCURRENCY env var.

Pairs with the frontend parallel-dispatch change (atom 3) — when the
frontend fires 6 sections at once, the worker still respects rate
limits.

Atom 4 of research-perf-and-chat-edit plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 3: Chat infrastructure (atoms 5-7)

### Task 5: DB migration for audit_chat_messages

**Files:**
- Create: `supabase/migrations/20260512_audit_chat_messages.sql`

- [ ] **Step 1: Write the migration**

Create the file `supabase/migrations/20260512_audit_chat_messages.sql`:

```sql
-- Unified audit chat thread storage.
-- One thread per research_runs.run_id. Persists user + assistant messages
-- + classified intent + target section for traceability.

create table audit_chat_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(run_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  intent text check (intent is null or intent in ('rerun', 'patch', 'converse')),
  target_section text,
  created_at timestamptz not null default now()
);

create index idx_audit_chat_messages_run on audit_chat_messages (run_id, created_at);

-- RLS: chat is scoped to the run owner. research_runs has its own RLS;
-- audit_chat_messages inherits by FK + the same auth.uid() pattern used
-- on research_runs.
alter table audit_chat_messages enable row level security;

create policy "users read their own audit chats"
  on audit_chat_messages
  for select
  using (
    exists (
      select 1 from research_runs
      where research_runs.run_id = audit_chat_messages.run_id
        and research_runs.user_id = auth.uid()::text
    )
  );

create policy "users insert into their own audit chats"
  on audit_chat_messages
  for insert
  with check (
    exists (
      select 1 from research_runs
      where research_runs.run_id = audit_chat_messages.run_id
        and research_runs.user_id = auth.uid()::text
    )
  );

-- Service role bypasses RLS by default — worker + API routes write via service key.
```

Note: confirm `research_runs.user_id` column type matches `auth.uid()::text` cast. If `research_runs.user_id` is `uuid`, drop the `::text` cast. Read existing migrations to verify.

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or whatever the project's local migration command is — check `package.json` scripts).

If using the Supabase MCP tool, use `mcp__supabase__apply_migration` with the migration content.

Expected: migration applies cleanly. `audit_chat_messages` table exists.

- [ ] **Step 3: Verify table schema**

If using Supabase MCP: `mcp__supabase__list_tables` and confirm `audit_chat_messages` is present with the columns above. Or run a SQL query: `select column_name, data_type from information_schema.columns where table_name = 'audit_chat_messages';`

Expected: 7 columns matching the migration.

- [ ] **Step 4: Generate updated TypeScript types from Supabase**

Run the project's type-generation command (likely `npx supabase gen types typescript ...` or via MCP `mcp__supabase__generate_typescript_types`).

Expected: types file updated; new `audit_chat_messages` table appears.

- [ ] **Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add supabase/migrations/20260512_audit_chat_messages.sql \
        $(git diff --name-only | grep -i 'types' || true)
git commit -m "$(cat <<'EOF'
feat(db): audit_chat_messages table for unified per-audit chat

New table keyed by run_id with role/content/intent/target_section.
One row per chat turn (user or assistant). FK + RLS scope the thread
to the run owner. Service role bypasses RLS for worker + API writes.

Foundation for atom 6 (chat API route) and atoms 9-11 (execution
paths). Atom 5 of research-perf-and-chat-edit plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: /api/research-v2/chat route (stub)

**Files:**
- Create: `src/app/api/research-v2/chat/route.ts`
- Create: `src/lib/research-v2/intent-router.types.ts`

This task creates the route SHELL with persistence and a streaming echo response. The intent router (atom 8) and three execution paths (atoms 9-11) extend this in later tasks.

- [ ] **Step 1: Create the shared types file**

Create `src/lib/research-v2/intent-router.types.ts`:

```ts
export type IntentKind = 'rerun' | 'patch' | 'converse';

export interface IntentPatch {
  path: string; // dotted path: e.g., 'keyFindings[0].evidence'
  value: unknown;
}

export interface IntentResult {
  kind: IntentKind;
  target_section: string | null;
  instruction: string;
  patch: IntentPatch | null;
}

export interface IntentRouterInput {
  userMessage: string;
  auditContext: AuditContextSummary;
  chatHistory: ChatMessageForRouter[];
}

export interface AuditContextSummary {
  runId: string;
  sections: SectionSummary[];
}

export interface SectionSummary {
  sectionId: string;
  title: string;
  statusSummary: string;
  keyFindingTitles: string[];
}

export interface ChatMessageForRouter {
  role: 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 2: Create the route**

Create `src/app/api/research-v2/chat/route.ts`:

```ts
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages } from 'ai';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

interface ChatRequestBody {
  runId: string;
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant' | 'system';
    parts?: Array<{ type: string; text?: string }>;
  }>;
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE service credentials missing');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractText(message: ChatRequestBody['messages'][number]): string {
  if (!message.parts) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  if (!body.runId || !body.messages?.length) {
    return NextResponse.json({ error: 'runId and messages required' }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return NextResponse.json({ error: 'no user message to process' }, { status: 400 });
  }

  // Persist the user message.
  const userText = extractText(lastUserMessage);
  await supabase.from('audit_chat_messages').insert({
    run_id: body.runId,
    role: 'user',
    content: userText,
  });

  // STUB: echo via streamText. Atoms 8-11 replace this with intent routing.
  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: 'You are an audit-editing assistant. For now, echo the user message back acknowledging receipt.',
    messages: convertToModelMessages(body.messages as never),
  });

  // Persist the assistant message on stream finish.
  result.text.then(async (text) => {
    await supabase.from('audit_chat_messages').insert({
      run_id: body.runId,
      role: 'assistant',
      content: text,
      intent: 'converse',
    });
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 3: curl-test the route**

Run the dev server in a separate terminal: `npm run dev` (in tmux per project conventions).

Run:
```bash
RUN_ID="00000000-0000-0000-0000-000000000000"  # replace with a real run ID from your DB
curl -X POST http://localhost:3000/api/research-v2/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: <your auth cookie>" \
  -d '{
    "runId": "'"$RUN_ID"'",
    "messages": [{"role": "user", "parts": [{"type": "text", "text": "hello"}]}]
  }'
```

Expected: streaming response with an acknowledgement. After completion, a row in `audit_chat_messages` for the user message AND the assistant message.

If auth is hard to mock via curl, skip step 3 — the smoke test happens in atom 12.

- [ ] **Step 4: Run frontend tsc**

Run: `npx tsc --noEmit`
Expected: baseline only.

- [ ] **Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/app/api/research-v2/chat/route.ts \
        src/lib/research-v2/intent-router.types.ts
git commit -m "$(cat <<'EOF'
feat(research-v2): /api/research-v2/chat route stub + intent types

New POST endpoint that authenticates via Clerk, persists user
messages to audit_chat_messages, and streams an echo response via
AI SDK v6 streamText + toUIMessageStreamResponse. Compatible with
useChat + DefaultChatTransport on the frontend.

Stub for now — atoms 8-11 replace the echo with intent classification
and three execution paths (rerun / patch / converse).

Shared types at src/lib/research-v2/intent-router.types.ts so frontend
+ route + (future) tests all import the same shape.

Atom 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Frontend chat thread component

**Files:**
- Create: `src/components/research-v2/chat-thread.tsx`
- Modify: `src/components/research-v2/section-shell.tsx`

This atom routes through `/ui-ux-pro-max` → `frontend` agent → `/design-review` per the locked workspace frontend protocol.

- [ ] **Step 1: Run /ui-ux-pro-max for the unified chat surface**

Prompt for the skill: "Design call: unified audit chat — ONE thread per audit run (not per section, that's locked feedback per memory). Lives inside the audit workspace (section-shell.tsx mount point). Uses AI SDK v6 useChat + DefaultChatTransport pointed at /api/research-v2/chat. Surface needs: user input at the bottom, message list scrollable above, distinguish user/assistant turns, render assistant messages as Claude.ai-style (markdown + potentially tool/intent chips). Reference: AI Elements (https://elements.ai-sdk.dev) components like Message, MessageContent, Conversation. Constraint: chat lives alongside the section panel, not as a slide-out — should feel like a permanent sidebar."

Save the design output in your notes. Use it as the visual brief for step 3.

- [ ] **Step 2: Install/import AI Elements components if not present**

Check `package.json` for `@ai-sdk/elements` or similar. If not installed:
```bash
npm install @ai-sdk/elements
```

Or use shadcn-style installation per the AI Elements docs. Confirm the chosen approach with the /ui-ux-pro-max output.

- [ ] **Step 3: Implement chat-thread.tsx**

This step's implementation is done via the `frontend` agent — DO NOT write the code yourself. Dispatch a frontend agent with:

Prompt for the agent: "Create `src/components/research-v2/chat-thread.tsx`. Props: `{ runId: string; userId: string }`. Uses `useChat({ api: '/api/research-v2/chat', body: { runId } })` from `ai-sdk/react` with `DefaultChatTransport`. Renders messages from `useChat`'s `messages` array. Each message has `role: 'user' | 'assistant'` and `parts: UIMessagePart[]`. Renders text parts via markdown. Input at the bottom; submit triggers `useChat`'s `sendMessage`. Match the visual brief from /ui-ux-pro-max output (saved in your context). Constraints: named export `ChatThread`, kebab-case file, no default export, props type `ChatThreadProps`. Tailwind v4. No emoji unless the design call specifies. Lock to baseline tsc errors only."

The agent returns the file. Read it after the agent completes.

- [ ] **Step 4: Mount ChatThread in section-shell.tsx**

In `src/components/research-v2/section-shell.tsx`, add the ChatThread import and mount it at the appropriate location per /ui-ux-pro-max's layout call (likely a sidebar or bottom panel of the workspace):

```tsx
import { ChatThread } from '@/components/research-v2/chat-thread';
// ... in the JSX, where the design call placed it:
<ChatThread runId={runId} userId={userId} />
```

- [ ] **Step 5: Run /design-review**

Prompt: "Review the new unified chat surface in /research-v2's section workspace. Check: chat is genuinely unified (one thread for the audit, NOT per section); message rendering looks Claude.ai-quality; input affordance is obvious; layout doesn't fight with the existing section list; theme parity dark/light."

Address any blocking notes inline.

- [ ] **Step 6: Run frontend tsc + build**

Run: `npx tsc --noEmit && npm run build`
Expected: baseline only; build completes.

- [ ] **Step 7: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/components/research-v2/chat-thread.tsx \
        src/components/research-v2/section-shell.tsx \
        package.json package-lock.json 2>/dev/null
git commit -m "$(cat <<'EOF'
feat(research-v2): unified audit chat thread component

ChatThread component at src/components/research-v2/chat-thread.tsx,
mounted in section-shell.tsx as ONE thread per audit run (per locked
feedback memory: modern agent UX = unified chat, never per-section).

Uses AI SDK v6 useChat + DefaultChatTransport pointed at
/api/research-v2/chat. Renders message list, markdown body, input.

Visual brief from /ui-ux-pro-max; built by frontend agent; QA'd via
/design-review.

Atom 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 4: Intent router (atom 8)

### Task 8: Intent classifier with fixture tests

**Files:**
- Create: `src/lib/research-v2/intent-router.ts`
- Create: `src/lib/research-v2/__tests__/intent-router.test.ts`

- [ ] **Step 1: Write the fixture test**

Create `src/lib/research-v2/__tests__/intent-router.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent } from '../intent-router';
import type { AuditContextSummary } from '../intent-router.types';

const auditContext: AuditContextSummary = {
  runId: 'test-run',
  sections: [
    { sectionId: 'positioningMarketCategory', title: 'Market & Category', statusSummary: 'complete', keyFindingTitles: ['Market size'] },
    { sectionId: 'positioningCompetitorLandscape', title: 'Competitor Landscape', statusSummary: 'complete', keyFindingTitles: ['Cartesia'] },
  ],
};

// Mock the underlying LLM call. The test asserts router output shape; LLM mock
// returns canned classifications per input.
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

describe('classifyIntent', () => {
  beforeEach(async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockReset();
  });

  it('classifies "redo the competitor analysis" as rerun', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        kind: 'rerun',
        target_section: 'positioningCompetitorLandscape',
        instruction: 'redo the competitor analysis',
        patch: null,
      }),
    } as never);

    const result = await classifyIntent({
      userMessage: 'redo the competitor analysis',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('rerun');
    expect(result.target_section).toBe('positioningCompetitorLandscape');
  });

  it('classifies "make the competitor analysis focus on Cartesia" as rerun with instruction', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        kind: 'rerun',
        target_section: 'positioningCompetitorLandscape',
        instruction: 'focus on Cartesia as the primary differentiation target',
        patch: null,
      }),
    } as never);

    const result = await classifyIntent({
      userMessage: 'make the competitor analysis focus on Cartesia',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('rerun');
    expect(result.target_section).toBe('positioningCompetitorLandscape');
    expect(result.instruction).toContain('Cartesia');
  });

  it('classifies "the market size should be $30B not $20B" as patch', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        kind: 'patch',
        target_section: 'positioningMarketCategory',
        instruction: 'update market size to $30B',
        patch: { path: 'keyFindings[0].evidence', value: 'Market size: $30B' },
      }),
    } as never);

    const result = await classifyIntent({
      userMessage: 'the market size should be $30B not $20B',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('patch');
    expect(result.patch).toEqual({ path: 'keyFindings[0].evidence', value: 'Market size: $30B' });
  });

  it('classifies "what do you think about the Cartesia angle" as converse', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        kind: 'converse',
        target_section: null,
        instruction: 'discuss Cartesia angle',
        patch: null,
      }),
    } as never);

    const result = await classifyIntent({
      userMessage: 'what do you think about the Cartesia angle',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('converse');
    expect(result.target_section).toBeNull();
  });

  it('defaults to converse on malformed JSON', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({ text: 'not json' } as never);

    const result = await classifyIntent({
      userMessage: 'whatever',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('converse');
    expect(result.target_section).toBeNull();
    expect(result.patch).toBeNull();
  });

  it('defaults to converse on missing required field', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ kind: 'patch', target_section: null, instruction: '', patch: null }),
    } as never);

    const result = await classifyIntent({
      userMessage: 'fix the thing',
      auditContext,
      chatHistory: [],
    });

    // kind='patch' but patch is null → invalid; fall back to converse
    expect(result.kind).toBe('converse');
  });

  it('defaults to converse when LLM call throws', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockRejectedValue(new Error('LLM down'));

    const result = await classifyIntent({
      userMessage: 'rerun the market section',
      auditContext,
      chatHistory: [],
    });

    expect(result.kind).toBe('converse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx vitest run src/lib/research-v2/__tests__/intent-router.test.ts`
Expected: FAIL (`classifyIntent` not defined).

- [ ] **Step 3: Implement the router**

Create `src/lib/research-v2/intent-router.ts`:

```ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type {
  IntentResult,
  IntentRouterInput,
  IntentKind,
} from './intent-router.types';

const SYSTEM_PROMPT = `You classify user messages in the context of an audit-editing chat. The audit has 6 positioning sections (Market & Category, Buyer ICP, Competitor Landscape, Voice of Customer, Demand & Intent, Offer Diagnostic).

For each user message, output JSON only with this shape:
{
  "kind": "rerun" | "patch" | "converse",
  "target_section": "positioningMarketCategory" | "positioningBuyerICP" | "positioningCompetitorLandscape" | "positioningVoiceOfCustomer" | "positioningDemandIntent" | "positioningOfferDiagnostic" | null,
  "instruction": "<short string capturing actionable intent>",
  "patch": { "path": "<dotted path>", "value": <new value> } | null
}

Classification rules:
- "rerun": user wants the section regenerated with new context. Keywords: redo, regenerate, focus on, emphasize, broader, narrower, add coverage, include more X, less of Y.
- "patch": user wants a specific value changed. Keywords: change to, replace, is wrong, should be, fix the number, update the X to Y. Patch path is dotted: keyFindings[0].evidence, evidenceQuotes[2].quote, sources[1].url, etc.
- "converse": user is asking a question, exploring, no mutation. Keywords: what, why, how, explain, compare, thoughts on. Also: ambiguous messages.

Bias:
- When ambiguous, prefer "converse" — it's safer (no mutation).
- target_section is null for converse unless the message clearly names one.
- patch must be non-null when kind === 'patch'.
- If kind === 'patch' but you can't construct a valid path+value, prefer "converse" instead.

Audit context (current sections and their key findings will be provided in the user message body).`;

function isValidIntentResult(value: unknown): value is IntentResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validKinds: IntentKind[] = ['rerun', 'patch', 'converse'];
  if (typeof v.kind !== 'string' || !validKinds.includes(v.kind as IntentKind)) return false;
  if (v.target_section !== null && typeof v.target_section !== 'string') return false;
  if (typeof v.instruction !== 'string') return false;
  if (v.patch !== null) {
    if (typeof v.patch !== 'object' || v.patch === null) return false;
    const p = v.patch as Record<string, unknown>;
    if (typeof p.path !== 'string') return false;
    if (!('value' in p)) return false;
  }
  if (v.kind === 'patch' && v.patch === null) return false;
  return true;
}

const FALLBACK: IntentResult = {
  kind: 'converse',
  target_section: null,
  instruction: '',
  patch: null,
};

export async function classifyIntent(input: IntentRouterInput): Promise<IntentResult> {
  const userBody = JSON.stringify({
    message: input.userMessage,
    audit: input.auditContext,
    recentHistory: input.chatHistory.slice(-6),
  });

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      prompt: userBody,
      maxOutputTokens: 500,
    });

    const parsed = JSON.parse(result.text) as unknown;
    if (!isValidIntentResult(parsed)) {
      return FALLBACK;
    }
    return parsed;
  } catch {
    return FALLBACK;
  }
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx vitest run src/lib/research-v2/__tests__/intent-router.test.ts`
Expected: 7/7 PASS.

- [ ] **Step 5: Run full frontend tsc**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit`
Expected: baseline only.

- [ ] **Step 6: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/lib/research-v2/intent-router.ts \
        src/lib/research-v2/__tests__/intent-router.test.ts
git commit -m "$(cat <<'EOF'
feat(research-v2): intent classifier for chat-edit (rerun/patch/converse)

Sonnet-4-6 classifier behind classifyIntent(). Takes user message +
audit context + last 6 chat turns, returns {kind, target_section,
instruction, patch}. JSON-only output; strict validation; safe fallback
to 'converse' on parse failure, missing required field, or LLM error.

7 fixture tests cover: rerun, rerun-with-instruction, patch, converse,
malformed JSON, missing required field, LLM throw. All pass.

Atom 8 of research-perf-and-chat-edit plan. Atoms 9-11 consume this in
the chat route's branch logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 5: Three execution paths (atoms 9-11) — parallel-safe

These three atoms can dispatch in parallel since they touch separate code paths (rerun = worker config + chat route branch; patch = new patch-apply lib + chat route branch; converse = chat route branch). They all extend `src/app/api/research-v2/chat/route.ts` — be careful about ordering or do them sequentially to avoid merge conflicts.

### Task 9: Rerun path

**Files:**
- Modify: `research-worker/src/runners/journey-section-synthesis.ts`
- Modify: `src/app/api/research-v2/dispatch/route.ts`
- Modify: `src/lib/journey/server/dispatch-research.ts`
- Modify: `src/app/api/research-v2/chat/route.ts`
- Create: `research-worker/src/__tests__/journey-section-chat-refinement.test.ts`

- [ ] **Step 1: Write worker test for chatRefinement propagation**

Create `research-worker/src/__tests__/journey-section-chat-refinement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildContextWithRefinement } from '../runners/journey-section-synthesis';

describe('buildContextWithRefinement', () => {
  it('returns context unchanged when refinement is undefined', () => {
    const out = buildContextWithRefinement('Original context.', undefined);
    expect(out).toBe('Original context.');
  });

  it('returns context unchanged when refinement is empty string', () => {
    const out = buildContextWithRefinement('Original context.', '');
    expect(out).toBe('Original context.');
  });

  it('appends USER REFINEMENT section when refinement present', () => {
    const out = buildContextWithRefinement(
      'Original context.',
      'Focus on Cartesia',
    );
    expect(out).toContain('Original context.');
    expect(out).toContain('USER REFINEMENT');
    expect(out).toContain('Focus on Cartesia');
  });

  it('trims whitespace from refinement', () => {
    const out = buildContextWithRefinement('Ctx.', '   focus on X   ');
    expect(out).toContain('focus on X');
    expect(out).not.toContain('   focus on X   ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npx vitest run src/__tests__/journey-section-chat-refinement.test.ts`
Expected: FAIL (`buildContextWithRefinement` not exported).

- [ ] **Step 3: Add buildContextWithRefinement to journey-section-synthesis.ts**

In `research-worker/src/runners/journey-section-synthesis.ts`, near the top before `runJourneySection`, add:

```ts
export function buildContextWithRefinement(
  context: string,
  chatRefinement: string | undefined,
): string {
  const trimmed = chatRefinement?.trim();
  if (!trimmed) return context;
  return `${context}\n\n--- USER REFINEMENT ---\n${trimmed}`;
}
```

Update `runJourneySection` signature:

```ts
export async function runJourneySection(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
): Promise<ResearchResult> {
  const refinedContext = buildContextWithRefinement(context, chatRefinement);
  // ... rest of function uses refinedContext instead of context ...
}
```

Then update the messages array inside `runJourneySection` to use `refinedContext` instead of `context`.

Also update each positioning runner export in `research-worker/src/runners/positioning/index.ts` to accept and forward `chatRefinement`:

```ts
export const runPositioningMarketCategory = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
): Promise<ResearchResult> =>
  runJourneySection(
    POSITIONING_SECTION_SPECS.positioningMarketCategory,
    context,
    onProgress,
    chatRefinement,
  );
```

Repeat for all 6 positioning runners. Update the `POSITIONING_RUNNERS` typed map signature as well:

```ts
export const POSITIONING_RUNNERS: Record<
  PositioningSectionId,
  (
    context: string,
    onProgress?: RunnerProgressReporter,
    chatRefinement?: string,
  ) => Promise<ResearchResult>
> = { /* ... */ };
```

- [ ] **Step 4: Update TOOL_RUNNERS in worker index to accept chatRefinement**

In `research-worker/src/index.ts`, find the `TOOL_RUNNERS` Record type (around line 96) and update its signature to include `chatRefinement?: string` as a third parameter. Update the `/run` handler (around line 162) to read `chatRefinement` from `req.body` and pass it through to the runner invocation.

Concretely, near the existing destructure of `req.body`, add:
```ts
const { tool, context, runId, userId, baselineMetrics, chatRefinement } = req.body as {
  tool: string;
  context: string;
  runId?: string;
  userId: string;
  baselineMetrics?: BaselineMetrics;
  chatRefinement?: string;
};
```

And the runner invocation (around line 295 where `await runner(contextWithDate, emitProgress)` happens) should pass it:
```ts
const result = await runner(contextWithDate, emitProgress, chatRefinement);
```

- [ ] **Step 5: Run worker test + build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npx vitest run && npm run build`
Expected: all tests pass (existing 13 + new 4); build clean.

- [ ] **Step 6: Update API dispatch route to accept chatRefinement**

In `src/app/api/research-v2/dispatch/route.ts`, add `chatRefinement: z.string().optional()` to the Zod input schema, and pass it through to the dispatch helper.

In `src/lib/journey/server/dispatch-research.ts`, accept `chatRefinement?: string` in the input type and forward it to the worker `/run` POST body.

- [ ] **Step 7: Add rerun branch to chat route**

In `src/app/api/research-v2/chat/route.ts`, REPLACE the stub-echo logic with intent routing. Below the user-message persistence:

```ts
import { classifyIntent } from '@/lib/research-v2/intent-router';
import type { AuditContextSummary } from '@/lib/research-v2/intent-router.types';

// ... after persisting the user message ...

// Load audit context for the classifier
const { data: runRow } = await supabase
  .from('research_runs')
  .select('run_id, data')
  .eq('run_id', body.runId)
  .single();

// Build a slim AuditContextSummary from runRow.data (the sections JSONB)
const auditContext: AuditContextSummary = {
  runId: body.runId,
  sections: extractSectionSummaries(runRow?.data ?? {}),
};

// Load recent chat history
const { data: historyRows } = await supabase
  .from('audit_chat_messages')
  .select('role, content')
  .eq('run_id', body.runId)
  .order('created_at', { ascending: false })
  .limit(6);

const intent = await classifyIntent({
  userMessage: userText,
  auditContext,
  chatHistory: (historyRows ?? []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>,
});

if (intent.kind === 'rerun' && intent.target_section) {
  // Fire dispatch with chatRefinement; do not await — the section runs on the worker.
  const dispatchUrl = new URL('/api/research-v2/dispatch', req.url).toString();
  void fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      sectionId: intent.target_section,
      runId: body.runId,
      chatRefinement: intent.instruction,
    }),
  });

  // Persist the assistant ack
  const ackText = `Rerunning ${intent.target_section} with refinement: "${intent.instruction}". Watch the section activity log for live progress.`;
  await supabase.from('audit_chat_messages').insert({
    run_id: body.runId,
    role: 'assistant',
    content: ackText,
    intent: 'rerun',
    target_section: intent.target_section,
  });

  // Return a streaming text response with the ack
  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: 'You are an audit-editing assistant. Output exactly the user-supplied text — no rephrasing.',
    prompt: ackText,
  });
  return result.toUIMessageStreamResponse();
}

// fall through to converse path (implemented in atom 11)
```

And add the helper:
```ts
function extractSectionSummaries(runData: Record<string, unknown>): Array<{
  sectionId: string;
  title: string;
  statusSummary: string;
  keyFindingTitles: string[];
}> {
  const positioningKeys = [
    'positioningMarketCategory',
    'positioningBuyerICP',
    'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer',
    'positioningDemandIntent',
    'positioningOfferDiagnostic',
  ];
  return positioningKeys
    .filter((key) => runData[key])
    .map((key) => {
      const section = runData[key] as Record<string, unknown>;
      return {
        sectionId: key,
        title: (section.sectionTitle as string) ?? key,
        statusSummary: (section.statusSummary as string) ?? '',
        keyFindingTitles: Array.isArray(section.keyFindings)
          ? (section.keyFindings as Array<{ title?: string }>).map((f) => f.title ?? '')
          : [],
      };
    });
}
```

- [ ] **Step 8: Run frontend tsc**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit`
Expected: baseline only.

- [ ] **Step 9: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add research-worker/src/runners/journey-section-synthesis.ts \
        research-worker/src/runners/positioning/index.ts \
        research-worker/src/index.ts \
        research-worker/src/__tests__/journey-section-chat-refinement.test.ts \
        src/app/api/research-v2/dispatch/route.ts \
        src/lib/journey/server/dispatch-research.ts \
        src/app/api/research-v2/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(research-v2): chat-rerun path — re-dispatch sections with refinement

Worker:
- buildContextWithRefinement() appends a USER REFINEMENT block to the
  section context when chatRefinement is supplied. Tested with 4 cases.
- runJourneySection + all 6 positioning runners now accept optional
  chatRefinement; /run handler reads it from request body.

Frontend/API:
- /api/research-v2/dispatch accepts optional chatRefinement
- /api/research-v2/chat invokes classifyIntent on each user message;
  when intent.kind === 'rerun', fires a non-awaiting dispatch with the
  refinement and streams an acknowledgement back via useChat.

Atom 9. Next: patch path (atom 10) and converse path (atom 11).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Patch path

**Files:**
- Create: `src/lib/research-v2/patch-apply.ts`
- Create: `src/lib/research-v2/__tests__/patch-apply.test.ts`
- Modify: `src/app/api/research-v2/chat/route.ts`

- [ ] **Step 1: Write patch-apply test**

Create `src/lib/research-v2/__tests__/patch-apply.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyPatch, isValidPath } from '../patch-apply';

describe('isValidPath', () => {
  it('accepts simple dotted paths', () => {
    expect(isValidPath('foo.bar')).toBe(true);
    expect(isValidPath('keyFindings[0].evidence')).toBe(true);
    expect(isValidPath('sources[2].url')).toBe(true);
  });

  it('rejects empty paths', () => {
    expect(isValidPath('')).toBe(false);
  });

  it('rejects paths with dangerous tokens', () => {
    expect(isValidPath('__proto__.foo')).toBe(false);
    expect(isValidPath('constructor.prototype')).toBe(false);
  });

  it('rejects paths starting with a dot or bracket', () => {
    expect(isValidPath('.foo')).toBe(false);
    expect(isValidPath('[0].bar')).toBe(false);
  });
});

describe('applyPatch', () => {
  it('sets a top-level scalar field', () => {
    const obj = { foo: 'old' };
    const out = applyPatch(obj, { path: 'foo', value: 'new' });
    expect(out).toEqual({ foo: 'new' });
  });

  it('sets a nested field via dot path', () => {
    const obj = { a: { b: { c: 1 } } };
    const out = applyPatch(obj, { path: 'a.b.c', value: 42 });
    expect(out.a.b.c).toBe(42);
  });

  it('sets an array element field via bracket', () => {
    const obj = { keyFindings: [{ evidence: 'old' }, { evidence: 'still old' }] };
    const out = applyPatch(obj, { path: 'keyFindings[0].evidence', value: 'new' });
    expect(out.keyFindings[0].evidence).toBe('new');
    expect(out.keyFindings[1].evidence).toBe('still old');
  });

  it('throws on invalid path', () => {
    expect(() => applyPatch({}, { path: '__proto__.x', value: 1 })).toThrow();
  });

  it('throws when path traverses a missing intermediate', () => {
    expect(() => applyPatch({ a: {} }, { path: 'a.b.c', value: 1 })).toThrow(/missing/i);
  });

  it('returns a new object (no mutation of input)', () => {
    const obj = { foo: 'old' };
    const out = applyPatch(obj, { path: 'foo', value: 'new' });
    expect(obj.foo).toBe('old');
    expect(out).not.toBe(obj);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx vitest run src/lib/research-v2/__tests__/patch-apply.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement applyPatch + isValidPath**

Create `src/lib/research-v2/patch-apply.ts`:

```ts
import type { IntentPatch } from './intent-router.types';

const DANGEROUS_TOKENS = new Set(['__proto__', 'constructor', 'prototype']);

export function isValidPath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('.') || path.startsWith('[')) return false;
  const segments = path.split(/[.\[\]]+/).filter(Boolean);
  if (segments.length === 0) return false;
  return !segments.some((seg) => DANGEROUS_TOKENS.has(seg));
}

interface PathToken {
  kind: 'key' | 'index';
  value: string | number;
}

function tokenize(path: string): PathToken[] {
  // Split on . and []. Detect numeric vs string segments.
  const tokens: PathToken[] = [];
  const re = /([^.\[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match[2] !== undefined) {
      tokens.push({ kind: 'index', value: Number(match[2]) });
    } else if (match[1] !== undefined) {
      tokens.push({ kind: 'key', value: match[1] });
    }
  }
  return tokens;
}

export function applyPatch<T extends Record<string, unknown>>(
  input: T,
  patch: IntentPatch,
): T {
  if (!isValidPath(patch.path)) {
    throw new Error(`Invalid patch path: ${patch.path}`);
  }
  const tokens = tokenize(patch.path);
  if (tokens.length === 0) {
    throw new Error(`Empty patch path: ${patch.path}`);
  }

  // Deep clone the input (structuredClone is safe for JSON-compatible data)
  const out = structuredClone(input);
  let cursor: unknown = out;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const tok = tokens[i];
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error(`Path traversal hit a non-object at token "${String(tok.value)}"`);
    }
    const next =
      tok.kind === 'index'
        ? (cursor as unknown[])[tok.value as number]
        : (cursor as Record<string, unknown>)[tok.value as string];
    if (next === undefined) {
      throw new Error(`Path missing intermediate at "${String(tok.value)}"`);
    }
    cursor = next;
  }
  const last = tokens[tokens.length - 1];
  if (cursor === null || typeof cursor !== 'object') {
    throw new Error(`Path traversal hit a non-object before final token`);
  }
  if (last.kind === 'index') {
    (cursor as unknown[])[last.value as number] = patch.value;
  } else {
    (cursor as Record<string, unknown>)[last.value as string] = patch.value;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx vitest run src/lib/research-v2/__tests__/patch-apply.test.ts`
Expected: 9/9 PASS.

- [ ] **Step 5: Add patch branch to chat route**

In `src/app/api/research-v2/chat/route.ts`, BEFORE the rerun branch (since patch and rerun both depend on `intent.target_section`), add the patch branch:

```ts
import { applyPatch } from '@/lib/research-v2/patch-apply';

// ... after classifyIntent ...

if (intent.kind === 'patch' && intent.target_section && intent.patch) {
  // Load the section's current JSONB from research_runs.data[target_section]
  if (!runRow?.data) {
    return NextResponse.json({ error: 'no run data' }, { status: 404 });
  }
  const allData = runRow.data as Record<string, unknown>;
  const sectionData = allData[intent.target_section];
  if (!sectionData || typeof sectionData !== 'object') {
    // Fall back to converse if section isn't ready to patch
    // (this returns via the converse path at the bottom of the handler)
  } else {
    try {
      const patchedSection = applyPatch(
        sectionData as Record<string, unknown>,
        intent.patch,
      );
      const newAllData = { ...allData, [intent.target_section]: patchedSection };
      await supabase
        .from('research_runs')
        .update({ data: newAllData })
        .eq('run_id', body.runId);

      const ackText = `Updated ${intent.target_section} → ${intent.patch.path} = ${JSON.stringify(intent.patch.value)}`;
      await supabase.from('audit_chat_messages').insert({
        run_id: body.runId,
        role: 'assistant',
        content: ackText,
        intent: 'patch',
        target_section: intent.target_section,
      });

      const result = streamText({
        model: anthropic('claude-haiku-4-5-20251001'),
        system: 'Output exactly the user-supplied text. No rephrasing.',
        prompt: ackText,
      });
      return result.toUIMessageStreamResponse();
    } catch (err) {
      // Fall through to converse with an error note
      console.error('Patch apply failed:', err);
    }
  }
}
```

- [ ] **Step 6: Run frontend tsc**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit`
Expected: baseline only.

- [ ] **Step 7: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/lib/research-v2/patch-apply.ts \
        src/lib/research-v2/__tests__/patch-apply.test.ts \
        src/app/api/research-v2/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(research-v2): chat-patch path — surgical JSONB updates

applyPatch() + isValidPath() at src/lib/research-v2/patch-apply.ts.
Supports dotted paths with bracket indices (keyFindings[0].evidence,
sources[2].url). Blocks prototype pollution via DANGEROUS_TOKENS
(__proto__, constructor, prototype). Returns a new object via
structuredClone — no input mutation.

9 unit tests cover: simple sets, nested paths, array indices, invalid
paths, missing intermediates, no-mutation invariant.

Chat route's patch branch: when intent.kind === 'patch', loads the
target section from research_runs.data, applies the patch, writes back
via supabase.update(), persists an assistant ack message, streams the
ack to useChat. Realtime subscription delivers the updated section to
the frontend.

Atom 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 11: Converse path

**Files:**
- Modify: `src/app/api/research-v2/chat/route.ts`

- [ ] **Step 1: Replace the stub echo with a real converse implementation**

In `src/app/api/research-v2/chat/route.ts`, REMOVE the original stub echo (the streamText call near the bottom of the handler) and replace with:

```ts
// Converse path — fall-through default
const auditSummary = auditContext.sections
  .map(
    (s) =>
      `## ${s.title}\nStatus: ${s.statusSummary}\nKey findings: ${s.keyFindingTitles.join('; ')}`,
  )
  .join('\n\n');

const conversationSystem = `You are an audit-editing assistant helping a strategist refine a Pre-Pitch Positioning Audit. The user has 6 positioning sections; here is a summary of what's been generated:

${auditSummary}

Answer the user's question grounded in the audit above. If they ask for clarification on a section, refer to specific findings. If they ask a question that would require running new research or modifying a section, you may suggest "I can rerun the [section] with that refinement — want me to?" but do not actually trigger anything; this turn is conversational only.`;

const conversation = streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: conversationSystem,
  messages: convertToModelMessages(body.messages as never),
});

// Persist assistant message on completion
conversation.text.then(async (text) => {
  await supabase.from('audit_chat_messages').insert({
    run_id: body.runId,
    role: 'assistant',
    content: text,
    intent: 'converse',
  });
});

return conversation.toUIMessageStreamResponse();
```

- [ ] **Step 2: Run frontend tsc**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npx tsc --noEmit`
Expected: baseline only.

- [ ] **Step 3: Delete the now-superseded refine route**

Run: `rm src/app/api/research-v2/refine/route.ts`

- [ ] **Step 4: Run frontend tsc again to ensure nothing referenced it**

Run: `npx tsc --noEmit`
Expected: baseline only. If anything imports the deleted route, fix the import.

- [ ] **Step 5: Commit**

```bash
cd /Users/ammar/Dev-Projects/AI-GOS
git add src/app/api/research-v2/chat/route.ts \
        src/app/api/research-v2/refine/route.ts
git commit -m "$(cat <<'EOF'
feat(research-v2): chat-converse path + retire /refine stub

Converse path: streamText with Sonnet-4-6, grounded in an audit
summary (section titles + status + keyFinding titles) so the model
can answer questions referencing specific findings. Assistant message
persists to audit_chat_messages on completion.

Delete src/app/api/research-v2/refine/route.ts — superseded by
/api/research-v2/chat which handles all three actions (rerun/patch/
converse) through intent classification.

Atom 11. Wave 5 complete — all three execution paths live.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Wave 6: E2E verification (atom 12)

### Task 12: Live E2E across speed + chat

**Files:** none modified — pure verification.

- [ ] **Step 1: Start both dev servers in tmux**

```bash
tmux new-session -d -s frontend 'cd /Users/ammar/Dev-Projects/AI-GOS && npm run dev'
tmux new-session -d -s worker 'cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npm run dev'
sleep 5
tmux capture-pane -t frontend -p | tail -10
tmux capture-pane -t worker -p | tail -10
```

Expected: frontend listening on :3000, worker on :3001.

- [ ] **Step 2: Set the feature flag**

Edit `.env.local` to include `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS=true`. Restart frontend tmux session.

- [ ] **Step 3: Smoke-test the build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS && npm run build`
Expected: production build completes with no errors.

Run: `cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npm run build`
Expected: clean.

- [ ] **Step 4: Run a full audit end-to-end**

In a browser, go to `http://localhost:3000/research-v2`. Sign in. Submit a known URL (e.g., the elevenlabs.io test you ran before). Watch:

1. **Corpus phase**: should complete in ~1-2 min (no changes here)
2. **Section dispatch**: all 6 sections should start ~simultaneously after corpus completes (not sequential clicks)
3. **Activity log per section**: should show ⏱ heartbeats, 💭 thinking, 🔍 tool rows (no regression from streaming-activity-log work)
4. **Per-section wall time**: capture from activity log timestamps. Target: avg <120s, longest <150s.
5. **Total audit wall time**: from corpus complete → last section complete. Target: ~3 min.

Document the timings in a temp file:
```bash
cat > /tmp/atom-12-timings.txt <<'EOF'
Corpus duration: __
Section dispatch fan-out timestamps:
  positioningMarketCategory: dispatch=__, start=__, complete=__
  positioningBuyerICP: ...
  positioningCompetitorLandscape: ...
  positioningVoiceOfCustomer: ...
  positioningDemandIntent: ...
  positioningOfferDiagnostic: ...
Longest section wall time: __
Total audit wall (corpus_complete → last_section_complete): __
Web searches per section (count from activity log):
  positioningMarketCategory: __
  ...
EOF
```

If any section exceeds 150s OR audit total exceeds 4 min OR any section ran >2 web searches: that's a failed verification — capture screenshots and report.

- [ ] **Step 5: Test chat rerun**

In the chat sidebar of the audit workspace, type: `"redo the competitor landscape with focus on Cartesia"`.

Expected:
1. Streaming text reply: "Rerunning positioningCompetitorLandscape with refinement: focus on Cartesia. Watch the section activity log for live progress."
2. The Competitor Landscape section reverts to `researching` status; activity log fires again.
3. After ~90-120s, new artifact replaces the old. The new content should mention Cartesia prominently.
4. `audit_chat_messages` should have 2 new rows (user + assistant) plus the dispatch goes through.

- [ ] **Step 6: Test chat patch**

In chat, type: `"the market size figure in the Market & Category section should be $30B not $20.71B"`.

Expected:
1. Streaming text reply: `"Updated positioningMarketCategory → keyFindings[0].evidence = ..."` (or similar)
2. The Market & Category section's keyFinding at index 0 has the new value (verify by checking the audit panel)
3. No section rerun — the update is instant (no `researching` status)

- [ ] **Step 7: Test chat converse**

In chat, type: `"what's the strongest competitive angle to lean on here, given the Cartesia rerun?"`.

Expected:
1. Streaming text reply that references both Market & Category and Competitor Landscape findings
2. No section is rerun, no patch applied
3. `audit_chat_messages` has 2 new rows

- [ ] **Step 8: Document outcomes**

Write a brief atom-12-report.md in /tmp summarizing:
- Speed targets: met? what numbers?
- Chat rerun: worked? any UX bugs?
- Chat patch: worked? data integrity preserved?
- Chat converse: worked? grounded answers?
- Activity log regression: any disruption to the streaming-activity-log work?
- Any unexpected issues

- [ ] **Step 9: Tear down dev servers**

```bash
tmux kill-session -t frontend
tmux kill-session -t worker
```

- [ ] **Step 10: No commit (verification only)**

Verification is the gate — there's nothing to commit. If issues surface, file them as follow-up tasks; if all clean, proceed to writing-plans skill's final handoff (mark plan execution complete).

---

## Plan self-review (run on first save)

- [x] Spec coverage: every spec section (4-7) maps to atoms (1-11). Spec section 6 atom table matches the 12 tasks above.
- [x] Placeholder scan: no TBD/TODO/etc. left as instruction; checkboxes in the verification atom are intentional (executor checks them off).
- [x] Type consistency: `IntentResult` shape consistent across `intent-router.ts`, `intent-router.types.ts`, fixture test, and chat route consumption. `chatRefinement` is `string | undefined` everywhere it's passed.
- [x] Frontend protocol honored: atoms 3 and 7 both explicitly route through `/ui-ux-pro-max` → frontend agent → `/design-review`.
- [x] Test-first pattern: every atom with new logic has tests written before implementation (atoms 4, 8, 9, 10).
- [x] File paths concrete: every `Files:` block names exact paths from the actual codebase (verified during pre-plan grep).
