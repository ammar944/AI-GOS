# ingest-docs

Document ingest for the AIGOS v3 `enrich-brief` stage.

This skill parses uploaded business documents, classifies them, and emits sourced field evidence that can enrich the GTM brief before review. It is self-contained and does not import from the app, worker, root libraries, or other skills.

## Folder structure

```
ingest-docs/
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
cd skills/ingest-docs
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
npm test
```

## Contract

- Input schema: `schemas/input.ts`
- Output schema: `schemas/output.ts`
- Collection rules: `references/rules.md`
- Runtime prompt: `references/collector.md`

TXT and Markdown documents parse locally. PDF and DOCX inputs fail with explicit actionable errors in this local fixture implementation unless text has already been extracted upstream into a supported text format. Facts must be sourced with `source_url` and `retrieved_at`; unknown values are omitted or emitted as empty arrays.
