---
status: accepted
date: 2026-05-19
---

# Split `codex/claude-managed-agents-work` into two independent shipping arcs

The branch `codex/claude-managed-agents-work` carried two unrelated work streams that grew together: (Arc 1) the Managed Agents runtime migration that replaces `research-worker/src/runners/positioning-audit-orchestrator.ts`, and (Arc 2) a typed-artifact UI rebuild (7 primitives + per-section renderers). At 1,244 changed files and ~71k insertions, the branch is unreviewable as one PR and an all-or-nothing rollback would couple two unrelated risks.

We are splitting the branch into independent shipping arcs:

- **Arc 2 ships to main incrementally now.** PR #1 lands the 7 typed primitives, the `CompetitorLandscapeRenderer`, its wiring into `agent-artifact-surface.tsx`, the `isCompetitorLandscapeArtifact` type guard in `audit-artifact-view.ts`, the font-serif removal in `SectionNarrativeRenderer`, and the entire `src/lib/managed-agents/schemas/` subfolder (pure Zod, no Arc 1 deps). PR #2 batches the remaining 5 section renderers (MarketCategory, VoC, DemandIntent, OfferDiagnostic, plus a BuyerICP rebuild on the new primitives). Arc 2 delivers user-visible value standalone because the legacy Railway worker already produces data matching the mirrored schemas.
- **Arc 1 stays on branch until P1 live canary turns green and the 7-day observation window completes** (per `docs/architecture/2026-05-19-managed-agents-migration-validated-plan.md`). The `executionMode='managed'` path remains feature-flag-gated by `MANAGED_AGENTS_POSITIONING_ENABLED` (default `false`), so even when its files exist in main they have no production effect.

## Why schemas ship with Arc 2 (not Arc 1)

`src/lib/managed-agents/schemas/` is a pure-Zod mirror of `research-worker/src/agents/subagents/schemas/`. The directory name reflects the worker-mirror relationship, but the schemas have no Arc 1 runtime dependencies (only `zod` and `./_shared`). Arc 2's typed renderers import the artifact types from here today; Arc 1 will import the same files when it lands. Shipping schemas with Arc 2 pre-positions the type contract and avoids splitting the schema across PRs.

## Considered alternatives

- **Single mega-PR for both arcs.** Rejected: unreviewable diff, coupled rollback risk, can't iterate on UI without holding the migration hostage.
- **Move schemas to a neutral location (e.g. `src/lib/research-v2/schemas/`).** Rejected: pure refactor with no shipping value; current location is honest about the worker-mirror relationship and forcing the rename now requires updating Arc 1 imports for no near-term benefit.
- **Build all 6 section renderers before merging anything.** Rejected: slower feedback loop, risks committing to a primitive pattern that doesn't survive contact with real data from the other 5 sections.

## Consequences

- `src/lib/managed-agents/schemas/` sits in main with no runtime consumer until Arc 1 lands. Intentional — it is the type contract Arc 2 consumes today.
- Until PR #2 lands, the Audit Reader renders a mix of typed cards (Competitor, BuyerICP) and generic narrative fallbacks (other 4 sections). Acceptable transition state, not a bug.
- The P2 observation window for Arc 1 only starts after P1 live canary runs green, which requires operational env work (export `ANTHROPIC_API_KEY`, start a webhook tunnel) outside the code change set. Tracked as a separate operational task.
