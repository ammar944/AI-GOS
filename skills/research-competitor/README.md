# research-competitor

Section 03 — Competitor Landscape & Positioning

## Design philosophy

**The agent collects. TypeScript validates and renders.**

No external APIs. No Serper. No Firecrawl. No Meta API tokens. The agent uses its own `web_search`, `browser_navigate`, and `browser_snapshot` tools to gather raw data. The TypeScript layer is a schema validator + HTML renderer.

## Folder structure

```
skills/research-competitor/
  schemas/
    input.ts         # Zod — onboarding payload (what the user provides)
    output.ts        # Zod — typed output (what the agent produces)
  scripts/
    generate-report.ts   # JSON → HTML renderer (no external deps)
  example/
    input.json       # Realistic onboarding payload (Linear)
    output.json      # Fully populated typed output
  .claude/commands/research-competitor.md   # Slash command for Claude Code
  .claude/skills/research-competitor/      # Hermes skill bridge
  SKILL.md         # Human-readable spec
  README.md        # This file
```

## How it works

### 1. Input
User provides a URL or company name. The agent resolves it, or the user provides a sealed JSON payload matching `schemas/input.ts`.

### 2. Collection (agent does this)
The agent uses native tools:
- `web_search` — discover competitors, find review sites, search ad libraries
- `browser_navigate` + `browser_snapshot` — visit homepages, pricing pages, Meta Ad Library
- Every page visit records `source_url` + `retrieved_at`

### 3. Normalization (agent does this)
The agent populates the output JSON by hand from gathered data. TypeScript doesn't collect — it only validates.

### 4. Validation
```bash
cd skills/research-competitor
npx tsc --noEmit -p tsconfig.json   # Types pass
node -e "const s=require('./schemas/output'); console.log('schema loaded')"
```

### 5. Report generation
```bash
npx tsx scripts/generate-report.ts output.json report.html
```

## Running in Claude Code

```
/research-competitor https://linear.app
```

Claude Code loads `.claude/commands/research-competitor.md` which instructs it to use web_search + browser tools, normalize to schema, and render HTML.

## Running standalone

If you have an agent-typed output JSON:
```bash
npx tsx scripts/generate-report.ts example/output.json /tmp/report.html
open /tmp/report.html
```

## Extending to other sections

| Section | What changes |
|---------|-------------|
| 01 Market & Category | Swap input fields (category, TAM signals), output fields (market size, maturity) |
| 02 Buyer & ICP | Swap input (persona anchors), output (awareness map, job titles) |
| 04 Voice of Customer | Same tools, different search queries (reddit, HN, reviews) |
| 05 Demand & Intent | Keyword research focus, content gap mining |
| 06 Offer Diagnostic | Funnel data, activation metrics, churn signals |

The pattern stays identical: **agent collects → TypeScript validates → HTML renders**.

## Verification gate

Before declaring done:
1. `npx tsc --noEmit` passes
2. Every output field has `source_url` + `retrieved_at`
3. Zero scores, zero recommendations, zero "our advantage"
4. Raw data present in `example/output.json`
