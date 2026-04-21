# AI-GOS v2 Sprint 1 — Product Requirements Document

**Created**: 2026-02-27
**Status**: Draft
**Source**: User brain dump + AI-GOS-v2-PRD.docx + AI-GOS-v2-Design-System.docx + AI-GOS-v2-Roadmap.docx

---

## 1. Vision

Sprint 1 is the foundation for AI-GOS v2 — a conversational AI operating system that replaces the 9-step form wizard with an intelligent agent-driven journey. This sprint establishes: the Agent SDK infrastructure, the /journey page shell with adaptive layout, the design token system, core chat components, and basic streaming integration.

Everything built here is parallel to v1 — the existing /onboarding, /dashboard, and /generate routes remain untouched. We're building v2 alongside v1 in the same codebase.

The core outcome: a user can navigate to /journey, see a centered chat interface, type a message, and receive a streaming response from Opus 4.6 — all styled with the luxury command console aesthetic defined in the design system.

## 2. Core Features

### 2.1 Agent SDK Orchestrator
- Install `@anthropic-ai/claude-agent-sdk` (TypeScript)
- Create Lead Agent configuration at `src/lib/ai/lead-agent.ts`
- Model: Opus 4.6 (`claude-opus-4-6`) with adaptive thinking
- Wire up the base `query()` function with streaming
- SSE streaming endpoint at `src/app/api/journey/stream/route.ts`
- `export const maxDuration = 300` for Vercel Pro
- Prompt caching on system prompt + tool definitions

### 2.2 /journey Page Shell
- New page at `src/app/journey/page.tsx`
- Adaptive layout from Design System Section 4:
  - **Phase 1 (onboarding)**: Centered chat column, max-width ~720px, no side panel
  - **Phase 3 (review)**: Two-column layout — 440px chat panel left, blueprint panel right
  - Smooth CSS transition between layouts
- App header with step indicators (Setup → Generate → Review → Done)
  - 56px height, --bg-elevated background, --border-default bottom border
  - Logo: Instrument Sans 700, 15px, gradient text (white → #93c5fd)
  - Step indicators: 24px circle with number, active = blue fill, done = green fill + checkmark
- Basic message list with scroll-to-bottom behavior

### 2.3 Design Token Configuration
- Tailwind CSS v4 with ALL tokens from Design System Section 10:
  - Brand colors (navy, navy-light, blue, blue-hover, sky)
  - Background scale (7 levels: base, elevated, surface, hover, active, card, card-blue)
  - Text hierarchy (5 tiers: primary, secondary, tertiary, quaternary, muted)
  - Border system (subtle, default, hover, focus)
  - 6 accent colors (blue, cyan, amber, green, red, purple)
  - Shadows (card, elevated, glow-blue)
- Font families via Google Fonts:
  - DM Sans (sans) — 300, 400, 500, 600
  - Instrument Sans (display) — 400, 500, 600, 700
  - JetBrains Mono (mono) — 400, 500
- CSS variables on :root matching design system tokens
- Use existing `cn()` utility from `@/lib/utils`

### 2.4 Core Chat Components
- `src/components/journey/chat-message.tsx`
  - User bubble: right-aligned, max-width 85%, --bg-hover bg, 14px radius with bottom-right notch (14px 14px 4px 14px)
  - AI message: left-aligned with 24px gradient avatar (--accent-blue → #006fff), no bubble, --text-secondary body
- `src/components/journey/chat-input.tsx`
  - Glassmorphism input container with focus glow
  - Auto-resize textarea (max 120px)
  - Send button with blue glow
  - Fixed at bottom of chat panel with gradient fade-in
- `src/components/journey/streaming-cursor.tsx`
  - Inline block: 2px wide, 14px tall, --accent-blue
  - Blink animation: step-end 0.8s infinite
- `src/components/journey/typing-indicator.tsx`
  - 3 dots: 5px circles, bouncing animation
  - Staggered delay: 0s, 0.15s, 0.3s

### 2.5 Basic Streaming Integration
- Connect chat input to SSE endpoint
- Stream AI responses with streaming cursor
- Use `useChat` from `@ai-sdk/react` with the journey endpoint
- Messages render in real-time as they stream

## 3. User Flows

### Flow 1: First Visit to /journey
1. User navigates to /journey (must be authenticated via Clerk)
2. Centered chat layout appears with header showing "Setup" step active
3. Welcome message from AI appears (or empty state with prompt)
4. User types a message in the glassmorphism input
5. Message appears as right-aligned user bubble
6. Streaming cursor appears on left side
7. AI response streams in token-by-token
8. Streaming cursor disappears when response completes

### Flow 2: Layout Transition (future sprint, but shell must support it)
1. When journey phase changes from "onboarding" to "review"
2. Chat panel smoothly animates from centered to left-aligned (440px)
3. Blueprint panel emerges on the right

## 4. Technical Signals

- Next.js App Router (existing)
- Tailwind CSS v4 (existing, extend with new tokens)
- `@anthropic-ai/claude-agent-sdk` (NEW dependency)
- `@ai-sdk/react` useChat hook (existing)
- Clerk auth middleware (existing)
- Vercel Pro deployment with 300s maxDuration
- Model: `claude-opus-4-6` (NOT date-suffixed)
- Adaptive thinking: `thinking: { type: "adaptive" }`
- Path alias: `@/*` → `./src/*`
- kebab-case files, named exports, Props interfaces

## 5. Open Questions

- **Q1**: Agent SDK `query()` is designed for CLI usage. How to integrate it with a Next.js API route that needs SSE streaming to a browser frontend? Should we use the Agent SDK directly, or use the Vercel AI SDK's `streamText` with `@ai-sdk/anthropic` (the existing pattern)?
- **Q2**: The existing codebase uses `useChat` + `streamText` + `toUIMessageStreamResponse()`. Does the Agent SDK have a web-compatible transport, or do we need to build a bridge?
- **Q3**: Should the Lead Agent system prompt be defined inline or in a separate file?
- **Q4**: Session management — use Supabase session table or browser localStorage for Sprint 1?
- **Q5**: Should we load Google Fonts via `next/font` (recommended) or `<link>` tags in the layout?
- **Q6**: The design system defines CSS variables but Tailwind v4 uses CSS-first config (@theme). Do we put tokens in globals.css @theme directive or extend via tailwind config?

## 6. Explicit Constraints

- **Parallel build**: v1 routes (/onboarding, /dashboard, /generate) remain completely untouched
- **No forms**: The /journey page is conversation-only, no form wizard
- **Sprint 1 scope only**: No research sub-agents, no section generation, no media plan, no persistence
- **Existing patterns**: Follow CLAUDE.md conventions (kebab-case, named exports, cn() utility, etc.)
- **No new UI library**: Use existing shadcn/ui + Radix primitives + Tailwind

## 7. Success Criteria

- User can navigate to /journey and see the centered chat layout
- Header shows 4 step indicators with "Setup" active
- User can type a message and see it as a styled user bubble
- AI response streams in with the streaming cursor animation
- All design tokens are applied (colors, fonts, shadows match the design system)
- Three Google Fonts load correctly (DM Sans, Instrument Sans, JetBrains Mono)
- Layout transition CSS is wired (even if only triggered manually for now)
- `npm run build` succeeds with no new errors
- `npm run lint` passes
- Existing v1 routes are unaffected
