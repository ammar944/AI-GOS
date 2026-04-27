#!/usr/bin/env tsx
// Regenerates .claude/workspaces/v3-migration/workspace-map.md from
// src/lib/skills/route-table.ts. The route-table is canonical; this doc is
// derived. Run after editing the table:  npx tsx scripts/generate-workspace-map.ts

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTES_BY_SKILL, type RouteKind, type RouteRow } from '../src/lib/skills/route-table';

const KIND_HEADERS: Record<RouteKind, string> = {
  ingest: 'Ingest layer',
  research: 'Research layer',
  synthesize: 'Synthesize layer',
  interaction: 'Sidecar — interaction',
  presenter: 'Sidecar — presenter',
};

const KIND_ORDER: RouteKind[] = ['ingest', 'research', 'synthesize', 'interaction', 'presenter'];

function row(r: RouteRow): string {
  const tool = r.workerTool ?? '—';
  const section = r.dispatchSection ?? '—';
  return `| ${r.task} | \`${r.command}\` | \`${r.skill}\` | ${tool === '—' ? '—' : `\`${tool}\``} | ${section === '—' ? '—' : `\`${section}\``} | ${r.status} |`;
}

function section(kind: RouteKind, rows: RouteRow[]): string {
  if (rows.length === 0) return '';
  return [
    `## ${KIND_HEADERS[kind]}`,
    '',
    '| Task | Command | Skill | Worker Tool | Dispatch Section | Status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row),
    '',
  ].join('\n');
}

function build(): string {
  const all = Object.values(ROUTES_BY_SKILL);
  const grouped = KIND_ORDER.map((kind) => section(kind, all.filter((r) => r.kind === kind))).filter(Boolean);

  return [
    '# AIGOS v3 Workspace Map',
    '',
    '**Generated** from `src/lib/skills/route-table.ts`. Do not edit by hand —',
    'run `npx tsx scripts/generate-workspace-map.ts` after editing the route table.',
    '',
    '**Scope:** every user-invokable v3 skill, mapped to its slash command, the',
    'production worker tool it bridges to (matches `TOOL_RUNNERS` in',
    '`research-worker/src/index.ts`), the dispatch pipeline section it owns',
    '(matches `DISPATCH_PIPELINE_ORDER` in `src/app/api/journey/dispatch/route.ts`),',
    'and migration status. `—` means no production counterpart yet.',
    '',
    '**Status:** see `tracker.md`. Only `Wired` rows are safe for production',
    'dispatch; everything else still flows through the legacy `dispatch/route.ts`',
    '→ worker `TOOL_RUNNERS` path directly.',
    '',
    ...grouped,
    '## Notes',
    '',
    '- `chat-refine` is `kind: interaction` — edits cards, never dispatches research.',
    '- `present-workspace` is `kind: presenter` — renders / maps cards, never dispatches.',
    '- Skills with `Worker Tool: —` are v3-only and have no legacy production counterpart.',
    '- `research-cross` bridges to worker tool `synthesizeResearch` (file `research-worker/src/runners/synthesize.ts`); the legacy export is named for synthesis but produces cross-section output.',
    '',
  ].join('\n');
}

const outPath = resolve(process.cwd(), '.claude/workspaces/v3-migration/workspace-map.md');
writeFileSync(outPath, build(), 'utf8');
console.log(`Wrote ${outPath}`);
