# AGENTS.md - src/components

## Purpose

- Owns reusable React UI for product pages, Audit Reader rendering, workspace cards, shell/navigation, onboarding, and shadcn primitives.

## Ownership

- Component folders own rendering, layout, interaction, and local component tests.
- Data fetching, persistence, and AI/provider calls belong in routes or `src/lib/`.

## Local Contracts

- Use functional components with hooks.
- Use named exports and `Props`-suffixed prop interfaces.
- Use `cn()` or existing class utilities for conditional classes.
- Keep components deterministic from props and local UI state. Do not fabricate research content in renderers.
- Match the SaasLaunch design language and read `DESIGN.md` before visual/UI changes.

## Work Guidance

- Prefer existing primitives from `src/components/ui/`.
- Keep text sizes appropriate to the container.
- Avoid putting cards inside cards unless the existing component pattern requires it.
- Keep renderers resilient to missing optional fields while reporting invalid required data at the schema/API layer.

## Verification

- Run relevant component tests under the changed folder.
- Use browser screenshots/inspection for meaningful UI changes.

## Child DOX Index

- `research-v2/AGENTS.md` - Audit Reader shell, typed artifact renderer, section renderers, primitives, and UI kit.
- `research-v3/AGENTS.md` - v3 reader section configuration.
- `ui/AGENTS.md` - shadcn/Radix primitives and low-level UI components.
- `workspace/AGENTS.md` - Workspace shell, post-research cards, and artifact grid UI.
