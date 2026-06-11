# AGENTS.md - src/lib/lab-engine

## Purpose

- Owns the in-process lab engine that generates, validates, verifies, repairs, and streams positioning section artifacts.

## Ownership

- `agents/` owns section execution, answer-tool flow, tool registry, repairs, streaming consumption, and verification orchestration.
- `artifacts/` owns schema-validated output shapes.
- `sections/` owns section registry, sub-section definitions, and evidence requirements.
- `skills/` owns prompt skill files for each positioning section.
- `ai/`, `events/`, `runs/`, `streaming/`, and `fixtures/` own their named engine support concerns.

## Local Contracts

- Lab-engine section execution runs in the Next.js/Vercel process, not in `research-worker/`.
- Do not import worker code.
- Preserve real-tool, source-backed research behavior. No unsupported load-bearing claims should be marked as clean output.
- Structural verifier, required-evidence gates, and evidence-support repair are part of the quality path.
- Provider selection belongs in `ai/models.ts` and related env handling.

## Work Guidance

- When adding or changing a section output field, update schemas, renderer(s), tests, verification requirements, and persistence consumers.
- Keep prompts evidence-seeking but keep hard validation in code.
- Keep cost and timeout behavior explicit for live tools and model calls.

## Verification

- Run `npm run test:run -- src/lib/lab-engine`.
- For renderer-facing artifact changes, also run `npm run test:run -- src/components/research-v2`.

## Child DOX Index

- `agents/AGENTS.md` - Section runners, tool orchestration, answer-tool flow, and verification execution.
- `agents/tools/AGENTS.md` - Live research tool integrations used by lab sections.
- `agents/verification/AGENTS.md` - Claim/evidence verification, support grading, and repair gates.
- `artifacts/AGENTS.md` - Lab artifact schemas and schema tests.
- `skills/AGENTS.md` - Positioning prompt skills and prompt contracts.
