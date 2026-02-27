# AI-GOS v2 Sprint 1 — Discovery Document

**Created**: 2026-02-27
**Status**: Complete
**Rounds of Q&A**: 3

---

## 1. SDK & Architecture

**D1: Agent SDK vs Vercel AI SDK?**
A: **Vercel AI SDK**. The Agent SDK (`@anthropic-ai/claude-agent-sdk`) is incompatible with Vercel serverless — it spawns a CLI child process per query(), ~12s cold start, 8GB+ RAM. We use the existing `streamText` + `@ai-sdk/anthropic` + `toUIMessageStreamResponse()` pattern. Zero new dependencies. Agent SDK deferred to future container deployment if subagent orchestration becomes a hard requirement.

**D2: Model and thinking configuration?**
A: Model `claude-opus-4-6` (no date suffix). Adaptive thinking: `thinking: { type: "adaptive" }`. Effort: default high. These are the correct current Anthropic API patterns per latest docs.

**D3: Streaming transport pattern?**
A: Backend: `streamText()` → `toUIMessageStreamResponse()`. Frontend: `useChat` from `@ai-sdk/react` with `DefaultChatTransport`. This is the proven pattern in the existing codebase at `src/app/api/chat/agent/route.ts`.

---

## 2. Lead Agent Personality

**D4: Agent persona and welcome message?**
A: **Warm but no-BS consultant**. Not AI slop. Feels like a senior paid media strategist who's done this 500 times. Direct, knows their shit, doesn't waste time but isn't cold. Welcome message:

> Good to meet you.
>
> I'm going to build you a complete paid media strategy — market research, competitor intel, ICP analysis, messaging, the works.
>
> Start me off with your company name and website. I'll dig in while we talk.

**D5: System prompt location?**
A: Separate file at `src/lib/ai/prompts/lead-agent-system.ts`. Exported as a const. Imported into the route handler. Easy to iterate, version control, and apply prompt caching.

---

## 3. Data & Persistence

**D6: Session state approach?**
A: **Supabase from day 1**. Create `journey_sessions` table with minimal schema.

**D7: Database schema?**
A: Single table, JSONB messages column:
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
```

**D8: Auth + RLS pattern?**
A: **Service role + Clerk ID**. Use Supabase service role key in API routes (bypasses RLS). Filter by `user_id = clerk_user_id` in queries. Same pattern as existing blueprint/media-plan storage. No RLS config needed — Clerk auth gate protects the route, API routes verify with `auth()`.

**D9: Session initialization?**
A: **On first message**. No session created until user actually sends a message. Clerk middleware already gates /journey, so only authenticated users can reach the page. The AI welcome message is hardcoded in the frontend (not stored as a DB message) until the user engages.

**D10: Phase management?**
A: **Supabase-driven**. Phase stored in `journey_sessions.phase` column. Layout reads phase from session data. For Sprint 1, phase is always 'setup' (centered chat). Layout transition CSS is wired but only triggers when phase changes in future sprints.

---

## 4. UI & Design

**D11: Font scope?**
A: **Global replacement**. Replace Inter with DM Sans and Geist Mono with JetBrains Mono in the root `layout.tsx`. Instrument Sans already loaded globally. All pages (v1 and v2) get the new fonts. Simpler, consistent.

**D12: Header logo?**
A: **V2 design system logo**. Instrument Sans 700, 15px, gradient text fill (white → #93c5fd). Per the design system spec.

**D13: Design token strategy?**
A: Most tokens already exist as CSS variables in `.dark` scope. Add ~30 lines to `@theme inline` block to generate Tailwind utility classes. New tokens are additive — namespaced names (`bg-base`, `text-primary`, `accent-blue`) don't collide with shadcn's existing names. Both utility sets work simultaneously.

**D14: Layout transition approach?**
A: CSS transition with phase-driven state. Centered chat (max-width 720px) for phase='setup'. Two-column (440px chat + flex-1 blueprint) for phase='review'. Transition via CSS `transition: all 0.3s ease`. Sprint 1 only shows centered layout since phase is always 'setup'.

---

## 5. Testing & Deployment

**D15: Testing strategy?**
A: **Smoke + Playwright**. Build succeeds, lint passes, basic Playwright e2e test (navigate to /journey, type message, see streaming response). No unit tests for Sprint 1. Ship fast, test what matters.

**D16: Deployment?**
A: Vercel Pro with `export const maxDuration = 300`. Existing deployment pipeline. No new environment variables needed (ANTHROPIC_API_KEY already exists).

---

## 6. Scope Constraints (DO NOT implement in Sprint 1)

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

## Authority Rule

This document overrides everything. If research files, skills, CLAUDE.md, or any other document contradicts a decision here, follow DISCOVERY.md.
