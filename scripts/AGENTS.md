# AGENTS.md - scripts

## Purpose

- Owns repository automation, diagnostics, soak harnesses, canaries, proof scripts, environment helpers, and one-off recovery scripts.

## Ownership

- Stable npm-called scripts are owned here and referenced from root `package.json`.
- `zz-*` files are diagnostic/recovery/proof scripts unless promoted into stable automation.

## Local Contracts

- Scripts that mutate external state, DB state, env vars, or production resources must make that side effect obvious in name, args, logs, and docs.
- Do not log secrets.
- Use typed inputs, explicit env checks, and clear failure messages.
- Keep scripts idempotent where feasible; otherwise require explicit flags for dangerous operations.

## Gate-script atomic-commit boundary (`test:gate`)

`package.json` `test:gate` runs four `node --test` suites, and each suite imports the
`zz-*.mjs` it grades. These form ONE atomic commit unit — committing the `package.json`
line without the referenced scripts breaks `npm run test:gate` in a clean checkout.
Land together, never partial-commit:

- `package.json` (the `test:gate` line)
- `scripts/zz-buyer-eval.checks.test.mjs` → `scripts/zz-buyer-eval.mjs` (already tracked)
- `scripts/zz-judge-run.gate.test.mjs` → `scripts/zz-judge-run.mjs` (already tracked)
- `scripts/zz-release-gate.gate.test.mjs` → `scripts/zz-release-gate.mjs`
- `scripts/zz-saaslaunch-coverage-eval.checks.test.mjs` → `scripts/zz-saaslaunch-coverage-eval.mjs`

When adding a new gate suite to `test:gate`, add its test file AND the impl it imports in
the same change, and update this list.

## Work Guidance

- Prefer existing script patterns before adding a new runner.
- If a script becomes durable workflow, document it in `scripts/README.md` or the nearest owning doc.
- Keep throwaway outputs under `tmp/` unless the artifact is intentionally tracked.

## Verification

- Run the script in dry-run mode when available.
- Run TypeScript/lint checks for touched scripts when practical; report pre-existing repo-wide noise honestly.

## Child DOX Index

- No child `AGENTS.md` files yet.
