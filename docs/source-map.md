# AI-GOS — Source Map

> Orientation doc for an agent with no repo memory. Every path below is maintained against the current working tree. Where other docs and source reality disagree, this map follows source reality and flags the drift.

## 1. What this app is

AI-GOS ("AI GTM Operating System") generates strategic marketing/positioning blueprints for SaaS companies. A user enters a company URL, the app builds a source-backed **corpus** of company intelligence, the user confirms auto-prefilled GTM-brief fields, and then an orchestrator fans out **six positioning research sections** (Market Category, Buyer ICP, Competitor Landscape, Voice of Customer, Demand Intent, Offer Diagnostic) plus a synthesis/paid-media layer. Each section is produced by an in-process AI agent ("lab engine") that calls real tools (ad libraries, keyword/SEO probes, page-speed, reviews, web fetch) and emits a typed, schema-validated artifact rendered as cards in the **Audit Reader**. Results persist to a business **profile**. Stack: Next.js 16 (App Router) + Vercel AI SDK v6, Anthropic Claude / DeepSeek, Supabase (DB + realtime), Clerk auth, and a separate Railway worker process for the long-running corpus build.

---

## 2. Request / data flow of the research pipeline

The canonical user surface is **`/research-v3`** (the old `/research-v2` *page* route is gone, but the `research-v2` *libraries, components, and API routes* are still the live backend — the v3 page reuses them). The flow:

1. **URL entry page** — `src/app/research-v3/page.tsx` (client). State machine `welcome → corpus → onboarding → sections → error`, driven by `src/lib/research-v2/state-machine.ts`. The welcome form is `src/components/research-v2/welcome-form.tsx`.

2. **Corpus dispatch (deepResearchProgram)** — page submits to a research-v2 API route which calls the dispatch helper `src/lib/journey/server/dispatch-research.ts`. That helper maps section key `deepResearchProgram → 'runDeepResearchProgram'` (see its `TOOL_MAP` around line 31) and **proxies to the Railway worker `POST /run`**. The worker entry is `research-worker/src/index.ts`; the runner is `research-worker/src/runners/deep-research-program.ts`. The corpus is the ONLY heavy research that still runs on the worker.

3. **GTM Brief review** — corpus completes, `src/components/research-v2/corpus-stream.tsx` shows progress; the onboarding wizard (`src/components/onboarding/`) opens prefilled from corpus via `src/lib/research-v2/prefill-from-corpus.ts` + `corpus-context.ts`. User confirms/edits and submits.

4. **Fan-out — `POST /api/research-v2/orchestrate`** — `src/app/api/research-v2/orchestrate/route.ts` (`runtime='nodejs'`, `maxDuration=300`). It seeds a `seed_orchestration` row (idempotency guard against double-kickoff) and `dispatchLabSectionJobs(...)` kicks off each section by calling the per-section route. Section list = `POSITIONING_SECTION_IDS` from `src/lib/ai/prompts/positioning-skills/index.ts`.

5. **Per-section execution — `POST /api/research-v2/run-lab-section`** — `src/app/api/research-v2/run-lab-section/route.ts` (`maxDuration=800`). This runs the **lab engine in-process on Vercel** (NOT the worker). It builds input via `src/lib/research-v2/corpus-to-research-input.ts`, then calls the lab-engine entry `runSection()` in `src/lib/lab-engine/agents/run-section.ts`. Paid media can be kicked to `POST /api/research-v2/run-paid-media-plan` for an isolated composer clock after the six positioning sections are complete. (`POST /api/research-v2/dispatch` and `/rerun-section` are the single-section variants; `dispatch` still proxies the *worker*, lab sections do not.)

6. **The 6 positioning sections (lab engine)** — agent loop in `src/lib/lab-engine/agents/` (`run-section.ts` answer-tool path → repair → rescue; `section-agent.ts`, `answer-tool.ts`, `section-tools.ts`, `tool-registry.ts`). Section definitions/output schemas: `src/lib/lab-engine/sections/section-registry.ts`. Per-section prompt skills: `src/lib/lab-engine/skills/positioning-*/SKILL.md`. Real tools (ad libraries, keyword/SEO, reviews, pagespeed, web fetch): `src/lib/lab-engine/agents/tools/`. Each section emits an artifact validated against `src/lib/lab-engine/artifacts/schemas/<section>.ts`.

7. **Audit Reader typed cards** — `src/components/research-v2/audit-reader-shell.tsx` is the reader; `src/components/research-v2/typed-artifact-renderer.tsx` switches on `zoneId` and dispatches to per-section renderers in `src/components/research-v2/section-renderers/` (`market-category.tsx`, `buyer-icp.tsx`, `competitor-landscape.tsx`, `voice-of-customer.tsx`, `demand-intent.tsx`, `offer-diagnostic.tsx`, `positioning-synthesis.tsx`, `paid-media-plan.tsx`). The v3 page wraps it with reader-section config in `src/components/research-v3/reader-sections.ts`.

8. **Realtime / polling push** — sections commit to Supabase; the frontend gets updates via realtime broadcast + polling. Broadcast (server→Supabase): `src/lib/research-v2/realtime-broadcast.ts` + `section-partial-broadcaster.ts`. Client subscription/polling hook: `src/lib/journey/research-realtime.ts` (`useResearchRealtime`). Live activity stream sanitizer: `src/lib/research-v2/section-activity.ts`.

9. **Persist to profile** — results saved to the business profile (`src/lib/profiles/business-profiles.ts`); detail page `src/app/profiles/[id]/` has Overview, Research, and Assets tabs.

---

## 3. Where things live

### 3.0 Folder tree (bird's-eye)

`★` = live/canonical surface. Names like `research-v2` are **not** legacy — only the old `/research-v2` *page* was removed; its libs/components/API routes are the live backend the `v3` page reuses.

```
AI-GOS/
├── src/                              ← Next.js 16 app (the product)
│   ├── middleware.ts                 ← Clerk auth middleware
│   ├── app/                          ← routes (App Router)
│   │   ├── research-v3/              ★ canonical live runner (Audit Reader front door)
│   │   ├── research/[sessionId]/       legacy V1 saved-report viewer (kept; de-listed from nav)
│   │   ├── onboarding/ dashboard/ profiles/[id]/ shared/[token]/ internal/
│   │   ├── sign-in/ sign-up/ access-pending/ access-disabled/
│   │   └── api/
│   │       ├── research-v2/          ★ live research backend (v3 page calls this)
│   │       │   ├── orchestrate/        fan-out all 6 sections
│   │       │   ├── run-lab-section/    in-process lab engine (per section)
│   │       │   ├── run-paid-media-plan/ dedicated paid-media composer dispatch
│   │       │   ├── dispatch/ rerun-section/   single-section (dispatch = worker proxy)
│   │       │   ├── chat/               workspace strategist chat/edit + strategyBrief/rerun side effects
│   │       │   └── abort-section/ audit-state/ onboarding/ _capabilities/
│   │       ├── journey/session/ onboarding/ profiles/ share/[token]/
│   │       ├── documents/ meetings/ transcribe/ integrations/ webhooks/clerk/
│   │       └── admin/ auth/me/ health/ image-proxy/
│   ├── components/
│   │   ├── research-v3/              ★ v3 reader shell + section config
│   │   ├── research-v2/              ★ audit reader, typed-artifact-renderer, section-renderers/
│   │   ├── research/                 legacy V1 viewer components (intel-cards/)
│   │   ├── shell/                    app sidebar / nav
│   │   ├── workspace/ onboarding/ chat/ assets/ generate/ pipeline/
│   │   ├── ui/                       shadcn/ui (new-york)
│   │   └── ai-elements/ ai/ shared/
│   ├── lib/                          ← domain logic
│   │   ├── lab-engine/               ★ in-process section engine (DeepSeek + live tools)
│   │   │   ├── agents/               run-section.ts, tools/, verification/
│   │   │   ├── artifacts/schemas/    per-section Zod schemas
│   │   │   ├── sections/             section-registry
│   │   │   ├── skills/               8 positioning skills (market-category … paid-media-plan)
│   │   │   └── ai/ events/ runs/ streaming/ fixtures/
│   │   ├── research-v2/              ★ orchestration glue (state machine, corpus→input, realtime)
│   │   ├── research-v3/              v3-specific helpers
│   │   ├── journey/                  dispatch-research, field-catalog, realtime, server/
│   │   ├── workspace/                pipeline, card-taxonomy
│   │   ├── ai/                       providers, prompts/positioning-skills/, tools/research/
│   │   ├── research/                 pipeline-controller + types
│   │   ├── media-plan/               media-plan schemas/synthesis (legacy pipeline.ts removed)
│   │   ├── blueprints/ strategic-blueprint/   (kept; used by share route + others)
│   │   ├── meeting-intel/ company-intel/ onboarding/ profiles/ pricing/
│   │   ├── ad-library/ foreplay/ firecrawl/ integrations/
│   │   └── actions/ auth/ chat/ documents/ storage/ supabase/
│   └── hooks/   types/   test/(mocks/)
│
├── research-worker/                  ← separate Railway process (CANNOT import src/lib)
│   └── src/
│       ├── index.ts                  HTTP entry — allows ONLY 3 tools:
│       │                             runDeepResearchProgram, resolveIdentity, extractMeetingTranscript
│       ├── runners/                  the 3 runners above
│       ├── identity/ intelligence/(cards, schemas) planning/ validators/
│       ├── skills/(methodologies/, refs/, templates/)  prompts/runners/
│       ├── competitors/              legacy copy — do not touch
│       └── eval/ tools/ utils/ types/  + runner.ts, supabase.ts, contracts.ts, auth.ts, env.ts
│
├── docs/                             ← source-map.md (this file) + adr/ architecture/ corpus/
│                                       design/ specs/ plans/ handoffs/ qa/ audit/ migrations/ _archive/
├── supabase/   migrations/ + scripts/
├── scripts/    public/               repo automation + static assets
├── Config (root)                     package.json, next.config.ts, tsconfig.json, eslint.config.mjs,
│                                       vitest.config.ts, components.json, .mcp.json, .env.example
├── Docs (root)                       README.md, CLAUDE.md, CONTEXT.md, DESIGN.md
├── Agent personas (root)             AGENTS/PRIMER/SOUL/IDENTITY/HEARTBEAT/TOOLS/USER.md
└── Tooling (tracked)                 .claude/ .cursor/ .openclaw/
    (gitignored local-only: .next/ node_modules/ .env.local .agents/ .codex/ .omc/
     .gstack/ .superpowers/ .playwright-mcp/ .claude-flow/ .vercel/)
```

### `src/` (Next.js app — frontend + in-process backend)

| Dir | Owns |
|---|---|
| `src/app/` | Next.js App Router. Pages (`research-v3/`, `profiles/`, `onboarding/`, `dashboard/`, root `page.tsx`) + all API routes under `src/app/api/`. |
| `src/app/api/research-v2/` | The live research backend routes: `orchestrate/` (fan-out), `run-lab-section/` (in-process section), `run-paid-media-plan/` (dedicated paid-media composer dispatch), `dispatch/` + `rerun-section/` (single-section, worker proxy), `abort-section/`, `audit-state/`, `chat/`, `onboarding/`, `_capabilities/`. |
| `src/lib/lab-engine/` | **The heart of section research.** In-process AI agent: `agents/` (run-section, tools, verification), `sections/` (registry, sub-sections, required-evidence), `artifacts/schemas/` (per-section Zod output schemas), `skills/positioning-*/SKILL.md` (prompts), `ai/models.ts` (provider switch), `runs/` (run store), `streaming/`, `events/`, `fixtures/`. |
| `src/lib/research-v2/` | Orchestration glue: state machine, corpus→input mapping, onboarding-review, orchestrate DB/session, realtime broadcast, section partials, audit artifact schema, dispatch job plumbing. |
| `src/lib/journey/` | Journey/session domain: `server/dispatch-research.ts` (worker proxy), `research-realtime.ts` (client subscribe), field-catalog, schemas, session-state, research-result contract. |
| `src/lib/ai/` | AI configuration + non-section AI: `providers.ts` (Anthropic/Perplexity clients, MODELS, costs), `prompts/`, `sections/`, `tools/`, `groq-provider.ts`, `spyfu-client.ts`. |
| `src/lib/` (other) | `supabase/` (clients), `auth/` (Clerk app-access guards), `profiles/`, `media-plan/`, `meeting-intel/`, `company-intel/`, `onboarding/`, `storage/` (localStorage), per-vendor clients (`foreplay/`, `firecrawl/`, `meta-ads/`, `google-ads/`, `ga4/`, `ad-library/`), `env.ts`, `logger.ts`. |
| `src/components/` | UI. `research-v2/` (reader shell, typed-artifact-renderer, section-renderers, corpus/welcome forms), `research-v3/` (reader-sections config), `onboarding/`, `shell/`, `ui/` (shadcn), `ai-elements/`, `workspace/`, `profiles`-related under `research/`. |
| `src/hooks/`, `src/types/`, `src/middleware.ts` | React hooks, shared TS types, Clerk middleware. |

### `research-worker/src/` (separate Railway process — long-running corpus only)

| Dir / file | Owns |
|---|---|
| `index.ts` | Express entry. `POST /run` (dispatches `TOOL_RUNNERS`), `POST /abort`, `GET /health`, `GET /capabilities`. Bounded concurrency + per-tool timeouts. |
| `runners/` | Worker runner exports: `deep-research-program.ts` (the corpus main job), `meeting-extract.ts`, and `index.ts`, which also re-exports identity resolution from `../identity/resolve-identity.ts`. **NOTE:** the 6 positioning runners were deleted from the worker and now live in `src/lib/lab-engine/`. |
| `contracts.ts` | Zod schemas for worker job inputs/outputs (the duplicated half of the schema-duplication rule). |
| `tools/` | Worker-side tool integrations: `adlibrary.ts`, `apify-ads.ts`, `firecrawl.ts`, `keyword-ad-probe.ts`, `reviews.ts`, and `spyfu.ts`, plus shared ad-library types. |
| `competitors/` | Competitor discovery/fetch: `parse-context.ts`, `parallel-fetch.ts`, `sonar-research.ts`, `review-cross-analysis.ts`. |
| `identity/` | `resolve-identity.ts` — resolves the company identity from a URL. |
| `intelligence/` | Intelligence cards, `dispatcher.ts`, `evidence-packer.ts`, `fabrication-sweep.ts`. |
| `skills/`, `prompts/`, `planning/` | Worker prompt skills, prompt runners, `opus-planner.ts`. |
| `models.ts`, `env.ts`, `auth.ts`, `supabase.ts`, `events.ts`, `emit-progress.ts`, `capabilities.ts` | Worker infra: model config, env, API-key auth, Supabase writes, progress streaming, capabilities payload. |
| `validators/`, `utils/`, `types/`, `eval/`, `__tests__/` | Validation, helpers, types, eval/diagnostic scripts, tests. |

---

## 4. Next.js app ↔ Railway worker boundary + schema-duplication rule

There are **two independent Node processes** with NO shared imports:

- **Next.js app** (`src/`) — deploys to Vercel. Runs all API routes AND, importantly, runs the **lab engine (6 positioning sections) in-process** inside `run-lab-section`/`orchestrate` route lambdas. Because of this, section tool keys like `SEARCHAPI_KEY`, `DEEPSEEK_API_KEY`, Anthropic/Perplexity keys must be present in **Vercel** env, not only on the worker.
- **Railway worker** (`research-worker/`) — deploys separately (`cd research-worker && railway up`). Runs only `runDeepResearchProgram`, `resolveIdentity`, and `extractMeetingTranscript` via `POST /run`. Reached through `RAILWAY_WORKER_URL` + `RAILWAY_API_KEY`; without those, worker dispatch **fails silently**.

**Hard boundary rule:** `research-worker/` **cannot import from `src/lib/`** (separate `package.json`, separate build). Any schema/type needed on both sides must be **defined in both places**. The frontend's research contracts live in `src/lib/journey/research-result-contract.ts` / `src/lib/research-v2/*` and the section schemas in `src/lib/lab-engine/artifacts/schemas/`; the worker's mirror lives in `research-worker/src/contracts.ts`. When you change a shared shape, edit both copies or the contract silently diverges. (Same applies to dispatch tool-name maps and any stale-threshold constants the dispatch route mirrors from the worker.)

The worker entry exposes a `GET /capabilities` self-report; the Next.js side mirrors it at `GET /api/research-v2/_capabilities` (1.5s timeout fetch). Per repo notes this is a **diagnostic only** — do not gate a run on `orchestrate_supported`; the worker hardcodes it false even though sections run fine in-process.

---

## 5. Key seams

- **Where AI calls are configured (providers):**
  - App-wide / non-section AI: `src/lib/ai/providers.ts` — builds `createAnthropic(...)` and `createPerplexity(...)` clients, exports `MODELS`, `SECTION_MODELS`, cost tables. Default Anthropic model + Perplexity `sonar-pro`.
  - **Lab-engine section provider switch:** `src/lib/lab-engine/ai/models.ts` — `resolveSectionModelProvider()` reads `LAB_ENGINE_PROVIDER` env (`anthropic` | `deepseek-direct` | `deepseek-ollama`). Anthropic uses `claude-sonnet-4-5`; DeepSeek-direct uses `deepseek-v4-flash` via `createDeepSeek({apiKey: DEEPSEEK_API_KEY})`. This is the knob that decides which model the 6 sections actually run on.
  - Worker models: `research-worker/src/models.ts`.

- **Where schemas / types live:**
  - Section artifact output schemas (the typed cards): `src/lib/lab-engine/artifacts/schemas/<section>.ts` (+ `__tests__`). Section definitions + `validateMinimums` per section: `src/lib/lab-engine/sections/section-registry.ts`; sub-section + evidence specs: `sub-sections.ts`, `required-evidence.ts`.
  - Research-result + dispatch contracts (app side): `src/lib/journey/research-result-contract.ts`, `src/lib/research-v2/audit-artifact-schema.ts`, `src/lib/research-v2/orchestrate-db.ts`.
  - Worker-side mirror: `research-worker/src/contracts.ts`. (See §4 duplication rule.)
  - Field catalog / onboarding fields (must sync across 6 places — see CLAUDE.md gotcha): `src/lib/journey/field-catalog.ts`.

- **Where the lab-engine section runners live:** `src/lib/lab-engine/agents/run-section.ts` is the entry (`runSection()`, plus answer-tool / structured-body-stream paths, repair, and the competitor-ad probe). Supporting: `section-agent.ts`, `answer-tool.ts`, `section-tools.ts`, `tool-registry.ts`, `build-prompts.ts`, `budget.ts`, `verification/`. Prompts per section: `src/lib/lab-engine/skills/positioning-*/SKILL.md`.

- **Realtime / polling path:**
  - Server publishes section partials/results to Supabase realtime: `src/lib/research-v2/realtime-broadcast.ts` (`broadcastSectionPartial`) + `section-partial-broadcaster.ts`.
  - Client subscribes + polls: `src/lib/journey/research-realtime.ts` (`useResearchRealtime`, freshness checks, polling fallback). Section-partial consumer hooks: `src/lib/research-v2/use-section-partials.ts`, `use-audit-state.ts`.
  - Live activity feed (sanitized progress events shown in the reader): `src/lib/research-v2/section-activity.ts` → `src/components/research-v2/activity-rail.tsx`.

---

### Current Cross-Checks
1. Canonical page is **`src/app/research-v3/page.tsx`**, not `research-v2/page.tsx` (deleted). The v2 *libs/components/API routes* remain the live backend.
2. The **6 positioning runners are NOT in `research-worker/src/runners/`** — they are the in-process lab engine in `src/lib/lab-engine/`. The worker now runs only corpus, identity resolution, and meeting extraction.
3. Section research runs **in-process on Vercel**, so section API keys (`SEARCHAPI_KEY`, `DEEPSEEK_API_KEY`, etc.) must be in **Vercel** env, not the worker. The `bug-triage.md` "worker reachability" check only matters for the corpus step.
