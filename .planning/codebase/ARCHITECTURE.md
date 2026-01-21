# Architecture

**Analysis Date:** 2026-01-21

## Pattern Overview

**Overall:** Layered serverless architecture with multi-stage AI pipeline orchestration and SSE streaming

**Key Characteristics:**
- Next.js 16 with App Router handles routing and server-side rendering
- API-first backend with server actions for authentication
- Client-side state management via React hooks and browser storage
- Four-stage AI pipeline for media plan generation (Extract → Research → Logic → Synthesize)
- Multi-model orchestration across Gemini, Perplexity, GPT-4, and Claude via OpenRouter
- Server-Sent Events (SSE) for real-time generation progress streaming
- Supabase for authentication and optional data persistence
- Local browser storage for session data and generation state

## Layers

**Presentation Layer (Frontend):**
- Purpose: Server-rendered React components with interactive client-side features
- Location: `src/app/` (pages), `src/components/` (reusable UI)
- Contains: Page layouts, UI components (74 components total), client components with hooks
- Depends on: Services layer (via fetch to API routes), local storage
- Used by: Browser clients

**API Routes Layer:**
- Purpose: HTTP endpoints for generation, chat, authentication, and health checks
- Location: `src/app/api/`
- Contains: 13 route handlers (GET/POST/PUT), request validation, response formatting
- Entry points: `/api/media-plan/generate`, `/api/strategic-blueprint/generate`, `/api/chat/blueprint/stream`, `/api/health`, auth endpoints
- Depends on: Services layer, environment configuration
- Used by: Frontend components, external clients

**Services/Business Logic Layer:**
- Purpose: Core pipeline orchestration, AI interactions, data processing
- Location: `src/lib/media-plan/pipeline/`, `src/lib/strategic-blueprint/pipeline/`, `src/lib/chat/`
- Contains: 6 pipeline stage executors, research workers, AI model clients, intent routers
- Depends on: Data layer (storage, Supabase), external APIs (OpenRouter, SearchAPI)
- Used by: API routes

**Data Layer:**
- Purpose: Data persistence and state management
- Location: `src/lib/storage/local-storage.ts`, `src/lib/supabase/`
- Contains: Local storage adapter (localStorage wrapper), Supabase client, authentication middleware
- Depends on: External database (Supabase), browser APIs
- Used by: Services layer, API routes, frontend components

**Utilities & Cross-Cutting:**
- Purpose: Shared helpers, validation, logging, environment config
- Location: `src/lib/env.ts`, `src/lib/logger.ts`, `src/lib/errors.ts`, `src/lib/utils.ts`, `src/lib/openrouter/`
- Contains: Type guards, structured logging with context, error definitions, motion utilities, OpenRouter client
- Used by: All layers

## Data Flow

**Media Plan Generation Flow (Quick Path):**

1. User fills form in `src/app/media-plan/page.tsx` (industry, audience, ICP, budget, offer price, sales cycle)
2. Frontend POST to `/api/media-plan/generate` with `{ niche, briefing }` payload
3. Route handler validates inputs using type guards `validateNicheForm()` and `validateBriefingForm()`
4. Calls `runMediaPlanPipeline()` from `src/lib/media-plan/pipeline/index.ts` with abort controller (60s timeout)
5. **Extract Stage** (`src/lib/media-plan/pipeline/extract.ts`, Gemini Flash): Converts form inputs to ExtractedData
   - Output: Industry (name, vertical, subNiche), audience (demographics, psychographics, painPoints), ICP characteristics, offer classification (low/mid/high ticket), sales cycle complexity
6. **Research Stage** (`src/lib/media-plan/pipeline/research.ts`, Perplexity): Queries market data
   - Output: Market overview (size, trends, growth), competitor analysis, benchmarks (CPC, CPM, CTR, conversion rate), audience insights (platforms, content preferences, peak times)
7. **Logic Stage** (`src/lib/media-plan/pipeline/logic.ts`, GPT-4): Applies business rules
   - Output: Platform recommendations (primary/secondary with budgets), budget allocation breakdown, funnel type, KPI targets
8. **Synthesize Stage** (`src/lib/media-plan/pipeline/synthesize.ts`, Claude): Produces final blueprint
   - Output: Executive summary, platform strategies with tactics, budget breakdown, funnel strategy (awareness/consideration/conversion/retention), ad angles, KPI targets, sources
9. Response returns `{ success: true, blueprint }` with metadata (totalTime, totalCost, stageTimings)
10. Blueprint stored in browser localStorage via `setStrategicBlueprint()`
11. Frontend displays blueprint with generation stats and preview UI

**Strategic Blueprint Generation Flow (Full Path):**

1. User completes `src/components/onboarding/onboarding-wizard.tsx` (company, industry, audience, offer, goals, metrics)
2. Form data saved to localStorage via `setOnboardingData()`
3. POST to `/api/strategic-blueprint/generate` with OnboardingFormData
4. Route handler streams via Server-Sent Events (SSE)
5. Pipeline executes parallel research stages:
   - `src/lib/strategic-blueprint/pipeline/industry-market-research.ts`: Market analysis
   - `src/lib/strategic-blueprint/pipeline/icp-research.ts`: ICP deep dive
   - `src/lib/strategic-blueprint/pipeline/competitor-research.ts`: Competitive landscape
   - `src/lib/strategic-blueprint/pipeline/offer-research.ts`: Offer positioning
6. `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` orchestrates section generation
7. Sends SSE events: `{ type: "section-start", section }`, `{ type: "content", chunk }`, `{ type: "section-end", section }`
8. Client accumulates sections and updates progress UI in real-time
9. Stored in localStorage for session persistence

**Chat & Blueprint Editing Flow:**

1. User interacts with `src/components/chat/chat-panel.tsx` in `/app/generate`
2. Chat messages saved to localStorage via `setGenerationState()`
3. POST to `/api/chat/blueprint/stream` with conversation context and blueprint
4. `src/lib/chat/intent-router.ts` determines if request is edit, question, or enhancement
5. Appropriate agent from `src/lib/chat/agents/` processes request
6. Streams AI-generated response back to client
7. User approves/rejects edits via `/api/blueprint/[id]/confirm-edit`

**State Management:**

- **Onboarding Form State**: React state in component using `useState()`, backed up to localStorage immediately
- **Generation Progress**: Tracked via pipeline `ProgressCallback`, stored in localStorage with `GenerationState` interface
- **Blueprint Output**: Persisted in localStorage as `MediaPlanBlueprint` or `StrategicBlueprintOutput` JSON
- **Chat History**: Stored in localStorage with `ConversationState` (messages array, context, metadata)
- **Auth State**: Supabase handles via `supabase.auth.getUser()`, validated on protected routes via middleware
- **Session Data**: Shared across pages via localStorage STORAGE_KEYS (`ONBOARDING_DATA`, `STRATEGIC_BLUEPRINT`, `GENERATION_STATE`)

## Key Abstractions

**Pipeline Orchestrator (Extract → Research → Logic → Synthesize):**
- Purpose: Multi-stage AI processing with progress tracking, cost aggregation, and timeout control
- Examples: `src/lib/media-plan/pipeline/index.ts` (4-stage), `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` (parallel research + synthesis)
- Pattern: Each stage is isolated function (`runExtractStage()`, `runResearchStage()`, etc.) returning `{ data: T, cost: number, duration: number }`. Orchestrator chains stages sequentially, calls progress callback on each stage start, handles AbortSignal for timeout, aggregates costs and timings.

**Form Data → Structured Data Transformation:**
- Purpose: Convert unstructured user input into queryable, type-safe intermediate representations for AI processing
- Examples: `NicheFormData` → `ExtractedData`, `BriefingFormData` → `LogicData`, `OnboardingFormData` → research context
- Pattern: Each pipeline stage expects typed input and produces typed output, enabling composition. Validation happens via type guards at API boundary.

**OpenRouter Multi-Model Router:**
- Purpose: Abstract model selection and cost tracking across multiple AI providers
- Location: `src/lib/openrouter/client.ts`, `src/lib/openrouter/circuit-breaker.ts`
- Pattern: Wraps OpenRouter API with circuit breaker pattern. Each stage hardcodes which model to use (Gemini Flash for extract, Perplexity for research, GPT-4o for logic, Claude for synthesis). Models selected to optimize latency and cost for each task.

**Storage Adapter:**
- Purpose: Abstract browser localStorage into typed, namespaced get/set functions
- Examples: `getStrategicBlueprint()`, `setMediaPlan()`, `getOnboardingData()`, `getGenerationState()`
- Location: `src/lib/storage/local-storage.ts`
- Pattern: STORAGE_KEYS enum provides namespaced keys. Functions serialize/deserialize JSON and handle null cases. Used by all frontend code and stored in localStorage under domain-specific keys.

**Intent Router (Chat):**
- Purpose: Classify user chat intent and route to appropriate agent
- Location: `src/lib/chat/intent-router.ts`
- Pattern: Analyzes chat message context (blueprint state, conversation history) and routes to agents in `src/lib/chat/agents/` (edit-agent, question-agent, enhancement-agent)

**Markdown Generator:**
- Purpose: Convert intermediate data structures into polished markdown output
- Location: `src/lib/strategic-blueprint/markdown-generator.ts`
- Pattern: Functions for each section type that build markdown with proper formatting, citations, and structure. Called by generators to convert AI output to final blueprint markdown.

## Entry Points

**Web Application Root:**
- Location: `src/app/layout.tsx` (root layout), `src/app/page.tsx` (landing)
- Triggers: Browser navigation to `/`
- Responsibilities: Wraps entire app with ErrorBoundary, sets up fonts and CSS, renders landing page with marketing copy and CTA buttons

**Generate Page (Main Generation UI):**
- Location: `src/app/generate/page.tsx` (client component)
- Triggers: User navigates to `/generate` or clicks "Generate Media Plan"
- Responsibilities: Renders OnboardingWizard for full flow, initiates generation request, displays Pipeline progress component, handles SSE streaming, displays SplitChatLayout with blueprint preview and chat sidebar

**Media Plan Quick Route:**
- Location: `src/app/media-plan/page.tsx` (client component)
- Triggers: User clicks "Quick Plan" or navigates to `/media-plan`
- Responsibilities: Two-step form (NicheForm + BriefingForm) without full onboarding, initiates media plan generation, displays results

**API: Media Plan Generation:**
- Location: `src/app/api/media-plan/generate/route.ts`
- Triggers: POST request with `{ niche: NicheFormData, briefing: BriefingFormData }` payload
- Responsibilities: Validates input via type guards, runs media plan pipeline with 60-second timeout, catches errors, returns `{ success: boolean, blueprint?, error? }`

**API: Strategic Blueprint Generation:**
- Location: `src/app/api/strategic-blueprint/generate/route.ts`
- Triggers: POST request with OnboardingFormData
- Responsibilities: Streams multi-section strategic blueprint via Server-Sent Events, manages error handling with proper SSE error formatting

**API: Chat Blueprint Stream:**
- Location: `src/app/api/chat/blueprint/stream/route.ts`
- Triggers: POST request with chat messages, blueprint context, and conversation state
- Responsibilities: Routes intent via intent router, dispatches to appropriate agent, streams response back to client via SSE

**API: Health Check:**
- Location: `src/app/api/health/route.ts`
- Triggers: GET request
- Responsibilities: Validates environment variables via `validateEnv()`, returns health status with checks (ok/degraded/error), HTTP status 200 or 503

**Authentication Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: OAuth redirect from Supabase auth provider
- Responsibilities: Exchanges authorization code for session, refreshes cookies, redirects to dashboard or referrer

**Protected Routes:**
- Location: `src/app/dashboard/page.tsx` and others
- Triggers: Direct navigation to protected route
- Responsibilities: Checks auth via `supabase.auth.getUser()`, redirects to `/login` if unauthenticated

## Error Handling

**Strategy:** Typed error codes with context-aware logging, fail-gracefully UI fallbacks

**Patterns:**
- `ErrorCode` enum in `src/lib/errors.ts` defines application error types (INVALID_INPUT, PIPELINE_TIMEOUT, MODEL_ERROR, RESEARCH_FAILED, STORAGE_ERROR, etc.)
- API routes return `{ success: false, error: string }` with appropriate HTTP status codes (400 for validation, 503 for service failure, 500 for internal errors)
- Long-running operations use AbortController with timeout to prevent indefinite hangs (300s for Vercel Pro tier maximum, 60s for pipeline target in MVP)
- Pipeline stages catch errors and return failure result with metadata (totalTime, totalCost, stageTimings, failedStage detected from completedStages length)
- Frontend parses errors via `parseApiError()` utility to extract user-friendly messages
- All errors logged with request context via `logError(context, error)` with structured JSON output including requestId, route, errorCode, stack trace
- SSE streams send error events: `{ type: "error", error: string }` which client displays in error UI

## Cross-Cutting Concerns

**Logging:** Structured JSON logging via `src/lib/logger.ts` with request context (requestId, route, method, timestamp, errorCode, metadata, duration). Log functions: `logError()`, `logInfo()`, `logWarn()`. Request ID generated via `createRequestId()` for distributed tracing. Output to console.error/log/warn (suitable for serverless/container logs).

**Validation:** Type-safe validation using TypeScript type guards and Zod schemas. Type guards defined for API inputs (`validateNicheForm()`, `validateBriefingForm()` in route handlers). Zod schemas for complex nested types in `src/lib/media-plan/schemas.ts` and `src/lib/strategic-blueprint/`. Input validation occurs at API route entry point before pipeline execution. Length limits applied (5000 char max per input to prevent token overages).

**Authentication:** Supabase Auth integration via `src/lib/supabase/server.ts` (server-only), `src/lib/supabase/client.ts` (browser), middleware in `src/lib/supabase/middleware.ts`. Protected routes check auth via `supabase.auth.getUser()` and redirect to `/login` if unauthenticated. Middleware refreshes tokens on each request. OAuth callback handler exchanges code for session.

**Rate Limiting:** Not explicitly implemented in application code; Vercel enforces function timeout constraints (300s max). OpenRouter likely includes server-side rate limiting. Pipeline timeout at 60s prevents resource exhaustion.

**State Persistence:** Browser localStorage for session data (onboarding forms, generation state, blueprint outputs) with STORAGE_KEYS namespace isolation. Optional Supabase storage for permanent project/report persistence (not actively used in current MVP). Session data cleared on logout.

**Cost Tracking:** Aggregated across pipeline stages; each stage returns cost (computed from model pricing × tokens). Blueprint metadata includes totalCost. Useful for monitoring and user transparency.

---

*Architecture analysis: 2026-01-21*
