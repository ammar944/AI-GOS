# START HERE — Section-Build Session (climb the 7 sections to their honest ceilings)

You are a fresh session picking up a fully-prepared build. Everything you need is committed. Read this top-to-bottom, then execute the loop. **Do not re-plan — the planning, proof, and adversarial vetting are done.** Your job is disciplined execution.

## Mission
Move each of the 7 positioning sections to its **honest, data-supported ceiling** with **zero laundering**. The bar is real reader value (an offline agent reading the deck and saying "yeah, this is genuinely good"), not an eval score. Honest targets:
Demand **8**, Competitor/VoC/Market/Offer/PaidMedia **8**, BuyerICP **7.5**. (9 everywhere = fabrication. An honest 8 with amber gaps beats a laundered 9.)

## Current state (verified)
- Branch `refactor/architecture-deepening`, HEAD `3402ba93`. The tree also holds in-flight Phase 4 lanes — **do NOT `git stash`/`reset`/`worktree` the tree**; commit only the files you change per section.
- **Phase 0 is committed (`6d8ce161`)** and gives you the two things that make this safe:
  - **Terminator/bar:** `scripts/zz-value-read.mjs` — reads a harness run dir, computes a deterministic ceiling per section (absent→2, refuted/gate-violation→4, unsupported/thin/no-verifier→7, earned-clean→9) and combines `finalScore = min(LLM-value-read, ceiling)`. Calibrated to a human read. Tests: `npm run test:gate` (113 pass).
  - **Brake:** `scripts/zz-full-run-harness.ts` defaults to **corpus-only (free)**; paid tools require `--live` and are budget-gated (`tmp/zz-full-run/_budget.json`, `--max-runs`/`--max-spend-usd`) + a `tmp/zz-full-run/_ABORT` kill-file.

## Read these next, in order
1. **`docs/plans/2026-06-21-section-build-handoff.md`** — THE build package. Per-item: line-exact root cause, additive-safe edits, tests (incl. regressions to keep green), verify commands, fabrication risks, shared-file conflicts, build order. 6/8 READY, 2 NEEDS-REVISION.
2. **`docs/plans/2026-06-20-seven-section-honest-ceiling-build-plan.md`** — the §4.x narrative detail + the **[PHASE 0 EMPIRICAL CORRECTIONS]** block (read it: the "$13B fabrication trap" was DEBUNKED — it's corpus-grounded; the §4.1 key is index-less `body.competitorSet.competitors.url`).
3. `scripts/zz-value-read.mjs` header comment (how the gate works) and, if present locally, `docs/handoffs/2026-06-21-autonomous-execution-readiness-verdict.md` (gitignored — local only; the GO verdict + guardrails).

## Build order (do NOT reorder)
keystone → **Competitor** (the unblocker) → VoC → Market → BuyerICP → Offer → Demand → PaidMedia (last).
Rationale: the keystone touches the most-shared files (`run-section.ts`, `verdict-hero.tsx`) so land it first and rebase everything onto it; Competitor's one-line claim-extractor fix unblocks both itself and PaidMedia's competitor rows; PaidMedia consumes all upstream, so it goes last.

## The execution loop (one item at a time)
For each item, in order:
1. **Read its spec** in `2026-06-21-section-build-handoff.md`. Apply the edits exactly — they are additive-safe and line-anchored. Verify each file path with `sed`/`find` before editing (a wrong path = a fix that silently never fires; this already bit us once).
2. **Offline gate (must pass before any paid call):**
   ```bash
   npx tsc --noEmit          # 0 non-ignored errors (ignore known openrouter/chat-blueprint errors)
   npm run test:run -- <the spec's named test files>
   npm run test:gate         # keep the value-read gate green (113+)
   ```
3. **One paid validation run (budget-gated, no loops):**
   ```bash
   npx tsx scripts/zz-full-run-harness.ts --live --sections <sectionId> --max-runs 1
   ```
   (Use the section's real id, e.g. `positioningCompetitorLandscape`. The keystone has no section of its own — validate it via a downstream section run.)
4. **Value-read the result:**
   ```bash
   node scripts/zz-value-read.mjs <runId>            # GATHER -> value-read/{facts.json,prompt.txt}
   # read value-read/prompt.txt, write value-read/verdict.json (shape: --print-schema), then:
   node scripts/zz-value-read.mjs <runId> --gate     # finalScore = min(llm, ceiling)
   ```
   On a single-section run the other 6 sections are absent (ceiling 2) — that's expected; read the **target section's `final` row**, not the overall pass/fail. Run a full `--live` deck (`--sections` omitted) at milestones (after every ~3 sections) for the integrated gate.
5. **Done** when: the target section's `finalScore ≥ its honest target`, **no `fabrication-cap` (🔴) fired**, and all offline tests green. Then `git add <only the files you changed>` and commit with a one-line message.

## Guardrails (non-negotiable)
- **Honest ceilings, ZERO laundering.** An honest gap (`blockGap` + reason + sourcing plan) is GOOD — never invent a number/quote/person not traceable to the frozen corpus or a fetched source. Every relaxed floor must stay gated on real evidence (ledger / verifier-supported).
- **Additive-safe only.** Schema changes are optional fields. Never break a prior committed artifact, an existing test (especially the `section-registry` allowedTools contract — order-sensitive), or a renderer. Renderers degrade gaps to `GapNote`, no tier chrome.
- **Paid-API discipline.** One `--live` run at a time. No retry loops. If you legitimately need more than `--max-runs`, raise the flag deliberately; never bypass the brake. Drop `tmp/zz-full-run/_ABORT` to hard-halt.
- **The deterministic floor is BLIND to prose fabrication, wrong-company quote attribution, and token-subset entity matches** — the LLM value-read is the only net there. If a section's score jumps **without new structured evidence**, STOP and flag it for human review rather than committing.
- `research-worker/` cannot import from `src/lib/`.

## Gotchas
- The Read tool may truncate to line 1 (claude-mem hook). If so, read via `sed -n '<a>,<b>p' <file>`. Edit still works once a file is registered (a 1-line Read registers it).
- **2 items are NEEDS-REVISION** (Demand, PaidMedia). Read their spec caveats first: Demand's renderer edits are INVISIBLE to the value-read (it scores the body JSON, not React) — the only mover is body-legible provenance via the SKILL; Demand's honest target is **8, not 9** (9 needs out-of-scope SpyFu corroboration — do not fake it).
- Competitor + Demand failed even corpus-only on a malformed URL `https://en.wikipedia.org/wiki/Ramp_(company` (missing close paren). The Competitor spec's claim-extractor exemption fixes the gate side; watch for the URL-truncation in the model output too.
- Repo has a benign `git gc` warning (too many loose objects) — pre-existing, ignore or `git prune` once.

## First action
Start the **keystone** (Phase-1 confidence-split + valueReadiness): the `run-section.ts` `deriveValueReadiness` helper + write, the `trust-tier.ts` accessor, the optional `verdict-hero.tsx` prop wired into all 7 renderers, then its tests. Spec is the first entry in `2026-06-21-section-build-handoff.md`. Land it, prove tsc + tests green, commit. Then Competitor.
