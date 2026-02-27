# Task 1.2: Design Token @theme Inline Mapping

## Objective

Add ~30 lines to the `@theme inline` block in globals.css to map existing CSS variables to Tailwind utility classes. Fix mismatched values and add missing tokens (`--accent-red`, `--shadow-glow-blue`).

## Context

Phase 1 foundational task. Most v2 design tokens already exist as CSS variables in the `.dark` scope. The gap is that they aren't mapped in `@theme inline`, so Tailwind can't generate utility classes for them. This task bridges that gap.

## Dependencies

- None (independent of Task 1.1)

## Blocked By

- None

## Research Findings

- From `tailwind-v4-tokens.md`: Tailwind v4 generates utility classes from `@theme inline` block. Pattern: `--color-*` → `bg-*`, `text-*`, `border-*`. `--shadow-*` → `shadow-*`. Must use unique names to avoid colliding with existing shadcn utilities.
- From `existing-codebase.md`: Existing `@theme inline` already maps shadcn vars (`--color-background`, `--color-primary`, etc.) and brand colors. New v2 token names must NOT collide.

## Implementation Plan

### Step 1: Add missing CSS variables to .dark scope

In `src/app/globals.css`, inside the `.dark { }` block, add:

```css
/* Missing accent color */
--accent-red: #ef4444;

/* Missing shadow */
--shadow-glow-blue: 0 0 20px rgba(54, 94, 255, 0.3);
```

### Step 2: Fix mismatched values in .dark scope

```css
/* Fix bg-card-blue opacity: 0.09 → 0.06 per design system */
--bg-card-blue: rgba(51, 136, 255, 0.06);

/* Fix border-subtle opacity: 0.08 → 0.06 per design system */
--border-subtle: rgba(255, 255, 255, 0.06);
```

### Step 3: Add v2 tokens to @theme inline

Add these lines inside the existing `@theme inline { }` block (after the brand colors section):

```css
/* V2 Background Scale */
--color-bg-base: var(--bg-base);
--color-bg-elevated: var(--bg-elevated);
--color-bg-surface: var(--bg-surface);
--color-bg-hover: var(--bg-hover);
--color-bg-active: var(--bg-active);
--color-bg-card: var(--bg-card);
--color-bg-card-blue: var(--bg-card-blue);
--color-bg-chat: var(--bg-chat);
--color-bg-input: var(--bg-input);

/* V2 Text Hierarchy */
--color-text-primary: var(--text-primary);
--color-text-secondary: var(--text-secondary);
--color-text-tertiary: var(--text-tertiary);

/* V2 Border System */
--color-border-subtle: var(--border-subtle);
--color-border-default: var(--border-default);
--color-border-hover: var(--border-hover);
--color-border-focus: var(--border-focus);

/* V2 Accent Colors */
--color-accent-blue: var(--accent-blue);
--color-accent-cyan: var(--accent-cyan);
--color-accent-green: var(--accent-green);
--color-accent-amber: var(--accent-amber);
--color-accent-purple: var(--accent-purple);
--color-accent-red: var(--accent-red);

/* V2 Shadows */
--shadow-v2-card: var(--shadow-card);
--shadow-v2-elevated: var(--shadow-elevated);
--shadow-glow-blue: var(--shadow-glow-blue);
```

**IMPORTANT**: Shadow tokens use `--shadow-*` prefix (Tailwind maps these to `shadow-*` utilities). The `--shadow-card` and `--shadow-elevated` names collide with existing Tailwind shadow scale, so prefix with `v2-`: `--shadow-v2-card`, `--shadow-v2-elevated`.

### Step 4: Verify no collisions

After adding, run `npm run build` to verify Tailwind doesn't error on duplicate or colliding names. The color tokens use namespaced names (`bg-base`, `text-primary`, `accent-blue`) that don't collide with shadcn's names (`background`, `primary`, `foreground`).

## Files to Modify

- `src/app/globals.css` — `.dark` scope (add missing vars, fix values) + `@theme inline` block (add mappings)

## Contracts

### Provides (for downstream tasks)

Tailwind utility classes now available:
- Backgrounds: `bg-bg-base`, `bg-bg-elevated`, `bg-bg-surface`, `bg-bg-hover`, `bg-bg-active`, `bg-bg-card`, `bg-bg-card-blue`, `bg-bg-chat`, `bg-bg-input`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`
- Borders: `border-border-subtle`, `border-border-default`, `border-border-hover`, `border-border-focus`
- Accents: `text-accent-blue`, `bg-accent-blue`, `text-accent-cyan`, `text-accent-green`, `text-accent-amber`, `text-accent-purple`, `text-accent-red`
- Shadows: `shadow-v2-card`, `shadow-v2-elevated`, `shadow-glow-blue`

### Consumes (from upstream tasks)

- None

## Acceptance Criteria

- [ ] `--accent-red: #ef4444` exists in `.dark` scope
- [ ] `--shadow-glow-blue` exists in `.dark` scope
- [ ] `--bg-card-blue` opacity is 0.06 (not 0.09)
- [ ] `--border-subtle` opacity is 0.06 (not 0.08)
- [ ] Tailwind classes `bg-bg-base`, `text-text-primary`, etc. work in components
- [ ] Existing shadcn utility classes still work (no collisions)
- [ ] Build succeeds
- [ ] Lint passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

### Browser Testing (Playwright MCP)

- Start: `npm run dev`
- Navigate to: `/dashboard`
- Verify: Page renders identically to before (no visual changes — tokens are additive)
- Screenshot: `/dashboard` for baseline comparison

## Skills to Read

- None specific

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/tailwind-v4-tokens.md` — Token mapping patterns
- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Current CSS structure

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.2:`
