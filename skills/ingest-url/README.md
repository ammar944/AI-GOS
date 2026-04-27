# ingest-url

Category: ingest

URL intake for AIGOS v3 Wave 4. It takes a company URL, discovers high-signal public pages, extracts sourced company metadata, and emits reviewable GTM brief prefill fields.

## Design philosophy

The agent or provider collects. TypeScript validates, filters, normalizes, and blocks unsafe output. This skill is self-contained and imports nothing from `src/`, `research-worker/`, root `lib/`, or another skill.

## Folder structure

```text
ingest-url/
├── SKILL.md
├── README.md
├── package.json
├── tsconfig.json
├── schemas/
├── scripts/
├── references/
└── example/
```

## Running standalone

```bash
cd skills/ingest-url
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
npm test
```

## Notes

- `scripts/orchestrate.ts` is fixture-only and deterministic in this wave.
- `scripts/discover-pages.ts` exposes URL cleanup, filtering, dedupe, page typing, and ranking.
- `scripts/normalize-fields.ts` maps legacy field names into current GTM brief keys before output.
- The skill never writes Supabase rows and never emits research cards.
