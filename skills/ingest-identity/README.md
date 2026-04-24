# ingest-identity

Category: **ingest**

Identity resolution — given raw company data, resolves the canonical identity card: who they are, what they do, core keywords, negative keywords.

## Design philosophy

**The agent collects. TypeScript validates and renders.** This skill is fully self-contained: every script, schema, prompt, and asset lives inside this folder. No imports outside `skills/ingest-identity/`.

## Folder structure

```
ingest-identity/
├── SKILL.md              # behavior + frontmatter
├── README.md             # this file
├── package.json
├── tsconfig.json
├── references/           # loaded on demand — schemas, prompts, rules
├── scripts/              # deterministic TypeScript — validate, render, sanity-check
├── assets/               # templates used in output (HTML shell, CSS)
└── example/              # fixture (input.json + output.json)
```

## Running standalone

Once implemented:

```bash
cd skills/ingest-identity
npm install
npx tsx scripts/validate.ts example/output.json
npx tsx scripts/generate-report.ts example/output.json /tmp/ingest-identity-report.html
open /tmp/ingest-identity-report.html
```

## Running in Claude Code

```
/ingest-identity <arguments>
```

Claude Code loads the bridge at `.claude/skills/ingest-identity/` which delegates to this full implementation.
