---
name: research-market
description: >
  Market and category research — fans out subagents to collect TAM signals, category maturity, timing, and competitive intensity. Agent collects. TypeScript validates and renders.
version: 0.1.0
---

# research-market

## What this skill does

Produces a sourced market/category artifact for a locked GTM Brief. The input is a sealed run payload with the locked brief snapshot and the required `ingest_identity` prior output. The agent collects category evidence, market-size signals, timing signals, demand drivers, buying triggers, adoption barriers, category pain points, competitive intensity signals, and source gaps. TypeScript validates the final JSON, enforces integrity checks, and can render a lightweight report.

## Trigger

```
/research-market <arguments>
```

Use this skill after identity has been resolved and the GTM Brief has been locked. The correct input already includes canonical company name, domain, category, core keywords, and negative keywords from `ingest_identity`.

Defer to adjacent skills when the request is not category-level market context:

- company identity, domain, category, or keyword cleanup belongs upstream
- buyer personas, job titles, buying committee, and persona-specific intent belong to the ICP skill
- direct competitor lists, pricing, ads, reviews, and share-of-voice belong to the competitor skill
- customer quotes, objections, and deep review mining belong to the VoC skill
- offer diagnosis, packaging, and first-value path belong to the offer skill
- strategy, positioning, media planning, and scripts belong to synthesis skills

## Tools used

- `web_search` for category, market-size, timing, demand, and adoption-barrier discovery
- browser inspection tools when a search result needs direct source confirmation
- local shell commands for `npm run check`, `npm run validate`, and `npm run sanity-check`
- file writes inside the current run directory for `output.json` or JSON fragments

## Workflow (ICM runtime sub-stages)

Every invocation follows these stages:

1. **Receive** — parse the sealed payload against `schemas/input.ts`. Treat `briefSnapshot` as immutable and use `priorOutputs.ingest_identity` as the canonical identity context.
2. **Scope** — derive the market scope from the canonical category, locked brief fields, geography, buyer context, core keywords, and negative keywords.
3. **Collect** — gather category-level evidence. Every factual claim must include `source_url` and `retrieved_at`.
4. **Separate** — keep parent-market context distinct from direct or proxy market sizing. If only a broad market is available, label it as context and include a caveat.
5. **Project** — populate the rich sourced artifact first, then derive the legacy projection fields from those sourced fields.
6. **Validate** — run Zod validation with `scripts/validate.ts` and integrity gates with `scripts/sanity-check.ts`.
7. **Render when needed** — use `scripts/generate-report.ts` only after validation passes.

## Schema reference

- Input: `schemas/input.ts`
- Output: `schemas/output.ts`
- Collector prompt: `references/collector.md`
- Market rules: `references/rules.md`
- Fixture: `example/input.json`, `example/output.json`

## Hard constraints

- Facts only. No LLM-scored metrics ("7/10" style).
- Every factual claim carries `source_url` and `retrieved_at`. Unsourceable facts are omitted or recorded as `source_gaps`.
- No strategy recommendations, campaign plans, or positioning rewrites.
- Do not research direct competitors except broad category intensity signals.
- Do not mine deep customer quotes or broad objection evidence.
- Market-size values stay strings with scope, geography, period, basis, and caveats when available.
- Parent-market figures must be marked as broader context and must not be serialized as direct niche size.
- If no defensible sizing exists, leave `market_size_signals` empty and add a `source_gaps` entry for `market_size`.
- The skill is portable and self-contained. Keep code dependencies inside this skill package.
- Preserve the legacy projection fields because current consumers may still render them.

## Output

The primary output is `ResearchMarketOutputSchema`:

- run metadata: `run_id`, `brief_snapshot_id`, `stage`, `generated_at`
- subject context: `source_company_name`, `source_company`, `market_scope`
- sourced market artifact: `category_definition`, `market_size_signals`, `category_maturity`, `timing_signals`, `demand_drivers`, `buying_triggers`, `adoption_barriers`, `category_pain_points`, `competitive_intensity`, `opportunity_candidates`, `source_gaps`
- compatibility fields: `summary`, `keyFindings`, `evidenceIds`, `assumptions`, `categorySnapshot`, `painPoints`, `marketDynamics`, `trendSignals`, `messagingOpportunities`, `marketOpportunities`

The optional report is a compact HTML rendering of the validated JSON for workspace review. It is not the source of truth; the typed JSON is.
