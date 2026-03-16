# Journey Premium Preview Design

**Date:** 2026-03-11

## Goal

Create a preview-only Journey concept that upgrades the welcome surface, research cards, artifact review panel, and composer so the app feels like one premium AI-native strategy workspace without changing the live `/journey` experience.

## Scope

- Preview only under a dedicated test route
- Dummy data is acceptable
- Focus only on:
  - welcome
  - research cards
  - artifact panel
  - composer
- Preserve the current AIGOS dark product language and workspace framing

## Design Direction

The current Journey shell is the correct base. The issue is not layout; it is component cohesion.

The preview should feel like a strategy control room:

- dark, restrained, evidence-first
- premium but not glossy
- less “AI chat app”
- more “research and decision workspace”

## Reference Patterns

- Grok workspace: clean command surface and calm central canvas
- Sana AI onboarding: disciplined hierarchy and composed intake framing
- Maze analysis workspace: stronger review-state structure and approval-oriented detail surfaces

These references inform hierarchy and component behavior, not the color system or full layout.

## Component Changes

### Welcome

- Replace the generic welcome block with a sharper “strategic brief” scene
- Keep one primary URL intake surface
- Add 3-4 quick-start strategic prompts
- Add small readiness/status signals to make the page feel operational

### Research Cards

- Move from generic status widgets to concise research dossiers
- Each card should show:
  - module label
  - strategic headline
  - 2-3 supporting proof bullets
  - compact metrics/meta row
  - one clear next action

### Artifact Panel

- Present review as a decision dock, not a generic document blob
- Structure:
  - section summary
  - key findings
  - risks / opportunities
  - evidence or citations strip
  - sticky approval actions

### Composer

- Upgrade the input into a premium operator bar
- Keep it dark and native to AIGOS
- Show mode/context chips with clearer hierarchy
- Improve send affordance and spacing
- Do not use the Manus light-paper treatment

## Technical Approach

- Build a new preview-only route under `src/app/test`
- Use scene-based rendering so each target surface can be reviewed independently
- Reuse shared components where it helps future adoption
- Add preview-only variants or wrappers where live components should remain untouched

## Non-Goals

- no changes to live `/journey`
- no Manus-style landing page transplant
- no light theme conversion
- no backend or data contract changes
- no attempt to fully redesign the whole Journey flow in this pass
