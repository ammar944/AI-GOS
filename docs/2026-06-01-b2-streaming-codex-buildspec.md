# Codex Build-Spec — B2 gate-safe artifact streaming (T3, Option B) — GREENLIT

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Base commit:** `5395cf9b` (QA-clean — see below). **Companion:** `docs/2026-06-01-next-tasks-codex-handoff.md` (§2 ground-truth, §T3). This doc supersedes the open design questions in that §T3 with firm decisions.

## Status going in
- **Base `5395cf9b` passed adversarial QA** (T1 per-zone events, T2 telemetry guard, T4 ad-probe concurrency): clean, gate byte-unchanged, no streaming code present. Build on it.
- **Linchpin resolved:** the probe confirmed the configured provider (DeepSeek) emits **incremental** `partialOutputStream` partials. No `simulateStreamingMiddleware` needed. Token-streaming is feasible — proceed.
- **User decision:** Option B (course-exact `streamText` + `Output.object` + `partialOutputStream`), gate re-wired onto `await result.output`. Follow-active-section stays **off** — don't add it.

## GOAL
The 6 positioning sections stream their artifact into the reader as it's written, while the fabrication/provenance gate runs **exactly once on the complete, validated body** before commit. Streaming is a cosmetic overlay; the commit path and the gate are unchanged in behavior.

## NON-GOALS
- Don't weaken or move the gate. Don't gate on partials.
- Don't persist partials to the DB. Don't route partials through `buildSectionActivityFeed`/the allowlist.
- Don't touch the committed-card typed renderers' output. Don't remove the 2.5s poll (it stays the source of truth for terminal/committed state).
- Don't revive `streamSectionViaAnswerTool` wholesale (it accumulates only `textStream`, empty for structured output). Use the `Output.object`/`partialOutputStream` machinery.

---

## Firm design decisions (these replace the open questions in the prior handoff)

**Transport = Supabase Realtime BROADCAST (ephemeral), not postgres_changes.** Rationale: no DB write-amplification, no allowlist entanglement, no Clerk→Supabase RLS-JWT dependency on the browser client. Partials are throw-away overlay; the poll remains the durable source of truth.

**Server send mechanism = REST broadcast endpoint** (works from the in-process serverless function without a websocket): `POST ${NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast` with headers `apikey` + `Authorization: Bearer <service-role key>`, body `{ messages: [{ topic, event, payload }] }`. **Verify this works first** (Codex: a quick curl or a 1-shot send + browser subscribe confirms it). If it's blocked in this project, fall back to `postgres_changes` on `research_section_events` with a dedicated `artifact-partial` event type that BYPASSES the allowlist and is throttled — but try broadcast first.

**Channel topic:** `section-partials:<runId>` (runId is an unguessable UUID — acceptable privacy for ephemeral in-progress draft content). **Event:** `partial`. **Payload:** `{ zone, sectionId, seq, snapshot }` where `snapshot` is the latest best-effort-parsed partial body (last-write-wins per zone; `seq` increments so the client drops stale frames).

**Throttle:** emit at most one frame per **~600ms** per section (or on a new top-level body key appearing), never per-token. Keeps well under the 256KB Realtime message cap and avoids channel spam. There is no throttling anywhere today — you're adding it.

**Reader surface:** the partial-tolerant `GenericTypedArtifactRenderer` only. The 8 typed renderers crash on incomplete JSON.

---

## Build steps

### 1. Server — produce the 6 sections via `streamText` + `Output.object`
File: `src/lib/lab-engine/agents/run-section.ts`, `src/lib/lab-engine/agents/section-agent.ts`.
- Route the `answerToolSectionIds` (the 6) through a structured-stream attempt instead of `agent.generate()` + the `answer` tool. Reuse the existing machinery: `streamStructuredResult`/`defaultStructuredStreamer` (`section-agent.ts:1189-1365`, `Output.object` at :1198) and `consumePartialsUntilAbort` (`run-section.ts:2711`).
- The `Output.object` schema = the section's **strict body schema** (`definition.bodySchema`) so `await result.output` is schema-validated.
- **Keep the research tools** (search / ad-library / keyword) in the same `streamText` call — `Output.object` coexists with tools (`stopWhen: stepCountIs(N)`). The ad-evidence prepass (T4) still feeds the prompt as today.
- Pass `abortSignal`. Call `result.consumeStream()` **without await** so the gate + commit finish if the browser disconnects. Handle `onAbort` to clear partials.

### 2. Gate — unchanged semantics, new input surface
- Run the existing `buildAnswerToolAttempt` gate chain (`run-section.ts:2940-3026`) on **`(await result.output).body`**: `structuralVerifier` → `validateMinimums` → `checkRequiredEvidenceClasses` → VoC self-source → DemandIntent keyword provenance → `evaluateEvidenceSupport`. Keep `deriveGroundedConfidence`, the **≤2 repair loop**, `getBestCommittableAttempt`, and the `LAB_VERIFIER_MAX_UNSUPPORTED` ceiling.
- Preserve as much repair signal as possible from `TypeValidationError` (Option B's coarser feedback vs the `answer` tool's `__answerRejected` — accepted tradeoff).
- Commit (saveArtifact + `artifact-saved` + `sub-section-committed` + `section-completed`) only after the gate passes. **Never run gate logic on a partial.**

### 3. Transport — throttled broadcast
- New module `src/lib/research-v2/realtime-broadcast.ts`: `broadcastSectionPartial({ runId, zone, sectionId, seq, snapshot })` → REST broadcast POST (above). Service-role key server-side only.
- In the partial consumer (step 1), throttle to ~600ms and call the broadcaster with the current snapshot. Do NOT INSERT into `research_section_events`.

### 4. Client — subscribe + reader drafting view
- New hook `src/lib/research-v2/use-section-partials.ts`: `supabase.channel('section-partials:'+runId).on('broadcast', { event: 'partial' }, cb).subscribe()`, accumulate latest snapshot **per zone** (drop frames with a lower `seq`). This is the FIRST realtime subscription in `src` — there are none today.
- `src/components/research-v2/audit-reader-shell.tsx`: in the `activeStatus === 'running'` branch (~:1543), if a partial snapshot exists for the active zone, render it through `GenericTypedArtifactRenderer` wrapped in a "Drafting…" affordance, in place of / above `LiveActivity`. **Synthesize placeholder envelope fields** (sectionTitle from the section definition; verdict/statusSummary as "Drafting…") — do NOT reuse `pickPositioningTypedArtifact` (its guard requires verdict+statusSummary+confidence+sectionTitle).
- **NEVER** write partials into `sectionsByZone`/`typedByZone` (truthiness there flips the section to the committed-card path and corrupts the gate — `audit-reader-shell.tsx:1161`). On `status → complete` (poll), clear the partial and show the committed typed card.
- **Add an error boundary** around the committed-card branch (the typed renderers do unguarded deep dereferences and white-screen on any malformed body, not just partials).

### 5. Reconciliation
- The repair loop can replace the artifact mid-stream. The UI must **replace** (last-write-wins by `seq`), never append. The poll remains authoritative for terminal/committed state and reconciles if the channel drops.

---

## VERIFY

**Unit (`npm run test:run`, tsc 0, lint 0):**
- Gate runs on `result.output`, never on partials; repair loop fires on evidence shortfall.
- Throttle coalesces (≤1 frame/~600ms); broadcaster called with correct `topic`/`event`/payload shape.
- Client hook keeps latest-per-zone and drops stale `seq`.
- Reader drafting branch renders `GenericTypedArtifactRenderer` on a partial and **never** writes `sectionsByZone`; committed path unchanged; error boundary catches a malformed body.

**Browser (leverage your connected browser — this is where streaming is actually provable):**
- `npm run dev`, log in (Clerk `ammarv67@gmail.com`, ask the user for the code), `/research-v2`.
- Run a flow; watch **ONE** section: the drafting view fills progressively, then the committed typed card replaces it. **No white-screen** on partial JSON.
- Confirm the gate still ran: the committed artifact carries `verification`; repair count is sane (Supabase MCP → `research_section_runs.telemetry`).
- Confirm **no write-amplification**: `research_section_events` is NOT flooded with partial rows.
- Don't edit source while the run is live. Full end-to-end proof is the consolidated ~$2 run (T6) — don't burn extra paid runs here; one section is enough to prove streaming.

## RISKS
- Broadcast send from serverless — verify the REST endpoint up front; fallback noted above.
- Repair replacing the artifact mid-stream — handled by last-write-wins `seq` + poll reconciliation.

## Constraints (unchanged)
No `.env` reads. Paid APIs never loop. Commit atomically, **don't push/deploy**. The T1 index migration is still **not applied** — user-gated. Worker baseline captured separately if you touch `research-worker/`.
