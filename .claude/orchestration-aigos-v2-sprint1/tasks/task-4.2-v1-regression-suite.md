# Task 4.2: V1 Regression Suite

## Objective

Verify that all existing v1 routes and functionality are completely unaffected by Sprint 1 changes. No broken styles, no new console errors, no import side effects, no layout regressions. The v1 application must work exactly as it did before Sprint 1, with the sole expected change being the global font swap from Inter to DM Sans.

## Context

Phase 4 testing task. Sprint 1 introduced new files (journey components, API route, design tokens, fonts) and modified shared files (layout.tsx, globals.css, providers.ts). This task verifies that none of those changes broke existing functionality. The v1 pages are:

- `/` — Landing page
- `/sign-in` — Clerk authentication page
- `/dashboard` — User dashboard with blueprint/media plan cards
- `/generate` — Onboarding wizard and blueprint generation

The only expected visual change across v1 pages is the font: DM Sans replaces Inter as the body font (Task 1.1). All other styling, layout, and functionality must remain identical.

All browser testing uses Playwright MCP connected to the running dev server at localhost:3000.

## Dependencies

- Phase 1 complete (fonts and tokens are the main risk area for v1 regressions)
- Phase 2 complete (component imports must not cause side effects)
- Phase 3 complete (page routing and API changes must not conflict)
- Dev server running at localhost:3000

## Blocked By

- Phase 3 (all tasks including 3.R regression)

## Implementation Plan

This task is a test plan, not an implementation task. Execute the following regression protocol using Playwright MCP.

### Test Group 1: Landing Page (/)

1. Navigate to `http://localhost:3000/`
2. Verify the landing page renders completely:
   - Hero section visible with headline and CTA
   - Navigation/header renders correctly
   - No broken images or missing assets
   - Page layout is correct (no unexpected shifts or overlaps)
3. Check for console errors — zero new JavaScript errors allowed
4. Verify fonts:
   - Body text renders in DM Sans (expected change from Inter)
   - Headings render in Instrument Sans (unchanged)
5. Take a screenshot for evidence
6. Click any navigation links — verify they route correctly

### Test Group 2: Sign-In Page (/sign-in)

1. Navigate to `http://localhost:3000/sign-in`
2. Verify the Clerk authentication UI renders:
   - Sign-in form or Clerk component visible
   - No broken styling or missing elements
   - Page is functional (form fields are interactive)
3. Check for console errors — zero new errors
4. Take a screenshot for evidence
5. If already authenticated, verify redirect behavior is correct

### Test Group 3: Dashboard (/dashboard)

1. Navigate to `http://localhost:3000/dashboard` (must be authenticated)
2. Verify the dashboard renders correctly:
   - Welcome strip visible with user greeting
   - Document tabs render (Blueprints / Media Plans)
   - Blueprint cards render if any exist (or empty state shows correctly)
   - Media plan cards render if any exist (or empty state shows correctly)
3. Verify styling integrity:
   - Card backgrounds, borders, and shadows look correct
   - Text hierarchy is readable (headings, body, muted text)
   - Button variants render correctly (primary, secondary, ghost)
   - Badge/tag components display properly
4. Verify interactive elements:
   - Tabs switch between Blueprints and Media Plans
   - Cards are clickable/hoverable with correct hover states
   - Delete buttons (if visible) render correctly
5. Verify fonts:
   - Dashboard body text is DM Sans (expected change)
   - All text is legible, no font fallback glitches
6. Check shadcn/ui component rendering:
   - Buttons (all variants used on dashboard)
   - Cards (blueprint and media plan cards)
   - Tabs (document tabs)
   - Any dialogs or dropdowns render if triggered
7. Check for console errors — zero new errors
8. Take a screenshot of the full dashboard
9. Take a screenshot of any card hover states

### Test Group 4: Generate Page (/generate)

1. Navigate to `http://localhost:3000/generate` (must be authenticated)
2. Verify the onboarding wizard renders:
   - Step indicators/progress visible
   - Current step form renders with all fields
   - Navigation buttons (Next, Back) are functional
3. Verify the two-column layout:
   - Left panel: onboarding wizard or blueprint content
   - Right panel: chat sidebar (agent-chat component)
   - Divider/border between panels renders correctly
4. Test the agent chat (existing v1 chat):
   - Chat panel visible on the right side
   - Chat input is interactive
   - If prior conversations exist, messages render correctly
5. Verify styling:
   - Form inputs render correctly (text fields, textareas, selects, checkboxes)
   - Step navigation buttons are styled correctly
   - AI suggestion buttons (blue pill) render if visible
6. Verify the onboarding wizard steps:
   - Navigate between steps using Next/Back buttons
   - Form fields are interactive and accept input
   - Step indicator updates correctly
7. Check for console errors — zero new errors
8. Take screenshots of:
   - The initial generate page view
   - At least one wizard step with form fields
   - The chat panel on the right side

### Test Group 5: Build Output Analysis

1. Run `npm run build` and capture output
2. Analyze the build output for:
   - Zero new TypeScript errors
   - Zero new warnings related to v1 code paths
   - No "Module not found" errors from journey imports leaking into v1
   - No circular dependency warnings involving journey components
3. Compare build output to expected patterns:
   - All v1 pages should compile successfully
   - All v1 API routes should compile successfully
   - New journey page should also compile (but this is Task 4.1's concern)

### Test Group 6: Import Side Effect Check

1. Verify that journey components do not cause side effects when imported:
   - Journey components should be tree-shakeable
   - No global state modifications on import
   - No CSS that overrides v1 styling (beyond the intentional font and token changes)
2. Check that the following v1 components still render correctly (these share globals.css):
   - shadcn/ui Button component (all variants: default, destructive, outline, secondary, ghost, link)
   - shadcn/ui Card component
   - shadcn/ui Input component
   - shadcn/ui Dialog component (if accessible on any v1 page)
3. Verify that new CSS variables added in Task 1.2 do not collide with existing shadcn/ui utilities:
   - `bg-primary`, `bg-secondary`, `text-primary`, `text-secondary` (shadcn originals) still work
   - New v2 tokens use namespaced names (`bg-bg-base`, `text-text-primary`) to avoid collision

### Test Group 7: Console Error Audit

1. Navigate through each v1 page in sequence:
   - `/` -> `/sign-in` -> `/dashboard` -> `/generate`
2. At each page, collect all console messages using `browser_console_messages`
3. Categorize any messages:
   - **Errors**: Must be zero new errors. Pre-existing errors are acceptable if documented.
   - **Warnings**: Must be zero new warnings related to v1 code. React hydration warnings, deprecation notices from dependencies, etc. are acceptable if pre-existing.
4. Document all console output for each page

### Test Group 8: Cross-Navigation Test

1. Navigate between v1 pages and /journey to verify no state leakage:
   - Go to `/dashboard`, then navigate to `/journey`, then back to `/dashboard`
   - Verify `/dashboard` still renders correctly after visiting `/journey`
   - Verify no journey-specific styles bleed into dashboard
2. Go to `/generate`, then navigate to `/journey`, then back to `/generate`
   - Verify the generate page still functions correctly
   - Verify the chat sidebar on /generate is not affected by journey components

## Acceptance Criteria

- [ ] `/` landing page renders correctly with no broken elements or console errors
- [ ] `/sign-in` Clerk auth page renders and is functional
- [ ] `/dashboard` renders correctly: welcome strip, tabs, cards, all interactive elements work
- [ ] `/generate` renders correctly: wizard steps, form fields, chat sidebar, two-column layout
- [ ] All shadcn/ui components render correctly (buttons, cards, inputs, tabs, dialogs)
- [ ] Font change is the ONLY visual difference: DM Sans replaces Inter across all v1 pages
- [ ] No new console errors on any v1 page
- [ ] No new console warnings related to v1 code
- [ ] `npm run build` produces zero new errors or warnings for v1 code paths
- [ ] No import side effects from journey components affecting v1 pages
- [ ] New CSS tokens do not collide with existing shadcn/ui utilities
- [ ] Cross-navigation between /journey and v1 pages causes no state leakage or style bleed
- [ ] Screenshots captured for all v1 pages as evidence of correct rendering

## Testing Protocol

### Prerequisites

- [ ] Dev server running at localhost:3000
- [ ] Authenticated Clerk session available
- [ ] Playwright MCP tools loaded and ready
- [ ] At least one blueprint or media plan exists on the dashboard (ideal but not required; empty state is also a valid test)

### Execution

All testing is performed via Playwright MCP browser automation:

1. **Navigate each page**: Use `browser_navigate` for each v1 route
2. **Take snapshots**: Use `browser_snapshot` to inspect the DOM and verify element presence/structure
3. **Take screenshots**: Use `browser_take_screenshot` at each page for visual evidence and comparison
4. **Interact**: Use `browser_click`, `browser_fill_form` to verify interactive elements
5. **Check console**: Use `browser_console_messages` after each page load to audit for errors
6. **Build check**: Use Bash to run `npm run build` and analyze output

### Evidence Collection

For each v1 page, capture:
- A full-page screenshot
- The browser snapshot (accessibility tree)
- Console messages log
- Any interactive state screenshots (hover states, tab switches, form interactions)

### Pass/Fail Criteria

- **PASS**: All v1 pages render correctly, no new errors, font change is the only visual difference
- **FAIL**: Any v1 page is broken, has new console errors, or shows unintended visual changes beyond the font swap. Document the specific failure with evidence.
- **PARTIAL**: Minor issues that do not affect functionality (e.g., a slight spacing difference due to DM Sans vs Inter character width). Document deviations.

### Known Expected Changes

These changes are intentional and should NOT be flagged as regressions:
1. **Font**: DM Sans replaces Inter globally (Task 1.1). Slight character width differences may cause minor text reflow.
2. **New CSS variables**: Additional CSS custom properties in globals.css (Task 1.2). These use namespaced names and should not affect existing styles.
3. **New model constant**: `MODELS.CLAUDE_OPUS` added to providers.ts (Task 1.4). Does not affect existing model usage.

## Skills to Read

- None specific (this is a testing task)

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — What was changed and what should be unchanged
- `.claude/orchestration-aigos-v2-sprint1/PHASES.md` — Phase 4 regression expectations

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.2:`
- Note: This task should not produce code changes unless a regression is found. If a regression is found, fix it and commit with a descriptive message explaining the fix. If all tests pass, no commit is needed.
