# onboarding-flow-redesign — 01 Discover

**Started:** 2026-04-21 15:00 GMT+5
**Source spec:** `~/Downloads/AIGOS Onboarding Flow.docx` (plus `AIGOS Onboarding Flow (1).pdf`)
**Branch:** `redesign/v2-command-center`

**Pre-discover exploration:** Blast-radius mapping was run at the user's request before 01-discover opened. Findings feed this doc; no further exploration needed to scope. See "Ask" item for the source-of-truth decisions that exploration produced.

---

## 1. Ask (one sentence)

Replace the current 6-group onboarding flow with the 7-group flow specified in `AIGOS Onboarding Flow.docx` — add 19 fields, remove 5 fields, rename 2 fields, and regroup sections — while treating the red-marked "Awareness Level" as rejected-from-the-form (it remains a resolver-inferred output only).

## 2. Success criteria

- A fresh onboarding walkthrough renders **7 groups in this order:** Product & Revenue Model → ICP + Pain → Offer & Product Experience → Pricing & Economics → Competition & Positioning → Goals & Strategy → Current Marketing & Performance.
- The 5 red-removed fields (`guarantees`, `monthlyRevenueRange`, `payingCustomerCount`, `desiredTransformation`, `situationBeforeBuying`) do not render in onboarding or profile edit. Their JSONB data in `business_profiles.all_fields` is untouched (forward-compat pattern).
- `businessModel` (free text) is renamed to `salesMotion` (enum: `product-led | sales-led | hybrid`) and shows as a required-blocker.
- `last12MoGrowthRate` renamed to `last3to6MoGrowthTrend` (same value shape).
- 19 new fields appear in `JOURNEY_FIELDS` + `JOURNEY_FIELD_LABELS` so `buildJourneyResearchContext()` auto-emits them in the research context string.
- `pricingModel`, `conversionPath`, `avgAcv` are required-blockers (per spec "why this is the perfect setup" — these drive routing).
- `optional` funnel metrics (visitor→signup %, signup→activation %, activation→paid %, demo→close rate) render but do NOT block dispatch.
- `channels` renders as a multi-select (Meta / Google / LinkedIn / Cold Email / Outbound / Organic / Other).
- `npm run build` exits 0.
- `npm run test:run` passes (after fixture updates).
- Identity resolver continues to emit `businessModelType` and `awarenessLevel` as today — no runner prompt changes required.

## 3. In scope (file list from blast-radius map)

**Field catalog (source of truth):**
- `src/lib/journey/field-catalog.ts` — `JOURNEY_FIELDS`, `JOURNEY_FIELD_LABELS`, `JOURNEY_REQUIRED_BLOCKER_FIELDS`, `JOURNEY_MANUAL_BLOCKER_FIELDS`, `JOURNEY_ENRICHMENT_FIELD_METAS`, `PROFILE_FIELD_GROUPS`

**TS property types:**
- `src/lib/onboarding/types.ts`

**Company-intel prefill / enrichment:**
- `src/lib/company-intel/types.ts`
- `src/lib/company-intel/schemas.ts`
- `src/lib/company-intel/document-extraction-schema.ts`
- `src/lib/company-intel/run-company-research.ts`
- `src/lib/company-intel/research-service.ts`

**Journey wiring:**
- `src/lib/journey/prefill.ts`
- `src/lib/journey/research-sandbox.ts`

**Chat/AI tools (reference field keys):**
- `src/lib/ai/journey-state.ts`
- `src/lib/ai/tools/update-field.ts`
- `src/lib/ai/prompts/journey-chat-system.ts`
- `src/lib/ai/context-builder.ts`

**Media plan cross-refs:**
- `src/lib/media-plan/ad-copy-context-builder.ts` (guarantees removal)
- `src/lib/media-plan/validation.ts` (last12MoGrowthRate claim validator)
- `src/lib/media-plan/pipeline.ts` (legacy comment)

**Form UI:**
- `src/components/onboarding/step-customer-journey.tsx`
- `src/components/onboarding/step-product-offer.tsx` (will split across new §3 + §4)
- `src/components/onboarding/step-current-marketing.tsx` (NEW — for §7)
- `src/components/onboarding/document-prefill-summary.tsx`
- `src/components/shell/onboarding-context.tsx` (fixture)

**Tests:**
- `src/lib/journey/__tests__/field-catalog-identity.test.ts`
- `src/components/journey/__tests__/profile-dropdown.test.tsx`
- `src/components/journey/__tests__/prefill-stream-view.test.tsx`
- `src/components/journey/__tests__/journey-research-sandbox.test.tsx`

**Estimated total:** 23 files modified, 1 created. (Down from the 29 initial estimate — the worker-side files are untouched.)

## 4. Out of scope

- **"Awareness Level" as an onboarding input** — red-flagged in the doc. Stays resolver-inferred only.
- **Runner prompts referencing `[businessModelType:X]`** — the OUTPUT enum produced by `resolve-identity.ts` is unchanged (still `plg|slg|ecommerce|…`). The onboarding-side rename of the INPUT field does not cascade.
- **Identity resolver prompt retune** to exploit `salesMotion`/`pricingModel`/`conversionPath`/`avgAcv` as sharper inputs. The resolver today infers correctly without them. This is a follow-up for a separate PR.
- **Supabase column migration** — `business_profiles.all_fields` is JSONB. No DDL needed.
- **Chat refine sidebar** — unrelated surface.
- **Media plan schema / runner prompts / skill methodology markdown** — unchanged.
- **Onboarding visual design polish** (animations, copy polish, microinteractions) — this pass is structural. A design-review pass can follow.
- **Backfill of old users' `businessModel` text into `salesMotion` enum** — not attempted. Old text remains in JSONB; new enum lives in a new key. Existing users see the new field as empty and can fill it on next profile edit.

## 5. Do-NOT-Load

Subagents should avoid:
- `research-worker/src/runners/**` except `identity/resolve-identity.ts`
- `research-worker/src/skills/methodologies/**`
- `research-worker/src/skills/*-skill.ts` (channel-mix, audience-campaign, measurement, creative-system)
- `research-worker/src/contracts.ts`
- `supabase/migrations/**`
- `src/lib/media-plan/schemas.ts` (unless editing `last12MoGrowthRate` reference; scope that edit narrowly)
- `.claude/wiki/**`

## 6. Size classification

**`day`**. Justification: 23 file edits + 1 new file; no migration (JSONB forward-compat); no runner prompt surgery (decoupled via identity resolver output); worker side fully out of scope. Estimated 5–7 focused hours of implementation + verification. Parallel sub-agent dispatches collapse independent clusters (mirror files, component files, tests).

---

## Assumptions (flagged)

- **A1 (KEY rename):** `businessModel` → `salesMotion` is a full key rename, not a label change. New users write `salesMotion`. Old users retain `businessModel` in JSONB as read-only-legacy. Resolver prefers `salesMotion` when present.
- **A2 (SEMANTIC rename):** `last12MoGrowthRate` → `last3to6MoGrowthTrend` also shifts the time window (12mo → 3–6mo). Old data isn't semantically equivalent; treat it as a legacy key with no auto-migration.
- **A3 (multi-select):** `channels` is `string[]` (not a single freeform text field). UI: multi-select with the 7 listed options + "Other" freeform.
- **A4 (enum):** `avgAcv` is a single-select enum (`<$1K | $1K–$10K | $10K–$50K | $50K+`), not a numeric input.
- **A5 (blocker set):** Required-blockers are `companyName`, `productDescription`, `targetCustomer`, `salesMotion`, `pricingModel`, `conversionPath`, `avgAcv`, `primaryIcpDescription`, `topCompetitors`, `goals`. Everything else is optional or manual-blocker.
- **A6 (funnel metrics optional):** The 4 funnel % metrics + `last3to6MoGrowthTrend` are optional, rendered under an "Optional" affordance in §7.
- **A7 (unique edge stays):** `uniqueEdge` (existing) maps to "Why do customers choose you over alternatives?" — keep the key.
- **A8 (resolver unchanged):** `resolve-identity.ts` prompt + output schema stay as-is. `businessModelType` and `awarenessLevel` continue flowing through the pipeline unchanged.

---

## Audit

- **Completed:** 2026-04-21 15:05 GMT+5
- **Rationale for `day` classification:** Initial gut said `week+` because of the 6-sync-places rule in ARCHITECTURE.md. Blast-radius mapping revealed (a) Supabase uses JSONB forward-compat, eliminating migration work, (b) the `businessModelType` runner-routing key is resolver OUTPUT (not onboarding input), eliminating prompt surgery. Both discoveries collapse the scope by ~50%.
- **Risk flags:**
  - **R1:** The new §3/§4 split moves `pricingTiers` and `monthlyAdBudget` from Offer to Pricing. Any code that assumed a single "Offer & Pricing" group will need to find fields in two groups. Mitigated by field-catalog being the single source of truth.
  - **R2:** `step-product-offer.tsx` component needs to become two components (§3 and §4). High-churn file.
  - **R3:** Forcing `pricingModel/conversionPath/avgAcv` as blockers will break onboarding for any mid-flow session that hasn't answered them. Mitigation: these are NEW keys so no pre-existing sessions have them populated, but any in-progress session will need to re-answer. Acceptable.

**Handoff:** Plan atoms written inline in this note under `## Plan` below.

---

## Execution log (2026-04-21 17:30–18:00)

### Completed in this session

**Schema layer (atoms 1–2, 7):**
- `src/lib/journey/field-catalog.ts` — full v3 rewrite. 49 fields (down from 46 legacy after stripping 13 obsolete). 12 required blockers. 7 groups matching doc exactly. Each group annotated with what it UNLOCKS downstream. Enum types + option arrays co-located (SalesMotion/PricingArchetype/ConversionPath/AvgAcv/OnboardingChannel).
- `src/lib/ai/journey-post-approval.ts` — `PostApprovalNextField` derives from `JourneyRequirementDefinition['key']` union (auto-syncs).
- `src/lib/ai/tools/update-field.ts` — allowlist expanded to all 41 v3-relevant keys.
- `src/lib/journey/research-sandbox.ts` — all 7 `CONTEXT_FIELD_ORDER` sections include new routing signals.
- `src/lib/journey/baseline-metrics.ts` + tests — `last12MoGrowthRate` → `last3to6MoGrowthTrend` rename.
- `src/lib/media-plan/validation.ts` + `pipeline.ts` — rename propagated (comments + regex-adjacent references).

**Dispatch wiring (atom 19 — key research-side leverage):**
- `src/app/api/journey/dispatch/route.ts` — metadata block extended from 2 → 6 tags: `[businessModelType]` `[awarenessLevel]` `[salesMotion]` `[pricingModel]` `[conversionPath]` `[avgAcv]`. Parse from context string via regex on the labeled lines. This is the hook research skills use to route without re-inferring from narrative.

**Form UI (atoms 9, 11):**
- `src/components/journey/field-card.tsx` — extended with `mode: 'text' | 'enum' | 'multi-select'` and `choices` props. Enum mode renders pill buttons; multi-select toggles a Set serialized as comma-joined string.
- `src/components/journey/field-group.tsx` — routes enum keys (`salesMotion`/`pricingModel`/`conversionPath`/`avgAcv`) and multi-select keys (`channels`) through the picker; `getChoicesForKey` maps keys → option arrays.
- `src/components/journey/unified-field-review.tsx` — added 7th group icon (DollarSign for Pricing & Economics); `GROUP_ICONS` now 7 entries in v3 order.

**Tests (atom 14, 15):**
- `src/lib/journey/__tests__/field-catalog.test.ts` — rewritten for v3 shape; added `v3 obsolete fields` describe block documenting the 19 retired keys (pins the removal against regression).
- `src/lib/journey/__tests__/field-catalog-identity.test.ts` — now tests v3 identity-routing fields.
- `src/lib/journey/__tests__/baseline-metrics.test.ts` — rename follow-through.
- `src/lib/journey/__tests__/context-string.test.ts` — "Goals" label → "Primary 90-Day Goal".

### Fields retired in this pass (19 total)

All removed from `JOURNEY_FIELDS`. Existing user data in `business_profiles.all_fields` JSONB remains readable as legacy keys but isn't surfaced in v3 UI.

**Retired from v3 spec (per doc):** `guarantees`, `monthlyRevenueRange`, `payingCustomerCount`, `situationBeforeBuying`, `desiredTransformation` (5 red-removed), `businessModel` (repurposed → `salesMotion`), `last12MoGrowthRate` (renamed → `last3to6MoGrowthTrend`).

**Retired as not-in-v3-spec (per user directive "get rid of old ones that are not needed"):** `currentFunnelType` (replaced by `conversionPath`), `easiestToClose`, `bestClientSources`, `competitorFrustrations`, `marketBottlenecks`, `salesProcessOverview`, `campaignDuration`, `targetCpl`, `leadToCustomerRate` (replaced by `demoToCloseRate`), `currentMarketingActivities` (replaced by structured channels/budget/working/not-working), `headquartersLocation`, `marketProblem`.

### Verification state

- **`npm run build`**: ✅ Compiled successfully in 3.6s. All routes generated including `/journey`.
- **TS errors introduced by this session**: 0. Total remaining errors = 65, all pre-existing in known-broken test files (per CLAUDE.md).
- **Field-catalog tests**: 34/34 green (up from 33 — added v3 obsolete field coverage).
- **Field-catalog-identity tests**: 9/9 green (rewritten for v3 shape).
- **Baseline-metrics tests**: 23/23 green (rename verified).
- **Context-string tests**: 5/5 green.
- **Broader journey tests**: 258/270 pass. The 12 failures are all pre-existing (confirmed on clean tree): 9 in `session-state-server.test.ts` (Supabase mock issues), 1 in `read-research-result.test.ts` (same mock issue), 2 in `prefill-stream-view.test.tsx` (pre-existing rendering test).

### Open for next session (scope split per user direction 2026-04-21 17:50)

**Handled by another agent** (mapping research/media-plan leverage):
- `research-worker/src/identity/resolve-identity.ts` — prefer `salesMotion` as hard input for `businessModelType` classification (product-led→plg, sales-led→slg)
- `research-worker/src/skills/{measurement-skill,channel-mix-skill,audience-campaign-skill,creative-system-skill}.ts` — read 4 new metadata tags, route creative/channel/CAC by user-stated enums
- `research-worker/src/contracts.ts` — extend `strategicFrameSchema` to echo new enum signals
- Individual runner prompts (icp/offer/competitors/media-plan) — reference new fields when populated

**UI work still TODO (this agent, next session):**
- Profile edit page — PROFILE_FIELD_GROUPS renders via existing `field-group.tsx`; should just work but needs a manual browse-verify
- Journey test fixtures (`profile-dropdown.test.tsx`, `prefill-stream-view.test.tsx`, `journey-research-sandbox.test.tsx`) — update if they fail with new fixture shape (2 pre-existing failures in prefill-stream-view were NOT caused by this session but may need unrelated follow-up)
- Wizard step sequencing — `src/app/journey/page.tsx` orchestrates the flow; verify the 7 groups render in order and submit includes new enum values in the dispatch payload
- Optional: parse the current marketing "what's working"/"what's not working" / channel split into the dispatch context at a higher signal-to-noise ratio

## Scope pivot (2026-04-21 17:00, during beast-mode execution)

User invoked `boil the ocean`. Expanding scope to include downstream integration, BUT with a key surgical constraint:

**`businessModel` is KEPT in legacy paths** (scraper schema, profile column, chat refinement, pipeline-context). `salesMotion` is ADDED alongside it as the new canonical user-input enum. Resolver prefers `salesMotion` when present, falls back to `businessModel` for existing users.

**Rationale:** Full rename of `businessModel` → `salesMotion` would require:
- DB column rename in `business_profiles.business_model`
- Update 19 src/ files with substring-collision risk (`businessModel` is a prefix of `businessModelType`, the runner-routing output enum)
- Rewrite of `journey-chat-system.ts` Phase 1 logic (chat refinement surface, separate from v3 URL-form onboarding)

The scraper's `businessModel` output still provides signal for the identity resolver even after v3 onboarding switches to `salesMotion`. Two inputs, one output enum (`businessModelType`). Resolver does the hard mapping.

**Deferred to follow-up PR (non-blocking for v3 onboarding):**
- Rewrite of `journey-chat-system.ts` businessModel → salesMotion (chat refinement surface)
- Rename of `business_model` column
- Removal of `businessModel` field from `CompanyResearchResult` / scraper schemas

This preserves the critical path (v3 onboarding form + research pipeline routing) while keeping the diff reviewable.

---

## Plan

| # | Atom | Model | Budget | Dependencies | Verification | Status |
|---|------|-------|--------|--------------|--------------|--------|
| 1 | Rewrite `JOURNEY_FIELDS` in `field-catalog.ts`: remove 5, rename 2, add 19; rebuild `JOURNEY_REQUIRED_BLOCKER_FIELDS`, `JOURNEY_MANUAL_BLOCKER_FIELDS`, `JOURNEY_ENRICHMENT_FIELD_METAS`, `PROFILE_FIELD_GROUPS` for the 7 new groups | Opus | 40m / 60 calls | — | `tsc --noEmit` passes; file exports 7 group arrays | ✅ DONE 2026-04-21 15:30. 63 fields / 11 blockers / 7 groups. Runtime validation confirmed no duplicates, all group refs resolve, removed keys absent. Also fixed downstream `PostApprovalNextField` type in `journey-post-approval.ts` to derive from `JourneyRequirementDefinition['key']` union. |
| 2 | Add enum TS types + option arrays for salesMotion/pricingModel/conversionPath/avgAcv/channels; co-located at bottom of `field-catalog.ts` (no new file) | Sonnet | 15m / 30 calls | 1 | `tsc` passes | ✅ DONE 2026-04-21 15:35. Exports: `SalesMotion`, `PricingArchetype` (named to avoid collision with legacy `PricingModel` in onboarding/types.ts), `ConversionPath`, `AvgAcv`, `OnboardingChannel` + matching `*_OPTIONS` arrays. |
| 3 | ~~Update `src/lib/company-intel/{types,schemas,document-extraction-schema,run-company-research,research-service}.ts`~~ | — | — | — | — | ⏭️ SKIP (no-op). Company-intel Zod schemas are independent of field-catalog; scraper continues extracting `guarantees`/`businessModel`/`situationBeforeBuying`/`desiredTransformation` as **research-enrichment signal** (still useful for the pipeline even though these fields are no longer in v3 onboarding form). `tsc` shows 0 errors. Originally classified as in-scope; reclassified as out-of-scope after discovering the scraper's independence. |
| 4 | Update `src/lib/journey/prefill.ts`: drop removed-field mappings, add any prefillable new-field mappings | Sonnet | 10m / 20 calls | 1,3 | `tsc` passes |
| 5 | Update `src/lib/journey/research-sandbox.ts` field list | Haiku | 5m / 15 calls | 1 | `tsc` passes |
| 6 | Update `src/lib/ai/{journey-state,tools/update-field,prompts/journey-chat-system,context-builder}.ts`: remove dropped keys, add new keys to whitelists and prompt guidance | Sonnet | 20m / 40 calls | 1,2 | `tsc` passes; grep shows no stale refs |
| 7 | Update `src/lib/media-plan/{ad-copy-context-builder,validation,pipeline}.ts`: drop guarantees; rename `last12MoGrowthRate` → `last3to6MoGrowthTrend` | Sonnet | 15m / 30 calls | 1,2 | `tsc` + vitest media-plan tests pass |
| 8 | Rewrite `step-customer-journey.tsx`: remove situationBeforeBuying + desiredTransformation; add buyingTrigger + currentAlternative (ICP + Pain group) | Sonnet | 20m / 40 calls | 1,2 | Step renders; no TS errors |
| 9 | Split `step-product-offer.tsx` into §3 Offer & Product Experience (coreDeliverables, valueProp, firstValueMoment, activationEvent, retentionDrivers) and §4 Pricing & Economics (pricingModel, pricingTiers, targetPlan, avgAcv, avgCustomerLtv, targetCac, monthlyAdBudget); drop guarantees/monthlyRevenueRange/payingCustomerCount | Opus | 45m / 70 calls | 1,2 | Both steps render; required markers correct |
| 10 | Create `step-current-marketing.tsx` for §7: channels multi-select, budget split, what's working/not working, core metrics, optional funnel metrics, growth trend | Opus | 35m / 60 calls | 1,2 | New step renders; multi-select works |
| 11 | Add/rewire `step-product-revenue-model.tsx` for §1 (or augment existing step): productDescription, targetCustomer, salesMotion enum, pricingModel enum, conversionPath enum, avgAcv enum | Opus | 30m / 50 calls | 1,2 | Step renders with 4 enum pickers |
| 12 | Add step for §6 Goals & Strategy updates (remove desiredTransformation + situationBeforeBuying; add pipelineTarget, keyPromises) — likely editing existing step | Sonnet | 15m / 30 calls | 1,2 | Step renders |
| 13 | Update `document-prefill-summary.tsx`: drop removed fields from summary | Haiku | 10m / 20 calls | 1 | Prefill summary renders |
| 14 | Update `src/components/shell/onboarding-context.tsx` + 3 journey test fixture files: rename businessModel → salesMotion; drop removed fields | Haiku | 15m / 30 calls | 1,2 | Vitest passes |
| 15 | Update `src/lib/journey/__tests__/field-catalog-identity.test.ts`: expected counts and field names | Haiku | 10m / 20 calls | 1 | Vitest passes |
| 16 | Wire new step sequence in the onboarding wizard controller (likely `src/app/(onboarding)/...` or whatever hosts step ordering) | Sonnet | 20m / 40 calls | 8–12 | Browser walk-through: all 7 steps in order |
| 17 | **Verification gate:** `npm run build`, `npm run test:run`, manual fresh-account onboarding walkthrough, confirm context string via console | Opus | 30m / 50 calls | 1–16 | Build 0; tests green; context string has new fields |

**Total atoms: 17. Estimated wall time: 6–7h with parallelism (atoms 3–7 can fan out after 1+2; atoms 8–12 can fan out after 2; atom 13–15 can run in parallel late). Serial critical path: 1 → 2 → (9 or 10 or 11, whichever's heaviest) → 16 → 17.**

---

## Open decisions for user (non-blocking — defaults assumed)

1. **D1:** Should existing users' `businessModel` text auto-migrate to `salesMotion` enum via a one-shot LLM classifier pass? **Default: NO** — leave as JSONB legacy, force re-answer on next profile visit.
2. **D2:** Should the 4 funnel % fields have a "skip" toggle or be hidden behind a "show advanced" disclosure? **Default: disclosure** ("Optional funnel metrics" collapsed by default).
3. **D3:** Is "Other" an allowed value on `channels` multi-select with a freeform sub-field? **Default: YES** (single-line text when "Other" is selected).
4. **D4:** Should `pricingModel/conversionPath/avgAcv` be hard-blockers or soft-blockers (allow skip with nag)? **Default: hard-blockers** per the spec's emphasis.
5. **D5:** For `salesMotion=hybrid`, should the resolver's `businessModelType` default to `plg` (self-serve with demo option) or `slg`? **Default: let resolver decide from website signals — no hard override.**

If user overrides any default, update atoms before execution.
