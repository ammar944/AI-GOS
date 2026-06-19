# Fusion final — Target architecture for AI-GOS (opus4.8-gpt5.5)

## The verdict both models reached independently
The problem is not synthesis quality or missing data. AI-GOS has no **research operating system**. Two senior engineers, blind to each other, reading the real code, converged on the SAME fix a Manus-grade team would build:

1. A durable, shared **Evidence Ledger** (Supabase, append-only) = the system of record. Every fact (champion, quote, pricing point, CPC/volume, channel verdict) is written WITH a required source_url the instant it's found. A timeout kills an agent, never its facts. (Kills "data dropped, not missing".)
2. A **rate-limit-aware provider scheduler** every model/tool call routes through — per-provider caps (DeepSeek 2, Brave 1-2, Perplexity 1), 429/Retry-After backoff, requeue + a shared page/search cache so sections stop re-fetching the same pages. (Kills the starvation that causes the emptiness.)
3. **Readiness-gated completion**: "done" = the ledger holds >= floor grounded facts for a cell-group, NOT "a row was written". Paid media fires only when required groups are GROUNDED-or-explicitly-BLOCKED. An empty BuyerICP HOLDS the barrier and triggers one bounded solo re-run before degrading. (Kills "6/6 with 3 hollow".)
4. **Compiler-style deck generation**: a single deep composer reads the WHOLE ledger and fills typed DeckCell {value, status, provenance} objects — each binds to a ledger fact (with sourceUrl) or renders an explicit gap. Drop the `.min(N)` forced rows on synthesized blocks; make evidence packs universal. (Kills "manufactures confident placeholders".)
5. **Deterministic-first quality**: a blocking liar-catcher that cross-checks every "grounded" cell against the ledger (the sourceUrl exists; the source_quote literally contains the claimed token) — THEN an LLM value-read as an advisory strategist score, handed the ledger so it penalizes hollow pages. (Kills the 6.7-on-a-2/10 judge.)

## Code-grounded correction to the earlier diagnosis
Both panelists checked the migrations. The corpus-padding rollup bug I described earlier is **largely already fixed** — current SQL excludes corpus/synthesis/paid-media from the count. The surviving live bug is **content-blindness** (an empty section commits status='complete' and still counts), and the rollup uses a fragile **deny-list** (everything not excluded counts) instead of an **exact-six allow-list** — which is why there's a trail of "exclude X" migrations. Precise fix: (a) make completion content-aware, (b) convert deny-list -> allow-list.

## Two forks the panel split on (your decision)
- **Concurrency shape:** single acquisition lambda + in-process p-limit (simpler; Vercel Pro 800s) vs distributed DB/Redis lease queue (keeps lanes distributed; reuse the worker's semaphore).
- **Section granularity:** miners-write-facts + one composer does everything (flatter) vs miners -> per-section compilers -> cell verifier -> deck compiler (more staged, better for the Research tab + isolated verification).

## Priority roadmap (both agree)
- **P0 (2/10 -> usable floor; smallest changes):** (1) content-aware completion gate + allow-list rollup; (2) Evidence Ledger — have EXISTING miners insert facts as they find them so timeouts can't drop them; (3) deterministic liar-catcher over deck-vs-ledger, blocking.
- **P1 (stop the starvation):** (4) provider scheduler (per-provider p-limit/leases + 429 backoff); (5) shared page/search cache.
- **P2 (stop the full-looking-hollow deck):** (6) drop `.min(N)` on synthesized blocks + per-cell provenance + extend evidence packs to funnelIdeation/kpis/projectedResults/crossSectionInsight; (7) projected-results as formulas with assumption labels.
- **P3 (the full re-architecture + the harness):** (8) planner + manifest-driven acquisition + single deep composer; (9) value-read harness on a fixed subject corpus (Ramp/Fathom/quote-rich/thin), ledger-aware rubric, trended every change.

## Blind spots the panel missed (do not skip)
- Latency/UX: the staged ledger->barrier->composer pipeline + one-shot final composer is a SILENT multi-minute gap; it collides with the hard "stream visible progress" requirement. Needs per-cell streaming telemetry.
- Rollout: this is a large re-arch of a LIVE system; needs an explicit strangler-fig path (P0 ledger under existing miners first, topology last).
- Coherence: neither specified how the single composer enforces numeric coherence (audiences sum to budget; projections reconcile) — wire the existing numeric-coherence gate into the composer.
- Corpus->ledger typing and whether DeepSeek is the right acquisition-quality model are open.

## Bottom line
Make facts durable the moment they're found (ledger), stop providers starving each other (scheduler + cache), and make "done"/"filled" mean "grounded" (readiness barrier + per-cell provenance + liar-catcher). Those three, in that order, take it from full-looking-and-hollow to actually grounded. The remaining gaps become explicit input/asset requirements, not model-authored filler.
