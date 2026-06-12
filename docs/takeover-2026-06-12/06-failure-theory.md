# Failure Theory — why AI-GOS is 5.5/10 after major work (2026-06-12, evening session)

Grounded in: the decode-boundary census (7 decode entry points, ~358 kill-capable constraints, 8
snapped), the post-takeover pipeline trace (file:line verified on the current branch), run f3993043
artifacts + screenshots, the SaaSLaunch template mapping, AI SDK course + Vercel skill doctrine.
Baseline on this branch: tsc 0, full test suite green, build untested-this-session.

## The one-sentence theory

The system was built as a **truth pipeline** and graded as one ("did sections commit, are claims
supported"), but it is sold as a **deliverable product** — and every remaining defect is a place
where an *internal control state* (decode rejection, cascade violation, contradiction flag, job
lifecycle) is allowed to become the *product* instead of being absorbed by code and projected into
client language.

## What the mid-run code fixes actually proved

Run f3993043 "completed end-to-end" only because an engineer shipped five code patches while it ran.
That is not a flaky-run anecdote; it is a measurement:

1. **Shape failures are deterministic, so retry is not a recovery path.** Given the same subject,
   the model re-chooses the same illegal shape; only a code change unblocks. Every "Rerun" button
   on a contract-killed section is a placebo.
2. **Defect discovery is serialized at ~1 per run.** Each kill masks everything behind it. With
   ~358 unsnapped kill-capable constraints (census: ~42 closed enums, ~15 array bounds, ~100
   string floors, ~200 required fields, 1 superRefine) and a new subject rolling new dice each run,
   whack-a-mole cannot converge. The 8 hand-fixes in 2 days are not progress toward zero; they are
   the constant drip rate.
3. **Autonomous completion probability on a novel subject is well under 50%** — which is the single
   hardest gate between this and a ChatGPT/Manus-class experience, where "give it a URL and walk
   away" is the entire promise.

## Can the research be trusted end to end?

Split the question by layer — the answer inverts halfway down the stack:

| Layer | Trustworthy? | Evidence |
|---|---|---|
| Acquisition (SpyFu, ad libraries, liveness probes) | **Yes** | instrument-labeled, code-owned permalinks; the competitor-ad path is the house style guide |
| Claims & provenance (post-W1/W3) | **Mostly yes** | marker splicing deleted; review layer cannot write; provenance gate + earned `user-supplied`; honest tiers persist |
| Plan numbers | **Honest but mutilated** | cascade validated in code, but violations DROP values (audience split → "unknown"); CAC bridge regex missed the KPI unit so projections carry no counts |
| Synthesis/memo | **No** | contradiction gate blocks its own memo; 2 of 3 contradiction kinds are born `resolved:false, severity:critical` with one generic resolution string; fact-ledger keying buckets "50%" under customer-count |
| Presentation | **No** | first screen on cold load = stale "Queued" chrome; blocked memo renders repair instructions as "The Three Moves" (same sentence ×3, empty PROVEN BY chips) over a raw fact ledger; share-link creation 404s; deck UGC card renders empty |

So: the *findings* are now largely trustable; the *deliverable* is not trustable to exist, compose,
or render without an engineer. Trust failure migrated from "it lies" (fixed) to "it can't finish
and can't speak client" (open). That migration is real progress — and it is why the score moved
4.5 → 5.5 instead of more: the bar's Buyer Test caps any run the buyer must re-derive at 6.

## Are the visible blockers the path to 9/10 — or symptoms?

Symptoms. The final report's blocker list (decode snaps, blocked-memo UX, cascade repair, CAC
units, cold-load, share) is accurate but under-theorized: all six are instances of exactly **two
missing design rules**:

- **R1 — Tolerant-in, strict-out.** Code owns every boundary where model output enters the system:
  decode never dies on shape (snap enums, clamp ceilings, drop bad rows, alias drifted keys — all
  recorded as telemetry); editorial floors are quality shortfalls routed to repair-then-honest-gap,
  never `status=error`. Arithmetic (cascade, counts, projections) is computed/repaired by code from
  the model's *ratios and words*, never asserted by the model and never "dropped" when wrong.
- **R2 — Every internal state has a client-language projection, or it does not render.** Blocked,
  queued-after-terminal, contradiction bookkeeping, gap sentinels, repair instructions, empty
  structural cards: none of these are client states. The client surface renders decisions, numbers
  in one of the four provenance states, and honest gaps written for a buyer.

Fixing the six items as listed ≈ 7/10. Installing R1+R2 as policies (with the six items as their
first consumers + regression fixtures) is the actual path to 9 — because it also covers the next
350 landmines and the next internal state nobody has leaked yet.

## Which kind of problem is this?

- **Prompt problem? No.** Prompts are strategist-grade; the copy on the deck proves it. Adding
  prompt rules *increases* dependence on model compliance — the disease, not the cure.
- **Schema problem? Yes, as contract design.** Body schemas fuse two roles: decode contract
  (tolerate the writer) and editorial contract (enforce the bar). Fused, every editorial wish
  becomes a landmine. Split them: decode-tolerant parse → strict editorial validation → gap/repair
  routing.
- **Evidence problem? No.** The evidence machinery is the best part of the system post-W1/W3.
- **Orchestration problem? Partially.** Topology (route fan-out + Supabase + polling) is fine and
  proven; what's missing is failure-state management: shape failures must be non-terminal by
  construction. (Vercel Queues-style durability is a later nice-to-have, not the binding constraint.)
- **Product-shape problem? Yes.** The memo is the first screen and it is allowed not to ship.
  The media plan is the product; its math must therefore be code-guaranteed usable, not honestly
  absent.
- **UI problem? At the seams.** The deck is ~98% template-faithful; what leaks is fallback surfaces
  (empty UGC card, blocked memo, Queued chrome) — i.e., R2 violations, not styling.

## Where the system depends on model compliance where code should own the contract

1. Decode shape — exact enum spellings, array bounds, required keys (~358 sites; 8 snapped).
2. Budget cascade arithmetic — reconciliation lives in prompt text; code only detects + drops.
3. KPI unit phrasing — projections fire only if the model words the KPI to match one regex.
4. Memo existence — model + scanner must produce zero unresolved criticals or no memo ships
   (2 of 3 contradiction kinds *cannot* be born resolved).
5. (Closed: creative counts, review-layer rewrites, marker splicing — code owns these now.)

## Where the system detects instead of preventing/repairing

| Mechanism | Today | Should be |
|---|---|---|
| Zod decode | detect → die | snap/clamp/drop-row + record (prevent) |
| Cascade validator | detect → drop values | deterministic repair (recompute, rescale ratios, clamp) + 'derived' provenance |
| Contradiction gate | detect → refuse to ship memo | auto-reconcile (winner rules, strike inherited claims from brief input) → compose memo with client-language caveats |
| Editorial floors (validateMinimums) | detect → repair → can still error | repair once → honest gap commit; `status=error` reserved for infra |
| Verifier (evidence-support) | detect → honestly label | **correct as-is post-W1** — keep |

## "Pipeline complete" vs "buyer usable"

"Complete" today asserts: the job reached a terminal DB status. It asserts nothing the buyer pays
for. The proof: a run can be Complete with a blocked memo, a $0-information channel table
(pre-fix), projections without counts, an unshareable share link, and a cold load that says
"Queued". The missing piece is a **machine-checkable Buyer Test** — a deterministic eval that walks
a run's persisted artifacts and scores the bar: cascade reconciles to the dollar; projections carry
counts; ≥3 substantive channel recommendations; ≥4 paste-ready angles; memo present and
non-blocked; deny-list greps zero; share round-trip 200; snap telemetry present but client-invisible.
That script — not job status — becomes the definition of done, in CI and after every E2E.

## Confirmed against the persisted run (DB inspection, f3993043)

- **The 5 "critical contradictions" are ONE fact**: a "$20–$45" stripped-claim ping-ponging
  between BuyerICP↔OfferDiagnostic, counted 5× (no dedup on identical descriptions). The memo
  blocked the whole first screen over one price-range string. The "Three Moves" persisted as three
  copies of the same repair stub with internal QA fields (`cost: "analysis rework"`,
  `provesWrongIf: {metric: "contradiction status"}`) in the client-shipped thesis.
- **Fact-ledger winner rules are actively wrong where they fire**: `numeric:acv` resolved to $12M
  (an MRR reading); `numeric:monthly-budget` resolved to $3,000 (a CAC benchmark) while the brief's
  user-supplied budget is $25,000. Winner selection lacks unit-classing and provenance ranking.
- **Money has two writers**: audience budgets render as display strings ($500/$200/$125/$208,
  summing $1,033/day vs the $833/day cascade) while their numeric values were reconciler-dropped to
  provenance "unknown" — and the engine's own feasibility audit re-read the same strings as
  *monthly*. Display strings must be regenerated from values, never model-authored beside them.
- **Projections project nothing**: 3 rows with `kpi "Qualified Business-plan trial"`,
  `phaseMonthlyBudgetValue 25000`, `kpiCostProvenance "unknown"` — the CAC bridge regex
  (`sign-ups?|customers?|acquisitions?`) didn't match the KPI unit, so no counts exist at all.
- **VoC floor inverts honesty**: 5 usable quote candidates across 2 domains were ALL discarded
  because the floor wanted 6 across 3 — zero quotes shipped. Floors must degrade (ship what was
  found + honest shortfall), not nuke.
- **Evidence laundering upstream**: 8/9 competitor pricing rows cite two competitors' own
  listicles (zite.com / zapier.com "airtable alternatives" posts), not vendor pricing pages.
- **Share 404 root cause**: the run's `journey_sessions` row exists and the exact lookup succeeds
  for the owning user — the 404 was an auth-identity mismatch (Share clicked from a different Clerk
  user than the run owner), with the 404 path unlogged.
- **Tier reality**: 5 of 7 sections persisted `insufficient` (VoC confidence 0.0). The honest rail
  is accurate; quality improvement now depends on repair/evidence, not on labeling.
- Buyer verdict from the artifacts (independent inspector): *"a buyer could steal the thesis, but
  couldn't hand any table to a client or set a campaign live from it."* That is 5.5/10 in one line.

## The 9/10 definition, amended

`02-bar.md` stands. Four additions make it a product bar rather than a report bar:

1. **Autonomy invariant.** A fresh subject URL completes to a buyer-usable deliverable with zero
   engineer intervention; shape variance cannot kill a section (only infra can); a rerun of any
   section converges to same-or-better. Target: ≥95% of fresh runs.
2. **The memo always ships.** "Blocked" is an internal state. Unresolved synthesis tension ships as
   client-language caveats inside the memo, not instead of it.
3. **Cold trust surface.** Cold load of a finished run shows the finished product (no transient
   Queued chrome); the share link works; no structurally-empty cards anywhere in the deck.
4. **The Buyer Test is executable.** `scripts/` carries the eval; a run is "done" only when it
   passes; the proof run's score is the product's score.

## Intervention level (Phase 5 decision)

**Chosen: B + D(composition) + E(failure-management only) + F(surface) — via the two policies.**

- **B — section contracts redesigned** as decode-tolerant/strict-editorial split (R1). Not 8
  hand-payloads of `.catch()` — one tolerant-decode layer mounted at the existing single normalizer
  dispatch + the 7 decode entry points, with per-enum fallback declarations and snap telemetry.
- **D — media plan is the product, finished**: deck stays; memo-first composition guaranteed
  (always-ship memo); plan math code-guaranteed usable (cascade repair, projections counts).
- **E — orchestration failure semantics only**: shape failures non-terminal; rerun convergence;
  no queue/topology migration in this pass.
- **F — reader/product surface**: client-language fallbacks everywhere (R2), cold-load fix, share
  fix, deck structural-empty fixes.
- **Not A** (final-mile alone leaves ~350 landmines and the memo gate).
- **Not C** (evidence architecture is sound; it was re-routed, not rebuilt, in W1/W3 — keep).

## Execution shape (Phase 6 preview)

Five Codex work packages, each with spec → diff → my review → gates (tsc/scoped tests/build):
WP1 tolerant decode (R1 core) · WP2 deterministic plan math (cascade repair, CAC unit classes,
counts) · WP3 memo always ships (auto-reconcile + client-language composition + ledger keying fix)
· WP4 surface integrity (cold-load, share, UGC/static cards, stat-tile empties, count single-writer)
· WP5 buyer-eval gate (`scripts/zz-buyer-eval.mjs`). WP1∥WP3∥WP4 (disjoint), WP2 after WP1,
WP5 parallel. Proof: fresh E2E + screenshots + buyer-eval score + self-judged rubric score.
