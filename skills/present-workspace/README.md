# present-workspace

Category: **presentation / write-back**

Maps validated AIGOS v3 skill outputs into Journey workspace cards and exercises the write-back contract in dry-run or mock mode.

## Design

This is downstream presentation plumbing. It does not collect facts, call LLMs, or import the root app. It duplicates the small workspace primitives it needs so the skill stays portable.

## Folder structure

```
present-workspace/
├── SKILL.md              # behavior + frontmatter
├── README.md             # this file
├── package.json
├── tsconfig.json
├── schemas/              # input and output Zod contracts
├── references/           # card taxonomy and write-back rules
├── scripts/              # deterministic TypeScript gates and orchestrator
└── example/              # dry-run fixture
```

## Running standalone

```bash
cd skills/present-workspace
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
npm test
```

## Write contract

`scripts/write-supabase.ts` defines the typed Supabase write contract and only ships dry-run/mock backing. `npm test` does not import `@supabase/supabase-js`, read env vars, or make a network call.

The production runtime can inject a real transport later, but this skill folder does not contain that live runtime path.
