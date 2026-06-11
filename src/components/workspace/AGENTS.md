# AGENTS.md - src/components/workspace

## Purpose

- Owns the workspace shell, artifact grid, post-research cards, report sources, section tabs, and workspace hydration UI.

## Ownership

- `manus-workspace-shell.tsx`, provider/hydration files, and card components own the post-research editing and review surface.
- Shared card taxonomy and data contracts live in `src/lib/workspace/`.

## Local Contracts

- Workspace UI is for review, chat/edit, and artifact inspection. It must not become a hidden research kickoff path.
- Cards render typed data and should not fabricate research content.
- Preserve existing card component contracts and tests when adding new card types.

## Work Guidance

- Add focused tests for new cards or hydration behavior.
- Keep card composition scan-friendly and consistent with existing workspace patterns.

## Verification

- Run `npm run test:run -- src/components/workspace src/lib/workspace`.

## Child DOX Index

- No child `AGENTS.md` files yet.
