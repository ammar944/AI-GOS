---
description: Run the GTM workflow locally without production APIs, Supabase, Clerk, Railway, or live AI calls.
argument-hint: "[--snapshot path/to/brief-snapshot.json] [--out /tmp/aigos-gtm-local]"
---

# /gtm-local-run

Use this for local/dev GTM workflow work before production wiring exists.

This command runs the deterministic local GTM workflow runner in `research-worker/`.
It creates a run directory with:

- `manifest.json`
- `stages/01-discover-url.json`
- `stages/02-enrich-brief.json`
- ...
- `stages/13-generate-scripts.json`

No production systems are touched.

## Arguments

```bash
/gtm-local-run
/gtm-local-run --out /tmp/aigos-gtm-local
/gtm-local-run --snapshot /tmp/brief-snapshot.json --out /tmp/aigos-gtm-local
```

## Workflow

From the repo root:

```bash
cd research-worker
npm run gtm:local -- --out /tmp/aigos-gtm-local
```

With an explicit locked brief snapshot:

```bash
cd research-worker
npm run gtm:local -- --snapshot /tmp/brief-snapshot.json --out /tmp/aigos-gtm-local
```

## Stage command map

| Stage | Local command owner |
|---|---|
| `discover-url` | `/ingest-url` |
| `enrich-brief` | `/ingest-docs` |
| `review-brief` | `/present-workspace` |
| `lock-brief` | `/gtm-local-run lock-brief` |
| `research-market-category` | `/research-market` |
| `research-buyer-icp` | `/research-icp` |
| `research-competitors` | `/research-competitor` |
| `research-voc` | `/research-voc` |
| `research-demand-intent` | `/research-keywords` |
| `research-offer-funnel` | `/research-offer` |
| `synthesize-strategy` | `/synthesize-positioning` |
| `generate-media-plan` | `/synthesize-media-plan` |
| `generate-scripts` | `/synthesize-scripts` |

## How to use this during development

1. Run the local fixture workflow.
2. Pick one stage.
3. Replace that stage's fixture JSON with output from its command skill.
4. Validate the output shape before moving to the next stage.

This keeps AIGOS command-first while the app/API/database surface stays intentionally unwired.

## Verification

```bash
cd research-worker
npm run test:run -- src/runtime/__tests__/local-stage-registry.test.ts src/jobs/__tests__/run-gtm-workflow.test.ts src/dev/__tests__/run-local-gtm-cli.test.ts
npm run build
```
