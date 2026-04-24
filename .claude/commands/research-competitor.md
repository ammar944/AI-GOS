---
description: Competitor Landscape & Positioning deep research. Fans out one sub-agent per competitor (parallel WebFetch/WebSearch), pulls live ads from SearchAPI/Meta Ad Library, merges everything into a schema-validated JSON, and renders an editorial-style HTML report. Facts only — no scores, no recommendations.
---

# /research-competitor

## Arguments

- `$ARGUMENTS` (required) — A website URL (e.g. `https://fellow.ai`) or a company name (e.g. `Fellow.ai`).

## What this does

Fan-out architecture:
- **Scout** (main agent, you) discovers the competitor set and writes the initial `output.json`.
- **Competitor-set analyst** (one focused pre-flight prompt) validates the category frame, frequency-ranks candidates across independent sources, and writes excluded seeds.
- **Collectors** (N parallel sub-agents, one per competitor) each fetch positioning / pricing / reviews / narrative for their ONE competitor and drop a fragment JSON.
- **Ad fetcher** (deterministic Node) pulls Meta Ad Library via SearchAPI for all competitors in parallel.
- **Merger** (deterministic Node) assembles fragments + ads into the full output.json.
- **Renderer** (deterministic Node) produces the editorial HTML report.

## Workflow

### Step 0 — Prepare the run directory

```bash
RUN_ID="run_$(echo $ARGUMENTS | tr -cd '[:alnum:]_-' | tr '[:upper:]' '[:lower:]')_$(date -u +%Y%m%d%H%M)"
export RUN_DIR="/tmp/research-competitor-$RUN_ID"
mkdir -p "$RUN_DIR/fragments"
```

Track `RUN_DIR` and `RUN_ID` for every later step.

### Step 1 — Scout: resolve target + discover competitors

Use `WebFetch` on `$ARGUMENTS` (or search if not a URL) to extract:
- `source_company_name`
- `product_description` (one-liner)
- `icp` (target customer)

Then use `WebSearch` for `"<company> competitors"`, `"<category> alternatives"`, and visit the top comparison articles. Build a `competitor_set` array with 6–10 entries, classified as `direct | indirect | status_quo | diy`.

Before writing the final `competitor_set`, run the focused prompt in `skills/research-competitor/prompts/competitor-set-analyst.md` when the category is broad or ambiguous. It should produce:

- `$RUN_DIR/competitor_set_analysis.json`
- `$RUN_DIR/competitors.json`
- `$RUN_DIR/excluded_seeds.json`

Use its `category_frame` and `final_competitor_set` unless you have stronger sourced evidence. This pre-flight exists to avoid generic lists like "all project-management tools" when the real substitute set includes no-code databases, status quo spreadsheets, open-source/self-hosted tools, or internal build paths.

Write the initial shell JSON to `$RUN_DIR/output.json` (validated fields only — the rest get filled in by later steps):

```json
{
  "run_id": "<RUN_ID>",
  "source_company_name": "...",
  "generated_at": "<ISO now>",
  "tool_calls_used": ["web_search", "WebFetch", "fetch-ads"],
  "competitor_set": [
    { "name": "...", "type": "direct", "source_url": "...", "retrieved_at": "..." }
  ],
  "positioning_taxonomy": [],
  "pricing_reality": [],
  "share_of_voice": { "search_terms_owned": [], "communities_owned": [], "publications_owned": [], "evidence_per_claim": [], "source_url": "...", "retrieved_at": "..." },
  "review_mined_feedback": [],
  "competitor_narrative_arc": [],
  "paid_social_ad_inventory": [],
  "paid_search_ad_inventory": [],
  "ad_activity_signals": [],
  "organic_vs_paid_narrative_delta": []
}
```

Also write `$RUN_DIR/competitors.json` for the ads fetcher:

```json
[
  { "name": "Fireflies.ai", "domain": "fireflies.ai" },
  { "name": "Otter.ai",     "domain": "otter.ai" }
]
```

### Step 2 — Fan-out: N+1 sub-agents in parallel

**This is the critical scale step.** Dispatch N+1 `Agent` calls in a SINGLE message (parallel tool use).

**The N per-competitor collectors** (one per entry in competitor_set) each use the prompt in `skills/research-competitor/prompts/competitor-subagent.md` and write `$RUN_DIR/fragments/<slug>.json`. Budget: 4 min / 12 tool calls each.

**The +1 share-of-voice miner** uses `skills/research-competitor/prompts/sov-subagent.md` and writes `$RUN_DIR/share_of_voice.json`. Searches Reddit / HN / TechCrunch / Zapier / G2 roundups for category presence. Budget: 5 min / 15 tool calls.

Dispatch pattern:

```
// Send all in ONE message, with multiple Agent tool calls:
Agent({
  description: "Collect <competitor_name>",
  subagent_type: "Explore",
  prompt: "<contents of competitor-subagent.md, Input block filled for this one competitor>"
})
Agent({
  description: "Mine share-of-voice",
  subagent_type: "Explore",
  prompt: "<contents of sov-subagent.md, Input block filled with the competitor_set>"
})
// …repeat Agent() for every competitor
```

**Why fan-out:** the main context never sees 10 homepages × 10 pricing pages × 10 G2 pages. Each sub-agent's context is ~10× smaller than a monolithic collector. One blocked sub-agent doesn't corrupt the others. 24h disk cache (on the orchestrate side) means a re-run on the same target costs 0 SearchAPI credits.

### Step 3 — Merge + ads + validate + render (deterministic tail)

Run the orchestrator — it handles fragment merge, SearchAPI ad fetch, schema validation, and HTML render:

```bash
cd skills/research-competitor
( set -a; [ -f /Users/ammar/Dev-Projects/AI-GOS-main/.env.local ] && . /Users/ammar/Dev-Projects/AI-GOS-main/.env.local; set +a; \
  npx tsx scripts/orchestrate.ts "$RUN_DIR" )
```

This runs in order:
1. `merge-fragments.ts` — assembles `fragments/*.json` into `output.json`
2. `fetch-ads.ts --batch competitors.json` — pulls live ads from **Meta + LinkedIn + Google Ads Transparency Center** via SearchAPI. Uses the ported `resolveBestCandidate` (domain corroboration + Jaro-Winkler with short-name guardrails) to avoid false-positive matches like "Fathom" (terrain data) for "Fathom AI". 24h disk cache at `/tmp/research-competitor-cache/` so reruns are free.
3. `merge-ads.ts` — splices multi-platform ad data into `output.json`
4. `merge-sov.ts` — splices `share_of_voice.json` if the SoV sub-agent produced one
5. `validate.ts` — Zod schema gate
6. `generate-report.ts` — renders editorial HTML report with stacked-bar ad chart, per-competitor posters with Meta/LinkedIn/Google sub-panels, and per-platform pill breakdowns in the matrix
7. `screenshot.ts` — optional PNG preview via Playwright (soft-fails if not installed)

If `SEARCHAPI_KEY` is missing, ad counts fall back to 0 and library URLs are preserved — nothing is fabricated.

### Step 4 — Present

Show the user:
1. Target identified + number of competitors
2. Top 3 facts: one positioning quote, one pricing gap, one ad hook
3. HTML report path: `file://$RUN_DIR/report.html`
4. Run directory: `$RUN_DIR` (for re-runs / audits)

## Schema reference

`skills/research-competitor/schemas/output.ts` (Zod). Every field requires `source_url` + `retrieved_at`.

## Hard constraints

1. **Facts only** — no "our advantage", no recommendations, no LLM scores.
2. **Every claim sourced** — URL + timestamp on every record.
3. **No hallucination** — if you didn't fetch it, don't write it.
4. **Fan out, don't loop** — N sub-agents in one message, not N sequential `WebFetch` calls.
5. **SearchAPI for ads only** — Meta blocks direct scraping; the fetcher handles it. No Serper, no Firecrawl, no other external APIs.
