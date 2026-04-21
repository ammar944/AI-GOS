# AI-GOS v2 Sprint 1 — Execution Protocol

## Quick Reference

- **Branch**: `aigos-v2`
- **PHASES.md**: `.claude/orchestration-aigos-v2-sprint1/PHASES.md`
- **DISCOVERY.md**: `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md`
- **PROGRESS.md**: `.claude/orchestration-aigos-v2-sprint1/PROGRESS.md`
- **Tasks**: `.claude/orchestration-aigos-v2-sprint1/tasks/`

## Authority Chain

1. **DISCOVERY.md** overrides everything — scope constraints, architecture decisions, persona spec
2. **PHASES.md** defines task specs — acceptance criteria, contracts, file locations
3. **Task files** have detailed implementation plans (tasks/ directory)
4. **Research files** have supporting context (research/ directory)
5. **CLAUDE.md** has codebase conventions — follow unless DISCOVERY.md says otherwise

---

## Pre-Flight Checklist

Before starting any execution:

1. Confirm branch is `aigos-v2`: `git branch --show-current`
2. Confirm dev server runs: `npm run dev` (http://localhost:3000)
3. Confirm build passes: `npm run build` (baseline — must not introduce new errors)
4. Read DISCOVERY.md in full (authority document)
5. Read PHASES.md in full (task specifications)

---

## Execution Order

### Wave 1: Phase 1 — Design System + Backend Foundation (parallel)

Launch 5 agents simultaneously. These tasks have zero inter-dependencies.

| Agent | Task | File | Key Output |
|-------|------|------|------------|
| 1 | 1.1 Font Replacement | `tasks/task-1.1-global-font-replacement.md` | DM Sans + JetBrains Mono in layout.tsx |
| 2 | 1.2 Token Mapping | `tasks/task-1.2-design-token-mapping.md` | ~30 lines in @theme inline block |
| 3 | 1.3 System Prompt | `tasks/task-1.3-lead-agent-system-prompt.md` | `src/lib/ai/prompts/lead-agent-system.ts` |
| 4 | 1.4 Model Constant | `tasks/task-1.4-model-constant.md` | MODELS.CLAUDE_OPUS in providers.ts |
| 5 | 1.5 Supabase Migration | `tasks/task-1.5-supabase-migration.md` | journey_sessions table via Supabase MCP |

**Gate**: All 5 must complete before proceeding.

**Then**: Run Task 1.R (Phase 1 Regression) — `tasks/task-1.R-phase1-regression.md`
- `npm run build` + `npm run lint`
- Playwright: /dashboard, /generate render correctly with DM Sans fonts
- Supabase: journey_sessions table exists and accepts inserts
- Fix any failures before advancing

---

### Wave 2: Phase 2 — Journey UI Components (parallel)

Launch 5 agents simultaneously. All components are standalone.

| Agent | Task | File | Key Output |
|-------|------|------|------------|
| 1 | 2.1 Layout Shell | `tasks/task-2.1-journey-layout-shell.md` | `src/components/journey/journey-layout.tsx` |
| 2 | 2.2 Header | `tasks/task-2.2-journey-header.md` | `src/components/journey/journey-header.tsx` |
| 3 | 2.3 Chat Message | `tasks/task-2.3-chat-message.md` | `src/components/journey/chat-message.tsx` |
| 4 | 2.4 Chat Input | `tasks/task-2.4-chat-input.md` | `src/components/journey/chat-input.tsx` |
| 5 | 2.5 Streaming Cursor | `tasks/task-2.5-streaming-cursor-typing-indicator.md` | `src/components/journey/streaming-cursor.tsx` + `typing-indicator.tsx` |

**Critical reminder for 2.2**: Logo only. NO step indicators. V2 is a pure chat agent, not a wizard.

**Gate**: All 5 must complete before proceeding.

**Then**: Run Task 2.R (Phase 2 Regression) — `tasks/task-2.R-phase2-regression.md`
- `npm run build` + `npm run lint`
- All 5 components import without errors
- Playwright: v1 pages still work (no import side effects)
- Fix any failures before advancing

---

### Wave 3: Phase 3 — Journey Page Integration (sequential with parallel start)

This wave has internal dependencies. Follow this exact order:

**Step 1**: Start Task 3.1 (Streaming API Route) immediately after Phase 1 completes
- Can start in parallel with Wave 2 if Phase 1 is done
- Creates: `src/app/api/journey/stream/route.ts`
- Uses: system prompt from 1.3, model constant from 1.4
- Spec: PHASES.md "Task 3.1: Streaming API Route"

**Step 2**: Start Task 3.2 (Journey Page Orchestrator) after BOTH:
- Task 3.1 is complete (API route exists)
- Phase 2 is complete (all UI components exist)
- Creates: `src/app/journey/page.tsx`
- Wires: layout (2.1), header (2.2), messages (2.3), input (2.4), cursor/typing (2.5), streaming (3.1)
- Spec: PHASES.md "Task 3.2: Journey Page Orchestrator"

**Step 3**: Run Task 3.R (Phase 3 Regression)
- Full integration test on /journey
- Playwright: navigate, type, stream, scroll
- V1 regression: /dashboard, /generate still work
- Supabase: session data correct format
- Screenshots: journey page at each state (empty, typing, streaming, complete)

---

### Wave 4: Phase 4 — Comprehensive E2E Testing (parallel then final)

**Step 1**: Launch 2 agents in parallel:

| Agent | Task | Spec |
|-------|------|------|
| 1 | 4.1 Full User Flow E2E | PHASES.md "Task 4.1" — complete journey Playwright test |
| 2 | 4.2 V1 Regression Suite | PHASES.md "Task 4.2" — /dashboard, /generate, /sign-in, / |

**Gate**: Both must complete.

**Step 2**: Run Task 4.3 (Build, Lint, Deploy Verification)
- `npm run build` — zero new errors
- `npm run lint` — zero new warnings
- `npm run test:run` — existing tests pass
- Bundle size check
- `maxDuration = 300` confirmed on journey route

---

## Agent Instructions

Every execution agent MUST follow this protocol:

### 1. Orient (before writing any code)
- Read its task file in `tasks/`
- Read DISCOVERY.md for overriding decisions
- Read relevant research files mentioned in the task (in `research/`)
- Read PROGRESS.md for current state

### 2. Plan
- Explore codebase context — read existing files that will be modified
- Identify exact file paths, import patterns, and naming conventions
- Plan approach before writing code

### 3. Implement (following codebase conventions)
- Named exports (not default) for components — except page.tsx which uses default export
- Props interfaces suffixed with `Props` (e.g., `JourneyLayoutProps`)
- `'use client'` directive for interactive components
- `cn()` from `@/lib/utils` for conditional class merging
- CSS variables via inline `style` prop where needed
- `@/*` import alias (absolute imports, never relative)
- kebab-case file names (e.g., `journey-layout.tsx`, not `JourneyLayout.tsx`)
- Framer Motion from `framer-motion` for animations
- Zod for any schema validation

### 4. Test
- `npm run build` must pass — no new TypeScript errors
- `npm run lint` must pass — no new ESLint warnings
- Playwright MCP for browser testing where applicable
- Supabase MCP for database verification where applicable

### 5. Complete
- Update PROGRESS.md: set task status to ✅, fill Started/Completed times, add notes
- Commit on `aigos-v2` branch with message prefix `Task X.Y: <description>`

---

## Dev Server

Must be running for Playwright and browser testing:

```bash
npm run dev  # http://localhost:3000
```

Routes to test:
- `/journey` — new v2 page (after Phase 3)
- `/dashboard` — existing v1 (regression target)
- `/generate` — existing v1 (regression target)
- `/api/journey/stream` — streaming endpoint (after Task 3.1)

---

## Key Gotchas

### AI SDK v6
- `convertToModelMessages()` is **ASYNC** — must `await` it
- `toUIMessageStreamResponse()` pairs with `DefaultChatTransport` (NOT TextStreamChatTransport)
- `inputSchema` (not `parameters`) for tool definitions
- `maxOutputTokens` (not `maxTokens`) for model config
- Strip incomplete tool parts before `convertToModelMessages` to avoid `MissingToolResultsError`

### Tailwind CSS v4
- `--text-quaternary` (`rgb(49, 53, 63)`) is nearly invisible on dark backgrounds — use `--text-tertiary` minimum
- Styles in `@layer utilities` lose specificity to unlayered CSS — use custom CSS outside `@layer` with `!important` when needed
- `opacity-0 group-hover:opacity-100` can break inside shadcn components — use custom CSS classes

### Design Decisions (from DISCOVERY.md)
- No step indicators on journey header — pure chat agent experience
- Welcome message is hardcoded in frontend, not stored in Supabase
- Session created on first user message, not on page load
- Phase is always 'setup' for Sprint 1 (centered chat layout)
- No tools passed to streamText for Sprint 1 (freeform chat only)
- Model is `claude-opus-4-6` with `thinking: { type: "adaptive" }`
- Service role + Clerk ID pattern for Supabase (no RLS)

### File Conflicts
- Tasks 1.1 and 1.2 both modify `src/app/globals.css` — if running in parallel, agents must coordinate or one rebases on the other
- Task 1.1 modifies `src/app/layout.tsx` — no other Phase 1 task touches this file

---

## Scope Constraints (DO NOT implement)

These are explicitly OUT of scope per DISCOVERY.md:

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

If any task description seems to suggest these features, ignore that suggestion and follow DISCOVERY.md.

---

## Success Criteria

Sprint 1 is complete when ALL of the following are true:

1. `/journey` page renders with centered chat layout, DM Sans fonts, design system tokens
2. Welcome message appears on load with correct consultant persona tone
3. User can type a message and see a styled user bubble
4. AI response streams token-by-token from Opus 4.6 with adaptive thinking
5. Streaming cursor and typing indicator work correctly
6. Messages persist to Supabase `journey_sessions` table
7. All existing v1 pages (/dashboard, /generate, /) render without regressions
8. `npm run build` and `npm run lint` pass with zero new errors
9. All 18 tasks marked ✅ in PROGRESS.md
