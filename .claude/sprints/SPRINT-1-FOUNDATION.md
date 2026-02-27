# Sprint 1 — Foundation: Layout, Input, Messages, Route Upgrade

## Context

We're upgrading the AI-GOS chat agent from a basic Q&A sidebar into a world-class AI agent experience. The current chat is a 380px left sidebar with basic text bubbles and 4 tools. We're transforming it into a **340px Figma AI-inspired** conversational panel with inline artifact cards, slash commands, reasoning blocks, and a clean bottom input with model selector.

**Read these files first for full context:**
- `@CLAUDE.md` — project conventions and architecture
- `@EGOOS-AGENT-UI-SPEC.md` — complete UI/UX specification with exact design tokens
- `@EGOOS-CHAT-AGENT-V2.html` — **V2 HTML preview (Figma AI-inspired layout)** — read the CSS carefully
- `@AGENT-UPGRADE-PLAN.md` — full upgrade plan

## Objective

Implement the foundation layer: new two-column layout, redesigned chat input with slash commands, redesigned message rendering with thinking blocks, and upgrade the agent route to support more tools and reasoning steps.

## Orchestration Plan — Use Parallel Subagents

Think hard about the dependencies between these tasks, then execute them using parallel subagents where possible.

### Subagent A — New Layout System (worktree isolation)

**Files to create:**
- `src/components/layout/two-column-layout.tsx` — Replaces `split-chat-layout.tsx`

**Files to modify:**
- `@src/components/layout/split-chat-layout.tsx` — Study this for current patterns, then create the replacement
- `@src/components/layout/index.ts` — Update exports
- `@src/app/generate/_components/blueprint-review-view.tsx` — Switch from `SplitChatLayout` to `TwoColumnLayout`

**Specification:**
- Two columns: Chat panel (**340px** fixed, `flex-shrink: 0`) | Blueprint (flex-1)
- Chat panel background: `#090b10` (slightly darker than base, `--bg-chat`)
- **No separate chat header** — messages start directly in the panel (Figma AI style)
- Scrollable messages area + sticky input area at bottom
- Border-right on chat panel: `1px solid var(--border-default)`
- Blueprint panel background: `var(--bg-base)` with its own toolbar (44px) containing tabs: Document | Outline | History
- Blueprint section nav: vertical dots on right edge, fixed position
- Mobile (<1024px): Stack vertically — blueprint full width + floating chat button bottom-left, chat opens as full-screen overlay
- The chat content area (messages + input) gets passed as `chatContent` prop, blueprint as `blueprintContent` — same pattern as current `SplitChatLayout`
- Keep the minimize/expand behavior for desktop (icon strip at 48px when minimized)
- Use Framer Motion for all transitions — import springs from `@/lib/motion`
- Use `cn()` from `@/lib/utils` for all className merging

### Subagent B — Redesigned Chat Input (worktree isolation)

**Files to create:**
- `src/components/chat/chat-input.tsx` — New premium input component
- `src/components/chat/slash-command-palette.tsx` — Slash command overlay

**Specification for `chat-input.tsx`:**
- Container with `border-radius: 12px`, `background: var(--bg-input)` (#0e1017), `border: 1px solid var(--border-default)`
- Focus state: `border-color: var(--border-focus)` (#4d6fff) + `box-shadow: 0 0 24px rgba(77,111,255,0.12)`
- Auto-expanding `<textarea>` (min 1 row, max 100px) using a ref-based resize pattern
- **Input toolbar BELOW textarea, inside the container** (Figma AI style):
  - Left: Attach button (paperclip, 28px) + Model selector ("Groq 70B ↓" in mono font, clickable)
  - Right: Stop button (square icon, shown during streaming, 28px) + Send button (blue filled, 28px)
- Button sizes: 28px square, rounded-6px (toolbar) / rounded-7px (send)
- Send button: `background: var(--accent-blue)`, white arrow icon, hover scale(1.05)
- No separate hint bar — the model selector serves that purpose
- Padding: 10px 12px top for textarea, 6px 10px 8px for toolbar
- Placeholder text: "Ask about your blueprint or type / for commands..." in `var(--text-quaternary)`
- `onSubmit` prop: `(message: string) => void`
- `isLoading` prop: when true, send button transforms to stop button
- `onStop` prop: `() => void` — called when stop button clicked

**Specification for `slash-command-palette.tsx`:**
- Appears ABOVE the input container when user types "/" as first character
- `position: absolute; bottom: 100%; left: 0; right: 0; margin-bottom: 6px`
- Container: `border-radius: 12px`, `background: var(--bg-elevated)`, `border: 1px solid var(--border-default)`, `box-shadow: var(--shadow-elevated)`
- Title row: "Commands" in 10px uppercase, `letter-spacing: 0.1em`, `var(--text-quaternary)`
- 5 commands, each with colored icon (28px, rounded-7px), name (12.5px mono bold), description (11px tertiary):
  - `/research` — Blue (#365eff) — "Deep multi-step research with citations"
  - `/edit` — Amber (#f59e0b) — "Edit a blueprint section with AI"
  - `/compare` — Purple (#a78bfa) — "Side-by-side competitor comparison"
  - `/analyze` — Cyan (#50f8e4) — "Score and analyze any section"
  - `/visualize` — Green (#22c55e) — "Generate charts and data visuals"
- Arrow key navigation between commands, Enter to select
- Selected command: `background: var(--bg-hover)`
- When command selected: replace "/" in input with "/command " and close palette
- Escape key closes palette
- Props: `commands: SlashCommand[]`, `isOpen: boolean`, `onSelect: (cmd: string) => void`, `onClose: () => void`
- Animate with Framer Motion fadeDown variant

### Subagent C — Redesigned Message Components (worktree isolation)

**Files to modify:**
- `@src/components/chat/message-bubble.tsx` — Redesign the rendering

**Files to create:**
- `src/components/chat/thinking-block.tsx` — Collapsible reasoning display

**Specification for message-bubble.tsx redesign:**
- **User messages**: Right-aligned, `max-width: 85%`, `background: var(--bg-hover)`, `border: 1px solid var(--border-default)`, `border-radius: 14px 14px 4px 14px`, `font-size: 13.5px`, `color: var(--text-primary)`
- **AI messages**: NO bubble background. Left-aligned with 24px avatar + content column.
  - Avatar: 24px square, `border-radius: 7px`, `background: linear-gradient(135deg, var(--accent-blue), #006fff)`, centered plus/sparkle icon in white
  - Content: `font-size: 13.5px`, `line-height: 1.65`, `color: var(--text-secondary)`. Bold text uses `var(--text-primary)`
  - Gap between avatar and content: 12px
- **Streaming cursor**: `display: inline-block; width: 2px; height: 14px; background: var(--accent-blue)` with blink animation (step-end 0.8s infinite). Show at end of last text chunk while `status === 'streaming'`
- Keep existing markdown rendering (ReactMarkdown or similar) but restyle code blocks with copy button
- Preserve existing tool part rendering logic — just restyle the containers

**Specification for thinking-block.tsx:**
- Container: `border-left: 2px solid var(--border-default); padding-left: 12px; margin: 8px 0`
- Toggle button: flex row with chevron SVG (12px) + "Thinking for X.Xs" text (11.5px, tertiary)
- Chevron rotates 90deg when open
- Content: `font-size: 12.5px; line-height: 1.6; color: var(--text-tertiary); font-style: italic`
- Expand/collapse: animate `max-height` from 0 to 300px over 0.3s ease
- Default state: collapsed
- Props: `content: string`, `durationMs?: number`, `defaultOpen?: boolean`

### Subagent D — Agent Route Upgrade (worktree isolation)

**Files to modify:**
- `@src/app/api/chat/agent/route.ts` — Upgrade configuration

**Changes:**
1. Increase `maxSteps` from the current value to `10` in the `streamText()` call — find `stepCountIs` or `maxSteps` and update
2. Add slash command parsing to the system prompt — add instructions like:
   ```
   ## Slash Commands
   Users may prefix messages with slash commands. Interpret these as:
   - /research [topic] — Use the webResearch tool for deep multi-step research
   - /edit [section] — Use editBlueprint to propose changes to the specified section
   - /compare [competitors] — Search the blueprint for competitor data and present a comparison
   - /analyze [section] — Use explainBlueprint to score and analyze the specified section
   - /visualize [type] — Generate data for a visualization of the specified type
   ```
3. Add extended thinking instruction to system prompt: after the existing system prompt, add:
   ```
   ## Thinking Process
   For complex questions, think through your reasoning step-by-step before responding. When using multiple tools in sequence, explain your approach briefly before starting.
   ```
4. Do NOT change the model or provider — keep Groq Llama 3.3 70B
5. Do NOT change the existing tool definitions — keep all 4 tools as-is

### Main Agent — Integration & Verification

After all subagents complete:
1. Update `@src/components/chat/agent-chat.tsx` to use the new `ChatInput` component instead of the inline textarea
2. Update `@src/components/chat/index.ts` to export new components
3. Wire the `ThinkingBlock` into the message rendering pipeline in `agent-chat.tsx` — render it when a message has tool call parts (as a "reasoning" indicator)
4. Run `npm run build` to verify no TypeScript errors
5. Run `npm run lint` to verify linting passes
6. Run `npm run test:run` to verify existing tests still pass
7. Manually verify the layout renders correctly at `localhost:3000/generate`

## Success Criteria

- [ ] Two-column layout renders: 340px chat | flex-1 blueprint
- [ ] Chat input has glassmorphism styling with focus glow
- [ ] Slash command palette appears when "/" is typed
- [ ] AI messages render without bubble background, with avatar
- [ ] User messages render right-aligned with rounded bubble
- [ ] Thinking block is collapsible and shows duration
- [ ] Streaming cursor blinks at end of AI text while streaming
- [ ] Mode selector (Chat | Research | Edit) renders in chat header
- [ ] Agent route supports maxSteps: 10
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes
- [ ] Mobile layout stacks properly below 1024px

## Files Summary

### Create
- `src/components/layout/two-column-layout.tsx`
- `src/components/chat/chat-input.tsx`
- `src/components/chat/slash-command-palette.tsx`
- `src/components/chat/thinking-block.tsx`

### Modify
- `src/components/layout/index.ts`
- `src/app/generate/_components/blueprint-review-view.tsx`
- `src/components/chat/message-bubble.tsx`
- `src/components/chat/agent-chat.tsx`
- `src/components/chat/index.ts`
- `src/app/api/chat/agent/route.ts`
