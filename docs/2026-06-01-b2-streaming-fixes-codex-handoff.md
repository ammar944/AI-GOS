# Codex Fix Handoff — B2 streaming QA findings (f2764f7b)

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Base:** `f2764f7b` (B2 streaming). Adversarial QA (7-agent) verdict: **gate fully preserved, service-role key provably server-only, scope clean** — but two confirmed **P2s block the sign-off run**, plus P3 cleanup. Fix these, then HQ re-QAs and we run the consolidated live sign-off.

> Anchors are as of `f2764f7b`; re-grep the named symbol before trusting a line number.

## What QA confirmed GOOD (don't touch)
- Gate runs exactly once on `(await result.output).body` via the shared `buildVerifiedAttemptFromOutput`; partials reach only the broadcaster, never the gate or commit. Repair loop / `getBestCommittableAttempt` / `LAB_VERIFIER_MAX_UNSUPPORTED` reused verbatim.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (sole reader `realtime-broadcast.ts`, reached only through Node-bound server code; no `'use client'` importer; client hook uses the anon key). **Keep it that way.**
- Broadcast is fail-safe (errors swallowed by `onError`, never abort the run). No partial rows written to `research_section_events`.
- The committed-card error boundary is a real `componentDidCatch`. Partials can't render as committed cards. **One QA finding was REFUTED:** the `channel.unsubscribe()` cleanup does close the socket — NOT a leak. Don't "fix" it (optional `removeChannel` hygiene only, see Notes).

---

## P2 — must fix (blocks sign-off)

### FIX-1: Committed verdict & statusSummary are synthesized from truncated prose
**Problem:** the streamed `Output.object` schema is `definition.bodySchema` (body only — `run-section.ts:3371`), and the body-only prompt forbids the model from emitting verdict/statusSummary. So `buildSyntheticSectionOutput` (`run-section.ts:1198-1219`) sets **both** committed `verdict` AND `statusSummary` to the **same first-prose block sliced to 500 chars**. These render prominently in the reader (VerdictCard + statusSummary). The answer-tool path had the model author two distinct, purpose-built fields → this is a real quality regression on the committed artifact.

**Fix (preferred — Option C, no extra model call): widen the streamed schema so the model authors verdict + statusSummary in-stream.**
- Change the structured-body stream schema from `definition.bodySchema` to `z.object({ verdict: z.string().describe(...), statusSummary: z.string().describe(...), body: definition.bodySchema })` (confidence + sources stay derived as today; `deriveGroundedConfidence` still overrides confidence). Use `.describe()` only — no `.min()/.max()` (Anthropic structured-output rule).
- Update the prompt builder (`buildStructuredBodyPrompt` / the body-only shape guidance) to **require** the model to author `verdict` and `statusSummary` again (remove the "do not include verdict/statusSummary" instruction).
- In `buildOutputFromStructuredBody` (`run-section.ts:3260`), read `verdict`/`statusSummary` from the validated `result.output` instead of `buildSyntheticSectionOutput`. Keep the synthetic value ONLY as a fallback when the model omits a field (don't truncate to 500 unless genuinely needed).
- The gate still runs on `.body` (unchanged). Bonus: verdict/statusSummary now stream as partials too — the drafting view gets a real verdict filling in.
- If widening the schema proves unreliable on the provider, fall back to Option A: after the body validates, make one tiny non-streamed structured call for `{verdict, statusSummary}` given the final body. Report which you used.

**Verify:** a committed section's `verdict` ≠ `statusSummary` and both read as authored text, not a truncated prose dump. Unit test asserts verdict/statusSummary come from model output, not `slice(0,500)` of the first prose.

### FIX-2: `seq` resets to 1 each repair attempt → client drops all repair-attempt partials
**Problem:** each attempt builds a fresh broadcaster (`run-section.ts:3334`, inside `buildStructuredBodyAttempt`) and `createThrottledSectionPartialBroadcaster` starts `let seq = 0` (`section-partial-broadcaster.ts:57`). The client's stale-seq guard (`use-section-partials.ts` `applySectionPartialPayload`: drop when `existing.seq >= payload.seq`) then **silently drops every partial from repair attempt ≥2** — repaired sections never stream (and repairs are common). Self-heals only at poll-commit.

**Fix:** make `seq` monotonic across attempts for a `(runId, sectionId)`. Hoist the counter to `runSectionViaStructuredBodyStream` scope (it owns the repair loop, `run-section.ts:3904`/`4042`/`4135`) and pass a shared mutable `seqRef` (or `startSeq`) into `createThrottledSectionPartialBroadcaster` so attempt N+1 continues from where N ended. Add the param to the broadcaster factory (default `0` preserves current single-attempt behavior).

**Verify:** unit test — two sequential attempts' broadcasters emit strictly increasing seq (attempt 2 starts > attempt 1's last); the client applies attempt-2 partials instead of dropping them.

---

## P3 — recommended (same pass; not sign-off-blocking)

- **FIX-3 — explicit path selection (and don't leave a dead twin).** Production flips to streaming via `deps.runAnswerTool === undefined` (`run-section.ts:4974-4979`) — an indirect selector; any future caller injecting `runAnswerTool` silently reverts all 6 sections. Make it an **explicit** selector (env flag e.g. `LAB_SECTION_STREAMING`, default on, or an explicit `deps.runMode`). **Keep `runSectionViaAnswerTool` as an explicit, documented fallback for now** (it's the safety net until the sign-off proves streaming) — add a comment marking it so; HQ will schedule its deletion (+ its tests) post-sign-off. This also addresses the ~440-line dead-twin that drove most of the +1009 diff.
- **FIX-4 — observability on the double model call.** On non-abort parse failure the stream path falls back to a full non-streaming `generateText` with tools (`section-agent.ts:1357-1365`) → up to 2 billed calls/attempt × 2 repairs. At minimum, emit a log/telemetry marker when the fallback fires so the cost isn't silent. (Gate unaffected — cost/latency only.)
- **FIX-5 — wrap the drafting view in the error boundary** (`audit-reader-shell.tsx:~1654`) for symmetry with the committed branch. Cheap; the generic renderer is tolerant but a malformed partial shouldn't white-screen.
- **FIX-6 — add a `useSectionPartials` hook test** (subscribe → validate payload with the zod schema → latest-per-zone → stale-seq drop → cleanup). It currently has no direct coverage.

## Notes (non-blocking, no action needed unless you want)
- Broadcast channel is unauthenticated — anyone with the runId UUID could read in-progress draft content. UUID is unguessable + the content is ephemeral draft, so acceptable for now; flag for the user if they want private channels later.
- No hard size guard on the snapshot (relies on the token ceiling staying < the 256KB Realtime cap). Fine at current section sizes.
- The refuted "channel leak" — optional only: `return () => { void supabase.removeChannel(channel); }` closes the throwaway socket promptly vs waiting on the leave round-trip. Not required.

## VERIFY (before declaring done)
- `npm run test:run` green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, `npm run build` pass.
- New/updated unit tests cover FIX-1 (authored verdict≠statusSummary) and FIX-2 (monotonic seq across attempts).
- No change to the gate decision logic or the service-role-key boundary.
- Report: which FIX-1 option you used, files changed, test output. **One atomic commit.** No push/deploy. Don't apply the T1 migration.
