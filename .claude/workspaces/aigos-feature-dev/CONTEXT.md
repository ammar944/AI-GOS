# AIGOS Feature Dev — Layer 1 Context

## Current Workspace State

- **Active feature**: research-perf-and-chat-edit (supersedes streaming-activity-log which SHIPPED in commits 6038a367 → 1bf5c91b)
- **Stage**: 03-build (phases defined; awaiting separate execution sessions per phase)
- **Started**: 2026-05-11
- **Operating model**: HQ-from-this-session + separate executor sessions per phase
- **Phases doc**: `stages/03-build/phases-research-perf-and-chat-edit.md`
- **Plan**: `docs/superpowers/plans/2026-05-11-research-perf-and-chat-edit.md` (commit f60f6597)
- **Spec**: `docs/superpowers/specs/2026-05-11-research-perf-and-chat-edit-design.md` (commit fa650daa)
- **Prior shipped**: streaming-activity-log (4 commits, ~25min wall, ended 2026-05-11)
- **Prior feature**: gtm-004-stage-panel (was at 04-verify on 2026-05-07; assumed shipped or paused)

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
