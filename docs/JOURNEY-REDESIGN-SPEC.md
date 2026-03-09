# Journey Page Redesign — Claude Code Spec

## Overview
Redesign the Journey page (`src/app/journey/page.tsx`) to match the AI-GOS V2 Command Center mockup at `docs/design/journey-v2-mockup.html`. The goal is a premium dark SaaS aesthetic — think Firecrawl meets Linear meets Vercel.

## Reference Files
- **HTML mockup**: `docs/design/journey-v2-mockup.html` — open this in a browser to see the target design
- **Mockup screenshots**: `docs/design/mockup-aigos-v2.png`, `docs/design/mockup-firecrawl-agent.png`
- **Current page**: `src/app/journey/page.tsx` (1011 lines)
- **Current header**: `src/components/journey/journey-header.tsx`
- **Current components**: `src/components/journey/` (chat-message, ask-user-card, profile-card, research-progress, research-inline-card, etc.)

## Design System

### Colors
```
Background: #050505
Accent Blue: #3c83f6
Success Green: #10B981
Surface: rgba(255, 255, 255, 0.03)
Border: rgba(255, 255, 255, 0.06)
Text Primary: #E5E5E5
Text Secondary: rgba(255, 255, 255, 0.50)
Text Tertiary: rgba(255, 255, 255, 0.30)
Active Card Border: rgba(60, 131, 246, 0.30)
Active Card BG: rgba(60, 131, 246, 0.01)
```

### Typography
- Headings: Inter (or system sans-serif), light weight (300) for hero text
- Body: Inter, regular (400)
- Mono: JetBrains Mono for data, metrics, logs, module labels
- Module labels: 10-11px, uppercase, tracking-widest, mono

### Surfaces
```css
.glass-surface {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```
- Card border-radius: 24px (`rounded-3xl`)
- Control border-radius: 12px (`rounded-xl`)

### Animations
- Subtle pulse for active research cards (2s infinite)
- Progress bar at top of header (gradient blue→green)
- Blinking cursor in terminal log

## Layout (3-Column)

### Structure
```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo + Progress Bar + "New Journey" button      │
├──────┬──────────────────────────────────┬───────────────┤
│ Left │  Main Content                    │ Right Panel   │
│ Nav  │  - Stepper (4 phases)            │ Journey       │
│      │  - Chat messages                 │ Progress      │
│      │  - Research module cards (2-col) │ Timeline      │
│      │  - Terminal log stream           │               │
│      │  - AI responses                  │ Compute       │
│      │  - Profile snapshot card         │ Status        │
│      │  - Floating input bar            │               │
├──────┴──────────────────────────────────┴───────────────┤
```

### Left Sidebar
Keep the existing `AppSidebar` / `AppShell` from the shell component. Don't rebuild it — just restyle if needed. Nav items: Home, Journey (active), Blueprints, Ad Launcher, Creatives, Settings.

### Main Content Area
This is where the chat + research modules live. Scrollable with `custom-scrollbar` styling.

### Right Panel (New)
- **Journey Progress Timeline**: Vertical timeline with dots (green=done, blue=active, gray=queued)
  - Market Research
  - ICP Validation  
  - Competitor Intel
  - Ad Angle Creation
  - Strategic Synthesis
  - Keyword Intel
  - Media Plan
- **Compute Status**: Small badge at bottom showing connection status
- Only visible on `xl:` breakpoint and above

## Key Components to Build/Modify

### 1. Journey Stepper (`src/components/journey/journey-stepper.tsx`) — NEW
Horizontal 4-phase stepper at top of main content:
- **Discovery** (green dot when complete, green ring)
- **Validation** (blue dot when active, pulse animation)
- **Strategy** (gray when pending)
- **Launch** (gray when pending)

Each dot: `w-2.5 h-2.5 rounded-full`. Labels: `text-[10px] uppercase tracking-widest font-semibold`.

Map phases to onboarding state:
- Discovery = site scrape + initial questions done
- Validation = ICP + competitor research running/done
- Strategy = strategic synthesis done
- Launch = media plan + keyword intel done

### 2. Research Module Cards — RESTYLE existing `research-inline-card.tsx`
Currently 335 lines. Restyle to match mockup:
- Glass surface background
- Module number label: `text-xs font-mono text-white/40 uppercase tracking-tighter`
- Status dot: green (done), blue pulse (active), gray (pending)
- Progress bar for active cards: `h-1.5 w-full bg-white/5 rounded-full`
- Active card gets blue border: `border-brand-accent/30 bg-brand-accent/[0.01]`
- Layout: 2-column grid on `md:` and above, single column on mobile
- Data metrics in mono: TAM, CAGR, competitor count, etc.

### 3. Terminal Log Stream (`src/components/journey/terminal-stream.tsx`) — NEW
Shows real-time research activity in a terminal-style box:
```
[OK]  Connection established to Firecrawl API
[RUN] Scanning competitor ad libraries...
[INF] Found 52 active Google Ads for "scheduling software"
[WARN] SpyFu rate limit approaching
_  (blinking cursor)
```
- Glass surface + `bg-black/40`
- `font-mono text-[11px] text-white/40`
- Prefix colors: `[OK]` green, `[RUN]` blue, `[INF]` white/20, `[WARN]` amber
- Fed from research tool call results as they stream in

### 4. AI Response Block — RESTYLE existing `chat-message.tsx`
For assistant messages, use the blockquote style from mockup:
- Left border: `border-l-2 border-brand-accent/40`
- Text: `text-white/80 leading-relaxed font-light text-lg`
- No avatar/bubble — just clean left-bordered text

### 5. Profile Snapshot Card — RESTYLE existing `profile-card.tsx`
Match the mockup's "Profile Snapshot" grid:
- Glass surface, `rounded-3xl`, `p-8`
- Section title: `text-xs font-mono text-white/30 uppercase tracking-widest`
- 3-column grid showing key confirmed fields
- Field labels: `text-[10px] text-white/30 uppercase`
- Field values: `text-sm font-medium` white

### 6. Floating Input Bar — RESTYLE existing `chat-input.tsx`
- Fixed to bottom center: `absolute bottom-8 left-0 right-0 flex justify-center`
- Max width `max-w-2xl`
- Gradient glow border on focus (blue → green, `blur opacity-20`, increases on focus)
- Dark background `bg-[#0a0a0a]`
- Rounded: `rounded-xl`
- Placeholder: "Ask AI-GOS to refine the strategy..."
- Send button: `bg-white/5 hover:bg-white/10 rounded-lg`

### 7. Journey Progress Panel (`src/components/journey/journey-progress-panel.tsx`) — NEW
Right sidebar panel with vertical timeline:
- Vertical line: `absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10`
- Each item: dot + label + optional detail
- Green dot with ring = completed
- Blue dot with pulse = active
- Gray dot = pending
- Show time elapsed for completed items
- "Compute Node: Stable" badge at bottom

### 8. Header — MODIFY `journey-header.tsx`
- Gradient logo badge: `w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-accent to-brand-success`
- "AI-GOS V2.0" text with version in `text-white/40`
- Top progress bar: gradient from blue to green
- "New Journey" button: `bg-brand-accent hover:bg-blue-600 px-4 py-2 rounded-xl text-xs font-medium`

## Rules

### DO
- Use Tailwind CSS classes exclusively (no CSS modules, no styled-components)
- Add the design system colors to `tailwind.config.ts` under `theme.extend.colors.brand`
- Keep ALL existing functionality — chat, askUser chips, research streaming, new journey, resume
- Keep the existing `useChat` hook and all tool handling logic in `page.tsx`
- Keep the existing component file structure — modify in place, add new files
- Use Lucide React for all icons (already installed)
- Use `clsx` or `cn()` for conditional classes (already available via `@/lib/utils`)
- Test with `npx tsc --noEmit` after changes

### DO NOT
- Remove or modify any API routes (`src/app/api/`)
- Change the `useChat` configuration or transport
- Remove askUser chip functionality
- Remove research realtime subscription
- Break mobile responsiveness — right panel hides below `xl:`
- Use emoji in UI components
- Add new dependencies (everything needed is already installed)

## Implementation Order
1. Add brand colors to `tailwind.config.ts`
2. Add glass-surface and custom-scrollbar utilities to `globals.css`
3. Build `journey-stepper.tsx` (new)
4. Build `terminal-stream.tsx` (new)
5. Build `journey-progress-panel.tsx` (new)
6. Restyle `journey-header.tsx`
7. Restyle `chat-input.tsx` (floating bar)
8. Restyle `chat-message.tsx` (AI response blockquote)
9. Restyle `research-inline-card.tsx` (module cards)
10. Restyle `profile-card.tsx` (snapshot grid)
11. Update `page.tsx` layout to 3-column with stepper + right panel
12. Run `npx tsc --noEmit` to verify
13. Commit with message: `feat: Journey page redesign — AI-GOS V2 Command Center aesthetic`

## Verification
After implementing, the journey page should:
- [ ] Match the mockup layout (3-column, stepper, module cards, terminal, right panel)
- [ ] All existing chat/research/askUser functionality still works
- [ ] `npx tsc --noEmit` passes
- [ ] Mobile view hides right panel, stacks cards single-column
- [ ] Dark mode only, no light mode needed
- [ ] No console errors on load
