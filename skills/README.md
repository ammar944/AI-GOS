# AIGOS Skills

This directory is the set of self-contained skills that implement every AIGOS pipeline stage. Designed to be published as an independent GitHub repo — each skill folder is fully portable.

## Architecture

See `.claude/architecture/v3-skill-first.md` in the AIGOS repo for the design doc.

Each skill follows the Anthropic-canonical layout:

```
skills/<name>/
├── SKILL.md              # behavior + YAML frontmatter (name, description, version)
├── README.md             # human docs
├── package.json          # skill's own TypeScript deps
├── tsconfig.json
├── references/           # loaded on demand — schemas (input/output), prompts (collector, subagent-*)
├── scripts/              # deterministic TypeScript — validate, sanity-check, generate-report, orchestrate
├── assets/               # templates used in output (HTML shell, CSS)
└── example/              # fixture (input.json + output.json)
```

Each skill also has a thin bridge at `.claude/skills/<name>/` and a slash command at `.claude/commands/<name>.md` inside the AIGOS repo for Claude Code invocation.

## Skills

### Ingestion (4 skills)

Take user inputs and produce structured context for downstream research.

- **`ingest-url`** — URL → company metadata → prefilled field-catalog payload
- **`ingest-fathom`** — Fathom recording ID → structured sales-call intelligence block
- **`ingest-docs`** — User-uploaded PDFs/DOCX → structured business-profile fields
- **`ingest-identity`** — Raw company data → canonical identity card

### Research (7 skills — fan-out pattern)

Each research skill uses the same pattern pioneered by `research-competitor`: a scout agent discovers sources, fan-out subagents collect in parallel, and a deterministic TypeScript tail merges + validates + renders.

- **`research-competitor`** ✅ *reference implementation* — Competitor landscape, positioning, ads, SoV
- **`research-market`** — Category, TAM, maturity, competitive intensity
- **`research-icp`** — Buyer persona, awareness map, job titles, pains
- **`research-offer`** — Offer clarity, activation, pricing reality, churn
- **`research-keywords`** — High-intent queries, content gaps
- **`research-voc`** — Voice of customer from Reddit, HN, reviews, publications
- **`research-cross`** — Cross-section synthesis (reads other skills' outputs, produces unified brief)

### Synthesis (3 skills)

Turn research outputs into strategic artifacts.

- **`synthesize-positioning`** — Research → positioning statement + villain/hero arc
- **`synthesize-media-plan`** — Research + positioning → paid media plan (campaigns, ad groups, creative angles)
- **`synthesize-scripts`** — Research + positioning → ICM-structured 60/30/10 ad scripts

### Interaction (2 skills)

User-facing runtime surfaces.

- **`chat-refine`** — Post-research refinement chat — edits already-rendered cards, deep-dives, regenerates fragments
- **`present-workspace`** — Renders skill outputs into journey workspace UI cards

## Design philosophy (all skills)

> **The agent collects. TypeScript validates and renders.**

- No skill imports from outside its own folder — every skill is portable
- Every output field carries `source_url` + `retrieved_at` — no fabrication
- Facts only — no LLM-scored metrics ("7/10"), no recommendations
- Fail loudly — `scripts/sanity-check.ts` enforces integrity gates before report generation

## Running a skill

Inside Claude Code (AIGOS repo):

```
/<skill-name> <input>
```

Standalone (once implemented):

```bash
cd skills/<name>
npm install
npx tsx scripts/validate.ts example/output.json
npx tsx scripts/generate-report.ts example/output.json /tmp/report.html
```

## Status

- `research-competitor` — v2.0.0, fully implemented
- All 15 others — scaffolded stubs at v0.1.0. Implementation is Phase B of the v3 migration.
