# UI Elevation — All V2 Components Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate all 20 V2 components from ~75% to professional-grade premium UI quality.

**Architecture:** Three-wave approach — (1) design token foundation in globals.css + motion.ts, (2) interaction layer across all 20 components (CSS hover/focus states, micro-interactions, color tokens), (3) polish pass (loading states, stagger animations, accessibility).

**Tech Stack:** Tailwind CSS v4 + CSS custom properties + Framer Motion + Lucide React. No new dependencies.

**Working directory:** `/Users/ammar/Dev-Projects/AI-GOS-main` (aigos-v2 branch)

---

## Wave 1: Foundation

### Task 1: Add interaction design tokens to globals.css

**Files:**
- Modify: `src/app/globals.css:337` (insert before closing `}` of `.dark` block at line 338)

**Step 1: Add new CSS variables**

Insert after line 337 (`--section-keyword-text: #38d6f0;`) and before the closing `}`:

```css
  /* ── Interaction Tokens ─────────────────────────────────────── */

  /* Glass surfaces */
  --bg-glass: rgba(10, 13, 20, 0.8);
  --bg-glass-hover: rgba(10, 13, 20, 0.9);

  /* Chip/tag tokens */
  --bg-chip: rgba(54, 94, 255, 0.08);
  --bg-chip-hover: rgba(54, 94, 255, 0.12);
  --bg-chip-selected: rgba(54, 94, 255, 0.15);
  --border-chip-selected: rgba(54, 94, 255, 0.3);

  /* Code block */
  --bg-code-block: rgba(0, 0, 0, 0.3);
  --bg-code-inline: rgba(255, 255, 255, 0.08);

  /* Status colors */
  --status-success: rgb(34, 197, 94);
  --status-success-glow: rgba(34, 197, 94, 0.4);
  --status-success-bg: rgba(34, 197, 94, 0.08);
  --status-success-border: rgba(34, 197, 94, 0.2);
  --status-error: #ef4444;
  --status-error-bg: rgba(239, 68, 68, 0.1);
  --status-error-border: rgba(239, 68, 68, 0.2);
  --status-active: rgb(54, 94, 255);
  --status-active-glow: rgba(54, 94, 255, 0.4);
  --status-pending: rgb(71, 76, 89);

  /* Logo gradient */
  --logo-gradient: linear-gradient(135deg, #fff 30%, #93c5fd 100%);

  /* Shared radius tokens */
  --radius-message-user: 14px 14px 4px 14px;
  --radius-message-assistant: 14px 14px 14px 4px;
  --radius-chip: 999px;
  --radius-card: 12px;
  --radius-input: 16px;

  /* Transition presets */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* Overlay / subtle backgrounds */
  --bg-overlay-subtle: rgba(255, 255, 255, 0.03);
  --bg-overlay-light: rgba(255, 255, 255, 0.06);
```

**Step 2: Add utility classes for common interactions**

Add after the existing `.accent-on-card-hover` block (around line 830):

```css
/* ── Interaction utilities ────────────────────────────────── */

.interactive-row {
  transition: background var(--transition-normal);
  cursor: pointer;
}
.interactive-row:hover {
  background: var(--bg-hover);
}

.focus-ring:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.press-scale {
  transition: transform var(--transition-fast);
}
.press-scale:active {
  transform: scale(0.97);
}

.hover-lift {
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
}
.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

**Step 3: Verify no build breakage**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(tokens): add interaction design tokens and utility classes"
```

---

### Task 2: Add interaction animation variants to motion.ts

**Files:**
- Modify: `src/lib/motion.ts:77` (append after `durations` block)

**Step 1: Add new variants**

Append after line 77:

```typescript

// ── Interaction variants ─────────────────────────────────────────────────────

// Button/chip press feedback
export const pressScale = {
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 500, damping: 30 },
};

// Card hover lift
export const hoverLift = {
  whileHover: { y: -1 },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
};

// Status indicator pulse
export const statusPulse: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

// Fast stagger for lists (0.05s vs default 0.1s)
export const fastStagger: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Scale in with spring (for checkmarks, icons appearing)
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 25 },
  },
};
```

**Step 2: Verify build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/motion.ts
git commit -m "feat(motion): add interaction variants — pressScale, hoverLift, statusPulse, popIn"
```

---

## Wave 2: Interaction Layer

### Task 3: Elevate welcome-state.tsx

**Files:**
- Modify: `src/components/journey/welcome-state.tsx`

**Step 1: Convert inline styles to Tailwind + CSS vars**

Replace the entire file:

```tsx
'use client';

import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, springs } from '@/lib/motion';
import { JourneyChatInput } from '@/components/journey/chat-input';

interface WelcomeStateProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

export function WelcomeState({ onSubmit, isLoading }: WelcomeStateProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-4">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="w-full max-w-[480px]"
      >
        <motion.h1
          variants={staggerItem}
          transition={springs.gentle}
          className="m-0 leading-tight"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          AI-GOS, making growth easier.
        </motion.h1>

        <motion.p
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-2 mb-0"
          style={{
            fontSize: 14,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          Your paid media strategy starts with a conversation.
        </motion.p>

        <motion.div
          variants={staggerItem}
          transition={springs.gentle}
          className="mt-8"
        >
          <JourneyChatInput
            onSubmit={onSubmit}
            isLoading={isLoading}
            placeholder="Tell me about your business..."
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/journey/welcome-state.tsx
git commit -m "polish(welcome): convert inline styles to Tailwind classes"
```

---

### Task 4: Elevate chat-input.tsx

**Files:**
- Modify: `src/components/journey/chat-input.tsx`

**Changes:**
1. Replace hardcoded `rgba(10, 13, 20, 0.8)` → `var(--bg-glass)` (2 instances)
2. Replace hardcoded `rgba(54, 94, 255, 0.1)` → `var(--accent-blue-glow)`
3. Replace `#ffffff` → `#fff` in send button (minor)
4. Add `focus-ring` class to textarea for keyboard accessibility
5. Add hover scale to send button via inline transition
6. Replace slash command hardcoded colors with CSS vars where possible

**Step 1: Apply token replacements**

In the glassmorphism container style object (~line 134):
- `background: 'rgba(10, 13, 20, 0.8)'` → `background: 'var(--bg-glass)'`
- `'rgba(54, 94, 255, 0.1)'` → `'var(--accent-blue-glow)'`

In the send button style (~line 194):
- Add `transition: 'background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, transform 0.15s ease'`
- Add `transform: canSend ? 'scale(1)' : 'scale(0.95)'` for visual feedback

Add to textarea className: `focus-ring` alongside existing classes.

**Step 2: Verify build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/journey/chat-input.tsx
git commit -m "polish(chat-input): use design tokens, add focus ring, send button feedback"
```

---

### Task 5: Elevate chat-message.tsx

**Files:**
- Modify: `src/components/journey/chat-message.tsx`

**Changes:**
1. Replace `rgba(0, 0, 0, 0.3)` → `var(--bg-code-block)` for code blocks
2. Replace `rgba(255, 255, 255, 0.08)` → `var(--bg-code-inline)` for inline code
3. Replace `rgba(239, 68, 68, ...)` → `var(--status-error-bg)`, `var(--status-error-border)`, `var(--status-error)` for error states
4. Replace `rgba(34, 197, 94, ...)` → `var(--status-success-bg)`, `var(--status-success-border)`, `var(--status-success)` for success states
5. Replace `#006fff` → `var(--accent-blue-hover)` in avatar gradient
6. Add smooth transition to link hover states

**Step 1: Apply all token replacements across the file**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/chat-message.tsx
git commit -m "polish(chat-message): replace hardcoded colors with design tokens"
```

---

### Task 6: Elevate ask-user-card.tsx

**Files:**
- Modify: `src/components/journey/ask-user-card.tsx`

**Changes:**
1. Replace `rgba(54, 94, 255, 0.08)` → `var(--bg-chip)` in chip default state
2. Replace `rgba(54, 94, 255, 0.15)` → `var(--bg-chip-selected)` in selected state
3. Replace `rgba(54, 94, 255, 0.1)` → `var(--bg-chip-hover)` in hover state
4. Replace `#ffffff` → `#fff` in button colors
5. Replace `rgba(255, 255, 255, 0.08)` → `var(--bg-code-inline)` in OtherInput
6. Add `transition: 'background var(--transition-slow), border-color var(--transition-slow)'` to chip button for smooth color changes
7. Add `focus-ring` to chip buttons and Done button

**Step 1: Apply replacements**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/ask-user-card.tsx
git commit -m "polish(ask-user): design tokens, smooth chip transitions, focus rings"
```

---

### Task 7: Elevate research-inline-card.tsx

**Files:**
- Modify: `src/components/journey/research-inline-card.tsx`

**Changes:**
1. Replace hardcoded DOT_COLORS array values with CSS vars where available (`--accent-cyan`, `--accent-green`, `--accent-purple`, `--accent-amber`)
2. Add `interactive-row` class to expand button for hover background
3. Add completion checkmark scale-in using `popIn` variant from motion.ts
4. Add `fastStagger` to findings list items

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/research-inline-card.tsx
git commit -m "polish(research-card): design tokens, hover states, completion animation"
```

---

### Task 8: Elevate resume-prompt.tsx

**Files:**
- Modify: `src/components/journey/resume-prompt.tsx`

**Changes — this is the biggest interaction overhaul:**
1. Remove `onMouseEnter`/`onMouseLeave` handlers on both buttons (lines 79-84, 98-105)
2. Replace with CSS transition styles: `transition: 'opacity var(--transition-normal), background var(--transition-normal), border-color var(--transition-normal)'`
3. Replace `#006fff` → `var(--accent-blue-hover)` in avatar gradient
4. Replace `rgb(54, 94, 255)` → `var(--accent-blue)` in Continue button
5. Replace `#ffffff` → `#fff`
6. Add `focus-ring` class to both buttons
7. Add `press-scale` class to both buttons
8. Convert button hover states to use CSS-only approach with a wrapper that sets opacity on hover

**Step 1: Rewrite the button sections**

Replace the Continue button (~lines 70-87):
```tsx
<button
  type="button"
  onClick={onContinue}
  className="focus-ring press-scale"
  style={{
    padding: '10px 24px',
    borderRadius: 'var(--radius-chip)',
    background: 'var(--accent-blue)',
    color: '#fff',
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: 13,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity var(--transition-normal)',
  }}
  onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.9'; }}
  onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
>
  Continue
</button>
```

Wait — the spec says to REMOVE manual handlers. Use CSS instead:

```tsx
<button
  type="button"
  onClick={onContinue}
  className="focus-ring press-scale hover:opacity-90"
  style={{
    padding: '10px 24px',
    borderRadius: 'var(--radius-chip)',
    background: 'var(--accent-blue)',
    color: '#fff',
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    fontSize: 13,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity var(--transition-normal)',
  }}
>
  Continue
</button>
```

Do the same for Start Fresh button — replace manual handler with `hover:opacity-80` and `hover:border-[var(--border-hover)]` Tailwind classes.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/resume-prompt.tsx
git commit -m "polish(resume-prompt): CSS hover states, focus rings, design tokens"
```

---

### Task 9: Elevate typing-indicator.tsx

**Files:**
- Modify: `src/components/journey/typing-indicator.tsx`

**Changes:**
1. Change dot color from `var(--text-tertiary)` to `var(--accent-blue)` for brand presence
2. Tighten animation: duration 0.5s (from 0.6s), delay 0.12s (from 0.15s)
3. Add opacity breathing: animate `opacity: [0.4, 1, 0.4]` alongside y-axis bounce
4. Add `role="status"` and `aria-label="Loading"` for accessibility

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/typing-indicator.tsx
git commit -m "polish(typing): accent color, tighter timing, breathing opacity, aria"
```

---

### Task 10: Elevate streaming-cursor.tsx

**Files:**
- Modify: `src/components/journey/streaming-cursor.tsx`

**Changes:**
1. Replace CSS class dependency with inline Framer Motion animation
2. Add subtle accent glow
3. Keep aria-hidden="true"

Replace content:
```tsx
'use client';

import { motion } from 'framer-motion';

export function StreamingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      className="inline-block ml-0.5 align-middle"
      style={{
        width: 2,
        height: 16,
        background: 'var(--accent-blue)',
        borderRadius: 1,
        boxShadow: '0 0 6px var(--accent-blue-glow)',
      }}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
```

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/streaming-cursor.tsx
git commit -m "polish(cursor): Framer Motion pulse, accent glow, inline animation"
```

---

### Task 11: Elevate journey-header.tsx

**Files:**
- Modify: `src/components/journey/journey-header.tsx`

**Changes:**
1. Replace `linear-gradient(180deg, #ffffff 0%, #93c5fd 100%)` → `var(--logo-gradient)` for logo
2. Replace `rgba(255, 255, 255, 0.06)` → `var(--bg-overlay-light)` for progress bg
3. Replace `rgb(54, 94, 255)` → `var(--accent-blue)` for progress fill
4. Add smooth width transition to progress bar: `transition: 'width 0.5s ease'`
5. Add subtle header shadow: `boxShadow: 'var(--shadow-xs)'`
6. Add `aria-label` and `role="progressbar"` to progress bar

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/journey-header.tsx
git commit -m "polish(header): design tokens, progress animation, shadow, aria"
```

---

### Task 12: Elevate journey-progress.tsx

**Files:**
- Modify: `src/components/journey/journey-progress.tsx`

**Changes:**
1. Replace all hardcoded `rgb(34, 197, 94)` → `var(--status-success)` (~6 instances)
2. Replace `rgba(34, 197, 94, 0.4)` → `var(--status-success-glow)`
3. Replace `rgb(54, 94, 255)` → `var(--status-active)` / `var(--accent-blue)`
4. Replace `rgb(71, 76, 89)` → `var(--status-pending)`
5. Replace `rgba(255, 255, 255, 0.06)` → `var(--bg-overlay-light)`
6. Replace `rgba(255, 255, 255, 0.03)` → `var(--bg-overlay-subtle)`
7. Add `focus-ring` to CompactStage button
8. Add hover background state to stage rows

**Step 1: Apply all color replacements**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/journey/journey-progress.tsx
git commit -m "polish(progress): replace all hardcoded colors with design tokens, add focus ring"
```

---

### Task 13: Elevate nav-item.tsx

**Files:**
- Modify: `src/components/shell/nav-item.tsx`

**Changes:**
1. Remove `onMouseEnter`/`onMouseLeave` at lines 118-120
2. Replace `rgba(54, 94, 255, 0.12)` → `var(--bg-chip-hover)`
3. Replace manual hover state computation with CSS `hover:` + `transition`
4. Add `focus-ring` class to the link/button element
5. Add `transition: 'background var(--transition-normal), color var(--transition-normal)'`
6. Add active state indicator: left border or subtle background

**Step 1: Refactor from useState hover to CSS**

Remove `const [isHovered, setIsHovered] = useState(false)` and related handlers. Compute base style without hover, let CSS handle hover via the `interactive-row` class.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/nav-item.tsx
git commit -m "polish(nav-item): CSS hover states, focus ring, remove manual handlers"
```

---

### Task 14: Elevate session-list.tsx

**Files:**
- Modify: `src/components/shell/session-list.tsx`

**Changes:**
1. Remove `onMouseEnter`/`onMouseLeave` at lines 64-65
2. Replace `rgba(54, 94, 255, 0.12)` → `var(--bg-chip-hover)`
3. Replace `rgba(34, 197, 94, 0.4)` → `var(--status-success-glow)` for active dot
4. Add `interactive-row` class to SessionRow for CSS hover
5. Add `statusPulse` Framer animation to active session dot
6. Add smooth color transitions

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/session-list.tsx
git commit -m "polish(sessions): CSS hover, active pulse, design tokens"
```

---

### Task 15: Elevate user-menu.tsx

**Files:**
- Modify: `src/components/shell/user-menu.tsx`

**Changes:**
1. Replace `#006fff` → `var(--accent-blue-hover)` in avatar gradient
2. Replace `#ffffff` → `#fff`
3. Add hover scale to trigger button: `className="... hover:scale-105 transition-transform"`
4. Add `focus-ring` to trigger button

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/user-menu.tsx
git commit -m "polish(user-menu): design tokens, hover scale, focus ring"
```

---

### Task 16: Elevate progress-tracker.tsx

**Files:**
- Modify: `src/components/shell/progress-tracker.tsx`

**Changes:**
1. Replace `#fff` → `var(--text-primary)` for checkmark
2. Replace `rgba(34, 197, 94, 0.4)` → `var(--status-success-glow)` for completed ring
3. Add hover background to stage rows
4. Add smooth transition to connection line color: `transition: 'background var(--transition-slow)'`

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/progress-tracker.tsx
git commit -m "polish(tracker): design tokens, hover states, line transitions"
```

---

### Task 17: Elevate research-sections.tsx

**Files:**
- Modify: `src/components/shell/research-sections.tsx`

**Changes:**
1. Remove `onMouseEnter`/`onMouseLeave` at lines 139-140
2. Replace `#ef4444` → `var(--status-error)` (3 instances)
3. Add `interactive-row` class to ResearchRow
4. Make "View →" always visible at 0.5 opacity, full opacity on hover via CSS
5. Add smooth background transitions

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/research-sections.tsx
git commit -m "polish(research-sections): CSS hover, visible action, design tokens"
```

---

### Task 18: Elevate onboarding-context.tsx

**Files:**
- Modify: `src/components/shell/onboarding-context.tsx`

**Changes:**
1. Add Framer Motion import
2. Wrap field values in `motion.span` with a subtle flash animation when value changes (using `key={value}` to trigger re-mount)
3. Add visual distinction between filled (primary text) and empty (tertiary + italic "Waiting...") states
4. Add `interactive-row` class to ContextRow for hover state

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/onboarding-context.tsx
git commit -m "polish(onboarding-ctx): value flash animation, hover states, visual distinction"
```

---

### Task 19: Elevate capabilities-bar.tsx

**Files:**
- Modify: `src/components/shell/capabilities-bar.tsx`

**Changes:**
1. Replace `rgba(54, 94, 255, 0.12)` → `var(--bg-chip-hover)` for active tag
2. Replace `rgba(54, 94, 255, 0.2)` → `var(--border-chip-selected)` for active border
3. Add Framer Motion: wrap tags in `motion.div` with `fastStagger` + `staggerItem` for entrance
4. Add `statusPulse` to active capabilities
5. Add `title` attribute to inactive tags: "Coming soon"

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/capabilities-bar.tsx
git commit -m "polish(capabilities): stagger entrance, active pulse, design tokens"
```

---

### Task 20: Elevate context-panel.tsx

**Files:**
- Modify: `src/components/shell/context-panel.tsx`

**Changes:**
1. Tune chevron spring: use `springs.snappy` (stiffness 500) instead of current generic
2. Add border-bottom transition: `transition: 'border-color var(--transition-normal)'`
3. Add `focus-ring` to section header buttons

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/context-panel.tsx
git commit -m "polish(context-panel): spring tuning, border transitions, focus ring"
```

---

### Task 21: Elevate app-sidebar.tsx

**Files:**
- Modify: `src/components/shell/app-sidebar.tsx`

**Changes:**
1. Replace hardcoded logo gradient `#fff 30%, #93c5fd 100%` → `var(--logo-gradient)` (2 instances — collapsed and expanded)
2. Replace divider hardcoded height/background with Tailwind: `className="h-px mx-4 my-2"` + `style={{ background: 'var(--border-default)' }}`

**Step 1: Apply changes**

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/components/shell/app-sidebar.tsx
git commit -m "polish(sidebar): logo gradient token, divider cleanup"
```

---

### Task 22: Elevate app-shell.tsx

**Files:**
- Modify: `src/components/shell/app-shell.tsx`

**Changes:**
1. Replace inline `max-w-[720px]` style with Tailwind class (it's already a Tailwind class in the className, just verify it's not duplicated in style)
2. Minor — this component is already excellent. Verify no hardcoded colors.

**Step 1: Verify and clean up if needed**

**Step 2: Commit (if changes made)**

```bash
git add src/components/shell/app-shell.tsx
git commit -m "polish(app-shell): minor cleanup"
```

---

## Wave 3: Final Verification

### Task 23: Full build verification + visual sanity

**Step 1: Run full build**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run build`
Expected: Zero errors

**Step 2: Run lint**

Run: `cd /Users/ammar/Dev-Projects/AI-GOS-main && npm run lint`
Expected: No new lint errors

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: fix lint/build issues from UI elevation pass"
```
