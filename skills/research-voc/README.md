# research-voc

Category: research

Category voice-of-customer mining for AIGOS v3 Wave 2. This package turns a locked GTM brief plus identity output into a sourced VoC card while excluding the subject company, competitors, and known alternatives.

## Boundary

This skill collects problem-space language only. It does not mine named competitor reviews, ad libraries, pricing, positioning, persona strategy, scripts, UI cards, or Supabase rows.

There is no legacy `research-worker/src/runners/*voc*` runner. The adjacent competitor runner was inspected for overlap boundaries only.

## Folder structure

```
research-voc/
├── SKILL.md
├── README.md
├── package.json
├── tsconfig.json
├── schemas/
│   ├── input.ts
│   └── output.ts
├── scripts/
│   ├── build-exclusions.ts
│   ├── filter-competitor-leakage.ts
│   ├── orchestrate.ts
│   ├── sanity-check.ts
│   └── validate.ts
├── references/
│   ├── collector.md
│   └── rules.md
└── example/
    ├── input.json
    └── output.json
```

## Running

```bash
cd skills/research-voc
npm install
npm test
npm run orchestrate -- example
```

## Validation

`npm run validate` checks `example/input.json` and `example/output.json`.

`npm run sanity-check example/output.json` blocks:

- missing `source_url` or `retrieved_at`
- placeholder values such as `unknown`, `TBD`, `n/a`, or `scaffold`
- excluded company or product names inside quotes, claims, workarounds, or source titles
- product-specific review-site evidence
- imports from outside this skill package

`npm run orchestrate -- example` builds the canonical exclusion list from input before final output validation.
