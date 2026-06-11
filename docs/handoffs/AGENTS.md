# AGENTS.md - docs/handoffs

## Purpose

- Owns executable handoffs, specs, and implementation contracts for future agent runs.

## Ownership

- Each handoff owns its exact cwd, branch/worktree, scope, constraints, commands, success gates, and proof artifacts.

## Local Contracts

- Handoffs must be precise enough to execute without repo memory.
- Include exact paths, run IDs, command lines, env assumptions, and verification gates when relevant.
- Preserve explicit constraints such as read-only, one-run, no-retry, no-code-edit, or close-after-success.
- Remove or update stale instructions that contradict current source or DOX.

## Work Guidance

- Keep handoffs focused on the next execution step, not a diary of all prior work.

## Verification

- Validate referenced paths with `rg --files` or direct path reads when updating a handoff.

## Child DOX Index

- No child `AGENTS.md` files yet.
