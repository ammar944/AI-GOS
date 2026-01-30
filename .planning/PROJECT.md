# AI-GOS Project

## Current State (Updated: 2026-01-20)

**Shipped:** v2.0 Design Refresh (2026-01-13)
**Status:** Production-ready with premium design system
**Codebase:** TypeScript/TSX, Next.js 16 + React 19 + Supabase

## Current Milestone: v2.2 Pricing Intelligence

**Goal:** Accurate competitor pricing extraction through intelligent page discovery and direct scraping

**Target features:**
- Intelligent pricing page discovery (find where pricing lives, not just /pricing)
- Firecrawl-based direct page scraping for real-time data
- LLM-powered structured pricing extraction from scraped content
- Confidence scoring for extracted pricing data
- Replace Perplexity pricing in Section 4 competitor analysis pipeline

**Motivation:**
- Current Perplexity-based pricing extraction produces inaccurate data
- AI synthesis pulls from reviews/articles instead of actual pricing pages
- Need direct source of truth: the actual competitor pricing page
- Confidence scores help users know when to verify manually

## Requirements — Active

- [ ] Intelligent pricing page discovery from competitor URL
- [ ] Firecrawl integration for direct page scraping
- [ ] LLM-powered structured pricing extraction
- [ ] Confidence scoring for extracted pricing data
- [ ] Replace Perplexity pricing in Section 4 pipeline

## Requirements — Validated

- ✓ v1.0-v2.1 features (see archived milestones)

## Out of Scope

- Historical pricing tracking — Future milestone (v2.3+)
- Price change alerts — Future milestone
- Pricing trend visualization — Future milestone
- Media plan generation — Future milestone

---

<details>
<summary>Original Vision (v1.0 - Archived for reference)</summary>

## Vision
AI-GOS (AI-powered Go-to-Market Operations System) is a SaaS platform that generates comprehensive media plans and strategic blueprints for businesses using a multi-model AI pipeline.

## What Works (as of v1.0)
- Multi-model AI pipeline (Gemini Flash → Perplexity → GPT-4o → Claude)
- 9-step onboarding wizard for full strategic blueprints
- Quick 2-step media plan generation
- Supabase authentication (email/password + Google OAuth)
- LocalStorage persistence for form data and results
- Progress tracking during generation
- Robust JSON extraction with Zod validation
- Per-section timeouts with retry logic
- Circuit breaker for API failures
- Structured error responses

## Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (App Router)
- **AI:** OpenRouter gateway (Gemini Flash, Perplexity Sonar Pro, GPT-4o, Claude Sonnet)
- **Auth:** Supabase (SSR)
- **Deployment:** Vercel (target)

## Constraints
- Vercel function timeout: 60s (Pro) or 10s (Hobby)
- OpenRouter rate limits per model
- Total generation cost target: <$0.25 per plan

</details>

---

*Created: 2025-12-24*
*Updated: 2026-01-30 (v2.2 Pricing Intelligence milestone started)*
