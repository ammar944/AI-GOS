# scripts/

Deterministic TypeScript. Runs after the agent has collected fragments.

Expected contents:

- `orchestrate.ts` — fan-in coordinator (validates pre-conditions, spawnSync's the tail)
- `merge-fragments.ts` — fan-in fragments from subagents into the main output
- `validate.ts` — Zod validation against `references/output-schema.ts`
- `sanity-check.ts` — integrity gates; FAIL on broken data, WARN on suspect data
- `generate-report.ts` — JSON → HTML renderer using `assets/report-shell.html`
- `screenshot.ts` — (optional) Playwright screenshot of the rendered report

Any skill-specific helpers (name-matcher, cache, ad-fetcher) live here too. No imports outside this skill.
