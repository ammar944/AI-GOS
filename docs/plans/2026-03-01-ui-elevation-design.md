# UI Elevation — All V2 Components to Premium Quality

## Goal

Elevate all 20 V2 components from ~75% to professional-grade UI. No new dependencies, no layout changes, no abstractions — just craft.

## Wave 1: Design Token Foundation

**globals.css additions:**
- `--bg-code-block`, `--bg-input-glass`, `--bg-chip-selected`, `--bg-chip-hover`
- `--radius-chip`, `--radius-card`, `--radius-message-user`, `--radius-message-assistant`
- `--transition-fast: 150ms ease`, `--transition-normal: 200ms ease`

**motion.ts additions:**
- `pressScale` variant: scale 0.97 on tap
- `hoverLift` variant: y: -1, shadow increase on hover
- `statusPulse` variant: opacity pulse for active indicators
- `listStagger` variant: staggerChildren 0.05s (faster than current 0.1s)

## Wave 2: Interaction Layer (20 components)

Replace all manual `onMouseEnter`/`onMouseLeave` with CSS transitions + Framer Motion interaction props. Add `focus-visible` rings. Add micro-interactions to every interactive element.

### Journey Components (10)

| Component | Changes |
|-----------|---------|
| welcome-state | Convert inline spacing to Tailwind, add subtle gradient text on heading |
| chat-input | Extract glass vars, animate send button hover (scale + glow ramp), add focus ring |
| chat-message | Theme code blocks, user message gradient border, link hover brightness |
| ask-user-card | Smooth chip color transitions (300ms), selected chip glow, Done button press feedback |
| research-inline-card | Button hover states, completion checkmark scale-in, finding item stagger |
| resume-prompt | Replace manual hover handlers with CSS, add focus rings, button press scale |
| typing-indicator | Accent-colored dots, breathing opacity, tighter timing (0.5s) |
| streaming-cursor | Inline SVG with Framer pulse, accent glow, aria-label |
| journey-header | Progress bar smooth width transition, subtle header shadow |
| journey-progress | CSS variable colors, stage hover states, status transition animations |

### Shell Components (10)

| Component | Changes |
|-----------|---------|
| app-shell | Convert max-width to Tailwind class |
| app-sidebar | Logo gradient to CSS var, version badge dynamic, divider depth |
| context-panel | Section title tokens, chevron spring tuning, border transitions |
| nav-item | CSS hover/focus-visible, smooth color transitions, active indicator animation |
| session-list | CSS hover states, status dot pulse for active, smooth transitions |
| user-menu | Avatar hover scale, dropdown entrance animation, icon translate on hover |
| progress-tracker | Status color tokens, hover states on rows, line color transitions |
| research-sections | CSS hover, always-visible "View" with opacity shift, status dot transitions |
| onboarding-context | Field update flash animation, filled vs empty visual distinction |
| capabilities-bar | Stagger entrance, active pulse, hover scale, inactive tooltip |

## Wave 3: Polish

- Skeleton loaders for: research-sections, onboarding-context, session-list
- Stagger animations on all list renders
- Smooth AnimatePresence on all conditional renders

## NOT doing

- No new component library or abstractions
- No new npm dependencies
- No layout or responsive changes
- No theming system overhaul
- No feature additions
