# Progressive Research Pipeline — Design Document

**Date:** 2026-02-28
**Component:** Battleship Sprint Component 4 (sections 4a–4c + frontend rendering)
**Branch:** aigos-v2

## Problem

The current journey agent collects all onboarding fields first, then fires a batch research pipeline (`generator.ts`) after confirmation. This creates a long wait at the end and prevents the agent from referencing real research during the conversation.

## Solution

Add a `runResearch` server-executed tool to the journey agent. The agent calls it progressively as it collects enough context for each research section, weaving findings into the ongoing conversation.

## Architecture

### Approach: Server-executed tool with inline results

The `runResearch` tool has an `execute` function that runs server-side within the Vercel AI SDK `streamText` loop. The agent calls the tool, the server runs research via Perplexity/Claude, and the result streams back as a tool output that the frontend renders as an inline card.

No background jobs, no separate SSE channels, no client-side tool orchestration.

### Dependency Chain

```
industryMarket (standalone — needs businessModel + industry)
competitors (standalone — needs industry + productDescription)
icpValidation (needs industryMarket result + icpDescription)
offerAnalysis (needs industryMarket result + productDescription + offerPricing)
crossAnalysis (needs all 4 above completed)
```

### Caching Strategy: Message History as Cache

Each `askUser` response triggers a new HTTP request, so request-scoped state (Maps, closures) is garbage collected between requests. Instead:

- The 4 standalone/dependent sections (industryMarket, competitors, icpValidation, offerAnalysis) only need onboarding context fields, which the agent provides in the tool call.
- `crossAnalysis` needs all 4 prior research outputs. By the time it fires, those outputs are sitting in the message history as tool results.
- The route handler extracts previous research results from messages before creating the tool, passing them via closure.

```
route.ts (each request):
  1. extractResearchResults(messages) → Map<section, data>
  2. createRunResearchTool({ previousResearch }) → tool with closure
  3. streamText({ tools: { askUser, runResearch } })
```

## Tool Definition

**File:** `src/lib/ai/tools/run-research.ts`

Factory function pattern — `createRunResearchTool(deps)` returns a tool instance with access to `previousResearch` via closure.

### Input Schema

```typescript
{
  section: 'industryMarket' | 'competitors' | 'icpValidation' | 'offerAnalysis' | 'crossAnalysis',
  context: {
    businessModel?: string,
    industry?: string,
    icpDescription?: string,
    productDescription?: string,
    competitors?: string,
    offerPricing?: string,
    companyName?: string,
    websiteUrl?: string,
    monthlyBudget?: string,
    geographicFocus?: string,
    salesCycleLength?: string,
    avgDealSize?: string,
  }
}
```

### Execute Logic

1. Validate required fields for the requested section → return error if missing
2. Build a context string from available fields (same format as `generator.ts`)
3. For `icpValidation`/`offerAnalysis`: retrieve `industryMarket` data from `previousResearch`
4. For `crossAnalysis`: retrieve all 4 section results from `previousResearch`
5. Route to the matching research function from `src/lib/ai/research.ts`
6. Return: `{ section, status: 'complete', data, sources, durationMs, cost }`
7. On error: `{ section, status: 'error', error: string }`

### Required Fields Per Section

| Section | Required | Optional |
|---------|----------|----------|
| industryMarket | businessModel, industry | companyName, websiteUrl |
| competitors | industry, productDescription | competitors (names), companyName |
| icpValidation | businessModel, industry, icpDescription | monthlyBudget, geographicFocus |
| offerAnalysis | productDescription, offerPricing | competitors, monthlyBudget |
| crossAnalysis | All 4 sections completed | All optional fields |

## System Prompt Changes

**File:** `src/lib/ai/prompts/lead-agent-system.ts`

**Remove** from Scope section:
> "You cannot generate reports, strategy documents, or deliverables yet — that comes after onboarding is complete."

**Add** after Completion Flow:

```
## Progressive Research

You have a tool called `runResearch` that executes real market research using
Perplexity and Claude. As soon as you have enough context for a section, run it.

### Trigger Thresholds
- After collecting businessModel + industry → run industryMarket
- After industryMarket completes + collecting competitors/productDescription → run competitors
- After industryMarket completes + collecting icpDescription → run icpValidation
- After industryMarket completes + collecting productDescription + offerPricing → run offerAnalysis
- After all 4 sections complete → run crossAnalysis

### Rules
- Run research BETWEEN questions, not after all questions
- Only run each section ONCE
- Keep conversing — ask the next question immediately after calling runResearch
- Reference research findings in follow-up questions when relevant
```

**Update** Completion Flow: when all 8 fields + all research complete → summary includes key findings.

## Route Wiring

**File:** `src/app/api/journey/stream/route.ts`

1. Import `createRunResearchTool` and `extractResearchResults`
2. Extract previous research from sanitized messages
3. Create tool with closure
4. Add to `tools` object: `{ askUser, runResearch }`
5. Bump `stopWhen: stepCountIs(20)` (from 15) to accommodate research steps

## Frontend Rendering

### ResearchInlineCard

**New file:** `src/components/journey/research-inline-card.tsx`

Three states:

**Loading:** Pulsing dot + section label + shimmer effect
**Complete:** Green check + section label + duration + 3-5 top findings + source count + expand button
**Error:** Red X + section label + error message

Design tokens: `--bg-surface`, `--border-subtle`, `--status-success`, `--status-error`, `--accent-primary`, `--radius-md`

Finding extraction via `extractTopFindings(section, data)` helper — maps each research section's data shape to 3-5 human-readable bullet points.

### Chat Message Integration

**Modify:** `src/components/journey/chat-message.tsx`

Add `runResearch` tool part rendering alongside existing `askUser` handling:
- `output-available` → `<ResearchInlineCard status="complete" />`
- `output-error` → `<ResearchInlineCard status="error" />`
- Other states → `<ResearchInlineCard status="loading" />`

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/ai/tools/run-research.ts` | CREATE | Tool factory, context builder, section routing |
| `src/components/journey/research-inline-card.tsx` | CREATE | Three-state inline card component |
| `src/app/api/journey/stream/route.ts` | MODIFY | Wire tool, extract previous research |
| `src/lib/ai/prompts/lead-agent-system.ts` | MODIFY | Add progressive research instructions |
| `src/components/journey/chat-message.tsx` | MODIFY | Render runResearch tool parts |

**Unchanged:** `research.ts`, `generator.ts`, `schemas.ts`, `providers.ts` — called as-is.

## What This Does NOT Cover

- Right panel research status sync (Component 4e — separate task)
- Inline card click-to-scroll (stretch goal)
- Session persistence of research results to Supabase (Component 5)
- Replacing the old batch generation flow (Component 5)
