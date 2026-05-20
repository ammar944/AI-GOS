# Handoff — Ship the typed Audit Reader on Managed Agents (ASAP)

**Date**: 2026-05-19
**Goal**: get the operator looking at a real, six-section, typed-artifact audit page produced end-to-end by Managed Agents. Delete the legacy Railway orchestrator. That is the product.

## What we already proved (1 of 6 sections, full loop)

The CompetitorLandscape section is end-to-end validated today:

| Layer | State |
|---|---|
| Specialist agent (Managed Agents) | canary green @ 22:23 — schema_ok, minimums_ok, attempt 2 via R5 repair |
| Zod schema in `src/lib/managed-agents/schemas/competitor-landscape.ts` | shipped |
| Typed renderer in `src/components/research-v2/section-renderers/competitor-landscape.tsx` | shipped in PR #22 |
| Visible at `/dev/typed-artifact-preview` | yes |

**That is the unit of work.** Five more identical iterations get us to the product.

## The recipe (do this five times, then twice more)

### Per-section iteration (×5)

For each of MarketCategory, BuyerICP, VoiceOfCustomer, DemandIntent, OfferDiagnostic — one PR per section:

1. **Validate the specialist** — write the SKILL.md, register the agent in `src/lib/managed-agents/agents.ts`, run `scripts/managed-agents-section-canary.mjs --specialist <name>` until the canary passes (schema_ok + minimums_ok + sane runtime + sane cost).
2. **Render the artifact** — build `src/components/research-v2/section-renderers/<name>.tsx`. Lead with prose, evidence below. Compose existing primitives. No new primitives without strong reason.
3. **Wire the dispatcher** — add the `is<Section>Artifact` type guard + renderer entry in `src/lib/research-v2/audit-artifact-view.ts`. Add the fixture to `/dev/typed-artifact-preview`.
4. **Ship** — PR against `feat/arc2-typed-artifact-ui` (the integration target). Gates: 13/13 agent-artifact-surface tests, tsc baseline ≤ 65, screenshot of the dev preview in PR body.

### After all six sections render (×2 more PRs)

5. **Coordinator** — `src/lib/managed-agents/coordinator.ts`. One Managed Agents session per audit, fans out to all six specialists with bounded concurrency. Flip `MANAGED_AGENTS_POSITIONING_ENABLED=true` in staging only. 7-day observation, both runtimes side-by-side.
6. **Cutover** — flip the flag default to `true` in production code, delete `research-worker/src/runners/positioning-audit-orchestrator.ts` (738 lines), delete `positioning-subagent-runner.ts`, delete `POST /orchestrate` from `research-worker/src/index.ts`. Update CLAUDE.md.

**Total**: 7 PRs after PR #22. Sections can be parallelized after the first one (MarketCategory) proves the pattern.

## Recommended section order (smallest schema first)

| Order | Section | Why |
|---|---|---|
| 1 | MarketCategory | smallest schema, fastest visual signal, proves the per-section template |
| 2 | OfferDiagnostic | next-smallest, pricing-reality + offer positioning |
| 3 | DemandIntent | medium — intent stages + search volume |
| 4 | VoiceOfCustomer | heavy QuoteCallout usage, tests the pull-quote aesthetic |
| 5 | BuyerICP | largest schema; replaces the existing card-grid renderer (delete `src/components/research-v2/buyer-icp/*` in this PR) |
| 6 | coordinator + flag staging |
| 7 | cutover + delete legacy |

## What's parked (pick up later)

These work streams are **explicitly paused** until after the cutover. Do not touch them in any of the seven PRs above:

- **AI SDK chat sidebar** — `useChat`, `DefaultChatTransport`, `/api/journey/stream` workspace chat/edit route. Keep working as-is for post-research editing. No enhancement, no v6 agent migration.
- **`ENABLE_POSITIONING_ORCHESTRATOR`** — the chat ToolLoopAgent orchestrator (Phase 5+). Leave the flag default `false`. The orchestrator's design conversations are on hold.
- **Phase 5 recovery, Phase 4 orchestrator-chat, agent-loop-v1** — every research-v2 work-in-progress branch unrelated to typed-artifact UI or Managed Agents specialists is parked.
- **Audit Reader polish** — progress strips, verdict chips, re-run-section buttons, PDF export. After cutover.
- **New section types** beyond the six in the pipeline.

When the legacy runner is deleted, we revisit the chat sidebar with the question: do the new typed artifacts change what the chat sidebar should edit? Probably yes — but that question is post-cutover.

## Hard rules (don't break, don't drift)

- **R-form**: journey stays form-driven. No chat-based section dispatch.
- **R-worker**: `research-worker/` cannot import from `src/lib/`. Schemas live in `src/lib/managed-agents/schemas/` (Arc 2) and are mirrored, not imported, on the worker side.
- **R-corpus**: `deepResearchProgram` stays on Railway. Out of scope.
- **R-flag**: `MANAGED_AGENTS_POSITIONING_ENABLED` stays default `false` until PR #6 (the coordinator) and only flips to `true` default in PR #7 (cutover).
- **R-baseline**: every PR preserves 65-error tsc baseline and 13/13 `agent-artifact-surface.test.tsx`.
- **R-aesthetic**: read `docs/handoffs/2026-05-19-typed-artifact-ui-simplification-design-note.md` before touching any renderer. Reference UI is `~/Desktop/managed-agents-status.html`. Anti-reference is Bloomberg.

## What the operator sees, by PR

| After PR | Operator-visible change |
|---|---|
| #22 (today) | nothing in production. Dev preview shows CompetitorLandscape only. |
| PR per-section #1 (MarketCategory) | dev preview shows two sections. Still no production change. |
| ... iterations ... | dev preview grows section by section. |
| PR per-section #5 (BuyerICP) | dev preview now shows the full six-section audit. **First moment you can show a stakeholder what the product looks like.** |
| PR #6 (coordinator + staging flag flip) | staging operator can run an audit through Managed Agents and see the typed UI render against real Managed Agents data. Production unchanged. |
| PR #7 (cutover) | production operator runs an audit. Same UI as staging. Legacy runner is gone. **Product shipped.** |

Note: between PR #5 and PR #6, the dispatcher is already wired (each section PR adds its own dispatcher entry). So even before the coordinator lands, an audit run through the **legacy** Railway runner will render through the new typed UI — because the legacy runner already writes data matching the schemas. That means production switches to the new UI somewhere around PR #5 if we flip `NEXT_PUBLIC_ARTIFACT_UI_V2=true`. Coordinator + cutover are runtime-only changes the operator does not see.

## Gates per PR (copy-paste checklist)

For every section PR:

- [ ] Canary command in PR body: `node scripts/managed-agents-section-canary.mjs --specialist <name>` — paste the `[managed-agents] validation attempts` line showing attempt N ok=true.
- [ ] `npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` — 13/13 pass.
- [ ] `npx tsc --noEmit | grep -c "error TS"` — exactly 65.
- [ ] Screenshot of `/dev/typed-artifact-preview` showing the new section rendered alongside existing ones.
- [ ] Dispatcher entry added in `audit-artifact-view.ts`.
- [ ] Fixture added in `/dev/typed-artifact-preview` page.
- [ ] No new primitive unless absolutely required (justify in PR body).

For the coordinator PR (#6):
- [ ] All six specialists canary-green individually.
- [ ] One end-to-end audit via `executionMode: 'managed'` against staging Supabase — six artifacts written, audit row done.
- [ ] Cost ≤ $0.50 per audit. Runtime ≤ 15 min.
- [ ] GitHub Action: `/api/webhooks/managed-agents` health probe every 15 min.

For the cutover PR (#7):
- [ ] 7-day staging observation window passed cleanly.
- [ ] `rg "positioning-audit-orchestrator|positioning-subagent-runner"` returns zero hits across `src/` and `research-worker/src/`.
- [ ] One full audit completed in production via Managed Agents before the legacy delete commit lands.

## Branch + base topology

- Integration target: `feat/arc2-typed-artifact-ui` (off main, created today)
- PR #22 (foundation): `feat/research-v2-typed-artifact-primitives` → `feat/arc2-typed-artifact-ui` — open now
- PR per-section #1 (MarketCategory): `feat/section-market-category` → `feat/arc2-typed-artifact-ui`
- ... same pattern for sections 2–5
- PR #6 (coordinator): `feat/managed-agents-coordinator` → `feat/arc2-typed-artifact-ui`
- PR #7 (cutover): `feat/managed-agents-cutover` → `main` (this is the merge moment)

After PR #7 merges to main, `feat/arc2-typed-artifact-ui` can be deleted along with `feat/research-v2`.

## First action for the next session

Branch off `feat/arc2-typed-artifact-ui` once PR #22 lands. Open `src/lib/managed-agents/schemas/market-category.ts` and read the shape. Write the SKILL.md for the MarketCategory specialist, register it in `agents.ts`, run the canary. When it passes, build `section-renderers/market-category.tsx` using NarrativeBlock + DataTable + QuoteCallout. Wire the dispatcher entry. Add the fixture. Screenshot the dev preview. Open the PR. Repeat four more times. Then ship the coordinator. Then delete the legacy runner.

That's the product.

## Source-of-truth ledger

- This handoff (the active plan)
- `docs/adr/0004-managed-agents-arc-split-and-incremental-ui.md` (the split decision — still valid but framing is per-section now)
- `docs/handoffs/2026-05-19-managed-agents-full-migration.md` (Arc 1 runtime details — reference for coordinator + cutover PRs)
- `docs/handoffs/2026-05-19-typed-artifact-ui-simplification-design-note.md` (aesthetic contract — read before every renderer)
- `~/Desktop/managed-agents-status.html` (visual goal)
- PR #22 (the foundation this stacks on)
