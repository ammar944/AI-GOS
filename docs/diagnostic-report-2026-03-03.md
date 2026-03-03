# AI-GOS Journey — Agent Behavior & UI Diagnostic Report

**Date:** 2026-03-03
**Branch:** `aigos-v2`
**Session:** Full onboarding → research → synthesis → blueprint
**Method:** Sequential Playwright audit with runner/reviewer subagent pairs

---

## Executive Summary

The journey agent's core intelligence is working correctly. It orchestrates tools at the right moments, extracts business context from conversation, produces high-quality strategic synthesis, and advances through the onboarding flow coherently. However, **the right panel research canvas is entirely non-functional** due to a JSON extraction failure in 4 of 5 research sub-agents — every research tab except Synthesis renders completely empty. A secondary layout displacement bug in dev mode triggers on every user click. Three context panel fields are never populated despite the data being discussed.

The agent is smart. The plumbing has holes.

---

## 1. Initial Page Architecture

### What renders on load (before any interaction)

**Left panel:**
- Heading: "AI-GOS, making growth easier."
- Subtext: "Your paid media strategy starts with a conversation."
- Chat input, placeholder: "Tell me about your business..."
- Send button disabled until text entered

**Right panel (always visible — not gated):**

| Section | Contents | Initial State |
|---|---|---|
| Progress | Onboarding 0/8, Strategic Blueprint 0/6, Media Plan 0/10 | Onboarding active (blue dot) |
| Research | Industry, Competitors, ICP, Offer, Synthesis | All dim dots |
| Context | Model, Industry, ICP, Product, Competitors, Pricing, Channels, Goals | All "Waiting..." |
| Capabilities | Research, Ad Library, Keyword Intel, SEO Audit, Pricing Scrape | Research active; rest "Coming soon" |

**Gap:** Pre-rendered welcome message ("Good to meet you. I'm going to build you a complete paid media strategy...") shows a "Thinking for 8.2s" indicator before appearing, despite the content not being a response to any user input. The thinking indicator implies computation that didn't happen.

---

## 2. Agent Tool Orchestration

### Execution timeline

All 5 research tools fired in the correct documented order. Tool dispatch was input-gated — each tool was triggered by a specific conversational signal.

| # | Tool | Trigger | Elapsed | Tab Created |
|---|------|---------|---------|-------------|
| 1 | Industry & Market Research | Q1 radio (industry vertical) | 10.0s | Industry |
| 2 | Competitor Analysis | Q2 free text (product description) | 7.0s | Competitors |
| 3 | Offer Analysis | Same Q2 trigger (simultaneous) | 6.8s | Offer |
| 4 | ICP Validation | Q3 radio (ICP archetype) | 9.4s | ICP |
| 5 | Strategic Synthesis | Q8 radio (primary goal) | 106.7s | Synthesis |

**Concurrent execution:** Tools 2 and 3 (Competitor + Offer) fired simultaneously from a single free-text submit. This is the only concurrent pair; all other tools fired sequentially. This matches documented architecture.

**Synthesis timing:** Synthesis ran after all 4 domain tools completed, as designed. 106.7s is appropriate for a cross-synthesis sub-agent consuming 4 research corpora.

### What triggers each tool

The lead agent evaluates conversational answers in real time and dispatches research tools when it has sufficient signal for a given domain. No fixed rule — the agent's judgment determines when a topic has enough data to research. Example: Competitor Analysis fired from a free-text product description, not from a structured "competitors" question.

---

## 3. Onboarding Flow Mechanics

### Question sequence and input types

| Q | Input Type | Topic | Tool Triggered |
|---|-----------|-------|----------------|
| 1 | Radio (4 options) | Industry vertical | Industry & Market Research |
| 2 | Free text | Product differentiation + pricing | Competitors + Offer (simultaneous) |
| 3 | Radio (4 options) | ICP archetype | ICP Validation |
| 4 | Radio (4 options) | Competitive knowledge | — |
| 5 | Free text | Competitor names | — |
| 6 | Checkbox multi-select + "Done" button | Paid channels | — |
| 7 | Free text | Channel performance data | — |
| 8 | Radio (4 options) | Primary goal | Strategic Synthesis |

**Input gating:** Chat input is disabled while any `askUser` control is active. This correctly prevents out-of-order responses.

**Post-synthesis checkpoint:** After synthesis, the agent presented a 3-option confirmation radio ("Looks good, let's go" / "I want to change something" / "Other") before proceeding to blueprint generation. Correct UX — synthesis is consequential and user validation prevents the pipeline from proceeding on a flawed foundation.

### Progress counter behavior

Counter advanced on research tool completions, not question answers:

```
Start: 0/8 → Q1 answer: 1/8 → Q2 answer: 2/8 → Q3 answer: 3/8 → Q4: 4/8 → Synthesis complete: 5/8
```

**Gap:** The denominator "8" implies 8 questions but the numerator increments on tool completions (5 tools). After answering all 8 questions and completing synthesis, counter reads 5/8. Semantics mismatch between label and increment logic.

---

## 4. Research Tool UI — Loading and Completed States

### Loading card
- Spinning compass/loader icon
- Tool name label
- Live elapsed timer counting up
- Tool-specific scanning phrase in DOM (e.g., "Pulling industry benchmarks...", "Synthesizing research findings...")
- **"View full analysis →" button present during loading** (not deferred until completion)

### Completed card
- Green checkmark, frozen elapsed time
- "View full analysis →" button remains

### Card variant inconsistency

| Variant | Observed On | Expand Chevron | `disabled` |
|---------|-------------|---------------|-----------|
| A | Industry, Competitors, ICP | No | `true` |
| B | Offer Analysis, Synthesis | Yes | `false` |

No clear predicate explains the split. All tools complete successfully; the difference appears to be a conditional in the card component evaluating something that differs between these tools.

---

## 5. Context Panel — Field Population

Fields populate from structured `askUser` responses (radio/checkbox), not from free-text answers or research tool outputs.

| Field | Value Populated | Source |
|-------|----------------|--------|
| Industry | "Supply Chain / Logistics Tech" | Q1 radio |
| ICP | "Mid-market DTC brands ($5M-$50M revenue)" | Q3 radio |
| Competitors | "I can name my top 2-3" | Q4 radio |
| Channels | "Meta (Facebook/Instagram), LinkedIn Ads" | Q6 checkbox |
| Goals | "Generate more qualified leads" | Q8 radio |
| Model | "Waiting..." | Never written |
| Product | "Waiting..." | Never written |
| Pricing | "Waiting..." | Never written |

**Gap:** User stated "$499/month subscription" in their first message. Agent confirmed it ("I've got your business model, pricing structure, and company name noted") and used $499/mo throughout the session — but `offerPricing`, `productDescription`, and `businessModel` keys in `onboardingState` remain `null`. The context panel never reflects this data.

---

## 6. Post-Synthesis Blueprint Generation

Selecting "Looks good, let's go" triggered immediate blueprint generation from the lead agent (no new sub-agents fired). The agent delivered a full strategic output:

- **Positioning statement** centered on 94% accuracy claim
- **Budget reallocation** across 3 channels: LinkedIn 55% ($8,250), Google Search 25% ($3,750), Meta retargeting 20% ($3,000)
- **4 lead messaging angles** with specific copy direction
- **6 critical next steps** with timelines (5–14 days each)

Google Search was recommended as a net-new channel (the user never mentioned it) — the agent applied strategic judgment from research rather than simply reflecting user inputs back. This is the intended behavior.

**Post-blueprint:** Agent asked "Want me to go deeper on any specific piece...?" — chat input re-enabled, session continues as open-ended Q&A.

**Progress after blueprint:** Onboarding → green checkmark "Done" | Strategic Blueprint → blue spinner, 0/6 | Media Plan → gray, 0/10.

---

## 7. Bugs

---

### Bug 1 — CRITICAL: Research tabs render empty (4/5 tabs)

**Symptom:** Industry, Competitors, ICP, and Offer tabs all show completely empty canvas. Only Synthesis tab renders content.

**Root cause — sub-agent JSON extraction failure:**

Each research tool's `execute()` calls a sub-agent via `client.beta.messages.stream()` and then calls `.finalMessage()`. The sub-agents begin their stream with a preamble sentence ("I'll research the supply chain/logistics tech market...") and then emit tool calls and JSON. However, `.finalMessage()` captures the model's **last text content block**, which for these 4 sub-agents is the opening preamble — not the JSON output.

`extractJson` in each tool has 3 strategies:
1. Direct `JSON.parse` → fails (preamble is not valid JSON)
2. Fenced code block extraction → fails (model doesn't use fences)
3. First `{` to last `}` extraction → fails (no `{` in preamble text)

All 3 strategies fail → fallback fires: `data = { summary: rawPreambleText }`

**What each section receives:**

| Section | Keys in `data` | `data.summary` |
|---------|---------------|----------------|
| industryMarket | `["summary"]` | "I'll research the supply chain/logistics tech market..." |
| competitors | `["summary"]` | "I'll research the competitive landscape..." |
| icpValidation | `["summary"]` | "I'll conduct a thorough validation of this ICP..." |
| offerAnalysis | `["summary"]` | "I'll research the market thoroughly before scoring..." |
| crossAnalysis | All 7 expected keys | ✅ Correct JSON |

**Why Synthesis works:** The synthesis sub-agent emits JSON as its final text block. `extractJson` strategy 3 succeeds.

**Root cause — canvas component receives wrong shape:**

`IndustryContent` in `src/components/shell/research-canvas.tsx` (lines 207–252) expects keys like `categorySnapshot`, `painPoints`, `marketTrends`, `messagingOpportunities`. Receives `{ summary: "preamble text" }`. Every conditional renders false:

```tsx
const snap = get<Record<string, unknown>>(data, 'categorySnapshot');  // → undefined
const trends = arr(get(data, 'marketTrends')).map(str).filter(Boolean); // → []
// All {snap && ...}, {trends.length > 0 && ...} blocks: false
// Resulting DOM: <div style="display:flex;flex-direction:column;gap:20px"></div>
// Height: 0, zero children
```

**Files involved:**
- `src/lib/ai/tools/research/research-industry.ts` — extractJson fallback
- `src/lib/ai/tools/research/research-competitors.ts` — same pattern
- `src/lib/ai/tools/research/research-icp.ts` — same pattern
- `src/lib/ai/tools/research/research-offer.ts` — same pattern
- `src/components/shell/research-canvas.tsx` — canvas receives wrong data shape

**Server-side evidence:** `console.error('[researchIndustry] JSON extraction failed...')` fires for all 4 tools (visible in server terminal, not browser console).

**Fix direction:** The sub-agent prompt needs to instruct the model to output JSON as a standalone final message block, or `extractJson` needs a 4th strategy to find JSON anywhere in the full streamed output, not just the final text block.

---

### Bug 2 — MODERATE: `activeSectionKey` arrives as string `"null"` not `null`

**Symptom:** "View full analysis →" click may not correctly activate the right panel section.

**Root cause:** In `src/app/journey/page.tsx`, `activeSectionKey` is passed to `ContextPanel` as the string `"null"` instead of JavaScript `null`. Any comparison `activeSectionKey === null` returns `false`. The panel section activation logic likely never fires correctly.

**Effect:** "View full analysis →" triggers a Fast Refresh rebuild (141ms) but the right panel does not navigate to the relevant section. Even if the canvas bug (Bug 1) were fixed, the "View full analysis" button would still not work.

---

### Bug 3 — MODERATE: Layout displacement on every interactive click (dev mode)

**Symptom:** Each user click on an interactive element (radio, "Done" button, "View full analysis →", tab button) triggers a Next.js Fast Refresh rebuild. Each rebuild shifts the entire app layout ~800px above the viewport. The `overflow: hidden` app shell clips all content — viewport goes dark/blank. Recovery requires `window.scrollTo(0,0)`.

**Observed rebuild times:** 141ms, 124ms, 206ms, 132ms, 186ms, 144ms (6 events in session).

**Root cause:** A click handler writes to page-level state in `src/app/journey/page.tsx`, triggering a full page component remount rather than a scoped re-render. In development, React's remount causes Fast Refresh. On remount, the scroll container loses its position; with `overflow: hidden` + fixed height, browser scroll restoration places content outside the clipped viewport.

**Production note:** Fast Refresh doesn't run in production, but the underlying remount behavior (and resulting scroll position loss) may persist. This needs verification in a production build.

---

### Bug 4 — LOW: Model, Product, Pricing context fields never populated

**Symptom:** `businessModel`, `productDescription`, `offerPricing` remain `null` in `onboardingState` throughout the entire session. Context panel shows "Waiting..." for Model, Product, and Pricing.

**Data collected but not stored:** User stated "$499/month" in first message; agent used this throughout (budget math, CAC analysis, etc.) but never wrote it to state. Q2 free text collected product differentiation details — also not stored.

**Likely cause:** Context panel field mapping only handles discrete structured values from radio/checkbox `askUser` results. Free-text answers are not parsed into context fields.

---

## 8. Network Audit

| Endpoint | Method | Calls | Status | Purpose |
|----------|--------|-------|--------|---------|
| `/api/journey/stream` | POST | 9 | 200 | Lead agent streaming — one call per user message |
| `/__nextjs_original-stack-frames` | POST | 2 | 200 | Dev error stack resolution |
| Clerk auth endpoints | Various | ~80 | 200 | Session management, token refresh |

**`/api/journey/stream` breakdown (9 calls):**
1. Initial welcome message
2. Radio answer: industry vertical → triggers Industry tool
3. Free text: product description → triggers Competitor + Offer tools
4. Radio answer: ICP archetype → triggers ICP tool
5. Radio answer: competitive knowledge level
6. Free text: competitor names
7. Checkbox answer: channels
8. Free text: channel performance data
9. Radio answer: primary goal → triggers Synthesis tool
   _(Implicit 10th call for "Looks good" → blueprint generation)_

**Streaming:** All responses were chunked SSE streams. Research tool calls are handled server-side within the stream — no separate browser-initiated API calls for sub-agent execution.

**Supabase:** No Supabase calls visible in browser network (server-side only). `journey_sessions.research_output` persistence confirmed to be working from prior sessions.

**Missing routes:** `/api/strategic-blueprint/generate` and `/api/media-plan/generate` were not called — those pipelines are not yet wired into the journey flow (Sprint 5 scope).

---

## 9. Console Health

| Category | Count | Notes |
|----------|-------|-------|
| Errors | 2 | Next.js async `params`/`searchParams` warnings — pre-existing, non-blocking |
| Warnings | 4 | Clerk dev key warnings + 1 deprecated prop — environment-level, non-critical |
| Fast Refresh | 6 | Each triggered by user click on interactive element |
| Network errors | 0 | Clean |

No application-level errors. The 2 Next.js errors are pre-existing and unrelated to the journey flow.

---

## 10. AI Agent Performance Assessment

| Dimension | Assessment |
|-----------|-----------|
| **Thinking quality** | Strong. 10.7s adaptive thinking produced accurate business context extraction on first message. |
| **Tool orchestration** | Correct. Tools fire at the right moments from the right conversational signals. Concurrent dispatch for Competitor+Offer is working. |
| **Onboarding intent** | High. Agent correctly identified B2B SaaS, extracted pricing, product positioning, competitive dynamics, and channel performance from free-form conversation. |
| **Synthesis quality** | Excellent. Cross-domain synthesis identified non-obvious recommendations (net-new Google Search channel, Meta repositioning), used specific data points (94% accuracy), and produced internally consistent budget math. |
| **Data persistence** | Partial. 5/8 context fields populated; 3 fields (Model, Product, Pricing) never written despite agent verbally confirming them. |
| **Right panel integration** | Broken. Research data reaches the server and is synthesized correctly, but 4/5 canvas sections render empty due to JSON extraction failure. The agent's work is invisible to the user in the right panel. |
| **Post-synthesis flow** | Correct. Confirmation checkpoint before blueprint generation. Blueprint output is detailed and strategic. |

---

## 11. Priority Fix List

| Priority | Bug | File(s) | Fix Direction |
|----------|-----|---------|---------------|
| P0 | Research tabs empty (4/5) | `research-industry/competitors/icp/offer.ts` | Fix sub-agent prompt to output JSON as final block, OR fix `extractJson` to scan full stream output not just `finalMessage()` text block |
| P1 | `activeSectionKey` string null | `src/app/journey/page.tsx` | Pass `null` (JS) not `"null"` (string) |
| P1 | Layout displacement on click | `src/app/journey/page.tsx` | Move `activeSectionKey` state to scoped component, not page-level, to avoid full remount on click |
| P2 | Model/Product/Pricing fields empty | Lead agent + `onboardingState` handlers | Parse free-text Q2 answer into `productDescription` + `offerPricing` fields |
| P3 | Progress counter semantics | Progress component | Counter denominator should match what it counts (tools = 5, questions = 8) |
| P3 | Card variant inconsistency | `research-canvas.tsx` or inline card component | Audit the conditional controlling expand chevron + `disabled` prop |

---

*Report generated from sequential Playwright diagnostic audit, 2026-03-03.*
*Phases: Initial Load → First Message → Tool Firing → Research Pipeline → Post-Synthesis → Network Audit*
