# Command Center Editorial — UI Polish Design

**Date**: 2026-03-08
**Branch**: aigos-v2
**Scope**: Visual-only refactor — no props/interfaces/data flow changes

## Design Direction

Deep navy dark theme, editorial restraint, fewer decorations, more whitespace, bold type hierarchy.

## Changes

### Foundation (globals.css)
- Section gradient pairs for card accents
- `.research-streaming-bar` — 2px animated gradient
- `.user-message-bubble` — gradient border via ::before
- `.research-card-accent` — left accent border via ::after
- `.stat-callout` — large metric display (28px, 700)
- `.citation-footnote` — numbered footnote style

### Chat (chat-message + chat-input)
- Remove motion animations from messages (instant render)
- User bubble: gradient border, 20px radius, lineHeight 1.75
- Assistant: rounded-lg avatar, lineHeight 1.8, -0.01em tracking
- Input: bg-card, inner shadow, 2px focus ring, 36px send button

### Welcome + Header
- Kill all stagger animations
- 44px/700/-0.03em headline with decorative accent
- "AI-GOS" uppercase tag above headline
- Header: 56px min-height, 2px progress bar, "EGOS" 14px/0.08em

### Research Cards
- Per-section accent border (left) via CSS var
- 14px inline icon (no container box), 12px/700 label
- Streaming: animated gradient bar
- Complete/error: icon-only badges
- Remove all per-item stagger animations across 7 cards

### Interaction Cards
- Ask-user: 3px left accent, instant chips, scale 1.03 hover
- Profile: left accent, heading font, slice(0,8), h-1 progress

### Layout + Motion
- AppShell: remove stagger, plain divs, spring sidebar
- Research progress: vertical timeline, "N of M" counter, ring+dot animation

## Constraints
- Props/interfaces untouched
- Targeted edits only
- Fix page.tsx PartialObject error with `as any`
