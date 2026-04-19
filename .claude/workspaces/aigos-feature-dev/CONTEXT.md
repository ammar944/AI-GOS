# AIGOS Feature Dev — Layer 1 Context

## Current Workspace State

- **Active feature**: _none_ (set when starting a feature)
- **Stage**: _n/a_
- **Started**: _n/a_

When starting a feature, fill the block above and create a working note at `stages/01-discover/notes/<feature-slug>.md`.

## Stage Transitions

Move through stages strictly in order: 01 → 02 → 03 → 04 → 05. Each stage's `CONTEXT.md` defines:

- **Inputs** — what must exist before entering this stage
- **Process** — what happens in this stage
- **Checkpoints** — gates that must pass to leave
- **Audit** — what to record
- **Outputs** — artifacts produced, consumed by the next stage

## Feature Slug Convention

kebab-case, short, unique: `chat-retry`, `profile-scripts-tab`, `media-plan-export`.
