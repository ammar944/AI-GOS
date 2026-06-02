# Codex Handoff — Verifier Teeth + sourceUrl Enforcement (lab engine)

> **Author:** Claude (HQ) · **Executor:** Codex (`-c model_reasoning_effort=xhigh`)
> **Date:** 2026-05-29 · **Branch base:** `feat/v2-lab-section-wire` == `origin/main` @ `25618cf8` (system of record)
> **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
> **Origin:** State-of-the-app audit `docs/2026-05-29-state-of-the-app-assessment.md`, recommendation #2 (highest-integrity risk).

---

## ⚠️ TWO DECISIONS TO CONFIRM BEFORE DISPATCH

Both have a baked-in recommendation; override before this runs if you disagree.

1. **No hard-fail in v1 (recommended).** When unsupported load-bearing claims survive the repair budget, the section **still commits** with the honest `Verified X / Unsupported Y` badge — it does **not** throw/fail. Rationale: the verifier is heuristic (text-inclusion → real false-positive rate), and `CLAUDE.md` says *"do not hard schema-force the deep research section cards yet."* A terminal gate is premature until we measure live repair-success + verifier precision. Hard-fail threshold = **deferred follow-up**, not this spec.
2. **Load-bearing = `numeric` + `url` only in v1 (recommended).** These are the fabrication-prone, low-false-positive claim kinds (prices, %, magnitudes, source URLs). `quote` and `entityName` are **counted in the badge but not gated** in v1 (paraphrase/alias false-positives). Override if you want quotes gated too.

---

## GOAL

The structural verifier already detects ungrounded claims — it just has no consequences. Wire its existing output into the existing repair loop so that **load-bearing claims the verifier marks `unsupported` force a repair pass** (ground the claim in a real fetched source, or remove/soften it to a stated data-gap). After the existing repair budget is spent, **commit the best-effort artifact** (the one with the fewest unsupported load-bearing claims) with the honest verification badge.

Success criterion (the bug we are closing): today `synthetic-fabricated-price.json` commits a `$99/mo` price that contradicts its own tool result (`$49/mo`) with zero consequence. After this change, that artifact must (a) trigger a repair attempt that names the bad claim, and (b) if still unsupported after repairs, commit with `unsupportedCount ≥ 1` surfaced — never silently.

## CONTEXT — what already exists (do NOT rebuild)

- **sourceUrl cross-binding already works.** `extractClaims` (`src/lib/lab-engine/agents/verification/claim-extractor.ts:95-133`) extracts every `sourceUrl`/URL as a `url` claim and every price/%/magnitude as a `numeric` claim. `structuralVerifier` (`.../verification/structural-verifier.ts:206-245`) matches each claim against the **actual captured tool-result + corpus URLs/text** and returns `{ verifiedCount, unsupportedCount, claims[] }` where each unsupported claim is `{ status:"unsupported", claim, reason }`. **This detection is correct and complete. Do not modify the verifier's matching logic.**
- **The only gates today** are `validateMinimums` (cardinality) and `checkRequiredEvidenceClasses` (`src/lib/lab-engine/sections/required-evidence.ts:206`). The latter is class-*presence* only and is satisfiable by one self-declared `dataGap` anywhere via `hasNestedGap` (lines 64-88). `unsupportedCount` is computed, embedded in the artifact envelope, shown in the badge (`src/components/research-v2/audit-reader-shell.tsx:390`) — and **never acted on.**
- **The repair loop already exists.** Live path for ALL 6 sections: `lab-section-job.ts` → `runSection` (`run-section.ts:3656`) → `runSectionViaAnswerTool` (`run-section.ts:2666`). Its attempt-builder `buildAnswerToolAttempt` (~`2596-2664`) runs `structuralVerifier` → `buildEnvelope` → `validateMinimums` → `checkRequiredEvidenceClasses` and returns `{ output, artifact, errors, requiredEvidenceMissing? }`. The repair while-loop (`2834-2941`) re-prompts via `buildRepairPrompt({ issues: attempt.errors, ... })` up to `answerToolMaxRepairAttempts = 2` (line 634), then on residual `artifact === null` calls `recordSectionFailure` and **throws**.
- **The threading pattern to mirror:** `requiredEvidenceMissing` is already plumbed Attempt→loop→terminal. Mirror it for the new `evidenceSupportShortfall`, but with **non-terminal, commit-with-badge** terminal semantics (the key difference).

## NON-GOALS (do not touch)

- **Do NOT** make unsupported claims set `artifact = null` or throw `SectionRunnerError`. Residual unsupported = commit with badge (see Decision #1).
- **Do NOT** touch `structuralVerifier`/`claim-extractor` matching, or `checkRequiredEvidenceClasses` / the `hasNestedGap` dataGap escape (separate, deferred decision).
- **Do NOT** touch the dead `streamRunSection` (`run-section.ts:3282`) or the structured-output attempt-builders (`callStructuredAttempt` ~2280, `callStructuredStreamAttempt` ~2439) — **all 6 sections are in `answerToolSectionIds` (lines 637-644)**, so those paths are not live. (Optional, only if trivial: apply the same shared helper there for consistency — but it is NOT required and must not expand scope.)
- **Do NOT** gate `quote`/`entityName` claims (Decision #2). Count them in the badge only.
- **Do NOT** add model calls beyond the existing `answerToolMaxRepairAttempts` budget (cost discipline: DeepSeek + the no-API-loop rule). Evidence-support issues ride the existing repair trigger.
- **Do NOT** change the badge UI, schemas, providers, or the media-plan `fabrication-sweep` (`research-worker/`).
- **Do NOT** alter the expected numbers in the 15-fixture eval (`verifier.eval.test.ts`) — the new helper is additive.

## FILES

| File | Change |
|---|---|
| `src/lib/lab-engine/agents/verification/evidence-support.ts` | **NEW.** `evaluateEvidenceSupport({ verification, loadBearingKinds })` → `{ unsupportedLoadBearing: UnsupportedClaim[], issues: string[] }`. Pulls `verification.claims` where `status==="unsupported"` and `claim.kind ∈ {numeric, url}`. Each `issue` is actionable: `` `numeric claim "$99/mo" is not supported by any fetched source or corpus excerpt — cite a real source for it or remove it / restate it as a data gap.` `` |
| `src/lib/lab-engine/agents/verification/__tests__/evidence-support.test.ts` | **NEW.** Unit-test the helper against the existing fixtures (`synthetic-fabricated-price.json`, `synthetic-fabricated-quote.json`, a clean fixture e.g. `ramp-market-category.json`). Assert fabricated price → 1 numeric unsupported; clean → 0. |
| `src/lib/lab-engine/agents/run-section.ts` | Add `evidenceSupportShortfall?` to the `AttemptResult` type (mirror `requiredEvidenceMissing`). In `buildAnswerToolAttempt` (~2620-2660): after `checkRequiredEvidenceClasses` passes, call `evaluateEvidenceSupport`; attach `evidenceSupportShortfall` when non-empty **but keep `artifact` non-null**. Update the `runSectionViaAnswerTool` repair loop (2834-2941): see STEPS 4. |
| `<buildRepairPrompt module>` (imported `run-section.ts:35-36`) | Extend so the unsupported-claim `issues` are rendered into the repair instructions (append to existing issues; don't restructure the prompt). |
| `src/lib/lab-engine/agents/__tests__/run-section-*.test.ts` (extend; match existing harness in `run-section-corpus-only.test.ts` / answer-tool tests) | Integration test: (a) artifact with an unsupported numeric claim → a repair attempt fires; (b) repair that grounds it → committed `unsupportedCount` drops; (c) repair that fails → section **still commits** (no throw), badge shows the residual unsupported count. |

## STEPS (each independently verifiable; commit atomically)

1. **Helper + unit test.** Create `evidence-support.ts` + test. → `npm run test:run -- src/lib/lab-engine/agents/verification/__tests__/evidence-support` green; fabricated-price → 1 numeric unsupported, fabricated sourceUrl → 1 url unsupported, clean fixture → 0.
2. **Thread the type.** Add `evidenceSupportShortfall?: { unsupportedLoadBearing; issues }` to `AttemptResult`; compute + attach in `buildAnswerToolAttempt` (artifact stays non-null). → `npx tsc --noEmit` 0; existing answer-tool tests still pass.
3. **Repair prompt.** Extend `buildRepairPrompt` to render the unsupported-claim issues. → prompt-builder unit test asserts the issue text appears.
4. **Repair loop + terminal.** In `runSectionViaAnswerTool`:
   - Loop while `(attempt.artifact === null || attempt.evidenceSupportShortfall) && repairAttempt < answerToolMaxRepairAttempts`.
   - Pass `attempt.evidenceSupportShortfall.issues` into `buildRepairPrompt` alongside `attempt.errors`.
   - Keep a **best-so-far** committable artifact = the attempt with the fewest load-bearing unsupported claims (so a repair can never regress what already committed-quality).
   - On loop exit: if a committable artifact exists (`artifact !== null`), **COMMIT it** (existing `saveArtifact` + committed events) even if `evidenceSupportShortfall` remains. Only the existing `artifact === null` branch (minimums/required-class failure) keeps the current `recordSectionFailure` + throw.
   - Emit honesty signal: on an evidence-driven repair, emit the existing `repair-started` event with `metadata.reason = "grounding N unsupported claim(s)"`; include the claims in the `validation-failed` `metadata.issues`. (Adding a dedicated `evidence-repair` event type is optional, only if it drops in cleanly via the existing event union.)
   → integration test (4-c) green: residual-unsupported commits, no throw.
5. **Full gates on the SOR.** → all green (see VERIFY); the 15-fixture eval unchanged.

## CONSTRAINTS

- Reuse the existing repair budget; **no extra model passes.**
- Match existing style: named exports, kebab-case files, the `appendEvent`/`createEvent` patterns, the `requiredEvidenceMissing` threading shape.
- Keep `verifier.eval.test.ts` (15 fixtures) assertions intact — additive only.
- Surgical: one live path. No drive-by refactors.

## VERIFY (run from the worktree; paste real output in the PR)

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
npx tsc --noEmit                                                   # expect 0 errors
npm run lint                                                       # expect 0 errors (64 baseline warnings OK)
npm run test:run -- src/lib/lab-engine/agents/verification        # helper + 15-fixture eval green
npm run test:run -- src/lib/lab-engine/agents                     # run-section + answer-tool incl. new integration tests
npm run test:run                                                   # full suite: 1118+ pass, 0 fail
```

Manual proof: drive a body containing a `numeric` claim absent from `toolResults` through the run-section answer-tool test harness; assert (1) a `repair-started` event with the grounding reason fires, (2) the final committed artifact's `verification.unsupportedCount` reflects reality, (3) no exception thrown.

## DONE WHEN

All VERIFY commands pass with pasted output; the fabricated-price scenario triggers repair and commits-with-badge (never silently, never thrown); worker untouched; diff traces only to this spec.
