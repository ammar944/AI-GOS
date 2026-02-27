# Task 1.1: Global Font Replacement

## Objective

Replace Inter with DM Sans and Geist Mono with JetBrains Mono globally in the root `layout.tsx`. Instrument Sans remains unchanged. This is a global replacement per DISCOVERY.md D11.

## Context

This is the first task in Phase 1 (Design System + Backend Foundation). All pages — both v1 and v2 — will use the new fonts. This is simpler and more consistent than journey-specific fonts.

## Dependencies

- None (first task)

## Blocked By

- None

## Research Findings

- From `tailwind-v4-tokens.md`: Tailwind v4 uses `@theme inline` for font families. Current mapping: `--font-sans: var(--font-inter)`, `--font-mono: var(--font-geist-mono)`. These must point to the new fonts.
- From `existing-codebase.md`: Root layout loads Inter, Instrument_Sans, Geist_Mono via `next/font/google`. Body className: `${inter.variable} ${instrumentSans.variable} ${geistMono.variable} font-sans antialiased`.

## Implementation Plan

### Step 1: Update font imports in layout.tsx

Open `src/app/layout.tsx`. Replace the font imports:

```typescript
// REMOVE:
import { Inter, Instrument_Sans, Geist_Mono } from "next/font/google";

// ADD:
import { DM_Sans, Instrument_Sans, JetBrains_Mono } from "next/font/google";
```

### Step 2: Update font configurations

Replace the font constant definitions:

```typescript
// REMOVE Inter, ADD DM Sans:
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

// Instrument Sans stays UNCHANGED:
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// REMOVE Geist_Mono, ADD JetBrains Mono:
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});
```

### Step 3: Update body className

```tsx
<body
  className={`${dmSans.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
  suppressHydrationWarning
>
```

### Step 4: Update @theme inline in globals.css

In `src/app/globals.css`, update the `@theme inline` block:

```css
/* CHANGE from: */
--font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: var(--font-geist-mono);

/* CHANGE to: */
--font-sans: var(--font-dm-sans), -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: var(--font-jetbrains-mono), "JetBrains Mono", monospace;
```

The `--font-heading` and `--font-display` lines referencing `--font-instrument-sans` remain unchanged.

## Files to Modify

- `src/app/layout.tsx` — Font imports, constants, body className
- `src/app/globals.css` — `@theme inline` font-family vars

## Contracts

### Provides (for downstream tasks)

- CSS variable `--font-dm-sans` globally available
- CSS variable `--font-jetbrains-mono` globally available
- `--font-sans` resolves to DM Sans
- `--font-mono` resolves to JetBrains Mono
- `--font-heading` / `--font-display` still resolve to Instrument Sans

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] DM Sans loaded via `next/font/google` with weights 300, 400, 500, 600
- [ ] JetBrains Mono loaded via `next/font/google` with weights 400, 500
- [ ] Instrument Sans unchanged (weights 400, 500, 600, 700)
- [ ] `--font-sans` in `@theme inline` references DM Sans
- [ ] `--font-mono` in `@theme inline` references JetBrains Mono
- [ ] Body className uses new font variables
- [ ] Inter and Geist Mono imports fully removed
- [ ] Build succeeds
- [ ] No visual regressions on existing pages

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Browser Testing (Playwright MCP)

- Start: `npm run dev` (localhost:3000)
- Navigate to: `/dashboard`
- Verify: Body text renders in DM Sans (inspect computed font-family)
- Navigate to: `/generate`
- Verify: Page renders without broken layout
- Screenshot: `/dashboard` with new fonts

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/tailwind-v4-tokens.md` — Font configuration patterns
- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Current layout.tsx structure

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.1:`
