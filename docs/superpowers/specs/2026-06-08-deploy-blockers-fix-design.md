# Deploy-blockers fix — design spec (2026-06-08)

**Branch:** `feat/research-quality-truthgate` · **Goal:** make an **unattended** ramp-style audit run reach the finish line — 6/6 sections + all 3 capstones commit, ads show — so the app can deploy. **Deploy bar (user):** reliability-first, ship thin (badge `needs_review`); defer infra-heavy data fixes.

> Companion executable handoff (the thing Codex runs): `docs/handoffs/2026-06-08-deploy-blockers-codex.md`.
> Evidence base: 14-agent root-cause swarm (each finding adversarially refuted against source). Raw findings archived in session transcript; key loci verified against HEAD before writing this.

## The diagnosis (zoom-out)

The team is **not lost**. ADR-0010 / CONTEXT.md / the unified plan already name the exact disease — *a deterministic gate owns the fate of valid-but-imperfect content* + *the client owns capstone orchestration* (verifier fighting thinker). The gap is **execution completeness**: that universal policy ("commit best-effort + `needs_review`, never throw-and-drop; **server** owns dispatch; coverage not substring") was wired into **one** gate (W1 ungated the thinker) and **one** dispatch (server fires only the thinker). The un-wired remainder is exactly what breaks an unattended run.

**One pattern explains 4 of 6 problems.** Where the escape-hatch is wired, the pipeline survives thin inputs (VoC commits a thin `needs_review` artifact). Where it isn't, the section dies terminally.

## Root causes (confirmed, source-verified)

| # | Problem | Confirmed root cause | Deploy impact |
|---|---|---|---|
| 1 | DemandIntent + OfferDiagnostic hard-fail attempt 1, no body, no retry | The only two sections with **no evidence-gap escape hatch** (`getAttemptEvidenceGapArtifact` covers buyerICP/VoC/competitor only). A validator miss that survives the 2-attempt repair → terminal `SectionRunnerError`. DemandIntent fails **deterministically** under a SpyFu (`keyword_volume`) ToolGap; OfferDiagnostic fails **stochastically** on `orderedMoves` "restatement". | **Stuck < 6/6 → capstones never seed.** Needs manual UI rerun. |
| 3 | Synthesis + Paid-Media need a manual page reload | Server-dispatch fires the **thinker only** (`route.ts:384` schedules the thinker with **no `onJobComplete`**); synthesis + paid-media are **client-only** (`use-audit-state.ts:300`). Tab closed after 6/6 ⇒ they never run. | **The autonomy hole.** Unattended run produces no final deliverable. |
| 2 | Paid-Media never commits (3× fail) | Only capstone on **slow pro model + non-streaming legacy path + heaviest schema** (104 nodes vs 43/23, all sharing an **8192** `maxOutputTokens`). Two failures: 270s job timeout (attempt 1) + AI-SDK `APICallError` *"Failed to process successful response"* — a **provider response-decode** failure on HTTP 200 (attempts 2-3). **Reasoning is already disabled** — not the cause. No auto-retry (an `error` row reads as "started"). | **Deliverable doesn't ship.** Highest residual risk; only a live run proves the fix. |
| 4 | VoC = 0 buyer quotes | Reddit `.json` 403s (OAuth-gated, even residential), Firecrawl G2 `parser_no_match`, Brave snippets fail the strict promotion gate. **But post-W1 this commits a thin `needs_review` artifact and no longer blocks the pipeline.** | **Richness defect, not a blocker.** Not 2h priority. |
| 5 | Verifier marks valid operator economics "unsupported" | Trust verifier is pure substring; confidence = `verified/(verified+unsupported)` = hit-rate, not trust. W3's 2-literal marker is phrasing-fragile ("per onboarding" misses). **Plan forbids broadening it.** Real fix = offline judge (week-after). | **Cosmetic** (`needs_review` is the honest tier). |
| 6 | Ads not showing | **Unreproduced in any artifact** — inferred. Likely over-quarantine: bare competitor names arrive **domain-less** → fail `domainCorroborated` → routed to the hidden quarantine drawer; Google ads structurally always quarantined. Domain-resolver "fix" risks **reopening the Jun-4 wrong-company leak**. | Visible feature looks empty. |

## Decisions (this push)

1. **Server-dispatch synthesis + paid-media** off the thinker's commit — close the autonomy hole (mirror the proven Jun-7 thinker dispatch). *[fixes 3 + the half of 7 that's wiring]*
2. **Evidence-gap escape hatch for DemandIntent + OfferDiagnostic** — soften DemandIntent's SpyFu-ToolGap guard (small) + scoped OfferDiagnostic gap-builder (medium), both **re-validating** the patched body. *[fixes 1; reaches 6/6 unattended]*
3. **Paid-media → robust** *(user choice)*: move onto the **streaming answer-tool path** (keeps pro) **+** raise its `maxOutputTokens` **+** bounded auto-retry on an `error` capstone row. *[fixes 2; gated on the live E2E]*
4. **Cheap, plan-compliant quality wins**: W2.4 de-contaminate VoC queries (1-line) + a SKILL.md line mandating the literal `operator-supplied` provenance prefix (does **not** broaden the marker). *[4 + 5, honestly]*
5. **Ads → telemetry + surface quarantine as a labeled wall** *(user choice)*: emit wall/quarantine counts into the artifact + render quarantined creatives as a visible "unverified / name-matched" section instead of a hidden drawer. No identity-logic change → no leak risk. *[6, safely]*

## Explicit non-goals (deferred to a fast-follow)

W2.5 floor reconcile (4-coupled-floor landmine), SERP-snippet VoC relaxation, ad-engine **domain-resolver** enrichment, **offline LLM/entailment judge** (the durable verifier fix), the **universal never-hard-fail invariant sweep**, Reddit OAuth / residential proxy. None are 2h-safe; all are the correct *week-after* cures.

## The gate

Unit-green is necessary but **not sufficient** — the paid-media decode fix and the unattended autonomy chain can only be proven by **one unattended live E2E** (ramp.com, **close the tab after 6/6**). Protocol is in the handoff.
