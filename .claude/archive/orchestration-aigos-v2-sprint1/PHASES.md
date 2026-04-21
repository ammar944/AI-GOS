# AI-GOS v2 Sprint 1 — Implementation Phases

**Target**: Sprint 1 Foundation Complete
**Execution**: Sequential phases, autonomous subagent execution
**Authority**: DISCOVERY.md overrides everything

---

## Scope Constraints (from DISCOVERY.md)

These are OUT of scope. Do NOT implement:
- No research sub-agents or MCP servers
- No section generation or inline cards
- No media plan pipeline
- No voice input
- No slash command palette
- No export functionality
- No blueprint panel (right side)
- No thinking block display
- No tool calling (tools defined but empty for Sprint 1)
- No onboarding question flow logic (just freeform chat)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| AI | Vercel AI SDK v6 (`streamText` + `@ai-sdk/anthropic`) |
| Model | `claude-opus-4-6` with `thinking: { type: "adaptive" }` |
| Streaming | `toUIMessageStreamResponse()` ↔ `DefaultChatTransport` + `useChat` |
| CSS | Tailwind CSS v4 (CSS-first `@theme inline` config) |
| Fonts | DM Sans (sans), Instrument Sans (display), JetBrains Mono (mono) via `next/font/google` |
| Auth | Clerk (`@clerk/nextjs`) — middleware protects `/journey` automatically |
| Database | Supabase (service role + Clerk user ID, bypass RLS) |
| UI | shadcn/ui + Radix + Tailwind + Framer Motion |
| Animation | Framer Motion presets from `@/lib/motion` |
| Deploy | Vercel Pro, `maxDuration = 300` |

---

## Skills Reference

All skills at `.claude/skills/`. Agents MUST read relevant skills before starting a task.

| Skill | Use When |
|-------|----------|
| `claude-developer-platform` | Any work touching AI SDK, model config, streaming patterns |
| `m2c1` | Orchestration protocol reference |

---

## Tools Reference

| Server/Tool | Use For | Key Operations |
|-------------|---------|----------------|
| **Playwright MCP** | Browser testing (localhost), e2e verification | navigate, click, fill, screenshot, snapshot |
| **Supabase MCP** | Database migration, table creation | apply_migration, execute_sql, list_tables |

---

## Testing Methods

| Method | Tool | Description |
|--------|------|-------------|
| Build check | `npm run build` | TypeScript compilation, no new errors |
| Lint check | `npm run lint` | ESLint passes |
| Browser testing (local) | Playwright MCP | Navigate localhost:3000/journey, test UI flows |
| API testing | curl / Playwright | Hit /api/journey/stream, verify streaming response |
| V1 regression | Playwright MCP | Navigate /dashboard, /generate — verify unaffected |
| Visual verification | Playwright screenshot | Screenshot key screens as evidence |

---

## Phase Overview

| Phase | Goal | Tasks |
|-------|------|-------|
| 1: Design System + Backend Foundation | Tokens, fonts, API route, Supabase, system prompt | 6 |
| 2: Journey UI Components | All v2 chat components built and styled | 6 |
| 3: Journey Page Integration | Page wired, streaming works end-to-end | 3 |
| 4: Comprehensive E2E Testing | Multi-angle testing, v1 regression, deploy | 3 |
| **Total** | | **18** |

---

## Phase 1: Design System + Backend Foundation

**Goal**: All design tokens mapped to Tailwind utilities, fonts globally replaced, API route streams Opus 4.6 responses, Supabase table exists, system prompt defined. No v1 regressions.

### Task 1.1: Global Font Replacement

- **Objective**: Replace Inter with DM Sans and Geist Mono with JetBrains Mono globally in root `layout.tsx`. Instrument Sans stays.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - Modify: `src/app/layout.tsx`
  - Modify: `src/app/globals.css` (font-family vars in `@theme inline`)
- **Contracts**: CSS variables `--font-dm-sans`, `--font-jetbrains-mono` available globally. `--font-sans` maps to DM Sans, `--font-mono` maps to JetBrains Mono.
- **Acceptance Criteria**:
  - [ ] DM Sans loaded via `next/font/google` with weights 300, 400, 500, 600
  - [ ] JetBrains Mono loaded via `next/font/google` with weights 400, 500
  - [ ] Instrument Sans unchanged (already loaded with weights 400, 500, 600, 700)
  - [ ] `--font-sans` in `@theme inline` references DM Sans (not Inter)
  - [ ] `--font-mono` in `@theme inline` references JetBrains Mono (not Geist Mono)
  - [ ] Body className uses new font variables
  - [ ] Inter and Geist Mono imports removed
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Visual: Body text renders in DM Sans on any page
  - [ ] Visual: Monospace text renders in JetBrains Mono
  - [ ] Visual: Headings still render in Instrument Sans
  - [ ] Regression: Existing v1 pages render without broken layout

### Task 1.2: Design Token @theme Inline Mapping

- **Objective**: Add ~30 lines to `@theme inline` block mapping existing CSS variables to Tailwind utility classes. Fix mismatched values. Add missing tokens.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - Modify: `src/app/globals.css`
- **Contracts**: Tailwind utility classes available: `bg-base`, `bg-elevated`, `bg-surface`, `bg-hover`, `bg-active`, `bg-card`, `bg-card-blue`, `text-primary` (namespaced to avoid shadcn collisions — use prefix like `--color-v2-*` or unique names).
- **Details**: Add to `@theme inline`:
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
  --shadow-card: var(--shadow-card);
  --shadow-elevated: var(--shadow-elevated);
  --shadow-glow-blue: var(--shadow-glow-blue);
  ```
  Also add missing CSS vars in `.dark`:
  - `--accent-red: #ef4444;`
  - `--shadow-glow-blue: 0 0 20px rgba(54, 94, 255, 0.3);`
  - Fix `--bg-card-blue` opacity from 0.09 to 0.06 per design system
  - Fix `--border-subtle` opacity from 0.08 to 0.06 per design system
- **Acceptance Criteria**:
  - [ ] Tailwind classes like `bg-bg-base`, `text-text-primary`, `border-border-subtle` work in components
  - [ ] `--accent-red` exists in `.dark` scope
  - [ ] `--shadow-glow-blue` exists in `.dark` scope
  - [ ] `--bg-card-blue` opacity is 0.06
  - [ ] `--border-subtle` opacity is 0.06
  - [ ] Existing shadcn utility classes still work (no collisions)
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Lint: `npm run lint` passes
  - [ ] Regression: Dashboard page renders identically (screenshot comparison)

### Task 1.3: Lead Agent System Prompt

- **Objective**: Create the lead agent system prompt as a separate file. Warm but no-BS consultant persona per D4.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - Create: `src/lib/ai/prompts/lead-agent-system.ts`
- **Contracts**: Exports `LEAD_AGENT_SYSTEM_PROMPT: string` and `LEAD_AGENT_WELCOME_MESSAGE: string`.
- **Details**:
  Persona: Senior paid media strategist. Direct, knows their shit, doesn't waste time but isn't cold. NOT AI slop.

  Welcome message (hardcoded in frontend, exported for reference):
  > Good to meet you.
  >
  > I'm going to build you a complete paid media strategy — market research, competitor intel, ICP analysis, messaging, the works.
  >
  > Start me off with your company name and website. I'll dig in while we talk.

  System prompt should instruct Opus to:
  - Be a warm but direct paid media consultant
  - Ask smart follow-up questions
  - NOT use filler phrases, exclamation marks everywhere, or generic AI patterns
  - Sprint 1 scope: Just conversation, no tool calling, no section generation
  - Keep responses concise (2-4 paragraphs max per turn)
- **Acceptance Criteria**:
  - [ ] File exports `LEAD_AGENT_SYSTEM_PROMPT` as const string
  - [ ] File exports `LEAD_AGENT_WELCOME_MESSAGE` as const string
  - [ ] Prompt establishes consultant persona clearly
  - [ ] Prompt constrains response length and tone
  - [ ] TypeScript compiles without errors
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Import: Can be imported in other files without error

### Task 1.4: Model Constant + Provider Update

- **Objective**: Add `claude-opus-4-6` to the MODELS constant and MODEL_COSTS in `providers.ts`.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - Modify: `src/lib/ai/providers.ts`
- **Contracts**: `MODELS.CLAUDE_OPUS` available as `'claude-opus-4-6'`. Cost entry added.
- **Acceptance Criteria**:
  - [ ] `MODELS.CLAUDE_OPUS` equals `'claude-opus-4-6'`
  - [ ] Cost entry: input $5.00/1M tokens, output $25.00/1M tokens
  - [ ] Existing model constants unchanged
- **Testing**:
  - [ ] Build: `npm run build` succeeds

### Task 1.5: Supabase Migration — journey_sessions Table

- **Objective**: Create Supabase migration for the `journey_sessions` table per D7 schema.
- **Dependencies**: None
- **Blocked by**: None
- **Files**:
  - Create: Migration via Supabase MCP `apply_migration`
- **Contracts**: Table schema:
  ```sql
  create table journey_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id text not null,
    phase text default 'setup',
    messages jsonb default '[]',
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create index idx_journey_sessions_user_id on journey_sessions(user_id);
  ```
- **Acceptance Criteria**:
  - [ ] Table exists in Supabase with correct columns and types
  - [ ] `user_id` index exists
  - [ ] Default values work (insert with just user_id succeeds)
- **Testing**:
  - [ ] SQL: Insert a test row, select it, delete it
  - [ ] Supabase MCP: `list_tables` shows `journey_sessions`

### Task 1.R: Phase 1 Regression

- **Objective**: Full regression test of all Phase 1 tasks
- **Dependencies**: All Phase 1 tasks complete
- **Testing**:
  - [ ] `npm run build` succeeds with no new errors
  - [ ] `npm run lint` passes
  - [ ] Playwright: Navigate to /dashboard — renders correctly, fonts are DM Sans
  - [ ] Playwright: Navigate to /generate — renders correctly
  - [ ] Playwright: Screenshot /dashboard for visual baseline
  - [ ] API: `curl -X POST http://localhost:3000/api/journey/stream` returns auth error (401) — confirms route doesn't exist yet but Clerk is gating
  - [ ] Supabase: `journey_sessions` table exists and accepts inserts

---

## Phase 2: Journey UI Components

**Goal**: All v2 chat components built and styled per design system. Components are standalone and testable in isolation.

### Task 2.1: Journey Layout Shell

- **Objective**: Create adaptive layout that transitions between centered chat (phase='setup') and two-column (phase='review'). Sprint 1 only shows centered.
- **Dependencies**: Task 1.2 (tokens mapped)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/components/journey/journey-layout.tsx`
- **Contracts**:
  ```typescript
  interface JourneyLayoutProps {
    phase: 'setup' | 'review';
    chatContent: React.ReactNode;
    blueprintContent?: React.ReactNode;
    className?: string;
  }
  ```
  Phase='setup': centered column, max-width 720px, horizontally centered.
  Phase='review': 440px chat left, flex-1 blueprint right.
  Transition: CSS `transition: all 0.3s ease`.
- **Acceptance Criteria**:
  - [ ] `phase='setup'` renders centered column at max-width 720px
  - [ ] `phase='review'` renders two-column layout (440px + flex-1)
  - [ ] CSS transition animates between layouts smoothly
  - [ ] Named export, Props interface, 'use client' directive
  - [ ] Uses `cn()` utility, CSS variables via `style` prop
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Visual: Component renders correctly at both phase states

### Task 2.2: Journey Header (Logo Only)

- **Objective**: Create minimal 56px header with AI-GOS gradient logo. No step indicators — v2 is a pure chat agent, not a wizard.
- **Dependencies**: Task 1.1 (fonts), Task 1.2 (tokens)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/components/journey/journey-header.tsx`
- **Contracts**:
  ```typescript
  interface JourneyHeaderProps {
    className?: string;
  }
  ```
  Logo: "AI-GOS" in Instrument Sans 700, 15px, gradient text fill (white → #93c5fd)
  Height: 56px, background: --bg-elevated, bottom border: --border-default
- **Acceptance Criteria**:
  - [ ] Logo renders with gradient text (Instrument Sans 700, 15px)
  - [ ] Header is 56px tall with correct background and border
  - [ ] NO step indicators
  - [ ] Named export, Props interface
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Visual: Header renders with logo

### Task 2.3: Chat Message Component

- **Objective**: Create message bubble for user and AI messages per PRD section 2.4.
- **Dependencies**: Task 1.2 (tokens)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/components/journey/chat-message.tsx`
- **Contracts**:
  ```typescript
  interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    className?: string;
  }
  ```
  User bubble: right-aligned, max-width 85%, --bg-hover bg, border-radius 14px 14px 4px 14px
  AI message: left-aligned with 24px gradient avatar (--accent-blue → #006fff), no bubble, --text-secondary body, font-size 13.5px
  Streaming: append `.streaming-cursor` span when `isStreaming=true`
- **Acceptance Criteria**:
  - [ ] User messages right-aligned with bubble styling per spec
  - [ ] AI messages left-aligned with gradient avatar, no bubble
  - [ ] Streaming cursor appears when `isStreaming=true`
  - [ ] Markdown rendering in AI messages (basic: bold, italic, lists, code)
  - [ ] Named export, Props interface
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Visual: Both message types render per design spec

### Task 2.4: Chat Input with Glassmorphism

- **Objective**: Create glassmorphism input container with auto-resize textarea, send button, focus glow. Fixed at bottom of chat panel.
- **Dependencies**: Task 1.2 (tokens)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/components/journey/chat-input.tsx`
- **Contracts**:
  ```typescript
  interface JourneyChatInputProps {
    onSubmit: (message: string) => void;
    isLoading: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
  }
  ```
  Container: glassmorphism (backdrop-filter: blur(12px), semi-transparent bg, border-subtle)
  Textarea: auto-resize up to 120px max height, Enter to send, Shift+Enter for newline
  Send button: blue glow on hover, disabled when empty or loading
  Focus glow: --border-focus + subtle blue box-shadow
- **Acceptance Criteria**:
  - [ ] Glassmorphism container with blur effect
  - [ ] Auto-resize textarea (min 1 line, max ~120px)
  - [ ] Enter sends, Shift+Enter adds newline
  - [ ] Send button disabled when empty or loading
  - [ ] Focus state shows blue glow
  - [ ] Named export, Props interface, 'use client' directive
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Interactive: Type text, submit, verify callback fires

### Task 2.5: Streaming Cursor + Typing Indicator

- **Objective**: Create streaming cursor (inline) and typing indicator (3-dot bounce) components.
- **Dependencies**: Task 1.2 (tokens)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/components/journey/streaming-cursor.tsx`
  - Create: `src/components/journey/typing-indicator.tsx`
- **Contracts**:
  Streaming cursor: Inline `<span>` using existing `.streaming-cursor` CSS class (already in globals.css). 2px wide, 14px tall, --accent-blue, blink 0.8s step-end.

  Typing indicator:
  ```typescript
  interface TypingIndicatorProps {
    className?: string;
  }
  ```
  3 dots: 5px circles, bouncing animation. Staggered delay: 0s, 0.15s, 0.3s. Use Framer Motion for bounce (translateY keyframes).
- **Acceptance Criteria**:
  - [ ] Streaming cursor renders as blinking inline block
  - [ ] Typing indicator shows 3 bouncing dots with staggered timing
  - [ ] Both use design system colors
  - [ ] Named exports, Props interfaces
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Visual: Animations render smoothly

### Task 2.R: Phase 2 Regression

- **Objective**: Full regression test of all Phase 2 components
- **Dependencies**: All Phase 2 tasks complete
- **Testing**:
  - [ ] `npm run build` succeeds with no new errors
  - [ ] `npm run lint` passes
  - [ ] All 5 components import without errors
  - [ ] Components render independently (can be tested in isolation)
  - [ ] Playwright: Existing v1 pages still work (no import side effects)
  - [ ] Screenshot: Each component rendered in a test page

---

## Phase 3: Journey Page Integration

**Goal**: /journey page fully wired — user can type a message, see a streaming Opus 4.6 response, session persisted to Supabase. Welcome message displays on load.

### Task 3.1: Streaming API Route

- **Objective**: Create the journey streaming endpoint using Vercel AI SDK pattern.
- **Dependencies**: Task 1.3 (system prompt), Task 1.4 (model constant)
- **Blocked by**: Phase 1
- **Files**:
  - Create: `src/app/api/journey/stream/route.ts`
- **Contracts**:
  ```typescript
  // POST /api/journey/stream
  // Request: { messages: UIMessage[] }
  // Response: toUIMessageStreamResponse() (SSE stream)

  export const maxDuration = 300;

  export async function POST(request: Request) {
    // 1. Clerk auth check
    // 2. Parse messages from body
    // 3. streamText with anthropic('claude-opus-4-6'), adaptive thinking
    // 4. Return result.toUIMessageStreamResponse()
  }
  ```
  Uses: `streamText`, `convertToModelMessages`, `toUIMessageStreamResponse`
  Model: `anthropic('claude-opus-4-6')` from existing provider
  Thinking: `thinking: { type: "adaptive" }`
  System prompt: imported from `lead-agent-system.ts`
  No tools for Sprint 1.
- **Acceptance Criteria**:
  - [ ] Route at `/api/journey/stream` accepts POST
  - [ ] Clerk auth gate returns 401 for unauthenticated requests
  - [ ] `streamText` uses `claude-opus-4-6` with adaptive thinking
  - [ ] System prompt imported from `lead-agent-system.ts`
  - [ ] `maxDuration = 300` exported
  - [ ] Response uses `toUIMessageStreamResponse()`
  - [ ] Messages sanitized before `convertToModelMessages` (strip incomplete tool parts)
  - [ ] No tools passed (Sprint 1 scope)
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] API: Authenticated POST returns streaming SSE response
  - [ ] API: Unauthenticated POST returns 401

### Task 3.2: Journey Page Orchestrator

- **Objective**: Create the /journey page that connects layout, header, chat components, and streaming API into a working chat experience.
- **Dependencies**: All Phase 2 tasks, Task 3.1
- **Blocked by**: Phase 2, Task 3.1
- **Files**:
  - Create: `src/app/journey/page.tsx`
- **Contracts**:
  ```typescript
  "use client";

  export default function JourneyPage() {
    // 1. useChat with DefaultChatTransport pointing to /api/journey/stream
    // 2. Hardcoded welcome message (from LEAD_AGENT_WELCOME_MESSAGE)
    // 3. JourneyLayout with phase='setup' (centered)
    // 4. JourneyHeader (logo only, no steps)
    // 5. Message list rendering ChatMessage components
    // 6. ChatInput at bottom, wired to sendMessage
    // 7. TypingIndicator shown when status === 'submitted'
    // 8. Scroll-to-bottom on new messages
  }
  ```
  Welcome message: Displayed as a fake assistant message on mount (not sent to API).
  Session creation: On first user message, create journey_session in Supabase.
  Phase: Always 'setup' for Sprint 1.
- **Acceptance Criteria**:
  - [ ] Page renders at `/journey` (authenticated users only)
  - [ ] Welcome message appears on load
  - [ ] User can type a message and see it as a styled user bubble
  - [ ] AI response streams in token-by-token with streaming cursor
  - [ ] Streaming cursor disappears when response completes
  - [ ] Typing indicator shows while waiting for first token
  - [ ] Messages auto-scroll to bottom
  - [ ] Chat input fixed at bottom with gradient fade
  - [ ] Supabase session created on first message
  - [ ] Messages persisted to Supabase after each exchange
  - [ ] `"use client"` directive, default export (page convention)
- **Testing**:
  - [ ] Build: `npm run build` succeeds
  - [ ] Playwright: Navigate to /journey, see welcome message
  - [ ] Playwright: Type message, see user bubble, see streaming AI response
  - [ ] Supabase: Session created with messages after first exchange
  - [ ] Visual: All design tokens applied (colors, fonts, spacing match design system)

### Task 3.R: Phase 3 Regression

- **Objective**: Full regression test of the integrated journey page
- **Dependencies**: All Phase 3 tasks complete
- **Testing**:
  - [ ] `npm run build` succeeds
  - [ ] `npm run lint` passes
  - [ ] Playwright: Full user flow — navigate, type, stream, scroll
  - [ ] Playwright: Navigate to /dashboard — still works
  - [ ] Playwright: Navigate to /generate — still works
  - [ ] Supabase: Session data correct format
  - [ ] Screenshot: Journey page at each state (empty, typing, streaming, complete)

---

## Phase 4: Comprehensive E2E Testing

**Goal**: Multi-angle end-to-end testing on the fully integrated application. Every user path verified. V1 regression confirmed.

### Task 4.1: Full User Flow E2E

- **Objective**: Comprehensive Playwright test of the complete journey experience.
- **Dependencies**: All prior phases complete
- **Blocked by**: Phase 3
- **Testing**:
  - [ ] Navigate to /journey as authenticated user → centered chat layout
  - [ ] Welcome message visible from AI with correct persona tone
  - [ ] Header shows AI-GOS gradient logo (no step indicators)
  - [ ] Type message → user bubble appears right-aligned with correct styling
  - [ ] Typing indicator appears → streaming response begins
  - [ ] Streaming cursor visible during response → disappears when done
  - [ ] AI response renders with markdown (bold, lists, code blocks)
  - [ ] Send follow-up message → conversation continues naturally
  - [ ] Chat auto-scrolls on long responses
  - [ ] Input auto-resizes for multi-line messages
  - [ ] Enter sends, Shift+Enter adds newline
  - [ ] Supabase session exists with correct messages JSONB
  - [ ] Fonts correct: DM Sans for body, Instrument Sans for headers, JetBrains Mono for code
  - [ ] All colors match design system tokens

### Task 4.2: V1 Regression Suite

- **Objective**: Verify all existing v1 routes are completely unaffected.
- **Dependencies**: All prior phases complete
- **Blocked by**: Phase 3
- **Testing**:
  - [ ] Navigate to /dashboard → renders correctly, no broken styles
  - [ ] Navigate to /generate → onboarding wizard works, can start generation
  - [ ] Navigate to /sign-in → Clerk auth page renders
  - [ ] Navigate to / → landing page renders
  - [ ] Build output has no new warnings related to v1 code
  - [ ] Screenshot comparison: /dashboard before and after Sprint 1 changes

### Task 4.3: Build, Lint, Deploy Verification

- **Objective**: Final build, lint, and deployment readiness check.
- **Dependencies**: Tasks 4.1, 4.2
- **Blocked by**: Tasks 4.1, 4.2
- **Testing**:
  - [ ] `npm run build` succeeds with zero new errors
  - [ ] `npm run lint` passes with zero new warnings
  - [ ] `npm run test:run` passes (existing tests)
  - [ ] No new TypeScript errors in strict mode
  - [ ] Bundle size check — no unexpected large additions
  - [ ] Environment variables: only existing `ANTHROPIC_API_KEY` needed (already set)
  - [ ] `maxDuration = 300` exported on journey route (Vercel Pro requirement)

---

## Dependency Graph

```
Phase 1 (Foundation)
  1.1 (Fonts)     ──┐
  1.2 (Tokens)    ──┼── 1.R (Regression)
  1.3 (Prompt)    ──┤
  1.4 (Model)     ──┤
  1.5 (Supabase)  ──┘
                     │
Phase 2 (Components) │
  2.1 (Layout)    ──┐│
  2.2 (Header)    ──┼┤── 2.R (Regression)
  2.3 (Message)   ──┤│
  2.4 (Input)     ──┤│
  2.5 (Cursor)    ──┘│
                     ││
Phase 3 (Integration)││
  3.1 (API Route) ──┐││
  3.2 (Page)      ──┴┴┘── 3.R (Regression)
                            │
Phase 4 (E2E)               │
  4.1 (User Flow) ──┐      │
  4.2 (V1 Regress) ─┼──────┘
  4.3 (Build)     ──┘
```

Within each phase, tasks without explicit inter-dependencies can run in parallel:
- Phase 1: Tasks 1.1–1.5 are all independent → run in parallel
- Phase 2: Tasks 2.1–2.5 are all independent → run in parallel
- Phase 3: Task 3.1 independent, Task 3.2 depends on 3.1 + Phase 2
- Phase 4: Tasks 4.1–4.2 can run in parallel, 4.3 depends on both

---

## Task Execution Protocol

### For each task:
1. **Orient**: Read task file, DISCOVERY.md, PROGRESS.md, relevant skills
2. **Plan**: Explore codebase context, plan approach
3. **Implement**: Write code following conventions (kebab-case, named exports, cn(), CSS vars via style)
4. **Test**: Run all applicable testing methods locally
5. **Complete**: Update PROGRESS.md, commit

### For regression tasks:
1. Run `npm run build` + `npm run lint`
2. Run ALL task tests from the phase
3. Full Playwright e2e on localhost
4. Screenshot key screens as evidence
5. Fix any failures, retest

### For final phase:
1. All tasks are e2e testing on fully running dev server
2. Every user path and edge case covered
3. Every testing method applied
4. Iterate until all green
