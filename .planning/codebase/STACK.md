# Technology Stack

**Analysis Date:** 2026-01-21

## Languages

**Primary:**
- TypeScript 5 - Full codebase (frontend and backend)
- JavaScript - Configuration files

**Secondary:**
- JSX/TSX - React components

## Runtime

**Environment:**
- Node.js (version inferred from package.json, no explicit version specified)
- Browser (React 19.2.1)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.0.10 - Full-stack framework for API routes and pages
- React 19.2.1 - UI component library
- React DOM 19.2.1 - DOM rendering

**Testing:**
- Vitest 4.0.17 - Unit and integration testing framework
- @testing-library/react 16.3.1 - React component testing
- @testing-library/jest-dom 6.9.1 - DOM matchers for assertions
- jsdom 27.4.0 - DOM environment simulation

**Build/Dev:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- PostCSS 4 - CSS transformation (postcss.config.mjs)
- ESLint 9 - Linting
- eslint-config-next 16.0.10 - Next.js ESLint configuration
- @vitejs/plugin-react 5.1.2 - React support for Vitest
- TypeScript - Type checking
- ts-node - TypeScript execution (implicit from vitest)

## Key Dependencies

**Critical:**
- @supabase/ssr 0.8.0 - Server-side rendering authentication with Supabase
- @supabase/supabase-js 2.87.1 - Supabase client for database and auth
- zod 4.2.1 - Runtime schema validation (used for OpenRouter API responses)

**UI Components & Styling:**
- @radix-ui/react-checkbox 1.3.3 - Accessible checkbox component
- @radix-ui/react-collapsible 1.1.12 - Collapsible panels
- @radix-ui/react-label 2.1.8 - Form labels
- @radix-ui/react-progress 1.1.8 - Progress indicators
- @radix-ui/react-select 2.2.6 - Dropdown select
- @radix-ui/react-slot 1.2.4 - Component composition utility
- @radix-ui/react-tooltip 1.2.8 - Accessible tooltips
- embla-carousel-react 8.6.0 - Carousel/slider component
- lucide-react 0.561.0 - Icon library (560+ icons)
- framer-motion 12.26.1 - Animation library
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.4.0 - Tailwind CSS class merging

**Utilities:**
- nanoid 5.1.6 - ID generation
- html2pdf.js 0.12.1 - PDF generation from HTML
- react-resizable-panels 4.4.1 - Resizable panel layouts

**Type Definitions:**
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions

**Coverage:**
- @vitest/coverage-v8 4.0.17 - Code coverage reporting with V8

## Configuration Files

**Build/TypeScript:**
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2017
  - Module: esnext
  - Strict mode enabled
  - Path alias: `@/*` → `./src/*`
  - JSX: react-jsx
- `next.config.ts` - Next.js configuration (minimal, no custom config)
- `vitest.config.ts` - Vitest configuration
  - Environment: jsdom
  - Globals enabled
  - Setup file: `./src/test/setup.ts`
  - Test patterns: `src/**/*.{test,spec}.{ts,tsx}`
  - Coverage provider: v8

**CSS:**
- `postcss.config.mjs` - PostCSS configuration with Tailwind plugin

**Linting:**
- `eslint.config.mjs` - ESLint configuration
  - Extends: next/core-web-vitals, next/typescript
  - Ignores: .next/**, out/**, build/**, next-env.d.ts

**Component Library:**
- `components.json` - Likely shadcn/ui or similar component library configuration

## Environment Configuration

**Development:**
- Node version: Not pinned (.nvmrc absent, version inferred from package.json ranges)
- `.env.local` - Local environment variables (git-ignored)

**Environment Variables Required:**

**Server-side (private):**
- `OPENROUTER_API_KEY` - OpenRouter API credentials for LLM access
- `SEARCHAPI_KEY` - Search API credentials (for web search capabilities)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin credentials (server-only)

**Client-side (public):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_APP_URL` - Application URL (optional, used for OpenRouter headers)

**Secrets Location:**
- Environment variables stored in `.env.local` (development)
- Vercel environment variables (production via Vercel CLI)
- No .env file committed to version control

## Platform Requirements

**Development:**
- Node.js (no specific version requirement detected)
- npm (for package management)
- Modern terminal (development scripting)

**Production:**
- Vercel (confirmed via `.vercel/project.json`)
- Node.js runtime (for serverless functions)
- Browser support: Modern browsers (ES2017 target)

**Deployment:**
- Vercel hosting
- Serverless functions with up to 300 second timeout (Pro tier)
- Standard Next.js deployment pipeline

**Browser Compatibility:**
- ES2017 target means support for modern JavaScript features
- React 19 requirements

## Package Scripts

```bash
dev              # Start development server (next dev)
build            # Build for production (next build)
start            # Start production server (next start)
lint             # Run ESLint
test             # Run tests in watch mode (vitest)
test:run         # Run tests once (vitest run)
test:coverage    # Generate coverage report (vitest run --coverage)
```

## Performance Tuning

**API Timeout:**
- Default OpenRouter timeout: 45 seconds (`DEFAULT_TIMEOUT_MS = 45000`)
- Media plan pipeline timeout: 60 seconds (MVP requirement)
- Vercel serverless timeout: 300 seconds (Pro tier)

**JSON Retry Logic:**
- Retries: 2 by default
- Exponential backoff: 1s, 2s, 4s... up to 10s with jitter
- Rate limit backoff: 5s-30s for 429 errors
- Temperature scaling: 0.7 (first attempt) → 0.3 (retries)

---

*Stack analysis: 2026-01-21*
