---
name: research-competitor
description: Use when running AIGOS competitor research, competitor intelligence, competitor landscape analysis, ad library research, pricing/review mining, or share-of-voice research for a company, product, URL, or market. The agent collects sourced facts and then runs deterministic TypeScript validation/report scripts from this skill folder.
---

# Section 03 — Competitor Landscape & Positioning

## Trigger
`@research-competitor { "company_name": "Linear", ... }`

## What it does
Takes a sealed onboarding payload (company, product, ICP, stated competitors) and returns a typed competitor landscape. Every field carries `source_url` + `retrieved_at`. Unsourceable fields are omitted, not hallucinated.

## Design rules (non-negotiable)
1. Facts only — no recommendations, no "our advantage", no counter-positioning.
2. No LLM-scored metrics. If a dimension isn't externally measurable, drop it.
3. Every claim sourced with URL + timestamp.
4. Sealed per-run context — no cross-account bleed.
5. Agent collects, TypeScript validates, HTML renders.

## Architecture

```
skills/research-competitor/
  schemas/
    input.ts           # Zod — onboarding payload (what the user provides)
    output.ts          # Zod — typed output (what the agent produces)
  scripts/
    # LLM-agent work is the fan-out phase (prompts/competitor-subagent.md and
    # prompts/sov-subagent.md). Everything below is deterministic Node.
    orchestrate.ts     # End-to-end runner: merge-fragments → fetch-ads →
                       #   merge-ads → merge-sov → validate → generate-report → screenshot
    name-matcher.ts    # Jaro-Winkler + normalizeCompanyName + resolveBestCandidate.
                       #   Ported from research-worker/src/utils + adlibrary.ts.
                       #   Prevents short-name false positives (e.g. Fathom ≠ Fathom Inc).
    cache.ts           # 24h disk cache for SearchAPI responses (SHA-256 URL hash,
                       #   stored at /tmp/research-competitor-cache/). Secrets stripped
                       #   before hashing. CLI: `tsx cache.ts stats|clear`.
    fetch-ads.ts       # Multi-platform ads fetcher: Meta + LinkedIn + Google.
                       #   Uses resolver + cache. Mirrors research-worker/src/tools/adlibrary.ts.
                       #   Single: `tsx fetch-ads.ts <name> [domain] [--platforms meta,linkedin,google]`
                       #   Batch:  `tsx fetch-ads.ts --batch competitors.json`
                       #   Output v2: [{ competitor, platforms: [{platform, inventory, signals}] }]
    merge-fragments.ts # Assembles per-competitor LLM fragment JSONs into output.json
    merge-ads.ts       # Flattens multi-platform ads batch into output.json
    merge-sov.ts       # Splices share_of_voice.json fragment into output.json
    validate.ts        # Zod schema gate
    sanity-check.ts    # Integration + completeness heuristics between merge and validate.
                       #   FAILS on: all-zero ads (≥3 competitors), subject missing from set.
                       #   WARNS on: <5 reviews/polarity, SoV names outside seed+excluded,
                       #             paraphrase markers in *_verbatim fields.
                       #   Override: ALLOW_SUSPECT=1 or --allow-suspect.
    generate-report.ts # Editorial HTML renderer (Fraunces + IBM Plex). Renders:
                       #   masthead, exec stats, sticky TOC, comparison matrix with
                       #   per-platform pills, stacked-bar ads chart by platform,
                       #   per-competitor posters with platform sub-panels, pricing
                       #   grid, reviews, villain/hero/transformation arc, SoV.
    screenshot.ts      # Optional: renders report.html → report.png via playwright
                       #   (falls back to puppeteer-core + system Chrome).
                       #   Soft-fails if no headless browser is installed.
  prompts/
    collector.md            # Overall scout prompt (discovers competitor_set)
    competitor-set-analyst.md # Pre-flight category frame + source-weighted competitor list
    competitor-subagent.md  # Per-competitor fan-out prompt (positioning / pricing / reviews / narrative)
    sov-subagent.md         # Share-of-voice sub-agent prompt (Reddit / HN / publications)
  example/
    input.json         # Realistic onboarding payload (Linear)
    output.json        # Fully populated typed output
  .claude/commands/research-competitor.md   # Slash command for Claude Code
  package.json
  tsconfig.json
  SKILL.md
  README.md

## Runtime topology

```
┌──────────────────────┐
│ Scout (main agent)   │  discovers competitor_set (6–10) · writes initial
│  WebFetch/WebSearch  │  output.json + competitors.json + fragments/ dir
└────────┬─────────────┘
         │ one parallel tool-use message dispatches N+1 subagents
         ▼
┌─────────────────────────────────────────┐     ┌──────────────────────────────┐
│ Collectors  N parallel agents           │     │ SoV sub-agent                │
│   one per competitor                    │     │   Reddit / HN / publications │
│   homepage + pricing + G2 + narrative   │     │   writes share_of_voice.json │
│   writes fragments/<slug>.json          │     │   4min / 12 tool calls       │
│   4min / 12 tool calls each             │     └────────┬─────────────────────┘
└────────┬────────────────────────────────┘              │
         │ fan-in to $RUN_DIR/fragments/                  │
         ▼                                                ▼
┌────────────────────────────────────────────────────────────────────┐
│ orchestrate.ts (deterministic Node pipeline)                       │
│   1 merge-fragments.ts  → positioning / pricing / reviews / arc    │
│   2 fetch-ads.ts --batch → Meta + LinkedIn + Google (via SearchAPI,│
│                              resolver + 24h cache)                 │
│   3 merge-ads.ts         → splice ads into output.json             │
│   4 merge-sov.ts         → splice share_of_voice fragment           │
│   5 validate.ts          → Zod gate                                │
│   6 generate-report.ts   → report.html (editorial, multi-platform) │
│   7 screenshot.ts        → report.png (optional, via playwright)   │
└────────────────────────────────────────────────────────────────────┘
```

## Environment

- `SEARCHAPI_KEY` — required for ad fetching (Meta, LinkedIn, Google). Read from
  `process.env`. Skill sources `.env.local` from the AI-GOS repo root at
  pipeline time; never prints or logs the key.
- `RESEARCH_COMPETITOR_CACHE_DIR` — optional override for the disk cache
  (default: `/tmp/research-competitor-cache`). TTL: 24h.
- `DEBUG_FETCH_ADS=1` — log cache hits for the ads fetcher.

## Cost

With cold cache + 3 platforms × 10 competitors: ~40 SearchAPI calls (page search
+ ad fetch × 3 platforms, plus some fallbacks). With warm cache within 24h:
0–4 calls (only new competitors refetched).
```

## Invoking

**Inside Claude Code / Hermes:**
```
@research-competitor { "company_name": "Linear", ... }
```
The agent uses its own `web_search`, `browser_navigate`, and `browser_snapshot` tools to gather raw data, populates the output JSON by hand, and validates with `npm run validate`.

**Standalone (CLI):**
```bash
cd skills/research-competitor
npm install
npm run validate         # Check example/output.json against schema
npm run report output.json /tmp/report.html
```

**Via API later:**
```
POST /api/v1/research/competitor
Body:   ResearchCompetitorInput
Response: ResearchCompetitorOutput
```

## Critical Rules (enforced by sanity-check.ts)

1. **Ad integration integrity.** If ≥3 competitors all show `active_ad_count == 0` across platforms, FAIL — broken advertiser-name matching or missing `SEARCHAPI_KEY` is orders of magnitude more likely than "none of them advertise". Run the single-name fetch on a known-heavy advertiser (monday.com, ClickUp) to confirm before overriding.
2. **Review saturation floor.** Each competitor needs ≥5 verbatim quotes per polarity for pattern-level signal. Below floor = warn with reason; never fabricate to hit the floor.
3. **Seed list cross-check.** Names mentioned in ≥2 SoV publications but not in `competitor_set` are flagged. Resolve by either expanding `competitor_set` or logging to `$RUN_DIR/excluded_seeds.json`.
4. **Subject in frame.** `source_company_name` MUST appear in `competitor_set` with `type: "subject"`. Landscape without subject cannot be benchmarked.
5. **Verbatim means verbatim.** `*_verbatim` fields quote directly; paraphrase markers (`Summary:`, `[paraphrased]`, `approximately`, `in essence`, `roughly`) trigger WARN. Omit rather than paraphrase.

## Verification gate
Before declaring done:
1. `npm run check` passes (tsc --noEmit)
2. `npm run sanity-check <output.json>` exits 0 (no FAILs)
3. `npm run validate` passes every output.json
4. Every output field has `source_url` + `retrieved_at`
5. Zero scores, zero recommendations, zero "our advantage"
6. `subject` competitor present in `competitor_set` and rendered in the report
