# EGOS V2 — Product Requirements Document

**Product**: EGOS (AI-GOS) — AI-Powered Go-to-Market Operations System
**Company**: SaasLaunch
**Version**: 2.0 (The Pivot)
**Author**: Ammar (Founder) + Claude (Co-author)
**Date**: March 7, 2026
**Status**: Draft — Pending Alignment Review

---

## 1. Executive Summary

EGOS V2 is a ground-up architectural rebuild of SaasLaunch's AI-powered GTM strategy platform. The product generates comprehensive marketing strategy blueprints and media plans through conversational AI, backed by real-time data from production APIs — not hallucinated training knowledge.

The V1 architecture (form-based UI, Railway background worker, Supabase polling) is being replaced with a streaming-first design built on Anthropic's Messages API with Skills beta, Code Execution, and custom tools. The core value proposition remains: "Manus, but for media buying" — a system where specialized sub-agents with real internet-connected tools build marketing strategy in front of the user, live.

**What changed in the pivot (March 6–7, 2026)**:

- Railway worker architecture killed entirely
- Replaced with Anthropic Messages API streaming + specialized sub-agents
- Each research section gets its own agent with real API tools
- Output streams directly into the chat — user watches it being built
- Skills give agents domain expertise via community + custom SKILL.md packages
- Custom tools give agents internet access (Perplexity, Firecrawl, SpyFu, SearchAPI, PageSpeed)

**Target cost per full journey**: $3–5 including all API calls.

---

## 2. Problem Statement

### 2.1 What V1 Got Wrong

V1 suffered from five critical failures that made the product unusable at scale:

**Hallucinated data**. The "hot take" feature used Claude's training knowledge to fabricate market data — market sizes, growth rates, competitor metrics — that looked plausible but couldn't be sourced. For a product selling data-backed strategy, this was a credibility-destroying flaw.

**Form-based UX**. Users filled out a static form with 8 shallow fields instead of having a conversation. There was no opportunity for the AI to probe deeper, adapt questions based on context, or build rapport. The onboarding felt like a survey, not a strategy session.

**Background processing black hole**. After form submission, a Railway worker dispatched research jobs that polled Supabase for completion. Users saw "Research is taking longer than expected" with no visibility into what was happening. The worker timed out frequently, leaving sessions in broken states.

**Shallow data collection**. Only 8 fields were collected — not enough to generate meaningful, differentiated strategy. The system couldn't distinguish between a bootstrapped B2B SaaS and a VC-funded consumer marketplace.

**Brittle infrastructure**. The Railway worker + Supabase Realtime + dispatch/poll pattern created a fragile chain where any link failing meant the entire research pipeline stalled silently.

### 2.2 What V2 Must Solve

V2 must deliver on four promises:

1. **Zero hallucination** — every data point traced to a tool response from a real API
2. **Conversational depth** — staged onboarding that adapts to the user's business
3. **Streaming transparency** — research appears in real-time, never a black box
4. **Architectural simplicity** — single flat agentic loop, no orchestration framework, serverless-compatible

---

## 3. Target Users

### 3.1 Primary: SaaS Founders & Marketing Leads (Seed to Series A)

Teams of 1–15 people who need a GTM strategy but can't afford a $15K/month agency or a full-time strategist. They have a product, some early traction, and ad budget they're not sure how to allocate. They've tried Jasper, Copy.ai, or ChatGPT for marketing help but got generic advice disconnected from their actual market data.

**Key behaviors**: They Google competitor ad strategies manually. They guess at keyword CPCs. They build media plans in spreadsheets using gut feel. They want data-backed confidence, not AI-generated platitudes.

### 3.2 Secondary: Freelance Growth Consultants

Independent consultants who serve 3–10 SaaS clients and need to produce strategy deliverables fast. EGOS replaces 15–20 hours of manual research per client with a 30-minute AI-assisted session that produces a branded PDF they can present.

### 3.3 Anti-Personas

Not for enterprise marketing teams with existing BI stacks. Not for e-commerce (DTC, Shopify) — the ICP, keyword, and media plan logic is SaaS-specific. Not for users who want content generation (that's Jasper's lane).

---

## 4. Competitive Landscape

### 4.1 Direct Competitors

No one is doing exactly this. The closest comparisons:

**Jasper AI** — content generation platform. Produces copy, not strategy. No real-time market data, no competitor intelligence, no media plans. Competes on volume of output, not depth of insight.

**Copy.ai** — workflow automation for marketing teams. Has "workflows" but they're template-driven content pipelines, not research-backed strategy generation. No API-sourced data.

**Manus** — the spiritual predecessor. General-purpose agentic AI that can browse the web and execute tasks. EGOS is "Manus for media buying" — domain-specific, with purpose-built tools and structured output.

### 4.2 Indirect Competitors

**Generic ChatGPT/Claude usage** — marketers already use LLMs for strategy brainstorming. The problem: hallucinated data, no structured output, no tool access, no media plan math. EGOS wraps the same models with real tools and domain expertise.

**SEMrush / SpyFu / SimilarWeb** — data platforms, not strategy generators. They give you the raw data; you still have to synthesize it into a plan. EGOS consumes their APIs and does the synthesis.

### 4.3 EGOS Moat

The moat is the combination of real API data + Skills system + structured multi-agent output. Competitors would need to replicate the tool integrations (Perplexity, SpyFu, Firecrawl, Ad Library), the domain-specific Skills packages, and the streaming sub-agent architecture. None of the current players are building this way.

---

## 5. User Flow — End to End

### 5.1 Flow Diagram

```
[Enter URL] → [Site Scrape + Extraction] → [Staged Onboarding: 4 phases, ~11 fields]
                                                    │
                                          Phase 2 triggers ──→ Industry Research
                                          Phase 3 triggers ──→ Competitor Intel + ICP Validation
                                          Phase 4 triggers ──→ Offer Analysis → Strategic Synthesis
                                                                → Keyword Intel → Media Plan
                                                    │
                                          [Sections stream into chat as they complete]
                                                    │
                                          [Complete Blueprint → Review → Export PDF]
```

### 5.2 Step 1: Enter URL

User enters their company website URL. This is the only hard requirement to begin. The URL serves as the seed for all downstream scraping and research.

**Acceptance criteria**:
- URL input field with validation (must be a reachable domain)
- Support for URLs with or without protocol prefix
- Error state for unreachable domains with retry option

### 5.3 Step 2: Site Scrape

The `scrapeClientSite` tool fires automatically. Under the hood:

1. **Firecrawl** scrapes the target URL (and optionally 2–3 subpages: pricing, about, features)
2. **Claude Haiku 4.5** extracts structured data from the scraped content:
   - Company name
   - Business model (SaaS, marketplace, PLG, sales-led, hybrid)
   - Product description (what they sell, to whom)
   - Pricing tiers (free, starter, pro, enterprise — with prices if visible)
   - Target audience signals (language on the site suggesting who they serve)
   - Existing marketing channels (social links, blog presence, ad pixels)

3. **Lead agent presents findings**: "I found [company name]. It looks like you're a [business model] company offering [product]. Your pricing starts at [X]. Let me confirm a few things..."

**Performance target**: Site scrape + extraction completes in under 35 seconds.

**Proven results**: Linear.app (zero hallucination, real pricing, 20K+ teams extracted), Notion.so (100M+ users, PLG model correctly identified), Calendly.com (full pipeline completed including 52 competitor ads found).

### 5.4 Step 3: Staged Onboarding

The lead agent (Claude Opus 4.6) collects approximately 11 fields across 4 phases using `askUser` chip-based selection. The phased approach serves two purposes: progressive disclosure (don't overwhelm the user) and incremental triggering (research sections begin before all fields are collected).

**Phase 1 — Discovery (3 fields)**:

| Field | Type | Purpose |
|---|---|---|
| `websiteUrl` | URL | Seed for scraping and research |
| `companyName` | String | Confirmed or corrected from scrape |
| `businessModel` | Enum chip | SaaS, Marketplace, PLG, Sales-Led, Hybrid |

No sections triggered. This phase confirms the scrape results.

**Phase 2 — ICP + Product (3 fields)**:

| Field | Type | Purpose |
|---|---|---|
| `primaryIcpDescription` | Text | Who the ideal customer is — role, company size, pain points |
| `productDescription` | Text | What they sell, confirmed/expanded from scrape |
| `pricingTiers` | Structured | Tier names, prices, feature highlights |

**Triggers**: Industry & Market Research section begins.

**Phase 3 — Competition (2 fields)**:

| Field | Type | Purpose |
|---|---|---|
| `topCompetitors` | List (3–5) | Named competitors the user considers direct threats |
| `competitiveAdvantage` | Text | What makes them different — the "why us" |

**Triggers**: Competitor Intelligence + ICP Validation sections begin (can run in parallel).

**Phase 4 — Budget & Goals (3 fields)**:

| Field | Type | Purpose |
|---|---|---|
| `monthlyAdBudget` | Currency | Monthly paid media budget in USD |
| `goals` | Multi-chip | Awareness, Leads, Revenue, Retention, Launch |
| `activeChannels` | Multi-chip | Google Ads, Meta, LinkedIn, TikTok, etc. |

**Triggers**: Offer Analysis → Strategic Synthesis → Keyword Intelligence → Media Plan (sequential chain).

### 5.5 Step 4: Sections Stream Into Chat

As sections unlock based on field triggers and dependency resolution, sub-agents generate them and stream output live into the chat. The user sees research appearing in real-time with rich UI cards (see Section 8 for card specifications).

Sections that don't depend on each other run in parallel. For example, after Phase 3 completes, Competitor Intelligence and ICP Validation both begin simultaneously.

### 5.6 Step 5: Complete Blueprint

All 7 sections delivered. The user can review each section inline, see source citations for every data point, and export the complete blueprint as a branded PDF.

**Post-completion actions**:
- Review individual sections (expand/collapse)
- Export as branded PDF (Anthropic's built-in PDF generation)
- Start a new journey (reset state, fresh conversation)
- Share via link (future — V2.1)

---

## 6. The 7 Research Sections — Detailed Specifications

### 6.1 Section Dependency Graph

```
Phase 2 triggers:
  └── [1] Industry & Market Research (no deps)

Phase 3 triggers:
  ├── [2] Competitor Intelligence (no deps)
  └── [3] ICP Validation (no deps)

Phase 4 triggers:
  └── [4] Offer Analysis (depends on: #2 Competitor Intel)
        └── [5] Strategic Synthesis (depends on: #1, #2, #3, #4)
              ├── [6] Keyword Intelligence (depends on: #5)
              └── [7] Media Plan (depends on: #5, #6, + monthlyAdBudget)
```

Sections 1, 2, and 3 can run in parallel once their triggering phases complete. Section 4 waits for Section 2. Section 5 waits for all of 1–4. Sections 6 and 7 are sequential after Section 5, with Section 7 also waiting for Section 6.

### 6.2 Section 1: Industry & Market Research

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Sonnet 4.5 |
| **Skill Source** | Hybrid — community marketing research skill + custom prompts |
| **Tools** | `search_market_data` (Perplexity sonar-pro), `scrape_website` (Firecrawl) |
| **Dependencies** | None |
| **Trigger** | Phase 2 complete |
| **Estimated Cost** | ~$0.50–1.00 |
| **Target Duration** | 45–90 seconds |

**Required output fields**:
- Total addressable market (TAM) with source
- Market growth rate (CAGR) with source
- Key industry pain points (top 5, data-backed)
- Buyer behavior patterns (how they discover, evaluate, purchase)
- Seasonal patterns and timing windows
- Regulatory or compliance considerations (if applicable)
- Market maturity assessment (emerging, growth, mature, declining)

**Tool usage pattern**: Agent makes 2–4 Perplexity calls with progressively specific queries (broad market → specific segment → buyer behavior → trends). May scrape 1–2 industry report pages via Firecrawl for additional depth.

### 6.3 Section 2: Competitor Intelligence

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Sonnet 4.5 |
| **Skill Source** | Hybrid — community competitive analysis skill + custom prompts |
| **Tools** | `scrape_website` (Firecrawl), `search_competitor_ads` (SearchAPI), `get_keyword_data` (SpyFu), `check_page_speed` (Google PageSpeed) |
| **Dependencies** | None |
| **Trigger** | Phase 3 complete |
| **Estimated Cost** | ~$0.75–1.50 (heaviest tool usage) |
| **Target Duration** | 60–120 seconds |

**Required output per competitor** (3–5 competitors):
- Positioning statement (extracted from their site, not generated)
- Pricing model and tiers (scraped)
- Active ad campaigns (from Ad Library via SearchAPI — ad count, creative themes, platforms)
- Top organic keywords (from SpyFu — keyword, volume, position, CPC)
- Top paid keywords (from SpyFu — keyword, estimated spend, position)
- PageSpeed score (mobile + desktop)
- Identified weaknesses and gaps

**Tool usage pattern**: For each competitor — scrape their site → pull ad data → pull keyword data → check page speed. All competitors can be processed in sequence within a single agentic loop.

### 6.4 Section 3: ICP Validation

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Sonnet 4.5 |
| **Skill Source** | Hybrid — community audience research skill + custom prompts |
| **Tools** | `search_market_data` (Perplexity), `scrape_website` (Firecrawl) |
| **Dependencies** | None |
| **Trigger** | Phase 3 complete |
| **Estimated Cost** | ~$0.50–0.75 |
| **Target Duration** | 30–60 seconds |

**Required output fields**:
- Validated ICP persona (title, company size, industry, seniority)
- Audience sizing estimate with methodology
- Channel preferences (where this ICP spends time online — data-backed)
- Trigger events (what causes them to start looking for a solution)
- Decision-making process (solo, committee, champion model)
- Objection patterns (common reasons they don't buy)
- ICP confidence score (how well-supported the profile is by data)

### 6.5 Section 4: Offer Analysis

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Haiku 4.5 (lighter analysis) |
| **Skill Source** | Custom prompts (no heavy domain skill needed) |
| **Tools** | `search_market_data` (Perplexity) |
| **Dependencies** | Section 2 (Competitor Intel — needs pricing data) |
| **Trigger** | Section 2 complete + Phase 4 complete |
| **Estimated Cost** | ~$0.05 |
| **Target Duration** | 15–30 seconds |

**Required output fields**:
- Offer scorecard (pricing position vs. competitors — premium, mid-market, budget)
- Value-to-price ratio assessment
- Free tier / freemium analysis (if applicable)
- Upsell/cross-sell opportunity identification
- Pricing recommendations (based on competitor data + market positioning)
- Offer messaging recommendations (what to emphasize at each tier)

### 6.6 Section 5: Strategic Synthesis

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Opus 4.6 (deep reasoning required) |
| **Skill Source** | Custom prompts (synthesis requires judgment, not domain data) |
| **Tools** | None — consumes Sections 1–4 as input context |
| **Dependencies** | Sections 1, 2, 3, and 4 (all must be complete) |
| **Trigger** | All of Sections 1–4 complete |
| **Estimated Cost** | ~$1.00–2.00 |
| **Target Duration** | 30–60 seconds |

**Required output fields**:
- Strategy brief (2–3 paragraph executive summary)
- SWOT analysis (grounded in section data, not generic)
- Priority matrix (what to do first, second, third — with rationale)
- Key strategic themes (3–5 themes that unify the GTM approach)
- Risk factors and mitigation strategies
- Quick wins (things that can be done in the first 2 weeks)
- 90-day strategic roadmap (high-level phases)

### 6.7 Section 6: Keyword Intelligence

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Sonnet 4.5 |
| **Skill Source** | Hybrid — community SEO/PPC skill + custom prompts |
| **Tools** | `get_keyword_data` (SpyFu), `search_market_data` (Perplexity) |
| **Dependencies** | Section 5 (Strategic Synthesis — needs priority themes) |
| **Trigger** | Section 5 complete |
| **Estimated Cost** | ~$0.50–0.75 |
| **Target Duration** | 30–60 seconds |

**Required output fields**:
- Keyword opportunity matrix (keyword, volume, CPC, competition, intent)
- Keyword gaps (keywords competitors rank for that client doesn't)
- Intent mapping (awareness, consideration, decision keywords)
- Long-tail opportunities (lower volume, higher conversion probability)
- Negative keyword recommendations
- Estimated traffic potential at various budget levels

### 6.8 Section 7: Media Plan

| Attribute | Value |
|---|---|
| **Agent Model** | Claude Sonnet 4.5 |
| **Skill Source** | Hybrid — community media planning skill + custom prompts |
| **Tools** | `search_market_data` (Perplexity) |
| **Dependencies** | Section 5 (Strategic Synthesis) + Section 6 (Keyword Intel) + `monthlyAdBudget` field |
| **Trigger** | Sections 5 and 6 complete |
| **Estimated Cost** | ~$0.50–0.75 |
| **Target Duration** | 30–60 seconds |

**Required output fields**:
- Channel allocation (percentage of budget per channel with rationale)
- Campaign structures (per channel — campaign, ad group, targeting logic)
- Budget split table (monthly, by channel, by campaign type)
- Timeline (what launches when, ramp-up schedule)
- KPI targets per channel (CTR, CPC, CPA, ROAS benchmarks)
- Testing plan (A/B test priorities, creative rotation schedule)
- Scaling triggers (metrics that indicate when to increase spend)

---

## 7. Technical Architecture

### 7.1 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui | App shell, chat UI, research cards |
| Streaming | Vercel AI SDK (`createUIMessageStream`, `writer.merge()`) | SSE streaming from server to client |
| AI Orchestration | Anthropic SDK (Messages API, Skills beta, Code Execution) | Agent conversations, tool use, skills |
| Auth | Clerk | User authentication, session management |
| Database | Supabase (PostgreSQL) | Session persistence, user data, research history |
| Deployment | Vercel (serverless) | Hosting, edge functions, zero-config scaling |
| Site Scraping | Firecrawl API | Website content extraction |
| Market Research | Perplexity API (sonar-pro) | Real-time search-grounded answers |
| Ad Intelligence | SearchAPI (Google Ads Transparency) | Competitor ad creative and spend data |
| Keyword Data | SpyFu API | Keyword rankings, CPCs, competitive keywords |
| Page Performance | Google PageSpeed Insights API | Site speed scoring (free, no key) |

### 7.2 Skills Architecture (Anthropic Beta)

Skills are domain expertise packages uploaded via the Anthropic Skills API. Each skill is a SKILL.md file that contains research methodology, output format templates, and domain-specific instructions.

**Hybrid strategy (decided March 7, 2026)**:
- Use community-published Skills from GitHub where high-quality packages exist (marketing research, competitive analysis, SEO/PPC, audience research, media planning)
- Build custom SKILL.md files only where no good public option exists or where EGOS-specific output formatting is required
- All skills are uploaded once, cached by `skill_id`, and referenced in `container.skills`

**Skill loading is progressive**: the model loads only the skill relevant to the current section agent. This keeps context windows lean and costs predictable.

**Open question**: Skill discovery pipeline — how do we evaluate, test, and pin specific versions of community skills? See Section 13 (Open Questions).

### 7.3 Custom Tools (5 API Wrappers)

These are standard Anthropic `tool_use` definitions. Our backend executes them when Claude requests them during the agentic loop. They are NOT code execution sandbox tools — they run on our server with internet access.

**Tool 1: `search_market_data`**

```
Backend: Perplexity API (sonar-pro model)
Input: { query: string, focus?: "market_size" | "trends" | "audience" | "general" }
Output: { answer: string, citations: string[] }
Rate limit: ~100 req/min (Perplexity plan dependent)
Cost: ~$0.05 per query
```

**Tool 2: `scrape_website`**

```
Backend: Firecrawl API
Input: { url: string, extractFields?: string[] }
Output: { content: string, metadata: { title, description, links } }
Rate limit: Plan dependent
Cost: ~$0.01 per scrape
```

**Tool 3: `search_competitor_ads`**

```
Backend: SearchAPI (Google Ads Transparency endpoint)
Input: { advertiserName: string, country?: string, dateRange?: string }
Output: { totalAds: number, ads: Array<{ title, description, platform, dateFirstSeen }> }
Rate limit: Plan dependent
Cost: Per plan
```

**Tool 4: `get_keyword_data`**

```
Backend: SpyFu API
Input: { domain: string, type: "organic" | "paid" | "both" }
Output: { keywords: Array<{ keyword, volume, cpc, position, competition }> }
Rate limit: Plan dependent
Cost: Per plan
```

**Tool 5: `check_page_speed`**

```
Backend: Google PageSpeed Insights API
Input: { url: string, strategy: "mobile" | "desktop" }
Output: { score: number, metrics: { fcp, lcp, cls, tbt, si } }
Rate limit: 25 req/100 seconds (free tier)
Cost: Free
```

### 7.4 Tool Result Reminders

After EVERY tool response returned to the model, the system appends:

```
[SYSTEM: Only use data from this tool response. Do not supplement
with training knowledge. If data is insufficient, say so explicitly.]
```

This is a critical anti-hallucination measure. System-prompt-only instructions degrade over long conversations. Tool result reminders are injected at the point of maximum relevance — immediately after the model receives data — and have been proven effective in production agents (Claude Code, Manus).

### 7.5 Agentic Loop Design

The core execution model is a **single flat loop** with no orchestration framework, no DAG engine, no queue system:

```
function runSectionAgent(sectionId, config, context) {
  let messages = buildInitialMessages(config, context)

  while (true) {
    const response = await client.beta.messages.create({
      model: config.model,
      messages,
      tools: config.tools,
      skills: config.skills,
      max_tokens: config.maxTokens,
    })

    // Process response blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        // Stream text to frontend via writer
        writer.write({ type: 'data-research-chunk', data: { sectionId, text: block.text }, transient: true })
      }
      if (block.type === 'tool_use') {
        // Execute our custom tool
        const result = await executeCustomTool(block.name, block.input)
        // Append tool result + reminder to messages
        messages.push({ role: 'assistant', content: response.content })
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: block.id,
            content: result + TOOL_RESULT_REMINDER
          }]
        })
      }
      // Code execution blocks handled server-side by Anthropic
    }

    if (response.stop_reason === 'end_turn') break
  }
}
```

**Why a flat loop?** Simplicity is a design principle. Orchestration frameworks (LangGraph, CrewAI, AutoGen) add abstraction layers that obscure failures, complicate debugging, and fight the model's natural tool-use patterns. The flat loop is transparent: you can log every message, replay any failure, and understand the full conversation history at a glance.

### 7.6 Streaming Architecture (Session 3 Design)

The streaming pipeline connects section agents to the React frontend in real-time:

```
Section Agent (server)
  → client.beta.messages.stream() with onDelta callback
  → onDelta emits text chunks
  → writer.write({ type: 'data-research-chunk', data: { sectionId, text }, transient: true })
  → SSE (Server-Sent Events) to frontend
  → React state updates via Vercel AI SDK hooks
  → ResearchSectionCard renders incrementally
```

**Key implementation details**:

- Uses Vercel AI SDK's `createUIMessageStream` + `writer.merge()` pattern
- `experimental_context` passes the `writer` reference into tool execution functions
- Each section streams independently — multiple sections can stream in parallel
- `transient: true` means chunks are ephemeral during streaming; final content is persisted to Supabase on completion
- Frontend uses React's concurrent rendering to avoid blocking during rapid chunk updates

### 7.7 Serverless Compatibility

The entire system must run on Vercel serverless functions. This means:

- **No subprocess spawning** — can't fork child processes
- **No persistent connections** — each request is stateless (SSE is the exception via edge functions)
- **No Railway** — no background workers, no dispatch/poll pattern
- **Max execution time**: Vercel Pro allows up to 300 seconds per serverless function invocation; Edge functions have no timeout for streaming
- **Solution**: Section agents run as streaming edge functions. Each section is a single long-lived SSE connection that streams until the agent loop completes.

---

## 8. Frontend Components

### 8.1 Chat Interface

The primary UI is a chat conversation between the user and the lead agent. Research sections appear as rich cards embedded within the chat flow, not in a separate panel.

**Core components**:

- `ChatContainer` — Scrollable message list with auto-scroll on new content
- `UserMessage` — User's text input or chip selections
- `AgentMessage` — Lead agent's conversational responses
- `ChipSelector` — `askUser` field collection UI (single-select and multi-select chips)
- `ScrapeLoadingCard` — Animated card shown during site scrape (already built)

### 8.2 Research Section Cards

Each section renders as a structured card with streaming content. These are NOT markdown dumps — they're formatted UI components with appropriate data visualizations.

**Card types**:

| Card | Section | Key UI Elements |
|---|---|---|
| `MarketOverviewCard` | Industry Research | Market size stat, growth rate, pain point list, seasonal calendar |
| `CompetitorCard` | Competitor Intel | Per-competitor accordion with pricing table, ad gallery, keyword table, speed score |
| `ICPCard` | ICP Validation | Persona avatar card, audience size, channel preference chart, trigger event timeline |
| `OfferAnalysisCard` | Offer Analysis | Pricing position matrix, scorecard, recommendation callouts |
| `StrategySummaryCard` | Strategic Synthesis | SWOT grid, priority matrix, roadmap timeline |
| `KeywordCard` | Keyword Intel | Keyword table (sortable), gap analysis, intent distribution chart |
| `MediaPlanCard` | Media Plan | Budget allocation pie chart, channel cards, timeline Gantt, KPI target table |

**Streaming behavior**: Cards render incrementally. As text chunks arrive via SSE, the card expands. A subtle progress indicator shows the section is still generating. When the agent loop completes for that section, the card transitions to a "complete" state with a checkmark.

### 8.3 Progress Indicator

A persistent element (sidebar or top bar) showing which sections are queued, in-progress, or complete. Allows the user to understand the overall journey progress without scrolling through the chat.

### 8.4 New Journey Button

Available after all 7 sections complete. Resets the conversation state and begins a fresh onboarding flow. Previous journeys are saved to Supabase and accessible from a history view (V2.1).

### 8.5 Source Citations

Every data point in every section card includes an inline citation marker (e.g., `[1]`) that maps to a source reference at the bottom of the card. Sources include Perplexity citations, scraped URLs, SpyFu queries, and Ad Library references.

---

## 9. Data Model

### 9.1 Supabase Schema

**Table: `sessions`**

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | String | Clerk user ID |
| `status` | Enum | `onboarding`, `researching`, `complete`, `error` |
| `website_url` | String | Input URL |
| `scrape_data` | JSONB | Extracted site data |
| `onboarding_fields` | JSONB | All collected field values |
| `created_at` | Timestamp | Session start |
| `completed_at` | Timestamp | All sections done |
| `cost_cents` | Integer | Total API cost tracking |

**Table: `research_sections`**

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to sessions |
| `section_id` | String | `industry_research`, `competitor_intel`, etc. |
| `status` | Enum | `pending`, `running`, `complete`, `error` |
| `content` | JSONB | Structured section output |
| `raw_text` | Text | Full streamed text for PDF export |
| `sources` | JSONB | Citation references |
| `model_used` | String | Which Claude model generated this |
| `tokens_used` | Integer | Input + output tokens |
| `cost_cents` | Integer | Estimated cost |
| `started_at` | Timestamp | Agent loop start |
| `completed_at` | Timestamp | Agent loop end |
| `error_message` | Text | If status is `error` |

**Table: `tool_calls`** (for debugging and cost tracking)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `section_id` | UUID | FK to research_sections |
| `tool_name` | String | `search_market_data`, `scrape_website`, etc. |
| `input` | JSONB | Tool input parameters |
| `output_preview` | Text | First 500 chars of response |
| `latency_ms` | Integer | Tool execution time |
| `cost_cents` | Integer | Estimated cost of this call |
| `created_at` | Timestamp | When the call was made |

### 9.2 Row-Level Security

All tables use Supabase RLS policies scoped to `user_id = auth.uid()`. Users can only read/write their own sessions and research data. Service role key used server-side only.

---

## 10. Cost Model

### 10.1 Per-Journey Cost Breakdown

| Component | Model / Service | Estimated Cost |
|---|---|---|
| Lead Agent (onboarding) | Opus 4.6 | $1.00–2.00 |
| Section 1: Industry Research | Sonnet 4.5 | $0.50–1.00 |
| Section 2: Competitor Intel | Sonnet 4.5 | $0.75–1.50 |
| Section 3: ICP Validation | Sonnet 4.5 | $0.50–0.75 |
| Section 4: Offer Analysis | Haiku 4.5 | $0.05 |
| Section 5: Strategic Synthesis | Opus 4.6 | $1.00–2.00 |
| Section 6: Keyword Intel | Sonnet 4.5 | $0.50–0.75 |
| Section 7: Media Plan | Sonnet 4.5 | $0.50–0.75 |
| Perplexity calls (~10–15) | sonar-pro | $0.50–0.75 |
| Firecrawl scrapes (~5–10) | Firecrawl | $0.05–0.10 |
| SpyFu queries (~5) | SpyFu | Per plan |
| SearchAPI queries (~5) | SearchAPI | Per plan |
| **Total** | | **$5.35–9.65** |

**Note**: The $3–5 target from the brain dump may be optimistic given Opus pricing. Cost optimization levers include reducing Opus usage (use Sonnet for synthesis if quality is sufficient), caching Perplexity responses for common queries, and batching SpyFu keyword lookups.

### 10.2 Pricing Strategy (for SaasLaunch)

Not in scope for this PRD, but the cost model suggests a per-journey price of $29–49 for individual users or a monthly subscription with N journeys included. The margin at $29/journey with ~$7 cost is healthy.

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|---|---|
| Site scrape + extraction | < 35 seconds |
| First research chunk visible | < 5 seconds after section triggers |
| Full journey (7 sections) | < 10 minutes |
| Time to first byte (TTFB) | < 200ms for SSE connection |
| UI responsiveness during streaming | No jank, < 16ms frame time |

### 11.2 Reliability

| Metric | Target |
|---|---|
| Section completion rate | > 95% (no silent failures) |
| Error recovery | Automatic retry with backoff (1 retry per tool call) |
| Session persistence | Full state recoverable after browser refresh |
| Data consistency | All section data persisted to Supabase on completion |

### 11.3 Scalability

For V2 launch, the system needs to handle 10–50 concurrent users. Vercel's serverless architecture handles this natively. The bottleneck is API rate limits (Perplexity, SpyFu, SearchAPI), not compute.

### 11.4 Security

- All API keys stored in environment variables, never client-side
- Supabase RLS enforces user-level data isolation
- Clerk handles authentication with secure session tokens
- No PII stored beyond what the user explicitly provides
- Firecrawl scraping only targets user-specified URLs (no open crawling)

### 11.5 Observability

- Every tool call logged with input, output preview, latency, and cost
- Section-level timing and token usage tracked
- Error states captured with full context for debugging
- Cost tracking at session and section level for budget monitoring

---

## 12. Implementation Plan

### 12.1 Session Breakdown

| Session | Scope | Status |
|---|---|---|
| **Session 1** | Skills + tool infrastructure — 7 SKILL.md files, 5 custom API tools, section runner with agentic loop, section configs | ✅ Done |
| **Session 2** | Wire into stream route — `generateResearch` tool replaces Railway dispatch, lead agent prompt update with trigger rules, old research tools deprecated | ✅ Done |
| **Session 3** | Streaming + UI — `client.beta.messages.stream()` with `onDelta`, `createUIMessageStream` + writer pattern, all 7 research section cards, progress indicator, source citations | 🔄 In Progress (design approved) |
| **Session 4** | Full 7-section end-to-end test — test with 3+ real companies, fix edge cases, validate zero hallucination | ⬜ Planned |
| **Session 5** | PDF export — branded PDF generation using Anthropic's built-in capability | ⬜ Planned |
| **Session 6** | Kill dead code — remove Railway worker, old dispatch tools, Supabase Realtime subscriptions, "research taking longer" warning | ⬜ Planned |

### 12.2 What's Already Built and Working

- Lead agent with conversational onboarding (Opus 4.6)
- `scrapeClientSite` tool (Firecrawl + Haiku extraction, ~35s)
- `askUser` chip-based field collection (being simplified from 6 phases/32 fields → 4 phases/11 fields)
- `competitorFastHits` tool (Haiku sub-agent, Ad Library)
- Clerk auth + Supabase session persistence
- Chat UI with Vercel AI SDK streaming
- Scrape loading card component
- Supabase singleton client

### 12.3 What's Being Replaced

- Railway research worker (dispatch/poll pattern) → streaming section agents
- 7 research dispatch tools → single `generateResearch` meta-tool
- Supabase Realtime for research results → SSE streaming via Vercel AI SDK
- "Research is taking longer than expected" warning → real-time streaming (user sees progress)

---

## 13. Open Questions

### 13.1 Skills Discovery & Versioning

How do we evaluate, test, and pin versions of community-published Skills from GitHub? If a community skill author pushes a breaking change, it could degrade section quality. Options:

- Fork and vendor community skills (full control, maintenance burden)
- Pin to specific commit SHAs (brittle but deterministic)
- Build a skill evaluation pipeline that tests skills against known-good outputs
- **Recommended**: Fork + periodic upstream sync with automated quality tests

### 13.2 Opus vs. Sonnet for Strategic Synthesis

Section 5 (Strategic Synthesis) is specified for Opus 4.6 because it requires judgment across 4 input sections. But Opus is 10–15x more expensive than Sonnet. Can Sonnet 4.5 produce acceptable synthesis quality? Needs A/B testing once all sections are generating.

### 13.3 Parallel Section Execution in Serverless

Can multiple section agents run truly in parallel on Vercel serverless? Each section is a long-lived streaming connection. Vercel supports concurrent edge function invocations, but we need to verify that a single user journey can spawn 2–3 simultaneous edge function calls without hitting plan limits.

### 13.4 PDF Export Approach

The plan references "Anthropic's built-in PDF skill" for export. This needs validation — does the Anthropic API support PDF generation natively via code execution, or do we need a separate PDF generation pipeline (e.g., Puppeteer, react-pdf)?

### 13.5 Session Recovery After Partial Completion

If a user closes the browser after 4 of 7 sections complete, can we resume from Section 5? This requires persisting the full conversation history (or at minimum, all section outputs) so the lead agent can reconstruct context. Supabase stores section outputs, but the agent's conversational state (messages array) may be lost.

### 13.6 Rate Limiting and Queuing

At scale, concurrent Perplexity/SpyFu/SearchAPI calls could hit rate limits. Do we need a queue or throttling layer? For V2 launch (10–50 users), this is likely fine. Flag for V2.1.

---

## 14. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Perplexity returns low-quality or irrelevant market data | Medium | High | Query refinement prompts in Skills; fallback to multiple queries; human-in-the-loop review for V2.1 |
| 2 | SpyFu API data is stale or incomplete for niche markets | Medium | Medium | Cross-reference with Perplexity search; disclose data freshness in citations |
| 3 | Firecrawl fails to scrape JavaScript-heavy sites | Medium | Medium | Fallback to Perplexity search about the company; manual URL entry for key pages |
| 4 | Community Skills degrade after upstream changes | Low | High | Fork and vendor skills; automated quality regression tests |
| 5 | Vercel serverless timeout on complex journeys | Low | High | Edge functions for streaming (no timeout); section agents are independent invocations |
| 6 | Cost per journey exceeds $10 for complex industries | Medium | Medium | Implement token budgets per section; use Haiku for lighter sections; cache common queries |
| 7 | Users don't understand streaming output during generation | Low | Medium | Progress indicators, section status badges, "building your strategy" messaging |
| 8 | Anthropic Skills beta API changes or is deprecated | Low | Critical | Abstract skill loading behind an interface; fallback to system prompts if Skills API is removed |

---

## 15. Success Criteria

### 15.1 Launch Criteria (V2 GA)

- [ ] All 7 sections generate successfully for 10+ test companies across different industries
- [ ] Zero hallucinated data points in any section (verified via source citation audit)
- [ ] Full journey completes in under 10 minutes
- [ ] PDF export produces a branded, professional document
- [ ] Session recovery works after browser refresh (mid-journey)
- [ ] Cost per journey averages < $8 (with path to < $5 via optimization)

### 15.2 Success Metrics (30 days post-launch)

| Metric | Target |
|---|---|
| Journey completion rate | > 70% of started journeys reach all 7 sections |
| Time to complete | Median < 8 minutes |
| User satisfaction (post-journey survey) | > 4.0 / 5.0 |
| Repeat usage | > 30% of users complete a second journey within 14 days |
| Zero hallucination rate | 100% of data points traceable to tool responses |
| Cost per journey | < $8 average (< $5 target after optimization) |

---

## 16. Out of Scope for V2

- Multi-user collaboration (shared journeys)
- Journey history / dashboard
- Custom branding on PDF exports (beyond SaasLaunch branding)
- Integration with ad platforms (Google Ads, Meta Ads Manager) for campaign creation
- E-commerce / DTC vertical support
- Real-time campaign monitoring
- A/B testing of section outputs
- White-label / API access for agencies
- Mobile-optimized chat UI

---

## 17. Glossary

| Term | Definition |
|---|---|
| **Journey** | A single end-to-end run from URL input to complete blueprint |
| **Section** | One of 7 research modules, each generated by a specialized sub-agent |
| **Lead Agent** | The Opus 4.6 model that conducts onboarding and orchestrates section triggers |
| **Section Agent** | A model instance (Sonnet/Haiku/Opus) that generates a specific research section |
| **Skill** | An Anthropic Skills beta package (SKILL.md) that gives an agent domain expertise |
| **Custom Tool** | An API wrapper tool definition that our backend executes on Claude's behalf |
| **Agentic Loop** | The `while(tool_call)` pattern where the model iteratively calls tools until done |
| **Chip** | A clickable selection UI element used for `askUser` field collection |
| **Blueprint** | The complete 7-section strategy document delivered to the user |
| **Tool Result Reminder** | Anti-hallucination text appended after every tool response |

---

*This PRD represents the complete V2 specification as of March 7, 2026. It should be treated as the single source of truth for all implementation decisions. Any deviations from this document should be discussed and documented as amendments.*
