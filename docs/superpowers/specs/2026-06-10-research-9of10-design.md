# Research Quality 7.5 → 9/10 — Design Spec (2026-06-10)

**Branch:** `refactor/architecture-deepening` · **Status:** approved by Ammar 2026-06-10
**Predecessor:** the 06-10 fix pack (channel policy, perplexity tool, true review detach, auto-rerun, verifier de-noise) live-proven on Anura run `89135f99`, re-grade ≈7.5/10.
**Goal:** close the five named gaps so a fresh full E2E grades ≥9/10 on the same judge rubric used for the 6.4 and 7.5 grades, then FF-merge to main.

## Decisions locked (with Ammar, this session)

1. **Buyer persona floor:** 5 → 3, plus perplexity venue passes, plus vendor-independence labeling.
2. **VoC scope:** BOTH multi-class acquisition AND per-block gaps.
3. **Verification cadence:** CLI section reruns on Anura `89135f99` after each major lever (W1 VoC, W2 Buyer, W3 paid-media), one full fresh E2E + judge re-grade ≥9/10 before FF-merge. Live spend ceiling ≈ $5.

## Root causes being fixed (grounded)

- **VoC acquisition is pain-only.** `buildVoiceOfCustomerCandidatePrepass()` (`src/lib/lab-engine/agents/run-section.ts` ~4592–4752) loops reviews → web_search → firecrawl until the pain floor clears, but the schema (`src/lib/lab-engine/artifacts/schemas/voice-of-customer.ts`) demands five classes: pain ≥6 quotes/≥3 domains, success ≥3, objections ≥5 items/≥3 categories, switching stories ≥3/≥2 prior solutions, decision criteria ≥5 (`validateVoiceOfCustomerMinimums`, ~353–407). Four classes are never acquired → guaranteed gap-commit.
- **VoC gap flag is all-or-nothing.** One `evidenceGap: true` + one pain-shaped `evidenceGapReport` (~93–164). One thin class forces the whole section to read insufficient.
- **Candidates are SERP snippets, not verbatim text.** Synthesis maps `candidate.snippet → verbatimText`; SKILL.md IRON LAW (line ~57) rightly forbids quoting truncated/paraphrased text, so the model honestly refuses → `painQuotes=0` even with 11 candidates (Anura artifact: `foundPainQuoteCount: 0`, tmp/e2e-anura-89135f99/).
- **Buyer floor unreachable + no independence rule.** Floor 5 named personas (`src/lib/lab-engine/artifacts/schemas/buyer-icp.ts` ~411); Anura found 2, both anura.io case studies. VoC bans self-domain sourcing; Buyer has no equivalent label or rule.
- **Corpus prefill misses the gating fields.** `economics.acv` + `economics.monthlyAdBudget` (read by `deriveChannelPolicy`, `src/lib/lab-engine/sections/channel-policy.ts` ~165–190) and `topCompetitors` (→ ad-probe seeds, `corpus-to-research-input.ts` ~1109–1117) commonly land empty from the worker corpus.
- **SOP projected-results table missing.** SOP spec: Target ICP / KPI / KPI cost / Objective / Duration / Budget / Projected Results, ±20% margin. No schema block, no UI.
- **Prod env gap.** `PERPLEXITY_API_KEY` absent from Vercel; the lab engine runs in-process there, so `perplexity_research` credential-gaps and VoC/Buyer/Market/Demand run degraded. `scripts/zz-ship-prod-env.sh` ships BRAVE only.

---

## W1 — VoC: multi-class acquisition + per-block gaps (biggest lever)

### W1a. Multi-class prepass acquisition

After the existing pain loop settles (ok or budget-exhausted), run **four perplexity sonar-pro calls in parallel** (`Promise.all`) — one per secondary class: success quotes, objections, switching stories, decision criteria.

- Each query carries the category disambiguator (`company.category` — the Anura/Anora homonym guard) and demands a strict line format: `"<verbatim quote>" — <source site> — <url>`.
- A deterministic parser promotes quote-bearing lines (quote text + URL present) into the existing candidate pack, **tagged by class**, flowing through the proven dedup / per-domain-cap machinery in `voice-of-customer-candidates.ts`. Unparseable lines dropped. Per-domain caps apply **within each class independently** — one quote-rich domain must not starve the other classes.
- Zero parsed lines for a class → **at most one retry for that class**. Hard cap ≈ 8 perplexity calls total. No loops (paid-API rule).
- Parallel calls keep added latency ≈ max(call) ≈ 15s, not sum — protects the 285s section budget.
- `formatVoiceOfCustomerCandidateBlock` extended to render class tags so the agent sees which class each candidate serves.
- Quote authenticity: unchanged safety net — the claim-source verifier (B4 strip-the-lie) strips misattributed provenance at the single-claim level.
- Pain floors unchanged (`voice-of-customer-floors.ts`: VOC_MIN_QUOTES=6, VOC_MIN_DOMAINS=3, VOC_MIN_SUCCESS_QUOTES=3).

### W1b. Per-block gaps

- Schema: the four secondary blocks (`successLanguage`, `objections`, `switchingStories`, `decisionCriteria`) each get an optional `blockGap` object, small and `.strict()`:
  `{ summary: string(min 1), foundCount: int ≥0, requiredCount: int >0, sourcingPlan: string[](min 1) }`
- `painLanguage` does NOT get a blockGap — pain is the core class; if pain is empty the existing section-level `evidenceGap` remains the (correctly damning) mechanism.
- `validateVoiceOfCustomerMinimums`: each secondary class's minimum is enforced **unless that block declares a blockGap**. Section-level `evidenceGap` bypass unchanged.
- `hasVocQuoteOrGap` / `hasNestedGap` (`src/lib/lab-engine/sections/required-evidence.ts` ~253–267) extended to recognize the new blockGap shape.
- SKILL.md (`skills/positioning-voice-of-customer/SKILL.md`): consumption rules for class-tagged candidates; blockGap authoring rule — file a blockGap only after attempting promotion from the pack, never fabricate to dodge a floor. IRON LAW untouched.

### W1 tests (TDD)

Validator: blockGap bypasses that block's minimum; absent blockGap enforces it; strict shape rejects extras. Parser: line parsing, class tagging, URL requirement, caps. Prepass orchestration: parallel fan-out, retry-once, hard cap, credentialGap abort. `section-registry.test.ts` contract: allowedTools unchanged (perplexity already present) — confirm no drift.

### W1 live proof

CLI rerun of VoC on `89135f99` (`scripts/zz-rerun-section-cli.ts`). Pass = ≥6 verbatim pain quotes / ≥3 domains, ≥2 of 4 secondary classes meet minimums, any empty class carries an honest blockGap, no section-level evidenceGap.

## W2 — Buyer ICP: floor 3, venue prepass, vendor-independence

- **Floor 5 → 3**: `buyer-icp.ts` (~411) + `evidenceGapReport.requiredNamedPersonaCount` semantics + SKILL.md IRON LAW text ("at least 5" → "at least 3").
- **Venue prepass (harness-side)**: 2 parallel perplexity calls injected as a persona candidate block (builder mirrors the VoC block format): (1) named ICP-role individuals visible in podcasts / conference talks / LinkedIn posts for the category; (2) named reviewer identities on G2/Capterra-class sites. Full name + title + company + URL demanded. One retry per call on zero yield — hard cap 4 calls total. Agent-driven mining demonstrably underperforms (tool was available on the last rerun; 2 personas found).
- **`vendorSourced: boolean` derived in the normalizer** — registrable domain of `persona.sourceUrl` equals subject domain → true. Model never asked to fill it (derive-don't-ask, same pattern as the P3 provenance verifier). Vendor-sourced personas still count toward the floor — they are real buyers — they're just labeled.
- UI: one-line badge ("vendor-sourced") in the persona card.
- Existing `isLikelyNamedBuyerIdentity` validator unchanged.
- Tests: floor behavior (3 passes; 2+gap passes; 2 without gap fails), domain-derivation units (www/subdomain/exact), prepass builder shape.
- Live proof: Buyer rerun on `89135f99`. Pass = ≥3 validator-passing personas, ≥1 with `vendorSourced=false`, no persona gap report.

## W3 — SOP projected-results table

- **Schema** (`paid-media-plan.ts`, new block after `channelSuggestions`): rows of `{ targetIcp, kpi, kpiCostValue, kpiCostProvenance (reuse money-provenance enum ~17–21), objective, durationLabel, phaseMonthlyBudgetValue, phaseMonthlyBudgetProvenance, projectedCountValue?, marginOfErrorPercent, sourceSection }`.
- **The model never does the math.** Normalizer computes `projectedCountValue = floor(budget ÷ kpiCost)` and writes `marginOfErrorPercent = 20` (SOP constant). Count provenance inherits the weakest input (model-estimated kpiCost → model-estimated count, badge rendered). kpiCost unknown/zero → count omitted, never invented.
- **Prompts**: SOP-table instruction added to all three prompt builders (repair inherits), alongside the existing binding channel-policy block.
- **UI** (`src/components/research-v2/section-renderers/paid-media-plan.tsx`): `DataTable` + `MoneyValue` columns (existing patterns ~126–250), count rendered with `(±20%)` suffix, in a "Projected Results" subsection after Channel Suggestions.
- Validator: ≥1 row; no NaN/negative numerics.
- Tests: normalizer math (division, rounding, provenance inheritance, omit-on-unknown), schema accept/reject, validator floor.
- Live proof: paid-media rerun on `89135f99`. Pass = table present, counts computed with provenance, channel policy still honored.

## W4 — Corpus prefill coverage (worker-side)

- Extend the deepResearchProgram onboarding-field extraction (`research-worker/src/runners/deep-research-program.ts` + the onboardingFields assembly it feeds) so `acv`, `monthlyAdBudget`, and `topCompetitors` are reliably extracted when the corpus saw pricing/budget/competitor evidence; robust list parsing for competitors (commas, semicolons, "X and Y" — app-side seed splitting from `eb3170d7` stays as the second net).
- Worker boundary respected: no `src/lib` imports; logic lives in `research-worker/`.
- Capture the worker's OWN build baseline before touching it (`cd research-worker && npm run build`) — learned-patterns rule.
- Takes effect in prod only after Railway deploy (`cd research-worker && railway up`) — called out in the merge checklist.
- Live proof: deferred to the final E2E (fresh corpus) — brief prefill shows the three fields populated for a company whose site discloses them.

## W5 — Env + merge gate

- `scripts/zz-ship-prod-env.sh`: generalize from BRAVE-only to a `REQUIRED_KEYS` loop — `BRAVE_SEARCH_API_KEY`, `PERPLEXITY_API_KEY` — idempotent, value-hidden. **Ammar runs it via `!`** (auto-mode classifier blocks Vercel prod mutations for the agent).
- Railway parity: `zz-cmp-perplexity-key.sh` (diagnostic); `zz-set-railway-perplexity.sh` if fingerprints differ.
- **Merge gate, in order:** all workstream offline gates green → fresh full E2E on a clean brief → `scripts/zz-verify-e2e-run.mjs` objective gate PASS → judge re-grade ≥9/10 (same rubric as the 6.4/7.5 grades) → Vercel env confirmed (PERPLEXITY + BRAVE) → FF-merge to main (prod auto-deploys) → Railway worker deploy for W4.

---

## Execution order & dependencies

W1 → W2 → W3 → W4 → W5. W2/W3 are independent of each other (parallelizable in the plan); W4 is independent of W1–W3; W5 is strictly last. Each workstream commits separately (revert-granular), each passes tsc 0 / targeted vitest / build 0 before its live rerun.

## Risks

- **DeepSeek schema-compat fragility** (compatibility-mode schema injection): VoC schema grows by four small optional strict objects — kept minimal deliberately; TAM-coercion (`10f3eaa5`) is the precedent fallback if near-miss shapes appear in reruns.
- **285s section ceiling**: prepass additions are parallel (~15s added worst case VoC, ~10s Buyer).
- **Perplexity quote authenticity**: existing claim-source verifier strips misattributed provenance; per-quote URLs required at parse time.
- **Paid-API discipline**: every new call site hard-capped (VoC ≤8, Buyer ≤2 + retries ≤2), aborts on credentialGap.

## Out of scope

Badge calibration (B5) · morning sections' review=unavailable backfill (final E2E covers) · SpyFu quota · the 285s timeout class · Supabase→Railway migration (parked) · any change to pain floors or the channel-policy engine.

## Success criteria (the spec is done when)

1. Anura VoC rerun: ≥6 verbatim pain quotes/≥3 domains, ≥2 secondary classes filled, honest blockGaps on the rest, no section-level gap.
2. Anura Buyer rerun: ≥3 named personas, ≥1 non-vendor, no persona gap.
3. Anura paid-media rerun: projected-results table rendered with computed counts + provenance.
4. Final fresh E2E: corpus prefills acv/budget/competitors; objective gate PASS; judge re-grade ≥9/10.
5. Offline gates green at every commit: tsc 0, vitest green (incl. section-registry contract), build exit 0.
6. Vercel has PERPLEXITY_API_KEY + BRAVE_SEARCH_API_KEY; Railway key parity verified; FF-merge to main completed.
