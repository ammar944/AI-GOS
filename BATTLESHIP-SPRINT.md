# AI-GOS V2 — Battleship Sprint Plan

**Goal**: Transform the two-phase layout (centered chat → split blueprint panel) into a permanent three-panel command center with progressive inline research.

**Reference mockup**: `aigos-v2-battleship.html`

---

## Dependency Graph

```
Component 1: App Shell ──────────┐
                                 │
Component 2: Left Sidebar ───────┤──→ Component 5: Wiring & Integration
                                 │
Component 3: Right Panel ────────┤
                                 │
Component 4: Progressive ────────┘
             Research Pipeline
```

Components 1–3 are pure UI/layout — no AI changes. Component 4 is the architecture shift. Build 1 first, then 2–4 can run in parallel.

---

## Component 1: App Shell

**What it replaces**: `src/components/journey/journey-layout.tsx` (60 lines, two-column animated layout)

**What it does**: Permanent three-panel skeleton. Left sidebar (220px, collapsible), center workspace (flex-1, min 480px), right panel (320px, collapsible). Always visible — no phase-based show/hide.

### Files to create
- `src/components/shell/app-shell.tsx` — The three-panel container
- `src/components/shell/shell-provider.tsx` — Context for panel collapse state, active view, session ID

### Files to modify
- `src/app/journey/page.tsx` — Replace `<JourneyLayout>` with `<AppShell>`. Remove `phase` state (no more setup/review distinction). Chat always renders in center, right panel always visible.

### Key decisions
- Kill the `phase: 'setup' | 'review'` concept entirely. The three panels are always present.
- Left sidebar collapses to 48px icon strip on small screens (< 1280px)
- Right panel collapses to hidden below 1024px, accessible via drawer
- Center panel has max-width: 720px with auto-centering (same as current setup phase)
- Use CSS Grid (`grid-template-columns: auto 1fr auto`) not flexbox — cleaner collapse behavior

### Acceptance criteria
- Three panels render at desktop widths
- Center chat works identically to current (useChat, messages, askUser chips)
- Left/right panels show placeholder content
- Framer Motion entrance animations on mount
- Responsive: sidebar collapses at 1280px, right panel hides at 1024px

---

## Component 2: Left Sidebar

**What it replaces**: Nothing — new component. Currently there's only `JourneyHeader` with a progress bar.

**What it does**: Navigation, session history, user identity.

### Files to create
- `src/components/shell/app-sidebar.tsx` — Main sidebar component
- `src/components/shell/nav-item.tsx` — Individual nav link with icon, label, active state
- `src/components/shell/session-list.tsx` — Recent sessions with status dots
- `src/components/shell/user-menu.tsx` — Avatar + name + settings dropdown

### Nav items (Phase 1)
| Icon | Label | Route | Status |
|------|-------|-------|--------|
| Home | Home | `/` | Active page |
| Compass | Journey | `/journey` | Active page |
| FileText | Blueprints | `/blueprints` | Placeholder |
| Rocket | Ad Launcher | `/ads` | Placeholder (locked) |
| Palette | Creatives | `/creatives` | Placeholder (locked) |
| Settings | Settings | `/settings` | Placeholder |

Locked items show a subtle lock icon and tooltip "Coming soon" — they establish the battleship vision without being clickable.

### Session list
- Pull from localStorage (existing `getJourneySession()`)
- Later: pull from Supabase `journey_sessions` table
- Each entry: company name or "New Session", status dot (green/amber/gray), relative timestamp
- Click to load session → resume flow

### User menu
- Clerk `useUser()` for avatar and name
- Dropdown: Profile, Settings, Sign Out
- Minimal — not the focus right now

### Design notes
- Background: `var(--bg-elevated)` with right border `var(--border-subtle)`
- Nav items: 12px icon + 13px label, `var(--text-secondary)` default, `var(--text-primary)` + `var(--bg-surface)` active
- Hover: `var(--bg-surface)` background with 150ms transition
- Collapsed state: only icons, tooltip on hover

### Acceptance criteria
- Sidebar renders with all nav items
- Active state matches current route
- Locked items show lock icon, don't navigate
- User menu shows Clerk user data
- Collapse/expand works with smooth animation
- Session list shows at least the current session

---

## Component 3: Right Panel — Context Panel

**What it replaces**: `src/components/journey/blueprint-panel.tsx` (the old "generate and show checklist" panel) + `src/components/journey/journey-header.tsx` (progress bar moves here)

**What it does**: Persistent reference panel showing progress, research status, collected context, and capabilities.

### Files to create
- `src/components/shell/context-panel.tsx` — Main right panel container with sections
- `src/components/shell/progress-tracker.tsx` — Three-stage macro progress (Onboarding → Blueprint → Media Plan)
- `src/components/shell/research-sections.tsx` — List of research sections with done/running/pending status
- `src/components/shell/onboarding-context.tsx` — Grid of collected fields (KV pairs)
- `src/components/shell/capabilities-bar.tsx` — Tags showing available enrichment features

### Section 1: Progress Tracker
- Reuse logic from `src/lib/journey/journey-progress-state.ts` (already computes three macro stages)
- Three vertical steps with connecting line
- Each step: dot (filled/pulsing/empty) + label + percentage
- Active step has pulsing blue dot and "In Progress" sublabel
- Completed step has green check

### Section 2: Research Sections
- List of 5 research areas: Industry & Market, Competitor Analysis, ICP Validation, Offer Analysis, Cross-Analysis
- Each shows: name, status icon (✓ done / spinner running / ○ pending), elapsed time if done
- Clicking a completed section scrolls to its inline card in the chat (stretch goal)
- This section only appears once research starts firing (initially hidden)

### Section 3: Onboarding Context
- Grid of KV pairs from `onboardingState`
- Reads from the same localStorage state the chat updates
- Live updates as user answers askUser chips
- Labels from `FIELD_LABELS` map in `lead-agent-system.ts`
- Values truncated to 1 line with tooltip for full text
- Empty required fields show as dimmed placeholders

### Section 4: Capabilities
- Static tags showing what enrichment is available
- "Perplexity Research", "Ad Library", "Keyword Intel", "SEO Audit", "Pricing Scrape"
- Each tag: icon + label, green dot if API key configured, gray if not
- Reads from env at build time or a capabilities endpoint

### Design notes
- Background: `var(--bg-base)` (same as main), left border `var(--border-subtle)`
- Section headers: 11px uppercase `var(--text-quaternary)`, letter-spacing 0.05em
- Content: 13px `var(--text-secondary)`
- Sections separated by 1px `var(--border-subtle)` dividers
- Scroll: entire panel scrolls independently

### Acceptance criteria
- Progress tracker updates live as onboarding state changes
- Context grid populates as user answers questions
- Research sections show correct status (initially all pending)
- Capabilities reflect actual API key configuration
- Panel scrolls independently from chat
- Sections collapse/expand with chevron

---

## Component 4: Progressive Research Pipeline

**What it replaces**: The batch pipeline in `src/lib/ai/generator.ts` that runs all research after confirmation. Also modifies `src/app/api/journey/stream/route.ts` and `src/lib/ai/prompts/lead-agent-system.ts`.

**What it does**: The agent gets a new `runResearch` tool. When it has enough context for a specific research section, it calls the tool. Research runs server-side, results stream back as a tool result, and the frontend renders them as inline cards.

### This is the hardest component. Break it into sub-steps:

### 4a: Define the `runResearch` tool

**File**: `src/lib/ai/tools/run-research.ts`

```typescript
// Tool definition for the journey agent
// When called, executes a specific research function and returns structured results
export const runResearch = tool({
  description: 'Run a specific research section when you have enough context...',
  inputSchema: z.object({
    section: z.enum([
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
      'crossAnalysis',
    ]),
    context: z.object({
      businessModel: z.string().optional(),
      industry: z.string().optional(),
      icpDescription: z.string().optional(),
      productDescription: z.string().optional(),
      competitors: z.string().optional(),
      offerPricing: z.string().optional(),
      // ... all fields the research functions need
    }),
  }),
  execute: async ({ section, context }) => {
    // Route to the correct research function from src/lib/ai/research.ts
    // Return structured result
  },
});
```

**Minimum context requirements per section**:
| Section | Required fields |
|---------|----------------|
| industryMarket | businessModel + industry |
| competitors | industry + productDescription + competitors |
| icpValidation | businessModel + industry + icpDescription |
| offerAnalysis | productDescription + offerPricing + competitors |
| crossAnalysis | All 4 above completed |

### 4b: Update the system prompt

**File**: `src/lib/ai/prompts/lead-agent-system.ts`

Remove: `"You cannot generate reports, strategy documents, or deliverables yet — that comes after onboarding is complete."`

Add new section:

```
## Progressive Research

You have a tool called `runResearch` that executes real market research. As soon as you have enough context for a specific section, run it — don't wait for all fields.

Trigger thresholds:
- After collecting businessModel + industry → run industryMarket
- After collecting competitors + productDescription → run competitors
- After collecting icpDescription → run icpValidation
- After collecting offerPricing → run offerAnalysis
- After all 4 sections complete → run crossAnalysis

Important:
- Run research between questions, not after all questions
- Only run each section ONCE — track what you've already run
- Keep conversing while research runs — don't pause the conversation
- Reference research results in your follow-up questions when relevant
```

### 4c: Wire the tool into the streaming route

**File**: `src/app/api/journey/stream/route.ts`

Add `runResearch` to the tools object alongside `askUser`. The `execute` function calls the existing research functions from `src/lib/ai/research.ts` directly.

### 4d: Render research results as inline cards

**File**: `src/components/journey/chat-message.tsx` (modify)

When the chat message contains a tool result from `runResearch`, render it using the existing card components:
- `DeepResearchCard` for full research sections
- `ResearchProgressCard` for the "running" state
- `ResearchResultCard` for individual findings

These components already exist in `src/components/chat/` — they just need to be imported and rendered based on the tool part type.

### 4e: Sync research status to right panel

The right panel's "Research Sections" component needs to know which sections have completed. Options:
- **Option A**: Scan chat messages for `runResearch` tool results (parse from useChat messages)
- **Option B**: Separate state atom (e.g., localStorage or context) updated when tool results arrive

Recommend Option A — derive from messages, no extra state to sync.

### Acceptance criteria
- Agent calls runResearch for industryMarket after collecting businessModel + industry
- Research runs server-side using existing Perplexity/Claude functions
- Results appear as inline cards in the chat
- Right panel research sections update to show done/running/pending
- Agent references research findings in subsequent conversation
- Each section only fires once per session
- Full journey completes without the old "confirmation → batch generate" flow

---

## Component 5: Wiring & Integration

**What it does**: Connect all 4 components together and handle the edge cases.

### Tasks
1. **Remove old flow**: Delete `BlueprintPanel`, remove `phase` state, remove `stateToFormData` call on confirmation
2. **Update confirmation flow**: After all 8 fields + all research sections done → agent summarizes findings + asks for approval → generates final blueprint document (replaces the old batch generator)
3. **Session persistence**: Save research results to Supabase alongside onboarding state
4. **Route structure**: Add shell to layout.tsx so sidebar persists across routes
5. **Header removal**: `JourneyHeader` progress bar moves to right panel → delete the old header

### Acceptance criteria
- Full end-to-end flow works: user starts chat → answers questions → sees research inline → gets final blueprint
- No regressions on existing features (resume, error handling, typing indicators)
- Session state includes research results
- Right panel reflects live state throughout

---

## Suggested Build Order

| Step | Component | Estimated Effort | Can Parallelize? |
|------|-----------|-----------------|-----------------|
| 1 | App Shell (C1) | 1 session | No — everything depends on this |
| 2a | Left Sidebar (C2) | 1 session | Yes — with 2b and 2c |
| 2b | Right Panel (C3) | 1 session | Yes — with 2a and 2c |
| 2c | runResearch tool + prompt (C4a-c) | 1-2 sessions | Yes — with 2a and 2b |
| 3 | Inline cards + right panel sync (C4d-e) | 1 session | After 2b and 2c |
| 4 | Integration + polish (C5) | 1 session | After everything |
| 5 | Design elevation pass | 1 session | After everything |

**Total**: ~7 sessions, ~4 if parallelized

---

## What We're NOT Doing Yet

These are battleship features that come after this sprint:

- Ad Launcher integration
- Creative generation / UGC
- Media Plan pipeline (already exists, just needs wiring to new shell)
- Multi-session management (currently one active session)
- Team/workspace features
- Blueprint export/sharing
- Real-time collaboration

---

## Starting Point

**Start with Component 1: App Shell.** It's the skeleton everything else plugs into. Once that's in place, we can build the sidebar, right panel, and research pipeline in parallel.

When you're ready, say "build component 1" and I'll write the code.
