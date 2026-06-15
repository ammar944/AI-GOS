# AI-GOS Architecture Grill — GO / NO-GO VERDICT
**Date:** 2026-06-15 · **Branch:** `refactor/architecture-deepening` · **Method:** live runs + DB inspection + local-agent judge (no code-reading-as-proof)

> Mandate (from `docs/handoffs/2026-06-15-architecture-grill-handoff.md`): prove the critical path works on real subjects end-to-end, or find exactly where it is a facade, and render a verdict the owner can trust. Diagnose, don't fix. Reward finding breakage.

---

## TL;DR — **CONDITIONAL GO (rebuild the finish + chat layers, keep the engine)**

This is **not** a uniform facade, and it is **not** a months-long trap. The expensive, hard-to-build parts — research generation, evidence/provenance machinery, honest-confidence tiers, and the value-read judge — are **real and trustworthy**. The blockers are concentrated in **three structural seams** that are code-level, subject-independent, and bounded:

1. **The pipeline can't finish autonomously** — editorial/decode floors turn into `status=error` instead of degrading to honest-gap (R1 violation), so sections die and the media plan stays permanently locked.
2. **The chat control plane is blind to the research** — the chat's artifact snapshot reports "no sections" even when sections are committed, and multi-turn chat 400s by construction. The vNext headline feature does not function live.
3. **The Brief→Plan chain doesn't exist** — the media plan never reads the strategy brief (0 references in code).

None of these require rebuilding the engine. They are the same two policies the prior failure-theory already named (**R1 tolerant-in/strict-out**, **R2 client-language projection**) plus a chat-state wiring fix and a brief→plan data dependency. **Executable in a bounded effort — weeks, not months — IF the work targets the finish/compose/chat seams and not the (already-sound) evidence core.**

**Autonomy number: 0 of 1 fresh runs reached a buyer-usable deliverable with zero intervention** — and on the *easiest* (evidence-rich) subject. The blocking failure modes are structural and code-confirmed, so more subjects would reproduce them (see §Limitations).

---

## Live artifacts behind this verdict
| Run | Subject | What it was used for |
|---|---|---|
| `09f694d7-8424-4cd5-87c4-8c855a3a763d` | airtable.com (FRESH, this session) | Autonomy, decode boundary, section quality, chat-blindness, fact-bodyguard (partial) |
| `d838ed4e-7cc7-43ef-ad94-dea30abdb1c2` | airtable.com (baseline, contaminated `strategyBrief`) | Judge-loop proof, fact-bodyguard (full deliverable), chat multi-turn, Mr-Dre rerun |
| Judge subagents (3 independent local agents) | — | Value-read verdicts (0d proof + fresh + baseline) |

---

## 1. Per-subsystem verdict

| Subsystem | Verdict | Live evidence |
|---|---|---|
| **Corpus (Perplexity `deepResearchProgram`)** | **GO** | Fresh run corpus completed in 3.6 min, real Airtable sources; no failures. |
| **Generation (DeepSeek sections)** | **GO (quality) / PARTIAL (reliability)** | When a section commits it is honest + trustworthy: judge scored Competitor 7/10 (49 sources, verified LinkedIn ad-library permalinks), Market 6/10, BuyerICP 6/10, Demand 6/10 — **no fabrication**. BUT 4 of 6 sections errored on first fan-out attempt (see Autonomy). |
| **Evidence / provenance / honest-tier rail** | **GO** | Sections self-label `insufficient`/`needs_review` accurately (Demand confidence 0.25 shown to user). The `$45.4B Integrate.io` fabrication from the baseline was **ABSENT** on the fresh run — TAM left "evidence gap: directional only — not computed" rather than guessed. Pricing laundering fixed (baseline PRICING check PASS, 0 third-party rows). |
| **Judge (local-agent value-read = "done")** | **GO** | 0d gate proven end-to-end: independent agent read schema + full deliverable, wrote schema-valid `verdict.json`, `--gate` returned exit 2 (<9). Caught Fellow contamination verbatim, non-summing budget, thin-provenance market size. Three independent judges converged. **This is the bar mechanism and it works.** |
| **Fact bodyguard (deterministic gate `zz-buyer-eval`)** | **PARTIAL — has teeth, but defects still ship** | Catches real lies: CASCADE FAIL (`audienceDailySum=$634` vs `dailySpend=$833`), DENY-LIST 198 internal-vocab leaks on baseline / 34 on fresh (`[unverified]`, `corpus`, `displayable`, `verifiedCount`, `internalDetail`), QUOTES 0 permalinks, MEMO blocked. But these are *detected and shipped anyway*, not blocked pre-commit. |
| **Chat control plane (`/api/research-v2/chat` orchestrator)** | **FACADE** | On BOTH the complete baseline (8 sections) and the fresh run (4 committed sections), the chat says *"No sections are complete… the artifact is brand new… all six sections empty."* The chat's artifact snapshot is disconnected from committed sections. PLUS multi-turn chat 400s: route schema (`route.ts:34-47`) is text-only and rejects the assistant's own tool-call parts on turn 2. |
| **Brief composer (`strategy-brief/composer.ts`)** | **PARTIAL (untestable live)** | Model id `claude-sonnet-4-5` is live (200). But it could not be exercised through chat because the orchestrator never sees committed sections to draft from ("nothing to draft"). Offline tests pass; live path blocked upstream by the chat-snapshot bug. |
| **Brief→Plan chain** | **FACADE (structural)** | `paid-media-plan.ts` has **zero** references to `strategyBrief` — the plan does not read/conform to the brief. The headline "Brief → Media Plan" product is two disconnected artifacts. |
| **Edit / rerun loop (`rerunSection`/`editClaim`/`editNarrative`)** | **FACADE** | The chat can't dispatch these (blind snapshot + turn-2 400). The raw `/api/research-v2/rerun-section` route accepts the call but a no-refinement rerun of a previously-**complete** section (Competitor, 78 sources) **regressed it to `error` — "Structured output timed out after 90448ms"** (Probe 5). Rerun can destroy working content, not just drift it. |

---

## 2. Probe-by-probe (the executable evidence)

### Probe 1 — AUTONOMY → **FAIL (facade)**
Fresh run `09f694d7` (airtable.com, an *evidence-rich* subject — the easy case). Corpus OK (3.6m). Six-section fan-out: **4 of 6 errored on the first attempt**, three distinct modes:
- **Deadline starvation under fan-out** (recoverable): `Market` + `OfferDiagnostic` — *"deadline-aware structured fallback skipped: remaining section budget {69736,130203}ms below fallback floor 260000ms."* Auto-rescue re-queues all errored sections *simultaneously* → re-creates the same contention.
- **Shape-decode death** (R1): `VoiceOfCustomer` — *"switchingStories.stories: Invalid input: expected array, received undefined"*, then *"keyFindings: Too small: expected array to have >=1 items."* "Tolerant decode" (WP1) still rejects.
- **Editorial-floor death** (R1): `BuyerICP` *"personas[0].name must be a named person… generic role/segment labels do not qualify"* (recovered on retry); `OfferDiagnostic` *"offerMarketFit.proofPoints: have 2, need >=3"* (sticky — never recovered).

**The run never reached 6/6.** VoC + OfferDiagnostic auto-rescue churned for the **full ~35-min run-deadline window** (re-erroring repeatedly, no per-zone attempt cap), burning DeepSeek the whole time, then settled at `status=error` when the run deadline expired. The reader shows **"Paid Media Plan: Locked until 6/6"** — the headline deliverable is permanently unreachable. *No engineer intervention would help short of a code change — exactly the "complete ≠ usable / <50% novel completion" trap.*

### Probe 7 — DECODE BOUNDARY / R1 → **FAIL**
Across the fresh run: shape-decode deaths (VoC array fields) AND editorial-floor deaths (proofPoints≥3, keyFindings≥1, persona-name) both surface as `status=error`. The R1 policy ("decode never dies on shape; editorial floors degrade to honest-gap; `status=error` reserved for infra") is **not** in force. WP1 tolerant-decode is partial at best.

### Probe 2 — QUALITY → **PARTIAL (good when complete, but never completes)**
Independent judge on the fresh run: **5/10, wouldPay=no**, but explicitly *"a can't-finish problem, not a produces-junk problem."* The 4 completed sections are honest and trustworthy (6–7/10, **no fabrication**, honest gaps labeled, cross-section numbers reconcile). Capped only by incompleteness (no VoC, no OfferDiagnostic, no media plan, no memo). Baseline judge: 3/10 (Fellow contamination + non-summing budget) — but that run is the polluted fixture.

### Probe 3 — CHAT-EDIT LOOP → **FAIL (facade) on all four steps**
Driven live in the actual chat panel (signed-in CDP Chrome, 1480px so the `lg:block` aside renders):
1. *"Draft the strategy brief"* → *"No sections have been run yet — the artifact is empty."* (on a run with committed sections). **Brief never drafts.**
2. *Reframe* → HTTP 400 `Invalid chat request body … expected "text"`. **Turn 2 dies.**
3. *Rerun VoC* → same 400. **Never dispatches.**
4. *Surgical edit* → same 400. **Never reaches the artifact.**
Root causes (code-confirmed): (a) the chat route's artifact snapshot does not reflect committed sections; (b) `chatMessageSchema` accepts only `{type:"text"}` parts, so resending the assistant's tool-call message fails Zod. The vNext "chat as control plane" is non-functional live.

### Probe 4 — FACT BODYGUARD → **PARTIAL (teeth, but ships defects)**
`zz-buyer-eval` is a genuine machine-checkable gate. Baseline: CASCADE FAIL (budget sub-totals $634 ≠ $833/day), DENY-LIST 198 leaks, QUOTES 0 permalinks, PROJECTIONS/CHANNELS/MEMO FAIL → 1/10. Fresh: 34 deny-list leaks, PRICING regressed to 3 third-party rows. The checks *detect* the lies; the pipeline still *commits* them (the gate is a scorer, not a pre-commit blocker yet).

### Probe 6 — BRIEF→PLAN COHERENCE → **FAIL (structural)**
`grep strategyBrief` in `paid-media-plan.ts` = **0**. The plan is generated without the brief as input. Defect #3 confirmed.

### Probe 5 — MR DRE REGRESSION → **WORSE than defect #5: rerun *destroyed* a working section**
A no-refinement rerun of the baseline's `positioningCompetitorLandscape` (previously `complete`, 78 sources) was accepted (`/api/research-v2/rerun-section` → new `section_run_id a73c6b80`, full DeepSeek regenerate, not a scoped patch — defect #5 confirmed). It sat `queued` ~4 min (starved behind the fresh run's infinite auto-rescue — a real fair-scheduling gap), then **failed: `"Structured output timed out after 90448ms."`** A previously-good section went **complete → error** on a no-op rerun. This violates the autonomy invariant "a rerun converges to same-or-better" — the edit/rerun loop can *regress working content to a hard error*, not merely drift it. Heavy sections (78 sources) blow the 90s structured-output deadline on regenerate.

---

## 3. The six handoff defects — live confirmation
| # | Claim | Live result |
|---|---|---|
| 1 | Budget cascade reconciler has no teeth → incoherent budgets ship | **CONFIRMED** — buyer-eval CASCADE FAIL on baseline ($634 vs $833/day); judge independently caught it. |
| 2 | Polling race: chat-drafted brief never surfaces without reload | **MOOT/SUPERSEDED** — brief never drafts at all (chat blind to sections), so the race is downstream of a bigger break. |
| 3 | Brief→Plan half-built (plan ignores brief) | **CONFIRMED** — 0 `strategyBrief` refs in `paid-media-plan.ts`. |
| 4 | Brief support gate checks ref existence, not containment | **CONFIRMED-ADJACENT** — DENY-LIST + uncontained citations (SpyFu homepage root, self-reported scale) ship; containment not enforced. |
| 5 | `rerunSection` is full regenerate, not scoped patch | **CONFIRMED (route + behavior)** — rerun route returns a new `section_run_id` and full lab dispatch; auto-rescue retries produced wholly-regenerated section bodies. (Quantified drift pending the in-flight rerun diff.) |
| 6 | `benchmark-prior` provenance class absent; hybrid numbers half-built | **CONFIRMED** — provenance enum is `derived`/`user-supplied` only; no `benchmark-prior`. |

---

## 4. The honest call — executable, or a trap?

**Executable, in a bounded effort — provided the work is aimed correctly.** The evidence shows the system is a *strong research engine wearing a broken finish-and-edit shell*, not a hollow demo. The three blockers are all "internal control state leaking out as the product" — the exact disease the prior failure-theory diagnosed — and they are code-local:

**The three structural reasons it isn't shippable today (not symptom lists):**
1. **Floors are fused decode+editorial contracts that hard-fail** instead of degrading. One section short a proof point or a quote array kills the section and locks the whole deliverable. (R1 not installed.)
2. **The chat control plane is wired to an empty view of the run** and can't accept its own multi-turn history. The headline interaction model is disconnected at the data layer. (State-wiring + schema bug.)
3. **The media plan — the product — is not derived from the brief**, so even when both exist they're incoherent by construction. (Missing data dependency.)

If a future "build phase" instead chases the *symptoms* (patch this enum, add that field) it WILL become the months-long whack-a-mole the owner fears — there are ~350 such floors. The leverage is the *policies*, not the instances.

## 5. Shortest credible path (ordered, load-bearing per live evidence)
1. **R1 finish layer** (unblocks Probe 1/7, the autonomy number): one tolerant-decode + degrade-to-honest-gap layer at the section commit boundary. Editorial floors (proofPoints, keyFindings, persona-name, VoC quote counts) → repair-once-then-honest-gap, never `status=error`. `status=error` reserved for infra only. Fix the fan-out deadline budgeting so sections don't starve, and cap/queue auto-rescue (no infinite churn).
2. **Chat state wiring** (unblocks the entire vNext core): make the chat route's artifact snapshot read the actual committed sections for the run, and make `chatMessageSchema` accept/sanitize assistant tool-call parts (or have the panel send text-only history). Without this, *nothing* in the chat-edit loop works.
3. **Brief→Plan dependency** (makes the product coherent): feed the committed `strategyBrief` into `paid-media-plan` generation and conform the plan to it; reconcile the budget cascade in code (defect #1) so sub-totals sum.
4. **Promote the fact-bodyguard from scorer to pre-commit gate** for the 4 surviving checks (arithmetic, URL containment, quote permalink, deny-list) so detected lies are dropped, not shipped. R2 deny-list: stop internal vocab (`[unverified]`, `corpus`, `displayable`, `verifiedCount`, `internalDetail`) reaching the client surface.
5. *(Then, and only then)* re-run the 3-subject autonomy + judge gauntlet; "done" = the local-agent judge ≥8–9 on fresh subjects with the deterministic gate green.

This corrects, where the live grill contradicts it, `docs/handoffs/2026-06-14-vnext-wave1-codex.md`: the #1 priority is **chat-state wiring + R1 finish**, because the chat-edit loop (Wave 1's premise) is currently dead at the data layer, not merely rough.

---

## Limitations (so the owner can calibrate trust in THIS verdict)
- **Autonomy N=1 live.** I drove one fresh run to the section stage; it never completed. I did not complete S-poor/S-mid runs (each is ~30–40 min and the first never terminated). The blocking modes (editorial-floor errors, chat-blindness, brief→plan gap) are **code-confirmed and subject-independent**, so additional subjects would near-certainly reproduce them — but a 2–3 subject sweep is the obvious confirmation before the build phase.
- **Harness debt surfaced (NOT architecture).** The 2026-06-11 E2E driver was stale (form added required fields it didn't fill; a junk URL field blocked submit). I rebuilt the wizard fillers (`zz-e2e-fill-wizard-v2.mjs`, `-neutral.mjs`) and the CDP bootstrap (`zz-e2e-bootstrap.sh`). The app's form validation and submit→orchestrate path are CORRECT. None of this was scored against the architecture.
- **Provider Step-Zero.** Anthropic key was dead (401) at session start; the owner swapped it mid-session and it is now live (verified 200 on `claude-sonnet-4-6/4-5`, `claude-opus-4-5/4-6`, `claude-haiku-4-5`). So chat/brief failures here are NOT dead-key artifacts. (Latent: `company-intel/run-company-research.ts:58` uses dead id `claude-sonnet-4.6` — outside graded path.)
- The baseline `d838ed4e` has a known leaked "Fellow" `strategyBrief`; it was used only for harness/judge proof and full-deliverable fact-bodyguard, never as a clean content baseline.

---

## BUILD PROGRESS (post-verdict, same session)

The owner authorized moving grill → build. Fixes are landing in the working tree (uncommitted), each implement→verify via dynamic workflow, with **live re-probes** (not just mocked tests).

### Wave 1 — DONE + live-proven
| Fix | Status | Proof |
|---|---|---|
| **api-doctor stale model id** (`zz-api-doctor.mjs`) | ✅ landed | `claude-3-5-haiku-latest`→`claude-haiku-4-5-20251001`; now reports `Anthropic ok (200)`. |
| **Cap auto-rescue** (`run-lab-section/route.ts`) | ✅ landed + unit-verified | Per-zone rescue capped to ≤1/run via DB-derived `research_section_runs` count (no migration). Adversarial verifier confirmed against the actual RPC SQL. 13/13 tests. |
| **Chat-state wiring** (`chat/route.ts`) | ✅ landed + **LIVE-PROVEN** | (a) snapshot now loads committed sections **server-side** (real cause was a stale `journey_sessions.research_results` JSONB column, not the request body); (b) message schema accepts assistant tool-call parts. **Live on fresh run `09f694d7`:** chat now lists the 4 completed sections (was "artifact is empty"); multi-turn turn 2 no longer 400s; the orchestrator fired `draftStrategyBrief` from the committed sections. |
| Full gate | ✅ | `npx tsc --noEmit` 0 errors; full vitest suite **2263 passed / 0 failed**. |

**Net effect:** the **Chat control plane** verdict moves **FACADE → working** — the orchestrator now sees committed sections, multi-turn holds, and it correctly dispatches `draftStrategyBrief`. One downstream link remains, and it's *gated by the autonomy blocker, not the chat*: the strategy-brief route returns **409 "All six committed positioning sections need markdown"** (`strategy-brief/route.ts:450`) until a run reaches 6/6. So the brief composes only once Wave 2 (R1) lets runs finish. The chat→brief→plan chain is now correctly wired; it's waiting on completion, not on the chat.

### Wave 2 — R1 finish-layer: DONE + unit-verified + PARTIALLY live-proven
Made `tolerant-decode` default missing required arrays to `[]`, added VoC decode-shortfall salvage, and made OfferDiagnostic editorial-floor failures inject schema-valid `blockGap`s (real rows preserved) → honest-gap commit + `insufficient` tier instead of `status=error`. `assertSectionArtifactPersistable` still throws on genuine envelope/structural corruption. **tsc 0; 752 tests pass; adversarial verifier confirmed no garbage commits.**
- **Live proof (rerun the 2 stuck zones on `09f694d7`):** **VoiceOfCustomer RECOVERED → `complete`** (was dying on a decode/editorial floor) — R1 confirmed working live for its target failure mode. Auto-rescue cap also confirmed (no churn).

### AUTONOMY FACADE → WORKING (live-proven)
After Wave 1 + R1 + the two deadline fixes (fallback fires with available budget; deadline-exhaustion → honest-gap commit), run `09f694d7` — stuck at 4/6 all session, media plan "Locked until 6/6" — reached **6/6 + paid-media plan complete + strategy brief composing**, live:
```
OfferD: complete (REAL content, insufficient tier)  →  6/6  →  PaidMedia: queued → complete
```
The "complete ≠ usable / sections can't finish" facade is closed. OfferDiagnostic — stuck all session — committed **real content** once the deadline-fallback fix let its fallback fire with available budget (verified: 42KB body, funnelDiagnosis/proofPoints/redFlags, no honest-gap markers). The deadline honest-gap skeleton is the verified safety-net for the residual "can't generate at all" case (all 6 skeletons pass the real registry schema+minimums; not triggered on this run). Committed: `9b4103a0` (deadline honest-gap), `93ea2ed8` (fallback budget), `0aa5e77b` (R1), `a85dfd16` (chat+rescue), `5e79bf14` (verdict+harness). All tsc 0; full suites green.

### FINAL GRADE — complete deliverable, two independent judges CONVERGED: **6/10, would-pay with-caveats**
Up from a deliverable that **could not complete at all** (locked 4/6) and the contaminated baseline's 3/10. Deterministic buyer-eval independently: **6/10 (cap 7)**, up from 1/10.
- **Integrity is real:** NO fabrication — the `$45.4B Integrate.io` TAM is **gone** (honestly "not computed"); no fake quotes; no invented creatives. Cross-section numbers reconcile (one CAC, one price, one branded floor, keyword cluster sums).
- **Media-plan math now PASSES the cascade** (audience dailies sum to $833 = daily spend; phase sub-totals reconcile) — defect #1 resolved on this run.
- **The path from 6 → 8–9 (both judges' levers, concrete):**
  1. **Media-plan funnel is hollow/circular** (#1 lever): trials are back-solved from the target CAC ($17,500/$3,000=5) instead of computed via CPC→clicks→CVR; it projects ~6–13 trials/mo against the brief's own ~120/mo goal with the ~18× shortfall **unflagged**. Compute trials from spend→demand and surface the true implied CAC + the goal gap.
  2. **VoC = 3/10** — a raw Zod decoder stack-trace leaks into 3 client-facing fields; 0 quotes (honest gap, but no VoC value). Sanitize.
  3. **R2 client-language** (deny-list 56): internal vocab (`internalDetail`, "displayable creatives", "quarantinedCount=12", `verifiedCount`, bare-domain SpyFu cites) on the client surface.
  4. **VoC→PaidMedia laundering**: paid-media cites VoC review candidates the VoC gate explicitly *rejected*.
  5. **Provenance lie**: `projectedCount` tagged `user-supplied` when it's budget÷CAC derived; and the executive **thesis errored** (buyer-eval MEMO fail) — compose it always.

### Wave 2b — the deadline boundary (detail)
After R1, `positioningOfferDiagnostic` no longer dies on the `proofPoints≥3` floor — it now dies on a **different, deeper** cause: `deadline-aware structured fallback skipped: remaining section budget 134381ms below fallback floor 260000ms` (`section-agent.ts:1553`). Root cause: the structured fallback is itself a full ~240s call (floor = `getStructuredOutputTimeoutMs` 240s + 20s emit = 260s; `run-section.ts:522`), so first-attempt (240s) + fallback (260s) ≈ 500s **cannot fit inside a section's deadline** (prod Vercel `maxDuration=300`). When the first attempt fails on a slow section, there's no room for the fallback → it **errors** instead of degrading. **Fix = apply the R1 doctrine to the deadline boundary:** a deadline-skip should commit a from-scratch honest-gap artifact (insufficient tier, "section exceeded time budget — rerun to retry") so the run still reaches 6/6, rather than `status=error` locking the whole deliverable. This is a distinct, non-trivial fix (per-section minimal gap skeletons) — pending owner direction.
