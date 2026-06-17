# E2E Proof Run — Findings & Gaps (2026-06-17)

**Goal:** Run the live `/research-v3` flow across 3 subjects (Ramp / Fathom / Plain) to prove the just-committed value-by-construction work — **BuyerICP `acquisitionLedger`** + **paid-media row-level `evidencePack`** (commit `6b1bc3ed`) — populates in a real run, then value-judge each (Probe 1 autonomy + Probe 2 quality).

**Outcome:** **1 of 3 subjects run (Ramp).** Stopped at the early-abort gate. Ramp completed cleanly (autonomy PASS) but **both headline by-construction fields are absent from the committed artifact**, and the value-read scored **6/10 (below the 8 ship bar) with 1 fabrication finding**. The harness, infra, and providers are now sound; the blockers are two code-level gaps plus one VoC integrity bug.

---

## TL;DR

- ✅ **Harness + infra fixed** and the real flow runs end-to-end autonomously on the prod provider (DeepSeek): all 8 zones complete, **zero section errors**.
- ❌ **The two new by-construction fields never reach the committed artifact.** `acquisitionLedger` and per-row `evidencePack` are **absent** (0 occurrences), despite 99/99 unit tests passing — a mocked-test blind spot. Leading root cause: the **post-commit agentic review rewrites the section body and drops the additively-attached fields**.
- ❌ **VoC padding (fabrication):** the section reports `foundCount: 6` verified quotes but holds only **2 unique** g2 quotes, each duplicated 3×.
- ⚖️ **Provider reality:** Perplexity can't be a section model (it's a research *tool*); Anthropic can't fit the hard 285s/300s section budget. The pipeline structurally requires **DeepSeek**.
- 🛑 **Fathom + Plain not run** — early-abort guard (the gaps are code-level, not subject-specific; reproducing costs ~$4/~24 min). Resume after the fixes below.

---

## What was run

| Item | Result |
|------|--------|
| Subject 1 — **Ramp** (`ramp.com`), runId `d2abf018-529c-4582-822e-585fecc53808` | All 8 zones `complete`, 0 errors (~11 min fan-out). **Probe 1 PASS.** |
| Value-judge (Probe 2) on Ramp | **6/10**, `wouldPay: with-caveats`, `mediaPlanNumericallyCoherent: true`, `noFabrication: false`. Below the 8 bar. |
| Subject 2 — Fathom / Subject 3 — Plain | **Not run** (early-abort). |

Per-section value scores: MarketCategory 7 · BuyerICP 6 · CompetitorLandscape 7 · **VoiceOfCustomer 3** · DemandIntent 6 · OfferDiagnostic 7 · PaidMediaPlan 6.
Artifacts: `tmp/judge/d2abf018/{bundle,verdict}.json` + `prompt.txt`; `tmp/grill/ramp-fresh/*.json`.

**What's genuinely good (do not regress):** operator-supplied numbers (ACV, `$4,200` CAC, `$18K` LTV) are consistently labeled operator-reported/assumption (the prior trust-killer is fixed); competitor ad evidence is domain-verified with real creative copy + live ad-library permalinks and honest about unverifiable competitors; media-plan daily budgets ($150+$200+$100+$383 = $833/day ≈ $25K/mo) reconcile to the stated monthly total; gaps are stated plainly rather than fabricated.

---

## The diagnostic chain (what was wrong, in order, and the fix)

1. **Stale dev-server compile (false negative).** This morning's empty packs were NOT a "wrong server" — the `:3000` server was AI-GOS, but it had started Jun 16 16:14 and its `.next` cache (Jun 16 19:11) predated the feature files (Jun 17 00:22). **Fix:** clean restart (`rm -rf .next`, fresh tmux for Next.js + worker).
2. **DeepSeek out of balance.** First fresh run died: 5/6 sections `status=error: "Insufficient Balance"` (DeepSeek's out-of-credits error). **Fix:** operator topped up; re-probed OK. ⚠️ **If prod shares this DeepSeek account, prod research was failing too — verify the Vercel-side balance.**
3. **Perplexity is not a section-model option.** `LAB_ENGINE_PROVIDER` accepts only `anthropic | deepseek-direct | deepseek-ollama`. Perplexity is wired as a research *tool* (`perplexity_research`); `sonar` lacks the tool-calling the sections require.
4. **Anthropic can't fit the section budget.** Swapped to `anthropic` (key funded) — sections dispatch fine but BuyerICP burned its research phase and hit the 120s structured-fallback floor with only 91.5s left → empty shell. The budget is `LAB_SECTION_JOB_TIMEOUT_MS = 285s`, hard-bounded by the Vercel route `maxDuration = 300s` (invariant `answer-tool 255s < job 285s < route 300s`). Bumping it locally would prove a config that can't ship. **Anthropic is non-viable as-built.**
5. **Rerun-against-polluted-run fragility.** Cheap-validation reruns on the *polluted* morning run (`4992631a`, half its sections dead) failed because that run's `research_artifacts.data` evidence pool is incomplete → the best-effort pool read threw. A fresh run writes a complete pool and behaves correctly. (Secondary bug: the read error is logged as `[object Object]` — see Gaps.)

---

## GAPS / BUGS (prioritized)

### P0 — The two by-construction fields never reach the committed artifact
Both builders **are** wired into `run-section.ts` `saveCompletedArtifact` (`withBuyerICPAcquisitionLedger` @3567, `withPaidMediaEvidencePack` @3576), keys match the body, and `committedArtifacts` is threaded (@11036/@11854). Yet the final committed bodies contain **0 occurrences** of `acquisitionLedger` / `evidencePack`.

- **Leading root cause:** the **post-commit agentic review** (`review/agentic-section-review.ts`, kicked off via `POST /api/research-v2/review-section` after the section commits) **rewrites the section body and does not carry forward the additively-attached fields** — that file never references `evidencePack`, `acquisitionLedger`, or `evidenceGapReport`, and it demonstrably strips content (`[agentic-section-review] dropped … 'Removed all empty arrays (firmographicCuts, personas, levels, triggers, venues)'`).
- **Secondary (BuyerICP ledger):** `withBuyerICPAcquisitionLedger` is a documented **no-op when the committed body carries no `evidenceGapReport`** — and the committed BuyerICP body had none (`evidenceGapReport keys: []`). Tied to the known "zero-candidate persona prepass leaves no audit trail" gap.
- **Fix options:** (a) attach the evidence fields **after** the agentic review (move enrichment into the post-review persist), or (b) make the agentic review **preserve/passthrough** `acquisitionLedger` / `evidencePack` / `evidenceGapReport` as additive, non-rewritten fields.
- **Confirm-in-one-trace:** dump the section body immediately after `saveCompletedArtifact` vs after `review-section` — if the field is present pre-review and gone post-review, (a)/(b) above is the fix.

### P1 — VoC count padding (fabrication, buyer-visible)
`positioningVoiceOfCustomer` reports `painLanguage.foundCount: 6` but the `quotes` array contains only **2 distinct** quotes (g2 reviews `12943564` and `12922111`), each repeated 3×. The 2 quotes are real human-voice g2 permalinks, but the count overstates the unique evidence. **Fix:** dedupe quotes before counting; report the true unique count and state the independent-domain gap rather than triplicating to a floor.

### P2 — BuyerICP `personaReality` empty on an evidence-rich subject
Ramp returned `personas: [0]` ("could not be independently verified"). Triggers (3), firmographic cuts, awareness levels, and key findings populated fine — but no personas, which also starves the acquisition ledger. **Fix:** recover persona evidence or emit honest persona-attempt rows (also unblocks the ledger's `evidenceGapReport` precondition).

### P3 — Evidence-pool read error masked as `[object Object]`
`readEvidencePoolBlockBestEffort` (run-section.ts:835) logs `read research_artifacts.data failed … [object Object]` — `describeErrorForLog` isn't extracting the real message from the (likely Supabase) error. Best-effort so it doesn't hard-block, but it hides the real failure. **Fix:** surface `error.message`/`.code`/`.details`.

### P4 — Section budget is calibrated only for DeepSeek latency
The 285s budget (capped by Vercel's 300s `maxDuration`) leaves no headroom for a slower provider. Not a bug today (we run DeepSeek), but it means **provider portability is currently false** — worth noting for any future provider work.

---

## Harness improvements made this session (kept)

- `scripts/zz-drive-e2e-airtable.mjs`: **parameterized by subject** via `E2E_SUBJECT` (`ramp|fathom|plain|airtable`) — per-subject URL + company name + competitor seeds; descriptive brief fields now defer to corpus auto-prefill (corpus-wins, neutral fallback) so no subject's prose leaks into another's; CDP default fixed to `:9223`; **driver now self-exits** (`process.exit`) instead of hanging on the open CDP connection (the earlier 28-min "no notification" zombie).
- `scripts/zz-probe-anthropic.mjs`, `scripts/zz-probe-deepseek.mjs`: one-shot funding probes (print ok/fail only, never the key).

---

## Recommended next actions

1. **Fix P0** (stop the agentic review from dropping `acquisitionLedger` / `evidencePack`) — this is the gating bug for the entire value-by-construction proof.
2. **Fix P1** (VoC dedupe-before-count) — removes the only fabrication finding.
3. Re-run the **3-subject sweep** (Ramp / Fathom / Plain) on DeepSeek and re-judge; target ≥8/10 with `noFabrication: true`. (Fathom = S-mid, Plain = S-poor / honest-gap test.)
4. **Verify prod's DeepSeek balance** (Vercel) — prod likely failed sections during the local outage window.
5. Backlog: P2 (personas), P3 (`[object Object]`), P4 (provider portability).
