# Gap-to-8 Overnight Push — Results & Honest Verdict

**Date:** 2026-06-19 · **Branch:** `refactor/architecture-deepening` · **Base HEAD:** `e94c9e2b` (work is uncommitted on the dirty tree) · **Orchestrator:** Opus 4.8, multi-agent (bounded TDD slices, disjoint file ownership, diffs reviewed in-thread).

## VERDICT — Path B (honest, not yet 8/10)

**We did NOT reach the final bar** (fresh confirmed-HEAD Ramp/Fathom/Plain, all sections, `zz-buyer-eval` CLEAN, `zz-judge-run` ≥8 per-section, `wouldPay=yes`). Producing that requires a full 6-section + paid-media e2e run through the browser/Clerk path, which is gated (see Blockers).

**What we DID prove:** five offline producer fixes landed **integrated-green** (1497 tests, tsc 0, `git diff --check` clean), and a **bounded live proof cured the headline data-drop** on the Ramp corpus: BuyerICP went from **0 committed personas → 7**, all source-linked, 6 ledger-backed, the 1 uncontained source honestly gap-flagged (not fabricated). This is real, usable, honestly-bounded output — but it is one section, not the whole deck, and not the deterministic gate.

---

## What landed (all diff-verified, no commits)

| # | Slice | Files | Proof |
|---|-------|-------|-------|
| 1 | **Input bridge GAPs 1–4** — operator voice (16 fields), supplied URLs, provenance/sourceUrls, channel signals now reach section prompts; paid-media digest helper added | `artifact-envelope.ts`, `corpus-to-research-input.ts`, `build-prompts.ts` | 10 tests RED→GREEN |
| 2 | **Paid-media floor-honesty** — under-floor arrays synthesize `Evidence gap:` rows (no throw, no model padding); honest-gap rows skip the evidence pack (deterministic guard @743) so they can't be laundered to `grounded`; overlap≥1→≥2 | `paid-media-plan.ts`, `paid-media-evidence-pack.ts` | 91/91 (incl. 9 new) |
| 3 | **BuyerICP Option B** — one `isValidGroundedBuyerUnit` (sourceUrl MANDATORY; named **or** segment); `segmentLabel` added to STRICT `entityFieldNames` (fabrication wire, c9bc2056 class closed); 8 over-reject sites swapped, 4 human-name sites kept | `grounded-buyer-unit.ts` (new), `buyer-icp.ts`, `source-liveness.ts`, `run-section.ts` (BuyerICP region), `required-evidence.ts`, `research-evidence-readiness.ts`, `live-quality-gate.ts` | RED→GREEN on the real commit path; 1488 green |
| 4 | **segmentLabel prompt wiring** — model now instructed to author a source-grounded `segmentLabel` when it can't name a person | `section-prompt-guidance.ts`, BuyerICP `SKILL.md`, `build-prompts.ts` (repair) | 46/46, snapshot updated |
| 5 | **VoC directional lane (Phase 3)** — secondary blocks (objections/switching/criteria) populate from a **disjoint-partitioned** surplus pool (was hardcoded `[]`); `single_source_majority` → labeled directional-downgrade, not section-kill; strict `isAdmissibleQuote` gate 0-diff | `run-section.ts` (VoC region) | 142 VoC + 660 lab-engine green |
| 6 | **Import-cycle fix** (found by the live `--dry`) — `BUYER_PERSONA_GROUNDING_FIELD` extracted to a leaf module; breaks the `source-liveness ↔ buyer-icp` module-init TDZ crash | `buyer-icp-constants.ts` (new), `buyer-icp.ts`, `source-liveness.ts` | `--dry` ReferenceError gone |

**Integrated gate:** `npx vitest run src/lib/lab-engine src/lib/research-v2 src/lib/research-v3` → **1497 passed, 1 skipped**. `npx tsc --noEmit` → **exit 0**. `git diff --check` → **clean**. Total scope: 22 product+test files, +1690/−161.

---

## Bounded LIVE proof — BuyerICP (the centerpiece before/after)

Command (browser-free, single section, deepseek-direct + real tools, frozen Ramp corpus):
```
node --env-file=.env.local --import tsx scripts/zz-record-live-section.ts --section positioningBuyerICP
# --dry first → "wiring OK (imports + corpus build + store + factStore). $0"
```
- **run id:** `live-BuyerICP-k1y0xs` · **bundle:** `tmp/replay-live/live-BuyerICP-k1y0xs` · duration 258s
- **committed: true** — **7 personas** (frozen `b0d12b45` previously shipped **0**, confidence 0 → **0.357**)
- 149 facts captured (15 named_champion + 134 corpus_excerpt); all http source_url, all non-empty quote (Pillar 1 ledger live)
- **6/7 ledger-backed**; Lauren Feeney's source was uncontained → **honestly flagged** `uncontained-source-removed`, not fabricated
- Personas: Bill Cox (VP Finance / economic-buyer / ramp.com), Alicia Coleman (Mktg Ops / ramp.com), Mikey Korn (COO / Trustpilot), Bailey Russo (Sr Accountant / Trustpilot), Robert Tracy (Dir IT / Trustpilot), Kristofer Quiaoit (CEO / Trustpilot), Lauren Feeney (Controller / gap-flagged). `vendorSourced` correctly distinguishes 3 case studies from 4 third-party reviews.
- Honest verdict prose retained: "ICP validated at the functional level … firmographic boundaries inferred from customer examples rather than published data, creating targeting risk for paid media."

### Honest caveats on the live proof
- **The committed personas are NAMED individuals, none via `segmentLabel`.** This corpus *had* nameable champions, so the model used names — correct behavior; `segmentLabel` is the fallback for corpora that lack them. So Phase 2's literal criterion ("≥3 external **role/segment**-grounded units survive") is proven **offline** (unit fixtures with role+segment+no-name) but **NOT exercised live** on this corpus. What the live run proves is that the **centralized grounded-buyer validator + fixed case-study mining cured the 0-persona over-rejection** of real named, sourced champions.
- **Open bug found live (NOT fixed):** the model emitted `evidenceGapReport.acquisitionLedger[].rejectionReason` / `toolGapReason` values outside their Zod enums; the whole `evidenceGapReport` was stripped on commit → the "who we rejected and why / tool gaps" transparency is lost. Fix: widen the enums (or coerce unknown→`insufficient_evidence`/`no_result`) so the gap report survives. The 7 personas were unaffected.

---

## Blockers to the final 8/10 bar (Path A) — exact

1. **Full-run e2e is browser/Clerk-gated — PROVEN this session, not assumed.** `zz-buyer-eval` / `zz-judge-run` consume a bundle from `zz-dump-run-sections`, which **reads committed sections from Supabase** (`research_artifacts` + `research_artifact_sections` by `run_id`) — i.e. the bundle must come from a run **persisted in the DB**. The browser-free `zz-record-live-section` uses a **local temp store**, so it never creates a DB run_id and cannot feed buyer-eval (confirmed: buyer-eval on the single-section bundle fails `ENOENT _manifest.json`). The only DB-persisting full-run producers are the **browser e2e** (`zz-drive-e2e-airtable.mjs`) and the **orchestrate API**, both Clerk-gated. The e2e driver connects over CDP `localhost:9222`; **PROVEN blocked** — `curl http://localhost:9222/json/version` returns **empty** (the listening PID 41028 "Google" process is not a DevTools-debuggable Chrome), so the driver throws "CDP endpoint did not return Chrome version JSON" before any run. There is no Clerk-authed debuggable browser available, and one cannot be created without the user's credentials. **No in-process full-run+persist harness exists** (`zz-prove-p0-spine` uses fixtures; `zz-replay-section`/`zz-record-live-section` are single-section) — building one would re-implement orchestrate + require a paid prod run + applying the unapplied migrations, i.e. new infra + irreversible prod mutations = a user decision, not autonomous continuation.
2. **Phase 4 ledger is not live-wired and migrations are unapplied.** `research_facts_ledger` + `content_aware_rollup_allow_list` migrations are **absent** from prod Supabase (`sidrtuxpqftyzwdusdha`; latest applied = `20260618141119`). factStore is still not injected at dispatch and `checkDeckAgainstLedger` has no commit-path caller (the single-section script uses a local temp store, so it didn't need them). Wiring factStore without applying migrations would 42P01.
3. **Paid 3-subject run not run** — deliberately, to honor "stop before any unbounded paid/live loop." A single bounded section was the controlled proof; the full Ramp/Fathom/Plain × judge sweep (~$6, ~30 min, retry-prone) was not started.
4. **GAP 5 (upstream digest → paid media) built but unwired** — `buildUpstreamFindingsDigest` exists + is unit-tested but has no production call site; the PaidMediaPlan model still doesn't read the upstream digest. Needs one `run-section.ts` insertion at the paid-media prompt-assembly site.
5. **Phase 4 honesty floor (factStore/liar-catcher/live gate) NOT started.** Also note the `getFacts()` cross-section read bug (returns only in-process-appended rows) must be fixed before wiring or it would block every legitimate grounded deck under fan-out.

## Next phase (in priority order)
1. Verify/establish a Clerk-authed Chrome on `:9222`; run `zz-drive-e2e-airtable.mjs` for **Ramp** → `zz-dump-run-sections` → `zz-buyer-eval` (expect SECTION-EMPTINESS clean now) → `zz-judge-run --gate --threshold 8` + per-section≥8 jq. This is the first real product-level data point.
2. Wire GAP 5 digest into the paid-media prompt (one `run-section.ts` edit) so the media plan reasons over upstream substance.
3. Fix the `acquisitionLedger` enum strip (transparency data-loss).
4. Phase 4: fix `getFacts()` cross-section SELECT, inject factStore at dispatch, call `checkDeckAgainstLedger` at the paid-media commit (downgrade, never hard-fail), apply the two migrations.
5. Then the 3-subject sweep for the product-level 8/10.

## Commands / artifacts (for reproduction)
- Integrated tests: `npx vitest run src/lib/lab-engine src/lib/research-v2 src/lib/research-v3` → 1497 passed
- Typecheck: `npx tsc --noEmit` → exit 0 · `git diff --check` → clean
- Live proof: `node --env-file=.env.local --import tsx scripts/zz-record-live-section.ts --section positioningBuyerICP` → run `live-BuyerICP-k1y0xs`, bundle `tmp/replay-live/live-BuyerICP-k1y0xs`
- Output contract: `docs/reports/2026-06-19-phase0-output-contract.md`
