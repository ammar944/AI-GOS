# /research-competitor

Run competitor landscape research on a company or product. Uses a fan-out
architecture: N parallel sub-agents (one per competitor) + a deterministic
Node pipeline for ads, merge, validate, and report.

## Usage

```
/research-competitor https://fellow.ai
/research-competitor {"company_name":"Fellow.ai","product_description":"...","icp":"..."}
```

## What you do

1. **Prepare run dir** — `RUN_DIR=/tmp/research-competitor-<run_id>`, `mkdir -p $RUN_DIR/fragments`.

2. **Scout** — Parse `$ARGUMENTS`. If URL, WebFetch it to extract company/product/ICP. If JSON, validate against `schemas/input.ts`. Then WebSearch `"{company} competitors"` and `"{product} alternatives"`; visit top comparison pages. For broad or ambiguous categories, run `prompts/competitor-set-analyst.md` before finalizing the list. Build the competitor_set (6–10 entries, typed as direct/indirect/status_quo/diy) and write the initial `$RUN_DIR/output.json` plus `$RUN_DIR/competitors.json` (name+domain per competitor). If the analyst prompt excludes obvious names, preserve that record in `$RUN_DIR/excluded_seeds.json`.

3. **Fan out** — Dispatch one Agent subagent per competitor in a SINGLE parallel tool-use message, using `prompts/competitor-subagent.md` as the prompt template (filled in with that one competitor's data). Each subagent produces `$RUN_DIR/fragments/<slug>.json` with positioning, pricing, reviews, and narrative arc for its one target. Budget per subagent: 4 min / 12 tool calls.

4. **Run the deterministic pipeline**:
   ```bash
   cd skills/research-competitor
   # source .env.local so SEARCHAPI_KEY is in the env (ad fetch needs it)
   ( set -a; [ -f ../../.env.local ] && . ../../.env.local; set +a; \
     npx tsx scripts/orchestrate.ts "$RUN_DIR" )
   ```
   Runs: merge-fragments → fetch-ads (Meta via SearchAPI) → merge-ads → validate → generate-report.

5. **Return** — point at `$RUN_DIR/report.html` plus 3 headline findings.

## Rules

- Facts only. No "our advantage", no scores, no recommendations.
- Every claim sourced with `source_url` + `retrieved_at`.
- Never scrape Meta Ad Library directly (403s). `scripts/fetch-ads.ts` handles it via SearchAPI.
- Don't fall back to a single-agent sequential collector when a sub-agent fails — keep it fanned out.
