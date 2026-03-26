# Design System — AIGOS by SaaSLaunch

## Product Context
- **What this is:** Paid media research command center — users enter a company URL, AIGOS runs 7 AI research sections, produces a strategic media blueprint
- **Who it's for:** Agency media buyers and strategists who research 2-3 new clients per week
- **Space/industry:** Competitive intelligence / agency analytics (peers: Crayon, Klue, Funnel.io)
- **Project type:** Data-dense web app (dark theme, workspace-driven)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal — typography does the work
- **Mood:** Bloomberg Terminal meets Linear.app. Function-first, data-dense. Feels like a weapon, not a presentation. Speed = respect for the operator's time.
- **Reference sites:** Parallel.ai (dark research tool), Cursor (dark analytics), Attio (data-driven CRM), Linear (minimal chrome)

## Typography
- **Display/Hero:** Instrument Sans 600 — clean geometric sans, good at large sizes, -0.025em tracking
- **Body:** DM Sans 400/500 at 14px — readable at density, good x-height, line-height 1.5
- **UI/Labels:** JetBrains Mono 500 11px uppercase 0.06em tracking — section labels, status text
- **Data/Tables:** JetBrains Mono 400/600 — tabular-nums always, right-aligned numbers
- **Code:** JetBrains Mono 400
- **Loading:** Google Fonts `family=DM+Sans:wght@300;400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600`
- **Scale:**
  - h1: 32px / 600 / -0.025em (Instrument Sans)
  - h2: 20px / 600 / -0.01em (Instrument Sans)
  - h3: 16px / 500 (Instrument Sans)
  - body: 14px / 400 / 1.5 line-height (DM Sans)
  - small: 13px / 400 (DM Sans)
  - label: 11px / 500 / uppercase / 0.06em tracking (JetBrains Mono)
  - data-lg: 20px / 600 / tabular-nums (JetBrains Mono)
  - data-sm: 13px / 400 / tabular-nums (JetBrains Mono)
  - badge: 10px / 500 (JetBrains Mono)

## Color

### Approach: Restrained
One accent blue. Three status colors. Everything else is surface and text hierarchy. Color means something or it doesn't exist.

### Dark Mode (Primary)
```css
/* Surfaces — stepped elevation */
--bg-0: #07090e;          /* Page background */
--bg-1: #0a0c12;          /* Workspace panels, elevated surfaces */
--bg-2: #0e1018;          /* Cards, sub-panels */
--bg-3: #12141c;          /* Active states, selected items */
--bg-hover: rgba(255,255,255,0.03);  /* Row/item hover */

/* Text — 4-level hierarchy */
--text-1: #e2e4ea;        /* Primary — headings, important data */
--text-2: #8b90a0;        /* Secondary — body text, descriptions */
--text-3: #555a6a;        /* Tertiary — labels, metadata */
--text-4: #3a3e4c;        /* Quaternary — disabled, decorative */

/* Accent — ONE color */
--accent: #365eff;
--accent-hover: #4a6fff;
--accent-dim: rgba(54,94,255,0.08);

/* Status — semantic only */
--green: #22c55e;         /* Good / proceed / low difficulty */
--amber: #eab308;         /* Warning / needs work / medium */
--red: #ef4444;           /* Critical / do not launch / high */

/* Borders — barely visible */
--border: rgba(255,255,255,0.04);
--border-hover: rgba(255,255,255,0.08);
```

### Light Mode
```css
--bg-0: #f7f8fb;
--bg-1: #ffffff;
--bg-2: #f1f3f7;
--bg-3: #e8eaef;
--bg-hover: rgba(0,0,0,0.02);
--text-1: #0f172a;
--text-2: #475569;
--text-3: #94a3b8;
--text-4: #cbd5e1;
--accent-dim: rgba(54,94,255,0.05);
--border: rgba(0,0,0,0.05);
--border-hover: rgba(0,0,0,0.08);
```

### What's NOT in the palette
- ~~Section-specific colors~~ (no cyan for ICP, no purple for competitors, no amber for keywords)
- ~~Rainbow accents~~ — dropped. Color signals state and priority ONLY.
- ~~Decorative gradients~~ — none

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable-to-tight (data-dense but not cramped)
- **Scale:** 2(2px) 4(4px) 6(6px) 8(8px) 10(10px) 12(12px) 16(16px) 20(20px) 24(24px) 32(32px) 40(40px) 48(48px)
- **Component padding:** Cards 20-24px, Table cells 8-10px, Buttons 6px 14px, Badges 1px 7px

## Layout
- **Approach:** Grid-disciplined
- **Shell:** Existing 3-panel (sidebar + workspace + chat rail) is correct — do not change
- **Grid:** Single column within workspace panel. No multi-column card grids.
- **Max content width:** 1080px for standalone views (/research/{id})
- **Border radius:**
  - sm: 3px (badges, small chips)
  - md: 5px (buttons, inputs, sub-tabs)
  - lg: 8px (workspace panels, modals)
  - full: 9999px (status badges)

## Motion
- **Approach:** Minimal-functional
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150ms) medium(200ms)
- **Allowed motion:** Hover color transitions, streaming text, section tab switches, save/copy confirmation
- **Killed motion:** ~~Card stagger entrance~~ — content appears instantly. ~~Hover scale transforms~~ — use color/opacity only.
- **Reduced motion:** Respect `prefers-reduced-motion` — disable all non-essential transitions

## Content Structure Rules

Match structure to content job. Do NOT default to cards for everything.

| Content Type | UI Structure | NOT |
|---|---|---|
| Ranked data (keywords, ICE scores) | **Sortable table** | Card grid |
| Entity switching (competitors) | **Tab bar** | Flat vertical list |
| Strategic insights (synthesis) | **Callout blocks** with 2px left accent | Hero cards, prose walls |
| Copyable output (offer statements) | **List items** with type tag + copy button | Cards |
| Score breakdowns (offer analysis) | **Inline stats** (label + number, no box) | Stat grid cards |
| Prose content (narrative, descriptions) | **Body text** with collapsible sections | Full-width text walls |
| Status indicators | **Badges** (pill, monospace, semantic color) | Colored backgrounds |

## Component Patterns

### Tables
- No visible row borders — use `border-bottom: 1px solid transparent` + hover highlight
- Column headers: mono uppercase 10px, text-4 color
- Number columns: right-aligned, tabular-nums
- Hover: `rgba(255,255,255,0.03)` background

### Callout Blocks
- Left border: 2px solid accent
- No background fill
- Label in mono uppercase, text in body font
- Meta line: mono 11px, text-3 color

### Badges
- Pill shape (border-radius: 9999px)
- Mono 10px 500 weight
- Background: status color at 10% opacity
- Text: status color at full

### Buttons
- Primary: accent bg, white text
- Secondary: transparent, text-2, 1px border
- Ghost: transparent, text-3, no border
- All: 6px 14px padding, 13px text, 5px radius

### Section Tabs
- 12px mono-weight text
- Active: text-1 + 1.5px bottom border in accent
- Inactive: text-4
- No background on tabs — bottom border only

### Sub-tabs (competitor selector)
- Pill group with bg-2 container, 2px padding
- Active pill: bg-3, text-1
- Inactive: text-3

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system | Created by /design-consultation. Industrial/utilitarian direction. |
| 2026-03-26 | Drop rainbow section colors | One accent + semantic status. Color means something or doesn't exist. Codex + Claude both flagged decorative color as anti-pattern. |
| 2026-03-26 | Kill card stagger animation | Instant content render. Speed = respect for operator's time. |
| 2026-03-26 | Tables over cards for ranked data | Codex hard-rejected card proliferation. Match structure to content job. |
| 2026-03-26 | Callout blocks over hero cards | 2px left accent, no background fill. Subtle > loud. |
