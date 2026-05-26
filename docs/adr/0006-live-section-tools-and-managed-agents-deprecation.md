---
status: accepted
date: 2026-05-26
---

# Live in-section tools on the DeepSeek lab path; managed-agents runtime deprecation

Two coupled reversals land together as v3 promotes the previously corpus-only DeepSeek lab engine to the production front door with live in-section tools enabled by default. Both reverse decisions taken earlier in this arc; recording them so the next executor does not re-derive the old constraints from stale docs.

## Decision 1 — the 6 positioning sections use real in-section tools (reverses the corpus-only lock)

The 6 lab sections now call real research tools during the section run, on DeepSeek, with **no model split** — the same `deepseek-v4-flash` that synthesizes the artifact also drives the tool calls. This reverses the corpus-only lock recorded in `docs/adr/0003-backend-only-deployment.md` and the "live tools OFF in v1 / corpus-only is enforced" stance in `docs/2026-05-25-v2-wire-deepseek-ground-truth.html`.

This is a **surgical flip of existing infrastructure, not new infrastructure**:

- `LAB_ENGINE_LIVE_TOOLS` (`src/lib/research-v2/lab-section-job.ts:88-90`) already exists. `getLabEngineAllowedTools()` returns `[]` only when the flag is explicitly set to `'false'`; otherwise it returns `undefined` and defers to each section's registry allowlist. The flip is preserving the gate while making live allowlists the default.
- The per-section allowlists already exist and are populated in `src/lib/lab-engine/sections/section-registry.ts` (`allowedTools`): MarketCategory `["web_search","pagespeed"]`; Competitor a multi-tool set incl. the ad adapters; VoC / BuyerICP `["web_search","firecrawl","reviews"]`; DemandIntent `["web_search","firecrawl","keyword_ad_probe"]`; OfferDiagnostic `["web_search","firecrawl","pagespeed","reviews","ga4"]`.
- The tool adapters already exist in `src/lib/lab-engine/agents/tools/` (11: `adlibrary`, `competitor-ad-adapter`, `firecrawl`, `ga4`, `google-ads`, `keyword-ad-probe`, `meta-ads`, `pagespeed`, `reviews`, `spyfu`, `_shared`/`index`).

These three — the tool adapters, the registry allowlists, and the `LAB_ENGINE_LIVE_TOOLS` gate — were dormant under the old corpus-only lock and looked removable in an earlier teardown trace. **They are now LIVE infra and MUST be preserved through the v3 teardown (Phase F).** Deleting them is no longer a cleanup; it would tear out the section research path.

### Why no model split

The OpenRouter "#411 tool-args-as-text" trap and DeepSeek's earlier forced-answer fix are already handled in the existing tool-output design (never layer `Output.object` on the answer tool). DeepSeek drives tool calls directly; there is no Anthropic-for-tools / DeepSeek-for-synthesis split to build or maintain. Prod stays DeepSeek-only (ADR-0003's model-swappability holds — this is a tool-capability flip, not a provider change).

### Consequence — latency budget

Corpus-only sections ran ~17–75s each (s5/s6, fixture corpus). Live tool calls add wall-time (expected ~60–150s/section). The hard ceiling is `run-lab-section`'s `maxDuration=300` with a 270s job-timeout (`LAB_SECTION_ROUTE_TIMEOUT_MS`). The Phase F teardown gate therefore carries a latency condition: on the fresh-URL proof runs, **no section may breach 270s** (hard), with **p95 section latency < 180s** as a watch line. A section that routinely flirts with the ceiling blocks teardown, because F removes the slower worker `deep` path that would otherwise be a fallback.

### Consequence — synthetic backfill is removed (Phase D, not F)

`src/lib/research-v2/corpus-to-research-input.ts` fabricates data when the corpus is thin (`buildSyntheticCompetitorAds()` emits `Synthetic: <competitor> positioning angle` ads; a "schema-safe synthetic URL" default). With real tools fetching real evidence this backfill is both unnecessary and a fabrication risk (`feedback_no_fabricated_pricing`). **Phase D deletes it in the same arc that proves the live-default allowlists** — sections must not lose the fallback before they have real data. This is noted here because the teardown gate's "6/6 on ≥3 fresh URLs" condition explicitly means real-tool-fetched data with no synthetic backfill.

## Decision 2 — managed-agents runtime is deleted; schemas are retained (reverses the 2026-05-20 default-on)

Commit `c7ce3cc9` (2026-05-20, "Activate Managed Agents as default in /orchestrate + park UI scaffolding") made `executionMode='managed'` the default orchestrate path behind `MANAGED_AGENTS_POSITIONING_ENABLED`. v3 runs on the DeepSeek lab engine, not managed agents. The managed-agents runtime is therefore dead in v3 and is **deleted** in Phase F.

Deleted (runtime):
- `src/lib/managed-agents/{start-audit,webhook-handler,client,agents,signature,supabase-adapter}.ts` + their `__tests__/`
- `src/app/api/webhooks/managed-agents/route.ts`
- the `'managed'` branch + `startManagedAudit` import in `src/app/api/research-v2/orchestrate/route.ts`
- the `MANAGED_AGENTS_*` env flags

**Retained (load-bearing):** `src/lib/managed-agents/schemas/` + `src/lib/managed-agents/section-artifact-schemas.ts`. These are a pure-Zod mirror of the worker subagent schemas and are imported **today** by all 6 live v3 typed renderers (`src/components/research-v2/section-renderers/*.tsx`), `src/components/research-v2/typed-artifact-renderer.tsx`, `src/lib/research-v2/audit-artifact-view.ts`, and `src/lib/research-v2/supabase-run-store.ts`. Deleting the directory wholesale would break the v3 reader. The directory name reflects the original worker-mirror relationship (ADR-0004); renaming it to a neutral location is a no-value churn deferred to a later cleanup.

This reverses the *default* set on 2026-05-20 but is consistent with ADR-0004's framing: Arc 1 (managed runtime) was always flag-gated (`MANAGED_AGENTS_POSITIONING_ENABLED` default `false`) and was to stay on-branch until a live canary + 7-day observation window completed. That validation never ran, v3 superseded the approach, and the runtime is removed rather than carried as dormant flag-gated code.

### Why delete rather than keep flag-gated

- Carrying a second, never-validated section-execution runtime behind a flag is maintenance and review burden with no path to activation — v3 is the committed engine.
- The orchestrate route is **shared** (`/research-v3` dispatches through it with `executionMode:'lab'`). Keeping a `managed` branch there means every future orchestrate change must reason about a dead branch. Removing it (keeping only `lab` + `seedOrchestration` + `dispatchLabSectionJobs`) keeps the live route honest.
- The schemas — the only part the reader actually consumes — are retained, so the type contract for the typed renderers is unaffected.

## Considered alternatives

- **Keep corpus-only; add live tools later.** Rejected: the corpus-poverty failures (2/6→6/6 was purely source count) showed fresh arbitrary URLs cannot be relied on to produce a rich enough corpus from a single pass; in-section tools are the lever that lets a fresh URL hit 6/6 without a hand-authored fixture. The infra already exists; deferring it only delays the proof the prod cutover needs.
- **Build an Anthropic-for-tools / DeepSeek-for-synthesis split.** Rejected: unnecessary — DeepSeek drives tools directly and the tool-output design already avoids the #411 trap. A split adds a second provider, cost, and failure surface for no benefit.
- **Keep managed-agents runtime flag-gated in main (per ADR-0004).** Rejected: the validation window never ran and v3 replaced the approach; dormant unreachable code is debt, not optionality. Schemas are kept; runtime is not.
- **Move `managed-agents/schemas/` to a neutral dir as part of this change.** Rejected (again, per ADR-0004): pure refactor, would touch every renderer import for no near-term value; deferred.

## Consequences

- Phase F teardown KEEPs the lab tool machinery (adapters + registry allowlists + the `LAB_ENGINE_LIVE_TOOLS` gate) and the managed-agents **schemas**; it DELETEs the managed-agents **runtime**, the orchestrate `draft/deep/managed` branches, the old `src/lib/media-plan/` pipeline, and `/research-v2`.
- Any kill-list that deletes a managed-agents runtime file must also remove its barrel/registry references and its `__tests__/*` (orphan tests emit `TS2307` and silently fail the gate — `.claude/rules/learned-patterns.md`).
- The teardown gate is stricter under live tools: "6/6 on ≥3 fresh real URLs" now means real-tool-fetched data, no synthetic backfill, no section over 270s. Prod-cutover (6 sections, post-D) and teardown (full, incl. the 7th `positioningPaidMediaPlan` section) are two distinct gate levels.
- Prod remains DeepSeek-only. DeepSeek key rotation is a tracked, non-blocking security follow-up (the key was pasted in plaintext in an earlier session transcript).
