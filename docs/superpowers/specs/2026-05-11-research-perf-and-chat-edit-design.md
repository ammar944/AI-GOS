# Design: Research Performance + Chat-Edit (Approach A — Lean v1)

**Date**: 2026-05-11
**Author**: Ammar (brainstorm with Claude)
**Branch (proposed)**: `feat/research-perf-and-chat-edit` (off `feat/research-v2`, after [`1bf5c91b`](#))
**Status**: DRAFT — pending user review

---

## 1. Problem

Two compounding issues with the Pre-Pitch Positioning Audit:

**(a) Wall time.** A single positioning section takes ~4-5 min today. Running all 6 takes ~30 min if clicked sequentially. The streaming activity log we just shipped (commits `6038a367` → `1bf5c91b`) killed the perceived 3-4 min silence, but the underlying work is still slow. Decomposition of one observed run:

- Phase setup + skill bootstrap: ~30s
- Visible web searches (parallel inside one Anthropic call): ~30s
- **Model generation + writing (silent in stream but heartbeat-covered): ~3-4 min**
- Final artifact write to Supabase: <1s

The bottleneck is output generation, not research. The model is running an 18k-token cascade with extended thinking + tool iteration inside one toolRunner call. Each call's wall time is dominated by token output rate.

**(b) Refine is stubbed.** `/api/research-v2/refine` returns `not_implemented`. There's no way to iterate on a generated section. For a strategic artifact that media buyers use to write ads, "good enough on first try" is an unrealistic bar. Editing is a core feature, not a nice-to-have.

## 2. Goals (success criteria)

1. **Full audit (corpus + 6 sections) completes in ~3 min wall time.** Measured: time from "Run section" click on the first section to final artifact in the audit sheet for the slowest section.
2. **Each individual section completes in ~90-120s on average.** Measured: time from runner start to artifact write.
3. **Editing the audit via chat works for 3 actions**:
   - Re-run a section with a refinement instruction (replaces old artifact)
   - Patch a specific field surgically (no model re-run, instant)
   - Conversational followup (no artifact change)
4. **Intent is detected from natural-language messages** — no slash commands required. The user types "make the competitor analysis focus on Cartesia" and the system figures out it's a section rerun.
5. **No regressions** on the streaming activity log shipped this week. Reruns must show the same live activity log experience as fresh runs.

## 3. Non-goals (out of scope for v1)

- **Versioning of artifacts.** Reruns overwrite. If we miss the old version after using the product, we add versioning as a 2-3h follow-up. Don't gold-plate v1.
- **Per-section chat scope.** One unified chat per audit run. Per-section chat is a future "Notion AI"-style refinement; not v1.
- **Agent-loop architecture** (AI SDK v6 `ToolLoopAgent`). We use a simple intent classifier + dispatcher. Agentic feel comes later.
- **Frontend visual redesign** of the audit panel, sections list, or chat sidebar. Reuses existing components. Any new components route through `/ui-ux-pro-max` → `frontend` agent → `/design-review` per the locked frontend protocol in `.claude/workspaces/aigos-feature-dev/CLAUDE.md`.
- **Sub-agent parallelization within a single section.** We get to ~90s/section without splitting one section into 5 concurrent sub-tasks. Park as v2.
- **Corpus rework.** `runDeepResearchProgram` is preserved as-is. Sections still get web search (just capped); we don't strip research from sections.
- **Cross-user / multi-tenant editing.** No concurrent-edit handling. One audit, one editor at a time.

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND  (Next.js 16, /research-v2)                                     │
│                                                                          │
│   On corpus complete →                                                   │
│     dispatch all 6 positioning sections CONCURRENTLY                     │
│       (new behavior; today is sequential click-by-click)                 │
│                                                                          │
│   Chat sidebar (one thread per audit run)                                │
│     useChat + DefaultChatTransport → POST /api/research-v2/chat          │
│                                                                          │
│   Activity log (existing) renders streaming events from the worker       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ NEXT.JS API ROUTES                                                       │
│                                                                          │
│   POST /api/research-v2/dispatch   (existing; preserved)                 │
│     ↑ accepts new optional field: chatRefinement?: string                │
│                                                                          │
│   POST /api/research-v2/chat       (NEW)                                 │
│     1. Load chat history + audit context (run + completed sections)      │
│     2. Run intent router (Sonnet classifier) →                           │
│        { kind: 'rerun' | 'patch' | 'converse', target?, instruction? }   │
│     3. Branch on kind:                                                   │
│          rerun  → POST /api/research-v2/dispatch with chatRefinement     │
│          patch  → directly upsert section JSONB via Supabase             │
│          converse → streamText() with audit context, no DB mutation      │
│     4. Stream UI message back via toUIMessageStreamResponse()            │
│                                                                          │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RAILWAY WORKER  (research-worker/)                                       │
│                                                                          │
│   POST /run  (existing; preserved)                                       │
│     ↑ accepts chatRefinement: appended to context when present           │
│                                                                          │
│   runJourneySection (existing; tweaked):                                 │
│     - max_tokens: 18000 → 10000                                          │
│     - tighter JSON schema in system prompt                               │
│     - web-search cap to 2 per section (prompt-level)                     │
│     - chatRefinement: prepended to spec.mission if present               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SUPABASE                                                                 │
│   research_runs (existing)                                               │
│   research_job_status (existing — streaming activity rows land here)     │
│   audit_chat_messages (NEW — chat thread per run_id)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5. Components

### 5.1 Speed: parallel section dispatch

**Change**: instead of the user clicking "Run section" 6 times in sequence, the frontend fires all 6 positioning section dispatches concurrently the moment corpus completes.

**Files**:
- `src/app/research-v2/page.tsx` (or wherever the corpus-complete → section-dispatch handler lives) — change handler to map over `POSITIONING_SECTION_IDS` and dispatch all six in parallel
- `src/lib/journey/server/dispatch-research.ts` — confirm idempotency on parallel dispatches with same run_id
- `research-worker/src/index.ts` — confirm the worker can handle 6 concurrent /run requests; add a configurable concurrency cap (default 6) to prevent thundering-herd on Anthropic rate limits

**UX**: the existing 6-section panel shows all sections going from `queued` → `researching` → `complete` in parallel. The activity log surfaces events for whichever section the user is currently viewing.

### 5.2 Speed: token + schema tuning

**Change**: tighten the per-section LLM call to generate less output and a stricter JSON shape.

**Files**:
- `research-worker/src/runners/journey-section-synthesis.ts`:
  - `JOURNEY_SECTION_MAX_TOKENS` constant: 18000 → 10000
  - `SYSTEM_PROMPT` constant: tighten the JSON shape (cap `keyFindings` to 5, `evidenceQuotes` to 4, `sources` to 6); add explicit `"Be concise. Output JSON only. No explanatory prose."`

**Risk**: thinner outputs. Mitigation: A/B test on a single section before applying to all 6.

### 5.3 Speed: web-search cap

**Change**: instruct the model to use web_search at most 2 times per section, only when the corpus genuinely lacks the data point.

**Files**:
- `research-worker/src/runners/journey-section-synthesis.ts`:
  - `SYSTEM_PROMPT`: add `"You may call web_search at most TWICE per section. Use it only when the corpus is missing a specific data point (e.g., a freshness check on a market size figure). Synthesize from the corpus by default. If a data point is missing from both corpus and your search budget, mark it in 'risksOrGaps' and continue."`

**Risk**: model exceeds the cap (instruction-level controls aren't hard limits). Mitigation: monitor in the first few runs; if exceeded routinely, add a hard tool-use counter via `tool_choice: { type: 'auto' }` configuration tweaks.

### 5.4 Edit: chat data model

**New table** `audit_chat_messages`:

```sql
create table audit_chat_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(run_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  intent text check (intent in ('rerun', 'patch', 'converse')), -- assistant rows only
  target_section text, -- assistant rows only when intent in ('rerun','patch')
  created_at timestamptz not null default now()
);

create index idx_audit_chat_messages_run on audit_chat_messages(run_id, created_at);
```

The chat thread is scoped to a `run_id`. Loading the audit page hydrates the chat history. Realtime subscription pushes new assistant messages to the open client.

### 5.5 Edit: chat API endpoint

**New endpoint** `POST /api/research-v2/chat`:

Input (AI SDK v6 useChat-compatible body shape):
```ts
{ runId: string, messages: UIMessage[] }
```

Behavior:
1. Persist the new user message to `audit_chat_messages`.
2. Load audit context: completed sections (titles + statusSummary + keyFindings.title), prior chat messages.
3. Call the **intent router** (see 5.6) with the user message + audit context.
4. Branch on intent:
   - `rerun`: POST internally to `/api/research-v2/dispatch` with `chatRefinement` set; persist an assistant message indicating which section is being rerun; return a streaming text response describing the action ("Rerunning Competitor Landscape with focus on Cartesia…"). The actual section update flows through the existing realtime activity log.
   - `patch`: build a JSON patch from the user instruction (extracted by the router), apply it to the section's stored JSONB via Supabase; persist an assistant message with the patch summary; return a streaming text response with before/after.
   - `converse`: call `streamText` with audit context as a system prompt + chat history; persist assistant message on completion; stream the response back.
5. Use `toUIMessageStreamResponse()` so the frontend's `useChat` + `DefaultChatTransport` renders naturally.

### 5.6 Edit: intent router

**A focused classifier prompt** (Sonnet, low max_tokens, fast):

```
System: You classify user messages in the context of an audit-editing chat. The audit has 6 positioning sections (Market & Category, Buyer ICP, Competitor Landscape, Voice of Customer, Demand & Intent, Offer Diagnostic).

For each user message, output JSON only:
{
  "kind": "rerun" | "patch" | "converse",
  "target_section": "positioningMarketCategory" | ... | null,
  "instruction": "<short string capturing the actionable intent>",
  "patch": { "path": "<dotted field path>", "value": <new value> } | null
}

Rules:
- "rerun": user wants the section regenerated with new context. Keywords: redo, regenerate, focus on, emphasize, broader/narrower, add coverage.
- "patch": user wants a specific value changed. Keywords: change to, replace, is wrong, should be, fix the number.
- "converse": user is asking a question, exploring, no mutation. Keywords: what, why, how, explain, compare.
- When ambiguous, prefer "converse" (safer — no mutation).
- target_section is null for converse unless the message clearly names one.
- patch is null unless kind === 'patch'.
```

This runs on every user message. Sonnet-4-6 with max_tokens 500 keeps it sub-second. Output is parsed; on parse failure, default to `converse`.

### 5.7 Edit: three execution paths

**`rerun`**:
- Internal call to existing dispatch route with `chatRefinement` set
- Worker prepends `chatRefinement` to spec.mission when present:
  ```ts
  const refinedMission = chatRefinement
    ? `${spec.mission}\n\nUSER REFINEMENT: ${chatRefinement}`
    : spec.mission;
  ```
- Section reruns end-to-end (~90-120s after speed work)
- Activity log surfaces the run live, just like a fresh dispatch
- Old artifact is overwritten on completion (no versioning)

**`patch`**:
- Router outputs `{ path: 'keyFindings[0].evidence', value: '$30B (revised)' }` (or similar)
- API route validates the path against the section's current JSONB
- Performs surgical update via `supabase.from('research_runs').update({ data: <patched>}).eq(...)`
- Frontend receives the update via existing realtime subscription
- Returns a streaming text confirmation: "Updated Market & Category Intelligence Specialist → keyFindings[0].evidence to '$30B (revised)'."

**`converse`**:
- AI SDK v6 `streamText` with Sonnet
- System prompt: audit summary (titles + statusSummary for all completed sections)
- User: chat history + latest message
- No DB mutation beyond persisting the user message and the assistant's text reply

## 6. Implementation order (atoms)

| Wave | # | Atom | Model | Budget | Verification |
|---|---|---|---|---|---|
| 1 | 1 | Tighten JOURNEY_SECTION_MAX_TOKENS + JSON schema in journey-section-synthesis.ts SYSTEM_PROMPT | Sonnet | 30m / 20 calls | Run `positioningMarketCategory` against a known fixture; output JSON parses + has all required fields; output is <50% the prior length |
| 1 | 2 | Add web-search cap instruction to SYSTEM_PROMPT | Sonnet | 15m / 10 calls | Run same fixture; activity log shows ≤2 web_search rows |
| 2 | 3 | Frontend: change corpus-complete handler to dispatch all 6 sections concurrently | Sonnet (via `frontend` agent) | 1.5h / 40 calls | E2E run; all 6 sections show `queued` → `researching` → `complete` in parallel; total wall ≈ slowest section |
| 2 | 4 | Worker: add configurable concurrency cap on `/run` (default 6); ensure no rate-limit cascade | Sonnet (via `backend` agent) | 1h / 30 calls | Dispatch 6 concurrent runs; all complete; no 429s in worker logs |
| 3 | 5 | DB migration: `audit_chat_messages` table + index + RLS | Sonnet | 30m / 15 calls | Migration applies cleanly to local Supabase; rollback works |
| 3 | 6 | Backend: `/api/research-v2/chat` route stub (persists messages, returns a streaming echo for now) | Sonnet (via `backend` agent) | 1h / 40 calls | curl test: POST a message, see it in DB + receive a streaming text response |
| 3 | 7 | Frontend: chat sidebar wired to /api/research-v2/chat via useChat + DefaultChatTransport — routes through `/ui-ux-pro-max` first per locked protocol | UI/UX Pro Max → frontend agent → design-review | 2h / 50 calls | Browser test: type a message, see it land in DB, see echo reply stream back |
| 4 | 8 | Intent router classifier (prompt + parse + fallback) | Sonnet | 1h / 30 calls | Vitest: 15-20 fixture messages → router output matches expected kind/target/instruction |
| 5 | 9 | Execution path: `rerun` (internal dispatch + chatRefinement) | Sonnet (via `backend` agent) | 1h / 40 calls | Chat: "redo competitor analysis focused on Cartesia" → section reruns, new artifact replaces, activity log streams |
| 5 | 10 | Execution path: `patch` (JSON path apply via Supabase) | Sonnet (via `backend` agent) | 1.5h / 40 calls | Chat: "market size should be $30B" → patches keyFinding without rerun; realtime pushes updated artifact |
| 5 | 11 | Execution path: `converse` (streamText with audit context) | Sonnet (via `backend` agent) | 1h / 30 calls | Chat: "what's the strongest competitor angle here?" → text reply streams, no artifact change |
| 6 | 12 | E2E live verification: full audit (~3 min) + each of 3 chat actions tested end-to-end | Manual + Sonnet driving | 1h / 30 calls | Wall time targets met; all 3 actions land correctly; no regression on streaming activity log |

**Total: 12 atoms, ~12-13h wall, ~2 days execution.**

### Dependency graph

```
W1: 1 ∥ 2   (speed prompt tweaks; parallel, no deps)
        ↓
W2: 3, 4    (parallel dispatch; 3 = frontend, 4 = worker; parallel)
        ↓
W3: 5 → 6 → 7   (chat infra; sequential — table, route, UI)
        ↓
W4: 8       (intent router; needs route from atom 6 to test against)
        ↓
W5: 9 ∥ 10 ∥ 11   (three execution paths; parallel since they touch different code)
        ↓
W6: 12      (E2E)
```

Frontend protocol: **atom 7 MUST go through `/ui-ux-pro-max` → `frontend` agent → `/design-review`** per the locked workspace CLAUDE.md. Other atoms are backend-only and dispatch via `backend`/`coder` agents directly.

## 7. Testing

**Unit:**
- Intent router fixture set (atom 8): 15-20 user messages with expected kind/target/instruction. Lives at `src/lib/research-v2/__tests__/intent-router.test.ts`. Covers misclassification edge cases (ambiguous wording).
- Patch path validator (atom 10): assert that bad paths don't corrupt JSONB; assert that good paths produce expected result.

**E2E (atom 12):**
- Full audit run: corpus completes, 6 sections dispatch in parallel, all complete within 3 min wall. Activity log streams for the active section.
- Chat `rerun`: type a natural-language refinement; section reruns; new artifact replaces old; activity log surfaces the run.
- Chat `patch`: type a natural-language correction; field updates; no rerun.
- Chat `converse`: ask a question; text reply streams; no artifact change.

**Verification gates per atom 12:**
- Wall time: full audit (corpus + 6 parallel sections) completes in <4 min (target ~3min)
- Per-section: avg <120s, longest <150s
- No regressions: existing streaming activity log shows ⏱ ⏲ 💭 🔍 rows as before
- TypeScript: no new errors in either frontend tsc or worker build

## 8. Rollback / risk

**Speed work (atoms 1-4):**
- All token/prompt changes reversible via revert
- Concurrency cap is a config — set to 1 to revert to sequential behavior
- Frontend parallel dispatch is feature-flagged on a single boolean: `ENABLE_PARALLEL_SECTIONS`

**Edit work (atoms 5-11):**
- New table + new endpoint; entirely additive. Disabling the chat sidebar in the UI hides the feature without removing infrastructure.
- Three execution paths each behind their own feature flag for partial rollback
- If intent router misclassifies frequently, default behavior is `converse` — safest fallback (no mutation)

**Risks called out:**
- Token cap thins output → A/B test first, monitor user feedback
- Intent router misclassifies → fixture tests + bias toward `converse` on ambiguity
- Concurrent dispatch trips Anthropic rate limits → worker concurrency cap, configurable; default 6 (matches section count, conservative)
- Patch path corrupts JSONB → strict path validation + dry-run in test mode before commit
- Edit-via-rerun produces worse artifact than original → no versioning v1, so genuinely a risk; explicit "we'll add versioning in v2" decision

## 9. Open questions (resolve during 03-build if not before)

1. **Realtime delivery of patches**: the existing `research_job_status` realtime subscription is keyed by `run_id` and surfaces `updates[]`. Does a JSONB patch on `research_runs.data` trigger the same realtime channel, or do we need to also write a synthetic activity row to surface the patch in the timeline?
2. **Race condition**: user dispatches a rerun, then dispatches another rerun on the same section before the first completes. Should the second cancel the first, queue behind it, or be rejected?
3. **Chat history truncation**: with potentially long-running audits and active conversations, when does old chat history get trimmed for context window? First-pass: include only the last 10 messages + a summary of older messages.
4. **Intent classifier model**: Sonnet-4-6 is the default; consider Haiku-4-5 for cost/speed if classification is reliable enough. Decide after atom 8's fixture testing.
5. **Patch path safety**: should patch path application be Anthropic-mediated (a small LLM call that produces a JSON Patch RFC 6902 operation) or directly parsed by us from the router output? First-pass: router outputs structured `{ path, value }`; we apply directly. If misclassification is high, add a verification step.

## 10. Reference URLs

- [AI SDK v6 useChat](https://ai-sdk.dev/docs/ai-sdk-ui/chat)
- [AI SDK v6 streamText + toUIMessageStreamResponse](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [Anthropic Messages Streaming](https://platform.claude.com/docs/en/api/messages-streaming)
- [JSON Patch RFC 6902](https://www.rfc-editor.org/rfc/rfc6902) (for future hardening of atom 10)
- Prior streaming-activity-log discover note: `.claude/workspaces/aigos-feature-dev/stages/01-discover/notes/streaming-activity-log.md`
- Prior shipped commits: `6038a367`, `cd28348b`, `9895f7e5`, `1bf5c91b`

## 11. Handoff to writing-plans

When this spec is approved by the user, the next step is the **superpowers:writing-plans skill** to produce a per-atom implementation plan. The atom table in section 6 is the input. The plan should:
- Expand each atom into a focused execution prompt with files/lines
- Confirm budget per atom
- Define explicit verification gates per atom
- Note dependencies that prevent parallel dispatch

Do NOT invoke `frontend-design`, `mcp-builder`, or any other implementation skill from this spec. The only valid skill transition is to `writing-plans`.

---

**Spec self-review checklist (run on first save):**
- [ ] No "TBD" or "TODO" left
- [ ] Section 6 atoms each have explicit file paths or surfaces
- [ ] Section 6 atoms each have a verification gate
- [ ] Frontend protocol from workspace CLAUDE.md is honored (atom 7 routes through ui-ux-pro-max)
- [ ] No contradiction between architecture (section 4) and implementation order (section 6)
- [ ] Scope (section 3 non-goals) is explicit
- [ ] Risks (section 8) cover the load-bearing failure modes
