# Agent Intelligence Redesign — Design Document

**Date:** 2026-03-03
**Branch:** aigos-v2
**Status:** Approved

---

## What We're Building

A fundamental shift in how the lead agent behaves: from passive form-filler to active intelligence engine. The agent delivers value at every step of the conversation — not just at the end.

Three structural changes:
1. **Delete the right sidebar** (context panel / ResearchCanvas)
2. **Profile card pinned top of chat** — a dossier that builds as fields are answered
3. **3-stage progressive intelligence** — value fires at 0ms, 5-10s, and 30-60s throughout the conversation

---

## What's Being Removed

### Right Sidebar (Context Panel / ResearchCanvas)

The three-tab right panel (`ContextPanel`, `ResearchCanvas`) is deleted entirely.

- `src/components/shell/context-panel.tsx` — delete
- `src/components/shell/app-shell.tsx` — remove right panel column, make chat full-width
- `src/app/journey/page.tsx` — remove all context panel props and rendering
- `journeyPhase >= 2` gating logic — remove

Rationale: The action is in the chat. Everything the user needs should appear inline.

---

## Profile Card

### Concept

A compact card pinned at the top of the chat (above the message list, scrolls with it). Starts sparse, fills in as each field is answered. Gives users a visual sense of their dossier being built.

### Behaviour

- Renders immediately on page load (not gated on any phase)
- Reads from `onboardingState` (already tracked in journey page)
- Each answered field: label + value appears with a subtle fade-in
- Unanswered required fields: show as blank placeholders (`—`)
- Progress bar at the bottom: `answeredCount / 8` required fields
- Non-intrusive — compact, collapsible, does not dominate the chat

### Fields displayed

All 8 required fields: Business Model, Industry, ICP, Product, Competitors, Pricing, Channels, Goals
Optional fields appear when collected (company name, website, budget)

### Component location

`src/components/journey/profile-card.tsx`

---

## 3-Stage Progressive Intelligence

### Stage 1 — Instant (0ms, no tools)

**Trigger:** After Q1 (businessModel) and Q2 (industry) are answered.

**What happens:** Lead agent drops a sharp market take in its response, using its own training knowledge — no tool calls, no latency. Shows the agent is already thinking about this specific situation.

Example:
> "B2B SaaS in HR Tech — you're in a competitive auction. LinkedIn CPL typically runs $150-300 for HR Directors, Q1 and Q3 are your buying cycles. Let me pull live data while we keep talking."

**System prompt change:** Add an explicit instruction to give a concise market hot-take after businessModel + industry are confirmed.

---

### Stage 2 — Fast Hits (5-10s)

**Trigger:** The moment competitor names OR a website URL appear in the conversation.

**Tools (all fire together):**

| Tool | Data | Source | Est. latency |
|------|------|--------|-------------|
| Firecrawl | Homepage value prop + pricing | Existing `betaZodTool` | ~3s |
| Ad Library | Active ad count + sample creatives | Existing `betaZodTool` | ~3s |
| SimilarWeb | Monthly visits, top traffic sources, engagement | Composio integration | ~5s |

**What the user sees:** A fast competitor card inline in chat. Example:

> "HubSpot — 4.2M monthly visits (mostly organic), 23 active Meta ads right now (pain-led hooks, 'close more deals faster'). Here's what they're running."

**Charts possible at Stage 2:** A bar chart comparing the competitor's ad activity vs. category benchmarks.

**New tool needed:** `competitorFastHits` — a lead agent tool (not a sub-agent) that calls Firecrawl + Ad Library + SimilarWeb in parallel for a given competitor/URL.

---

### Stage 3 — Full Report (30-60s)

**Trigger:** All 8 required fields collected.

**What fires (in order):**

1. All existing Opus sub-agents: `researchIndustry` → `researchCompetitors` → `researchICP` → `researchOffer`
2. `synthesizeResearch` — cross-analysis with **chart generation** at the end
3. `researchKeywords` — keyword intelligence

**Additions to existing sub-agents:**

- `researchCompetitors` sub-agent gains access to SEMrush/Ahrefs data (via Composio or direct API) for keyword gap analysis
- Claude Skills from `marketingskills` repo feed into sub-agent system prompts as domain knowledge libraries (paid-ads skill, competitor-alternatives skill, ICP skill)

**Chart generation (AntV mcp-server-chart):**

At synthesis, the sub-agent calls `generateChart` (wrapped as `betaZodTool`) to produce:

| Chart | Data |
|-------|------|
| Funnel | Likely conversion path (impressions → clicks → leads → sales) |
| Radar | Positioning score vs. top 2 competitors |
| Pie | Recommended budget allocation by channel |
| Word cloud | Top keyword themes from research |

Charts return hosted image URLs from AntV's CDN — rendered inline in the synthesis card.

**Agent mode shift:**

After `synthesizeResearch` completes, the lead agent:
- Stops collecting (no more `askUser` calls)
- Presents charts with strategic commentary
- Asks what to tackle first (channel strategy, messaging, ICP targeting, etc.)
- Becomes a strategic advisor, not an onboarding agent

**System prompt change:** Explicit instruction to shift mode after Stage 3 completes.

---

## Tool Ecosystem

Everything works together — no fallback hierarchy.

```
Stage 1: Agent training knowledge
Stage 2: Firecrawl + Ad Library (existing) + SimilarWeb (Composio new)
Stage 3: Perplexity (existing) + SpyFu (existing) + SEMrush/Ahrefs (Composio/direct new)
         + AntV Charts (new betaZodTool) + Claude Skills system prompts (new)
```

### New integrations to build

1. **SimilarWeb via Composio** — `betaZodTool` wrapper, Stage 2
2. **SEMrush or Ahrefs via Composio** — adds to `researchCompetitors` sub-agent, Stage 3
3. **AntV mcp-server-chart** — `betaZodTool` via SDK import (`@antv/mcp-server-chart/sdk`), Stage 3 synthesis
4. **`competitorFastHits` lead agent tool** — orchestrates Stage 2 tools in parallel
5. **Claude Skills prompt libraries** — extract paid-ads + ICP + competitor skills from `marketingskills` repo into sub-agent system prompts

---

## System Prompt Changes

### Lead agent (`lead-agent-system.ts`)

1. Add Stage 1 instruction: after businessModel + industry confirmed, give a concise market hot-take (1-2 sentences, no tools)
2. Add Stage 2 instruction: when competitor name or URL detected, call `competitorFastHits` before the next question
3. Update completion flow: after synthesizeResearch completes, shift mode — present charts, ask what to tackle first, no more `askUser` for onboarding

### Sub-agent system prompts

1. `researchCompetitors` — add SEMrush/Ahrefs instructions and tool access
2. `synthesizeResearch` — add chart generation instructions (call `generateChart` for funnel, radar, pie, word cloud)
3. All sub-agents — prepend relevant Claude Skill content to system prompt

---

## Files Touched

### Deleted
- `src/components/shell/context-panel.tsx`

### Modified
- `src/components/shell/app-shell.tsx` — remove right column
- `src/app/journey/page.tsx` — remove sidebar props, add ProfileCard
- `src/lib/ai/prompts/lead-agent-system.ts` — Stage 1 + 2 instructions, mode shift
- `src/lib/ai/tools/research/research-competitors.ts` — add SEMrush/Ahrefs tool
- `src/lib/ai/tools/research/synthesize-research.ts` — add chart generation

### Created
- `src/components/journey/profile-card.tsx` — dossier card component
- `src/lib/ai/tools/competitor-fast-hits.ts` — Stage 2 lead agent tool
- `src/lib/ai/tools/chart-generator.ts` — AntV betaZodTool wrapper
- `src/lib/ai/tools/composio/similarweb.ts` — SimilarWeb Composio wrapper
- `src/lib/ai/tools/composio/semrush.ts` — SEMrush/Ahrefs Composio wrapper
- `src/lib/ai/prompts/skills/` — Claude Skills extracted from marketingskills repo

---

## Non-Goals (this sprint)

- Composio account connection flow (use service-level keys for now)
- Ad creative generation via Bannerbear (future sprint)
- Self-hosting AntV chart server (Alipay CDN is fine for beta)
- Real-time streaming of sub-agent internal steps (show spinner, show result)
- Media plan pipeline wiring (Sprint 5)
