# AIGOS — Supervised-Pilot Master Plan

**Date:** 2026-06-22 · **Branch:** `refactor/architecture-deepening` · **Freeze baseline:** `8a21aa1b` (clean tree)
**Status:** PLAN ONLY — execution model not yet chosen (owner: "plan only for now").
**Provenance:** 20-agent codebase panel (`wf_17427e96-1af`) → adversarial verify → completeness critic; PLUS a 3-model fusion panel (Opus 4.8 / GPT-5.5 / GLM-5.2). Raw outputs in `docs/fusion/2026-06-22-*`. This doc is the reconciliation.

---

## OWNER STEER — 2026-06-22 (post-review; overrides where it conflicts below)

1. **De-prioritize the heavy in-app eval/floor machinery for now.** GLM-5.2 is good enough at not hallucinating *raw numbers* to lean on. The "real eval" = a lightweight **evaluation AGENT** that reads the finished research and judges "this looks good." → Phase B shrinks: NO deterministic-floor freeze/fixtures/committable-gate rewire as the bar; an eval-agent review replaces it. (CAVEAT, evidence-based — see below: GLM's clean record is on *numbers*, not on *quote/attribution provenance*, where this session's own A/B caught it laundering 13 quotes + inventing 3 bidder names. The eval agent must check provenance on quotes + named attributions or those slip.)
2. **Share policy = BLOCK** until the **whole deck incl. the media plan** is generated. (Q4 answered.)
3. **Test subjects = more niche SaaS** (not Ramp). Offline. Primary goal of the first pass = **inspect CORPUS data-quality per subject** — what input/data are we actually getting — *then* finalize the 6 sections (schemas + skills) from what the data supports.
4. **Media-plan structure is LOCKED to the current template** (`paid-media-plan.ts` Lean Media Plan). Do NOT change it. If GLM-agentic **can't fill the existing template** (fulfillment gaps), report them — don't redesign the template.
5. Budget (Q3): no number set yet; corpus-quality pass runs cheap-first, full section runs gated on a cap.

---

## 0. North Star

Two internal operators run **real client subjects** through the app and trust the 7-section deck + paid-media plan enough to use it in **real ad-budget client work**. Supervised, not self-serve. Mechanism: a **GLM-5.2 agentic writer** guarded by a **thin deterministic floor**. Value-first — the floor is a liar-catcher, never scrub-to-pass.

**Model (locked):** GLM-5.2 via Ollama now → provision a proper **z.ai/BigModel GLM API key** for prod.

---

## 1. The honest base — what is proven vs NOT

| | |
|---|---|
| **PROVEN** | GLM-agentic scores **8/8 blind** (our `zz-value-read` rubric) on **Voice-of-Customer + Demand-Intent**, vs the boxed-DeepSeek app's 3 and 1. A thin floor lifts floor-capped output to a clean 8/8. |
| **NOT proven** | (a) **5 of 7 sections** — Market, BuyerICP, Competitor, Offer, PaidMedia. (b) **ANY non-Ramp subject** — n=1, 43+ runs on one company, and Ramp is the *easiest* subject (a heavily-documented unicorn). (c) **z.ai endpoint parity** — the proof ran on Ollama `glm-5.2:cloud`, a different transport + model-id than z.ai `glm-5.2`. (d) **The floor as DETERMINISTIC code** — the proven-8 keystone repair used an *LLM recompute*. (e) **The TYPED body** — the proof scored *prose*; production must commit a typed `ArtifactEnvelope`. (f) **The full operator browser flow E2E** — never completed on any subject. |

Everything downstream rests on (a)–(f). The first-draft plan committed to a spine rebuild before retiring any of them. This plan does not.

---

## 2. The reframes the panels forced (delta from the first-draft plan)

The first-draft plan was *"well-engineered for the wrong risk"* — it hardens the rail while the **engine** is proven on one easy subject and 2 of 7 sections. The completeness critic + all three fusion models (independently, blind to each other) converged on the corrections below.

### R1 — Prove the writer generalizes BEFORE rebuilding the engine
Cross-subject validation (all 7 sections, 3 diverse non-Ramp subjects) moves from **late-P3 to the FRONT**. You are about to strangle a **14,971-line** file toward an architecture proven on n=1. If GLM scores 4/8 on a data-sparse subject, the whole target is invalid — find out for the price of a few runs, not a spine rebuild. **The strangle moves to LAST and becomes optional-for-pilot.** (Unanimous: Opus, GPT-5.5, GLM.)

### R2 — A purely deterministic floor cannot hold 8/8; split CORRECTION from VERIFICATION
The proven-8 came from **recomputing and re-displaying a ratio** — an act of *generation/judgment*. A strip-only floor either deletes the ratio (section drops below 8 → "swiss-cheese deck", GLM) or lets the wrong ratio survive (fabrication). Resolution (unanimous):
- **Correction is the WRITER's job** — derive every ratio *by construction* from fetched leaf-numerics; never assert a ratio it didn't compute. Optionally a small **source-constrained repair pass** rewrites unsupported/overbroad claims *citing the tool payload*, BEFORE the floor.
- **The floor is a DETERMINISTIC checker** — recompute the displayed ratio from the *originating tool's returned payload*; strip-or-gap on mismatch.
- **Do NOT make the floor itself an LLM** — that re-introduces laundering (the thing the architecture exists to kill). Architecture: **agentic writer (correct-by-construction) → [optional source-constrained repair] → deterministic floor → operator review.**

### R3 — The gates guard NUMBERS; the trust risk is QUALITATIVE (biggest under-build)
Every gate — floor, ratio-recompute, leaf-numeric, the 12 verifiers — operates on *checkable atoms* (numbers, quotes, URLs). But operator trust lives in the **strategic assertion** ("the wedge is bottom-up adoption", "the champion is the CFO", "the buyer's anxiety is audit-readiness"). A confident, well-sourced, **wrong** positioning thesis survives the entire floor untouched — and one caught miss on a subject the operator *knows* collapses trust globally. **`value-read` measures QUALITY, not TRUTH** — an 8/8 and a wrong-about-the-client thesis are fully compatible. → Ship a **grounded-vs-inferred signal per load-bearing claim** (the writer tags each claim's grounding: corpus span / tool payload / inference; render inference visibly distinct) + an operator **edit/override/lock** path. This is the actual product for a supervised pilot.

### R4 — Real clients aren't Ramp: the "Empty-Payload" fabrication is the likeliest silent failure
Real client URLs (SMB, niche B2B, obscure domains) hit paywalls / anti-bot / zero-data. GLM, to fulfill its tool-calling schema, **fills the blanks with plausible data**. The floor checks contradictions *against the returned payload* — an **empty payload yields nothing to strip** → a fully-fabricated section about a company with no online footprint. → The floor MUST cross-check every load-bearing **leaf-numeric AND quote against the originating tool's RETURNED payload**; a section built on empty/thin tool returns is flagged **source-thin**, never committed clean. (Extends critic finding #3 to its worst case.) Corollary: the **frozen corpus is a silent single point of failure** outside the entire gate stack — garbage-in is invisible to a floor that trusts the corpus as ground truth. Validate **corpus quality per subject**.

### R5 — Right-size the safety machinery for 2 operators
- **Cut the parallel-diff strangler.** Diffing every commit-vs-absent decision against a *known-bad* 1/8 old path tells you nothing ("it diverges" is the goal). Build the new path as a **sidecar**, turn it on, leave the old quarantined; a human reading **3 paired decks** is higher-signal and catches the qualitative-trust problem an automated decision-diff never will.
- **Drop the SHA byte-freeze of 12 actively-refactored verifier files** (process theater for a 2-person team). Instead: freeze the **SCORER (`zz-value-read.mjs`) + the fabrication FIXTURES** (the acceptance oracle that genuinely drifts — and today the `synthetic-fabricated-quote` fixture *passes while the fabricated quote survives*), and keep the **per-guard regression-snapshot suite** (edit a guard → its case goes red = Chesterton's-fence protection without the byte-freeze).
- **Trust-TIER UX is product-grade** — ship a **binary grounded/inferred** signal + markdown/simple export, not graduated tiers.

### Unique adds the panel surfaced (fold in)
- **Operator/client INTAKE (GPT-5.5):** operators know facts the public web doesn't — budget ceiling, CAC/margin, geos, excluded verticals, sales motion, compliance, current campaigns, founder preferences. A fully-sourced deck can be **unusable**. Add a pre-run intake; every section either respects those facts or **flags conflict**. (Ignoring operator context is self-serve thinking — the pilot is the perfect time to use it.)
- **Deck-level COHERENCE (GPT-5.5):** the 7 sections must AGREE (ICP ↔ pain ↔ demand ↔ competitor ↔ offer ↔ paid-media). Section-level 8/8 ≠ a coherent deck. PaidMedia especially **launders any upstream error into a budget recommendation operators act on with real money.**
- **LATENCY (GLM):** ~4 APIs × 7 sections ≈ 10–15 min/deck → operators click *regenerate* mid-run → state destruction. Measure it; make rerun non-destructive; show progress.
- **Human acceptance criteria (GPT-5.5 / Opus):** "would use in client work after bounded edits" is the real bar, NOT rubric 8/8. Pin **≥1 human-graded anchor per section** against the agent score — the go/no-go is currently an unvalidated LLM-grades-LLM loop with no inter-rater check.
- **Richer section states (GPT-5.5 / GLM):** `committed/absent` is too thin — operators need **approved / needs-review / source-thin / blocked**. "Absent only on schema death" is right for *never killing on one bad number*, but a stripped key metric can leave a coherent argument as a broken fragment → needs-review, not silently-committed.

### One architectural question left open (E)
Both Opus and GPT-5.5 noted the writer holds too much power (discover + interpret + structure + defend in one pass) and floated **acquisition agents → normalized evidence/fact pack → section writers → deterministic compiler** as a stronger long-run shape. **Decision for the pilot: keep "agentic writer + thin floor" — it's proven 8/8 — but treat the corpus-quality-per-subject check (R4) as the cheap proxy for the "normalized fact pack" idea.** Re-evaluate the fuller decomposition only if Phase A shows cross-subject generation is unreliable.

---

## 3. Re-sequenced phases

> Principle: **prove → trust-surface → pilot → (only then) integrate.** Cheapest de-risking first; the 14,971-line strangle last and optional.

### Phase A — Prove the writer generalizes *(de-risk first; gates everything)*
**Goal:** Establish that GLM-agentic produces a trustworthy full 7-section deck on real, non-Ramp subjects — as a **sidecar** (`scripts/zz-agentic-section.ts` generalized), bypassing `run-section.ts` entirely, NO strangle.
**Firewall:** Owner provisions the z.ai key + picks the 3 pilot subjects + sets the live-run budget ceiling.
- **(S) z.ai GLM key + live parity probe** — `curl` z.ai `glm-5.2` returns 200; one section (VoC/Demand) runs end-to-end via z.ai, tool-fetches cleanly, blind value-read **≥8**. *Accept:* the proven 8/8 survives the Ollama→z.ai endpoint+model-id swap (extend `isDeepSeekModel`-style provider branching if z.ai needs thinking-disable / a structured mode). **This is the literal first live action.**
- **(M) Generalize the agentic writer to all 7 sections (sidecar)** — section-generic GLM loop reads `PreparedSectionContext`; tool subset ⊆ each section's `allowedTools`; preserve the **deterministic persona/segment grounding prepass** for BuyerICP (`run-section.ts` ~L1269/L11556) and the **PaidMedia synthesis-mode** (consumes committed upstream artifacts). *Accept:* each of the 7 assembles a valid `(prompt, tool-subset, bodySchema)` triple; BuyerICP + PaidMedia each get their **own** validation, not a shared one.
- **(M) Empty-payload + corpus-quality guard** — instrument every tool call; a tool returning empty/thin marks dependent claims **source-thin**; a per-subject corpus-quality check (source count, density) gates the run. *Accept:* on a deliberately data-sparse subject, sections built on empty returns are flagged source-thin, NOT committed clean (the GLM "Empty-Payload" test).
- **(S) Measure cost + latency per section/deck** — record $ and wall-clock for one full agentic deck. *Accept:* a per-section $/latency table exists before any sweep; if a section >~3 min, note it for the progress-UX requirement.
- **(M) Cross-subject sweep on 3 diverse non-Ramp subjects** — all 7 sections; blind value-read each. *Accept:* a per-section finalScore table across 3 subjects; **this is the architecture go/no-go.** If multiple sections land <8 on data-sparse subjects, STOP and revisit before Phase B.

### Phase B — The floor + the acceptance oracle *(writer-corrects / floor-verifies)*
**Goal:** Make the thin floor real and deterministic, pin the acceptance oracle, resolve the P0/P2 circular dependency (extract the strip chain *with* the floor build — it is not a Phase-0 precondition).
**Firewall:** Owner approves the floor semantics (strip vs gap; what is load-bearing) and the writer-corrects-vs-repair-pass choice.
- **(M) Freeze the SCORER + fabrication FIXTURES; assert post-strip deltas** — add `countRefuted`/`deterministicCeiling` band tests for `zz-value-read.mjs`; each `synthetic-fabricated-*` fixture asserts the fabrication is **STRIPPED** (today it passes while the quote survives) and a clean variant passes unchanged. *Accept:* removing a strip turns a fixture red; the scorer's bands are fixture-pinned.
- **(M) Per-guard regression-snapshot suite** — one run-id-cited fixture per verifier guard (`8081e646`, `c9bc2056`, `b0d12b45`, `d838ed4e`, `73dfbc0d`, …); neutering a guard's core logic turns exactly its case red. *Accept:* ≥12 guards covered; replaces the byte-freeze as the Chesterton's-fence protection.
- **(L) Build `core/source-floor.ts` — deterministic checker** — extract+unify the existing live strips (`numeric-coherence.ts`, `quote-admission.ts`, `provenance-gate.ts` — they already exist and run live; the floor must CALL the frozen modules, not reimplement) + ADD: **ratio recompute from the originating tool payload**, **leaf-numeric-vs-returned-payload** (R4), **quote source-class** via `inferEvidencePoolEntryKind` (already in `run-section.ts` ~L958, unconsumed for quotes). Strip/relabel/gap, **never throw/absent.** *Accept:* on typed fabricated fixtures it relabels/strips leaving a documented gap with 0 unsupported load-bearing claims; a clean fixture passes unchanged; the empty-payload case is caught.
- **(M) Writer corrects-by-construction (+ optional repair pass)** — the agentic writer derives ratios from fetched numerics and tags each load-bearing claim's grounding (corpus span / tool payload / inference). *Accept:* a draft's ratios trace to operands in the transcript; a synthesized quote is *relabeled* into a directional field, not dropped (loses no 8/8 content).
- **(M) Rewire `committable-gate.ts` — strip-and-commit, not absent** — today `evidenceShortfall` (one unsupported load-bearing claim) routes to non-committable → absent. Rewire so the floor's strip/relabel keeps the section **committable/gapped (marker visible)**; **ONLY schema/parse death → non-committable**; a **REFUTED** claim holds the value-read ceiling (≠ clean). **Do NOT blanket `verdict→gapped`** — that IS the quarantined `gateRefutedOnly` laundering path (BuyerICP-only today). *Accept:* unit tests for each branch; `committable-gate.test.ts` green.
- **(L) Re-prove the floor on the RENDERED TYPED body** — VoC + Demand typed bodies blind value-read **≥8** with 0 unsupported. *Accept:* the typed schema has a home for a hedged/directional claim (`sourceClass` enum / `directionalSignals` block) AND the frozen claim-extractor still *sees* claims in that new field (resolve the freeze-vs-schema-evolution collision the critic flagged). **If <8 here, the deterministic-floor design needs rework — this is the highest-risk checkpoint.**

### Phase C — Operator trust surface *(the actual pilot product)*
**Goal:** Make the deck trustworthy, finishable, and correctable for a supervised operator.
**Firewall:** Owner approves the trust copy/tone on the 3 cross-subject decks (must read honest, not a wall-of-failures) + the share policy (block vs warn on partial deck).
- **(M) Grounded-vs-inferred signal per load-bearing claim** — render inference-claims visibly distinct from grounded ones (binary, not tiers); wire `deriveTrustTier` (exists, **zero render callers** today) at the section level + the section navigator. *Accept:* an operator can see at a glance which claims to trust-but-verify.
- **(S) Operator/client INTAKE** — a small pre-run form for budget/CAC/geo/excluded-verticals/compliance/current-campaigns; threaded into every section as a highest-priority constraint. *Accept:* a section that conflicts with an intake fact **flags the conflict** rather than silently contradicting it.
- **(M) Deck-level coherence check** — a cross-section pass flags contradictions (ICP ↔ pain ↔ demand ↔ competitor ↔ offer ↔ paid-media); PaidMedia rows trace to a `sourceSection`. *Accept:* a deliberately incoherent fixture deck is flagged.
- **(L) Make rerun + auto-rescue non-destructive** — today the on-conflict migration wipes `markdown=null`, fired by the manual Rerun button AND the client auto-retry AND the server auto-rescue. *Accept:* rerunning/auto-rescuing a complete section that then fails leaves the original visible+usable (integration test on ALL three paths); rescue-cap still fires.
- **(M) Operator edit/override/annotate + richer states** — operators can correct/lock a section; states = approved / needs-review / source-thin / blocked. *Accept:* a locked section survives a rerun; a corrected claim persists.
- **(M) Export + gate partial-share** — markdown/print export of the full deck; **Share is blocked or warned below 6/6 + PaidMedia** (today a 3/6 deck is shareable and looks finished); raw `confidence` stays OUT of exported markdown (trust signal is the tier, per the 2026-06-11 decision). *Accept:* sharing an incomplete deck is prevented/stamped.

### Phase D — Pilot *(operators run 3 real subjects)*
**Goal:** The actual supervised pilot.
**Firewall:** Owner-run; this is the decision gate for the whole effort.
- **(M) Full operator browser flow E2E on the 3 subjects** — corpus → onboarding → fan-out → reader → edit/approve → export/share. *Accept:* completes on all 3 (the two fragile spots: fire-and-forget orchestrate kickoff, queued-forever fallback).
- **(M) Human acceptance anchor** — each operator reads ≥1 deck, scores it, compared to the agent's value-read. *Accept:* the human bar ("would use after bounded edits") and the agent score are reconciled per section type; trust the SAME signal the gate uses.
- **(S) Trust-breaker log** — record every wrong claim / required edit / unusable PaidMedia assumption. *Accept:* a punch-list that drives the next iteration.

### Phase E — Integrate *(post-pilot, optional)*
**Goal:** Only after the pilot proves the architecture is worth keeping: strangle `run-section.ts` and retire the old path.
- Build `core/{agentic-section, finalize-section, section-readiness}.ts`; preserve `factStore`/`evidencePool` write-through (8 downstream readers incl. strategy-brief/executive-brief — must write from the new path's first run); per-extraction **characterization tests** (snapshot each moved function's output before/after — these pieces are NOT in `verification/` and not frozen); retire old resolution blocks + content-route-to-absent throws only after clean human-read paired decks on ≥3 subjects.

---

## 4. The lean critical path

1. **z.ai parity** (first live action) →
2. **All-7 agentic writer as sidecar** (no strangle) →
3. **Empty-payload + corpus-quality guard** + **cost/latency measure** →
4. **Cross-subject sweep on 3 real subjects** ← *architecture go/no-go* →
5. **Writer corrects-by-construction + deterministic verify-and-strip floor** (incl. leaf-numeric + empty-payload provenance) + **freeze scorer/fixtures** →
6. **Grounded-vs-inferred signal + operator intake + edit/lock + non-destructive rerun + export** →
7. **Human-read paired decks on the 3 subjects → operators sign off.**

Notably *off* the critical path: the SHA byte-freeze, the parallel-diff strangler, trust tiers, and the full 14,971-line strangle (Phase E, post-pilot).

---

## 5. Top risks (merged)

| Risk | Mitigation |
|---|---|
| **Confident wrong QUALITATIVE thesis** survives every numeric gate; one caught miss collapses trust globally | Grounded-vs-inferred signal (R3) + operator edit/override; human acceptance anchor; deck-coherence check |
| **Empty-payload fabrication** on data-sparse real clients | Floor cross-checks leaf-numerics/quotes vs *returned* tool payload; source-thin flag; per-subject corpus-quality gate (R4) |
| **Deterministic floor lands <8** (proven-8 used LLM recompute) | Writer corrects-by-construction; Phase-B re-prove on typed body is the explicit checkpoint — if <8, rework before Phase C |
| **Ramp-only overfit** (n=1, 2/7 sections, easiest subject) | Cross-subject sweep is the FIRST gate (R1), not the last; 3 diverse incl. ≥1 data-thin |
| **z.ai ≠ Ollama parity** + **no quality fallback** (DeepSeek = the broken 1/8 path) | z.ai parity is the first live action; pre-flight the writer before each live deck; accept that availability-loss = pause, not ship-DeepSeek |
| **Latency** (10–15 min/deck) → mid-run regenerate → state loss | Measure it; non-destructive rerun; progress UX; consider per-section streaming commit |
| **PaidMedia launders upstream errors into a budget rec** acted on with real money | Own validation gate; rows trace to `sourceSection`; deck-coherence check; bidder attributions hedged |
| **Scorer drift** silently re-bands every score | Freeze `zz-value-read.mjs` bands + fixtures (Phase B, first task) |

---

## 6. Open questions for the owner *(genuine decisions; the plan branches on these)*

1. **Floor architecture (ratify R2):** confirm **writer corrects-by-construction + a small source-constrained repair pass + deterministic verify-and-strip floor** — i.e. the floor is NOT a pure stripper and NOT an LLM. *(All 3 fusion models + reasoning converged here; the first-draft "pure deterministic strip-or-gap" cannot hold 8/8.)*
2. **Pilot subjects:** pick the 3 diverse non-Ramp subjects. Recommended: **real prospective-client subjects** spanning data-rich/data-sparse + 3 buyer types, none Ramp-shaped (e.g. a thin-footprint SMB, a reviews-rich SaaS, a dev-infra/API product). A sub-8 on a real prospect teaches more than a synthetic pick.
3. **Live-run budget ceiling:** Phase-A sweep = 3 corpus-gens + 3 full 7-section decks (Competitor alone burns 6+24 ad-reserved lookups across 4 paid ad APIs). The harness default (~$6 / 3 runs) is insufficient. Set `--max-spend-usd` deliberately. *(Hard precondition — without it, the cross-subject gate can't run.)*
4. **Share policy:** does Share **block** on a partial deck (<6/6+PaidMedia) or **warn+stamp**? Ad-budget stakes argue for block.
5. **Confirm "absent only on schema death"** with the richer state model (approved / needs-review / source-thin / blocked) — a stripped key metric becomes needs-review, not silently-committed.

---

## 7. Parked for later (explicitly out of scope for the pilot)

- Team multi-tenant / auth / accounts — pilot is 2 internal operators.
- Broad infra/deploy hardening (no CI exists; gates run locally), Vercel/worker autoscale.
- Marketing surface / self-serve onboarding.
- Rename the `deepseek-ollama` provider enum (cosmetic; `metadata.modelId` already reports `glm-5.2` honestly).
- Source-class badges on quotes / share-token revoke+expire / per-section quick-action chat affordances (P2 polish).
- Sonnet comparison arm (only if GLM shows a cross-subject arithmetic weakness).
- The fuller "acquisition agents → normalized fact pack → writers → deterministic compiler" re-decomposition (§2.E) — revisit only if Phase A shows generation is unreliable.
- Supabase→Railway DB migration — PARKED per standing decision.
- **The full `run-section.ts` strangle + parallel-diff** — Phase E, *after* the pilot proves the architecture.

---

## 8. Provenance

- **Codebase panel** (`wf_17427e96-1af`, 20 agents, 2.5M tokens): 9 file-grounded audits → adversarial verify → lead-architect synthesis → completeness critic. Full result: `docs/fusion/2026-06-22-codebase-panel-result.json`.
- **Fusion panel** (Opus 4.8 / GPT-5.5 / GLM-5.2, blind, parallel): `docs/fusion/2026-06-22-pilot-roadmap-{opus48.jsonl,gpt55.txt,glm52.txt}`.
- **Key spot-checks that held** (critic, vs real code): `core/` does not exist; `run-section.ts` = 14,971 lines; `committable-gate` `evidenceShortfall→non-committable` is real; `verifierDowngradeMode` is BuyerICP-only; the `synthetic-fabricated-quote` fixture passes while the quote survives; `deriveTrustTier` has zero render callers; the GLM provider-string mismatch (`providerOptions` undefined) is real.
