# AGENTS.md - docs

## Purpose

- Owns durable project documentation: source maps, architecture notes, ADRs, handoffs, plans, reports, specs, corpus docs, design docs, migrations notes, and archives.

## Ownership

- `source-map.md` is the verified architecture map and should be kept current when architecture moves.
- `adr/` owns durable decisions.
- `handoffs/` owns executable handoff/spec contracts.
- `plans/`, `reports/`, `specs/`, `design/`, `architecture/`, `corpus/`, and `migrations/` own their named documentation domains.
- `_archive/` owns retired docs.

## Local Contracts

- Documentation must distinguish current behavior from plan/proposal/history.
- Do not leave stale instructions that contradict code or closer DOX files.
- Use exact paths, commands, run IDs, branch names, dates, and evidence links when a doc depends on them.
- Do not duplicate broad repo rules already owned by root `AGENTS.md`.

## Work Guidance

- Prefer updating the closest durable doc over adding a new one.
- Move stale material to `_archive/` only when it is no longer operational.
- Keep handoffs executable and reports evidence-backed.

## Verification

- Documentation-only edits require `git diff --check`.
- Architecture doc changes should be checked against source paths with `rg --files`.

## Child DOX Index

- `adr/AGENTS.md` - Architecture decision records.
- `handoffs/AGENTS.md` - Executable handoff/spec files.
- `plans/AGENTS.md` - Planning docs and roadmaps.
- `reports/AGENTS.md` - Evidence reports, QA reports, and review findings.
- `_archive/AGENTS.md` - Retired or historical documentation.
