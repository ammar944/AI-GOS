# AGENTS.md - research-worker/src/intelligence

## Purpose

- Owns worker intelligence cards, evidence packing, dispatcher logic, and fabrication checks.

## Ownership

- This folder owns worker-side intelligence shaping before data is written back or consumed by app contracts.

## Local Contracts

- Evidence-backed outputs must keep their source references.
- Fabrication sweeps must remain visible and must not be bypassed for cleaner-looking output.
- Contract changes must be coordinated with worker schemas and app consumers.

## Work Guidance

- Prefer explicit card schemas and deterministic checks before model-written prose.

## Verification

- Run relevant worker tests and `cd research-worker && npm run build`.

## Child DOX Index

- No child `AGENTS.md` files yet.
