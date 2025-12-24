# Codebase Structure

**Analysis Date:** 2025-12-24

## Directory Layout

```
ai-gos/
├── src/                    # Source code
│   ├── app/               # Next.js App Router
│   ├── components/        # React components
│   ├── lib/               # Utilities & services
│   └── types/             # Global type definitions
├── public/                 # Static assets
├── docs/                   # Documentation
├── .planning/              # Planning documents
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── next.config.ts          # Next.js config
├── components.json         # shadcn/ui config
└── eslint.config.mjs       # ESLint config
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router pages and API routes
- Contains: page.tsx files, route.ts API handlers, layout.tsx
- Key files:
  - `page.tsx` - Landing page
  - `layout.tsx` - Root layout with fonts
  - `globals.css` - Global styles
- Subdirectories:
  - `api/` - Server API routes
  - `generate/` - Full onboarding wizard page
  - `media-plan/` - Quick media plan page
  - `login/`, `signup/` - Auth pages
  - `auth/callback/` - OAuth callback route
  - `dashboard/`, `onboarding/` - App pages

**src/app/api/:**
- Purpose: Server-side API endpoints
- Contains: route.ts files following Next.js conventions
- Key routes:
  - `media-plan/generate/route.ts` - Generate media plan (60s timeout)
  - `media-plan/full-plan/route.ts` - Full plan endpoint (5min timeout)
  - `strategic-blueprint/generate/route.ts` - Blueprint generation (5min timeout)

**src/components/:**
- Purpose: Reusable React components
- Contains: TSX component files organized by feature
- Subdirectories:
  - `ui/` - Shadcn/ui primitives (15 components)
  - `onboarding/` - 9-step onboarding wizard components
  - `media-plan/` - Media plan form and display components
  - `strategic-blueprint/` - Blueprint display components

**src/components/ui/:**
- Purpose: Reusable UI primitives (shadcn/ui based)
- Contains: button.tsx, card.tsx, input.tsx, select.tsx, checkbox.tsx, progress.tsx, badge.tsx, label.tsx, textarea.tsx, glow-card.tsx, gradient-text.tsx, blob-background.tsx, logo.tsx, section-divider.tsx, saaslaunch.tsx

**src/lib/:**
- Purpose: Business logic, utilities, and service clients
- Contains: TypeScript modules organized by domain
- Subdirectories:
  - `openrouter/` - AI model client (`client.ts`)
  - `supabase/` - Auth client (`client.ts`, `server.ts`, `middleware.ts`, `types.ts`)
  - `media-plan/` - Media plan types and pipeline
  - `strategic-blueprint/` - Blueprint types and pipeline
  - `onboarding/` - Onboarding types
  - `storage/` - localStorage wrapper
- Key files:
  - `utils.ts` - Shared utilities (cn function)

**src/lib/media-plan/pipeline/:**
- Purpose: 4-stage AI pipeline for media plan generation
- Contains:
  - `index.ts` - Pipeline orchestrator
  - `extract.ts` - Stage 1: Gemini Flash extraction
  - `research.ts` - Stage 2: Perplexity market research
  - `logic.ts` - Stage 3: GPT-4o decision logic
  - `synthesize.ts` - Stage 4: Claude synthesis
  - `media-plan-generator.ts` - 11-section generator

**src/types/:**
- Purpose: Global TypeScript type definitions
- Contains: `html2pdf.d.ts` - PDF export types

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Landing page
- `src/app/layout.tsx` - Root layout
- `src/middleware.ts` - Auth middleware

**Configuration:**
- `tsconfig.json` - TypeScript (strict mode, path aliases)
- `next.config.ts` - Next.js
- `eslint.config.mjs` - ESLint (flat config)
- `components.json` - shadcn/ui
- `postcss.config.mjs` - PostCSS with Tailwind

**Core Logic:**
- `src/lib/openrouter/client.ts` - AI model client
- `src/lib/media-plan/pipeline/media-plan-generator.ts` - Media plan orchestrator
- `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` - Blueprint orchestrator
- `src/lib/storage/local-storage.ts` - Client persistence

**Testing:**
- No test files detected

**Documentation:**
- `README.md` - Project overview
- `docs/progress.md` - Development progress

## Naming Conventions

**Files:**
- Components: kebab-case.tsx (e.g., `form-wizard.tsx`, `step-business-basics.tsx`)
- Utilities/Services: kebab-case.ts (e.g., `local-storage.ts`, `media-plan-generator.ts`)
- Types: kebab-case.ts with descriptive suffix (e.g., `output-types.ts`, `types.ts`)
- Routes: `route.ts` (Next.js convention)
- Pages: `page.tsx` (Next.js convention)

**Directories:**
- Lowercase kebab-case (e.g., `media-plan/`, `strategic-blueprint/`)
- Plural for collections (e.g., `components/`, `types/`)

**Special Patterns:**
- `index.ts` for barrel exports
- `step-*.tsx` for wizard step components
- `*-display.tsx` for result display components

## Where to Add New Code

**New Feature:**
- Primary code: `src/lib/{feature-name}/`
- Types: `src/lib/{feature-name}/types.ts`
- API route: `src/app/api/{feature-name}/route.ts`
- Page: `src/app/{feature-name}/page.tsx`
- Components: `src/components/{feature-name}/`

**New UI Component:**
- Shadcn primitive: `src/components/ui/{component}.tsx`
- Feature component: `src/components/{feature}/`

**New API Endpoint:**
- Route handler: `src/app/api/{path}/route.ts`
- Validation: inline in route handler

**Utilities:**
- Shared helpers: `src/lib/utils.ts`
- Type definitions: `src/lib/{domain}/types.ts` or `src/types/`

## Special Directories

**.planning/:**
- Purpose: Project planning documents
- Source: Created by GSD workflow
- Committed: Yes

**node_modules/:**
- Purpose: npm dependencies
- Source: npm install
- Committed: No (in .gitignore)

**.next/:**
- Purpose: Next.js build output
- Source: next build
- Committed: No (in .gitignore)

---

*Structure analysis: 2025-12-24*
*Update when directory structure changes*
