# AIGOS Feature Dev — Layer 1 Context

## Current Workspace State

- **Active feature**: chat-redesign
- **Stage**: 01-discover finalized → dispatching 02-audit (researcher, 10m / 40 calls)
- **Started**: 2026-04-20 17:35 GMT+5
- **Classification**: `day` (re-scoped 2026-04-20 18:05; prior `week+` 21-atom plan superseded — git preserves history)
- **Note**: `stages/01-discover/notes/chat-redesign.md`
- **Pipeline**: 01-discover ✅ → 02-audit (researcher) → 03-plan (inline, user gate) → 04-build (frontend sub-agents, parallel where independent) → 05-verify (user gate) → 05-ship (on explicit "ship it" only)

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
