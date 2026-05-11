---
name: Onboarding Implementation Architecture
description: Complete onboarding flow (V2 conversational, V1 wizard backup, prefill system, session persistence)
type: reference
---

> **DEPRECATED 2026-05-11** — This file documents implementation that was removed in Phase 6 (journey-page deletion), Phase 7 (workspace-page cluster + 7 legacy worker runners), and F1 (dispatch unification). Kept as history. For current architecture see `docs/journey-ai-layer-architecture-2026-05-07.md` and the `/research-v2` route.

# Onboarding Implementation Research

## Overview

The project has TWO onboarding paradigms:

1. **V2 Conversational Onboarding** (redesign/v2-command-center branch) — Active, chat-driven, uses `askUser` tool
2. **V1 Step Wizard** (main branch) — Step-by-step form, horizontal progress, preserved for fallback

Both converge on the same `OnboardingState` interface and use identical session persistence.

---

## V2 Conversational Onboarding (CURRENT BRANCH)

### Entry Point
- **Route**: `/journey` → `src/app/journey/page.tsx`
- **Redirect logic**: `src/app/onboarding/page.tsx` (lines 11-38)
  - Not authenticated → `/sign-in`
  - Onboarding complete → `/dashboard`
  - Onboarding incomplete → `/generate` (which redirects to `/journey`)

### Main Chat Agent
**File**: `src/app/api/journey/stream/route.ts` (1000+ lines)
- **Model**: Claude Opus 4.6 with adaptive thinking (`budgetTokens: 5000`)
- **SDK**: Vercel AI SDK (`streamText` + `toUIMessageStreamResponse`)
- **Pattern**: Conversational agent with 7 registered tools:
  1. `askUser` — Ask user a question with options/chips
  2. `competitorFastHits` — Auto-detect competitors from input
  3. `scrapeClientSite` — Fetch and analyze company website
  4. `researchIndustry` — Railway dispatch for industry research
  5. `researchCompetitors` — Railway dispatch for competitor intel
  6. `researchICP` / `researchOffer` / `researchKeywords` — Other dispatch tools

### askUser Tool (Conversational Widget)
**Files**:
- Tool definition: `src/lib/ai/tools/chat-tools/ask-user.ts` (betaZodTool with Zod schema)
- UI Component: `src/components/journey/ask-user-card.tsx` (lines 1-100+)
- **Type**: Chip selection (single/multi), text input fallback, custom "other" option

**Tool Response Format**:
```typescript
{
  fieldName: string;
  selectedLabel?: string;  // Single select
  selectedLabels?: string[];  // Multi-select
  otherText?: string;  // Custom text input
}
```

**UI Pattern**: Chips with descriptions, animated entrance, submitted state shows checkmark

### Field Catalog (Brain of Onboarding)
**File**: `src/lib/journey/field-catalog.ts`
- Defines 22+ journey fields (8 required, 14 optional)
- Maps field names to `FIELD_LABELS` used in system prompt
- **JOURNEY_REQUIRED_FIELD_KEYS**: `['businessModel', 'industry', 'icpDescription', 'productDescription', 'competitors', 'offerPricing', 'marketingChannels', 'goals']`
- **JOURNEY_PREFILL_REVIEW_FIELDS**: Fields to auto-fill when prefill runs

### Session Persistence (V2)
**Files**:
- **Local Storage**: `src/lib/storage/local-storage.ts` (lines 142-153)
  - `STORAGE_KEYS.JOURNEY_SESSION` stores `OnboardingState`
  - Functions: `getJourneySession()`, `setJourneySession()`, `clearJourneySession()`
- **Supabase**: `src/lib/journey/session-state.server.ts`
  - Stores metadata + research results in `journey_sessions` table
  - `activeJourneyRunId` in metadata tracks which research run is active

**State Shape** (`src/lib/journey/session-state.ts` lines 1-42):
```typescript
interface OnboardingState {
  // Required (8 fields)
  businessModel: string | null;
  industry: string | null;
  icpDescription: string | null;
  productDescription: string | null;
  competitors: string | null;
  offerPricing: string | null;
  marketingChannels: string[] | null;
  goals: string | null;

  // Optional (14 fields)
  companyName: string | null;
  websiteUrl: string | null;
  teamSize: string | null;
  // ... 11 more

  // Meta
  activeJourneyRunId?: string | null;
  phase: 'onboarding' | 'confirming' | 'complete';
  requiredFieldsCompleted: number;
  completionPercent: number;
  lastUpdated: string;
}
```

### Resume Logic
**File**: `src/components/journey/resume-prompt.tsx`
- **Trigger**: If saved session found in localStorage + completionPercent < 100
- **UI**: Card asking "Resume your previous analysis?"
- **Action**: Load saved state + show welcome message with context

---

## V1 Step Wizard (MAIN BRANCH FALLBACK)

### Route Structure
- **Entry**: `/onboarding` → `src/app/onboarding/page.tsx` (redirects to `/generate`)
- **Main page**: `/onboarding` → **Does not exist** (redirects to `/generate`)
- Actually lives at: `src/app/onboarding/edit/page.tsx` (editable onboarding)

### Wizard Component
**File**: `src/components/onboarding/onboarding-wizard.tsx` (300+ lines)
- **Architecture**: Horizontal step progress bar + large step component
- **9 steps**: Business, ICP, Product, Market, Journey, Brand, Assets, Budget, Compliance
- **Icons**: Building2, Users, Package, TrendingUp, Route, Sparkles, FileCheck, Target, Shield
- **State**: Uses React state for form data + step index
- **Form data**: `OnboardingFormData` interface with sub-objects per step

### Step Components
**Directory**: `src/components/onboarding/step-*.tsx` (9 files)
- `step-business-basics.tsx` — Company name, business model, industry
- `step-icp.tsx` — Job titles, company size, geography
- `step-product-offer.tsx` — Product description, pricing, offer
- `step-market-competition.tsx` — Competitors, edge, market problem
- `step-customer-journey.tsx` — Situation, transformation, objections
- `step-brand-positioning.tsx` — Positioning statement, testimonials
- `step-assets-proof.tsx` — Links to case studies, testimonials, pricing
- `step-budget-targets.tsx` — Ad budget, KPIs
- `step-compliance.tsx` — Legal compliance, data handling

### Per-Step AI Suggestions
**Route**: `src/app/api/onboarding/suggest/route.ts`
- Routes to Perplexity (for market data) or Claude (for analysis)
- Returns streaming suggestions for current step
- **Components**: `src/components/onboarding/field-suggestion.tsx`, `ai-suggest-button.tsx`

### Document Upload + Auto-Fill
**Files**:
- `src/components/onboarding/document-upload-panel.tsx` — Upload PDF/document
- `src/components/onboarding/auto-fill-panel.tsx` — Shows parsed fields
- **Endpoint**: `src/app/api/onboarding/extract-document/route.ts` — Parse document
- **Backend**: `src/lib/company-intel/document-parser.ts` — Extract structured fields

---

## Prefill System (SHARED BETWEEN V1 + V2)

### Automatic Prefill (From Website URL)
**Entry Point**: Either wizard or chat agent can trigger
- **Backend Route**: `src/app/api/journey/prefill/route.ts` (lines 1-72)
  - Accepts POST: `{ websiteUrl, linkedinUrl }`
  - Uses `runCompanyResearch()` → Firecrawl scrape + Perplexity analysis
  - Streams text response (line 58: `createTextStreamResponse`)
- **Max Duration**: 180 seconds (3 minutes)

### Company Research Logic
**File**: `src/lib/company-intel/run-company-research.ts` (200+ lines)
- **Scrape Engine**: Firecrawl (`createFirecrawlClient`)
- **Paths to scrape**: `/`, `/about`, `/pricing`, `/features`, etc. (12 paths, max 15KB content)
- **AI Extraction**: Perplexity Sonar Pro (`generateObject`)
- **Output Schema**: `companyResearchSchema` (25 structured fields)
- **System Prompt**: Lines 6-20 — Strict rules: only verified info, null for unknown, cite sources

### Prefill Response Format
**Type**: `CompanyResearchOutput` (from `src/lib/company-intel/schemas.ts`)
```typescript
{
  companyName: { value: string | null, confidence: 0-1, sourceUrl: string | null, reasoning: string }
  businessModel: { ... }
  // ... 23 more fields
  confidenceNotes: string;  // Overall quality note
}
```

### Frontend Prefill Hook
**File**: `src/hooks/use-journey-prefill.ts` (lines 1-105)
- Uses `experimental_useObject` from Vercel AI SDK
- Calls `/api/journey/prefill` endpoint
- Counts `fieldsFound` — how many non-null values returned
- Returns: `partialResult`, `isLoading`, `error`, `stop()`, `fieldsFound`

### Prefill UI (Journey)
**Files**:
- `src/components/journey/prefill-stream-view.tsx` — Shows fields as they arrive
- `src/components/journey/journey-prefill-review.tsx` — Review + edit before committing
- **Pattern**: Streaming fields → Review → Commit to session state

### Manual Prefill Presets (Hardcoded Demo)
**File**: `src/lib/journey/manual-prefill-presets.ts` (lines 1-56)
- **Function**: `getManualPrefillPreset(input)` — Returns demo data if website matches
- **Current presets**:
  - **SaaSLaunch** (matches `saaslaunch.net` or `saslaunch.net`)
    - Returns hardcoded fields: business model, product, competitors, ICP, pricing, etc.
    - Useful for demos without actual web scrape

---

## Data Flow: Onboarding → Research → Blueprint

### Phase 1: Onboarding Collection
1. User answers required fields via chat `askUser` or wizard steps
2. Each answer saved to localStorage (`OnboardingState`)
3. Completion % tracked in meta fields
4. Optional: Website prefill via Firecrawl + Perplexity

### Phase 2: Research Dispatch
**Direct Dispatch Route** (Frontend-driven): `src/app/api/journey/dispatch/route.ts`
- Frontend calls `/api/journey/dispatch` → stamps `activeJourneyRunId` in Supabase
- Railway worker picks up → runs 7 research runners in sequence
- **Section map**: `industryMarket → researchIndustry`, `competitors → researchCompetitors`, etc.

**Or**: Chat agent calls research tools directly (via betaZodTool wrappers)

### Phase 3: Results Persistence
**Supabase table**: `journey_sessions`
- Column: `research_results` (JSONB) — stores result per section
- Column: `job_status` (JSONB) — tracks job lifecycle (running/complete/error)
- Column: `metadata` (JSONB) — includes `activeJourneyRunId`, field values

### Phase 4: Blueprint Generation
- Once all research complete, system synthesizes into blueprint
- Uses lead agent with all research results as context
- Outputs strategic blueprint document

---

## Key Architectural Decisions

### Why Two Onboarding Flows?
- **V1 (Wizard)**: Form-based, familiar, step-by-step progress visible
- **V2 (Chat)**: Conversational, feels like talking to strategist, more engaging

### Why Manual Prefill Presets?
- Demo without needing real company
- Hardcoded for `saslaunch.net` (Ammar's company)
- Pattern: Check domain → return demo data

### Why Separate Research Dispatch?
- **Chat can trigger** (via `researchIndustry` tool)
- **Frontend can trigger directly** (via dispatch route)
- Allows parallel tools + observable failures (not silent)

### Session Persistence Strategy
- **localStorage**: Quick resume, doesn't survive logout
- **Supabase**: Persistent, survives session, sync across devices
- **Why both?**: localStorage for instant access, Supabase for durability

---

## Field Mapping Reference

### JOURNEY_FIELD_LABELS (src/lib/journey/field-catalog.ts)
Used by lead agent system prompt to ask questions:
```
businessModel → "Business Model"
industry → "Industry Vertical"
icpDescription → "Ideal Customer Profile"
productDescription → "Product Description"
competitors → "Top Competitors"
offerPricing → "Offer & Pricing"
marketingChannels → "Marketing Channels"
goals → "Campaign Goals"
// ... 14 optional
```

### GENERATOR_TO_SECTION (src/app/api/strategic-blueprint/generate/route.ts)
Maps short names to full section keys for frontend:
```
industryMarket → industryMarketOverview
competitors → competitorAnalysis
// ... etc
```

---

## Test Coverage
- `src/lib/journey/__tests__/` — Session state, prefill logic, field catalog
- `src/components/journey/__tests__/` — Ask-user card, prefill-review, chat-message
- `src/components/onboarding/__tests__/` — Step components, prefill summary

---

## Files Quick Reference

| File | Purpose |
|------|---------|
| `src/app/journey/page.tsx` | V2 chat agent main page |
| `src/app/api/journey/stream/route.ts` | Chat agent backend |
| `src/app/onboarding/page.tsx` | Entry point (redirects) |
| `src/components/onboarding/onboarding-wizard.tsx` | V1 step wizard |
| `src/lib/journey/field-catalog.ts` | Field metadata + labels |
| `src/lib/journey/session-state.ts` | OnboardingState interface |
| `src/lib/journey/session-state.server.ts` | Supabase persistence |
| `src/lib/storage/local-storage.ts` | localStorage API |
| `src/app/api/journey/prefill/route.ts` | Website prefill endpoint |
| `src/lib/company-intel/run-company-research.ts` | Firecrawl + Perplexity research |
| `src/lib/journey/manual-prefill-presets.ts` | Hardcoded demo data |
| `src/components/journey/ask-user-card.tsx` | Chip selection UI |
| `src/components/journey/prefill-stream-view.tsx` | Prefill streaming UI |
