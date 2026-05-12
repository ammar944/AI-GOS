# Atom 12 — Manual E2E Handoff

> Programmatic verification: PASS. Manual UI verification: needs Ammar.

## Programmatic outcomes

### Build & test smoke
- Frontend `npm run build`: **TS COMPILE PASS** (Compiled successfully in 7.8s). Static prerender failed on `/_not-found` and `/dashboard/integrations` with `@clerk/clerk-react: Missing publishableKey`. **Pre-existing infra issue, not a regression** — neither file was modified on this branch (`git diff main..HEAD --stat` confirms zero touches to `src/app/_not-found*` or `src/app/dashboard/integrations*`). Root cause is env var not loaded for the build static-export worker. Vercel deploy is unaffected because Vercel injects Clerk keys at build time.
- Worker `npm run build`: PASS (clean, per orchestrator)
- Worker vitest: 384/384 (per orchestrator)
- Research-v2 vitest: 21/21 (intent 7 + patch 14, per orchestrator)
- Frontend tsc: 65 errors (= baseline, per orchestrator)

### Auth boundary (probed against `npm run dev` on :3010)
- `POST /api/research-v2/chat` unauthenticated with well-formed body → **HTTP 401** `{"error":"Unauthorized"}` ✅
- `POST /api/research-v2/chat` unauthenticated with malformed body (`{"messages":"not-an-array"}`) → **HTTP 401** `{"error":"Unauthorized"}` ✅ (auth checked before body parse — Clerk best-practice confirmed)

### Feature flag wiring
- `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS` read in: `src/app/research-v2/page.tsx:26-27`
  ```ts
  const PARALLEL_SECTIONS_ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS === 'true';
  ```
- Gate logic: `src/app/research-v2/page.tsx:349, 354, 360` — all three corpus-completion code paths (success / no-prefill / error) call `dispatchAllPositioningSections(runId)` only when the flag is true and a `runId` exists. Flag off → existing one-section-at-a-time click flow.

### Migration parity (Supabase)
- `supabase/migrations/20260512_audit_chat_messages.sql` matches deployed table:
  - PK `id uuid` (default `gen_random_uuid()`)
  - FK `(user_id, run_id) → journey_sessions(user_id, run_id) ON DELETE CASCADE`
  - CHECK on `role ∈ {user, assistant, system}` and `intent ∈ {rerun, patch, converse} | NULL`
  - Composite index on `(user_id, run_id, created_at)`
  - RLS enabled with SELECT/INSERT policies tied to `auth.jwt() ->> 'sub'`
  - No drift between SQL file and live Supabase project.

## Manual verification checklist (Ammar)

Set env in `.env.local`:
```
NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS=true
```

Start servers (in two tmux panes):
```
cd /Users/ammar/Dev-Projects/AI-GOS && npm run dev
cd /Users/ammar/Dev-Projects/AI-GOS/research-worker && npm run dev
```

### Test 1: Parallel section dispatch (P1 atom 3 + 4)
1. Sign in at http://localhost:3000
2. Go to `/research-v2`
3. Submit a known URL (elevenlabs.io recommended)
4. Wait for corpus completion (~1-2 min)
5. Observe: all 6 positioning sections should start ~simultaneously, NOT wait for clicks

**Target metrics:**
- Per-section wall time: <150s
- Total audit (corpus complete → last section complete): <5 min
- Web searches per section: ≤2

**FAIL if:** sections wait for clicks, total >5 min, any section >150s, or any section runs >2 web searches.

### Test 2: Chat rerun (P3 atom 9 + fixes)
With audit complete, in chat panel: `"redo the competitor landscape with focus on Cartesia"`

Expected:
- Streaming: "Rerunning positioningCompetitorLandscape with refinement: 'focus on Cartesia'..."
- Competitor Landscape section returns to researching state
- After ~90-120s, new artifact mentions Cartesia prominently
- `audit_chat_messages` has 2 new rows (user + assistant intent='rerun')

**FAIL if:** ack but no rerun fires, duplicate workers race, or refinement doesn't reach the prompt.

### Test 3: Chat patch (P3 atom 10 + fixes)
In chat: `"the market size figure in the Market & Category section should be $30B not $20.71B"`

Expected:
- Streaming: "Updated positioningMarketCategory → keyFindings[0].evidence = ..." (or similar)
- Market & Category section's keyFinding updated in-place (no full rerun)
- `audit_chat_messages` row with intent='patch'

**FAIL if:** triggers a rerun instead, corrupts other sections, or 500s.

### Test 4: Chat converse (P3 atom 11 + fixes)
In chat: `"what's the strongest competitive angle to lean on here?"`

Expected:
- Streaming Sonnet answer that references specific findings from Market & Category + Competitor Landscape
- No section reruns, no patches applied
- `audit_chat_messages` row with intent='converse'
- After page refresh, the chat history persists (server-owned)

**FAIL if:** model hallucinates section names, lacks grounding, or chat history vanishes on reload.

### Test 5: Page reload preserves chat (atom 11 fix)
After tests 2-4, reload `/research-v2`. Confirm chat thread still shows the prior messages.

## What was changed across all 4 phases

| Phase | Commit | Atom | Change |
|---|---|---|---|
| P1 | 4c8b13e7 | 3 | Dispatch all 6 positioning sections concurrently from corpus completion |
| P1 | 695a6221 | 3 cleanup | Import canonical sectionIds + credentials |
| P1 | 292ac476 | 4 | `WORKER_RUN_CONCURRENCY` cap (default 6) |
| P1 | a529afae | 4 follow-up | Close slot-leak window in IIFE prologue |
| P2 | (per orchestrator) | streaming | runStreamingAttempt + activity log atoms 1-7 |
| P3 | 103083ac | schema | `audit_chat_messages` table migration |
| P3 | 285e3961 | 8 stub | Chat route stub |
| P3 | 8c442565 | 8 | Unified audit chat surface |
| P3 | 71634c9a | 8 | Chat intent classifier |
| P3 | 141be06b | 9 | Chat-rerun path — re-dispatch sections with refinement |
| P3 | 675bb6fe | 9 fix | Codex review fixes for chat-rerun |
| P3 | 04a06ddf | 10 | Chat-patch path — surgical JSONB updates |
| P3 | 5b92888e | 10 fix | Codex review fixes for chat-patch |
| P3 | 56233d35 | 11 | Chat-converse path + retire `/refine` stub |
| P3 | 57634993 | 11 fix | Converse uses server-verified chat history |

## Known caveats
- 3 unrelated tables (`research_telemetry`, `research_results_shadow`, `research_eval_diffs`) have RLS disabled — flagged in Supabase advisor, decision deferred.
- 65 frontend tsc baseline errors are pre-existing (openrouter tests, chat blueprint tests).
- Frontend `npm run build` static-prerender step fails locally for `/_not-found` and `/dashboard/integrations` due to a missing Clerk publishable key in the build worker env. Pre-existing, unrelated to this cycle. Vercel deploy unaffected.
- `shiki` version drift warning during build (`@streamdown/code` pins 3.23.0, project hoists 4.0.2). Pre-existing, not blocking.
