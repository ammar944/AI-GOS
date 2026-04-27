# research-market

Category: **research**

Market and category research — fans out subagents to collect TAM signals, category maturity, timing, and competitive intensity. Agent collects. TypeScript validates and renders.

## Design philosophy

**The agent collects. TypeScript validates and renders.** This skill is fully self-contained: every script, schema, prompt, and asset lives inside this folder. No imports outside `skills/research-market/`.

## Folder structure

```
research-market/
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
cd skills/research-market
npm install
npx tsx scripts/validate.ts example/output.json
npx tsx scripts/generate-report.ts example/output.json /tmp/research-market-report.html
open /tmp/research-market-report.html
```

## Running in Claude Code

```
/research-market <arguments>
```

Claude Code loads the bridge at `.claude/skills/research-market/` which delegates to this full implementation.
