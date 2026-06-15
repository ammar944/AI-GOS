# vNext Execution Plan + Quality Bar — validated direction, judge-as-gate, Codex fan-out

- **Status:** ACTIVE — validated and approved by Ammar 2026-06-14. Supersedes the open "fresh E2E" items in the takeover/9-of-10 threads as the execution rail for the brief+plan spine.
- **Branch:** `refactor/architecture-deepening` (146 commits ahead of main).
- **Scope decision (Ammar 2026-06-14):** v1 user = **internal SaaSLaunch team first**; ambition = **brief+plan spine only** (slices 1–3; defer the 12-tab playbook); quality and slice-2/3 run **in parallel**; quality bar = **LLM value-read + a small fact bodyguard** (see §3).
- **Grounding:** 6-lane validation workflow (`wf_4fe81f9f-deb`, 617k tokens) over the vNext direction, the 5.8/10 judge verdict, the failure theory (`docs/takeover-2026-06-12/06-failure-theory.md`), the 9/10 bar (`docs/2026-06-11-research-product-9of10-bar.md`), live code inspection, an empirical E2E probe, and Codex CLI capability research.

---

## 1. Validation verdict — the vision is sound; the path to 9/10 is smaller than it looks

All four validation lanes returned **sound-with-risks at high confidence**. The vNext direction (chat control plane; Offer & Angle Brief → Media Plan; report demoted to commissioned evidence; hybrid numbers with provenance) is the best-reasoned and best-grounded work in the project. Evidence, not vibes: the real bluops client deliverable shipped its "Strategic Research Blueprint" tab **empty** while every strategy-derived tab was dense; the Offer & Angle Brief schema is a faithful 1:1 reverse-engineering of the real artifact; the DialHawk transcript is a captured instance of the exact target workflow (zero web searches; all judgment + conflict-detection + surgical edits).

**The key reframe:** the **5.8/10 score is an enforcement gap, not a missing-feature gap.** The machinery to hit 9/10 mostly exists — feasibility math (`closeFunnelMath`, `maxAbsorbableSpend` in `synthesis/feasibility.ts`), the fact-ledger (`synthesis/fact-ledger.ts`), the contradiction sweep (`synthesis/contradictions.ts`), source-liveness, the provenance gate — but it runs behind the post-run executive-brief route inside an `after()` block whose own comment says it **"never blocks anything."** The gates are wired as observers, not gates. Closing 5.8→9 is mostly *wiring + reject paths + killing bad gates*, not greenfield.

## 2. The six concrete defects validation found (the payoff of validating-before-building)

| # | Severity | Defect | Fix | Owner lane |
|---|----------|--------|-----|-----------|
| 1 | 🔴 critical | Budget-cascade reconciler (`paid-media-plan.ts:1664`) only fires on **optional** `*Value` numeric siblings. The judge's failing run had display-strings-only → reconciler returns `[]` → passes ungated. Defeatable by the exact omission that defeated the judge. | Make siblings mandatory for any non-`unknown` money display, or parse the value from the display string at decode so the cascade always has numbers. | L1 |
| 2 | 🟠 high | **Polling race:** on a completed run, the brief commits to DB but never surfaces in the reader without a manual reload (`use-audit-state.ts` stops polling at all-terminal; async `after()` compose lands after the single refresh). A reload during acceptance testing *masks* it. | Add a `strategyBrief` grace-poll mirroring `briefPendingGrace`; verify in Gate 2 without reloading. | L4 |
| 3 | 🟠 high | The headline value — the **Brief→Media-Plan chain — is half-built**. `grep strategyBrief` in `paid-media-plan.ts` = 0 hits. Slice 1 is a demo beside an unchanged pipeline, not the product. | Slice 2 closes the chain (media-gate binds buyer numbers; plan conformance-checked vs brief). | L3 |
| 4 | 🟠 high | Brief composes from the 5.8/10 foundation through `validateStrategyBriefSupport`, which checks source-ref **existence** but not content **containment** → can launder section fabrication into the source-of-truth artifact with a *higher* trust signal. | Pull a containment/provenance fact-check forward onto the brief before any external use. | L4 |
| 5 | 🟠 high | `rerunSection({zone,refinement})` is a **full from-scratch regenerate** (the Mr Dre 16–27%-corruption pattern), scoped-patch-protected only for the brief, not the 6 sections. The deciding regression probe **doesn't exist**. | Build + run the before/after untouched-content diff probe in Gate 2; if drift is high, route reframes through scoped patches. | L5/Gate2 |
| 6 | 🟡 med | The `benchmark-prior` provenance class (the hybrid-numbers linchpin) **doesn't exist in code**. | Add it to the provenance enum + the evidence-support carve-out (extends WP7 `54ca498b`). | L3 |

## 3. The quality bar — judge-as-gate + a fact bodyguard (Ammar decision 2026-06-14)

**The definition of done is the LLM value-read**: a strong model (subagent / Codex / Claude) reads a run's **inputs** (URL, corpus, onboarding/brief) and **outputs** (brief + 6 sections + media plan) and renders a holistic verdict — *"from these inputs, is this genuinely sharp, trustworthy, and valuable GTM research a buyer would pay for?"* That verdict, not job status and not the pile of deterministic gates, is what ships-gate. Justification: the failure theory found the "verified" gate was substring co-occurrence scoring VoC **0.98 on its worst content** (trust inverted); `learned-patterns.md` is a graveyard of mocked/deterministic checks that stayed green through real bugs. Gates have been punishing honesty and passing fabrication.

**The fact bodyguard (the only deterministic gates that survive as commit-blockers):** the handful of checks a judge physically cannot perform by reading prose —
1. **Arithmetic reconciles** — budget cascade sums to the dollar (defect #1 made load-bearing).
2. **URL liveness + containment** — every cited URL resolves at commit time AND the fetched content contains the attributed number/entity; fail → drop the claim and its number together.
3. **Quote permalink** — VoC quotes are real per-review permalinks or the section honestly says "no quotes retrieved."
4. **Deny-list** — zero internal pipeline vocabulary leaks to the client surface (already in `zz-buyer-eval.mjs`).

**Everything else dies or is demoted:** row-count floors, awareness/force enum-coverage quotas, confidence self-report, substring "verified," mandatory insight quotas, and any gate that forces padding or strikes honest gaps. (This is exactly Wave 1 of the 9/10 bar doc: "kill the fabrication-forcers.")

**The judge harness** is a first-class, re-runnable CLI gate, and **the judge is always a LOCAL agent (Codex / Claude Code) — never an API model** (owner rule 2026-06-15): no key, never billed, strongest reasoning available. Three deterministic steps: `zz-judge-run.mjs <run>` GATHERS the persisted inputs+outputs into a bundle → a local Codex/Claude Code agent reads `prompt.txt` and writes `verdict.json` (shape via `--print-schema`) → `zz-judge-run.mjs <run> --gate` passes/fails (≥9, zero fabrication). **`$0` of browser AND `$0` of API** — removing both the Clerk dependency and any model-key dependency from the quality gate. (Proven 2026-06-15: three independent judges converged on the same defects on the Airtable baseline; `--gate` returns exit 2 below bar. A `--provider` API path exists only as a non-canonical headless-CI escape hatch.)

## 4. Codex one-prompt fan-out — real, native, already enabled

Verified facts (research lane, sourced):
- `~/.codex/config.toml` has `[features] multi_agent = true`, `[agents] max_threads = 6, max_depth = 1`, model `gpt-5.5`. `codex features list` → `multi_agent` is `stable` and ON.
- One prompt fans out via the parent calling `spawn_agent` per lane → `wait_agent` on the dependency graph → `close_agent` to free slots → synthesize. `spawn_agents_on_csv` handles homogeneous N-item fan-out.
- The repo **already has 5 named role-agents**: `.codex/agents/{backend,frontend,qa,researcher,script-grader}.toml` (scoped file ownership). The existing handoff (`docs/handoffs/2026-06-13-vnext-slice1-codex-goal.md`) is ~90% the correct shape.

**Honest limits / required guardrails (must be in the prompt):**
- **Real breadth ≈ 5 lanes, not 8** (depth=1 → no recursion; internally-sequential lanes run as one agent).
- **Open thread-leak bug `openai/codex#22779` on this exact `0.130.0 + gpt-5.5`** — completed subagents leak thread slots until `close_agent`. **Cap at 5 lanes; mandate `close_agent` after every `wait_agent`.**
- **Children are siblings, not context-sharers** — the parent must run the "resolve-before-coding" greps and **inject** resolved specifiers into each child, or children re-discover/drift.
- **Shared-file writes are the #1 failure** — enforce a single-writer file map, or use git worktrees (repo already has 3) for lanes that touch overlapping files.
- **Codex won't self-gate** — human/spend gates (migration apply, live E2E) must be explicitly carved out as "stop and report, do NOT spawn."
- Parallelism does **not** fix the Clerk/E2E pain — the `$0` offline CLI proofs + CDP-into-authed-tab already do; make those the per-lane exit criteria.

## 5. E2E reliability — diagnosed + hardening spec (Wave 0, Claude-owned)

Empirical probe (2026-06-14): dev server **UP** (`localhost:3000` → 200); **CDP Chrome DOWN** (`:9223` refused, nothing launches it); **Tier-1 logic proof GREEN at `$0`**; Tier-2 DB moat live-correct (migration `20260614064633` applied; clean run `d838ed4e` has `strategyBrief.counts_toward_rollup=false`). The 3-tier model's cheap floor is real, but the operational glue is brittle:
- Clerk ticket sign-in (`zz-e2e-clerk-signin.mjs`) only auto-auths the strategy-brief path; **the full drivers still throw "sign into Clerk manually first"** — Ammar's exact pain, unaddressed for full runs.
- Default run id `f3993043` is **polluted** (real 5/6, 2 error sections, fake `status=complete`); clean baseline is `d838ed4e`.
- CDP port split: strategy-brief scripts default 9223, drivers default 9222.
- No bootstrap launches the CDP Chrome; no single preflight doctor.

**Hardening (Wave 0):**
1. `scripts/_e2e-env.mjs` — single source for `BASE_URL`, `CDP_URL` (one default `9223`), and `getCleanRunId()` (latest run where `status=complete AND children_complete=children_total AND 0 error sections`).
2. `scripts/zz-e2e-bootstrap.sh` — launch Chrome with `--remote-debugging-port=9223 --user-data-dir=tmp/e2e-chrome-profile` (persistent → **sign in once**), poll `/json/version`, run the ticket sign-in.
3. Extract `signInOverCdp(page)` from `zz-e2e-clerk-signin.mjs` into a shared helper; call it from the two full drivers before they assert the form is visible (no manual login ever).
4. `scripts/zz-e2e-preflight.mjs` — doctor: dev 200 + CDP 200 + required env names present (presence-only, never printed) + a clean run id exists. First call in every tier/driver script.
5. `npm run e2e:{bootstrap,tier1,tier2,judge,tier3}` — Tier1+Tier2+judge are the default `$0`/cheap gate; Tier3 is opt-in behind a confirm.
6. Pin `E2E_CLERK_USER_ID` (drop the last-active-user heuristic); document the clean baseline run.

## 6. Execution waves

- **Wave 0 — Claude-owned, `$0`/cheap, the foundation.** §5 E2E hardening + the §3 `zz-judge-run.mjs` value-read harness. Proven in the CLI before any Codex wave. (Verification of the rest depends on this.)
- **Wave 1 — one disciplined Codex fan-out, ≤5 lanes, single-writer/worktree isolation.** Quality + spine in parallel (Ammar: "both in parallel"). Terminal acceptance = `zz-judge-run.mjs` value verdict ≥ "genuinely valuable" + Gate-2 live (human/spend-gated).

### Wave 1 lane decomposition (≤5, single-writer map)

| Lane | Role | Work | Owns (single-writer) | Depends on |
|---|---|---|---|---|
| **L1** | backend | Fact bodyguard + feasibility gate: make `*Value` siblings load-bearing (defect #1); promote feasibility (`closeFunnelMath`/`maxAbsorbableSpend`) to a **commit-blocking** gate on paid-media in `run-section.ts`; kill fabrication-forcer floors in paid-media schema. | `paid-media-plan.ts` schema, `run-section.ts` **paid-media commit block only**, `synthesis/feasibility.ts` | — |
| **L2** | backend | Cross-section reconciliation + source admission: elevate fact-ledger/contradiction sweep to a commit-time single-writer pass at the fan-out join; convert source-liveness/provenance-gate to **hard drop-claim-and-number**; VoC permalink-only + honest-empty. | `verification/` (source-liveness, provenance-gate), `synthesis/fact-ledger.ts`, `synthesis/contradictions.ts`, VoC schema; **`run-section.ts` per-row admission seam** | — (serialize the `run-section.ts` seam vs L1 — see note) |
| **L3** | backend | Slice 2 spine: `benchmark-prior` provenance class (defect #6) + evidence-support carve-out; media-gate intercept at 6/6; bind buyer numbers via ResearchInput user-supplied fields + "from you" BasisChips. | provenance enum, `evidence-support.ts`, media-gate route/state | L1 (feasibility gate consumes bound numbers) |
| **L4** | backend | Slice 1 hardening: `strategyBrief` grace-poll (defect #2); brief containment fact-check (defect #4). | `use-audit-state.ts`, `strategy-brief/support.ts` + route | — |
| **L5** | frontend | Slice 3 spine: run-init-into-chat (corpus tool + brief-confirm card + needsApproval fan-out) with WelcomeForm intake retained; reader polish for killed-gate chrome. | `audit-chat-panel.tsx`, `audit-reader-shell.tsx`, run-init surfaces | — for component; integration after L4 |
| **Gate 2** | qa | live Tier-3 acceptance (`zz-strategy-brief-prove.mjs`) + Mr Dre probe (defect #5) + chat demo. **Human/spend-gated, terminal — stop and report.** | — (no code) | all + authed CDP tab |

**Single-writer note on `run-section.ts`:** L1 (paid-media block) and L2 (per-row admission + join) both touch it. Mitigation: one thread owns `run-section.ts` and applies L1+L2 patches sequentially, OR run L1 and L2 in **separate git worktrees** and reconcile at merge. The Codex prompt must pick one and state it.

## 7. Verification gates (every lane, before "done")

- `npx tsc --noEmit` → **no new errors** vs the captured baseline.
- `npm run test:run` → no new failures; new colocated suites green.
- `npm run build` → exit 0.
- Per-lane **CLI proof script** committed + green (`$0`): the existing `zz-strategy-brief-*` tiers + new `zz-paid-feasibility-gate.mjs`, `zz-reconcile-pass.mjs`, `zz-source-admission.mjs`, `zz-media-gate.mjs`.
- **Terminal acceptance:** `node scripts/zz-judge-run.mjs <fresh_run_id>` (gather) → a local Codex/Claude Code agent writes the verdict → `--gate` requires value verdict "genuinely valuable / would-pay", budget arithmetic reconciles, zero containment-fabrication findings, deny-list clean. This is the product's score.

## 8. Open items / explicit non-goals

- Non-goals this pass: durable agent runtime; playbook tabs beyond brief→plan (ad scripts, sequences, pricing, sales); `.docx/.pptx` export; Slack delivery; `research-worker/` changes.
- Gate-2 live acceptance and any live E2E reuse the committed **CDP-into-authed-tab** pattern; auth is inherited, never manual.
- The Mr Dre probe result decides whether section reframes stay rerun-with-refinement or must become anchor-scoped patches.
