# Progressive Reveal — Welcome State & First-Visit UX

## Context

AI-GOS V2 uses a three-panel "battleship" layout (sidebar | chat | right context panel). The problem: first-time users currently land in the full battleship layout with empty panels everywhere — it's overwhelming and confusing. They just spawned into a command center with no context.

**The fix**: A progressive reveal experience. On first visit, the user sees a clean welcome state — sidebar always visible, chat centered, NO right panel. As they interact and data accumulates, the right panel slides in.

## Reference: What Exists Now

Read these files FIRST before writing any code:

```
src/app/journey/page.tsx              # Main journey page — orchestrates everything
src/components/shell/app-shell.tsx     # Three-panel layout container
src/components/shell/app-sidebar.tsx   # Left sidebar (6 nav items, logo, session list, user menu)
src/components/shell/context-panel.tsx # Right panel (Progress, Research, Context, Capabilities)
src/components/shell/shell-provider.tsx # Shell context (collapse states)
src/lib/motion.ts                      # Framer Motion presets (springs, fadeUp, staggerContainer, etc.)
src/lib/ai/prompts/lead-agent-system.ts # Welcome message constants
src/app/globals.css                    # Design tokens (OKLCH colors, bg scale, text hierarchy, borders, shadows)
```

## What to Build

### 1. Welcome State Component (`src/components/journey/welcome-state.tsx`)

Create a new component that renders when `messages.length === 0 && !showResumePrompt`. This replaces the current ChatMessage welcome block.

**Design requirements — THIS MUST LOOK PREMIUM, NOT AI SLOP:**
- Centered vertically in the chat area
- Bold heading: "AI-GOS, making growth easier." — use `font-heading` (Instrument Sans), 26-28px, font-weight 600, tight letter-spacing
- One-line subtitle underneath in `text-tertiary`, 14px
- The existing `JourneyChatInput` below it (don't recreate the input — just move it into this centered layout)
- Use Framer Motion `fadeUp` + `staggerContainer` from `src/lib/motion.ts` for entry animation
- Use ONLY the existing CSS variables from `globals.css` — `var(--bg-base)`, `var(--text-primary)`, `var(--text-tertiary)`, `var(--accent-blue)`, etc.
- Use Lucide React icons (already installed) — NOT emoji
- Keep it minimal. Heading + subtitle + input. That's it. No cards, no grids, no feature lists.

### 2. Progressive Right Panel Reveal

Modify `src/app/journey/page.tsx`:

**Derive a `journeyPhase` from state:**
```typescript
// Phase 0: No messages yet → welcome state, no right panel
// Phase 1: Messages exist but no research yet → chat flowing, no right panel
// Phase 2: First research has fired → right panel slides in
const hasMessages = messages.length > 0;
const hasResearch = messages.some(msg =>
  msg.parts?.some(p => typeof p === 'object' && 'type' in p &&
    (p as any).type === 'tool-runResearch')
);

const journeyPhase = !hasMessages ? 0 : hasResearch ? 2 : 1;
```

**Pass `rightPanel` conditionally to AppShell:**
```typescript
<AppShell
  sidebar={<AppSidebar />}
  rightPanel={journeyPhase >= 2 ? (
    <ContextPanel
      onboardingState={onboardingState}
      messages={messages}
      journeyProgress={journeyProgress}
    />
  ) : undefined}
>
```

**Render welcome state OR chat:**
```typescript
{journeyPhase === 0 && !showResumePrompt ? (
  <WelcomeState onSubmit={handleSubmit} isLoading={isLoading} />
) : (
  /* existing chatContent */
)}
```

### 3. What NOT to Do

- Do NOT change AppShell — it already handles `rightPanel={undefined}` gracefully via `AnimatePresence`
- Do NOT change AppSidebar — sidebar is always present, already works
- Do NOT add cards, feature grids, quick-action pills, or "Strategy Templates" below the input
- Do NOT use emoji as icons — use Lucide React icons
- Do NOT create new CSS files — use existing CSS variables inline or with cn()
- Do NOT make the input a textarea — keep `JourneyChatInput` as-is

## Design Token Reference (from globals.css)

```
Backgrounds: var(--bg-base), var(--bg-elevated), var(--bg-surface), var(--bg-input)
Text: var(--text-primary) 95% white, var(--text-secondary) 60%, var(--text-tertiary) 38%
Borders: var(--border-subtle) 6%, var(--border-default) rgb(31,31,31)
Accents: var(--accent-blue) oklch(0.62 0.19 255), var(--accent-green), var(--accent-purple)
Shadows: var(--shadow-card), var(--shadow-elevated), var(--shadow-glow-blue)
Fonts: var(--font-heading) Instrument Sans, var(--font-sans) DM Sans, var(--font-mono) JetBrains Mono
```

## Motion Reference (from src/lib/motion.ts)

```typescript
import { springs, fadeUp, staggerContainer, staggerItem } from '@/lib/motion';
// springs.gentle — for page-level transitions
// fadeUp — { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }
// staggerContainer — staggers children by 0.1s
// staggerItem — fade up variant for children
```

## Acceptance Criteria

1. First visit shows: sidebar + centered welcome + input. No right panel.
2. After first message, welcome disappears, chat flows. Still no right panel.
3. After first research tool fires, right panel slides in via existing AnimatePresence.
4. Resume flow still works (showResumePrompt takes priority over welcome).
5. `npm run build` passes with zero errors.
6. The welcome state looks like a product designer made it — clean typography, proper spacing, no generic AI aesthetics.

## Verification

```bash
npm run build
```

Then visually verify:
- Fresh visit → welcome state centered, no right panel
- Send first message → chat replaces welcome
- After research fires → right panel slides in smoothly
- Refresh with saved session → resume prompt shows correctly
