# Codex Fix Handoff — E2E sign-off failures (run 403002a8)

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Base HEAD:** `9d291734` · **Failing run:** `run_id=403002a8-57ee-47f1-bfe4-b1c9b97b1680`, parent artifact `d8aabb0b-9391-4e7c-8c41-71e2e9071f7b`

A diagnostic pass root-caused the sign-off FAILs against the live DB + code. B1 and B2 PASSED. Four fixes below. Anchors are as of `9d291734` — re-grep the named symbol before trusting a line number. Constraints unchanged: no `.env` reads, no paid-API loops, **one atomic-ish commit (or a few logical commits), NO push/deploy, do NOT apply any migration** (author migration files if needed; HQ/user applies).

---

## FIX-1 (P0) — Restore the model-authored `sources` channel dropped by the B2 streaming switch
**This is a regression introduced by the B2 path switch (f2764f7b).** The legacy answer-tool path used `definition.sectionOutputSchema`, which includes a top-level `sources: z.array(modelSourceSchema)` the model authors directly — an independent source channel the `>=5` gate counts. The new streaming draft schema `buildStructuredSectionDraftSchema` = `z.object({verdict, statusSummary, body}).strict()` (`run-section.ts:~772-793`) **omits `sources`**, so the committed `sources` are harvested ONLY from inline `body.sourceUrl` fields via `collectModelSourcesFromBody` (`run-section.ts:~1194-1236`). DB proof: every committed section's `source_count` ≈ `count(distinct $.**.sourceUrl)`. When VoiceOfCustomer clustered its 10+ pain quotes onto 2-3 domains, it yielded only 3 distinct URLs → hard-failed `voice-of-customer.ts:164` (`sources >= 5`) → never committed.

**Fix:**
1. Add `sources` back to the draft schema: `buildStructuredSectionDraftSchema` → `z.object({ verdict, statusSummary, sources: z.array(<model source shape>), body: definition.bodySchema }).strict()`. Use the same model-source shape the section's `sectionOutputSchema` uses (the per-section `modelSourceSchema`, e.g. `voice-of-customer.ts:117`, `offer-diagnostic.ts:89` — reuse/share, don't invent a new shape). Keep `.strict()` (it stays load-bearing). Guide the `>=5` target via `.describe()` + the prompt; avoid numeric `.min/.max` (array `.min(1)` is acceptable, matching the legacy schema, but the gate enforces the count post-hoc).
2. Update the streaming prompt (`build-prompts.ts`, `buildStructuredDraftShapeGuidance` / the structured-body prompt + Validator checklist) to require the model to author **≥5 distinct cited source URLs** in the `sources` array, exactly as the legacy `sectionOutputSchema` flow did. For VoC, reinforce **distinct domains** (don't cluster) and the existing **no-self-sourcing** rule.
3. In `buildOutputFromStructuredBody` (`run-section.ts:~3336-3349`) seed `existingSources` from the authored `sources` (it already reads `normalizedOutputRecord.sources`) and merge BEFORE the body harvest, so the gate counts the authored channel.

**Test compat (REQUIRED):** `run-section-artifact-streaming.test.ts` asserts the draft schema's shape:
- `:131` `safeParse(buildMarketCategoryDraft()).success === true` → **update the `buildMarketCategoryDraft()` helper (`:60`) to include a valid `sources` array** (≥1 model source), or this breaks.
- `:135` `safeParse(buildMarketCategoryOutput()).success === false` → still passes: the full SectionOutput has extra `sectionTitle`+`confidence` keys that `.strict()` rejects. Confirm it stays red.

**Verify:** a VoC-shaped fixture with 5 authored distinct sources but body quotes on 2 domains now passes the `>=5` gate. Add/extend a unit test.

---

## FIX-2 (P0) — Competitor seed splitting destroys real brand names (B3 root cause)
`buildCompetitorSeeds` (`corpus-to-research-input.ts:678`) splits `rawTopCompetitors` on `/[,\n;]+/`. The AI-filled `topCompetitors` field is a numbered list with rich descriptions: `"1. Brex (acquired by Capital One, closed Apr 7, 2026 — $5.15B deal; ...); 2. BILL ...; 3. Amex ..."`. Splitting on the commas/semicolons **inside the parenthetical** explodes one competitor into garbage fragments (`"Brex (acquired by Capital One"`, `"closed Apr 7"`, `"— $5.15B deal"`). Those become the 3 advertiser "groups" → the ad probe finds no real advertiser → **0 creatives (B3 fail)**, and the bogus identities feed B4's hallucinated-URL repairs.

**Fix (in `buildCompetitorSeeds` + `cleanAdvertiserQuery`, both pure functions with tests):**
1. Split top-level entries on **list delimiters only**: the numbered/bulleted enumerator (`/(?:^|\s)\d+[.)]\s+/`, bullets) and newlines — since this field is reliably numbered. Fall back to comma-split ONLY when no enumerator is present.
2. Per entry, **strip everything from the first `(`** (parenthetical descriptors) before other cleaning, so an unclosed/long paren can't survive.
3. Harden `cleanAdvertiserQuery` (`advertiser-match.ts`) to drop a trailing unmatched `(` and reject tokens that aren't plausibly a brand (start with a digit, currency symbol, or em-dash).
4. Strip the leading enumerator (`"1. "`) from each name.

**Tests:** update `corpus-to-research-input.test.ts` + `advertiser-match.test.ts` — add the Brex-style numbered+parenthetical fixture and assert it yields `["Brex", "BILL", "American Express"]` (or equivalent clean brands), not fragments. **Behavioral creative yield needs the live re-run to confirm** (don't claim B3 fixed from unit tests alone).

---

## FIX-3 (P0) — Clear `error` on successful commit (T2 contradiction)
OfferDiagnostic actually succeeded (committed 7 sources, revision 1) but `research_section_runs.error` still holds the stale `"sources: have 3, need >=5."` from an earlier failed attempt: `markSectionFailed` (`supabase-run-store.ts:~574-588`) wrote the error JSONB, and the later successful `saveArtifact` (`~424-528`, telemetry update `~477-491`) updated status/telemetry/body but **never nulled `error`**. So `status=complete` rides with a non-null error → UI/telemetry contradiction.

**Fix:** on a successful commit, clear `research_section_runs.error`.
- **Prefer the no-migration path:** add `error: null` to the commit's `research_section_runs` update in `saveArtifact` (there are already `error: null` writes at `:524`/`:567` — confirm which path the streaming commit takes and ensure it nulls error). 
- If the status write goes through the `commit_artifact_section` RPC instead, author a migration that sets `error = CASE WHEN status='error' THEN <error> ELSE NULL END` in both the insert-new-row and revision-supersede blocks. **Author the migration file only — do NOT apply it** (user-gated). Note in the handoff-back which path you took.

**Verify:** unit test — a section whose early attempt failed but later commits ends with `status=complete` AND `error=null`. (VoC `status=error` is the CORRECT honest terminal state of a genuine failure — do NOT suppress it.)

---

## FIX-4 (P1) — Cut B4's residual repair storm (CompetitorLandscape 169s / 4 repairs)
Repairs are driven by `evaluateEvidenceSupport` (`evidence-support.ts:25,55`, loadBearingKinds `["numeric","url"]`) via `buildVerifiedAttemptFromOutput` (`run-section.ts:~3196-3210`), looped in the structured-body runner (`~4128-4228`, max 2 attempts). The model cited competitor homepage/pricing URLs (`bill.com/spend-expense`, `concur.com`, `navan.com/pricing`, …) and numerics (`$5.15B`, `$18`) it **never fetched**, so they're flagged unsupported → repair each round. It commits anyway (advisory gate, `LAB_VERIFIER_MAX_UNSUPPORTED=Infinity`) — so B4 is latency/quality, not a hard fail.

**Fix (do the cheap part now; FIX-2 already cuts the garbage-identity contribution):**
1. **Prompt-harden (cheap):** in the CompetitorLandscape structured-body prompt, instruct the model to cite ONLY URLs/numerics present in the fetched evidence transcript/corpus; if it lacks a source for a claim, mark it a gap rather than asserting an unfetched URL.
2. **Grounding (only if it fits the budget — flag if risky):** seed the evidence transcript with the resolved competitor official URLs (from `competitorSeeds`/onboarding `topCompetitors`, now clean after FIX-2) + at most one fetch per competitor pricing page, staying within `definition.maxExternalLookups`/`adReservedLookups` so it doesn't starve the ad probe. If this risks the lookup budget, **do the prompt part only and flag the grounding fetch as a follow-up** for HQ to scope.

**Verify:** re-run (sign-off) should show CompetitorLandscape repair_count dropping. Note: full proof is behavioral (the re-run), not unit tests.

---

## Gates + report
- `npx tsc --noEmit` 0 · `npm run lint` 0 errors · `npm run test:run` green (new/updated tests for FIX-1/2/3) · `npm run build` pass · `cd research-worker && npm run build` (own baseline).
- Do NOT touch: the gate decision logic, the `.strict()` discipline (keep it, just add `sources` as an allowed key), the service-role-key server-only boundary, B1/B2-passing behavior.
- **Report back:** files changed, which FIX-3 path you took (store vs RPC+migration), whether you did FIX-4's grounding fetch or prompt-only, gate output, and any test fixtures you updated. One logical commit per fix is fine; keep them atomic. No push/deploy. No migration apply.

After this lands, HQ re-QAs the diff and we run a second ~$2 sign-off (user-gated) to behaviorally confirm B3 creatives + B4 latency + VoC ≥5 sources.
