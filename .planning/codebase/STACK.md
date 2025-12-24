# Technology Stack

**Analysis Date:** 2025-12-24

## Languages

**Primary:**
- TypeScript 5 - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript - Build scripts, ESM config files (`eslint.config.mjs`, `postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js (LTS) - Implied by Next.js
- No explicit version file (.nvmrc, .node-version not detected)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.0.10 - Full-stack framework with App Router (`package.json`)
- React 19.2.1 - UI framework (`package.json`)

**Testing:**
- Not configured (no test framework detected)

**Build/Dev:**
- TypeScript 5 - Compilation and type checking (`tsconfig.json`)
- ESLint 9 - Linting (`eslint.config.mjs`)
- PostCSS - CSS processing (`postcss.config.mjs`)

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.87.1 - Authentication and database (`src/lib/supabase/`)
- @supabase/ssr 0.8.0 - Server-side rendering integration
- OpenRouter API - Multi-model LLM access (`src/lib/openrouter/client.ts`)

**UI/Styling:**
- Tailwind CSS 4 - Utility-first CSS (`package.json`, `postcss.config.mjs`)
- @radix-ui/react-* - Accessible UI primitives (checkbox, label, progress, select, slot)
- class-variance-authority 0.7.1 - Component variants (`src/components/ui/`)
- clsx 2.1.1, tailwind-merge 3.4.0 - Class utilities
- lucide-react 0.561.0 - Icon library

**Infrastructure:**
- html2pdf.js 0.12.1 - PDF export functionality

## Configuration

**Environment:**
- `.env.local` - Local development environment variables
- Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_APP_URL`

**Build:**
- `tsconfig.json` - TypeScript strict mode, path aliases (`@/*` -> `./src/*`)
- `next.config.ts` - Next.js configuration
- `components.json` - shadcn/ui config (style: new-york, icons: lucide)

## Platform Requirements

**Development:**
- Any platform with Node.js
- No Docker required

**Production:**
- Vercel (implied by Next.js)
- Supabase cloud for auth/database

---

*Stack analysis: 2025-12-24*
*Update after major dependency changes*
