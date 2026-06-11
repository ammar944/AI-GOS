# AGENTS.md - research-worker/src/competitors

## Purpose

- Owns legacy worker competitor modules and worker-side competitor support code.

## Ownership

- This folder does not own live in-process positioning section execution.
- Current live competitor/positioning section behavior belongs in `src/lib/lab-engine/`.

## Local Contracts

- Do not edit this folder to change live Audit Reader positioning behavior unless the task explicitly names the worker competitor path.
- If a worker-backed corpus path still calls this code, preserve source-backed outputs and worker contracts.
- Do not import app lab-engine code into the worker.

## Work Guidance

- Before editing, prove the caller path still uses this worker module.
- Prefer fixing live lab-engine paths in `src/lib/lab-engine/` when the issue is with current section output.

## Verification

- Run targeted worker tests and `cd research-worker && npm run build`.

## Child DOX Index

- No child `AGENTS.md` files yet.
