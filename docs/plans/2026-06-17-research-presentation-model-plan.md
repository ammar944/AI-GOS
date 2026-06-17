# Research Quality — The Presentation-Model Plan

**Date:** 2026-06-17
**Run analyzed:** `d2abf018-529c-4582-822e-585fecc53808` (subject: Ramp). Bundle: `tmp/grill/ramp-current-status/`
**Method:** human value-read of every *rendered* section — a 5-reader Claude panel + an independent Codex diagnosis (xhigh) + lead synthesis. **Internal evals (buyer-eval, coverage-eval, floors) were used only as liar-catcher floors, never as the bar.** The bar is: *when a media buyer reads this, is it good and usable, or is it slop?*

---

## 1. Value-read scoreboard (how each section reads to a media buyer, 0–10)

| Section | Score | One-line verdict |
|---|---|---|
| Buyer ICP | **1** | "A receipt for a timeout." 0 personas; found 5 real people then discarded all 5; ships 5 fake `ramp.com/#section-gap-N` sources; asks the buyer to supply the personas they paid for. |
| Voice of Customer | **2** | 2 real quotes buried under ~12 "Not enough public evidence" lines + a raw `runId=…; sectionId=…` debug tail. ~30 vivid real complaints were scraped, then rejected. |
| Demand Intent | **3** | "A research proposal cosplaying as a finished report." The non-branded keyword universe — the whole point — is absent; the table is 4 branded terms. |
| Paid Media Plan (capstone) | **3.5** | "Well-written air." ~50% empty cells; spend $200/day on queries it admits it never validated; "16 MQLs" = budget ÷ your own target number. |
| Market Category | **5** | "A great essay welded to two empty boxes." Shows the TAM *formula*, then refuses to compute it. |
| Competitor Landscape | **5.5** | Richest section, but the ad half is ~85% disclaimer; prose oversells ("Brex 29 creatives / Airbase verified") when 0 are verified and 5/6 Airbase "ads" are recruiter posts. |
| Offer Diagnostic | **5.5** | "A sharp one-idea memo in eight headers it can't fill." The CAC case is your own brief sold back to you. |

**Average ≈ 3.6 / 10.** Every section has a genuinely sharp **kernel** of strategy — and that kernel is drowned.

---

## 2. Diagnosis — the app has no reader presentation model

Triangulated across the lead analysis, the 5 value-reads, and Codex's independent diagnosis.

The pipeline persists **execution-truth + validation-truth + acquisition-gaps + model-prose** into one artifact `body`, then the renderer walks the schema and hands every block a slot. Four failure modes follow, plus an incentive that manufactures them:

1. **Diagnostics leak into customer prose.** `formatVoiceOfCustomerCandidateGapIssue()` builds a log line (`reason=…; runId=…; sectionId=…; subjectDomain=…`) at `run-section.ts:9431`; `buildVoiceOfCustomerEvidenceGapBody()` concatenates it into `summary` → `retrievalSummary` + `painLanguage.prose` (`run-section.ts:1437/1447/1477`). The customer reads a `runId`.
2. **Gap skeletons carpet-bomb the page.** A shortfall in one block replaces the *whole* body with apology prose stamped into every block (`evidence gap: …` ×15 → 71 hits in VoC; `buildDeadlineExhaustionGapBlock` → 37 in BuyerICP).
3. **The schema forces breadth the evidence can't fill.** Sections must fill ~8 peer blocks; one finding gets smeared across eight headers (Offer), and unfillable slots render as visible empty/blank boxes (Paid Media: 13 empty `refs`, 3 blank SOP rows; Demand: 4 empty peer blocks each becoming its own `GapNote`, `demand-intent.tsx:297/309/333/365/389`).
4. **Narrative oversells the structured data → trust collapse.** "Brex 29 creatives" (0 verified); operator inputs (CAC/target/LTV) sold as findings; review *claims* fixes it didn't apply (`$153/day (provenance unknown)` still in body, `positioningPaidMediaPlan.json:182/201`).

**The incentive that manufactures gap-skeletons:** the runner commits degraded output rather than honestly mark a section unavailable, to keep the 6/6 rollup green (`run-section.ts:2320`; deadline fallback authors "schema-valid empty-but-honest" bodies, `:2612`). The system would rather fake a full page than admit "this one isn't ready."

**The good news:** the strategist brain is competent (every section has an 8-grade kernel), and the data is mostly *present* (often acquired, then over-rejected). The problem is **presentation, degradation, calibration, and truth-alignment — not intelligence and not (mostly) acquisition.** A fix-precedent already exists in-repo: `OfferDiagnostic` collapses an unavailable artifact into one quiet note (`isOfferDiagnosticHonestlyUnavailable()`, `offer-diagnostic.tsx:44`).

---

## 3. The keystone — a Research Presentation Model (RPM)

Insert a layer between persistence and rendering. Classify each section by **availability tier** and emit a defined reader shape:

| Tier | Reader shape |
|---|---|
| `usable` | full narrative |
| `directional` | "what we can use" + **one** caveat line |
| `mostly-gap` | **one** "Evidence status" panel + whatever usable evidence survived — never N peer apology blocks |
| `unavailable` | one honest line (generalize the `OfferDiagnostic` precedent) |

This one move kills carpet-bombing, kills schema-padding, gives gaps a single clean home, and removes the runner's need to fake a full page.

---

## 4. Workstreams

### WS1 — Diagnostic/Display split (telemetry never in prose) — *Phase 1*
- **Fix at source:** the log-shaped formatters (`formatVoiceOfCustomerCandidateGapIssue` `run-section.ts:9431` + siblings at `:529/:2546`) emit to logs / `evidenceGapReport.debug` only — **never** into a field that renders. Reader-facing fields are produced by one typed `honestGap` constructor that *cannot* carry telemetry.
- **CI invariant (kills the 5×-in-a-week regression):** a test that scans every reader-facing field of a committed artifact and fails on telemetry shape (`runId`, `sectionId`, `reason=`, `…=…;`, `"Not enough public evidence:"` prefix). The scrub belt (`reader-text.ts`) stays as a backstop, not the primary defense.
- **Proof:** the invariant test goes red on the current Ramp bundle, green after the fix; no `runId/sectionId/reason=` in any rendered field across Ramp+Fathom+Plain.

### WS2 — Presentation Model + honest tiers + elastic sections — *Phase 1*
- Build the RPM (§3). Classify each section; collapse `mostly-gap`/`unavailable` to one panel; generalize `isOfferDiagnosticHonestlyUnavailable()` to VoC / Demand / BuyerICP. Demand's four peer gap-notes → one "Evidence status" panel.
- Mark availability tier honestly instead of padding to keep the rollup looking full (removes the `run-section.ts:2320` pressure at the presentation layer).
- **Proof:** value-read — no section renders more than one gap panel; gap/apology hit-count per section drops from 71/37/… to ≤ a single status line.

### WS3 — Evidence calibration: **classify, don't lower** — *Phase 2*
- **Keep the 6/3 VoC floor.** Add (a) a **directional-evidence lane** (below-floor but real quotes shown as directional buyer signal, cleanly), (b) **sharper candidate classification** — clean first-person verbatim vs listing-page paraphrase/DOM chrome (`voice-of-customer-candidates.ts`, `quote-admission.ts`), (c) **per-review permalink capture** so real Trustpilot/Capterra quotes carry a proper citation and can count toward the *full* floor honestly (`reviews.ts` resolver already does this for G2).
- **Market:** magnitude-word containment — `numberVariants` maps `$13B ↔ $13 billion` (`source-liveness.ts`), so true in-corpus facts stop being dropped. **`verification_tier` honesty** so rich sections aren't mislabeled `insufficient` (cascades into the coverage eval).
- **Guardrail:** directional ≠ invented; laundered/paraphrase evidence stays rejected. No floor is lowered.
- **Proof:** value-read — VoC surfaces the real onboarding/credit-limit/freemium themes (which exist in today's reject pile) as ranked pain themes; Market shows a real size + forces read.

### WS4 — Truth-in-presentation — *Phase 3*
- Prose may not claim more than the structured evidence supports (extend the verifier from anti-*fabrication* to anti-*overselling*): Competitor "29 creatives / verified" must reconcile with `verifiedCount`.
- Operator inputs (CAC/target/LTV) labeled as **inputs**, never sold as findings; promote genuinely-derived insight (the $12K–$30K real-CAC reframe) to the headline.
- Paid Media: `evidencePack.status` drives display — `status:"gap"` rows render as hypotheses, not confident allocations (`paid-media-plan.tsx:169/212`); fix the review-claims-vs-body mismatch (`$153/day`, `positioningPaidMediaPlan.json:182/201`).
- **Proof:** value-read — no prose claim contradicts its own structured data; capstone clearly separates "grounded" from "hypothesis to test."

### WS5 — The two real acquisition gaps + the timeout — *Phase 4*
- **Demand (non-branded discovery):** wire `getMostValuableKeywords(domain)` + `getRelatedKeywords(seed)` (already in `spyfu-client.ts:541/564`) as lab tools; relax/parametrize the `MIN_SEARCH_VOLUME=50` discovery floor. Discover the non-branded universe with volumes + CPC; never fabricate.
- **BuyerICP:** acquire *external* buyers with firmographics/trigger/channel (G2 reviewer identities, case-study champions) — not event-speaker rosters that return the subject's own execs. Fix the timeout (solo `/rerun-section` path completes in 2–3 min; or raise the section's deadline share).
- **Proof:** value-read — Demand ships ≥10 non-branded terms with volume+CPC; BuyerICP ships ≥3 targetable external personas.

---

## 5. Sequencing

| Phase | Workstreams | Why |
|---|---|---|
| **1** | WS1 + WS2 | Pure presentation. No new data. Biggest readability jump — kills the slop you feel. |
| **2** | WS3 | Admit real evidence honestly (directional lane + classify + Market/tier). |
| **3** | WS4 | Truth-alignment + the capstone. |
| **4** | WS5 | The only genuine "go get more data" work. |

Phase 1 alone should lift the average materially because most of the 3.6/10 is slop *presentation*, not missing content.

---

## 5b. Grounded execution queue — DECIDED 2026-06-17

The 6-section grounding swarm (verified against the real Ramp artifacts + current code, guardrail CLEAN) refined WS3/WS4/WS5 into concrete, file-anchored fixes. Full detail + per-section root causes + 8/10 value-read targets: **`docs/reports/2026-06-17-content-quality-grounding.md`**.

**Key realization:** the value is mostly *suppressed, not missing* — 4 of 6 fixes need **zero new data**. Only BuyerICP + Demand need genuine new acquisition.

**Leverage order (locked):**
1. **Paid Media Fix A** (WS4) — renderer reads `evidencePack.status`; gap rows → "hypothesis to test", not allocations. Zero new data, capstone, biggest trust delta.
2. **VoC permalinks** (WS3/5) — Trustpilot/TrustRadius per-review resolver → 31 clean quotes pass admission honestly. *Needs one live-scrape probe first.*
3. **Market containment** (WS3) — bidirectional + whitespace-insensitive magnitude → real $13B/70k facts stop being dropped. Zero new data.
4. **Competitor prose** (WS4) — single-writer clamps ad-evidence prose down to `verifiedCount`. Zero new data; raises the bar.
5. **BuyerICP** (WS5) — budget-aware prepass + solo rerun (timeout) **+** subject-own-exec rejection **+** the second source-liveness persona-grounding gate, all in one wave (Fix A alone leaves it ~1/10).
6. **Demand discovery** (WS5) — wire the 4 dead-code SpyFu discovery endpoints as a `keyword_discovery` tool. Most code; depends on SpyFu coverage.

WS2 RPM (render-time `toPresentationModel` at the `pickPositioningTypedArtifact` seam — `audit-reader-shell.tsx:1001`) continues as the parallel readability floor. atom-A = pure classifier (`docs/handoffs/2026-06-17-ws2-atom-A-rpm-core.codex.md`).

---

## 6. Execution model & measurement

- **Execution:** Claude authors specs + reviews diffs; Codex executes (it volunteered for these exact files). Isolated file-based handoffs; verify every diff against the spec.
- **The bar (measurement):** re-run **Ramp + Fathom + Plain**; value-read every section to **≥ 8 on the human read**. Internal evals stay as liar-catcher floors only.
- **Guardrails:** never weaken a gate to pass; never fabricate; classify + present honestly; truthfulness over green rollups.

---

## Appendix — key file map

| Concern | Path |
|---|---|
| Telemetry source | `src/lib/lab-engine/agents/run-section.ts:9431` (+ `:529`, `:2546`); concat `:1437/1447/1477` |
| Always-commit pressure | `run-section.ts:2320`, deadline fallback `:2612` |
| Scrub belt (backstop) | `src/components/research-v2/primitives/reader-text.ts` |
| Renderers | `src/components/research-v2/section-renderers/{voice-of-customer,demand-intent,paid-media-plan,offer-diagnostic,competitor-landscape,buyer-icp,market-category}.tsx` |
| Unavailable-precedent | `offer-diagnostic.tsx:44` (`isOfferDiagnosticHonestlyUnavailable`) |
| VoC floor / gate | `voice-of-customer-floors.ts:15/18`, `voice-of-customer-candidates.ts:363`, `verification/quote-admission.ts` |
| Per-review permalinks | `src/lib/lab-engine/agents/tools/reviews.ts:159-217` |
| Market containment | `verification/source-liveness.ts` (`numberVariants`) |
| Demand discovery | `tools/keyword-volume.ts`, `spyfu-client.ts:541/564/68` |
| `upgradedMarkdown` (do NOT render — ungrounded prose, by design) | `research-v2/commit-patch.ts:165` |
