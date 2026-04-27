# Skill-First Overhaul Discover

## 1. Ask

Re-ground the AIGOS overhaul around the current production Journey flow and turn the skill-first migration into a coherent, buildable architecture plan.

## 2. Success Criteria

- Production Journey remains URL-form-driven: URL/input review starts research without requiring slash commands.
- Skill folders become the durable unit of product IP without breaking the Next.js app build.
- The architecture doc resolves shared-library, layering, runtime-shape, and repo-boundary contradictions before Phase A implementation.
- The reference `research-competitor` skill keeps passing its own check/validate gate while the root app keeps passing `npm run build`.
- The next implementation plan decomposes work into testable slices with explicit verification commands and commit boundaries.

## 3. In Scope

- `.claude/architecture/v3-skill-first.md` and `.claude/architecture/research-findings.md`
- Root `CLAUDE.md` skill-first preamble
- `skills/**` architecture, especially `skills/research-competitor`
- `.claude/commands/*` and `.claude/skills/*` bridge strategy
- `src/app/journey/page.tsx`, `src/app/api/journey/dispatch/route.ts`, and `src/app/api/journey/stream/route.ts` only where they define Journey orchestration boundaries
- Root build/test configuration that determines whether skill code is compiled by the app

## 4. Out of Scope

- Replacing all `research-worker/src/runners/*` in this pass
- Rebuilding the Journey UI visual system before the runtime contract is resolved
- Deploying Vercel or Railway
- Touching `.env*`, secrets, Clerk auth, or Supabase schema except where a later approved plan explicitly requires migrations
- Cleaning `.omc/**` session state churn

## 5. Do-Not-Load

- `node_modules/**`
- `.next/**`
- `research-worker/node_modules/**`
- `.claude/usage-data/**`
- `.omc/sessions/**` and `.omc/state/sessions/**` unless debugging a session-state tool failure
- Generated lockfiles unless dependency boundaries become the active task

## 6. Size Classification

`week+` / `beast-mode`: this changes product architecture, runtime boundaries, test strategy, and migration sequencing across the Next.js app, Railway worker, and skill folders.

## Audit

- Completed: 2026-04-24 Asia/Karachi.
- Assumption: the product should preserve the current URL-form-driven Journey unless explicitly rejected by Ammar.
- Rationale: current production docs, Journey page, dispatch route, and team feedback all treat URL review -> automatic research -> workspace as the core UX; the slash-command-only decision is unvalidated and contradicts that flow.
