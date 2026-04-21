# Sprint 3: POLISH — Claude-Flow Orchestrated Prompts

**Status**: Sprint 2 complete. Sprint 3 = Polish phase.
**Scope**: Visualizations, Streaming UX, Follow-ups, Mobile, Persistence, Journey Progress, + Sprint 2 Deferrals
**Workflow**: Claude-Flow swarm orchestration — each task uses agent teams with shared memory.
**Branch**: `aigos-v2`

> **Claude-Flow Setup** (one-time per machine):
> ```bash
> # Install Claude-Flow
> curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash -s -- --full
>
> # Or via npx
> npx ruflo@alpha init --wizard
>
> # Add MCP server to Claude Code (.claude/mcp.json)
> {
>   "mcp_servers": {
>     "claude-flow": {
>       "command": "npx",
>       "args": ["-y", "ruflo@latest", "mcp", "start"],
>       "enabled": true,
>       "timeout": 30000
>     }
>   }
> }
> ```

> **Sprint 3 Swarm Initialization** (run once at sprint start):
> ```bash
> # Initialize the Sprint 3 swarm
> npx ruflo swarm init --topology hierarchical-mesh --max-agents 10 --v3-mode
>
> # Store Sprint 3 context in shared memory
> npx ruflo memory store -k "sprint3-context" \
>   --value "Sprint 3 POLISH: visualizations, streaming UX, follow-ups, mobile, persistence, journey progress. Branch: aigos-v2. Authority: .claude/sprints/SPRINT-3-POLISH.md" \
>   --namespace sprint3 --tags "context,sprint3"
>
> npx ruflo memory store -k "sprint3-design-tokens" \
>   --value "--accent-blue: rgb(54,94,255); --bg-hover; --border-default; --border-subtle; --text-primary; --text-secondary; --text-tertiary; fonts: DM Sans, Instrument Sans, JetBrains Mono; animations: Framer Motion springs" \
>   --namespace sprint3 --tags "design,tokens"
> ```

---

## Phase 1: Parallel Component Work (4 sessions simultaneously)

### Task 1A: Visualization Tool + Chart Card

```
I'm working on AI-GOS v2 Sprint 3 — Polish phase. I need to create the createVisualization tool and VisualizationCard component for inline Recharts rendering.

## Claude-Flow Orchestration
Initialize and run these commands at the start of this session:

```bash
# Spawn specialized agents for this task
npx ruflo agent spawn -t architect --name viz-architect --timeout 300
npx ruflo agent spawn -t coder --name viz-tool-dev --timeout 300
npx ruflo agent spawn -t coder --name viz-card-dev --timeout 300
npx ruflo agent spawn -t reviewer --name viz-reviewer --timeout 300

# Route the task
npx ruflo route "Build visualization tool and chart card" \
  --agents viz-architect,viz-tool-dev,viz-card-dev,viz-reviewer \
  --strategy adaptive

# Search shared memory for relevant patterns
npx ruflo memory search -q "chart component recharts card pattern" --namespace sprint3
```

## Agent Team Coordination
- **viz-architect**: Design the tool schema and data transformation approach. Review existing tool patterns in `src/lib/ai/chat-tools/` for consistency.
- **viz-tool-dev**: Implement `create-visualization.ts` — pure data transformation, no API calls.
- **viz-card-dev**: Implement `visualization-card.tsx` — Recharts ResponsiveContainer with bar/radar/timeline support.
- **viz-reviewer**: Two-stage review — spec compliance against Sprint 3 doc, then code quality.

Agents communicate through agent teams for handoffs. viz-architect specs first → both coders implement in parallel → viz-reviewer validates.

## Authority Documents (READ THESE FIRST)
- `.claude/sprints/SPRINT-3-POLISH.md` — Subagent A section (exact specs)
- `CLAUDE.md` — project conventions (imports, naming, styling)

## Key Files to Read
- `src/lib/ai/chat-tools/index.ts` — where to register the new tool
- `src/lib/ai/chat-tools/deep-research.ts` — example tool pattern to follow
- `src/components/chat/deep-research-card.tsx` — example card pattern to follow
- `src/components/chat/agent-chat.tsx` — where to render the new card
- `src/app/globals.css` — design tokens

## Files to Create
1. `src/lib/ai/chat-tools/create-visualization.ts`
   - name: 'createVisualization'
   - inputSchema: z.object({ type: z.enum(['bar', 'radar', 'timeline']), title: z.string(), dataSource: z.string() })
   - Execute: Extract blueprint data → transform to Recharts format → return { type, title, data, config }

2. `src/components/chat/visualization-card.tsx`
   - Container: 12px radius, border-default, shadow-card, 14px padding
   - Title: 12px/600, text-primary
   - Chart: <ResponsiveContainer> wrapping BarChart/RadarChart/Timeline
   - Bar charts: gradient fills, 80px height, labels below
   - Animate on mount
   - Props: data: VisualizationResult

## Files to Modify
- `src/lib/ai/chat-tools/index.ts` — add createVisualization to createChatTools()
- `src/components/chat/agent-chat.tsx` — render <VisualizationCard> for createVisualization tool results

## Acceptance Criteria
- [ ] createVisualization tool registered and callable by agent
- [ ] Bar chart renders with gradient fills and labels
- [ ] Radar chart renders for score dimensions
- [ ] Timeline chart renders for campaign phasing
- [ ] Card fits within 340px without overflow
- [ ] Animations on mount
- [ ] `npm run build` passes

## After Completion — Store Learnings
```bash
npx ruflo memory store -k "viz-tool-pattern" \
  --value "Visualization tool: pure data transform, Recharts ResponsiveContainer, gradient fills, 80px bar height, 340px max" \
  --namespace sprint3 --tags "visualization,pattern,complete"
```
```

---

### Task 1B: Streaming UX + Loading Redesign

```
I'm working on AI-GOS v2 Sprint 3 — Polish phase. I need to redesign the tool-loading-indicator with contextual cards and create a research-progress-card for live deep research phases.

## Claude-Flow Orchestration
```bash
# Spawn agents
npx ruflo agent spawn -t coder --name loading-redesigner --timeout 300
npx ruflo agent spawn -t coder --name progress-card-dev --timeout 300
npx ruflo agent spawn -t coder --name streaming-cursor-dev --timeout 300
npx ruflo agent spawn -t reviewer --name ux-reviewer --timeout 300

# Route with parallel execution
npx ruflo route "Redesign streaming UX and loading indicators" \
  --agents loading-redesigner,progress-card-dev,streaming-cursor-dev,ux-reviewer \
  --strategy adaptive

npx ruflo memory search -q "tool loading indicator streaming UX" --namespace sprint3
```

## Agent Team Coordination
- **loading-redesigner**: Complete redesign of tool-loading-indicator.tsx with contextual cards per tool type.
- **progress-card-dev**: Create research-progress-card.tsx with live phased progress (Decomposing → Researching → Synthesizing).
- **streaming-cursor-dev**: Add streaming-cursor class and stream-content-enter animation to message-bubble.tsx.
- **ux-reviewer**: Verify all 3 changes match Sprint 3 spec exactly.

loading-redesigner + progress-card-dev + streaming-cursor-dev work in parallel → ux-reviewer validates all.

## Authority Documents (READ THESE FIRST)
- `.claude/sprints/SPRINT-3-POLISH.md` — Subagent B section (exact specs)
- `CLAUDE.md` — project conventions

## Key Files to Read
- `src/components/chat/tool-loading-indicator.tsx` — THE FILE to redesign
- `src/components/chat/message-bubble.tsx` — add streaming cursor
- `src/components/chat/deep-research-card.tsx` — research card pattern
- `src/app/globals.css` — streaming-cursor and stream-content-enter CSS classes already exist

## tool-loading-indicator.tsx Redesign Spec
- Container: padding 10px 12px, border-radius 10px, bg-hover, border-subtle
- Left: 24px icon with 2s spinning animation, colored by tool type
- Right: Tool name (12px/500, secondary) + description (12px, tertiary)
- Tool-specific messages:
  - searchBlueprint: "Searching blueprint..."
  - editBlueprint: "Proposing edits..."
  - deepResearch: "Researching 5 sub-queries..."
  - compareCompetitors: "Comparing competitors..."
  - analyzeMetrics: "Scoring section..."
- Props: toolName: string, args?: Record<string, unknown>

## research-progress-card.tsx Spec
- Live progress phases: Decomposing → Researching (3/5) → Synthesizing
- Each phase: status dot (done=green, active=blue pulse, pending=gray) + label + count
- Active phase has pulsing blue dot
- Transitions to DeepResearchCard when research completes
- Props: phases: { name: string, status: string, count?: string }[]

## message-bubble.tsx Streaming Changes
- Add .streaming-cursor class (2px blue bar, blink) at end of streaming text
- Add .stream-content-enter animation (opacity 0→1, translateY 2→0, 0.15s)
- CSS classes already exist in globals.css — just apply them

## Acceptance Criteria
- [ ] Tool loading shows contextual indicator with tool name per tool type
- [ ] Spinning icon colored by tool type
- [ ] Research progress card shows live phases with status dots
- [ ] Active phase has pulsing blue dot animation
- [ ] Streaming cursor visible at end of streaming text
- [ ] New text chunks animate in smoothly
- [ ] `npm run build` passes

## After Completion — Store Learnings
```bash
npx ruflo memory store -k "streaming-ux-pattern" \
  --value "Tool loading: contextual cards per tool, 10px radius, 24px icon. Research progress: 3 phases with status dots. Streaming: cursor class + enter animation." \
  --namespace sprint3 --tags "streaming,ux,pattern,complete"
```
```

---

### Task 1C: Follow-Up Suggestions Upgrade

```
I'm working on AI-GOS v2 Sprint 3 — Polish phase. I need to upgrade quick-suggestions into contextual follow-up suggestions that appear after each AI response.

## Claude-Flow Orchestration
```bash
# Spawn agents
npx ruflo agent spawn -t coder --name suggestions-dev --timeout 300
npx ruflo agent spawn -t coder --name suggestion-logic-dev --timeout 300
npx ruflo agent spawn -t reviewer --name suggestions-reviewer --timeout 300

# Route
npx ruflo route "Upgrade follow-up suggestions" \
  --agents suggestions-dev,suggestion-logic-dev,suggestions-reviewer \
  --strategy adaptive

npx ruflo memory search -q "follow-up suggestions contextual chips" --namespace sprint3
```

## Agent Team Coordination
- **suggestions-dev**: Rename and restyle quick-suggestions → follow-up-suggestions with new chip design.
- **suggestion-logic-dev**: Implement context-aware suggestion generation based on last tool result type.
- **suggestions-reviewer**: Verify spec compliance and interaction patterns.

suggestions-dev + suggestion-logic-dev work in parallel → suggestions-reviewer validates.

## Authority Documents (READ THESE FIRST)
- `.claude/sprints/SPRINT-3-POLISH.md` — Subagent C section (exact specs)
- `CLAUDE.md` — project conventions

## Key Files to Read/Modify
- `src/components/chat/quick-suggestions.tsx` — rename to follow-up-suggestions.tsx
- `src/components/chat/agent-chat.tsx` — update import, show after each AI response

## New Behavior
- Show 2-3 contextual suggestions AFTER each AI response (not just at start)
- Parse last assistant message content for topics/entities
- Context-specific suggestions:
  - After deepResearch: ["Update blueprint with findings", "Research deeper on [topic]", "Compare top competitors"]
  - After editBlueprint: ["Approve and continue", "Modify the edit", "Explain this change"]
  - After analyzeMetrics: ["Fix the weakest dimension", "Rewrite this section", "Compare to competitor"]
  - Default: ["Summarize insights", "What should I improve?", "Generate ad hooks"]
- Show 2-3 empty-state suggestions at chat start

## Styling
- Flex-wrap row of chips
- padding: 6px 11px; border-radius: 8px; font-size: 11.5px
- color: --text-tertiary; background: --bg-base; border: 1px solid --border-subtle
- Hover: --accent-blue border + color, rgba(54,94,255,0.05) background
- Entrance: staggered fadeUp with 100ms delay per chip
- Props: suggestions: string[], onSelect: (text: string) => void

## Acceptance Criteria
- [ ] Component renamed to FollowUpSuggestions
- [ ] Suggestions appear after EVERY AI response
- [ ] Suggestions are contextual to the last tool used
- [ ] Chip styling matches spec exactly
- [ ] Staggered fadeUp entrance animation
- [ ] Clicking a chip sends it as a new message
- [ ] 2-3 empty-state suggestions at chat start
- [ ] `npm run build` passes
```

---

### Task 1D: Conversation Persistence

```
I'm working on AI-GOS v2 Sprint 3 — Polish phase. I need to add Supabase conversation persistence with auto-save and load.

## Claude-Flow Orchestration
```bash
# Spawn agents
npx ruflo agent spawn -t architect --name persistence-architect --timeout 300
npx ruflo agent spawn -t coder --name persistence-dev --timeout 300
npx ruflo agent spawn -t coder --name persistence-integration-dev --timeout 300
npx ruflo agent spawn -t reviewer --name persistence-reviewer --timeout 300

# Route
npx ruflo route "Build conversation persistence" \
  --agents persistence-architect,persistence-dev,persistence-integration-dev,persistence-reviewer \
  --strategy adaptive

npx ruflo memory search -q "supabase persistence conversation save load" --namespace sprint3
```

## Agent Team Coordination
- **persistence-architect**: Design the schema, decide on upsert vs insert, plan the debounce strategy.
- **persistence-dev**: Create `src/lib/chat/persistence.ts` with all CRUD functions.
- **persistence-integration-dev**: Wire persistence into agent-chat.tsx (auto-save, load on mount, title display).
- **persistence-reviewer**: Validate against spec + test persistence round-trip.

persistence-architect specs first → both devs work in parallel → reviewer validates.

## Authority Documents (READ THESE FIRST)
- `.claude/sprints/SPRINT-3-POLISH.md` — Subagent D section (exact specs)
- `CLAUDE.md` — project conventions

## Key Files
- `src/lib/chat/persistence.ts` — CREATE
- `src/components/chat/agent-chat.tsx` — wire persistence
- `src/lib/supabase/` — existing Supabase client pattern (follow it, don't create new)

## Supabase Schema
```sql
CREATE TABLE chat_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  blueprint_id text,
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title text
);
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_blueprint ON chat_conversations(blueprint_id);
```

## Functions to Implement
- saveConversation(userId, blueprintId, messages) — upsert
- loadConversation(conversationId) — fetch
- listConversations(userId, blueprintId) — list all for a blueprint
- deleteConversation(conversationId) — soft delete
- Title: auto-generated from first user message, truncated to 60 chars

## Integration in agent-chat.tsx
- On mount: if conversationId prop exists, load messages from Supabase
- After each message: save to Supabase (debounced 2 seconds)
- Display conversation title in chat header

## Acceptance Criteria
- [ ] chat_conversations table exists with correct schema
- [ ] saveConversation upserts correctly
- [ ] loadConversation fetches full message history
- [ ] listConversations returns all for a blueprint
- [ ] Auto-save fires debounced after each message
- [ ] Conversation loads on mount from conversationId
- [ ] Title auto-generated from first message
- [ ] `npm run build` passes
```

---

## Phase 2: New Features (after Phase 1 completes)

### Task 2A: Journey Progress Indicator

```
I'm working on AI-GOS v2 Sprint 3. I need to create a journey-wide progress indicator showing where the user is across the full pipeline: Onboarding → Strategic Blueprint → Media Plan, each with subsections.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t architect --name progress-architect --timeout 300
npx ruflo agent spawn -t coder --name progress-component-dev --timeout 300
npx ruflo agent spawn -t coder --name progress-state-dev --timeout 300
npx ruflo agent spawn -t reviewer --name progress-reviewer --timeout 300

npx ruflo route "Build journey progress indicator" \
  --agents progress-architect,progress-component-dev,progress-state-dev,progress-reviewer \
  --strategy adaptive

npx ruflo memory search -q "pipeline progress stages onboarding blueprint media plan" --namespace sprint3
```

## Agent Team Coordination
- **progress-architect**: Design the component API, decide how it composes with existing Pipeline component, define the stage/substage data model.
- **progress-component-dev**: Build `journey-progress.tsx` — the visual three-stage indicator with subsection expansion.
- **progress-state-dev**: Build `journey-progress-state.ts` — state management that unifies onboarding completion, blueprint stages, and media plan sections into one progress model.
- **progress-reviewer**: Verify against existing Pipeline component patterns and design tokens.

## Context
The full user pipeline has these macro stages:
```
[1. Onboarding]        → [2. Strategic Blueprint]         → [3. Media Plan]
    ↳ 8 required fields     ↳ Industry, ICP, Offer,           ↳ Exec Summary, Platform Strategy,
    ↳ ~14 optional              Competitors, Keywords,             ICP Targeting, Campaign Structure,
                                 Synthesis                          Creative Strategy, Budget,
                                                                    Phases, KPIs, Performance, Risk
```

## Existing Building Blocks
- `src/components/pipeline/pipeline.tsx` — Generic stage component (completed/active/pending dots + connecting lines). REUSE THIS.
- `src/hooks/use-generate-page-state.ts` — BLUEPRINT_STAGES = ["Industry", "ICP", "Offer", "Competitors", "Keywords", "Synthesis"]
- `src/lib/media-plan/section-constants.ts` — MEDIA_PLAN_SECTION_ORDER (10 sections)
- `src/lib/journey/session-state.ts` — calculateCompletion() for onboarding (0-8 required fields)
- `src/components/journey/journey-header.tsx` — Currently has 2px completion bar (enhance, don't replace)

## Key Files to Read
- `src/components/pipeline/pipeline.tsx` — reuse the stage visualization pattern
- `src/hooks/use-generate-page-state.ts` — existing page states and stage constants
- `src/lib/media-plan/types.ts` — MEDIA_PLAN_STAGES
- `src/lib/media-plan/section-constants.ts` — MEDIA_PLAN_SECTION_ORDER
- `src/lib/journey/session-state.ts` — onboarding completion tracking

## Files to Create
1. `src/components/journey/journey-progress.tsx` — Three-stage progress indicator
   - Macro stages: Onboarding | Strategic Blueprint | Media Plan
   - Each stage expandable to show subsections
   - Active stage highlighted with --accent-blue
   - Completed stages show green checkmark
   - Subsections show individual progress (completed/active/pending)
   - Compact mode for header (just 3 dots + labels)
   - Expanded mode for sidebar/overlay (full subsection list)

2. `src/lib/journey/journey-progress-state.ts` — Unified progress state
   - Combines: onboarding fields (0-8), blueprint sections (0-6), media plan sections (0-10)
   - Exports: getCurrentStage(), getStageProgress(), getOverallProgress()
   - Integrates with existing calculateCompletion() and BLUEPRINT_STAGES

## Files to Modify
- `src/components/journey/journey-header.tsx` — Replace simple 2px bar with compact JourneyProgress + keep bar as secondary indicator
- `src/app/journey/page.tsx` — Pass journey progress state
- `src/app/generate/page.tsx` — Pass journey progress state

## Design
- Compact (header): Three labeled dots with connecting line. Active dot pulses blue. Text below each dot.
- Expanded (optional sidebar): Vertical list with subsections indented under each stage. Checkmarks for done, blue dot for active, gray for pending.
- Uses existing design tokens: --accent-blue, --accent-green, --text-primary, --text-tertiary, --border-subtle
- Framer Motion for stage transitions

## Acceptance Criteria
- [ ] Three macro stages visible: Onboarding → Strategic Blueprint → Media Plan
- [ ] Current stage highlighted with --accent-blue
- [ ] Completed stages show green checkmark
- [ ] Subsections visible when expanded
- [ ] Onboarding shows 8 required fields progress
- [ ] Blueprint shows 6 section progress
- [ ] Media Plan shows 10 section progress
- [ ] Compact mode fits in header
- [ ] Integrates with existing Pipeline component pattern
- [ ] `npm run build` passes
```

---

### Task 2B: Session Resume (Deferred from Sprint 2 — D15)

```
I'm working on AI-GOS v2 Sprint 3. This was deferred from Sprint 2 (DISCOVERY.md D15). I need to implement smart session resume — when a user returns to /journey, load their previous progress and continue.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t architect --name resume-architect --timeout 300
npx ruflo agent spawn -t coder --name resume-dev --timeout 300
npx ruflo agent spawn -t tester --name resume-tester --timeout 300
npx ruflo agent spawn -t reviewer --name resume-reviewer --timeout 300

npx ruflo route "Implement session resume from Sprint 2 deferral" \
  --agents resume-architect,resume-dev,resume-tester,resume-reviewer \
  --strategy adaptive

npx ruflo memory search -q "session resume localStorage Supabase onboarding" --namespace sprint3
```

## Agent Team Coordination
- **resume-architect**: Design resume flow — what gets restored, what starts fresh, how to handle partial sessions.
- **resume-dev**: Implement resume logic in journey page.
- **resume-tester**: Test resume scenarios (fresh user, returning user, partial session, complete session).
- **resume-reviewer**: Validate against Sprint 2 persistence contracts.

## Context (from Sprint 2 DISCOVERY.md D15)
Sprint 2 persisted session state to both localStorage AND Supabase but did NOT implement resume logic. The data is there — we just need the logic to:
1. On mount: check localStorage for existing session
2. If found: show a "Continue where you left off?" prompt (via askUser tool)
3. If yes: hydrate the agent's context with what's already been answered, skip those questions
4. If no: clear localStorage, start fresh

## Key Files
- `src/app/journey/page.tsx` — add resume detection on mount
- `src/lib/journey/session-state.ts` — already has OnboardingState + calculateCompletion
- `src/lib/storage/local-storage.ts` — already has getJourneySession/setJourneySession
- `src/lib/ai/prompts/lead-agent-system.ts` — update system prompt to handle resumed sessions

## Acceptance Criteria
- [ ] Returning user sees "Continue where you left off?" option
- [ ] Selecting "Continue" resumes with previously answered fields pre-populated
- [ ] Selecting "Start fresh" clears session and begins anew
- [ ] Agent system prompt receives existing answers so it doesn't re-ask
- [ ] Progress bar reflects restored state immediately
- [ ] `npm run build` passes
```

---

### Task 2C: Two-Column Layout Transition (Deferred from Sprint 2)

```
I'm working on AI-GOS v2 Sprint 3. Sprint 2 kept the layout centered for the entire onboarding flow. Now I need to implement the transition from centered chat to two-column layout when the blueprint generation starts.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t coder --name layout-dev --timeout 300
npx ruflo agent spawn -t reviewer --name layout-reviewer --timeout 300

npx ruflo route "Implement two-column layout transition" \
  --agents layout-dev,layout-reviewer --strategy adaptive

npx ruflo memory search -q "two-column layout transition centered blueprint panel" --namespace sprint3
```

## Context
- `src/components/journey/journey-layout.tsx` already has phase='setup' | 'review'
- 'setup' = centered 720px max-width chat
- 'review' = two-column with blueprint panel on right
- Need to wire the phase transition when onboarding completes → blueprint generation begins

## Key Files
- `src/components/journey/journey-layout.tsx` — already built, just needs the trigger
- `src/app/journey/page.tsx` — needs to track phase and pass to layout
- `src/components/layout/two-column-layout.tsx` — existing two-column pattern from /generate

## Acceptance Criteria
- [ ] Onboarding starts in centered layout
- [ ] When onboarding completes, layout transitions to two-column
- [ ] Blueprint panel appears on right with generation progress
- [ ] Transition is smooth (Framer Motion animate)
- [ ] `npm run build` passes
```

---

## Phase 3: Integration + Mobile (after Phase 2 completes)

### Task 3A: Full Integration Wiring

```
I'm working on AI-GOS v2 Sprint 3. All component work is done. I need to wire everything together in agent-chat.tsx and the streaming pipeline.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t architect --name integration-architect --timeout 300
npx ruflo agent spawn -t coder --name integration-dev --timeout 300
npx ruflo agent spawn -t tester --name integration-tester --timeout 300
npx ruflo agent spawn -t reviewer --name integration-reviewer --timeout 300

npx ruflo route "Wire all Sprint 3 components together" \
  --agents integration-architect,integration-dev,integration-tester,integration-reviewer \
  --strategy adaptive

# Pull all learnings from Phase 1+2
npx ruflo memory search -q "sprint3 pattern complete" --namespace sprint3
```

## Agent Team Coordination
- **integration-architect**: Map all wiring points, identify dependency order.
- **integration-dev**: Execute all wiring changes.
- **integration-tester**: Verify each integration point works end-to-end.
- **integration-reviewer**: Final spec compliance check.

## Integration Checklist
1. Wire visualization tool into tools index (`createChatTools()`) and agent-chat rendering
2. Wire research progress card into streaming pipeline:
   - Show during deepResearch tool in-progress state
   - Replace with full DeepResearchCard when done
3. Wire follow-up suggestions after each AI message:
   - Pass onSelect → sendMessage()
   - Generate suggestions based on last tool result
4. Wire persistence: load on mount, save on message changes (debounced)
5. Wire journey progress indicator into header
6. Wire session resume logic on mount
7. Wire two-column layout transition
8. Update agent route system prompt to include /visualize command docs

## Key Files to Modify
- `src/components/chat/agent-chat.tsx` — primary integration point
- `src/lib/ai/chat-tools/index.ts` — register visualization tool
- `src/app/api/chat/agent/route.ts` — update system prompt with visualization command
- `src/app/journey/page.tsx` — session resume + progress + layout phase

## Acceptance Criteria
- [ ] Visualization tool callable and renders inline charts
- [ ] Research progress card shows during deep research
- [ ] Follow-up suggestions appear after every AI response
- [ ] Conversations auto-save and load from Supabase
- [ ] Journey progress shows in header
- [ ] Session resume works on return visit
- [ ] Layout transitions from centered to two-column
- [ ] `npm run build` passes
```

---

### Task 3B: Mobile Responsiveness Pass

```
I'm working on AI-GOS v2 Sprint 3. I need to add mobile responsiveness with a floating chat button and overlay modal.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t coder --name mobile-dev --timeout 300
npx ruflo agent spawn -t tester --name mobile-tester --timeout 300
npx ruflo agent spawn -t reviewer --name mobile-reviewer --timeout 300

npx ruflo route "Mobile responsiveness pass" \
  --agents mobile-dev,mobile-tester,mobile-reviewer --strategy adaptive
```

## Key File
- `src/components/layout/two-column-layout.tsx` — add responsive breakpoints

## Mobile Spec (from Sprint 3 doc)
Below 1024px:
- Blueprint goes full width
- Floating chat button: position absolute, bottom 16px, left 16px, z-index 20, 48px circle, --accent-blue background
- Chat overlay: position absolute, inset 0, z-index 20, --bg-surface background
- Close button in overlay header

## Additional Checks
- All cards fit within 340px without overflow
- Tables scroll horizontally if needed at narrow widths
- Journey progress indicator adapts to mobile (compact only)

## Acceptance Criteria
- [ ] Below 1024px: blueprint full width
- [ ] Floating chat button visible on mobile
- [ ] Chat overlay opens/closes correctly
- [ ] Close button in overlay header
- [ ] All cards fit 340px without overflow
- [ ] Journey progress compact on mobile
- [ ] `npm run build` passes
```

---

## Phase 4: Testing + Regression (after Phase 3 completes)

### Task 4A: E2E Happy Path

```
I'm working on AI-GOS v2 Sprint 3. All implementation and integration is complete. Full E2E test.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t tester --name e2e-tester --timeout 600
npx ruflo agent spawn -t debugger --name e2e-debugger --timeout 600

npx ruflo route "Sprint 3 E2E happy path testing" \
  --agents e2e-tester,e2e-debugger --strategy adaptive
```

## Test Script
1. `npm run build` — must pass
2. `npm run lint` — must pass
3. `npm run dev` → navigate to /journey
4. Complete onboarding → verify progress indicator shows "Onboarding" active
5. Trigger blueprint generation → verify layout transitions to two-column
6. Verify progress indicator advances to "Strategic Blueprint"
7. Open chat → ask agent to "/visualize competitor comparison"
8. Verify inline Recharts bar chart renders
9. Verify follow-up suggestions appear after each response
10. Verify tool loading shows contextual indicator
11. Trigger deep research → verify research progress card with live phases
12. Close browser → reopen → verify conversation loads from Supabase
13. Return to /journey → verify "Continue where you left off?" prompt
14. Test on narrow viewport (375px) → verify mobile overlay works
15. Screenshot every key screen as evidence

If failures: e2e-debugger runs 4-phase root cause analysis.
```

---

### Task 4B: Edge Cases + Regression

```
I'm working on AI-GOS v2 Sprint 3. Happy path passing. Test edge cases and verify no regressions.

## Claude-Flow Orchestration
```bash
npx ruflo agent spawn -t tester --name edge-tester --timeout 600
npx ruflo agent spawn -t tester --name regression-tester --timeout 600
npx ruflo agent spawn -t debugger --name edge-debugger --timeout 600

# Run edge + regression in parallel
npx ruflo hive-mind distribute \
  --task "Test edge cases and regressions" \
  --agents edge-tester,regression-tester,edge-debugger \
  --parallel
```

## Edge Cases
1. Visualization with empty data → graceful fallback
2. Conversation persistence with network failure → silent fail, localStorage backup
3. Session resume with corrupted localStorage → start fresh gracefully
4. Follow-up suggestions with no tool result → show default suggestions
5. Research progress card with extremely fast completion → no flash
6. Mobile overlay with keyboard open → doesn't break layout
7. Two-column transition during streaming → smooth, no content jump

## Regression
1. /dashboard → loads without errors
2. /strategy → loads without errors
3. /chat → loads, send message, get response
4. /journey → loads, onboarding flow works (Sprint 2 functionality intact)
5. Existing tool cards (deep research, edit blueprint, etc.) still render
6. ThinkingBlock with timer still works
7. AskUser chips still work
8. No console errors on any page
9. Screenshot each page as evidence

If failures: edge-debugger diagnoses with systematic 4-phase root cause.
```

---

## Execution Order

```
PHASE 1 — 4 sessions in PARALLEL:
├── Task 1A (Visualization Tool + Chart Card)
├── Task 1B (Streaming UX + Loading Redesign)
├── Task 1C (Follow-Up Suggestions Upgrade)
└── Task 1D (Conversation Persistence)

PHASE 2 — 3 sessions in PARALLEL (after Phase 1):
├── Task 2A (Journey Progress Indicator)
├── Task 2B (Session Resume)
└── Task 2C (Two-Column Layout Transition)

PHASE 3 — Sequential (after Phase 2):
├── Task 3A (Full Integration Wiring)
└── Task 3B (Mobile Responsiveness)

PHASE 4 — Sequential (after Phase 3):
├── Task 4A (E2E Happy Path)
└── Task 4B (Edge Cases + Regression)
```

## Sprint 2 Deferrals Included

| Deferral | Where Addressed | Sprint 3 Task |
|----------|----------------|---------------|
| D15: Session resume | Task 2B | Resume from mid-onboarding |
| Two-column layout transition | Task 2C | Centered → two-column |
| Conversation persistence | Task 1D | Supabase save/load |

## Sprint 2 Deferrals NOT Addressed (Sprint 4+)

| Deferral | Reason | Target |
|----------|--------|--------|
| Voice input (Groq Whisper) | Separate input modality, needs own sprint | Sprint 4+ |
| Background research during onboarding | Requires research pipeline integration | Sprint 4+ |
| Research activity ticker | Depends on background research | Sprint 4+ |
| URL scraping | Requires Firecrawl integration | Sprint 4+ |

## Claude-Flow Shared Memory Keys

After each task completes, store learnings:
```bash
npx ruflo memory store -k "sprint3-[task]-pattern" \
  --value "[description of what was built and key decisions]" \
  --namespace sprint3 --tags "[task],pattern,complete"
```

This enables future sprints to recall Sprint 3 patterns:
```bash
npx ruflo memory search -q "visualization chart pattern" --namespace sprint3
npx ruflo memory search -q "persistence conversation save" --namespace sprint3
```

## Sprint 3 Complete When
- All 11 tasks show DONE
- `npm run build` passes
- `npm run lint` passes
- All E2E tests pass with screenshots
- No regressions on existing pages
- Conversations persist and resume correctly
- Mobile responsive with overlay chat
- Journey progress visible across all stages
