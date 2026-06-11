# AGENTS.md - AI-GOS Root DOX Contract

## Purpose

- This is the binding root work contract for AI-GOS agents.
- AI-GOS is the AI-powered Go-to-Market Operations System for source-backed SaaS positioning, GTM research, audit reading, and profile persistence.
- Read `docs/source-map.md` before architecture-sensitive work. It is the verified, path-accurate map of the research pipeline.
- Read `CLAUDE.md` for Claude-specific operating defaults, but do not let it contradict this DOX chain.

## Ownership

- This root file owns project-wide workflow, code style, anti-hallucination rules, architecture invariants, verification expectations, and the top-level Child DOX Index.
- Child `AGENTS.md` files own local contracts for their subtree. The closer file controls local details, but no child may weaken DOX or project-wide safety rules.
- Hidden/tooling state such as `.agents/`, `.claude-flow/`, `.codex/`, `.gstack/`, `.omc/`, `.playwright-mcp/`, `.vercel/`, and `tmp/` is not product source unless the task explicitly names it.

## Local Contracts

### DOX Workflow

- `AGENTS.md` files are binding work contracts for their subtrees.
- Before editing, read this file, identify every file or folder you expect to touch, walk from the repo root to each target path, and read every `AGENTS.md` on that path.
- If a parent lists a child `AGENTS.md` whose scope contains the target, read that child and continue.
- After every meaningful edit, run a DOX pass: re-check changed paths against the applicable chain, update nearest owning docs when contracts changed, refresh affected Child DOX Indexes, and remove stale or contradictory text.
- Update the closest owning `AGENTS.md` when a change affects purpose, scope, ownership, durable structure, workflow, operating rules, required inputs/outputs, permissions, side effects, artifacts, user preferences, or agent-doc indexes.
- Small implementation edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

### User Preferences

- Ammar is a senior AI developer building production SaaS. Treat exact paths, commands, run IDs, branch names, handoff files, and proof artifacts as hard contracts.
- Do not invent status, market data, statistics, pricing, competitor claims, API endpoints, or verification results.
- When asked to execute a named spec or handoff, implement that artifact after quick repo orientation. Do not turn it into a plan recap.
- When asked for diagnosis, find the root cause before editing.
- When asked for read-only work, do not let a write-heavy spec override that constraint.
- Keep outputs artifact-first: exact files, exact commands, exact evidence, and clear limits.

### Code Style

- TypeScript strict mode everywhere. No `any`, no implicit types, no silent type escapes.
- Use explicit return types on functions and named exports only.
- Use kebab-case for files/directories and `Props` suffixes for React prop interfaces.
- Prefer pure, single-purpose functions. Do not mutate inputs or global state.
- Avoid flag parameters that switch multi-mode behavior.
- Keep imports at the top. Prefer `@/` absolute imports for app source.
- Use `cn()` or `clsx` for conditional classes.
- Follow DRY, KISS, and YAGNI. Search for existing logic before adding new code.

### Error Handling

- Raise errors explicitly with actionable messages.
- Include relevant context: request params, response status, run IDs, profile IDs, section IDs, and provider/tool names.
- Do not hide root causes behind catch-all handlers.
- Do not add fallback behavior unless explicitly requested or already part of a documented local contract.
- External API calls may retry with warnings, then must throw the final error.
- Use structured logging fields, not interpolated diagnostic strings.

### Architecture Invariants

- Framework: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui new-york, Clerk, Supabase, Vercel AI SDK v6.
- Canonical user-facing research surface: `src/app/research-v3/page.tsx`.
- The `/research-v2` page route is deleted. Do not reintroduce it unless explicitly asked.
- The `/journey` page route is deleted. Do not reference it as a current surface.
- The `src/app/api/research-v2/*` routes remain the live backend used by `/research-v3`.
- Research flow: `deepResearchProgram -> positioningMarketCategory -> positioningBuyerICP -> positioningCompetitorLandscape -> positioningVoiceOfCustomer -> positioningDemandIntent -> positioningOfferDiagnostic -> positioningPaidMediaPlan`.
- The six positioning sections plus paid media plan run in-process through `src/lib/lab-engine/`.
- `research-worker/` is a separate Railway process for worker-backed corpus, identity, meeting extraction, and legacy worker concerns. It cannot import from `src/lib/`.
- Shared shapes crossing the app/worker boundary must be mirrored intentionally on both sides.
- DB truth usually outranks UI truth. Verify durable research state in Supabase-backed tables when live proof matters.

### AI and Research Rules

- Preserve Vercel AI SDK v6 patterns for user-facing chat/edit behavior: `useChat`, `DefaultChatTransport`, UI message streams, and AI SDK tool calls.
- New AI SDK structured-output code should follow the current Vercel AI SDK v6 patterns already in the repo.
- Use Zod schemas for AI outputs, API inputs, and persisted contracts.
- Tool results must be validated before generation or persistence.
- All research claims must come from user-provided context, approved tools/APIs, live model/tool outputs, or persisted source artifacts.
- If a tool returns no data, report that. Do not fill gaps with plausible text.

### Commands

```bash
npm run dev
npm run build
npm run lint
npm test
npm run test:run
```

Worker commands:

```bash
cd research-worker && npm run dev
cd research-worker && npm run build
cd research-worker && npm run test:run
```

### Done Means

- The code compiles or the relevant verification command is run and reported honestly.
- Existing and new relevant tests pass, or any skipped tests are named with the reason.
- Types remain strict and complete.
- Error cases are handled explicitly.
- No unrelated worktree changes are reverted or modified.
- Meaningful feature/fix work is committed atomically when the user or applicable workflow requires commits.

## Work Guidance

- Use `rg` for search and non-interactive commands such as `git --no-pager diff`.
- Prefer minimal diffs that match local style.
- Read dependency/source code when behavior is unclear.
- Use `pnpm` only where the project provides it; this repo currently uses npm scripts.
- Do not install global dependencies. Add project dependencies through package manifests.
- For UI work, read `DESIGN.md` and the relevant component subtree docs first.
- For production bug work, start with environment, auth, worker reachability, and DB state before deep source edits.

## Verification

- Root-level code changes normally require `npm run lint` and `npm run test:run`; narrow changes may use scoped Vitest or touched-file lint when repo-wide noise is pre-existing and documented.
- Worker changes require `cd research-worker && npm run build` and relevant worker tests.
- DB migrations require schema review plus related app/worker contract tests.
- Documentation-only DOX changes require at least `git diff --check` and a final DOX chain review.

## Child DOX Index

- `src/AGENTS.md` - Next.js product source: routes, components, hooks, domain libraries, tests, and shared types.
- `research-worker/AGENTS.md` - Separate Railway worker package for corpus, extraction, worker tools, and worker evals.
- `docs/AGENTS.md` - Architecture maps, ADRs, handoffs, plans, reports, specs, and archived docs.
- `supabase/AGENTS.md` - Database schema, migrations, RLS, SQL functions, and Supabase scripts.
- `scripts/AGENTS.md` - Repo automation, diagnostics, soak scripts, canaries, and recovery/proof scripts.
- `public/AGENTS.md` - Static assets, icons, manifest files, and public browser-served files.
