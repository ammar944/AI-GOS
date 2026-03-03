# Progressive Intelligence Cards — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Research subsections appear as individual infographic cards inline in the chat thread, staggered over time, while subsequent research runs in parallel — creating a continuous intelligence briefing that materializes as the user answers onboarding questions.

**Architecture:** Client-side reveal scheduler animates completed research JSON into sequential subsection cards. Cards are rendered at the tool-result anchor point in the chat (correct timeline position), revealed with staggered CSS delays. No message injection. No right panel dependency.

**Tech Stack:** Framer Motion (stagger), React state (reveal scheduler), existing CSS variables, Lucide icons, Vercel AI SDK tool parts

---

## The Experience

User answers Q1 → Industry research fires (10s) → completes → 4 subsection cards appear in the chat, one every 1.5s, at the position where the research ran. Meanwhile conversation continues, next research fires. User sees intelligence materializing around them as they talk. No waiting. No clicking.

---

## Card Type System

Six reusable primitives cover all research subsections:

### 1. `StatCard`
For single numbers / ratings. The big number is the hero.
```
╔══════════════════════════════════════╗
║ [ICON] ICP Fit Score                ║
║                                     ║
║        8.5                          ║
║        ────  /10                    ║
║  ████████████████████░░  filled     ║
╚══════════════════════════════════════╝
```
Used for: ICP fit score, offer overall score

### 2. `VerdictCard`
For pass/fail, status assessments. Status word is the hero.
```
╔══════════════════════════════════════╗
║ [ICON] ICP Validation               ║
║  ┌─────────────────────────────┐    ║
║  │  ✓  VALIDATED               │    ║
║  └─────────────────────────────┘    ║
║  Mid-market DTC ($5M–$50M) is       ║
║  reachable on LinkedIn + Meta       ║
╚══════════════════════════════════════╝
```
Used for: ICP verdict, offer recommendation, market maturity

### 3. `ListCard`
For 2–4 bullet items. Clean, scannable.
```
╔══════════════════════════════════════╗
║ [ICON] Top Pain Points              ║
║                                     ║
║  ● Manual forecasting = 30% errors  ║
║  ● Stockouts cost 2-3x the sale    ║
║  ● No visibility before it happens ║
╚══════════════════════════════════════╝
```
Used for: pain points, buying triggers, messaging angles, next steps, ad hooks, keywords

### 4. `CompetitorCard`
One competitor per card. Name is the hero, weakness is highlighted.
```
╔══════════════════════════════════════╗
║ [ICON] Competitor                   ║
║                                     ║
║  Cogsy                              ║
║  "Smart inventory" positioning      ║
║                                     ║
║  Weakness  Known accuracy issues    ║
║  Your gap  Lead with 94% accuracy  ║
╚══════════════════════════════════════╝
```
Used for: each competitor individually

### 5. `BudgetBarCard`
Horizontal stacked bar showing platform split. The visual centerpiece of synthesis.
```
╔══════════════════════════════════════╗
║ [ICON] $15K/mo Budget Allocation    ║
║                                     ║
║  LinkedIn ████████████████  55%  $8,250 ║
║  Google   ███████           25%  $3,750 ║
║  Meta     ████              20%  $3,000 ║
╚══════════════════════════════════════╝
```
Used for: synthesis platform recommendations only

### 6. `QuoteCard`
For the positioning statement. Text is the hero.
```
╔══════════════════════════════════════╗
║ [ICON] Positioning                  ║
║                                     ║
║  "ML-powered forecasting with       ║
║   94% accuracy — for DTC brands     ║
║   between spreadsheets and a        ║
║   data science hire"                ║
╚══════════════════════════════════════╝
```
Used for: synthesis positioning statement only

---

## Reveal Sequence Per Section

Each card in the sequence below appears 1500ms after the previous one. The section's tool result anchors all cards at one point in the chat history.

### Industry & Market (fires after Q1 ~10s)
1. `VerdictCard` — Market maturity + category (GROWING / Supply Chain Tech)
2. `ListCard` — Top 3 pain points
3. `ListCard` — Top 3 buying triggers
4. `ListCard` — Top 3 messaging angles

### Competitor Analysis (fires after Q2 ~7s, simultaneous with Offer)
1. `VerdictCard` — "3 competitors found, 2 white-space gaps"
2. `CompetitorCard` — Competitor 1
3. `CompetitorCard` — Competitor 2
4. `CompetitorCard` — Competitor 3

### Offer Analysis (fires after Q2 ~7s, simultaneous with Competitors)
1. `VerdictCard` — PROCEED / NEEDS WORK + recommendation
2. `StatCard` — Overall offer score
3. `ListCard` — Strength breakdown (Clarity, Differentiation, Pricing, Social proof)

### ICP Validation (fires after Q3 ~9s)
1. `VerdictCard` — VALIDATED / CAUTION + one-line summary
2. `StatCard` — Fit score

### Strategic Synthesis (fires after Q8 ~107s)
1. `QuoteCard` — Positioning statement
2. `BudgetBarCard` — Platform budget allocation
3. `ListCard` — Top 3 ad hooks
4. `ListCard` — Next 5 steps

### Keyword Intelligence (fires after Synthesis ~12s) — NEW TOOL
1. `VerdictCard` — "47 keywords, 12 competitor gaps"
2. `ListCard` — Top 3 keyword opportunities (with volume)
3. `ListCard` — Competitor keyword gaps

---

## Card Visual Specification

**Dimensions:** 100% chat column width, auto height (~80–160px depending on content)

**Base style:**
```css
background: var(--bg-hover);           /* subtle surface */
border: 1px solid var(--border-subtle);
border-radius: 12px;
padding: 14px 16px;
```

**Section color system** (header label + icon + accent dots use the section color):
- Industry: `var(--accent-blue)`
- Competitors: `var(--accent-purple, #a855f7)`
- ICP: `var(--accent-cyan, #06b6d4)`
- Offer: `var(--accent-green, #22c55e)`
- Synthesis: `#f59e0b`
- Keywords: `#f97316` (orange — new)

**Header row** (all cards): 10px icon + 11px section label (in section color) + section icon (right-aligned, muted)

**Verdict badge style:**
```css
padding: 4px 10px;
border-radius: 6px;
font-size: 13px;
font-weight: 700;
letter-spacing: 0.03em;
/* VALIDATED: green background + text */
/* CAUTION: amber */
/* GROWING: blue */
/* PROCEED: green */
/* NEEDS WORK: red */
```

**Number hero (StatCard):**
```css
font-size: 36px;
font-weight: 700;
font-family: var(--font-heading);
color: var(--text-primary);
line-height: 1;
```

**Budget bars:**
- Height: 6px
- Border-radius: 3px
- Each segment: section accent color with opacity variations
- Label row: 11px DM Sans, right-aligned $ amount in text-secondary

**Entry animation** (Framer Motion):
```js
initial: { opacity: 0, y: 8, scale: 0.98 }
animate: { opacity: 1, y: 0, scale: 1 }
transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
```

---

## Reveal Scheduler Architecture

The reveal scheduler lives in a custom hook `useSubsectionReveal`:

```ts
// useSubsectionReveal(messages) → revealedCards[]
// When a research tool result appears in messages with status='complete',
// schedule that section's subsection cards for reveal:
//   card 0: reveal immediately (0ms delay)
//   card 1: reveal at 1500ms
//   card 2: reveal at 3000ms
//   card 3: reveal at 4500ms
//
// Uses setTimeout chains. Cards accumulate in state array.
// Each card has: { sectionKey, cardType, data, revealIndex, toolMessageId }
//
// Cards are rendered INSIDE the tool result part of the assistant message
// that triggered them — anchored to the right place in chat history.
```

This means:
- No virtual message injection
- No messages array mutation
- Cards appear at the correct historical position in the chat
- Scrolling up shows cards at the right time in the conversation

---

## New Tool: Keyword Intelligence

**File:** `src/lib/ai/tools/research/research-keywords.ts`

**Trigger:** Lead agent fires this after `synthesizeResearch` completes.

**Sub-agent:** Anthropic SDK, uses `spyFu` MCP wrapper from `src/lib/ai/tools/mcp/`

**Output schema:**
```ts
{
  totalKeywordsFound: number,
  competitorGapCount: number,
  topOpportunities: Array<{
    keyword: string,
    searchVolume: number,
    difficulty: 'low' | 'medium' | 'high',
    estimatedCpc: string,
  }>,
  competitorGaps: Array<{
    keyword: string,
    competitorName: string,
    volume: number,
  }>,
  quickWins: string[],  // 3 immediately actionable recommendations
}
```

**Lead agent system prompt addition:**
```
After synthesizeResearch completes, call researchKeywords immediately.
Pass: business context + platform recommendations from synthesis context.
This is the final research step before blueprint generation.
```

---

## P0 Prerequisite Fix

**Files:** `research-industry.ts`, `research-competitors.ts`, `research-icp.ts`, `research-offer.ts`

**Change:** Line that reads `finalMsg.content.find((b) => b.type === 'text')` must become `finalMsg.content.findLast((b) => b.type === 'text')`

**Why:** Sub-agents emit preamble as first text block, JSON as last. `.find()` grabs preamble. `.findLast()` grabs JSON. Without this fix, 4/5 sections return `{ summary: "preamble text" }` and all cards render empty.

---

## What Does NOT Change

- Lead agent route (`/api/journey/stream`) — no changes
- `askUser` tool — no changes
- System prompt triggers for research tools — no changes (already correct)
- Right panel (`ContextPanel`, `ResearchCanvas`) — untouched for now
- Supabase persistence — untouched for now

---

## Files To Create

| File | Purpose |
|------|---------|
| `src/components/journey/intel-cards/stat-card.tsx` | Big number card |
| `src/components/journey/intel-cards/verdict-card.tsx` | Status verdict card |
| `src/components/journey/intel-cards/list-card.tsx` | Bullet list card |
| `src/components/journey/intel-cards/competitor-card.tsx` | Single competitor card |
| `src/components/journey/intel-cards/budget-bar-card.tsx` | Stacked budget bar |
| `src/components/journey/intel-cards/quote-card.tsx` | Positioning quote |
| `src/components/journey/intel-cards/index.ts` | Barrel export |
| `src/hooks/use-subsection-reveal.ts` | Reveal scheduler hook |
| `src/lib/ai/tools/research/research-keywords.ts` | Keywords tool |

## Files To Modify

| File | Change |
|------|--------|
| `research-industry.ts` | `.find()` → `.findLast()` (P0 fix) |
| `research-competitors.ts` | `.find()` → `.findLast()` (P0 fix) |
| `research-icp.ts` | `.find()` → `.findLast()` (P0 fix) |
| `research-offer.ts` | `.find()` → `.findLast()` (P0 fix) |
| `src/lib/ai/tools/research/index.ts` | Export `researchKeywords` |
| `src/app/api/journey/stream/route.ts` | Register `researchKeywords` tool |
| `src/lib/ai/prompts/lead-agent-system.ts` | Add keywords trigger after synthesis |
| `src/components/journey/chat-message.tsx` | Wire subsection cards to tool result rendering |
| `src/lib/journey/session-state.ts` | Add `extractResearchSection()` helper |
