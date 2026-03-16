# Landing Page & Journey Start Refresh

## Problem

Two pages feel disconnected from the current app UI:

1. **Landing page** (`src/app/page.tsx`) — "SaaSLaunch" branded hero with generic SaaS marketing copy, blue gradient CTA, and feature cards. Looks like a template landing page. Doesn't match the dark, glass-panel, command-center aesthetic of the dashboard and workspace.

2. **Journey start page** (`src/app/journey/page.tsx`) — Still renders a left sidebar (`AppSidebar` with Home/Journey/Blueprints/Ad Launcher/Creatives nav) and a right progress panel. The sidebar is dead weight — these routes don't exist yet and the sidebar eats horizontal space from the main content.

## Goals

### Landing Page → Match Dashboard Aesthetic

The landing page should feel like an **entry to the command center**, not a SaaS template. It should:

- **Remove** the "SaaSLaunch" branding. This is **AIGOS** — use the existing `<Logo>` component properly.
- **Remove** the `BlobBackground`, `GradientText`, and generic hero gradient. Replace with the same `bg-[var(--bg-base)]` + subtle radial glow used by the dashboard page.
- **Remove** the 3 feature cards (Lightning Fast / Strategic / Full Funnel). These are filler.
- **Keep** the header/footer structure but match the dashboard's minimal chrome style: sticky header with `backdrop-blur-xl`, `border-white/[0.06]`, `h-14`.
- **Redesign the hero** as a single centered block:
  - Small status badge: `● AIGOS JOURNEY` (same pill style from journey page)
  - Headline: something like "Seed your strategy." or "Your paid media command center." — short, confident, no marketing fluff
  - Subtitle: 1 line explaining what AIGOS does
  - Single CTA button: "Start Journey →" linking to `/journey` (not `/generate`)
  - Use the same glass-surface card style (`border-white/[0.04]`, `bg-white/[0.015]`) if any cards are needed
- **Tone**: Dark, minimal, command-center. Think mission control, not SaaS landing page.
- **Typography**: Use the existing font system (DM Sans body, Instrument Sans headings). No gradient text.
- The footer should say "© 2026 AIGOS" not "SaaSLaunch"

### Journey Page → Remove Sidebar, Full-Width

The journey page currently renders `<AppSidebar />` on the left with 5 nav items (Home, Journey, Blueprints, Ad Launcher, Creatives). This sidebar should be **completely removed** from the journey page because:

1. The routes don't exist (Blueprints, Ad Launcher, Creatives are placeholders)
2. It wastes ~220px of horizontal space that the chat/workspace needs
3. The dashboard already has its own layout without this sidebar
4. The journey is meant to be an immersive, full-screen experience

Changes needed:

- **Remove** the `<AppSidebar />` import and render from `src/app/journey/page.tsx` (line ~1989)
- **Remove** the `<ShellProvider>` wrapper if it's only used for the sidebar
- The journey page should take the **full viewport width** — just the center workspace + optional right progress panel
- If users need to navigate away, they can use the browser back button or a minimal top-bar with the Logo linking to `/dashboard`
- Consider adding a tiny top bar to the journey page: Logo (links to /dashboard) + user avatar. Same style as dashboard header (`h-14`, `backdrop-blur-xl`).

### Files to Modify

| File | What to do |
|------|-----------|
| `src/app/page.tsx` | Complete rewrite of landing page |
| `src/app/journey/page.tsx` | Remove `AppSidebar`, remove `ShellProvider`, add minimal top bar |
| `src/components/shell/app-sidebar.tsx` | Can be deleted if nothing else imports it |
| `src/components/shell/app-shell.tsx` | Check if anything else uses it — may be deletable |

### Files to Reference (current UI patterns)

| File | Why |
|------|-----|
| `src/app/dashboard/page.tsx` | Best example of the current header/layout pattern |
| `src/app/dashboard/_components/dashboard-content.tsx` | Glass surface cards, skeleton patterns |
| `src/components/workspace/workspace-page.tsx` | The target aesthetic |
| `src/components/journey/journey-stepper.tsx` | The stepper badge pill style |

### What NOT to Change

- Do not touch the journey's chat logic, useChat hook, research pipeline, or any functional behavior
- Do not change the workspace components
- Do not change the dashboard page
- Do not add new dependencies
- Do not change the journey's phase system (welcome/prefilling/review/chat/workspace)

## Visual Reference

Current journey start (from screenshot):
- Left sidebar: Home, Journey, Blueprints, Ad Launcher, Creatives, Settings
- Center: "AIGOS JOURNEY" badge → "Seed your strategy." headline → URL inputs → "Begin Analysis" CTA
- Right: "JOURNEY PROGRESS" panel with Market Overview, Competitor Intel, etc.

Target:
- No left sidebar
- Center content takes full width (with max-width constraint)
- Optional: minimal top-bar with Logo + UserButton
- Same center content (badge, headline, inputs, CTA) but now has more breathing room
- Right progress panel stays as-is on xl screens
