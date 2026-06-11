# AGENTS.md - src/lib

## Purpose

- Owns app domain logic, service integrations, schemas, orchestration, persistence helpers, AI/provider contracts, and reusable non-UI code.

## Ownership

- `lab-engine/` owns in-process section generation and verification.
- `research-v2/` owns orchestration glue for the live research backend.
- `journey/` owns journey/session contracts, dispatch helper, realtime hook, and field catalog.
- `ai/` owns provider configuration, AI helpers, and AI tool wrappers outside the lab engine.
- `saaslaunch/` owns internal SaaSLaunch landing analytics contracts, registry validation, event ingest helpers, and internal dashboard read models.
- Other folders own their named domain concerns unless a closer `AGENTS.md` exists.

## Local Contracts

- Keep functions pure where possible and explicit about side effects.
- Validate boundary data with Zod.
- Keep server-only code out of client-consumed modules.
- Do not import from `research-worker/`.
- Any shape shared with `research-worker/` must be mirrored intentionally in worker contracts.

## Work Guidance

- Put durable logic here instead of in route handlers or components.
- Keep vendor integrations isolated by vendor/domain folder.
- Prefer existing logger/env/error utilities over one-off patterns.

## Verification

- Run scoped tests for changed domains, for example `npm run test:run -- src/lib/research-v2`.
- Run broader `npm run test:run` when shared contracts, schemas, or persistence helpers change.

## Child DOX Index

- `ai/AGENTS.md` - App AI providers, prompts, and non-lab AI tools.
- `journey/AGENTS.md` - Journey/session contracts, dispatch helper, realtime, and field catalog.
- `lab-engine/AGENTS.md` - In-process section agent engine, tools, verification, schemas, and prompt skills.
- `research-v2/AGENTS.md` - Live research orchestration, state, persistence, partials, and sharing glue.
- `saaslaunch/` - Internal SaaSLaunch landing analytics contracts, validation, ingest persistence, and dashboard read models.
- `workspace/AGENTS.md` - Workspace card taxonomy and non-UI workspace helpers.
