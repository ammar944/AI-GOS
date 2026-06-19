# Phase 0 — The 8/10 Output Contract

> What a real media buyer at a million-dollar agency must be able to *do* with the
> committed Ramp/Fathom/Plain deck. This is the acceptance reference for the
> overnight gap-to-8 push. The proof is **reading the deck**, not an eval score.
> Branch `refactor/architecture-deepening` @ `e94c9e2b` (+ dirty tree).

## The one-line bar
> A media buyer can open the committed artifact and **build a live paid campaign from it
> this afternoon** without re-doing the research — or, where evidence is genuinely missing,
> sees an **honest, labeled gap with a test probe**, never a confident bluff.

## The 9 required elements (per committed run)

| # | Element | 8/10 acceptance | Honest-gap fallback (still passes) |
|---|---------|-----------------|-------------------------------------|
| 1 | **Audience rows** (BuyerICP → PaidMedia) | ≥3 buyer units grounded in live external source URLs (role/segment, names optional); each row maps to a targetable audience | amber row labeled `Evidence gap:` + a probe to validate, NOT "AI Optimized" |
| 2 | **Budget cascade** | Total → channel → audience splits that sum correctly; every split traceable to a stated rationale | disclosed default %s labeled "model-estimated", not operator intent |
| 3 | **Targeting logic** | Each audience row states platform + targeting params reasoned from upstream pains/segments | gap labeled, with the missing input named |
| 4 | **Proof-backed angles** | ≥2 angles, each tied to a real VoC quote / objection / trigger (operator-supplied counts as highest provenance) | directional angle labeled "directional, confirm with buyer" |
| 5 | **Keyword / volume / CPC rows** (Demand) | ≥10 non-branded commercial-intent keywords with volume + CPC where available | missing CPC shown as `—` / "not disclosed", never invented |
| 6 | **KPI math** | CAC / CPL / ROAS derived from budget + funnel assumptions; units coherent; arithmetic checks | assumptions stated as assumptions, ranges allowed |
| 7 | **Assumptions** | Every projected number names its assumption (conv rate, AOV, etc.) | — |
| 8 | **Source links** | Load-bearing claims cite a live URL (operator-supplied URL = highest provenance, scraped first) | unsupported claim downgraded to honest gap |
| 9 | **Visible honest gaps** | Thin/missing evidence renders as amber gap + probe, never a confident placeholder allocation | this *is* the fallback column |

## Anti-patterns that auto-fail the bar (from buyer-eval + judge)
- `wouldPay == "with-caveats"` or any per-section score `< 8`.
- `noFabrication == false` / `fabricationFindings.length > 0`.
- buyer-eval hard flags: `VOC-EMPTY-DESPITE-EVIDENCE`, `CAC-UNIT`, `BUDGET-PARTITION`, `COMPETITOR-COUNT`, `VOC-LAUNDERING`, `DENY-LIST`, `SECTION-EMPTINESS`.
- PaidMedia gap rows rendered as confident allocations ("AI Optimized" / "UNVERIFIED" passing as grounded).
- Sections re-discovering operator-supplied intelligence the brief already contains (input-bridge loss).
- Empty-despite-evidence: the run found the data and the section shipped empty.

## Proof gates (must appear in transcript — no old-bundle re-judging)
```
# fresh confirmed-HEAD run, per subject ∈ {ramp, fathom, plain}
node scripts/zz-dump-run-sections.mjs "$RUN_ID" "$BUNDLE"
node scripts/zz-buyer-eval.mjs "$RUN_ID" --bundle "$BUNDLE"      # Gate: CLEAN
node scripts/zz-judge-run.mjs "$RUN_ID" --bundle "$BUNDLE" --gate --threshold 8
# extra jq: overallScore>=8 AND wouldPay=="yes" AND mediaPlanNumericallyCoherent
#           AND noFabrication AND fabricationFindings==0 AND ALL perSection[].score>=8
```
Product-level 8/10 = **all three subjects** pass on confirmed HEAD.

## Execution order (value-first; offline-green before the paid live run)
- **P1 Input bridge** — operator voice/URLs/channels/provenance reach sections + paid-media digest.
- **P2 BuyerICP Option B** — one role/segment-grounded validator; live-URL containment mandatory.
- **P3 VoC + capstone honesty** — directional commit lane; honest gap rows instead of `.min()` padding.
- **P4 Thin honesty floor** — wire factStore/liar-catcher/live gate (downgrade, never fabricate), then ONE controlled live proof.
