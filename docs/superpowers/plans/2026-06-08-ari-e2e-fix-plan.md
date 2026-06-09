# ARI E2E Fix Implementation Plan (W1 + W2 + W3)

> **For agentic workers (Codex xhigh):** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax. This is an ISOLATED, file-based handoff — do not rely on ambient chat context. Verify every cited line number by grepping the named symbol first (line numbers drift; symbol names + anchor code are authoritative). Never self-report success — the dispatcher reviews the diff and re-runs the gate.

**Goal:** Make the cross-section thinker (and the synthesis/paid-media capstones) run on 6/6-complete regardless of section quality — reasoning over imperfect inputs and badging `needs_review` when degraded — and fix the two real bugs that made this Ramp run look worse than it is (VoC retrieval tooling + operator-economics false-unsupported).

**Architecture:** Three disjoint-ish workstreams. **W1** removes a quality gate that was *accidentally* blocking the thinker (it was meant only for final strategy), passing readiness through as a coverage annotation and downgrading capstone badges instead of dropping them. **W2** repairs VoC acquisition (Reddit JSON fallback, generic-paragraph parser fallback, competitor-seed de-contamination, non-buyer-voice rejection) and reconciles its floors via the existing evidence-gap escape hatch. **W3** adds a one-branch provenance escape so operator-self-labeled economics stop being scored as unsupported public facts.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Vercel AI SDK v6, Zod, Vitest, Supabase. Section model = DeepSeek (`deepseek-v4-flash`).

---

## Baseline & Guardrails (read first)

- Repo: `/Users/ammar/Dev-Projects/AI-GOS`, branch `feat/research-quality-truthgate` (already checked out; HEAD `70019f4b`).
- **tsc baseline is CLEAN: `npx tsc --noEmit` → 0 errors.** The gate is: it must STAY 0. Any new `error TS` is yours.
- **Do NOT touch** existing dirty/untracked files: `.gitignore` (modified), `docs/2026-06-03-supabase-to-railway-migration-plan.md`, `docs/superpowers/plans/2026-06-05-research-quality-blockers-plan.md`, this plan file.
- All changes are in `src/` (frontend). **Do NOT touch `research-worker/`.**
- Provider rules: AI SDK v6, `inputSchema`/`maxOutputTokens`, no OpenRouter. Match existing file style; named exports; kebab-case files.
- Commit per workstream (3 commits) with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailers. Do not push, PR, merge, or deploy.

### NON-GOALS (do not do these)
- Do NOT remove the two *legitimate* 409s in `buildCommittedArtifactsResearchInput` (`positioning_sections_not_ready` = missing section bodies; `cross_section_reasoning_not_ready` = thinker artifact not yet committed before synthesis/paid-media). Only the **quality** gate (`research_evidence_not_ready`) goes.
- Do NOT change `seed_orchestration` / `counts_toward_rollup` (capstones must stay `false`; server-owned — out of scope).
- Do NOT rewrite the brittle G2/Capterra structured selectors (W2). Add a fallback *around* them.
- Do NOT lower the VoC *clean* quality bar globally (use the evidence-gap escape hatch instead).
- Do NOT broaden the W3 operator-marker list beyond the two literals specified.
- Do NOT fix the W3 "budget split data-capture" mapping gap (flagged, separate workstream).

### FINAL VERIFICATION GATE (must all pass before reporting done)
```bash
npx tsc --noEmit                 # MUST be 0 errors (baseline was 0)
npm run lint                     # no new errors
npm run test:run -- \
  src/app/api/research-v2/run-lab-section/__tests__/route.test.ts \
  src/app/api/research-v2/rerun-section/__tests__/route.test.ts \
  src/lib/research-v2/__tests__/use-audit-state.test.tsx \
  src/lib/research-v2/__tests__/commit-patch.test.ts \
  src/lib/research-v2/__tests__/verification-tier.test.ts \
  src/lib/research-v2/__tests__/research-evidence-readiness.test.ts \
  src/lib/lab-engine/agents/verification/__tests__/structural-verifier.test.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/agents/tools/__tests__/reviews.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts
npm run test:run                 # full suite green (report the number)
npm run build                    # exits 0
```
Report the ACTUAL output of each. If any pre-existing test was failing before you started, capture that baseline first (`npm run test:run` on a clean tree) and state it.

---

# Workstream 1 — Ungate the thinker + coverage map + needs_review badge

> Root cause: all 3 capstones share `buildCommittedArtifactsResearchInput`, which calls `evaluateResearchEvidenceReadiness` unconditionally and 409s `research_evidence_not_ready` when any section is `insufficient`/`evidenceGap`. The thinker auto-dispatch swallows that 409 silently → no capstones. Fix: compute readiness as *metadata*, never block on it; badge capstones `needs_review` when inputs were degraded.

### Task 1.1: Add `evidenceCoverage` to the ResearchInput schema (MUST land before routes)

**Files:** Modify `src/lib/lab-engine/artifacts/artifact-envelope.ts` (`researchInputSchema`, ~lines 277-318; it is `.strict()`).

- [ ] **Step 1:** Locate `researchInputSchema` (grep `researchInputSchema = z.object`). Confirm it is `.strict()` and has `committedPositioningArtifacts` + `crossSectionReasoningArtifact` optional keys.
- [ ] **Step 2:** Add this optional field beside `committedPositioningArtifacts`:
```ts
evidenceCoverage: z
  .object({
    ready: z.boolean(),
    blockedSections: z
      .array(z.object({ zone: z.string(), reasons: z.array(z.string()) }).strict())
      .default([]),
    reasons: z.array(z.string()).default([]),
  })
  .strict()
  .optional(),
```
- [ ] **Step 3:** `npx tsc --noEmit` → 0. The `ResearchInput` type (z.infer) updates automatically. If an `artifact-envelope` test pins the exact key set, update that fixture.

### Task 1.2: Export `strictestVerificationTier`

**Files:** Modify `src/lib/research-v2/verification-tier.ts` (~line 145).

- [ ] **Step 1:** Find `function strictestVerificationTier` (module-local). Add `export`. No other change. `npx tsc --noEmit` → 0.

### Task 1.3: Teach `buildCommitPatch` to degrade capstone badges

**Files:** Modify `src/lib/research-v2/commit-patch.ts` (`buildCommitPatch`, signature ~96-99, flag derivation ~114-134). Test `src/lib/research-v2/__tests__/commit-patch.test.ts`.

- [ ] **Step 1 (failing test):** Add to `commit-patch.test.ts`:
```ts
it('degrades a capstone badge to needs_review when inputs were degraded', () => {
  const patch = buildCommitPatch(CROSS_SECTION_REASONING_SECTION_ID, verifiedCapstoneArtifact, { degradeToNeedsReview: true });
  expect(patch.verificationTier).toBe('needs_review');
});
it('does not upgrade a genuinely-insufficient capstone', () => {
  const patch = buildCommitPatch(CROSS_SECTION_REASONING_SECTION_ID, insufficientArtifact, { degradeToNeedsReview: true });
  expect(patch.verificationTier).toBe('insufficient');
});
```
(Reuse/derive fixtures from the existing test file's artifact builders. Import the capstone id constant the same way the file imports other section ids.)
- [ ] **Step 2:** Run it → FAIL (3rd param unknown / no downgrade).
- [ ] **Step 3:** Add `opts?: { degradeToNeedsReview?: boolean }` as the 3rd param. After `verificationFlag` is computed, apply (import `strictestVerificationTier` from `./verification-tier`):
```ts
const effectiveFlag =
  opts?.degradeToNeedsReview && verificationFlag
    ? { ...verificationFlag, tier: strictestVerificationTier(verificationFlag.tier, 'needs_review') }
    : opts?.degradeToNeedsReview
      ? buildReviewVerificationFlag({ tier: 'needs_review', baseFlag: null })
      : verificationFlag;
```
Return `verificationTier: effectiveFlag?.tier ?? null, verificationFlag: effectiveFlag`. (Use whatever `buildReviewVerificationFlag` shape already exists in `verification-tier.ts`; if its signature differs, construct a minimal `needs_review` flag consistent with that module. **Never upgrade** — strictest wins.)
- [ ] **Step 4:** Run test → PASS. Existing 2-arg call sites still compile (param optional).

### Task 1.4: Drive the degrade from the commit point

**Files:** Modify `src/lib/research-v2/supabase-run-store.ts` (the single `buildCommitPatch` call site, ~line 1007 inside `saveArtifact`; parsed `input` = researchInput is in scope ~line 910).

- [ ] **Step 1:** Confirm this is the ONLY non-test caller of `buildCommitPatch` (`grep -rn buildCommitPatch src --include=*.ts | grep -v __tests__`).
- [ ] **Step 2:** Before the call, compute the flag (import the 3 capstone id constants the way the file/route imports them — `CROSS_SECTION_REASONING_SECTION_ID`, `PAID_MEDIA_PLAN_SECTION_ID`, `POSITIONING_SYNTHESIS_SECTION_ID`):
```ts
const isCapstone =
  artifactToCommit.sectionId === CROSS_SECTION_REASONING_SECTION_ID ||
  artifactToCommit.sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
  artifactToCommit.sectionId === POSITIONING_SYNTHESIS_SECTION_ID;
const degradeToNeedsReview = isCapstone && input.evidenceCoverage?.ready === false;
```
Pass `{ degradeToNeedsReview }` as the 3rd arg to `buildCommitPatch`. (This single point covers both the auto-dispatch and rerun paths.)
- [ ] **Step 3:** `npx tsc --noEmit` → 0.

### Task 1.5: Remove the quality gate in BOTH route copies, attach coverage

> LANDMINE: `run-lab-section` and `rerun-section` each have their OWN duplicate copy of `buildCommittedArtifactsResearchInput`. Edit BOTH identically or the gate stays live on the rerun path.

**Files:** Modify `src/app/api/research-v2/run-lab-section/route.ts` (~212-238) AND `src/app/api/research-v2/rerun-section/route.ts` (~240-265).

- [ ] **Step 1:** In each, find `evaluateResearchEvidenceReadiness`. **Keep** the `const readiness = evaluateResearchEvidenceReadiness(...)` call. **Delete** the immediately-following `if (!readiness.ready) { return NextResponse.json({ error: 'research_evidence_not_ready', ... }, { status: 409 }) }` block.
- [ ] **Step 2:** In each success return that does `researchInputSchema.parse({ ...baseResearchInput, committedPositioningArtifacts, ... })`, add:
```ts
evidenceCoverage: {
  ready: readiness.ready,
  blockedSections: readiness.blockedSections,
  reasons: readiness.reasons,
},
```
- [ ] **Step 3:** Confirm the two legitimate 409s above (`positioning_sections_not_ready`, `cross_section_reasoning_not_ready`) are untouched. `npx tsc --noEmit` → 0.
- [ ] **Step 4 (invert route tests):** In `run-lab-section/__tests__/route.test.ts`, the test `blocks capstone dispatch when core section evidence is not research-ready` (~1069-1108) now asserts the WRONG thing. Invert it: assert the dispatch proceeds (202 / run store called) and that the scheduled `researchInput.evidenceCoverage.ready === false` with the expected blocked zones. Do the same for `rerun-section/__tests__/route.test.ts` test `blocks capstone reruns when committed core evidence is insufficient` (~532-588): assert the rerun schedules and carries `evidenceCoverage.ready===false`. Keep the missing-bodies 409 tests as-is.

### Task 1.6: Remove the client terminal-latch

**Files:** Modify `src/lib/research-v2/use-audit-state.ts`. Test `src/lib/research-v2/__tests__/use-audit-state.test.tsx`.

- [ ] **Step 1:** Find `isResearchEvidenceReadinessBlock`, `evidenceBlockedPostSixRunIds`, and the `research_evidence_not_ready` special-case in `logDispatchError`. The server no longer emits this code as a quality gate, so the latch is dead/incorrect.
- [ ] **Step 2:** Remove: the `isResearchEvidenceReadinessBlock` helper + its `logDispatchError` branch (let it fall through to the existing `status===409 → debug + retry` branch); the `evidenceBlockedPostSixRunIds` ref and its `.delete(runId)` reset; the `postSixEvidenceBlocked` gating term on all three `shouldDispatch*` conditions; the `...add(runId)` arms in all three catch blocks (KEEP the `else { dispatched*.current.delete(runId) }` so transient failures retry); and the `!evidenceBlockedPostSixRunIds.current.has(runId)` term in `waitingForPostSix`. Remove ALL references atomically (a dangling ref breaks the build).
- [ ] **Step 3 (test):** In `use-audit-state.test.tsx`, the test `does not retry post-six dispatch after deterministic evidence block` (~145-183) now contradicts the design. Delete it (or invert to assert the client RETRIES after a transient 409). `npx tsc --noEmit` → 0.

### Task 1.7: Tell the thinker to weight low-coverage sections

**Files:** Modify `src/lib/lab-engine/skills/positioning-cross-section-reasoning/SKILL.md`.

- [ ] **Step 1:** Add a short instruction (match the file's voice; do not rewrite it) near where it describes its inputs, e.g.:
> When `ResearchInput.evidenceCoverage.ready` is false, the listed `blockedSections` are thin/low-confidence. Reason over them with appropriate caution: name the cross-section tensions you can still support, and explicitly flag any inference that leans on a thin section rather than asserting it with false confidence.
- [ ] **Step 2:** Commit W1: `git add -A && git commit` (message: `fix(research-quality): ARI W1 — ungate thinker from readiness, pass coverage + needs_review badge`).

---

# Workstream 2 — Fix VoC retrieval, floors, and contamination

> Root cause (verified from the run's acquisition ledger): VoC found 7/10 pain-quotes (domains 4/3 = met). Every Reddit thread 403'd via Firecrawl; G2+Capterra `parser_no_match` (scrape OK, stale parser); the 7 survivors were contamination (Tipalti/Brex reviews via a `Brex` query, job postings, an Apify product page). Internal floor contradiction: selection floor 6 vs synthesis floor 10.

### Task 2.1: Reddit public-JSON fallback when Firecrawl 403s

**Files:** Modify `src/lib/lab-engine/agents/tools/reviews.ts` (`scrapeReviewBodies`, ~726-827). Test `src/lib/lab-engine/agents/tools/__tests__/reviews.test.ts`.

- [ ] **Step 1 (failing test):** Add a test: a reddit.com URL whose Firecrawl scrape returns 403 routes to the Reddit JSON path; mock a `*.json` GET returning `[postListing, commentsListing]` with two comment bodies containing pain language; assert excerpts are promoted (`acquisitionMode: 'forum_comment'`), not `gapReason: 'api_error'`. (Extend the existing mocked-fetch harness.)
- [ ] **Step 2:** Implement:
  - `function isRedditUrl(url: string): boolean` → `getDomain(url) === 'reddit.com' || getDomain(url).endsWith('.reddit.com')` (reuse the file's existing `getDomain`).
  - `async function fetchRedditJsonBodies(input: { abortSignal?: AbortSignal; searchResult: ... }): Promise<ScrapeReviewBodiesResult>`: strip query/hash, ensure trailing slash, force host `www.reddit.com`, append `.json?raw_json=1&limit=50`; GET via the file's `timedFetch`/`reviewBodyScrapeTimeoutMs` with header **`'User-Agent': 'aigos-research/1.0'`** (Reddit 403s a default UA — REQUIRED). Parse: `arr[0]` = post listing (use post `data.children[0].data.selftext`), `arr[1].data.children[].data.body` = top-level comments (no recursion needed). Run each text through the EXISTING `reviewBodyExcerpt({ acquisitionMode: 'forum_comment', reviewText, searchResult })` (reuses pain-signal/min-char/product-review filters + sourceInstanceId hashing). Cap at `maxReviewBodiesPerPage`. Return a succeeded attempt when `excerpts.length > 0`, else `gapReason: 'parser_no_match'`.
  - In `scrapeReviewBodies`, at the THREE reddit-relevant failure exits — `!response.ok` (~760), empty-markdown (~782), `isBlockedPage` (~795) — when `isRedditUrl(input.searchResult.url)`, `return await fetchRedditJsonBodies(...)` instead of the Firecrawl-failure attempt. Non-reddit behavior identical.
  - Code comment: *Firecrawl 403 on reddit is INFRA (Firecrawl anti-bot on reddit.com); the code-fixable part is routing reddit bodies to Reddit's own JSON API which needs no Firecrawl.*
- [ ] **Step 3:** Update the existing reddit-blocked test (`~456-504`) which pins `gapReason 'blocked_js_challenge'/api_error` — it must now assert the JSON fallback path (or `parser_no_match` only when JSON also yields nothing). Run reviews tests → PASS.

### Task 2.2: Generic-paragraph fallback for drifted G2/Capterra pages

**Files:** Modify `src/lib/lab-engine/agents/tools/reviews.ts` (`extractReviewBodies`, ~686-718). Test same reviews test file.

- [ ] **Step 1 (failing test):** Add: a G2/Capterra markdown that SUCCEEDS scraping but lacks the `What do you dislike`/`Cons:` headings now yields pain-signal paragraphs via the generic fallback (not `parser_no_match`).
- [ ] **Step 2:** In `extractReviewBodies`, after computing source-specific excerpts for G2/Capterra/Trustpilot, if that array is empty, fall through to the existing `extractGenericReviewBodies(markdown, { ...searchResult, acquisitionMode: 'review_body' })` (~643-684; pain-signal + ≥40-char + dedupe guards). Keep `parser_no_match` ONLY when even the generic fallback yields nothing. Apply uniformly to G2/Capterra/Trustpilot. Comment: trades precision for recall on parser drift; pain-signal filter is the safety net.
- [ ] **Step 3:** Run reviews tests → PASS.

### Task 2.3: Reject non-buyer-voice surfaces (job postings, ATS, marketing pages)

**Files:** Modify `src/lib/lab-engine/agents/tools/reviews.ts` (`isProductReviewText` ~304-340, used by `reviewBodyExcerpt`). Test same file.

- [ ] **Step 1 (failing test):** Add: (a) a Ramp job-posting markdown that mentions "platform" is REJECTED (excerpts `[]`); (b) a first-party marketing page ("our platform … request a demo") is REJECTED; (c) a genuine negative review still passes.
- [ ] **Step 2:** Tighten `isProductReviewText` so the employment-signal path can no longer be rescued by a generic product noun, and add a positive marketing/job-posting reject: reject when the text reads as a job posting (`responsibilities`, `qualifications`, `we are looking for`, `apply now`, `years of experience`, `equal opportunity employer`) OR first-party marketing (`our platform`, `sign up today`, `request a demo`, `trusted by`). Optionally add a cheap URL-path reject before scraping for `/(careers?|jobs?|hiring|apply|pricing|product|features|solutions)/i` and known ATS hosts (greenhouse.io, lever.co, ashbyhq.com, workable.com).
- [ ] **Step 3:** Run reviews tests → PASS.

### Task 2.4: Stop competitor-seed contamination of VoC

**Files:** Modify `src/lib/lab-engine/agents/run-section.ts` (`buildVoiceOfCustomerReviewQueries`, ~5916-5943). Test `src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts`.

- [ ] **Step 1:** Change `rawQueries` (~5919-5922) from `[company.name, ...competitorSeeds.map(s => s.name)]` to `[researchInput.company.name]` only. (Competitor buyer-voice belongs to competitor-landscape, not VoC.)
- [ ] **Step 2:** Update any test asserting a competitor-named review lookup or competitor reviews appearing as audited-company candidates (that was the bug). `npx tsc --noEmit` → 0.

### Task 2.5: Reconcile the VoC floors via the evidence-gap escape hatch (Option A — subtlest change; read carefully)

**Files:** Modify `src/lib/lab-engine/agents/voice-of-customer-synthesis.ts` (`SYNTHESIS_MIN_PAIN_QUOTES` ~18, gate ~397) and `src/lib/lab-engine/agents/run-section.ts` (the deterministic-synthesis artifact builder ~883-960 and the `voiceOfCustomerRequiredPainQuoteCount`/`...DistinctPainSourceCount` ~432-433). Test `voice-of-customer-synthesis.test.ts`.

> LANDMINE: there are FOUR coupled floors — synthesis const (18), synthesis gate (397), section evidenceGapReport numbers (432-433, descriptive), and schema `validateVoiceOfCustomerMinimums` (`voice-of-customer.ts:408/423/451/458`, which synthesis re-runs in `validateOutput`). Lowering ONLY the synthesis const relocates the throw to `validateOutput`. The schema ALREADY has a "never throw-and-drop" hook at `voice-of-customer.ts:464-470`: it returns ok when `body.evidenceGap===true` AND `evidenceGapReport` present, regardless of unmet floors. Route degraded VoC THROUGH that hook.

- [ ] **Step 1:** Read `voice-of-customer.ts:464-470` (the escape hatch) and the run's already-committed shape (the section currently emits an `evidenceGapReport` — that is your template). The clean bar stays 10.
- [ ] **Step 2:** When `6 <= painQuoteCount < 10`, instead of returning `undefined`/`ok:false` (the throw-and-drop at run-section.ts ~918/940/950/959), build a real VoC artifact from the available 6-9 quotes with `body.evidenceGap = true` + a populated `body.evidenceGapReport` (`reason: 'below_clean_quote_bar'`, summary noting "committed with N of 10 ideal quotes (needs_review)"), so it commits via the escape hatch as a `needs_review` evidence-gap artifact rather than a zero-claim `insufficient` gap. Below 6, keep current honest-gap behavior.
- [ ] **Step 3:** Align the descriptive `evidenceGapReport` numbers at run-section.ts ~432-433 so the summary text is consistent (no misleading "required 10" on a committed 6-9 run).
- [ ] **Step 4 (test):** In `voice-of-customer-synthesis.test.ts`, add a case proving a 6-candidate pack now COMMITS as a needs_review evidence-gap artifact (not `ok:false reason:'insufficient_candidates'`). Keep the 10-candidate clean happy path green.
- [ ] **Step 5:** Commit W2: `git add -A && git commit` (message: `fix(research-quality): ARI W2 — VoC reddit-json + parser fallback, de-contaminate, floor reconcile`).

---

# Workstream 3 — Operator economics provenance escape

> Root cause: the verifier is a substring matcher; model-DERIVED operator numbers ($26.25K = 35%×$75K, splits, 25% demo-close) never appear verbatim in the stored operator strings → `no_match` → counted unsupported, even though the claim's own prose self-labels it "Operator-supplied". The `user_asserted` representation already exists and already counts as verified.

### Task 3.1: Provenance escape in `structuralVerifier`

**Files:** Modify `src/lib/lab-engine/agents/verification/structural-verifier.ts` (the `claims.map(...)` no_match branch, ~337-341 at HEAD — verify by grepping `reason: "no_match"`). Test `src/lib/lab-engine/agents/verification/__tests__/structural-verifier.test.ts`.

- [ ] **Step 1 (failing tests):** Add to `structural-verifier.test.ts`:
```ts
it('credits operator-self-labeled derived economics as user_asserted', () => {
  // body prose: 'Operator-supplied 35% of $75K/mo budget ($26.25K/mo) ...'
  // EMPTY onboarding/toolResults/corpus so substring match cannot fire
  const report = structuralVerifier({ body, corpusExcerpts: [], onboarding: undefined, toolResults: [] });
  const v = report.verdicts.find(/* the $26.25K numeric claim */);
  expect(v.status).toBe('verified');
  expect(v.entailmentVerdict).toBe('user_asserted');
  expect(report.verifiedCount).toBeGreaterThan(0);
});
it('does not rescue genuinely-inferred claims', () => {
  // body prose: 'Inferred average ACV ~$14.3K ...' and 'Ramp does not publicly disclose ...'
  const report = structuralVerifier({ body, corpusExcerpts: [], onboarding: undefined, toolResults: [] });
  expect(/* those claims */.every(v => v.status === 'unsupported')).toBe(true);
});
```
- [ ] **Step 2:** Run → FAIL (currently both unsupported).
- [ ] **Step 3:** Add a module-level helper near the other normalizers:
```ts
const OPERATOR_PROVENANCE_MARKERS = ['operator-supplied', 'client brief'] as const;
function hasOperatorProvenanceMarker(claim: Claim): boolean {
  const raw = claim.raw.toLowerCase();
  return OPERATOR_PROVENANCE_MARKERS.some((m) => raw.includes(m));
}
```
In the `claims.map` callback, AFTER `if (match !== null) { ... }` and BEFORE the `return { status: 'unsupported', claim, reason: 'no_match' }`:
```ts
if (hasOperatorProvenanceMarker(claim)) {
  return {
    status: 'verified',
    claim,
    matchedSourceRef: { kind: 'userProvided' },
    entailmentVerdict: 'user_asserted',
  };
}
```
(Verified against `verification/types.ts`: `status:'verified'` requires `matchedSourceRef` — `{ kind: 'userProvided' }` is valid, `field` optional → omit. `entailmentVerdict: 'user_asserted'` is type-valid on a verified verdict. There is NO `user_asserted` *status* — do not invent one.)
- [ ] **Step 4:** Run → PASS. Confirm the existing `flags fabricated numeric and quote claims as unsupported` and `credits onboarding economics` tests still pass (their fixtures carry no marker / match by substring).
- [ ] **Step 5 (eval sweep):** `grep -rl 'Operator-supplied\|operator-supplied\|client brief' src/lib/lab-engine/agents/verification/__evals__/fixtures/` — if any eval fixture pins an exact `unsupportedCount` and contains the marker, update the pinned count. Re-run `verifier.eval.test.ts`.
- [ ] **Step 6:** Confirm no separate confidence handling is needed (the status flip auto-fixes it: `deriveGroundedConfidence` = verifiedCount/(verified+unsupported); `user_asserted` rides `status:'verified'`). Commit W3: `git add -A && git commit` (message: `fix(research-quality): ARI W3 — credit operator-supplied economics as user_asserted`).

---

## Self-Review checklist (run before reporting)
- [ ] Spec coverage: W1 (schema, export, commit-patch, store, both routes, client, SKILL.md) ✓ W2 (reddit-json, parser fallback, non-buyer reject, de-contaminate, floor reconcile) ✓ W3 (marker escape) ✓.
- [ ] No placeholder left; every code step has real code.
- [ ] BOTH route copies edited (run-lab-section AND rerun-section).
- [ ] `evidenceCoverage` schema landed BEFORE routes attach it (`.strict()`).
- [ ] Degrade uses `strictestVerificationTier` (never upgrades).
- [ ] Marker list is exactly `['operator-supplied','client brief']`; inferred claims stay unsupported.
- [ ] VoC floor reconcile routes through the existing evidence-gap hook (no schema-floor weakening).
- [ ] FINAL VERIFICATION GATE run; actual outputs reported.
