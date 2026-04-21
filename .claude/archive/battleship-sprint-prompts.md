# Battleship Sprint — Claude Code Prompts

**Status**: Sprint 3 complete. Battleship Sprint = Three-panel command center + progressive inline research.
**Scope**: App Shell, Left Sidebar, Right Context Panel, Progressive Research Pipeline, Integration + Polish
**Branch**: `aigos-v2`
**Reference Mockup**: `aigos-v2-battleship.html` (open in browser for visual reference)

> **What changed from Sprint 3**: We're killing the two-phase layout (centered chat → two-column blueprint panel) and replacing it with a permanent three-panel battleship layout. Research happens INLINE during the conversation — no more "collect everything then generate" batch flow.

---

## Execution Order

```
PHASE 1 — Sequential (foundation):
└── Component 1: App Shell (three-panel grid skeleton)

PHASE 2 — 3 sessions in PARALLEL (after Phase 1):
├── Component 2: Left Sidebar (nav, sessions, user menu)
├── Component 3: Right Context Panel (progress, research, context, capabilities)
└── Component 4a-c: Progressive Research Tool + Prompt Update

PHASE 3 — Sequential (after Phase 2):
├── Component 4d-e: Inline Research Cards + Right Panel Sync
└── Component 5: Integration Wiring + Old Flow Removal

PHASE 4 — Sequential (after Phase 3):
├── Design Elevation Pass (right panel polish, premium feel)
└── E2E Testing + Regression
```

---

## Component 1: App Shell

```
Think hard about this task. You are executing the Battleship Sprint for AI-GOS v2. The current app has a two-phase layout (centered chat → two-column with blueprint panel). We're replacing this with a PERMANENT three-panel command center layout that never changes phase.

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions, commands, tech stack
2. @BATTLESHIP-SPRINT.md — Full sprint plan with all component specs
3. @aigos-v2-battleship.html — Visual mockup (open in browser to see the target)
4. @src/app/globals.css — Design tokens (bg-base, bg-elevated, bg-surface, border-subtle, border-default, text hierarchy, accent colors)

Then read the files you're replacing/modifying:

5. @src/components/journey/journey-layout.tsx — REPLACING THIS (60 lines, two-column animated layout)
6. @src/app/journey/page.tsx — MODIFYING THIS (339 lines, manages phases, chat, blueprint panel)
7. @src/components/journey/journey-header.tsx — Will be modified later (progress moves to right panel)
8. @src/lib/motion.ts — Framer Motion spring configs (reuse these)

## Step 1 — Plan

Enter plan mode. Design the AppShell component:

### Requirements
- CSS Grid: `grid-template-columns: auto 1fr auto`
- Left sidebar slot: 220px default, collapses to 48px icon strip at < 1280px viewport
- Center workspace slot: flex-1 with max-width 720px and auto-centering (like current setup phase)
- Right panel slot: 320px default, hides completely at < 1024px (accessible via drawer later)
- All three panels are ALWAYS present — no phase-based show/hide
- Left and right borders use `var(--border-subtle)`
- Background: `var(--bg-base)` for center, `var(--bg-elevated)` for sidebar
- Each panel scrolls independently (overflow-y: auto)
- Framer Motion entrance animation on mount (staggered: sidebar → center → right panel)

### Context Provider
- `ShellProvider` context with: `sidebarCollapsed: boolean`, `rightPanelCollapsed: boolean`, `toggleSidebar()`, `toggleRightPanel()`
- Persists collapse state to localStorage

## Step 2 — Execute

### Files to Create

1. `src/components/shell/app-shell.tsx`
   - The three-panel CSS Grid container
   - Accepts: `sidebar: ReactNode`, `children: ReactNode` (center), `rightPanel: ReactNode`
   - Handles responsive collapse logic
   - Framer Motion `layoutId` for smooth panel transitions
   - Named export: `AppShell`

2. `src/components/shell/shell-provider.tsx`
   - React context for shell state
   - `useShell()` hook for accessing collapse toggles
   - Persists to localStorage key `aigos:shell-state`
   - Named export: `ShellProvider`, `useShell`

3. `src/components/shell/index.ts`
   - Barrel exports

### Files to Modify

4. `src/app/journey/page.tsx`
   - Replace `<JourneyLayout phase={phase} chatContent={...} blueprintContent={...}>` with `<AppShell sidebar={<SidebarPlaceholder />} rightPanel={<RightPanelPlaceholder />}>{chatContent}</AppShell>`
   - REMOVE the `phase` state entirely (no more 'setup' | 'review')
   - REMOVE the `formData` state and `stateToFormData` call
   - REMOVE the `<BlueprintPanel>` rendering
   - KEEP everything else: useChat, messages, askUser handling, resume flow, error handling
   - Create simple placeholder components inline for sidebar and right panel (just divs with labels)

### Design Tokens to Use
```css
--bg-base: oklch(0.13 0.015 260)       /* Center background */
--bg-elevated: oklch(0.15 0.015 260)   /* Sidebar/panel background */
--bg-surface: oklch(0.17 0.015 260)    /* Cards/hover states */
--border-subtle: oklch(0.22 0.015 260) /* Panel dividers */
--border-default: oklch(0.27 0.015 260)/* Component borders */
```

## Step 3 — Verify

```bash
npm run build
npm run lint
```

Both must pass.

### Acceptance Criteria
- [ ] Three panels render at desktop widths (≥ 1280px)
- [ ] Center chat works identically to before (useChat, messages, askUser chips, resume)
- [ ] Left/right panels show placeholder content with correct backgrounds
- [ ] Left panel collapses at < 1280px viewport
- [ ] Right panel hides at < 1024px viewport
- [ ] Each panel scrolls independently
- [ ] Framer Motion entrance animation on mount
- [ ] No regressions: all existing chat functionality preserved
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

## Key Rules
- **DO NOT BREAK EXISTING CHAT** — the useChat hook, askUser tool, message rendering, resume flow must all work exactly as before
- Use CSS Grid, not flexbox for the shell
- Named exports only, kebab-case files
- Use `cn()` from `@/lib/utils` for conditional classes
- Import springs from `@/lib/motion` for animations
- The center panel must look the same as the current centered chat — same max-width, same padding, same message rendering
```

---

## Component 2: Left Sidebar

```
Think hard about this task. You are building the left sidebar for the AI-GOS v2 battleship layout. Component 1 (App Shell) is already in place — you're building the content that goes in the left panel slot.

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions
2. @BATTLESHIP-SPRINT.md — Component 2 spec
3. @aigos-v2-battleship.html — Visual mockup (see left panel design)
4. @src/app/globals.css — Design tokens
5. @src/components/shell/app-shell.tsx — The shell you're plugging into
6. @src/components/shell/shell-provider.tsx — Shell context (collapsed state)

Then read existing patterns:

7. @src/lib/storage/local-storage.ts — localStorage patterns (getJourneySession, setJourneySession)
8. @src/lib/journey/session-state.ts — OnboardingState interface
9. @src/middleware.ts — Clerk auth middleware (for understanding route structure)

## Step 1 — Plan

Enter plan mode. The sidebar has 4 sections top-to-bottom:

1. **Logo / Brand** — "EGOS" text or icon, top of sidebar
2. **Navigation** — 6 items with icons (Home, Journey, Blueprints, Ad Launcher, Creatives, Settings)
3. **Recent Sessions** — List of past journey sessions with status dots
4. **User Menu** — Avatar + name at bottom, dropdown for profile/signout

### Collapsed state (48px width)
- Only icons visible, no labels
- Tooltip on hover showing the label
- Session list hidden
- User menu shows only avatar

## Step 2 — Execute

### Files to Create

1. `src/components/shell/app-sidebar.tsx`
   - Main sidebar container
   - Renders all 4 sections
   - Handles collapsed vs expanded via `useShell()` context
   - Props: none (reads from context and hooks)
   - Named export: `AppSidebar`

2. `src/components/shell/nav-item.tsx`
   - Single navigation link
   - Props: `icon: LucideIcon`, `label: string`, `href: string`, `active: boolean`, `locked?: boolean`, `collapsed: boolean`
   - Active state: `var(--bg-surface)` background, `var(--text-primary)` color
   - Locked state: dimmed with lock icon overlay, cursor not-allowed, no navigation
   - Hover: `var(--bg-surface)` background, 150ms transition
   - Collapsed: only icon, tooltip on hover
   - Named export: `NavItem`

3. `src/components/shell/session-list.tsx`
   - Recent journey sessions
   - Reads from localStorage initially (list of OnboardingState objects)
   - Each item: company name or "New Session", status dot (green=complete, amber=in-progress, gray=empty), relative time
   - Click triggers navigation to that session (for now, just logs — full wiring in Component 5)
   - Max 5 visible, scrollable if more
   - Named export: `SessionList`

4. `src/components/shell/user-menu.tsx`
   - Uses `useUser()` from `@clerk/nextjs` for avatar and name
   - Bottom of sidebar, above-border separator
   - Collapsed: just avatar circle
   - Expanded: avatar + name + chevron
   - Dropdown (Radix Popover or DropdownMenu): Profile, Settings, Sign Out
   - Sign out uses `useClerk().signOut()`
   - Named export: `UserMenu`

### Files to Modify

5. `src/app/journey/page.tsx`
   - Replace sidebar placeholder with `<AppSidebar />`

### Icons (from lucide-react)
- Home → `Home`
- Journey → `Compass`
- Blueprints → `FileText`
- Ad Launcher → `Rocket`
- Creatives → `Palette`
- Settings → `Settings`
- Lock → `Lock`

### Styling Details
- Sidebar background: `var(--bg-elevated)`
- Right border: `1px solid var(--border-subtle)`
- Nav items: padding `8px 12px`, border-radius `8px`, gap `2px`
- Icon size: 18px, color `var(--text-tertiary)` default, `var(--text-primary)` active
- Label: 13px, font-family `var(--font-sans)`, color `var(--text-secondary)` default
- Section dividers: 1px `var(--border-subtle)`, margin `8px 12px`
- Logo area: padding `16px`, font-family `var(--font-heading)`, 16px, `var(--text-primary)`

## Step 3 — Verify

```bash
npm run build
npm run lint
```

### Acceptance Criteria
- [ ] Sidebar renders with all 6 nav items
- [ ] Active state highlights current route (Journey active on /journey)
- [ ] Ad Launcher and Creatives show lock icon + "Coming soon" tooltip
- [ ] Locked items don't navigate on click
- [ ] User menu shows Clerk user avatar and name
- [ ] Sign Out works
- [ ] Session list shows current session (at minimum)
- [ ] Collapsed state (48px) shows only icons with tooltips
- [ ] Smooth collapse/expand animation (Framer Motion)
- [ ] `npm run build` passes
```

---

## Component 3: Right Context Panel

```
Think hard about this task. You are building the right context panel for the AI-GOS v2 battleship layout. Component 1 (App Shell) is already in place — you're building the content that goes in the right panel slot.

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions
2. @BATTLESHIP-SPRINT.md — Component 3 spec
3. @aigos-v2-battleship.html — Visual mockup (see right panel design — Progress, Research, Context, Capabilities sections)
4. @src/app/globals.css — Design tokens

Then read the state management files:

5. @src/lib/journey/journey-progress-state.ts — THREE-STAGE progress computation (already built!)
6. @src/lib/journey/session-state.ts — OnboardingState, calculateCompletion, getAnsweredFields
7. @src/components/journey/journey-header.tsx — Current progress bar (being replaced)
8. @src/components/journey/journey-progress.tsx — Current progress indicator (reuse logic)
9. @src/components/shell/app-shell.tsx — The shell you're plugging into

Also read existing research card patterns:

10. @src/components/chat/deep-research-card.tsx — Research phase dots pattern (reuse this)
11. @src/components/chat/research-progress-card.tsx — Research status pattern

## Step 1 — Plan

Enter plan mode. The right panel has 4 collapsible sections:

### Section 1: Progress Tracker
- Reuse `computeJourneyProgress()` from `journey-progress-state.ts`
- Three vertical steps with connecting line: Onboarding → Strategic Blueprint → Media Plan
- Each step: status dot + label + percentage/sublabel
- Active step: pulsing blue dot, "In Progress" sublabel
- Completed step: green check, percentage
- Pending step: gray dot, "Pending" sublabel

### Section 2: Research Sections
- Initially hidden (appears when first research section fires)
- 5 items: Industry & Market, Competitor Analysis, ICP Validation, Offer Analysis, Cross-Analysis
- Each: name + status icon (✓ green / spinner blue / ○ gray) + elapsed time if done
- This section reads from chat messages to determine which research tools have completed (derived state)

### Section 3: Onboarding Context
- Grid of KV pairs showing what the agent has collected so far
- Reads from `onboardingState` (same state the chat updates via askUser)
- Required fields show as dimmed placeholders when empty, filled when answered
- Optional fields only show when answered
- Values truncated to 1 line, full text on hover (title attribute)
- Field labels from FIELD_LABELS map in lead-agent-system.ts

### Section 4: Capabilities
- Static list of enrichment capabilities
- Tags: "Perplexity Research", "Ad Library", "Keyword Intel", "SEO Audit", "Pricing Scrape"
- Each tag: small icon + label
- Green dot if the relevant API key env var is set, gray if not
- For now, all can show as "available" (green) — we'll add real env checking later

## Step 2 — Execute

### Files to Create

1. `src/components/shell/context-panel.tsx`
   - Main right panel container
   - Renders all 4 sections with collapsible headers
   - Props: `onboardingState: Partial<OnboardingState> | null`, `messages: UIMessage[]` (for deriving research status)
   - Named export: `ContextPanel`

2. `src/components/shell/progress-tracker.tsx`
   - Three-stage vertical progress indicator
   - Props: `journeyProgress` (from computeJourneyProgress)
   - Vertical layout: dot → connecting line → dot → connecting line → dot
   - Active dot: pulsing animation (Framer Motion)
   - Named export: `ProgressTracker`

3. `src/components/shell/research-sections.tsx`
   - List of 5 research sections with live status
   - Props: `messages: UIMessage[]` (scans for runResearch tool results to determine status)
   - Initially shows all as pending
   - When a runResearch tool call appears in messages with state 'input-streaming' or similar → show as "running"
   - When tool result is 'output-available' → show as "done" with elapsed time
   - Named export: `ResearchSections`

4. `src/components/shell/onboarding-context.tsx`
   - Grid of KV pairs
   - Props: `onboardingState: Partial<OnboardingState> | null`
   - Uses FIELD_LABELS from lead-agent-system.ts (import it)
   - 2-column grid: label (11px, --text-quaternary) above value (13px, --text-secondary)
   - Empty required fields: label visible, value shows "—" in --text-quaternary
   - Named export: `OnboardingContext`

5. `src/components/shell/capabilities-bar.tsx`
   - Horizontal flex-wrap of capability tags
   - Hardcoded list for now
   - Each tag: 11px, --text-tertiary, --bg-surface background, border-radius 6px, padding 4px 8px
   - Green dot (6px circle, --accent-green) or gray dot next to each
   - Named export: `CapabilitiesBar`

### Files to Modify

6. `src/app/journey/page.tsx`
   - Replace right panel placeholder with `<ContextPanel onboardingState={onboardingState} messages={messages} />`
   - Pass `journeyProgress` to ContextPanel (already computed in useMemo)

### Styling Details
- Panel background: `var(--bg-base)` with left border `1px solid var(--border-subtle)`
- Section headers: 11px uppercase, letter-spacing 0.05em, `var(--text-quaternary)`, padding `12px 16px`
- Section content: padding `0 16px 16px`
- Collapsible: chevron icon rotates on toggle, content animates height with Framer Motion
- Section dividers: 1px `var(--border-subtle)`
- Overall padding-top: 16px

## Step 3 — Verify

```bash
npm run build
npm run lint
```

### Acceptance Criteria
- [ ] Progress tracker shows 3 stages with correct active state
- [ ] Progress updates live as onboardingState changes (answer a question → percentage updates)
- [ ] Research sections all show as "pending" initially (correct — no research has fired yet)
- [ ] Onboarding context grid shows required field placeholders
- [ ] Context fills in as user answers askUser chips
- [ ] Capabilities tags render with green dots
- [ ] Each section collapses/expands with smooth animation
- [ ] Panel scrolls independently from chat
- [ ] `npm run build` passes
```

---

## Component 4a-c: Progressive Research Tool + Prompt Update

```
Think hard about this task. This is the CORE ARCHITECTURE CHANGE. You are adding a `runResearch` tool to the journey agent so it can fire research DURING the conversation instead of waiting until the end.

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions, AI SDK patterns
2. @BATTLESHIP-SPRINT.md — Component 4 spec (sections 4a, 4b, 4c)

Read the existing research pipeline:

3. @src/lib/ai/generator.ts — The BATCH pipeline we're decomposing. Understand the three phases and what each research function needs as input.
4. @src/lib/ai/research.ts — Individual research functions (researchIndustryMarket, researchCompetitors, etc.) — these are what runResearch will call
5. @src/lib/ai/providers.ts — Model constants, Perplexity config

Read the existing tool patterns:

6. @src/lib/ai/tools/ask-user.ts — The askUser tool definition (follow this exact pattern)
7. @src/app/api/journey/stream/route.ts — Where tools are registered (you'll add runResearch here)
8. @src/lib/ai/prompts/lead-agent-system.ts — System prompt you'll modify

Read research output schemas:

9. @src/lib/ai/schemas.ts — Zod schemas for research outputs (if exists)

## Step 1 — Plan

Enter plan mode. Map out:

### What each research function needs

Read `generator.ts` and `research.ts` carefully. For each research function, identify:
- What input fields it requires
- What model it uses (Perplexity Sonar Pro vs Claude)
- What it returns (schema)
- How long it typically takes

### Minimum context thresholds

The agent should call runResearch as soon as it has enough context. Map which fields unlock which sections:

| Section | Required Fields | Model |
|---------|----------------|-------|
| industryMarket | businessModel + industry | Perplexity Sonar Pro |
| competitors | industry + productDescription + competitors | Perplexity Sonar Pro |
| icpValidation | businessModel + industry + icpDescription | Perplexity Sonar Pro |
| offerAnalysis | productDescription + offerPricing | Claude Sonnet |
| crossAnalysis | All 4 above completed | Claude Sonnet |

### Tool execution model
- `runResearch` is a server-side tool — the `execute` function runs on the server in the API route
- It calls the existing research functions directly
- Results are returned as structured JSON that the frontend renders as cards
- The agent continues conversing while research runs (Vercel AI SDK handles this with tool streaming)

## Step 2 — Execute

### 2a: Create the runResearch tool

**Create** `src/lib/ai/tools/run-research.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';
// Import existing research functions from src/lib/ai/research.ts

const researchSections = z.enum([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'crossAnalysis',
]);

export const runResearch = tool({
  description: 'Execute a specific research section. Call this as soon as you have enough context — don\'t wait for all fields. Each section only needs to run once.',
  inputSchema: z.object({
    section: researchSections,
    context: z.object({
      businessModel: z.string().optional(),
      industry: z.string().optional(),
      icpDescription: z.string().optional(),
      productDescription: z.string().optional(),
      competitors: z.string().optional(),
      offerPricing: z.string().optional(),
      companyName: z.string().optional(),
      websiteUrl: z.string().optional(),
    }),
  }),
  execute: async ({ section, context }) => {
    // Route to the correct research function
    // Return structured result with findings, sources, duration
    // Wrap in try/catch — return error object on failure, don't throw
  },
});
```

The `execute` function should:
- Validate that required fields for the requested section are present
- Call the matching research function from `src/lib/ai/research.ts`
- Return: `{ section, status: 'complete', findings: [...], sources: [...], duration: number }`
- On error: `{ section, status: 'error', error: string }`

### 2b: Update the system prompt

**Modify** `src/lib/ai/prompts/lead-agent-system.ts`

REMOVE this line from the Scope section:
```
You cannot generate reports, strategy documents, or deliverables yet — that comes after onboarding is complete.
```

ADD this new section after "Completion Flow":

```
## Progressive Research

You have a tool called `runResearch` that executes real market research using Perplexity and Claude. As soon as you have enough context for a specific section, call it — don't wait for all fields to be collected.

### Trigger Thresholds
- After collecting businessModel + industry → call runResearch({ section: 'industryMarket', context: {...} })
- After collecting industry + productDescription + competitors → call runResearch({ section: 'competitors', context: {...} })
- After collecting businessModel + industry + icpDescription → call runResearch({ section: 'icpValidation', context: {...} })
- After collecting productDescription + offerPricing → call runResearch({ section: 'offerAnalysis', context: {...} })
- After ALL 4 sections above are done → call runResearch({ section: 'crossAnalysis', context: {...} })

### Rules
- Run each section exactly ONCE. Never re-run a section.
- Keep conversing while research runs — ask the next question immediately after triggering research.
- When research results come back, briefly acknowledge them ("Your industry analysis is ready — I found some interesting competitive dynamics") and reference findings in your follow-up questions when relevant.
- Do NOT dump research results as text. The frontend renders them as visual cards automatically.
- Pass ALL collected context fields in every runResearch call, not just the minimum required.
```

### 2c: Wire into the streaming route

**Modify** `src/app/api/journey/stream/route.ts`

- Import `runResearch` from `@/lib/ai/tools/run-research`
- Add to tools object: `tools: { askUser, runResearch }`
- That's it — the SDK handles the rest

## Step 3 — Verify

```bash
npm run build
npm run lint
```

### Acceptance Criteria
- [ ] runResearch tool definition compiles without errors
- [ ] Tool is registered in the streaming route alongside askUser
- [ ] System prompt includes progressive research instructions
- [ ] System prompt no longer blocks research during onboarding
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

## Key Rules
- Follow the EXACT tool definition pattern from `ask-user.ts`
- Use `inputSchema` (NOT `parameters`) — this is Vercel AI SDK v6
- The execute function runs SERVER-SIDE — it can make API calls to Perplexity/Claude
- Don't modify the existing research functions themselves — just call them
- Pass `maxOutputTokens` if needed (check how other tools handle this)
```

---

## Component 4d-e: Inline Research Cards + Right Panel Sync

```
Think hard about this task. Components 3 and 4a-c are complete. The agent can now call runResearch, and the right panel has a ResearchSections component. You need to:
1. Render research results as inline cards in the chat
2. Sync research status to the right panel

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions
2. @BATTLESHIP-SPRINT.md — Components 4d and 4e specs
3. @src/components/shell/research-sections.tsx — Right panel research status (already built)
4. @src/components/shell/context-panel.tsx — Right panel container

Read existing card components (you'll reuse these):

5. @src/components/chat/deep-research-card.tsx — Full research card with citations (REUSE)
6. @src/components/chat/research-progress-card.tsx — Phase dots showing progress (REUSE)
7. @src/components/chat/research-result-card.tsx — Individual research findings (REUSE)

Read the chat message rendering:

8. @src/components/journey/chat-message.tsx — Where tool results are rendered (MODIFY)
9. @src/app/journey/page.tsx — Where messages and onboardingState are managed

## Step 1 — Plan

Enter plan mode. Two integration points:

### Chat Message Rendering
When `chat-message.tsx` encounters a tool part for `runResearch`:
- **While streaming** (state: `input-streaming`): Show `<ResearchProgressCard>` with the section name and a spinner
- **When complete** (state: `output-available`): Show `<DeepResearchCard>` or `<ResearchResultCard>` with the structured findings
- **On error** (state: `output-error`): Show a subtle error message

### Right Panel Sync
The `ResearchSections` component already accepts `messages` prop and scans for runResearch tool parts. Verify:
- It correctly identifies tool parts with type `tool-runResearch`
- It maps states: `input-streaming` → "running", `output-available` → "done", nothing → "pending"
- It calculates elapsed time from tool call start to result

## Step 2 — Execute

### Files to Modify

1. `src/components/journey/chat-message.tsx`
   - Import `DeepResearchCard`, `ResearchProgressCard` from `@/components/chat/`
   - In the tool part rendering logic, add a case for `runResearch`:
     - Check `part.type === 'tool-runResearch'`
     - If `part.state === 'input-streaming'` → render `<ResearchProgressCard>` with section name
     - If `part.state === 'output-available'` → parse `part.output`, render `<DeepResearchCard>` or appropriate card
     - Transform the runResearch output format to match the card component's expected props
   - Ensure cards animate in with Framer Motion (scaleIn from @/lib/motion)

2. `src/components/shell/research-sections.tsx` (verify/fix)
   - Ensure it correctly scans messages for `runResearch` tool parts
   - The tool part type format is `tool-runResearch` (confirm this matches SDK behavior)
   - If the SDK uses a different format, adjust accordingly

### Data Transformation
The runResearch tool returns: `{ section, status, findings, sources, duration }`
The DeepResearchCard expects: `{ query, phases, findings, sources, totalDuration }`

Create a mapping function:
```typescript
function researchResultToCardProps(result: RunResearchOutput): DeepResearchCardProps {
  return {
    query: SECTION_LABELS[result.section],
    phases: [{ name: result.section, status: 'done', duration: result.duration }],
    findings: result.findings.map(f => ({
      title: f.title,
      content: f.content,
      citations: f.citations || [],
    })),
    sources: result.sources || [],
    totalDuration: result.duration,
  };
}
```

## Step 3 — Verify

```bash
npm run build
npm run lint
```

### Acceptance Criteria
- [ ] When agent calls runResearch, a progress card appears inline in the chat
- [ ] When research completes, the progress card is replaced with the full research card
- [ ] Research card shows findings with expandable sections
- [ ] Research card shows sources/citations
- [ ] Right panel research sections update from "pending" → "running" → "done" as research progresses
- [ ] Elapsed time shows correctly on completed sections
- [ ] Cards animate in smoothly
- [ ] No console errors
- [ ] `npm run build` passes
```

---

## Component 5: Integration Wiring + Old Flow Removal

```
Think hard about this task. All individual components are built. You need to wire everything together and remove the old batch generation flow.

## Step 0 — Read All Context Files

1. @CLAUDE.md — Project conventions
2. @BATTLESHIP-SPRINT.md — Component 5 spec

Read the full current state:

3. @src/app/journey/page.tsx — Main orchestrator (check what's changed from Components 1-4)
4. @src/components/shell/app-shell.tsx — Shell
5. @src/components/shell/app-sidebar.tsx — Sidebar
6. @src/components/shell/context-panel.tsx — Right panel
7. @src/lib/ai/tools/run-research.ts — Research tool
8. @src/lib/ai/prompts/lead-agent-system.ts — Updated system prompt

Read the OLD files being removed:

9. @src/components/journey/blueprint-panel.tsx — DELETING THIS
10. @src/components/journey/journey-layout.tsx — DELETING THIS (replaced by AppShell)
11. @src/components/journey/journey-header.tsx — MODIFYING (progress moved to right panel)
12. @src/lib/journey/state-to-form-data.ts — May no longer be needed (was for batch generator)

## Step 1 — Plan

Enter plan mode. Integration checklist:

### Remove old flow
1. Delete `src/components/journey/blueprint-panel.tsx`
2. Delete `src/components/journey/journey-layout.tsx` (replaced by AppShell)
3. Remove all imports of these files
4. Remove `stateToFormData` usage in journey page (no more batch conversion)
5. Remove `phase` state and all `'setup' | 'review'` logic

### Update confirmation flow
The old flow: collect 8 fields → confirm → generate batch blueprint
The new flow: collect fields → research fires progressively → agent summarizes → confirm → done

Update the system prompt completion flow:
- When all 8 required fields collected AND all 5 research sections done:
  - Agent synthesizes everything into a final strategic summary
  - Calls askUser with "Your strategy is ready. Want me to compile the full blueprint document?"
  - If yes → triggers final document generation (can reuse parts of the batch generator)
  - If no → continue refining

### Update journey-header.tsx
- Remove the progress bar (progress now lives in right panel)
- Keep the header but simplify it — just the page title or minimal branding
- OR: remove the header entirely since the sidebar has the logo

### Session persistence
- Research results from runResearch tool calls are already in the chat messages (useChat stores them)
- localStorage already saves onboardingState
- Supabase already persists askUser results (fire-and-forget in route.ts)
- Consider: save research results to Supabase too? (stretch goal — messages contain them, so they persist with conversation)

### Route structure
- Ensure `AppShell` wraps the journey page correctly
- Consider: should the shell be in `src/app/layout.tsx` so it persists across ALL routes? Or just journey for now?
- Recommendation: just journey for now. Other routes (blueprints, ads, etc.) don't exist yet.

## Step 2 — Execute

Go through the integration checklist systematically:

1. Remove dead code (blueprint-panel, journey-layout, stateToFormData imports)
2. Verify journey page uses AppShell with Sidebar and ContextPanel
3. Verify chat works end-to-end: welcome → askUser → chips → research fires → cards appear → right panel updates
4. Simplify or remove journey-header
5. Verify resume flow still works (returning user sees resume prompt)
6. Verify error handling still works (MissingToolResultsError cleanup)
7. Run build and fix any import/type errors from deleted files

## Step 3 — Verify

```bash
npm run build
npm run lint
npm run test:run
```

### Full E2E Walkthrough (do this mentally by tracing the code)
1. User loads /journey → AppShell renders with sidebar, chat center, context panel right
2. Welcome message appears → right panel shows onboarding progress at 0%
3. User types company info → agent responds with askUser for businessModel
4. User taps "B2B SaaS" chip → state saves to localStorage → right panel Context updates
5. Agent asks about industry → user taps chip → right panel updates
6. Agent now has businessModel + industry → calls runResearch('industryMarket')
7. Chat shows ResearchProgressCard inline → right panel Research section shows "running"
8. Research completes → card updates to DeepResearchCard → right panel shows "done"
9. Agent references findings, asks next question
10. Pattern continues until all fields collected + all research done
11. Agent presents summary → askUser confirmation
12. Session complete

### Acceptance Criteria
- [ ] No dead imports or unused files
- [ ] Full end-to-end flow works (trace the code path)
- [ ] Resume flow works for returning users
- [ ] Error handling preserved
- [ ] Right panel live-updates throughout the journey
- [ ] Sidebar navigation highlights correct route
- [ ] No console errors
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:run` passes (or pre-existing failures only)
```

---

## Ready-to-Paste Summary

```
# Battleship Sprint — Quick Reference

## Build Order
1. Component 1: App Shell → paste prompt, execute in Claude Code
2. Components 2 + 3 + 4a-c: THREE parallel sessions
   - Session A: paste Component 2 prompt (Left Sidebar)
   - Session B: paste Component 3 prompt (Right Context Panel)
   - Session C: paste Component 4a-c prompt (Research Tool + Prompt)
3. Component 4d-e: Inline Cards + Right Panel Sync
4. Component 5: Integration + Cleanup
5. Design elevation pass (separate prompt TBD)

## After Each Component
Always run:
  npm run build
  npm run lint

## Key Files That Must Never Break
- src/app/journey/page.tsx (the orchestrator)
- src/app/api/journey/stream/route.ts (the streaming API)
- src/lib/ai/prompts/lead-agent-system.ts (the agent brain)
- Everything in src/components/journey/ that handles useChat, askUser, resume
```
