# Fulfill Media Template + Best AI Elements App-Wide — Design

> Date: 2026-06-25 · Branch: `refactor/architecture-deepening`
> Source: `docs/handoffs/2026-06-25-fulfill-media-template-and-ai-elements.md` (owner-locked)
> Status: Tasks 1-3 shipped and verified; Task 4 deferred

## Status

- Task 3 ✅ shipped (commit `8b8c2680`) — 3 raw-markdown leaks fixed.
- Task 1 ✅ shipped (commit on `paid-media-projector.ts` + composer wiring) — EXTRACT-ONLY 2nd GLM pass fallback; 5 unit tests. **Pending: one owner-gated clay run** to validate the live GLM projection path (`deckSource=decoded finishReason=stop stripAdmitted=true`).
- Task 2 ✅ shipped — typed deck is primary, memo is a collapsible companion via `strategistMemo` (no schema change); 7 strategist-memo tests.
- Task 4 ⏸️ deferred — the existing section copy/rerun + activity rail are already custom-built; the one material gap (registry `Tool` in the activity rail for live tool-call input/output/state) is non-trivial wiring and genuinely optional polish. Revisit separately.
- Verification: `tsc` 0 · `npm run test:run` 3029 passed / 1 skipped (live probe) · `npm run build` green · lint clean on changed files (pre-existing `tmp/` scratch errors untouched).

## Goal

GLM-5.2 writes a billable paid-media markdown memo but won't emit the typed JSON the app needs. The 13-block template and its typed UI already exist and are correct — they're just not being filled and not being shown. Fix both **without touching the template**, then make AI-generated text render with the best AI Elements app-wide.

## Non-goals

- No change to `paidMediaPlanBodySchema` (`src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts:401`).
- No change to the 6 research sections' markdown-primary rendering override (`typed-artifact-renderer.tsx:467` stays for them).
- No chunked projection pre-built (one pass first; chunk only if the clay run truncates — YAGNI).
- No global `all.json` AI Elements install (type conflicts).
- No live paid-media run except a single owner-gated clay validation.

## Architecture

### Task 1 — Backend projector (fill the template)

New `src/lib/lab-engine/agents/paid-media-projector.ts`, mirroring the proven section projector `agentic-glm-projector.ts`. Markdown is INPUT, only JSON is output (no competing prose — the structural difference that broke the inline composer approach does not apply here).

- Reused from `agentic-glm-projector.ts`: `stripCodeFences`, `unwrapEnvelope`, `tryParseJson`, the 2-round projection + repair loop, `PROJECTION_SYSTEM`, the 24000-token ceiling (GLM starves below).
- Per-block extraction prompt: 13 `TARGET_DESCRIPTION`-style constants (one per block), each with verbatim field names + "omit unsourced rows, never invent, honest-gap object if empty."
- Output flows through the existing `normalizePaidMediaPlanBody` (reused, not reimplemented) — the projector only needs a roughly-shaped body; the tolerant decoder snaps aliases, synthesizes gap rows, clamps overshoot.
- Invoked inside `composePaidMediaPlan` (`composer-glm.ts:171-174`), replacing the current `decodePaidMediaPlanFromText` call. On projector miss → honest-gap shell (current behavior preserved).
- `composerStripFloor` needs **no change** — it already rejects `honest_gap`/`length` first, then runs shape checks on a real deck.

### Task 2 — Rendering (show the filled typed deck)

The override at `typed-artifact-renderer.tsx:467` skips typed render when `narrativeMarkdown` is set; the composer stamps it at `run-section.ts:13157`. `PaidMediaPlanDeck` is invoked directly at `audit-reader-shell.tsx:616` and `shared-session-view.tsx:230` (bypasses the override); only `PaidMediaPlanRenderer` (inline card via dispatch) is hidden.

Approach B: stop stamping `narrativeMarkdown` on the paid-media artifact. Persist the memo as a dedicated additive `strategistMemo` field. Add a collapsible "Full strategist memo" in `PaidMediaPlanRenderer` + `PaidMediaPlanDeck`. The 6 research sections keep their markdown-primary override untouched.

### Task 3 — AI Elements quick wins (3 raw-markdown leaks)

No user sees literal `**`/`##`/`---`.

- `src/components/shared/shared-session-view.tsx:251` `<pre>{markdown}</pre>` → `<SectionNarrativeMarkdown prose={markdown} />`
- `src/app/profiles/[id]/page.tsx:418` `<p>{insight}</p>` → `<BodyProse>{insight}</BodyProse>`
- `src/components/research-v2/section-renderers/paid-media-plan-deck.tsx:641` `<p>{creativeStrategy.prose}</p>` → `<BodyProse>{scrubReaderText(body.creativeStrategy.prose)}</BodyProse>`

All three are AI-authored strings; reuse existing primitives; no new deps. Surgical. Lowest risk — ships first.

### Task 4 — Best AI Elements app-wide (phase 2)

Richer AI-native rendering where it materially upgrades the product. Fetch live registry docs first (training is stale); install only what's used; keep `toUIMessageStreamResponse` + `DefaultChatTransport` pairing; all client components.

## Constraints

- ❌ no change to `paidMediaPlanBodySchema`
- Paid runs are owner-gated, single bounded invocation, never looped
- Commit only when owner asks; branch `refactor/architecture-deepening`
- Reuse existing primitives (no new deps for Task 3)
- TypeScript strict; named exports; `@/` imports

## Steps (ordered, each verifiable)

1. Task 3 — fix 3 leaks → verify: `tsc` 0, `npm run test:run -- src/components/research-v2 src/components/shared src/app/profiles`, visual check
2. Task 1 — projector + composer wiring → verify: `tsc` 0, `npm run test:run -- src/lib/lab-engine/agents`; one owner-gated clay run shows `deckSource=decoded finishReason=stop stripAdmitted=true`
3. Task 2 — rendering → verify: `tsc` 0, deck tests green
4. Task 4 — AI Elements → verify: `tsc` 0, no chat-stream regression
5. DOX pass + final verification

## Done when

- Task 3: the 3 sites render styled prose; `tsc` 0; visual check.
- Task 1: unit tests pass with fixture markdown → typed deck; one clay run shows `deckSource=decoded finishReason=stop stripAdmitted=true` + `deck.json` ≫ 5978B.
- Task 2: a filled artifact renders BudgetBar + tables + timeline; memo still reachable; section tests green.
- Task 4: chosen components installed via registry, wired, `tsc` 0, no chat-stream regression.
- All: `npm run lint` clean; `npm run test:run` green; no unrelated worktree changes.