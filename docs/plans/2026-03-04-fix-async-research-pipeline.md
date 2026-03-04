# Fix Async Research Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the async research pipeline reliably complete end-to-end — from lead agent tool call → Railway worker → Supabase → Realtime → UI cards — with proper error states, timeouts, and agent behavior during research.

**Architecture:** Lead agent dispatches research to a Railway Express worker (fire-and-forget). Worker runs Anthropic sub-agents with `web_search_20250305`, writes results to `journey_sessions.research_results` in Supabase. Frontend `useResearchRealtime` hook receives updates via Supabase Postgres Changes and injects synthetic tool-result messages into the chat.

**Tech Stack:** Next.js (Vercel), Railway (Express worker), Supabase (Postgres + Realtime), Vercel AI SDK, Anthropic SDK, Clerk auth

---

## Root Causes Identified

1. **`research_results` column is missing from `journey_sessions`** — The migration at `supabase/migrations/20260227_create_journey_sessions_table.sql` never added this column. The Railway worker's `writeResearchResult()` does `select('research_results')` then `update({ research_results: ... })` but the column doesn't exist. This is why results never arrive.

2. **Supabase Realtime not enabled on `journey_sessions`** — Realtime must be explicitly enabled for a table. Without it, the `postgres_changes` subscription in `useResearchRealtime` receives no events even when the column is correctly written.

3. **`RAILWAY_WORKER_URL` env var undocumented** — Not in CLAUDE.md or any env file template. Dev environments silently fall back to `{ status: 'error' }` with just a console.error. No UI surfaces this.

4. **No timeout or error state in `useResearchRealtime`** — The hook waits indefinitely. If the worker fails or Realtime is broken, the user sees "Research is running" forever.

5. **Agent violates system prompt during research** — Prompt says "acknowledge in one sentence, then immediately continue". In the demo, the agent said "Sit tight" and went silent. The prompt section needs to be more explicit with a scripted behavior.

6. **Synthesis trigger sends a raw `[SYSTEM]` user message** — `onAllSectionsComplete` calls `sendMessage({ text: '[SYSTEM] All 4 research sections complete...' })`. This is visible to the user as a user bubble and looks broken.

---

## Task 1: Add `research_results` Column Migration

**Files:**
- Create: `supabase/migrations/20260304_add_research_results_to_journey_sessions.sql`

**Step 1: Write the migration**

```sql
-- Add research_results column to journey_sessions for async research worker
-- This column stores structured results from the Railway research worker.
-- Format: { [sectionName]: ResearchResult }
-- The Realtime subscription in useResearchRealtime depends on this column existing.

alter table journey_sessions
  add column if not exists research_results jsonb default '{}'::jsonb;

-- Enable Realtime on this table (required for useResearchRealtime postgres_changes subscription)
-- Run this in the Supabase SQL editor or via the Dashboard → Database → Replication.
-- Cannot be done via migration SQL alone — must use Supabase management API or Dashboard.
-- See: https://supabase.com/docs/guides/realtime/postgres-changes

comment on column journey_sessions.research_results is
  'Stores research section results written by Railway worker. Keys: industryMarket, competitors, icpValidation, offerAnalysis, crossAnalysis, keywordIntel.';
```

**Step 2: Apply the migration via Supabase MCP**

Use the MCP tool `apply_migration` with project_id from `mcp__supabase__list_projects`. Name: `add_research_results_to_journey_sessions`.

**Step 3: Enable Realtime via Supabase MCP**

Run this SQL via `execute_sql`:
```sql
-- Enable Realtime publication for journey_sessions
-- This makes postgres_changes subscriptions work for this table
alter publication supabase_realtime add table journey_sessions;
```

**Step 4: Verify column exists**

Run via `execute_sql`:
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'journey_sessions' and column_name = 'research_results';
```
Expected: 1 row with `data_type = 'jsonb'`

**Step 5: Verify Realtime publication**

Run via `execute_sql`:
```sql
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'journey_sessions';
```
Expected: 1 row

**Step 6: Commit**

```bash
git add supabase/migrations/20260304_add_research_results_to_journey_sessions.sql
git commit -m "feat: add research_results column + Realtime to journey_sessions"
```

---

## Task 2: Add `RAILWAY_WORKER_URL` to Env Docs and Validate at Startup

**Files:**
- Modify: `CLAUDE.md` (env vars section)
- Modify: `src/lib/ai/tools/research/dispatch.ts`

**Step 1: Update CLAUDE.md env vars section**

In the "Optional" section, add:
```
RAILWAY_WORKER_URL=    # Research worker URL (e.g. https://your-worker.railway.app)
RAILWAY_API_KEY=       # Bearer token for worker auth (set same in worker env)
```

In the "Required" section note: `RAILWAY_WORKER_URL` is required for research tools to work. Without it, all research dispatches silently fail.

**Step 2: Improve dispatch error logging**

In `src/lib/ai/tools/research/dispatch.ts`, improve the missing-URL branch to log clearly and return a descriptive error that will surface in the agent's context:

Current code (lines 26-29):
```typescript
  if (!workerUrl) {
    console.error('[dispatch] RAILWAY_WORKER_URL not configured');
    return { status: 'error', section, error: 'Research worker not configured' };
  }
```

Replace with:
```typescript
  if (!workerUrl) {
    console.error(
      '[dispatch] RAILWAY_WORKER_URL not set — research cannot run. ' +
      'Set RAILWAY_WORKER_URL in .env.local (run worker with: cd research-worker && npm run dev)'
    );
    return {
      status: 'error',
      section,
      error: 'Research worker not reachable. RAILWAY_WORKER_URL is not configured.'
    };
  }
```

**Step 3: Add health check before dispatching**

In `dispatch.ts`, add a quick health check so dispatch fails fast with a clear error instead of timing out:

After the `workerUrl` null check, add:
```typescript
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
      error: 'Research worker is not reachable. Check RAILWAY_WORKER_URL and ensure the worker is running.'
    };
  }
```

**Step 4: Run build to check for TS errors**

```bash
npm run build
```
Expected: exits 0, no new errors

**Step 5: Commit**

```bash
git add CLAUDE.md src/lib/ai/tools/research/dispatch.ts
git commit -m "fix: RAILWAY_WORKER_URL validation + health check before dispatch"
```

---

## Task 3: Add Timeout and Error State to `useResearchRealtime`

**Files:**
- Modify: `src/lib/journey/research-realtime.ts`
- Modify: `src/app/journey/page.tsx`

**Problem:** If research never completes (worker down, Realtime broken), the UI shows "Research is running" forever. Users need to know after a reasonable timeout that something went wrong.

**Step 1: Add timeout and error callback to the hook interface**

In `src/lib/journey/research-realtime.ts`, update `UseResearchRealtimeOptions`:

```typescript
interface UseResearchRealtimeOptions {
  userId: string | null | undefined;
  onSectionComplete: (section: string, result: ResearchSectionResult) => void;
  onAllSectionsComplete?: (allResults: Record<string, ResearchSectionResult>) => void;
  onTimeout?: (pendingSections: string[]) => void;  // NEW
  timeoutMs?: number;  // NEW — default 3 minutes
}
```

**Step 2: Add timeout logic inside the hook effect**

In `useResearchRealtime`, after subscribing, add a timeout that fires if not all prerequisite sections arrive:

```typescript
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const timeout = setTimeout(() => {
      const pending = [...SYNTHESIS_PREREQUISITES].filter(
        (s) => !seenSections.current.has(s),
      );
      if (pending.length > 0) {
        onTimeoutRef.current?.(pending);
      }
    }, timeoutMs ?? 3 * 60 * 1000); // 3 minutes default

    // ... rest of existing code ...

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, timeoutMs]);
```

Add `onTimeoutRef`:
```typescript
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
```

**Step 3: Handle timeout in `page.tsx`**

In `src/app/journey/page.tsx`, update the `useResearchRealtime` call to handle timeout:

```typescript
  const [researchTimedOut, setResearchTimedOut] = useState(false);

  useResearchRealtime({
    userId: user?.id,
    onSectionComplete: (section: string, result: ResearchSectionResult) => {
      // ... existing code ...
    },
    onAllSectionsComplete: (allResults: Record<string, ResearchSectionResult>) => {
      // ... existing code ...
    },
    onTimeout: (pendingSections) => {
      console.warn('[journey] Research timed out, pending:', pendingSections);
      setResearchTimedOut(true);
    },
  });
```

**Step 4: Show timeout state in UI**

In the chat rendering area in `page.tsx`, add a visible warning when research times out. Find where `isLoading` is used and add below the message list:

```tsx
{researchTimedOut && (
  <div className="mx-auto max-w-[720px] px-4 py-2">
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      Research is taking longer than expected. The worker may be temporarily unavailable.
      You can continue the conversation — results will appear if they complete.
    </div>
  </div>
)}
```

**Step 5: Run build**

```bash
npm run build
```
Expected: exits 0

**Step 6: Commit**

```bash
git add src/lib/journey/research-realtime.ts src/app/journey/page.tsx
git commit -m "feat: add 3-minute timeout + error state to useResearchRealtime"
```

---

## Task 4: Fix Agent Behavior During Research (System Prompt)

**Files:**
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

**Problem:** The demo showed the agent saying "Sit tight — shouldn't be long" and going completely silent while research ran. The system prompt says to continue, but it's not prescriptive enough. The agent needs a scripted fallback.

**Step 1: Find the research queued instruction**

In `lead-agent-system.ts`, find this text (around line 202):
```
When a research tool returns `{ status: 'queued' }`, treat it as success. The research is running in the background — results will appear in the chat on their own. Acknowledge briefly in one sentence ("Research is running — I'll surface findings as they come in") then immediately continue the conversation with the next question. Do NOT wait or ask the user to wait. Do NOT say "I'm waiting for results".
```

**Step 2: Replace with more prescriptive instruction**

Replace that paragraph with:

```
When a research tool returns \`{ status: 'queued' }\`, treat it as success. Research is now running asynchronously — results will appear automatically in the chat as cards. You MUST do ALL of the following in the same response:

1. Acknowledge in exactly one sentence (e.g. "Research is running in the background — I'll surface findings as they land.")
2. Immediately pivot to the next uncollected required field using askUser. Do NOT say "sit tight", "hang on", or ask the user to wait.
3. If all 8 fields are already collected, share 2-3 sentences of preliminary strategic insight based on what you already know from training. Never go silent.

ABSOLUTELY DO NOT: Stop the conversation, say "sit tight", say "I'm waiting for results", or leave the user without a prompt or comment.

When research errors return \`{ status: 'error' }\`, acknowledge in one sentence ("One research track hit an issue — I'll work with what we have") then continue as normal. Do not dwell on it.
```

**Step 3: Run build**

```bash
npm run build
```
Expected: exits 0

**Step 4: Commit**

```bash
git add src/lib/ai/prompts/lead-agent-system.ts
git commit -m "fix: prescribe agent behavior when research queues — no silent gaps"
```

---

## Task 5: Fix Synthesis Trigger (Don't Send Visible User Message)

**Files:**
- Modify: `src/app/journey/page.tsx`

**Problem:** `onAllSectionsComplete` calls `sendMessage({ text: '[SYSTEM] All 4 research sections complete...' })`. This renders as a visible user bubble in the chat saying `[SYSTEM] All 4...` — it looks broken and breaks the conversational illusion.

**Step 1: Understand the current broken code**

In `page.tsx` lines 144-149:
```typescript
    onAllSectionsComplete: (allResults: Record<string, ResearchSectionResult>) => {
      const synthesisContext = JSON.stringify(allResults, null, 2);
      sendMessage({
        text: `[SYSTEM] All 4 research sections complete. Please synthesize the research now. Here are the results:\n\n${synthesisContext}`,
      });
    },
```

This is wrong because `sendMessage` sends a user turn. The user sees this as their own message in the chat.

**Step 2: Replace with a hidden trigger via transport body**

The correct approach is to not send a user message at all, but instead let the lead agent's next natural response reference the research data that's now showing as inline cards. The synthesis should happen when the user next sends a message, or be triggered via a special system injection.

The simplest fix that doesn't break the transport: send the synthesis trigger as a **system injection** by appending a hidden context block to the next API call. Since we can't modify transport mid-flight easily, the best approach is to store the synthesis trigger and include it in the next `transportBody`.

Replace the `onAllSectionsComplete` handler with:

```typescript
    onAllSectionsComplete: (allResults: Record<string, ResearchSectionResult>) => {
      // Don't send a visible user message — inject synthesis context as a system note
      // that gets included in the next API request body
      const synthesisContext = JSON.stringify(allResults, null, 2);
      setTransportBody((prev) => ({
        ...prev,
        synthesisContext,
      }));
      // Send a minimal, invisible-to-user trigger that prompts synthesis
      // We append a subtle prompt that reads naturally in assistant context
      sendMessage({
        text: 'The research is complete. Please synthesize the findings into strategic recommendations.'
      });
    },
```

Wait — this still shows as a user bubble. Better approach: modify the system prompt dynamically instead. The cleanest solution for now is to at least make the text not include `[SYSTEM]` and keep it natural-sounding so it doesn't look broken if seen:

```typescript
    onAllSectionsComplete: () => {
      // All research cards are now visible in chat.
      // Prompt the agent to synthesize — this sends as a user turn,
      // but the text is conversational enough to not look broken.
      sendMessage({
        text: "Okay — looks like the research is all in. What's your read on everything you found?"
      });
    },
```

This way the synthesis trigger reads as a natural user prompt, not a system artifact.

**Step 3: Update the handler in `useResearchRealtime` call**

```typescript
  useResearchRealtime({
    userId: user?.id,
    onSectionComplete: (section: string, result: ResearchSectionResult) => {
      const toolName = sectionToToolName(section);
      const syntheticMessage: any = {
        id: `realtime-${section}-${Date.now()}`,
        role: 'assistant' as const,
        content: '',
        parts: [
          {
            type: `tool-${toolName}`,
            toolName,
            toolCallId: `realtime-${section}`,
            state: 'output-available' as const,
            input: {},
            output: JSON.stringify(result),
          },
        ],
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, syntheticMessage]);
    },
    onAllSectionsComplete: () => {
      sendMessage({
        text: "Okay — looks like the research is all in. What's your read on everything you found?"
      });
    },
    onTimeout: (pendingSections) => {
      console.warn('[journey] Research timed out, pending:', pendingSections);
      setResearchTimedOut(true);
    },
  });
```

**Step 4: Run build**

```bash
npm run build
```
Expected: exits 0

**Step 5: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "fix: synthesis trigger uses natural user message, not [SYSTEM] artifact"
```

---

## Task 6: Local Dev — Run Railway Worker Locally

**Files:**
- Modify: `research-worker/package.json` (verify dev script exists)
- Create: `research-worker/.env.example`
- Modify: `CLAUDE.md` (add local dev instructions)

**Problem:** Developers can't test the full research pipeline without the Railway worker running. There's no documentation on how to run it locally.

**Step 1: Check existing dev script**

```bash
cat research-worker/package.json | grep -A5 '"scripts"'
```

Expected: should have a `dev` script like `"dev": "tsx watch src/index.ts"`

If missing, add it.

**Step 2: Create `.env.example` for the worker**

Create `research-worker/.env.example`:
```
# Railway Research Worker — Local Dev
PORT=3001
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RAILWAY_API_KEY=dev-secret
FIRECRAWL_API_KEY=optional_firecrawl_key
SPYFU_API_KEY=optional_spyfu_key
```

**Step 3: Add local dev instructions to CLAUDE.md**

In CLAUDE.md, under the Commands section, add:

```markdown
## Running the Research Worker Locally

The research pipeline requires the Railway worker. For local development:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Research worker
cd research-worker
cp .env.example .env  # fill in your keys
npm run dev           # starts on :3001
```

Then add to your `.env.local`:
```
RAILWAY_WORKER_URL=http://localhost:3001
RAILWAY_API_KEY=dev-secret
```
```

**Step 4: Verify the worker starts**

```bash
cd research-worker && npm run dev
```
Expected: `[worker] Research worker listening on :3001`

Then hit health check:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","ts":"..."}`

**Step 5: Commit**

```bash
cd ..
git add research-worker/.env.example CLAUDE.md
git commit -m "docs: add local dev instructions for research worker"
```

---

## Task 7: End-to-End Verification

**Goal:** Confirm the entire pipeline works from lead agent tool call through to UI card rendering.

**Step 1: Set up environment**

Verify `.env.local` has:
```
RAILWAY_WORKER_URL=http://localhost:3001
RAILWAY_API_KEY=dev-secret
```

Verify `research-worker/.env` has correct:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

**Step 2: Start both services**

```bash
# Terminal 1
npm run dev

# Terminal 2
cd research-worker && npm run dev
```

**Step 3: Verify dispatch health check**

In browser console or a quick test: confirm that when dispatch.ts runs, the health check to `http://localhost:3001/health` succeeds.

**Step 4: Trigger research manually**

```bash
curl -X POST http://localhost:3001/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-secret" \
  -d '{
    "tool": "researchIndustry",
    "context": "B2B SaaS growth agency targeting $500K-$3M ARR companies",
    "userId": "test-user-id",
    "jobId": "test-job-1"
  }'
```
Expected: `{"status":"accepted","jobId":"test-job-1"}`

**Step 5: Verify Supabase write**

After ~60 seconds, check if the research result was written. Run in Supabase SQL editor:
```sql
select user_id, research_results->'industryMarket'->>'status' as status
from journey_sessions
where user_id = 'test-user-id'
order by created_at desc limit 1;
```
Expected: row with `status = 'complete'`

**Step 6: Full E2E in browser**

1. Navigate to `/journey`
2. Complete the onboarding conversation (all 8 fields)
3. Observe research tool cards appearing with "queued" state
4. Observe the agent continuing conversation (asking next question or sharing insights) — NOT going silent
5. Within 1-3 minutes, observe research cards updating with actual data
6. Observe the synthesis trigger ("Okay — looks like the research is all in...")
7. Observe the agent synthesizing research into strategic recommendations

**Step 7: Test timeout state**

Stop the Railway worker mid-research. Verify that after 3 minutes, the amber timeout warning appears in the UI.

**Step 8: Final build + tests**

```bash
npm run build
npm run test:run
```
Expected: build exits 0, tests pass

**Step 9: Commit**

```bash
git add .
git commit -m "fix: async research pipeline E2E verified — all fixes complete"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/migrations/20260304_add_research_results_to_journey_sessions.sql` | Add `research_results` column |
| Supabase (via MCP) | Enable Realtime on `journey_sessions` |
| `CLAUDE.md` | Document `RAILWAY_WORKER_URL`, `RAILWAY_API_KEY`, local dev setup |
| `src/lib/ai/tools/research/dispatch.ts` | Health check before dispatch, better error messages |
| `src/lib/journey/research-realtime.ts` | 3-minute timeout with `onTimeout` callback |
| `src/app/journey/page.tsx` | Handle timeout state, fix synthesis trigger message |
| `src/lib/ai/prompts/lead-agent-system.ts` | Prescribe exact agent behavior when research queues |
| `research-worker/.env.example` | Document required worker env vars |

## Non-Goals (Out of Scope for This Fix)

- Parallelizing research across multiple worker instances
- Adding a retry mechanism for failed sections
- Building a research status polling fallback (Realtime-only for now)
- UI redesign for research cards
- Any changes to the Railway worker logic itself
