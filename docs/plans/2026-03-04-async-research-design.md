# Async Research Worker — Design Doc
**Date**: 2026-03-04
**Branch**: aigos-v2
**Status**: Approved

---

## Problem

The journey flow has a 64-120s dead stop every time a research tool fires. Root cause: Vercel AI SDK `streamText` tool execution is synchronous — `execute()` blocks the entire stream while the Anthropic sub-agent runs. The user cannot submit input, the model cannot ask the next question, and the UI appears frozen. With 5 research tools running sequentially, total blocked time is 5-10 minutes.

Five root causes identified:
1. Sequential research blocking — each tool takes 60-120s, user sees nothing
2. No parallel chaining — tools can't run concurrently within one stream step
3. Tool calls block question flow — agent can't ask the next question while a sub-agent runs
4. Missing fields gate tool triggers — creates forced multi-turn waits
5. No progress feedback — frozen UI with no indication of what's happening

---

## Solution: Railway Worker + Supabase Realtime

Decouple research execution from the chat stream entirely. Research tools become instant fire-and-forget HTTP calls to a Railway worker. Results flow back to the frontend independently via Supabase Realtime.

### Architecture

```
User Browser
  ├── Chat stream ──────────────→ Vercel (Next.js)        conversation only
  └── Supabase Realtime ◄──────── journey_sessions table   research results

Vercel (Next.js) /api/journey/stream
  ├── Lead agent: streamText (unchanged)
  └── Research tools: POST to Railway → 202 immediately → continue conversation

Railway Worker (always-on Node.js)
  ├── POST /run  → accepts job, runs sub-agent, writes results to Supabase
  └── GET /health → Railway health checks

Supabase journey_sessions
  ├── research_results JSONB (per-section results)
  └── Realtime subscription → frontend receives cards as each section completes
```

### User Experience Change

**Before**: User answers question → research fires → 90s frozen UI → model finally asks next question

**After**: User answers question → research fires (instant) → model immediately asks next question → research card appears in chat asynchronously as it completes (same progressive reveal, zero blocking)

---

## Implementation

### 1. Railway Worker Service

New directory: `research-worker/` at repo root. Deployed separately to Railway, not part of Next.js build.

```
research-worker/
  src/
    index.ts        Express server — /run and /health routes
    runner.ts       Sub-agent execution (same logic as current runner.ts)
    tools/          Research tool implementations (migrated from src/lib/ai/tools/research/)
    supabase.ts     Supabase service-role client for writing results
  package.json      Standalone deps: express, @anthropic-ai/sdk, @supabase/supabase-js, zod
  tsconfig.json
  Dockerfile        Railway build target
  .env.example      ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAILWAY_API_KEY
```

**Job contract — Vercel → Railway:**
```ts
POST /run
Authorization: Bearer ${RAILWAY_API_KEY}

Body: {
  tool: 'researchIndustry' | 'researchCompetitors' | 'researchICP' | 'researchOffer' | 'synthesizeResearch' | 'researchKeywords',
  context: string,   // assembled onboarding context
  userId: string,    // Clerk userId for journey_sessions lookup
  jobId: string      // uuid for idempotency
}

Response: 202 Accepted { jobId }
```

**On completion**, Railway writes to Supabase:
```ts
// success
journey_sessions.research_results[section] = {
  status: 'complete',
  section: 'industryMarket',
  data: { ... },      // existing schema unchanged
  durationMs: 43200
}

// failure
journey_sessions.research_results[section] = {
  status: 'error',
  section: 'industryMarket',
  error: 'Sub-agent timed out after 120s'
}
```

Railway returns `202` immediately then runs the sub-agent in the background (`setImmediate` / fire-and-forget after response sent).

### 2. Vercel Tool Changes

Each research tool in `src/lib/ai/tools/research/` changes from:

```ts
// BEFORE — blocks for 60-120s
execute: async ({ context }) => {
  const finalMsg = await runWithBackoff(() => client.beta.messages.toolRunner(...))
  return { status: 'complete', section: 'industryMarket', data: ... }
}
```

To:

```ts
// AFTER — returns in <500ms
execute: async ({ context }) => {
  const jobId = crypto.randomUUID()
  const res = await fetch(`${process.env.RAILWAY_WORKER_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RAILWAY_API_KEY}`,
    },
    body: JSON.stringify({ tool: 'researchIndustry', context, userId, jobId }),
    signal: AbortSignal.timeout(5000), // 5s timeout on the dispatch call only
  })
  if (!res.ok) return { status: 'error', section: 'industryMarket', error: 'Worker unavailable' }
  return { status: 'queued', section: 'industryMarket', jobId }
}
```

### 3. Lead Agent System Prompt Update

Add one paragraph to the `## Progressive Research` section:

> When a research tool returns `{ status: 'queued' }`, treat it as success. Acknowledge briefly ("Research is running — I'll surface findings as they come in") and immediately continue with the next onboarding question. Do not wait for research to complete before asking the next question.

Update `synthesizeResearch` trigger: instead of "all 4 prior tools completed", synthesize triggers when all 4 sections appear in `research_results` (detected by the frontend, which re-sends a message to trigger synthesis). This is handled via a new `triggerSynthesis` tool or a Supabase function — see Section 5.

### 4. Frontend Supabase Realtime Subscription

In `src/app/journey/page.tsx`, add a `useEffect` after the chat hook:

```ts
useEffect(() => {
  if (!userId) return

  const channel = supabase
    .channel(`journey-research-${userId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'journey_sessions',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const results = payload.new.research_results as Record<string, ResearchResult>
      // Diff against previously seen sections — append only new ones
      for (const [section, result] of Object.entries(results)) {
        if (!seenSections.has(section)) {
          seenSections.add(section)
          appendResearchCard(section, result)  // synthetic message → ResearchInlineCard
        }
      }
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [userId])
```

`appendResearchCard` adds a synthetic assistant message with a tool result part that the existing `ResearchInlineCard` component renders. No new components needed.

### 5. Synthesis Trigger

`synthesizeResearch` currently depends on all 4 prior tools completing. With async research, completion is detected in the frontend. When all 4 sections arrive via Realtime:

1. Frontend sends a chat message: `"[SYSTEM] All research sections complete. Run synthesis."`
2. Lead agent detects this (system prompt instructs it to watch for this trigger) and calls `synthesizeResearch`
3. `synthesizeResearch` dispatches to Railway same as other tools — returns `queued` immediately
4. Synthesis result arrives via Realtime when done

Alternative (cleaner): A Supabase DB trigger fires a webhook to `/api/research/synthesize` when all 4 sections are complete — no frontend involvement. This is the preferred approach.

### 6. Supabase Schema Migration

```sql
-- Add research_results column
ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS research_results JSONB DEFAULT '{}';

-- Enable Realtime on the table (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE journey_sessions;
```

### 7. Environment Variables

**Vercel (add):**
```
RAILWAY_WORKER_URL=https://your-service.railway.app
RAILWAY_API_KEY=<shared secret, generate with openssl rand -hex 32>
```

**Railway (set in dashboard):**
```
ANTHROPIC_API_KEY=<same as Vercel>
SUPABASE_URL=<same as Vercel>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard — not the anon key>
RAILWAY_API_KEY=<same shared secret>
PORT=3001
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Railway service down | Tool returns `{ status: 'error' }`, lead agent tells user "research temporarily unavailable", continues onboarding without it |
| Sub-agent fails (API error, timeout) | Railway writes `{ status: 'error' }` to Supabase, frontend shows muted failure card with section name |
| Sub-agent rate limited | Railway worker handles backoff internally (same `runWithBackoff` logic), no impact on chat |
| Realtime subscription drops | Supabase client auto-reconnects, results arrive when reconnected |
| Synthesis trigger missed | Frontend polls `journey_sessions.research_results` on mount to catch already-completed sections |

---

## What Does NOT Change

- Lead agent model, system prompt structure (only one paragraph added), tool names, tool input schemas
- `ResearchInlineCard` component and all intel card components
- `journey_sessions` table structure (one column added)
- Supabase persistence for askUser results
- The sequential ordering intent: `researchIndustry` → `researchCompetitors` → `researchICP` → `researchOffer` → `synthesizeResearch` — this still happens, just non-blocking

---

## Implementation Order

1. **Railway setup** — init project, Railway CLI deploy, health check live
2. **Supabase migration** — add column, enable Realtime
3. **Railway worker** — Express service with all 6 tool implementations
4. **Vercel tool shims** — swap execute() in all 6 research tools to fire-and-forget
5. **Frontend Realtime** — subscription + appendResearchCard in journey/page.tsx
6. **Synthesis trigger** — Supabase DB function or frontend detection
7. **System prompt update** — handle `queued` status, remove blocking assumptions
8. **E2E test** — full journey run, verify cards appear async, conversation flows freely
