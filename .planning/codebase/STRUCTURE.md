# Codebase Structure

**Analysis Date:** 2026-01-21

## Directory Layout

```
ai-gos/
├── src/                          # Source code (179 total TS/TSX files)
│   ├── app/                      # Next.js App Router pages and API routes
│   │   ├── api/                  # Server API endpoints (13 routes)
│   │   │   ├── blueprint/        # Blueprint CRUD operations
│   │   │   ├── blueprints/       # Blueprint sharing/retrieval
│   │   │   ├── chat/             # Chat message and conversation endpoints
│   │   │   ├── media-plan/       # Media plan generation (quick + full)
│   │   │   ├── strategic-blueprint/  # Strategic blueprint generation
│   │   │   ├── health/           # Health check endpoint
│   │   │   └── auth/             # Authentication routes
│   │   ├── generate/             # Main generation page with onboarding
│   │   ├── media-plan/           # Quick media plan page
│   │   ├── dashboard/            # User dashboard
│   │   ├── auth/                 # Authentication pages
│   │   ├── login/                # Login page
│   │   ├── signup/               # Signup page
│   │   ├── onboarding/           # Onboarding flow
│   │   ├── shared/[token]/       # Shared blueprint viewer
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout with fonts, error boundary
│   │   ├── middleware.ts         # Auth middleware
│   │   └── globals.css           # Global Tailwind + custom styles
│   ├── components/               # React components (74 total)
│   │   ├── ui/                   # Shadcn/ui primitives and custom UI
│   │   │   ├── button.tsx        # Button primitive
│   │   │   ├── card.tsx          # Card container
│   │   │   ├── input.tsx         # Text input
│   │   │   ├── select.tsx        # Select dropdown
│   │   │   ├── checkbox.tsx      # Checkbox primitive
│   │   │   ├── progress.tsx      # Progress bar
│   │   │   ├── badge.tsx         # Badge/pill
│   │   │   ├── label.tsx         # Form label
│   │   │   ├── textarea.tsx      # Multi-line text input
│   │   │   ├── glow-card.tsx     # Custom glowing card
│   │   │   ├── gradient-text.tsx # Gradient text effect
│   │   │   ├── blob-background.tsx # Animated blob background
│   │   │   ├── logo.tsx          # App logo
│   │   │   ├── api-error-display.tsx # Error UI component
│   │   │   ├── sl-background.tsx # SaaS launch background variants
│   │   │   ├── magnetic-button.tsx # Interactive magnetic button
│   │   │   └── gradient-border.tsx # Gradient border effect
│   │   ├── chat/                 # Chat UI components
│   │   │   ├── blueprint-chat.tsx # Chat for blueprint editing
│   │   │   ├── chat-sidebar.tsx  # Chat conversation sidebar
│   │   │   ├── chat-panel.tsx    # Chat message panel
│   │   │   ├── chat-message.tsx  # Individual message bubble
│   │   │   ├── message-bubble.tsx # Enhanced message display
│   │   │   ├── quick-suggestions.tsx # Suggested questions
│   │   │   ├── typing-indicator.tsx # Typing animation
│   │   │   └── index.ts          # Barrel export
│   │   ├── onboarding/           # Onboarding wizard components
│   │   │   ├── onboarding-wizard.tsx # Main wizard orchestrator
│   │   │   ├── step-business-basics.tsx
│   │   │   ├── step-industry-focus.tsx
│   │   │   ├── step-audience-research.tsx
│   │   │   ├── step-offer-positioning.tsx
│   │   │   ├── step-business-goals.tsx
│   │   │   ├── step-target-metrics.tsx
│   │   │   ├── step-review.tsx
│   │   │   └── form-steps.tsx
│   │   ├── media-plan/           # Media plan components
│   │   │   ├── form-wizard.tsx   # Two-step form (Niche + Briefing)
│   │   │   ├── media-plan-display.tsx # Display media plan blueprint
│   │   │   ├── step-niche-form.tsx
│   │   │   ├── step-briefing-form.tsx
│   │   │   ├── niche-form.tsx
│   │   │   ├── briefing-form.tsx
│   │   │   └── quick-blueprint.tsx
│   │   ├── strategic-blueprint/  # Blueprint display components
│   │   │   ├── polished-blueprint-view.tsx # Formatted blueprint display
│   │   │   ├── pdf-markdown-content.tsx # PDF export handler
│   │   │   ├── blueprint-section.tsx
│   │   │   ├── edit-section-modal.tsx
│   │   │   ├── blueprint-header.tsx
│   │   │   └── section-renderer.tsx
│   │   ├── strategic-research/   # Research components
│   │   │   ├── editable/         # Editable research components
│   │   │   ├── blueprint-document.tsx # Full blueprint document
│   │   │   ├── research-section.tsx
│   │   │   └── sidebar-research.tsx
│   │   ├── pipeline/             # Pipeline UI components
│   │   │   ├── pipeline.tsx      # Progress tracker
│   │   │   ├── generation-stats.tsx # Stats display
│   │   │   ├── stage-progress.tsx
│   │   │   └── cost-meter.tsx
│   │   ├── layout/               # Layout components
│   │   │   ├── split-chat-layout.tsx # Two-panel layout (blueprint + chat)
│   │   │   └── index.ts          # Barrel export
│   │   ├── editor/               # Editor components
│   │   │   ├── blueprint-editor.tsx
│   │   │   ├── markdown-editor.tsx
│   │   │   └── section-editor.tsx
│   │   ├── shared-blueprint/     # Shared blueprint viewer
│   │   │   └── shared-viewer.tsx
│   │   ├── error-boundary.tsx    # React error boundary wrapper
│   │   └── index.ts              # Barrel export
│   ├── lib/                      # Business logic and utilities
│   │   ├── media-plan/           # Media plan pipeline
│   │   │   ├── pipeline/         # 4-stage pipeline
│   │   │   │   ├── index.ts      # Pipeline orchestrator
│   │   │   │   ├── extract.ts    # Stage 1: Gemini Flash
│   │   │   │   ├── research.ts   # Stage 2: Perplexity
│   │   │   │   ├── logic.ts      # Stage 3: GPT-4
│   │   │   │   ├── synthesize.ts # Stage 4: Claude
│   │   │   │   ├── media-plan-generator.ts # 11-section generator
│   │   │   │   └── __tests__/    # Pipeline tests
│   │   │   ├── types.ts          # Form and pipeline types
│   │   │   ├── schemas.ts        # Zod validation schemas
│   │   │   ├── output-types.ts   # Output data structures
│   │   │   └── __tests__/        # Test fixtures
│   │   ├── strategic-blueprint/  # Strategic blueprint pipeline
│   │   │   ├── pipeline/         # Research + generation stages
│   │   │   │   ├── industry-market-research.ts
│   │   │   │   ├── icp-research.ts
│   │   │   │   ├── competitor-research.ts
│   │   │   │   ├── offer-research.ts
│   │   │   │   └── strategic-blueprint-generator.ts
│   │   │   ├── output-types.ts   # Blueprint data structures
│   │   │   ├── markdown-generator.ts # Markdown rendering
│   │   │   ├── approval.ts       # Edit approval flow
│   │   │   └── __tests__/
│   │   ├── chat/                 # Chat system
│   │   │   ├── agents/           # Intent-specific handlers
│   │   │   │   ├── edit-agent.ts # Blueprint edit agent
│   │   │   │   ├── question-agent.ts # Q&A agent
│   │   │   │   └── enhancement-agent.ts # Enhancement agent
│   │   │   ├── intent-router.ts  # Intent classification
│   │   │   ├── chunking.ts       # Text chunking for context
│   │   │   ├── embeddings.ts     # Vector embeddings
│   │   │   ├── retrieval.ts      # Context retrieval
│   │   │   ├── types.ts          # Chat data types
│   │   │   └── __tests__/
│   │   ├── openrouter/           # AI model client
│   │   │   ├── client.ts         # OpenRouter API wrapper
│   │   │   ├── circuit-breaker.ts # Fault tolerance
│   │   │   ├── types.ts          # Model types
│   │   │   └── __tests__/
│   │   ├── storage/              # Browser storage
│   │   │   ├── local-storage.ts  # localStorage adapter
│   │   │   └── __tests__/
│   │   ├── supabase/             # Supabase integration
│   │   │   ├── client.ts         # Browser client
│   │   │   ├── server.ts         # Server client
│   │   │   ├── middleware.ts     # Auth middleware
│   │   │   └── types.ts          # Auth types
│   │   ├── research/             # Research utilities
│   │   │   └── search-api.ts     # SearchAPI integration
│   │   ├── onboarding/           # Onboarding types
│   │   │   └── types.ts
│   │   ├── blueprints/           # Blueprint utilities
│   │   │   └── sharing.ts        # Share token generation
│   │   ├── ad-library/           # Ad research
│   │   │   └── index.ts
│   │   ├── env.ts                # Environment validation
│   │   ├── errors.ts             # Error definitions
│   │   ├── logger.ts             # Structured logging
│   │   ├── utils.ts              # Shared utilities (cn, etc.)
│   │   ├── motion.ts             # Animation helpers
│   │   ├── syntax.ts             # Syntax highlighting
│   │   └── __tests__/            # Shared test utilities
│   ├── hooks/                    # React custom hooks
│   ├── test/                     # Test utilities
│   │   ├── factories/            # Test data factories
│   │   └── mocks/                # Mock data
│   └── types/                    # Global type definitions
│       └── html2pdf.d.ts         # PDF export type definitions
├── public/                       # Static assets
│   └── [assets]
├── docs/                         # Documentation
│   └── [docs]
├── scripts/                      # Build/utility scripts
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Codebase analysis (this dir)
├── .next/                        # Next.js build (ignored)
├── node_modules/                 # Dependencies (ignored)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.ts                # Next.js config
├── components.json               # shadcn/ui config
├── postcss.config.mjs            # PostCSS (Tailwind)
├── eslint.config.mjs             # ESLint flat config
└── .gitignore                    # Git ignore rules
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and server routes
- Contains: page.tsx files, route.ts API handlers, layout.tsx files
- Structure: Each directory corresponds to a URL route (e.g., `src/app/generate` → `/generate`)
- Key files: `layout.tsx` (root), `page.tsx` (landing), `globals.css` (tailwind)

**`src/app/api/`:**
- Purpose: RESTful API endpoints following Next.js convention
- Pattern: `[resource]/[operation]/route.ts` or `[resource]/[id]/route.ts`
- Key endpoints:
  - `POST /api/media-plan/generate` - Quick 4-stage pipeline (60s timeout)
  - `POST /api/media-plan/full-plan` - Extended generation (5min timeout)
  - `POST /api/strategic-blueprint/generate` - Full blueprint with SSE streaming
  - `POST /api/chat/blueprint/stream` - Interactive editing via chat
  - `GET /api/health` - Health check with environment validation

**`src/components/`:**
- Purpose: Reusable React components organized by feature
- Pattern: Feature directories contain all related components
- UI components in `ui/` directory following shadcn/ui patterns
- Export via barrel file (`index.ts`) for cleaner imports

**`src/lib/media-plan/pipeline/`:**
- Purpose: 4-stage AI pipeline for media plan generation
- Files: Each stage in separate file for testability and clarity
- Pattern: Stage functions return `{ data: T, cost: number, duration: number }`
- Orchestrated by `index.ts` with progress callbacks and abort signal support

**`src/lib/strategic-blueprint/pipeline/`:**
- Purpose: Multi-research-stage strategic blueprint generation
- Files: Parallel research stages + generator + markdown renderer
- Pattern: Research stages execute in parallel, generator orchestrates synthesis
- Output: SSE stream with section-based content delivery

**`src/lib/chat/`:**
- Purpose: Conversational AI for blueprint editing and Q&A
- Agents: Intent-specific handlers (edit, question, enhancement)
- Pattern: Intent router classifies user message, dispatches to appropriate agent
- Chunking: Text chunking for RAG-style context retrieval

**`src/lib/storage/`:**
- Purpose: Browser localStorage adapter with type safety
- Pattern: STORAGE_KEYS enum provides namespaced keys, functions handle serialization
- Usage: Persists form state, generation results, chat history across sessions

**`src/lib/supabase/`:**
- Purpose: Supabase authentication and database client
- Files: Separate server/client for security, middleware for token refresh
- Auth: OAuth with Google, email/password options
- Types: User, Session, AuthSession type definitions

**`src/lib/openrouter/`:**
- Purpose: Multi-model AI client wrapper
- Client: Wraps OpenRouter API with cost tracking and JSON mode
- Circuit Breaker: Fault tolerance pattern for API failures
- Models: Gemini Flash (extract), Perplexity (research), GPT-4 (logic), Claude (synthesis)

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Landing page with marketing copy
- `src/app/layout.tsx` - Root layout with fonts, ErrorBoundary, globals.css import
- `src/app/generate/page.tsx` - Main generation UI with onboarding wizard
- `src/app/middleware.ts` - Auth middleware for token refresh

**Core Pipelines:**
- `src/lib/media-plan/pipeline/index.ts` - Media plan orchestrator
- `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` - Blueprint orchestrator
- `src/lib/openrouter/client.ts` - AI model client

**State & Storage:**
- `src/lib/storage/local-storage.ts` - All browser persistence
- `src/lib/supabase/server.ts` - Server-side auth client
- `src/lib/supabase/client.ts` - Browser auth client

**Cross-Cutting:**
- `src/lib/env.ts` - Environment variable validation and access
- `src/lib/logger.ts` - Structured JSON logging
- `src/lib/errors.ts` - Error code definitions
- `src/lib/utils.ts` - Utility functions (cn for class merging, etc.)

**Configuration:**
- `tsconfig.json` - TypeScript strict mode, path aliases (`@/*` → `src/*`)
- `next.config.ts` - Next.js config (middleware, env vars)
- `components.json` - shadcn/ui CLI config
- `postcss.config.mjs` - Tailwind CSS PostCSS plugin

**Testing:**
- `src/lib/**/__tests__/` - Collocated test files (vitest)
- `src/test/factories/` - Test data factories
- `src/test/mocks/` - Mock implementations

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `blueprint-chat.tsx`, `step-industry-focus.tsx`)
- Utilities/Services: `kebab-case.ts` (e.g., `local-storage.ts`, `intent-router.ts`)
- Types: `types.ts` or `*-types.ts` suffix (e.g., `output-types.ts`)
- API Routes: `route.ts` (Next.js convention)
- Pages: `page.tsx` (Next.js convention)
- Tests: `*.test.ts` or `*.spec.ts` suffix

**Directories:**
- Lowercase kebab-case (e.g., `media-plan/`, `strategic-blueprint/`)
- Plural for collections (e.g., `components/`, `types/`, `pages/`)
- Prefixed with feature scope (e.g., `chat/agents/`, `media-plan/pipeline/`)

**Special Patterns:**
- Wizard steps: `step-{name}.tsx` (e.g., `step-business-basics.tsx`)
- Display components: `{name}-display.tsx` (e.g., `media-plan-display.tsx`)
- Agents: `{type}-agent.ts` (e.g., `edit-agent.ts`)
- Barrel exports: `index.ts` for each feature directory

## Where to Add New Code

**New Feature Endpoint:**
1. Create API route: `src/app/api/{feature}/route.ts`
2. Add validation in route handler (type guards or Zod)
3. Call business logic from `src/lib/{feature}/`
4. Return JSON response with error handling

**New Pipeline Stage:**
1. Create stage file: `src/lib/media-plan/pipeline/{stage-name}.ts`
2. Export function returning `{ data: T, cost: number, duration: number }`
3. Add to orchestrator in `index.ts` with progress callback
4. Add error handling and logging

**New UI Component:**
1. Shadcn primitive: `src/components/ui/{component}.tsx` (copy from shadcn/ui)
2. Feature component: `src/components/{feature}/{component}.tsx`
3. Export from `index.ts` in feature directory
4. Import using barrel export for cleaner paths

**New Form/Wizard Step:**
1. Create component: `src/components/{feature}/step-{name}.tsx`
2. Implement form logic with `useState` and validation
3. Export from parent feature directory
4. Add to wizard's step array with proper ordering

**New Utility/Helper:**
1. Shared across features: `src/lib/utils.ts`
2. Feature-specific: `src/lib/{feature}/helpers.ts`
3. Types: `src/lib/{feature}/types.ts`
4. Create `__tests__/{name}.test.ts` alongside implementation

**New Page:**
1. Create route: `src/app/{route}/page.tsx`
2. Server component by default (use `"use client"` if interactive)
3. Import shared components from `src/components/`
4. Add layout if needed: `src/app/{route}/layout.tsx`

**Testing New Code:**
1. Create test file: `src/lib/{feature}/__tests__/{name}.test.ts`
2. Use vitest for unit tests (runs via `npm run test`)
3. Import test utilities from `src/test/factories/` and `src/test/mocks/`
4. Collocate near implementation for easy discovery

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.
- Generated by: `/gsd:map-codebase` command
- Committed: Yes (for team reference)

**`node_modules/`:**
- Purpose: npm dependencies installed from package.json
- Generated by: `npm install`
- Committed: No (in .gitignore)

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated by: `next dev` or `next build`
- Committed: No (in .gitignore)

**`public/`:**
- Purpose: Static assets served at root (images, fonts, etc.)
- Committed: Yes (except for generated images)

**`docs/`:**
- Purpose: Project documentation and guides
- Committed: Yes

## Import Paths

**Use path aliases for all imports:**
- `@/components/*` - `src/components/`
- `@/lib/*` - `src/lib/`
- `@/types/*` - `src/types/`
- `@/hooks/*` - `src/hooks/`

**Avoid relative imports:** Use `@/` prefix instead of `../` for clarity and refactoring safety

**Barrel exports:** Import from `src/components/{feature}/` (via index.ts) rather than specific files

---

*Structure analysis: 2026-01-21*
