# chat-refine

Category: **interaction**

Post-research refinement chat — exposes tools for editing already-rendered cards, deep-diving into specific sections, and regenerating fragments. Does not trigger new research.

## Design philosophy

**The agent collects. TypeScript validates and renders.** This skill is fully self-contained: every script, schema, prompt, and asset lives inside this folder. No imports outside `skills/chat-refine/`.

## Folder structure

```
chat-refine/
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
cd skills/chat-refine
npm install
npx tsx scripts/validate.ts example/output.json
npx tsx scripts/generate-report.ts example/output.json /tmp/chat-refine-report.html
open /tmp/chat-refine-report.html
```

## Running in Claude Code

```
/chat-refine <arguments>
```

Claude Code loads the bridge at `.claude/skills/chat-refine/` which delegates to this full implementation.
