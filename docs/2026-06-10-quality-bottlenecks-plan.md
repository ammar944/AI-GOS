# Quality Bottlenecks Fix Pack + Graded Anura Audit — Locked Plan (2026-06-10)

Output of a `/grill-with-docs` session. Every decision below was explicitly confirmed by Ammar. Branch: `refactor/architecture-deepening` (all work piles on; ONE live E2E gates everything, then FF-merge → main). Executor: Claude in-session (no Codex handoff). Baseline: checkle run `9a9412a2` report `docs/reports/2026-06-10-e2e-checkle-9a9412a2.html`.

## Ground truth discovered (SaaSLaunch corpus, `/Users/ammar/Dev-Projects/saaslaunch/`)

- **Media-Plan SOP** (`intake/drive/text/Media-Plan-Engineering--*.txt`, by Jad + Wasam): ACV-band channel logic (<$3k → Meta+Google; $3k–5k → +LinkedIn; >$5k → LinkedIn+Google only), platform minimum budgets (Meta $3k / Google $5k / LinkedIn $5k per month), enterprise→never-Meta, projected-results table (Target ICP / KPI / KPI cost / Objective / Duration / Budget / Projected Results, 20% margin of error), campaign→ad-set→ad structures per platform, risk-tolerance alert rules. **This session: rubric only — NO media-plan schema code changes** (full SOP refit = separate future phase).
- **Growth Playbook** = per-client master deliverable; its `Strategic Research Blueprint` + `Media Plan` slots are empty per client — the hole AIGOS output fills. Both terms now in `CONTEXT.md`.
- **Checkle reality check**: playbook says start $3k/mo, KPI = cost-per-demo (<$150 good, <$100 great), 40 show-up demos/mo. Our E2E brief said $1.5k/mo + trial starts → brief accuracy is part of deliverable quality.
- **Team status** (client-health report 2026-06-09 in that folder): 42 accounts; of 26 with signal — 6 Critical, 11 At-risk, 8 Watch, 1 Healthy (Checkle). Verbatim churn complaint about media-plan disconnect (Anura). Media-plan quality is a live churn lever.

## Workstreams (in execution order)

### W1 — API doctor script (permanent)
`scripts/zz-api-doctor.mjs`: ONE cheapest-possible probe per API — DeepSeek, Anthropic, Perplexity, Firecrawl, Brave, SearchAPI, SpyFu, Foreplay. Reports alive/funded/quota per key, secrets scrubbed. Also diffs env-var NAMES across local `.env.local` / Vercel prod / Railway (names only, never values). Run before every client run. **Money rule: if SpyFu/SearchAPI quota is exhausted → report-first; no plan upgrades without Ammar's eyes.**

### W2 — Deadline-aware section lifecycle (ADR-0012, accepted)
Full design incl. salvage-commit:
1. Explicit `remaining()` deadline threaded through the run; every model call gets `AbortSignal.any([jobSignal, AbortSignal.timeout(perCallCap)])`.
2. Answer-loop stop condition: remaining < emit-floor → emit now. Repair may only START if remaining ≥ repair-floor (calibrate from event logs).
3. Repair ladder: R1 = full structured repair (existing); R2 = schema-minimal salvage, no tools, gaps → explicit evidence-gap markers.
4. **Salvage-commit**: clock can't fund repair → coerce best parseable body to honest-gap shape, commit `insufficient` + rationale. Never fabricate. Never strand.
5. Auto-rerun ONCE per section per run, scheduled after the fan-out wave drains (free lanes). Event-logged.
6. Ceiling stays 285s / route 300s.
Key sites: `src/lib/research-v2/lab-section-dispatch.ts:17` (`LAB_SECTION_JOB_TIMEOUT_MS`), `src/lib/lab-engine/agents/run-section.ts:1895` (`answerToolMaxRepairAttempts`), `run-section.ts:5651-5660` (repair entry guard). TDD the gates + salvage path.

### W3 — Detach agentic review (ADR-0012)
Review becomes its own dispatched job post-commit (~120s budget, non-thinking fast model), updates tier/badge row, realtime pushes. Root mechanism confirmed in exploration: review runs inline in the section route invocation; slow section → residual clock < 45s → abort mid-stream → AI SDK "Failed to process successful response". Verify root cause against event logs before building. Sites: `src/lib/lab-engine/agents/review/agentic-section-review.ts:16` (45s), `src/lib/research-v2/supabase-run-store.ts:998-1001` (`attachAgenticReview`), model selection `src/lib/lab-engine/ai/models.ts:253-280` (`LAB_REVIEW_MODEL`).
**Added 2026-06-10 (doctor findings)**: Anthropic is out of the stack and the local `ANTHROPIC_API_KEY` is dead (401, confirmed) — flip the review model DEFAULT off Anthropic sonnet (`createReviewModelSelection`) to DeepSeek non-thinking (disable thinking for structured in-pipeline calls — learned pattern) or gateway gpt-5.5; remove the silent Anthropic fallback. Known residual Anthropic surface (out of scope, flagged): `/api/research-v2/chat` workspace sidebar hardcodes `anthropic('claude-sonnet-4-6')`.

### W4 — Selective lookup-budget raise
"Section budget exhausted after 4 lookups" is OUR constant, not a provider 429: `section-registry.ts:220,302` (`maxExternalLookups: 4` Buyer ICP, Offer Diagnostic). Raise Buyer ICP 4→6 + demand-intent keyword headroom — ONLY sections the checkle run proved starved. Update `section-registry.test.ts` contract test in the same change (learned-pattern P1.3). Pairs with W2 gates so extra lookups can't cause new timeouts.

### W5 — Foreplay port to live lab path
Foreplay exists ONLY in legacy `research-worker/src/tools/adlibrary.ts:969-1030` (`getBrandsByDomain` + `getAdsByBrandId`, 8s timeout, `ENABLE_FOREPLAY` flag) — lost in the worker→lab-engine migration. Port as 4th provider into `src/lib/lab-engine/agents/tools/adlibrary.ts` aggregation: domain→brand resolution feeds Meta probe; ads enrich walls with real creatives. Behind `FOREPLAY_API_KEY`, graceful degradation, results flow through identity verdicts + dedup (June 4 wrong-company protections apply). If W1 shows the key dead → port ships dark.
Ad-engine goals (all four, user-confirmed): coverage, creative richness, accuracy hardening (verify June 4 fix holds on Anura), reliability.

### W6 — Badge copy fix (copy-level ONLY)
Verifier logic untouched. Tier chip copy distinguishes "unsupported claims" from "honest labeled assumptions / declared evidence gaps" so honest sections stop reading as untrustworthy. No truthgate math changes.

### W7 — Graded Anura run + per-section grading (the gate)
- Live run on **anura.io** (local dev, like checkle). Brief filled from Anura's REAL playbook in the corpus (budget, ACV, CPDemo/CPL targets, ICP) — brief accuracy is part of the test. High-ACV vertical → SOP says LinkedIn+Google, no Meta: stress-tests channel logic in the rubric.
- Run `scripts/zz-verify-e2e-run.mjs` (objective gate) — this is ALSO the pending E2E gate for the whole branch.
- **Grading report** (HTML, `docs/reports/`): per-section 1–10 anchored to "would a SaaSLaunch strategist hand this to the client unedited"; media plan graded against the Media-Plan SOP; corpus graded on prefill coverage/accuracy; fabrication sweep; ad-wall eye-check (eyeball the pixels per feedback rule). Compare vs checkle where dimensions overlap.
- Cost ~$2.6. After PASS: FF-merge branch → main (prod auto-deploys).

## Out of scope (explicit)
- Full SOP media-plan schema refit (campaign/ad-set/ad emission) — own phase after grading shows the gap.
- Verifier scoring recalibration (only copy changes).
- Any billing/plan changes without report-first approval.

## Verification gate (per CLAUDE.md)
`npm run build` exit 0 · `npm run test:run` green (incl. section-registry contract test) · W7 objective gate PASS · grading report delivered.
