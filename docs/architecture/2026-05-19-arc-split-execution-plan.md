# Arc Split Execution Plan — 2026-05-19

**Builds on:** [ADR-0004: Managed Agents arc split and incremental UI](../adr/0004-managed-agents-arc-split-and-incremental-ui.md)

This doc turns ADR-0004 into a concrete action queue with file manifests, sub-agent orchestration, and a pause-friendly sequence. It covers four work items that ship in two PRs plus a parallel canary unblock.

## Goal

Ship Arc 2 (typed-artifact UI) in two reviewable PRs while Arc 1's 7-day observation window starts in parallel.

## Non-goals

- Touching Arc 1 runtime code (webhook route, orchestrator route, runner replacements). Those stay on `codex/claude-managed-agents-work` for now.
- Fixing the pre-existing 65 TS errors. Baseline is the gate, not zero.
- Visual/style overhaul of section renderers — primitives already determine the look.

---

## PR #1: CompetitorLandscape typed renderer + primitives + schemas

### Branch strategy

- Cut new branch off `origin/main`: `feat/research-v2-typed-artifact-primitives`
- Do not cherry-pick — the source branch is too tangled. Copy file contents into the new branch via `git checkout codex/claude-managed-agents-work -- <path>` for the clean files, then selectively edit `package.json`.

### File manifest (verified clean)

**New files (full add):**
- `src/components/research-v2/primitives/` (all 8 files: 7 primitives + `index.ts`)
- `src/components/research-v2/section-renderers/competitor-landscape.tsx`
- `src/components/research-v2/section-renderers/index.ts`
- `src/components/research-v2/section-narrative-renderer.tsx`
- `src/lib/managed-agents/schemas/` (all 7 files: 6 schemas + `_shared.ts`)
- `docs/adr/0004-managed-agents-arc-split-and-incremental-ui.md`
- `docs/architecture/2026-05-19-arc-split-execution-plan.md` (this doc)

**Modified files (verified Arc 2 only):**
- `src/components/research-v2/agent-artifact-surface.tsx` — adds CompetitorLandscape dispatch at lines 1095–1104
- `src/lib/research-v2/audit-artifact-view.ts` — adds `isCompetitorLandscapeArtifact` type guard + type-only import from `@/lib/managed-agents/schemas/competitor-landscape` (safe — pure Zod types)
- `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` — adds typed-artifact rendering assertions
- `.mcp.json` — shadcn + shadcnio MCP servers (design-time tooling, no runtime coupling)

**Selectively staged file:**
- `package.json` — include the AI SDK / Tailwind typography / streamdown / etc. additions and version bumps, **exclude** the three Arc 1 script entries:
  - `"managed-agents:ad-canary"`
  - `"managed-agents:competitor-canary"`
  - `"managed-agents:section-canary"`

**Hard exclusions (must NOT land in PR #1):**
- `src/lib/managed-agents/` everything except `schemas/`
- `src/app/api/webhooks/managed-agents/`
- `supabase/migrations/20260519_managed_agents_webhook_events.sql`
- `scripts/managed-agents-*-canary.mjs`
- `research-worker/src/runners/positioning-audit-orchestrator.ts` modifications
- `src/app/api/research-v2/orchestrate/route.ts` modifications
- `docs/2026-05-18-claude-managed-agents-migration-intent.md`
- `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md`
- `docs/handoffs/2026-05-19-managed-agents-multiplatform-ad-creatives.md`
- `tmp/managed-agents-*` (canary outputs — `.gitignore` should cover these; verify)
- `CLAUDE.md` modifications (verify they're Arc 1 — if Arc 2 friendly, include)
- `.claude/settings.local.json`

### Verification before opening PR #1

1. `npx tsc --noEmit` — must stay at or below 65-error baseline
2. `npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` — typed artifact tests must pass
3. `npm run dev` — navigate to a real profile with audit data, confirm:
   - CompetitorLandscape renders as typed card grid (not narrative fallback)
   - Other 5 sections render via `SectionNarrativeRenderer` (un-typed but not broken)
4. Screenshot before/after for the PR description

### PR description scaffolding

```
## Summary
- Adds 7 reusable typed-artifact primitives (NarrativeBlock, DataTable, QuoteCallout, BarBreakdown, PositioningAxisStack, MilestoneTimeline, InlineStats)
- Wires CompetitorLandscape as the first typed section renderer; others fall through to SectionNarrativeRenderer
- Adds 6 Zod schemas under src/lib/managed-agents/schemas (pure types, no Arc 1 runtime dependency)

## Why split this from Arc 1
See ADR-0004. Arc 1 (Managed Agents runtime) is on a 7-day observation window. Arc 2 (UI) ships incrementally so users get value now and we review the primitive pattern at single-section scale before fanning out.

## Test plan
- [ ] tsc baseline holds
- [ ] agent-artifact-surface.test.tsx passes
- [ ] Manual: CompetitorLandscape renders typed
- [ ] Manual: other 5 sections render via narrative fallback (not broken)
- [ ] Screenshots attached
```

---

## PR #2: 5 typed section renderers (MarketCategory, VoC, DemandIntent, OfferDiagnostic, BuyerICP)

### Build order

User's stated order: **MarketCategory → VoC → DemandIntent → OfferDiagnostic → BuyerICP**

### Pattern (mirror CompetitorLandscapeRenderer)

For each section renderer:
1. Import schema type from `@/lib/managed-agents/schemas/<section>.ts`
2. Import the primitives it needs from `@/components/research-v2/primitives`
3. Compose the renderer as `<NarrativeBlock prose>` + sub-section primitives
4. Add `is<Section>Artifact()` type guard in `src/lib/research-v2/audit-artifact-view.ts`
5. Add the dispatch branch in `src/components/research-v2/agent-artifact-surface.tsx`
6. Export from `src/components/research-v2/section-renderers/index.ts`

### Per-section wiring (from reconnaissance)

| Section | Sub-sections | Primary primitives | Est. LOC | Risk |
|---|---|---|---|---|
| MarketCategory | marketSize, structuralForces, categoryMaturity | DataTable + NarrativeBlock + PositioningAxisStack | 220–260 | Low |
| VoC | painLanguage, objections, switchingStories, decisionCriteria, successLanguage | QuoteCallout (heavy) + DataTable + NarrativeBlock | 280–320 | Med (quote volume) |
| DemandIntent | keywordDemand, questionMining, contentGaps, intentSignals, venueMap | DataTable + BarBreakdown + NarrativeBlock | 240–280 | Low |
| OfferDiagnostic | offerMarketFit, funnelDiagnosis, channelTruth, retentionHealth, redFlags | DataTable + BarBreakdown + QuoteCallout (redFlags) | 240–280 | Med |
| BuyerICP | icpExistence, personaReality, awarenessMap, buyingContext, clusters | DataTable + PositioningAxisStack + NarrativeBlock | 260–300 | High (most subsections) |

### Sub-agent orchestration

User asked for multiple sub-agents. Hybrid strategy:

1. **Build MarketCategory in the main thread first** — it's the lowest-risk and serves as the template. ~30 min. Validates the pattern at full scale (not just CompetitorLandscape's already-done version).
2. **Fan out the remaining 4 to parallel `coder` sub-agents** once MarketCategory is in. Each gets:
   - The schema file path
   - The MarketCategory renderer as a worked example
   - The wiring contract (type guard + dispatch + barrel export)
   - A 600-word brief and "report under 200 words on completion"
3. **Main thread integrates** the 4 returned diffs sequentially with quick eyeball reviews, then runs the full verification suite.

Per-commit discipline: one atomic commit per renderer (5 commits in PR #2), so individual renderers can be reverted without losing the whole PR.

### PR #2 verification

- `npx tsc --noEmit` — must stay at or below 65-error baseline (likely drops to ~60 as new typed paths replace untyped JSX)
- `npm run test:run` — full suite passes
- Manual: each of the 5 sections renders as typed cards in a real profile
- Manual: no narrative fallback remains for these 5 sections

---

## Canary: start Arc 1's 7-day observation window (parallel)

### Reconciling the user's plan vs. reality

The action queue says: `export ANTHROPIC_API_KEY=...; cloudflared tunnel --url http://localhost:3000; run the canary script`.

Reconnaissance shows the canary script (`scripts/managed-agents-competitor-section-canary.mjs`) calls Anthropic directly and handles tool calls locally — no webhook callback in the canary path. The webhook route is only invoked by real frontend audits.

**Assumption (stated loudly):** The cloudflared tunnel is being requested defensively so any frontend audit traffic during the observation window has a webhook home. We'll start the tunnel anyway because the cost is trivial and it doesn't hurt the canary.

### One-time setup

1. Apply the migration:
   ```
   supabase migration up 20260519_managed_agents_webhook_events
   ```
2. Generate webhook secret:
   ```
   echo "MANAGED_AGENTS_WEBHOOK_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')" >> .env.local
   ```
3. Export `ANTHROPIC_API_KEY` and `SEARCHAPI_KEY` into the shell.

### Run sequence (parallel terminal sessions)

- Terminal 1: `npm run dev` (Next.js on :3000)
- Terminal 2: `cloudflared tunnel --url http://localhost:3000` (capture the public URL; set `APP_DOMAIN` if needed for Phase 2)
- Terminal 3: `node scripts/managed-agents-competitor-section-canary.mjs`
- Output: `tmp/managed-agents-competitor-section-canary-success-sesn_<id>-full.json`

### Success criteria for "observation window started"

- `acceptedArtifact` non-null
- Schema + minimums pass
- Repair retry attempted and succeeded (proves R5 path works)
- Ad evidence ≥3 unique advertisers, ≥1 non-Google platform

A single passing canary run is the gate. After that, observation is passive — monitor Supabase `managed_agents_webhook_events` over the next 7 days for any incidents from real audit traffic.

### Sub-agent strategy for canary

Spawn the canary as a **background** sub-agent (`run_in_background: true`) with the `coder` agent type. The sub-agent's brief:
- Apply the migration
- Generate the secret
- Start the tunnel
- Run the canary script
- Report success/failure with the path to the output JSON

This frees the main thread to start PR #1 work immediately.

---

## Sequencing

```
T0 (now)        : Spawn background canary sub-agent
T0 + 5 min      : Start PR #1 cherry-pick in main thread
T0 + 30–60 min  : PR #1 opened; verify locally; merge
T0 + 60 min     : Background canary checked; if green, observation window started
T0 + 60–90 min  : MarketCategory renderer in main thread (template)
T0 + 90 min     : Fan out 4 parallel coder sub-agents for VoC, DemandIntent, OfferDiagnostic, BuyerICP
T0 + 2–3 hr     : Sub-agents complete; main thread integrates + verifies
T0 + 3–4 hr     : PR #2 opened
```

## Open risks

- **`package.json` selective stage** is the trickiest moment. Easy to either drop a required dep or accidentally include an Arc 1 script. Mitigation: manual edit, not interactive `git add -p`.
- **CLAUDE.md modification** — needs eyeball check whether the diff is Arc 1 (webhook env var docs) or Arc 2 (research-v2 conventions). Default: leave out unless it's clearly Arc 2.
- **Tunnel + webhook coupling** — if the user's intent was to test the full webhook round-trip end-to-end, the canary script alone won't exercise it. Flagging here; user can redirect.
- **Sequential vs parallel PR #2** — if the 4 parallel sub-agents diverge stylistically from MarketCategory's template, integration time grows. Mitigation: pin the brief to "match MarketCategory's prose/primitive composition pattern exactly."

## Verification gate before claiming "done"

For each PR:
1. `npx tsc --noEmit` baseline holds
2. `npm run test:run` passes
3. `npm run build` exits 0
4. Manual UI eyeball on a real profile
5. Screenshots in PR description
