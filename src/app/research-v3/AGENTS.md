# AGENTS.md - src/app/research-v3

## Purpose

- Owns the canonical live research front door and Audit Reader page.

## Ownership

- `page.tsx` owns URL entry, corpus/onboarding/sections state transitions, and composition of research-v2/v3 UI.
- `layout.tsx` owns route-level layout concerns.
- Tests in `__tests__/` own page hydration and state behavior.

## Local Contracts

- The flow is form-driven: URL entry, corpus dispatch, GTM Brief review, orchestrated section fan-out, Audit Reader rendering, profile persistence.
- Chat is post-research editing/explanation, not research kickoff.
- Do not reintroduce sequential operator-click section execution unless explicitly requested.
- Preserve realtime/polling behavior and error recovery paths.

## Work Guidance

- Keep heavy logic in `src/lib/research-v2/`, `src/lib/journey/`, or components.
- Keep page state transitions consistent with `src/lib/research-v2/state-machine.ts`.
- When changing user-visible research stages, update reader config and tests.

## Verification

- Run `npm run test:run -- src/app/research-v3 src/components/research-v3 src/components/research-v2`.
- Use browser verification for UI/state changes.

## Child DOX Index

- No child `AGENTS.md` files yet.
