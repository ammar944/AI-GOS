# Meta Ads Benchmarks & Signal Thresholds (frozen)

> Source: benai `ads-meta` skill — `references/{meta-audit,benchmarks,scoring-system}.md`
> (updated 2026-02; WordStream/LocaliQ 16K-campaign + Triple Whale 2025 + Gemini research).
> Frozen here so `/internal/meta-ads` cites its own repo source, not a runtime plugin.
> Consumed by `src/lib/agency-intelligence/meta/signals.ts` (pure, deterministic, no LLM).

This is the **v1-computable** subset — the signals derivable from account- and
campaign-level insights we actually pull (spend, impressions, reach, frequency,
clicks, CTR, CPC, CPM, results/CPA). The full 46-check Meta audit additionally
needs Pixel/CAPI, creative, and structure data we do **not** pull; those checks
are intentionally omitted, not faked (see Honesty guardrail).

## Signal thresholds

| Signal | Input | good | watch | poor | Source |
|---|---|---|---|---|---|
| Frequency (prospecting) | `frequency` | < 3.0 | 3.0–5.0 | > 5.0 | meta-audit M-CR2 |
| Frequency (retargeting) | `frequency` | < 8.0 | 8.0–12.0 | > 12.0 | meta-audit M-CR3 |
| Link/CTR health | `ctr` (%) | ≥ 1.0% | 0.5–1.0% | < 0.5% | meta-audit M-CR4 |
| CPC vs benchmark | `cpc` ($) | ≤ benchmark | ≤ 2× benchmark | > 2× benchmark | benchmarks (by objective) |
| CPM vs benchmark | `cpm` ($) | ≤ benchmark | ≤ 1.5× benchmark | > 1.5× benchmark | benchmarks (by industry) |
| Creative fatigue | daily `ctr` series | drop < 10% | 10–20% | > 20% over ~14d | meta-audit M28 / benchmarks |

## Objective-aware benchmarks (Meta, WordStream 2025)

| Objective | CTR avg | CPC avg | CPL | CVR |
|---|---|---|---|---|
| Traffic | 1.71% | $0.70 | — | — |
| Leads | 2.59% | $1.92 | $27.66 | 7.72% |
| (general CPC, Jan 2026) | — | $0.85 | — | — |

ROAS / CPA framing applies **only** when the objective is conversion-tracked
(Leads, Sales). For Traffic/Awareness objectives `purchase_roas` returns
"Not available" → ROAS renders `—`, never a fabricated number.

## CPM by industry (Meta)

| Industry | CPM |
|---|---|
| Most industries | $6–8 |
| E-commerce | $12.50 |
| Local services | $18.00 |
| Healthcare | $28.00 |
| B2B SaaS | $35.00 |
| Legal | $45.00 |
| Finance | $50.00 |

## Honesty guardrail (benai `scoring-system.md`)

> If **> 50% of a category is N/A**, flag **Insufficient Data** — do not score it.

The dashboard therefore:
- Shows the computable signals above with their cited benchmarks.
- Renders **`—` for any metric Meta returns as "Not available"** (e.g. Checkle's
  account-level `results`/ROAS under a Leads objective aggregated across mixed
  result types).
- Emits **no fabricated 0–100 overall health score** — `signals.ts` types the
  composite score as `null` so a number can never be invented.

## Data-fidelity notes (this MCP)

- The Meta Ads MCP catalog exposes **no link-click count or link-CTR field**
  (`inline_link_clicks`/`inline_link_click_ctr` are unknown). `ctr` here is the
  **all-click CTR**; `link_clicks` is `null` (renders `—`). The link-CTR
  benchmarks above are used as the comparison band — directional, not exact.
- Account-level `objective` is null (campaigns carry the objective). Account
  CPC/CPM/CTR signals use the general/blended benchmark; per-campaign signals
  use the campaign's objective benchmark.
