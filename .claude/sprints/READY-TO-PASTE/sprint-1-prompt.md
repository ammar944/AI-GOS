# Copy everything below this line and paste into Claude Code
# ─────────────────────────────────────────────────────────

Think hard about this task. You are executing Sprint 1 of a major AI chat agent upgrade for the Egoos (AI-GOS) platform.

## Step 0 — Read All Context Files

Before doing ANYTHING, read these files in this exact order. They contain the complete specification, design tokens, and architecture context you need:

1. `@CLAUDE.md` — Project conventions, commands, tech stack, architecture
2. `@.claude/sprints/ORCHESTRATION-GUIDE.md` — How to execute sprints with subagents
3. `@.claude/sprints/SPRINT-1-FOUNDATION.md` — **THIS IS YOUR SPRINT. Read every line.**
4. `@EGOOS-AGENT-UI-SPEC.md` — Complete UI/UX spec with exact design tokens, colors, spacing
5. `@EGOOS-CHAT-AGENT-V2.html` — **V2 HTML preview (Figma AI-inspired layout)** — read the CSS especially for the 340px chat panel

## Step 1 — Plan

Enter plan mode. Analyze the current codebase by reading these existing files:

- `@src/components/layout/split-chat-layout.tsx` — Current layout (being replaced)
- `@src/components/layout/index.ts` — Current exports
- `@src/components/chat/agent-chat.tsx` — Main chat component (being modified)
- `@src/components/chat/message-bubble.tsx` — Current message rendering (being redesigned)
- `@src/components/chat/index.ts` — Current chat exports
- `@src/app/api/chat/agent/route.ts` — Agent route (being upgraded)
- `@src/app/generate/_components/blueprint-review-view.tsx` — Page using the layout
- `@src/lib/motion.ts` — Animation springs/easings to reuse
- `@src/lib/utils.ts` — cn() utility to use
- `@src/components/chat/voice-input-button.tsx` — Voice button to reuse in new input
- `@src/components/chat/typing-indicator.tsx` — Current typing indicator
- `@src/app/globals.css` — Existing CSS variables and animations

Generate a plan that maps to the 4 subagent breakdown in SPRINT-1-FOUNDATION.md. Identify any risks or dependencies I should know about.

## Step 2 — Execute with Parallel Subagents

After I approve the plan, execute using **4 parallel subagents with worktree isolation**:

**Subagent A** — New Two-Column Layout (`two-column-layout.tsx`)
- Replace `split-chat-layout.tsx` pattern
- **340px** chat panel (narrower, Figma AI style) | flex-1 blueprint
- No separate chat header — cleaner, more space for messages
- Blueprint gets its own toolbar with Document|Outline|History tabs
- Section nav dots on right edge of blueprint panel
- Mobile responsive with floating button + overlay
- Use Framer Motion springs from `@src/lib/motion.ts`

**Subagent B** — Redesigned Chat Input (`chat-input.tsx` + `slash-command-palette.tsx`)
- Container with border-radius 12px, focus glow
- Auto-expanding textarea (max 100px)
- **Input toolbar BELOW textarea** (inside container): attach btn + model selector left, stop + send right
- Model selector shows "Groq 70B ↓" in mono font (like Figma AI's "Default ↓")
- Slash command palette on "/" with 5 commands
- No separate hint bar — model selector IS the hint

**Subagent C** — Redesigned Messages (`message-bubble.tsx` redesign + `thinking-block.tsx`)
- AI messages: no bubble, avatar + content
- User messages: right-aligned rounded bubble
- Streaming cursor (blue blink)
- Collapsible thinking block with duration

**Subagent D** — Agent Route Upgrade (`route.ts`)
- maxSteps: 3 → 10
- Add slash command instructions to system prompt
- Add thinking process instructions
- Keep Groq Llama 3.3 70B, keep all 4 existing tools

## Step 3 — Integration (Main Agent)

After all subagents complete:
1. Wire new `ChatInput` into `agent-chat.tsx`
2. Wire `ThinkingBlock` into message rendering
3. Update `blueprint-review-view.tsx` to use `TwoColumnLayout`
4. Update all barrel exports (`index.ts` files)

## Step 4 — Verify

Run these commands and fix any failures:
```bash
npm run build
npm run lint
npm run test:run
```

All three must pass before Sprint 1 is complete.

## Key Rules

- Use `cn()` from `@/lib/utils` for ALL className merging
- Use CSS variables from `globals.css` (NOT hardcoded hex values) — e.g., `var(--bg-surface)` not `#0c0e13`
- Use Framer Motion `springs` from `@/lib/motion` for animations
- Named exports only (not default) per CLAUDE.md conventions
- kebab-case for all new files
- Props interfaces suffixed with `Props`
- `@/*` path alias for all imports
