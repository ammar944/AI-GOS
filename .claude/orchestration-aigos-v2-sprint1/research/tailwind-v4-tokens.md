# Research: Tailwind CSS v4 Design Token Configuration

**Domain**: Design Token System for AI-GOS v2 Sprint 1
**Date**: 2026-02-27
**Status**: Complete

---

## 1. Current Project State

### Tailwind Version
- **Tailwind CSS v4** (`"tailwindcss": "^4"` in package.json)
- **PostCSS plugin**: `@tailwindcss/postcss` (v4-native, no `tailwind.config.ts` file)
- **No `tailwind.config.ts` exists** — the project is fully CSS-first configuration via `@theme` directive in `globals.css`

### Current CSS Architecture (`src/app/globals.css`)
- Uses `@import "tailwindcss"` and `@import "tw-animate-css"` at the top
- Uses `@custom-variant dark (&:is(.dark *))` for dark mode
- Has an existing `@theme inline { ... }` block that maps shadcn/ui CSS variables to Tailwind color utilities
- CSS variables are defined in `:root` (light mode) and `.dark` (dark mode)
- Already has many v2 design tokens defined in `.dark` scope (--bg-base, --text-primary, --accent-blue, etc.)
- Already has custom keyframes and animations outside `@theme`
- Uses `@layer base`, `@layer utilities` for custom styles
- Unlayered styles (outside `@layer`) for specificity overrides

### Current Font Setup (`src/app/layout.tsx`)
- **Inter** → `--font-inter` (body font)
- **Instrument_Sans** → `--font-instrument-sans` (headings)
- **Geist_Mono** → `--font-geist-mono` (code/data)
- Applied via className on `<body>`: `${inter.variable} ${instrumentSans.variable} ${geistMono.variable} font-sans`

### Current @theme inline Block
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: var(--font-instrument-sans), "Instrument Sans", sans-serif;
  --font-display: var(--font-instrument-sans), "Cabinet Grotesk", sans-serif;
  --font-mono: var(--font-geist-mono);
  /* ...shadcn color mappings (sidebar, chart, card, etc.)... */
  --color-brand-navy: var(--brand-navy);
  --color-brand-navy-light: var(--brand-navy-light);
  --color-brand-blue: var(--brand-blue);
  --color-brand-blue-light: var(--brand-blue-light);
  --color-brand-sky: var(--brand-sky);
  --color-brand-periwinkle: var(--brand-periwinkle);
}
```

---

## 2. Tailwind CSS v4 @theme Directive — How It Works

### 2.1 CSS-First Configuration
Tailwind v4 replaces `tailwind.config.ts` with CSS-based configuration via `@theme` directives. All design tokens are defined directly in your CSS file.

```css
@import "tailwindcss";

@theme {
  --color-primary: #365eff;
  --font-sans: "DM Sans", sans-serif;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4);
}
```

### 2.2 Theme Variable Namespaces
Each namespace generates corresponding utility classes:

| Namespace | Utility Classes Generated | Example |
|-----------|--------------------------|---------|
| `--color-*` | `bg-*`, `text-*`, `border-*`, `ring-*`, `fill-*`, `stroke-*`, etc. | `--color-brand-blue` → `bg-brand-blue`, `text-brand-blue` |
| `--font-*` | `font-*` | `--font-display` → `font-display` |
| `--shadow-*` | `shadow-*` | `--shadow-card` → `shadow-card` |
| `--radius-*` | `rounded-*` | `--radius-lg` → `rounded-lg` |
| `--animate-*` | `animate-*` | `--animate-pulse-glow` → `animate-pulse-glow` |
| `--ease-*` | `ease-*` | `--ease-fluid` → `ease-fluid` |
| `--spacing-*` | `p-*`, `m-*`, `gap-*`, `w-*`, `h-*` | `--spacing-4` → `p-4` |

### 2.3 @theme vs @theme inline vs @theme static

**`@theme { ... }`** — Standard theme definition. Values are output as `:root` CSS custom properties AND generate utility classes. Use for static/literal values.

```css
@theme {
  --color-primary: #365eff;  /* Literal value, generates bg-primary etc. */
}
```

**`@theme inline { ... }`** — For values that reference OTHER CSS variables. The utility class will use `var(--referenced-var)` instead of resolving to a static value. **REQUIRED when tokens reference CSS custom properties defined in `:root`/`.dark`.**

```css
:root { --my-brand-color: #365eff; }
.dark { --my-brand-color: #006fff; }

@theme inline {
  --color-brand: var(--my-brand-color);  /* Utility resolves via var() */
}
```

Without `inline`, Tailwind would try to resolve the `var()` at build time, which fails for dynamic/scoped variables.

**`@theme static { ... }`** — Generates CSS variables that are always output (not tree-shaken), even if unused. Useful for variables referenced in JavaScript or inline styles.

### 2.4 Extending vs Overriding

**Extend** (add new tokens alongside defaults):
```css
@theme {
  --color-brand-blue: #365eff;   /* New token, defaults remain */
  --font-display: "Instrument Sans", sans-serif;
}
```

**Override a namespace** (remove all defaults for that namespace):
```css
@theme {
  --color-*: initial;      /* Removes ALL default colors */
  --color-white: #fff;     /* Only these colors exist now */
  --color-brand-blue: #365eff;
}
```

**Override everything** (nuclear option, rarely needed):
```css
@theme {
  --*: initial;            /* Removes ALL defaults */
}
```

---

## 3. Implementation Plan: Design Tokens

### 3.1 Strategy: Dual-Layer Approach

The project already uses a dual-layer pattern that MUST be maintained:
1. **Layer 1**: CSS variables on `:root` / `.dark` — define actual color values
2. **Layer 2**: `@theme inline` — map CSS variables to Tailwind utility namespaces

This is the correct pattern for shadcn/ui coexistence because:
- shadcn components use `bg-background`, `text-foreground`, `border-border`, etc.
- Those map to `--color-background`, `--color-foreground`, `--color-border` in `@theme inline`
- Which resolve to `var(--background)`, `var(--foreground)`, `var(--border)` CSS variables
- The CSS variables change value between `:root` (light) and `.dark` (dark)

### 3.2 New Design Tokens to Add

The design system document specifies exact hex values. Many already exist in `.dark` but need to be:
1. Updated to match exact spec values (some are slightly off)
2. Mapped to `@theme inline` so they generate Tailwind utilities

#### Brand Colors (already in `:root`, need @theme mapping)
```css
/* These need to be in .dark (they're the primary/only theme) */
--brand-navy: #07090e;
--brand-navy-light: #0a0d14;
--brand-blue: #365eff;
--brand-blue-hover: #006fff;
--brand-sky: #93c5fd;
```

**Current state**: Brand colors exist in `:root` using OKLCH values. The design system specifies hex values. The `.dark` scope already has `--accent-blue: rgb(54, 94, 255)` which is #365eff. Need to reconcile.

**Decision**: Keep brand colors in `:root` (they're global). Add v2-specific tokens in `.dark` where they differ. Map all to `@theme inline`.

#### Background Scale
```css
/* In .dark: */
--bg-base: #07090e;
--bg-elevated: #0a0d14;
--bg-surface: #0c0e13;
--bg-hover: #14171e;
--bg-active: #191c23;
--bg-card: #0c0e13;
--bg-card-blue: rgba(51,136,255,0.06);
```

**Current state**: ALL of these already exist in `.dark` with `rgb()` values. Need to verify exact match:
- `--bg-base: rgb(7, 9, 14)` = #07090e -- MATCHES
- `--bg-elevated: rgb(10, 13, 20)` = #0a0d14 -- MATCHES
- `--bg-surface: rgb(12, 14, 19)` = #0c0e13 -- MATCHES
- `--bg-hover: rgb(20, 23, 30)` = #14171e -- MATCHES
- `--bg-active: rgb(25, 28, 35)` = #191c23 -- MATCHES
- `--bg-card: rgb(12, 14, 19)` = #0c0e13 -- MATCHES
- `--bg-card-blue: rgba(51, 136, 255, 0.09)` -- Spec says 0.06, current is 0.09 -- NEEDS UPDATE

**Action**: Update `--bg-card-blue` from `0.09` to `0.06`. All others match.

#### Text Colors
```css
/* In .dark: */
--text-primary: #fcfcfa;
--text-secondary: #cdd0d5;
--text-tertiary: #646973;
--text-quaternary: #31353f;
--text-muted: #20232d;
```

**Current state**: All exist and match:
- `--text-primary: rgb(252, 252, 250)` = #fcfcfa -- MATCHES
- `--text-secondary: rgb(205, 208, 213)` = #cdd0d5 -- MATCHES
- `--text-tertiary: rgb(100, 105, 115)` = #646973 -- MATCHES
- `--text-quaternary: rgb(49, 53, 63)` = #31353f -- MATCHES
- `--text-muted: rgb(32, 35, 45)` = #20232d -- MATCHES

**Action**: None needed for values. Need `@theme inline` mappings.

#### Border System
```css
/* In .dark: */
--border-subtle: rgba(255,255,255,0.06);
--border-default: #1f1f1f;
--border-hover: #2d2d32;
--border-focus: #365eff;
```

**Current state**: All exist. Subtle is `0.08` in current, spec says `0.06`.
- `--border-subtle: rgba(255, 255, 255, 0.08)` -- Spec says 0.06 -- NEEDS UPDATE
- `--border-default: rgb(31, 31, 31)` = #1f1f1f -- MATCHES
- `--border-hover: rgb(45, 45, 50)` = #2d2d32 -- MATCHES
- `--border-focus: rgb(54, 94, 255)` = #365eff -- MATCHES

**Action**: Update `--border-subtle` from `0.08` to `0.06`.

#### Accent Colors
```css
/* In .dark: */
--accent-blue: #365eff;
--accent-cyan: #50f8e4;
--accent-amber: #f59e0b;
--accent-green: #22c55e;
--accent-red: #ef4444;
--accent-purple: #a78bfa;
```

**Current state**: Most exist. Need to add `--accent-red`.
- `--accent-blue: rgb(54, 94, 255)` = #365eff -- MATCHES
- `--accent-cyan: rgb(80, 248, 228)` = #50f8e4 -- MATCHES
- `--accent-green: rgb(34, 197, 94)` = #22c55e -- MATCHES
- `--accent-amber: rgb(245, 158, 11)` = #f59e0b -- MATCHES
- `--accent-purple: rgb(167, 139, 250)` = #a78bfa -- MATCHES
- `--accent-red` -- NOT defined as CSS var (only `--error: #ef4444`) -- NEEDS ADD

**Action**: Add `--accent-red: #ef4444;` to `.dark`. Map to `@theme inline`.

#### Shadows
```css
--shadow-card: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02);
--shadow-elevated: 0 4px 16px rgba(0,0,0,0.5);
--shadow-glow-blue: 0 0 20px rgba(54,94,255,0.15);
```

**Current state**: `--shadow-card` and `--shadow-elevated` exist and match. `--shadow-glow-blue` does not exist (there's `--shadow-glow` but it uses OKLCH).

**Action**: Add `--shadow-glow-blue`. Map all three to `@theme`.

### 3.3 The @theme inline Additions

These are the NEW entries needed in the `@theme inline` block to generate Tailwind utilities:

```css
@theme inline {
  /* === EXISTING shadcn mappings (keep all) === */

  /* === V2 Design System: Background Scale === */
  --color-bg-base: var(--bg-base);
  --color-bg-elevated: var(--bg-elevated);
  --color-bg-surface: var(--bg-surface);
  --color-bg-hover: var(--bg-hover);
  --color-bg-active: var(--bg-active);
  --color-bg-card: var(--bg-card);
  --color-bg-card-blue: var(--bg-card-blue);

  /* === V2 Design System: Text Colors === */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-quaternary: var(--text-quaternary);
  --color-text-muted: var(--text-muted);

  /* === V2 Design System: Border System === */
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-hover: var(--border-hover);
  --color-border-focus: var(--border-focus);

  /* === V2 Design System: Accent Colors === */
  --color-accent-blue: var(--accent-blue);
  --color-accent-cyan: var(--accent-cyan);
  --color-accent-amber: var(--accent-amber);
  --color-accent-green: var(--accent-green);
  --color-accent-red: var(--accent-red);
  --color-accent-purple: var(--accent-purple);

  /* === V2 Design System: Fonts === */
  --font-sans: var(--font-dm-sans), "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: var(--font-instrument-sans), "Instrument Sans", sans-serif;
  --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace;
}
```

**IMPORTANT**: The `--color-*` namespace in `@theme` generates utilities in ALL color-accepting utility classes:
- `--color-bg-base` → `bg-bg-base`, `text-bg-base`, `border-bg-base`, etc.
- `--color-text-primary` → `text-text-primary`, `bg-text-primary`, etc.
- `--color-accent-blue` → `text-accent-blue`, `bg-accent-blue`, `border-accent-blue`, etc.

So the utility class usage would be:
```html
<div class="bg-bg-base text-text-primary border-border-default">
  <span class="text-text-secondary">Body text</span>
  <span class="text-accent-blue">Link</span>
</div>
```

This looks a bit redundant (`bg-bg-*`, `text-text-*`) but is the standard pattern when using semantic token names that include the context. The alternative would be to flatten (e.g., `--color-base` for background) but that creates ambiguity.

### 3.4 Shadow Tokens in @theme

Shadows use the `--shadow-*` namespace (NOT `--color-*`):

```css
@theme inline {
  --shadow-card: var(--shadow-card);
  --shadow-elevated: var(--shadow-elevated);
  --shadow-glow-blue: var(--shadow-glow-blue);
}
```

This generates: `shadow-card`, `shadow-elevated`, `shadow-glow-blue` utilities.

**IMPORTANT CAVEAT**: There is a naming collision. The `.dark` CSS variables are `--shadow-card` and the `@theme` variable is also `--shadow-card`. This will work because `@theme inline` uses `var(--shadow-card)` which resolves from the `:root`/`.dark` scope. But to be safe and avoid circular reference, we should rename the @theme vars:

Actually, this is not a circular reference issue because `@theme inline` generates variables like `--shadow-card` at `:root` level that resolve to `var(--shadow-card)` from the `.dark` scope. Since the CSS variables are defined in `.dark` and the @theme generates at `:root`, this could cause issues.

**Better approach**: Define shadows directly in `@theme` (not `@theme inline`) since they don't change between light/dark:

```css
@theme {
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02);
  --shadow-elevated: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-glow-blue: 0 0 20px rgba(54,94,255,0.15);
}
```

This is cleaner and avoids variable name collision. Since the design is dark-first (no light mode variation), static values are fine.

**HOWEVER**, the existing `.dark` scope already defines `--shadow-card`, `--shadow-elevated`, and other shadow vars. These are used by existing components via `var(--shadow-card)`. We need to keep backward compatibility.

**Final approach**: Add `@theme` shadow definitions with DIFFERENT names if needed, or use the existing CSS variable names in the `@theme` block. Since `@theme` output goes to `:root` and `.dark` also sets them, the `.dark` values will win due to specificity. So we should define them in a separate `@theme` block:

```css
@theme {
  --shadow-v2-card: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02);
  --shadow-v2-elevated: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-glow-blue: 0 0 20px rgba(54,94,255,0.15);
}
```

Actually, the simplest approach: keep the existing `--shadow-card` and `--shadow-elevated` CSS variables in `.dark` for backward compat, and add NEW @theme entries only for tokens that don't already have utility coverage. Since the existing code uses `var(--shadow-card)` in custom CSS (not Tailwind utilities), we just need to add `@theme` entries to enable the `shadow-card` utility:

```css
@theme {
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02);
  --shadow-elevated: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-glow-blue: 0 0 20px rgba(54,94,255,0.15);
}
```

The `@theme` output will set these on `:root`. The `.dark` definitions will also set them. Since the app always has `.dark` class, the `.dark` values will apply (they override `:root`). But since both values are identical, there's no conflict. This is the cleanest approach.

---

## 4. Font Configuration

### 4.1 Design System Font Requirements

| Typeface | Role | Weights | CSS Variable | Tailwind Utility |
|----------|------|---------|-------------|-----------------|
| DM Sans | Body/UI | 300, 400, 500, 600 | `--font-dm-sans` | `font-sans` |
| Instrument Sans | Display/Headings | 400, 500, 600, 700 | `--font-instrument-sans` | `font-display` |
| JetBrains Mono | Code/Data | 400, 500 | `--font-jetbrains-mono` | `font-mono` |

### 4.2 Current Font State
- **Inter** is currently the body font → needs to be replaced by **DM Sans**
- **Instrument Sans** already loaded with correct weights (400, 500, 600, 700) -- KEEP
- **Geist Mono** is currently the mono font → needs to be replaced by **JetBrains Mono**

### 4.3 Next.js Font Loading via `next/font/google`

All three fonts are available in Google Fonts and importable via `next/font/google`.

**DM Sans** is a variable font — no need to specify weights (all weights included automatically):
```typescript
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});
```

**Instrument Sans** (already loaded, just update variable name for consistency):
```typescript
import { Instrument_Sans } from "next/font/google";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
```

**JetBrains Mono** is a variable font:
```typescript
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});
```

### 4.4 Layout.tsx Changes

```typescript
import { DM_Sans, Instrument_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// In the body:
<body className={`${dmSans.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
```

### 4.5 @theme Font Family Mappings

```css
@theme inline {
  --font-sans: var(--font-dm-sans), "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: var(--font-instrument-sans), "Instrument Sans", sans-serif;
  --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace;
}
```

This generates:
- `font-sans` → DM Sans (body text, UI elements)
- `font-display` → Instrument Sans (headings, logo)
- `font-mono` → JetBrains Mono (scores, diffs, citations)

### 4.6 Backward Compatibility Concern

The existing `--font-sans` maps to `var(--font-inter)`. Changing to DM Sans will affect ALL existing components that use `font-sans`. This is intentional for v2, but since we're building v2 parallel to v1:

**Option A**: Change globally (recommended) — DM Sans is similar enough to Inter that v1 pages won't break visually. Both are geometric sans-serif fonts. This avoids maintaining two font stacks.

**Option B**: Keep Inter for v1, use DM Sans only in v2 routes via a route-level class. More complex, requires conditional font loading.

**Recommendation**: Go with Option A. DM Sans is a drop-in replacement for Inter in terms of character width and x-height. The design system explicitly says DM Sans is the body font. Existing shadcn components will look fine.

The same logic applies to JetBrains Mono replacing Geist Mono — both are monospace fonts with similar metrics.

---

## 5. Animation Tokens

### 5.1 Design System Animation Requirements

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| pulse-glow-sm | 1.5s infinite | ease-in-out | Active research step dot |
| spin-slow | 2s infinite | linear | Tool loading icon |
| blink-cursor | 0.8s infinite | step-end | Streaming text cursor |
| typing-bounce | 1.2s infinite | ease-in-out | AI typing dots |
| score-bar-fill | 1s on load | ease | Score bars animate width |
| chart-bar-grow | 0.8s on load | ease | Mini chart bars animate height |

### 5.2 Defining Animations in @theme

In Tailwind v4, animations are defined using the `--animate-*` namespace with `@keyframes` inside `@theme`:

```css
@theme {
  /* Pulse glow for active states */
  --animate-pulse-glow: pulse-glow-sm 1.5s ease-in-out infinite;
  @keyframes pulse-glow-sm {
    0%, 100% {
      box-shadow: 0 0 4px rgba(54, 94, 255, 0.3);
    }
    50% {
      box-shadow: 0 0 12px rgba(54, 94, 255, 0.6);
    }
  }

  /* Slow spin for tool loading */
  --animate-spin-slow: spin-slow 2s linear infinite;
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Blink cursor for streaming */
  --animate-blink-cursor: blink-cursor 0.8s step-end infinite;
  @keyframes blink-cursor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Typing bounce for indicator dots */
  --animate-typing-bounce: typing-bounce 1.2s ease-in-out infinite;
  @keyframes typing-bounce {
    0%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  /* Score bar fill (one-shot) */
  --animate-score-fill: score-bar-fill 1s ease both;
  @keyframes score-bar-fill {
    from { width: 0%; }
    to { width: var(--target-width, 100%); }
  }

  /* Chart bar grow (one-shot) */
  --animate-chart-grow: chart-bar-grow 0.8s ease both;
  @keyframes chart-bar-grow {
    from { height: 0; }
    to { height: var(--target-height, 100%); }
  }
}
```

Usage in markup:
```html
<div class="animate-pulse-glow">...</div>
<div class="animate-spin-slow">...</div>
<span class="animate-blink-cursor">|</span>
<div class="animate-typing-bounce" style="animation-delay: 0.15s">.</div>
<div class="animate-score-fill" style="--target-width: 75%">...</div>
```

### 5.3 Existing Animations to Preserve

The current `globals.css` already has several animations defined OUTSIDE `@theme`:
- `gradientShift` / `shaderPulse` — shader mesh background
- `float` — decorative blobs
- `pulse-glow` — existing pulse glow
- `gradient-shift` — gradient animation
- `shimmer` — skeleton loading
- `voice-pulse` — voice recording
- `input-recording-glow` — recording indicator
- `field-pending-pulse` / `field-approved-flash` / `field-rejected-flash` — blueprint field highlights
- `streaming-cursor-blink` — existing streaming cursor
- `stream-fade-in` — content entrance
- `streaming-bubble-glow` — bubble glow

These MUST be preserved. The new `@theme` animation definitions should coexist. Existing animations that are already defined outside `@theme` can stay where they are (they work fine as plain CSS @keyframes + utility classes).

For new v2 animations, define them inside `@theme` to get `animate-*` utility class generation.

---

## 6. Coexistence with Existing shadcn/ui Theme

### 6.1 Strategy: Additive Extension

The existing `@theme inline` block maps shadcn's semantic color variables:
```css
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-primary: var(--primary);
--color-card: var(--card);
/* etc. */
```

These MUST remain untouched. The new v2 tokens are ADDITIVE — they sit alongside:
```css
@theme inline {
  /* Existing shadcn mappings (DO NOT REMOVE) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... */

  /* NEW: V2 Design System tokens */
  --color-bg-base: var(--bg-base);
  --color-text-primary: var(--text-primary);
  --color-accent-blue: var(--accent-blue);
  /* ... */
}
```

### 6.2 No Conflicts

The v2 tokens use namespaced names (`bg-base`, `text-primary`, `accent-blue`) that don't collide with shadcn's names (`background`, `foreground`, `primary`). Both sets of utility classes work simultaneously.

Existing shadcn components continue to use `bg-background`, `text-foreground`, `border-border`.
New v2 components use `bg-bg-base`, `text-text-primary`, `border-border-default`.

### 6.3 Dark Mode

The existing setup uses `@custom-variant dark (&:is(.dark *))` and the `<html>` element always has `className="dark"`. This means:
- `:root` values are light mode defaults (rarely seen)
- `.dark` values are what actually apply (the app is always dark)
- The v2 design system is inherently dark-only
- No light mode variations needed for v2 tokens

This is already correctly implemented.

---

## 7. RGBA Values in Tailwind v4

### 7.1 Direct RGBA in @theme

RGBA values work directly in `@theme` definitions:

```css
@theme {
  --color-bg-card-blue: rgba(51, 136, 255, 0.06);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
```

### 7.2 Opacity Modifier Syntax

Tailwind v4 supports opacity modifiers on any color utility:
```html
<div class="bg-accent-blue/10">    <!-- 10% opacity -->
<div class="text-text-primary/80"> <!-- 80% opacity -->
<div class="border-border-subtle/50"> <!-- 50% opacity -->
```

This works automatically with any color defined in `@theme`, regardless of format (hex, rgb, oklch, etc.).

### 7.3 The --alpha() Function

For custom CSS, use `--alpha()` to adjust opacity of theme colors:
```css
.my-element {
  background: --alpha(var(--color-accent-blue) / 10%);
}
/* Compiles to: color-mix(in oklab, var(--color-accent-blue) 10%, transparent) */
```

### 7.4 Important Note on CSS Variable Colors with Opacity

When a CSS variable holds an rgba value (like `--bg-card-blue: rgba(51, 136, 255, 0.06)`), the `/` opacity modifier in utilities like `bg-bg-card-blue/50` will NOT work as expected because the color already has an alpha channel. Tailwind uses `color-mix()` which compounds the opacity.

For tokens that already include alpha (like `--bg-card-blue`, `--border-subtle`), define them with their final opacity built in and don't rely on the `/` modifier.

---

## 8. Complete Implementation Reference

### 8.1 CSS Variables Block (additions/changes to `.dark` in globals.css)

```css
.dark {
  /* ... existing variables ... */

  /* UPDATE: bg-card-blue opacity from 0.09 to 0.06 */
  --bg-card-blue: rgba(51, 136, 255, 0.06);

  /* UPDATE: border-subtle opacity from 0.08 to 0.06 */
  --border-subtle: rgba(255, 255, 255, 0.06);

  /* ADD: missing accent color */
  --accent-red: #ef4444;

  /* ADD: glow shadow */
  --shadow-glow-blue: 0 0 20px rgba(54, 94, 255, 0.15);
}
```

### 8.2 @theme inline Block (additions)

```css
@theme inline {
  /* ... existing entries ... */

  /* V2 Background Scale */
  --color-bg-base: var(--bg-base);
  --color-bg-elevated: var(--bg-elevated);
  --color-bg-surface: var(--bg-surface);
  --color-bg-hover: var(--bg-hover);
  --color-bg-active: var(--bg-active);
  --color-bg-card: var(--bg-card);
  --color-bg-card-blue: var(--bg-card-blue);

  /* V2 Text Colors */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-quaternary: var(--text-quaternary);
  --color-text-muted: var(--text-muted);

  /* V2 Border System */
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-hover: var(--border-hover);
  --color-border-focus: var(--border-focus);

  /* V2 Accent Colors */
  --color-accent-blue: var(--accent-blue);
  --color-accent-cyan: var(--accent-cyan);
  --color-accent-amber: var(--accent-amber);
  --color-accent-green: var(--accent-green);
  --color-accent-red: var(--accent-red);
  --color-accent-purple: var(--accent-purple);

  /* V2 Font Families */
  --font-sans: var(--font-dm-sans), "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: var(--font-instrument-sans), "Instrument Sans", sans-serif;
  --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace;
}
```

### 8.3 Separate @theme Block for Shadows and Animations

```css
@theme {
  /* V2 Shadow Tokens */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02);
  --shadow-elevated: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-glow-blue: 0 0 20px rgba(54,94,255,0.15);

  /* V2 Animation Tokens */
  --animate-pulse-glow: pulse-glow-v2 1.5s ease-in-out infinite;
  @keyframes pulse-glow-v2 {
    0%, 100% { box-shadow: 0 0 4px rgba(54, 94, 255, 0.3); }
    50% { box-shadow: 0 0 12px rgba(54, 94, 255, 0.6); }
  }

  --animate-spin-slow: spin-slow 2s linear infinite;
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  --animate-blink-cursor: blink-cursor-v2 0.8s step-end infinite;
  @keyframes blink-cursor-v2 {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  --animate-typing-bounce: typing-bounce 1.2s ease-in-out infinite;
  @keyframes typing-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  --animate-score-fill: score-bar-fill 1s ease both;
  @keyframes score-bar-fill {
    from { width: 0%; }
  }

  --animate-chart-grow: chart-bar-grow 0.8s ease both;
  @keyframes chart-bar-grow {
    from { height: 0; }
  }
}
```

### 8.4 Generated Tailwind Utility Classes

After implementation, these utility classes become available:

**Backgrounds**:
`bg-bg-base`, `bg-bg-elevated`, `bg-bg-surface`, `bg-bg-hover`, `bg-bg-active`, `bg-bg-card`, `bg-bg-card-blue`

**Text**:
`text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-quaternary`, `text-text-muted`

**Borders**:
`border-border-subtle`, `border-border-default`, `border-border-hover`, `border-border-focus`

**Accents** (work in bg-*, text-*, border-*, ring-*, etc.):
`text-accent-blue`, `bg-accent-blue`, `border-accent-blue`, `ring-accent-blue`
`text-accent-cyan`, `bg-accent-cyan`, etc.
`text-accent-amber`, `text-accent-green`, `text-accent-red`, `text-accent-purple`

**Fonts**:
`font-sans` (DM Sans), `font-display` (Instrument Sans), `font-mono` (JetBrains Mono)

**Shadows**:
`shadow-card`, `shadow-elevated`, `shadow-glow-blue`

**Animations**:
`animate-pulse-glow`, `animate-spin-slow`, `animate-blink-cursor`, `animate-typing-bounce`, `animate-score-fill`, `animate-chart-grow`

---

## 9. Risks and Mitigations

### Risk 1: Font swap breaks v1 pages
**Impact**: Low. DM Sans and Inter are both geometric sans-serifs with similar metrics.
**Mitigation**: Visual QA on dashboard and generate pages after font change.

### Risk 2: @theme shadow names collide with CSS variable names
**Impact**: Medium. Both `.dark` and `@theme` define `--shadow-card`.
**Mitigation**: `@theme` sets on `:root`, `.dark` overrides. Since values match, no visual difference. Test that `shadow-card` utility works.

### Risk 3: Existing components using var(--accent-blue) in custom CSS
**Impact**: None. CSS variables remain unchanged. Only NEW Tailwind utility classes are added.

### Risk 4: bg-bg-base naming looks redundant
**Impact**: Low (cosmetic). The `bg-` prefix is Tailwind's utility prefix, `bg-` in the token name is semantic.
**Mitigation**: This is the standard pattern. Alternative: use `--color-base` for `bg-base` utility, but that creates ambiguity (is "base" a background? a brand color?). Keeping the semantic prefix is clearer.

### Risk 5: OKLCH vs hex mismatch for brand colors
**Impact**: Low. Current `:root` uses OKLCH for brand colors. Design system specifies hex. Both represent the same colors (approximately).
**Mitigation**: For the v2 tokens in `.dark`, use the exact hex values from the design system. The `:root` OKLCH values are only visible in light mode (which is never shown).

---

## 10. File Change Summary

| File | Changes |
|------|---------|
| `src/app/globals.css` | Update `.dark` vars (bg-card-blue, border-subtle, add accent-red, shadow-glow-blue). Extend `@theme inline` with v2 color/font tokens. Add new `@theme` block for shadows + animations. |
| `src/app/layout.tsx` | Replace Inter with DM_Sans. Replace Geist_Mono with JetBrains_Mono. Update CSS variable names. Update body className. |
| No new files needed | All changes go into existing files. |

---

## Sources

- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS v4 Adding Custom Styles](https://tailwindcss.com/docs/adding-custom-styles)
- [Tailwind CSS v4 Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- [Tailwind CSS v4 Animation Utilities](https://tailwindcss.com/docs/animation)
- [Tailwind CSS v4 Functions and Directives](https://tailwindcss.com/docs/functions-and-directives)
- [Tailwind CSS v4 Box Shadow](https://tailwindcss.com/docs/box-shadow)
- [shadcn/ui Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Theming best practices in v4 (GitHub Discussion)](https://github.com/tailwindlabs/tailwindcss/discussions/18471)
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [Google Fonts: DM Sans](https://fonts.google.com/specimen/DM+Sans)
- [Google Fonts: JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- [Next.js 15 + Tailwind v4 Fonts Guide](https://www.buildwithmatija.com/blog/how-to-use-custom-google-fonts-in-next-js-15-and-tailwind-v4)
