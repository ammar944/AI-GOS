# AGENTS.md - research-worker/evals

## Purpose

- Owns worker evaluation scripts, baselines, corpus minimum checks, snapshots, diffs, golden data, and eval tests.

## Ownership

- Eval scripts own repeatable worker-quality checks and should not be used as hidden production code.
- `golden/` owns expected fixture data.
- `out/` owns generated eval output when tracked or intentionally retained.

## Local Contracts

- Keep eval inputs, model/provider assumptions, and output paths explicit.
- Do not silently relax eval thresholds to pass a run.
- Generated eval artifacts should be clearly separated from source/golden files.

## Work Guidance

- Prefer deterministic fixture-backed checks before live paid API evals.
- Document required env vars in the script or README when adding live evals.

## Verification

- Run the specific eval/test changed, then `cd research-worker && npm run build` when TypeScript changes are made.

## Child DOX Index

- No child `AGENTS.md` files yet.
