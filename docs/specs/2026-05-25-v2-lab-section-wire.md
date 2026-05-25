# Spec — Wire the lab section engine into AI-GOS (v2)

**Date:** 2026-05-25 · **Branch:** `feat/v2-lab-section-wire` · **Status:** EXECUTION

## GOAL
Run the `ai-gos-ai-sdk-lab` answer-tool **6-section engine** inside AI-GOS, fed by the
existing deep-research **corpus**, writing artifacts to Supabase so the **existing typed
renderers** display them — rendered in a new **v2 shell** (sections build up live).
**v1 = corpus-only synthesis (live tools OFF)** = the "no 540s per section" win.

## NON-GOALS (v1 — do not build)
- Per-token streaming (section-level reveal only; the activity feed makes it feel live).
- Live tools (web_search / firecrawl / spyfu / ads / pagespeed) — OFF for v1.
- The 7th paid-media-plan section.
- DeepSeek migration (stay on the lab engine's current Anthropic model).
- Touching `main`, the Railway worker, the Managed Agents path, or anything deployed to prod.
- PPTX / deck export.

## SOURCE PATHS
- Lab engine (copy FROM): `/Users/ammar/Dev-Projects/ai-gos-ai-sdk-lab/.claude/worktrees/media-plan-structure`
- AI-GOS (work IN): this worktree, `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`

---

## WORKSTREAM 1 — Engine port + adapter (the wire)

### 1.1 Port the lab engine → `src/lib/lab-engine/`
Copy and re-path imports (keep code changes minimal — the watchdog, conformance, and
answer-tool loop are the value, port them intact):
- lab `src/lib/agents/**` → `src/lib/lab-engine/agents/**` (run-section.ts, build-prompts.ts, tool-registry.ts, section-agent.ts, tools/**)
- lab `src/lib/artifacts/**` → `src/lib/lab-engine/artifacts/**` (artifact-envelope.ts, schemas/**)
- lab `src/lib/sections/**` → `src/lib/lab-engine/sections/**` (section-registry.ts)
- lab 6 skills `skills/positioning-*/SKILL.md` → `src/lib/lab-engine/skills/*/SKILL.md`
- Reconcile the model provider with AI-GOS's `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY` (do not import the lab's `.env`).

### 1.2 `src/lib/research-v2/corpus-to-research-input.ts` — corpus → lab `ResearchInput`
Lab `researchInputSchema` is `.strict()`. Map from
`journey_sessions.research_results['deepResearchProgram'].data` (= `{corpus, onboardingFields}`)
plus `journey_sessions.onboarding_data`:

| Lab field | Source | Transform |
|---|---|---|
| `runId` | `journey_sessions.run_id` | direct |
| `fixtureId` | synth | `brand_<slug(companyName)>` |
| `company.{id,name}` | `onboardingFields.companyName.value` | slug + value |
| `company.websiteUrl` | `onboarding_data.websiteUrl` | must be valid URL |
| `company.category` | `onboardingFields.industryVertical.value` | |
| `company.description` | `onboardingFields.productDescription.value` | |
| `company.stage` | **MISSING** | default `"growth"` |
| `company.targetCustomer` | `onboardingFields.primaryIcpDescription.value` | |
| `onboarding.primaryGoal` | `onboarding_data.primaryGoal` | default from `researchSummary` |
| `onboarding.targetSegments[]` | `onboarding_data` / `primaryIcpDescription` | min 1 |
| `onboarding.keyOffers[]` | `coreDeliverables.value` | min 1 |
| `onboarding.distributionChannels[]` | `onboarding_data` | min 1, default `["paid-search"]` |
| `onboarding.constraints[]` | `onboarding_data.constraints` | may be `[]` |
| `onboarding.notes` | `researchSummary` | non-empty |
| `corpus.excerpts[]` (min 3, each `text.min(80)`) | `corpus.evidence[]` | `text = "${claim} — ${quote}"`; guard ≥80 chars; if <3 valid, supplement from `corpus.sources[]` + `researchSummary`; gen `id`, `sourceId`, `observedAt=now`, `title=source`, `sourceUrl=url` |
| `sources[]` (min 1) | `corpus.sources[]` | `{id, title, url, observedAt=now}` |
| `competitorAds[]` (min 3, max 5) | **NO SOURCE** | v1: synthesize 3 schema-valid **synthetic** ads from `onboardingFields.topCompetitors.value` (platform `"google"`, derived `angle`, clearly-labeled synthetic). Document as a v1 compromise; revisit when CL re-enables tools. |

Validate output with `researchInputSchema.parse`; on failure, log the field + fill a safe default. Unit-test this with a corpus fixture.

### 1.3 `src/lib/research-v2/supabase-run-store.ts` — implement the lab `RunStore` interface, Supabase-backed
The lab engine takes `RunStore` via `deps` (no lab code change needed). Implement:
- `createRun(input)` — persist the mapped `ResearchInput` (scratch table or in-memory keyed by runId) so `readRun` returns it.
- `readRun(runId)` — return the `ResearchInput` + section states (`runSectionViaAnswerTool` calls this to fetch input).
- `saveArtifact(runId, envelope)` — `ensureArtifact(userId, runId)` → `startSectionRun(artifactId, zone)` → `commitArtifactSection(artifactId, zone, sectionRunId, expectedRevision, patch)` with:
  - `patch.status = 'complete'`
  - `patch.data = <full ArtifactEnvelope>` (root `sectionTitle/verdict/statusSummary/confidence/sources` + nested `body`) — `pickPositioningTypedArtifact(data, zone)` finds the root fields and validates.
  - `patch.markdown = "${verdict}\n\n${statusSummary}"` (renderers use `data`, not `markdown`; keep minimal)
  - `patch.sources = envelope.sources`
  - emit `appendSectionEvent(sectionRunId, ...)` for progress (so the v2 activity feed lights up).
- `sectionId → zone` is identical strings (no mapping table needed).

### 1.4 Corpus-only synthesis (tools OFF)
Run each section with `allowedTools: []` (or inject `externalTools: {}` into the answer-tool call) so the agent synthesizes purely from the injected corpus. Add a single config flag
`LAB_ENGINE_LIVE_TOOLS` (default off) so we can re-enable light `web_search` per section if a section fails `validateMinimums` in the smoke test.

### 1.5 Orchestrate `'lab'` branch — `src/app/api/research-v2/orchestrate/route.ts`
- Add `'lab'` to the `executionMode` zod enum (today: `'draft'|'deep'|'managed'`).
- New branch: `seedOrchestration` (creates the artifact + 6 section_run rows, same as draft) → run the 6 sections via the lab engine (corpus-only) with concurrency ≤3 → commit each via `SupabaseRunStore`. Run inline (corpus-only is fast, well under Vercel maxDuration) OR via a new internal route `src/app/api/research-v2/run-lab-section/route.ts` per section if inline risks timeout.
- Gate on `corpusReady()` (already enforced).

### VERIFY WS1
- `npm run typecheck` + `lint` + `build` pass.
- Unit: corpus fixture → `corpus-to-research-input` → `researchInputSchema.parse` succeeds.
- Local E2E: pick a `journey_session` with a complete corpus, `POST /api/research-v2/orchestrate {executionMode:'lab'}`, confirm 6 rows in `research_artifact_sections` with `status='complete'`, and `pickPositioningTypedArtifact(row.data, zone)` returns non-null for all 6. **Key gate: do corpus-only sections pass `validateMinimums`?** If a section fails, flip `LAB_ENGINE_LIVE_TOOLS` for that section.

---

## WORKSTREAM 2 — v2 shell (parallel; reads the existing data contract)

### 2.1 New route `src/app/research-v3/page.tsx`
State machine welcome → corpus → onboarding → sections → error (reuse existing pieces). Drive the sections view from `useAuditState(runId)` (existing — polls `/api/research-v2/audit-state`, returns `sectionsByZone` + `eventsByZone` + `workerStates`).

### 2.2 Sections view — the battleship layout
- `AppShell` 3-panel (left nav / center workspace / right panel).
- Center: one **`ResearchCardShell`** per section (copy from `aigos-v2` branch: `src/components/journey/research-cards/**`). When `sectionsByZone[zone].data` present → render via `TypedArtifactRenderer` (existing 6 renderers); else → skeleton/`ChapterPlaceholder` keyed off status. Wrap transitions in framer-motion for the "build up" feel.
- Right panel: **live activity feed** from `eventsByZone[zone]` (tool name, source, phase label) — use `src/components/ai-elements/{task,reasoning,shimmer,sources}.tsx` + shadcn.
- Per-section accent colors from `aigos-design-system-v2.jsx` token map.

### VERIFY WS2
- builds; with a completed run's `runId`, `/research-v3` renders all 6 cards with content + the activity feed; placeholders animate to filled cards on each poll.

---

## INTEGRATION + DEPLOY
- Wire `runId` from dispatch → `/research-v3`.
- Smoke end-to-end on a real corpus (use Supabase MCP to find a `journey_session` with `deepResearchProgram` complete).
- Deploy: `git push` branch → Vercel **preview URL**. Promote to production when stable. (Prod env vars confirmed set; the lab-engine path is Next-API + Anthropic only — bypasses Railway + Managed Agents.)

## CONSTRAINTS
- AI SDK v6 only; AI-GOS's `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY`.
- Port the lab engine intact; don't rewrite it. Match AI-GOS code style.
- Do not touch `main`, Railway, Managed Agents, or prod.

## RISKS (from the integration contract sheet)
1. **`competitorAds` synthetic stubs degrade Competitor Landscape quality** — acceptable for v1; flag in UI/notes; fix when tools re-enable.
2. **`corpus.excerpts` transform** must robustly hit min-3 / min-80-chars or `ResearchInput` parse fails — supplement from sources + summary.
3. **Lab body schema vs renderer schema drift** — verified identical for market-category; spot-check the other 5; add a transform if any field renamed.
4. **Corpus-only may fail `validateMinimums`** for some sections — `LAB_ENGINE_LIVE_TOOLS` flag is the escape hatch (light web_search).
5. **`RunStore.createRun/readRun`** must be Supabase/scratch-backed (engine reads input back at section time).
