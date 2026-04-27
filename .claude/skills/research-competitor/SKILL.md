# Competitor Landscape & Positioning — Deep Research

## What this skill does

Uses the agent's native `web_search`, `browser_navigate`, and `browser_snapshot` tools to conduct Section 03 Competitor Landscape & Positioning research. No external APIs. TypeScript layer validates schemas and renders HTML reports.

## Trigger

```
@research-competitor analyze <website-or-company>
```

## Tools used (all native agent tools)

| Tool | Purpose |
|------|---------|
| `web_search` | Discover competitors, find review sites, search for pricing |
| `browser_navigate` | Visit competitor homepages, pricing pages, Meta Ad Library |
| `browser_snapshot` | Extract text, pricing, positioning, ad copy |

## Workflow

1. **Accept input** — URL or company name from user
2. **Search** — `web_search "top competitors to [company] [industry]"`
3. **Browse** — For each competitor found:
   - Navigate to homepage → snapshot for positioning
   - Navigate to /pricing → snapshot for pricing
   - Navigate to Meta Ad Library → snapshot for ads
   - Search for reviews → browse G2/Capterra
4. **Normalize** — Populate output.json matching `schemas/output.ts`
5. **Validate** — Every field has `source_url` + `retrieved_at`
6. **Render** — `npx tsx scripts/generate-report.ts input.json output.html`
7. **Present** — Show HTML path and summary

## Schema reference

**Input**: `schemas/input.ts` — company name, description, ICP, industry, stated competitors
**Output**: `schemas/output.ts` — 11 typed fields (competitor_set, positioning_taxonomy, pricing_reality, etc.)

Every output field must have:
- `source_url`: the page where the data was observed
- `retrieved_at`: ISO timestamp of observation

If unsourceable, **omit** — never hallucinate.

## Hard constraints

1. **Facts only** — no recommendations, no "our advantage"
2. **No LLM-scored metrics** — no "8/10", no "Strong"
3. **Every claim sourced** — URL + timestamp
4. **Tool-first** — web_search + browser tools gather raw data; agent normalizes
5. **No external APIs** — zero Serper, Firecrawl, Meta tokens needed

## Extension to other sections

| Section | Input changes | Output changes | Same pattern |
|---------|-------------|---------------|-------------|
| 01 Market & Category | Add TAM signals | Market size, maturity | Yes |
| 02 Buyer & ICP | Add persona anchors | Awareness map, job titles | Yes |
| 04 Voice of Customer | Add objection list | Verbatim quotes | Yes |
| 05 Demand & Intent | Add keyword seeds | Content gaps | Yes |
| 06 Offer Diagnostic | Add funnel stage | Activation metrics | Yes |

All five use the same `agent collects → TypeScript validates → HTML renders` flow.
