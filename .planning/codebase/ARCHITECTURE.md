# Architecture

**Analysis Date:** 2025-12-24

## Pattern Overview

**Overall:** Full-stack SaaS Application with Multi-Model AI Pipeline

**Key Characteristics:**
- Next.js App Router with Server Components
- Multi-stage AI pipeline architecture (4 stages)
- Client-side state persistence via localStorage
- Supabase for auth, minimal database usage
- Progressive disclosure (quick vs. full generation paths)

## Layers

**Presentation Layer:**
- Purpose: User interface and page rendering
- Contains: React components, pages, layouts
- Location: `src/app/` (pages), `src/components/` (components)
- Depends on: API layer, lib utilities
- Used by: End users via browser

**API Layer:**
- Purpose: Server-side request handling
- Contains: Route handlers, validation, orchestration
- Location: `src/app/api/`
- Depends on: Service layer
- Used by: Presentation layer via fetch

**Service Layer:**
- Purpose: Core business logic and AI pipelines
- Contains: Generators, OpenRouter client, storage utilities
- Location: `src/lib/`
- Depends on: External APIs (OpenRouter, Supabase)
- Used by: API layer

**Data Layer:**
- Purpose: Type definitions and data structures
- Contains: TypeScript interfaces, schemas
- Location: `src/lib/*/types.ts`, `src/types/`
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Quick Media Plan Generation (2-step):**

1. User fills NicheForm + BriefingForm (`src/app/media-plan/page.tsx`)
2. POST to `/api/media-plan/generate` (`src/app/api/media-plan/generate/route.ts`)
3. Validation of niche + briefing data
4. Pipeline execution (`src/lib/media-plan/pipeline/index.ts`):
   - Stage 1: Extract (Gemini Flash) - Parse inputs
   - Stage 2: Research (Perplexity) - Market data
   - Stage 3: Logic (GPT-4o) - Strategy decisions
   - Stage 4: Synthesize (Claude) - Final plan
5. Response with 11-section MediaPlanOutput
6. Client display (`src/components/media-plan/media-plan-display.tsx`)

**Full Strategic Blueprint Generation (9-step):**

1. User completes OnboardingWizard (`src/app/generate/page.tsx`)
2. Data stored to localStorage (`src/lib/storage/local-storage.ts`)
3. POST to `/api/strategic-blueprint/generate`
4. Strategic blueprint generation (5-section output)
5. Optional: Feed blueprint to media plan generation

**State Management:**
- Client-side: localStorage for form data and results
- Server-side: Stateless API handlers
- Sessions: Supabase auth cookies

## Key Abstractions

**Pipeline Pattern:**
- Purpose: Multi-stage AI processing with progress tracking
- Examples: `src/lib/media-plan/pipeline/index.ts`, individual stage files
- Pattern: Sequential stages with abort signal support, progress callbacks

**Generator Pattern:**
- Purpose: Section-by-section content generation
- Examples: `src/lib/media-plan/pipeline/media-plan-generator.ts`, `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts`
- Pattern: Loop over sections, call AI, accumulate results

**OpenRouter Client:**
- Purpose: Multi-model LLM abstraction
- Examples: `src/lib/openrouter/client.ts`
- Pattern: OpenAI-compatible API with JSON mode and cost tracking

**Form Wizard:**
- Purpose: Multi-step form orchestration
- Examples: `src/components/onboarding/onboarding-wizard.tsx`, `src/components/media-plan/form-wizard.tsx`
- Pattern: State machine with step components

**Storage Abstraction:**
- Purpose: Type-safe localStorage access
- Examples: `src/lib/storage/local-storage.ts`
- Pattern: Generic getter/setter with key enum

## Entry Points

**Application Entry:**
- Location: `src/app/layout.tsx`, `src/app/page.tsx`
- Triggers: Browser navigation
- Responsibilities: Root layout, landing page

**API Entries:**
- `POST /api/media-plan/generate` - Quick media plan
- `POST /api/media-plan/full-plan` - Full plan with blueprint context
- `POST /api/strategic-blueprint/generate` - Strategic blueprint
- `GET /auth/callback` - OAuth callback

**Page Entries:**
- `/` - Landing page
- `/generate` - Full onboarding wizard
- `/media-plan` - Quick media plan form
- `/login`, `/signup` - Authentication

## Error Handling

**Strategy:** Try/catch at API boundaries, error propagation to client

**Patterns:**
- API routes catch errors and return JSON error responses
- Validation functions as type guards before processing
- Sanitization for prompt injection prevention
- Console logging for debugging (no structured logging)

## Cross-Cutting Concerns

**Logging:**
- Console.log/error for debugging
- No structured logging service

**Validation:**
- TypeScript discriminator functions for API input
- Runtime type checking before AI calls
- Input sanitization in generators

**Authentication:**
- Supabase middleware updates session cookies
- Server actions for login/logout
- OAuth callback handler

**Security:**
- Prompt injection prevention (`sanitizeInput()` in generators)
- Input length limits (5000 chars max)
- Code block escaping

---

*Architecture analysis: 2025-12-24*
*Update when major patterns change*
