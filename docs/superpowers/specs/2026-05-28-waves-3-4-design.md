# Waves 3 + 4 Design — Trust Layer + Consolidation

> Date: 2026-05-28 · Branch: `feat/v2-lab-section-wire` · HEAD at writing: `883e98a9`
> Predecessor: `docs/2026-05-27-pipeline-audit-and-restructure.md` (13H + 22M + ~8L audit)
> Method: brainstorming pass against the master audit + 3 sub-audits + Anthropic agent papers + AI SDK v6 + Ammar's project-memory feedback files. Single design doc; two Codex handoffs (one per wave) follow from it.

---

## 0. Where we are

Waves 0–2 landed (11 commits, `b1c83fca` → `883e98a9`):

- **W0**: executable Brave `web_search`, per-excerpt source attribution, `executionMode:'lab'` default — search now actually fires, evidence excerpts point to their own source, the lab path is the default kickoff.
- **W1**: ported `main`'s advertiser-relevance matcher into the lab as a pure module, applied it in `adlibrary.ts` with domain corroboration + typed gap on no-match, added `google_ads`/`meta_ads` to the Competitor allow-list, added `mergeAdEvidenceGroups` so the model's own ad-tool calls become `body.adEvidence`, rendered creatives + library links + counts + gaps in the competitor renderer with an honest empty state.
- **W2**: captured `query`/`sourceUrl` on tool events, derived per-zone `latestTool`/`latestSource`/`capabilityGaps` read-time from persisted events (no telemetry writes — read-time path was the recommended one), replaced the global 60-event cap with a per-zone budget, reused the existing `reap_orphaned_section_runs` RPC on stale-running detection, replaced the per-mount kickoff useRef with a module-level Set keyed by runId.

Verification at design-time: `npm run test:run` = 1087 pass / 1 skip, `npm run build` exit 0, scope guard clean (no `research-worker/` or `supabase/migrations/` touches, revision-CAS intact).

## 1. What this design closes (and what it doesn't)

Mapping audit kinks to waves:

| Kink | Severity | Wave | Atom |
|---|---|---|---|
| A1 — no claim/citation verifier | H | **W3** | T1 |
| A2 — sections complete with required evidence missing | H | **W3** | T2 |
| G1 — no eval gate | H | **W3** | T3 |
| C1 follow-up — corpus-side typed gap when evidence dropped (silent-drop note from W2) | (M) | **W3** | T3 |
| B4 — skill↔registry drift | H | **W4** | A.1 |
| B5 — registered dead capabilities | M | **W4** | A.2 |
| B8 — `spyfu.intent` ignored | L | **W4** | A.2 |
| B7 — SERP shims named like first-party tools | M | **W4** | A.3 |
| C2 — dump-everything context | M | **W4** | B.1 |
| E3 — persistent 320px dashboard rail | M | **W4** | C.1 |
| E4 — three color vocabularies + undefined CSS vars | M | **W4** | C.2 |
| E5 — Paid Media Plan falls to generic renderer | M | **W4** | C.3 |
| E6 — copy button drops body | M | **W4** | C.4 |
| E7 — live default-selection steals focus | L | **W4** | C.4 |
| F5 — `seedOrchestration` not idempotent vs complete sections | M | **W4** | D.1 |
| F7 — `freezeReviewedBriefSnapshot` non-atomic race | M | **W4** | D.1 |
| F8 — `auth()` try/catch masks Clerk failures as 401 | M | **W4** | D.2 |
| F9 — `_capabilities` always 200 | M | **W4** | D.2 |
| Delete legacy worker positioning path | n/a | **W4** | D.3 |

Explicitly **deferred to future waves** (named so they don't sneak in):

- **D1/D2/D3 progressive structured streaming** → Wave 5 (streaming vertical). This was W2 Task 5, deferred per its own recommendation. Field-by-field token streaming inside a section remains a non-goal until W5+.
- **A3 per-claim verified/inferred/gap confidence UI calibration** → Wave 5 or 7. The verifier emits the data; surfacing it as per-claim chips in the reader is W5+ work.
- **LinkedIn ads + Foreplay fallback + domain-FIRST SearchAPI lookup** → Wave 6 (ad-platform breadth). Carry-overs from W1, deliberately out of scope until trust layer is in production.
- **F4 impersonation data-path** → known deferral per project memory; not included.
- **G2 production decision-tracing** → Wave 7+ observability.
- **F6 active-run guard** → false positive (revision-CAS is the intentional model per memory); do not "fix."
- **Claude Code eval-agent (slash command / agent definition)** → spec'd here, built post-W4.

## 2. Decisions register (one-line each, grounded)

| # | Decision | Why (grounded) |
|---|---|---|
| D1 | Wave 3 = pure trust layer (A1+A2+G1 only) | Goal-coherent wave; D1 streaming is independent and pushing it into W3 mixes concerns. User-confirmed. |
| D2 | Verifier shape = **deterministic structural** (no extra LLM call) | Catches the most common fabrication modes (made-up prices, invented quotes, hallucinated competitors) at zero cost. Matches `feedback_no_api_testing_loops` memory + Karpathy §2 simplicity. User-confirmed. |
| D3 | Fail-closed = **required-evidence-class only** (per-section registry config) | Matches the audit's framing of A2 ("Competitor shipped with 0 ad evidence"); per-section configurable; doesn't add a second threshold knob. User-confirmed. |
| D4 | G1 eval gate = **fixture-based deterministic** in vitest; **no live-judge in CI** | Anti-API-loop preference (`feedback_no_api_testing_loops`). A separate Claude Code eval-agent (uses Claude Code's own model, zero AI-GOS API cost) is the future on-demand drift check. User-directed. |
| D5 | Wave 4 = §5 cleanup as-written (no streaming, no breadth) | Coherent "one pipeline, design-system clean" goal. Streaming → W5, breadth → W6. User-confirmed. |
| D6 | Section-scoped context (C2) = **keyword filter, not LLM-judge** | Karpathy §2 simplicity. LLM-judge retrieval is W5+ if needed. |
| D7 | W4 D.3 = actually delete legacy worker positioning runners (not just unroute) | Master plan §5 says "delete the legacy worker positioning path"; D.3 is the literal interpretation. Worker still keeps `deepResearchProgram` (Perplexity corpus) — that's the kept worker function. User-confirmed. |
| D8 | W3-T3 fixtures = lift `{body, toolResults}` from past authenticated runs (Ramp/Vanta/Webflow/Notion) | These runs are already paid for; reusing their captured data costs nothing. ~30min fixture authoring per Ammar's go-ahead. |

## 3. Wave 3 design — trust layer

**Goal in one sentence:** every numeric, quote, URL, and competitor/advertiser name in a section body either traces to a captured tool-result OR is explicitly flagged; sections refuse to commit when a required evidence class is missing.

**Sources of grounding:**

- Anthropic *Building Effective Agents* / *Multi-Agent Research* — `CitationAgent` pattern (verifier-as-separate-pass).
- Audit §3.A1/A2 + §G1 — concrete failure modes (Competitor shipped 0 ad evidence, no eval gate).
- AI SDK v6 — verifier is a pure JS pass over the assembled body; no AI SDK primitive needed for the structural variant.
- Memory `feedback_no_fabricated_pricing` — "Never guess pricing; only verified scraped data with source URLs" — the structural verifier directly enforces this on pricing strings.

### W3-T1 — Structural verifier (pure module, no LLM)

**New files:**

```
src/lib/lab-engine/agents/verification/claim-extractor.ts
src/lib/lab-engine/agents/verification/structural-verifier.ts
src/lib/lab-engine/agents/verification/__tests__/claim-extractor.test.ts
src/lib/lab-engine/agents/verification/__tests__/structural-verifier.test.ts
```

**Claim extractor** — given a typed section body (envelope-flattened, the same shape `competitor-landscape.tsx` etc. consume), produces `Claim[]`:

```ts
type Claim =
  | { kind: 'numeric';      value: string; raw: string }   // "$49/mo", "32%", "200M users"
  | { kind: 'quote';        value: string; raw: string }   // verbatim quotes captured between double-quotes
  | { kind: 'url';          value: string; raw: string }   // any https?:// URL appearing in body prose or evidence fields
  | { kind: 'entityName';   value: string; raw: string };  // competitor / advertiser / persona name fields
```

Extraction is per-section structural — it reads known field paths (e.g., `competitorSet.competitors[].name`, `adEvidence.advertiserGroups[].advertiserName`, `pricingReality.tiers[].price`, `voc.quotes[].text`) plus a regex sweep of prose fields for `$X`, `X%`, `"..."`, `https?://...`.

**Structural verifier** — given `(body, capturedToolResults, corpusExcerpts)`, returns `VerificationReport`:

```ts
type ClaimVerdict =
  | { status: 'verified';    claim: Claim; matchedSourceRef: SourceRef }
  | { status: 'unsupported'; claim: Claim; reason: 'no_match' | 'partial_match' };

type SourceRef =
  | { kind: 'toolResult'; toolName: string; stepIndex: number; field?: string }
  | { kind: 'corpusExcerpt'; excerptIndex: number; sourceUrl: string };

type VerificationReport = {
  verifiedCount: number;
  unsupportedCount: number;
  claims: ClaimVerdict[];
};
```

**Match logic:**

- `numeric`: exact match in any tool-result body text or excerpt text. Normalize whitespace + currency symbols. `$49.00` matches `$49`. Permissive: `200M users` matches `200 million users`.
- `quote`: substring match (case-insensitive, normalized whitespace) on any tool-result text or excerpt. Quotes shorter than 6 words are skipped (too noisy).
- `url`: exact match in `sources[]`, any `toolResult.url`, any `toolResult.results[].url`, or any captured `payload.sourceUrl`/`payload.query` event metadata.
- `entityName`: substring match (case-insensitive) in any tool-result body. Names shorter than 3 chars are skipped.

**Constraints:**

- Pure module: **zero imports from other lab files** except local types (mirror W1's matcher).
- No `process.env`, no network, no async.
- Pre-existing patterns: matches the style of `src/lib/lab-engine/agents/tools/advertiser-match.ts` (W1).

**Test contract** (vitest):

- Each `Claim.kind` has a "matches" test + a "doesn't match" test.
- One per-section integration test using a captured fixture (deferred to T3 fixtures, vitest imports the same module).

**Commit:** `feat(lab-engine): structural claim verifier (pure module + tests)`

### W3-T2 — Apply verifier + fail-closed gate

**Files:**

```
src/lib/lab-engine/sections/section-registry.ts       (add requiredEvidenceClasses)
src/lib/lab-engine/agents/run-section.ts              (apply verifier between answer-tool attempt and save)
src/lib/lab-engine/artifacts/artifact-envelope.ts     (extend envelope schema with optional `verification`)
src/lib/lab-engine/sections/__tests__/section-registry.test.ts  (update for required-class config)
src/components/research-v2/audit-reader-shell.tsx     (light touch: verified/unsupported count chip on section header)
```

**Per-section required classes:**

```ts
positioningMarketCategory:      ['marketCategory_name']
positioningBuyerICP:            ['icp_persona', 'icp_quote_or_gap']
positioningCompetitorLandscape: ['competitor', 'adEvidence_or_gap']  // the audit's flagship case
positioningVoiceOfCustomer:     ['voc_quote_or_gap']
positioningDemandIntent:        ['demand_signal_or_gap']
positioningOfferDiagnostic:     ['offer_axis']
```

Each required class is implemented as a small body-inspector predicate (e.g., `hasAtLeastOne(body.competitorSet.competitors, c => c.name)`). The `_or_gap` suffix means "OR `body.dataGaps[]` includes a gap for that class."

**Run-section integration point** — in `streamSectionViaAnswerTool`, after `buildAnswerToolAttempt` (~`:2696`) returns and before `withNormalizedSectionOutput`/save:

```ts
// 1. Verify claims
const verification = structuralVerifier({
  body: answerInput,
  toolResults: answerResult.steps.flatMap(s => s.toolResults ?? []),
  corpusExcerpts: researchInput.evidence ?? [],
});

// 2. Annotate envelope (writer adds `verification` block to body)
const annotated = withVerificationBlock(answerInput, verification);

// 3. Fail-closed if required class missing AND no typed gap
const missingClass = checkRequiredEvidenceClasses(annotated, definition.requiredEvidenceClasses);
if (missingClass) {
  throw new RequiredEvidenceMissingError({
    sectionId: definition.id,
    missingClass,
    verifiedCount: verification.verifiedCount,
    unsupportedCount: verification.unsupportedCount,
  });
}
// 4. Continue to save (existing path)
```

The error path runs through the existing `markSectionFailed` channel with reason `required_evidence_missing` + structured metadata. The reader renders a terminal error chip with the missing class name; the rerun button stays available.

**Reader surface (light touch):**

- Add a `verifiedCount / unsupportedCount` small text chip on each section header in `audit-reader-shell.tsx` next to the existing confidence chip.
- No per-claim coloring/calibration in W3 (that's A3, deferred to W5+).

**Commit:** `feat(lab-engine): apply structural verifier + required-evidence-class fail-closed gate`

### W3-T3 — Fixture eval gate + corpus-gap carry-over

**New files:**

```
src/lib/lab-engine/agents/verification/__evals__/fixtures/
  ├── ramp-market-category.json           (clean pass)
  ├── ramp-competitor-landscape.json      (clean pass with adEvidence)
  ├── vanta-competitor-no-ads.json        (clean pass with adEvidence_or_gap → gap)
  ├── webflow-buyer-icp.json              (clean pass)
  ├── notion-voice-of-customer.json       (clean pass)
  ├── synthetic-fabricated-price.json     (deliberately fabricated $99/mo not in any tool-result → fail unsupported)
  ├── synthetic-missing-competitor.json   (competitorSet empty, no gap → fail required-class)
  ├── synthetic-fabricated-quote.json     (made-up quote → fail unsupported)
  └── ... ≥3 per section, total ~15
src/lib/lab-engine/agents/verification/__evals__/verifier.eval.test.ts
```

**Fixture authoring** (~30min Ammar-approved):

- Dump `{body, toolResults, researchInput.evidence, sources}` from Supabase for the 4 known-good real runs (Ramp `749f38ff`, Vanta `1a0c4e2b`, Webflow `7d2b96e0`, Notion `45432554`).
- For each, annotate `expected_verdict: { verifiedCount, unsupportedCount, requiredClassesSatisfied: true }`.
- Hand-build the ~3 synthetic "fail" fixtures.

**Test contract** (vitest):

- Each fixture is loaded, fed through the verifier + required-class checker.
- Assert `verifiedCount`/`unsupportedCount`/`requiredClassesSatisfied` match the fixture's `expected_verdict`.
- Test passes only when ALL fixtures match.

**Corpus-gap carry-over (1-line W2 follow-up):**

- `src/lib/journey/server/corpus-to-research-input.ts` — where Wave 0 drops an evidence excerpt for having no URL, additionally push a typed `capability_gap` into the corpus' `_capabilities`/sources output: `{ class: 'evidence_excerpt_dropped', reason: 'no_source_url', count: N }`. The downstream `audit-state` `capabilityGaps` machinery (W2-T1) will surface it.

**Commit:** `feat(research-v2): fixture-based verifier eval gate + corpus-evidence-dropped gap signal`

### W3 verification gate

- `npm run build` exit 0
- `npm run test:run` → existing 1087 pass + new verifier tests + new fixture eval all green; no new failures
- One live Notion re-run (corpus is cached, ~$0.10 DeepSeek for sections) shows the `verification` block on every section's typed artifact and a "Verified N / Unsupported M" chip on each section header
- Spot-check: temporarily inject a fabricated price into one section's prompt → confirm the verifier flags it as unsupported and the required-class check still passes (price isn't a required class — only the audit's flagship "Competitor must have evidence or gap" fails closed)
- Spot-check (negative): delete `competitorSet.competitors` in a fixture → confirm `RequiredEvidenceMissingError` fires and the section reaches terminal `error` state with the structured reason

## 4. Wave 4 design — consolidation + cleanup

**Goal in one sentence:** one pipeline, design-system clean, dead code gone, legacy worker positioning runners deleted.

### Batch A — Tool layer parity & honesty (3 commits)

**A.1 [B4] — Skill↔registry parity + diff test**

Audit §B4 + tool-layer-audit §2 already maps the drift:

| Section | Skill says | Registry allows | Drift |
|---|---|---|---|
| Market | `pagespeed` | not allowed | Skill is wrong OR registry is wrong |
| Buyer ICP | `reviews` | not allowed | Skill is wrong OR registry is wrong |
| Offer | `reviews`, `ga4` | not allowed | Skill is wrong OR registry is wrong |

For each section, **resolve by editing the skill OR the registry to agree.** Default: trust the registry (it's the runtime truth); update SKILL.md tool tables to match. Exception: if Ammar wants a tool exposed (e.g., `pagespeed` for Market is genuinely useful), update the registry instead.

**New test:** `src/lib/lab-engine/sections/__tests__/skill-registry-parity.test.ts` — for each section, parse the tool-table list from its `SKILL.md` and assert it equals (or is a subset of) `allowedTools`.

**Files:**

```
src/lib/lab-engine/skills/positioning-market-category/SKILL.md
src/lib/lab-engine/skills/positioning-buyer-icp/SKILL.md
src/lib/lab-engine/skills/positioning-offer-diagnostic/SKILL.md
src/lib/lab-engine/sections/__tests__/skill-registry-parity.test.ts (NEW)
```

(Competitor SKILL.md was already fixed in W1-T3.)

**Commit:** `fix(lab-engine): align skill tool tables with section registry + parity test`

**A.2 [B5+B8] — Dead capability cleanup**

`ga4` always returns `credentialGap` (no API even when key is set, per audit). `spyfu` returns real data but no section allows it. `spyfu.intent` input is declared and ignored.

Decision per tool (recommend default; flag user override at handoff time):

- `ga4` — **delete** (file + `TOOL_CATALOG` entry). It's a dead capability with no implementation roadmap. Remove `ga4` mentions from any skill. Effort S.
- `spyfu` — **delete** (file + entry) OR **expose in Competitor + Demand** if the SpyFu data is wanted. Audit + memory don't indicate active use; recommend delete. Update Competitor SKILL.md (already cleaned in W1) and removed-tool tests.
- `spyfu.intent` — moot if spyfu is deleted; otherwise remove the unused input from the schema.

**Files (if both delete):**

```
src/lib/lab-engine/agents/tools/ga4.ts                  (DELETE)
src/lib/lab-engine/agents/tools/spyfu.ts                (DELETE)
src/lib/lab-engine/agents/tools/index.ts                (remove from TOOL_CATALOG + ToolName union)
src/lib/lab-engine/agents/tools/__tests__/ga4.test.ts   (DELETE if exists)
src/lib/lab-engine/agents/tools/__tests__/spyfu.test.ts (DELETE if exists)
# + any SKILL.md mentions
```

**Commit:** `chore(lab-engine): remove dead-capability tools ga4 + spyfu (no consumers)`

**A.3 [B7] — Honest SERP-shim names + prose**

`reviews` queries Google for snippets, not G2/Capterra/Trustpilot APIs. `keyword_ad_probe` reports SERP organic/ad result counts, not search volume or ad spend.

**Files:**

```
src/lib/lab-engine/agents/tools/reviews.ts         (rewrite description to "SearchAPI Google SERP snippets from G2/Capterra/Trustpilot domains"; keep tool name)
src/lib/lab-engine/agents/tools/keyword-ad-probe.ts (rewrite description to "SearchAPI Google SERP organic+ad result counts; NOT search-volume or ad-spend metrics")
src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md  (update prose around `reviews` usage)
src/lib/lab-engine/skills/positioning-voice-of-customer/SKILL.md     (same)
src/lib/lab-engine/skills/positioning-demand-intent/SKILL.md         (rewrite the "demand signal" wording)
```

**Commit:** `chore(lab-engine): rename SERP-shim tool descriptions honestly (reviews, keyword_ad_probe)`

### Batch B — Context discipline (1 commit)

**B.1 [C2] — Section-scoped corpus excerpts**

Today: `corpus-to-research-input.ts` ships ALL excerpts to ALL sections. Violates Anthropic just-in-time context discipline.

**Approach:** per-section keyword set + relevance filter. No LLM-judge.

**Files:**

```
src/lib/journey/server/corpus-to-research-input.ts                            (add section-scoping)
src/lib/journey/server/__tests__/corpus-to-research-input.test.ts             (extend with section-scope assertions)
```

**Per-section keyword sets (initial — tune later):**

```ts
positioningMarketCategory:      ['category', 'market', 'segment', 'industry', 'tam', 'sam']
positioningBuyerICP:            ['icp', 'persona', 'buyer', 'role', 'title', 'jtbd', 'pain', 'use case']
positioningCompetitorLandscape: ['competitor', 'alternative', 'vs', 'comparison', 'pricing', 'feature']
positioningVoiceOfCustomer:     ['quote', 'review', 'testimonial', 'feedback', 'complaint', 'g2', 'trustpilot']
positioningDemandIntent:        ['search', 'keyword', 'serp', 'demand', 'volume', 'intent']
positioningOfferDiagnostic:     ['offer', 'price', 'plan', 'tier', 'trial', 'pricing', 'guarantee']
```

Each section receives excerpts where excerpt text matches ≥1 keyword (case-insensitive substring). Excerpts matching nothing flow to a "shared" pool every section sees.

**Commit:** `feat(research-v2): section-scoped corpus excerpt selection (keyword filter)`

### Batch C — UI polish (4 commits)

**C.1 [E3] — Rail collapse / one-pager**

`audit-reader-shell.tsx:940` renders persistent 320px right rail. DESIGN.md says ≤1080px single-column for standalone views; locked direction is "lean one-pager."

**Behavior:**

- While ANY section is non-terminal: render a slim left progress strip (40-60px wide) showing section dots + percentage, NOT the full 320px confidence rail.
- Once all sections terminal: hide the rail entirely; reading column becomes single-column up to 1080px.

**File:** `src/components/research-v2/audit-reader-shell.tsx`

**Commit:** `refactor(research-v2): collapse 320px rail to slim progress strip; one-pager when complete`

**C.2 [E4] — Color token sweep**

Three color vocabularies in play: literal Tailwind palette (`bg-rose-500/12`, `bg-emerald-500/10`...), undefined CSS vars (`--text-primary`, `--accent-blue`, `--border-subtle`), and shadcn semantic tokens (`text-destructive`, `text-muted-foreground`...). DESIGN.md only defines `--text-1..4`, `--accent`, `--border`.

**Approach:** sweep to shadcn semantic tokens everywhere. The undefined CSS vars in `competitor-landscape.tsx` likely resolve to nothing in one theme — this is a latent bug fix.

**Files:**

```
src/components/research-v2/audit-reader-shell.tsx
src/components/research-v2/section-renderers/*.tsx           (all renderers)
src/components/research-v2/primitives/*.tsx                  (if applicable)
```

Map: `bg-rose-500/X text-rose-600` → `bg-destructive/X text-destructive`; same for amber→warning (or muted), emerald→success (custom token if not in shadcn). `var(--text-primary)` → `text-foreground`; `var(--text-secondary)` → `text-muted-foreground`; `var(--accent-blue)` → `text-primary` or whatever the brand accent is in DESIGN.md; `var(--border-subtle)` → `border-border`.

**Commit:** `refactor(research-v2): sweep color literals + undefined CSS vars to shadcn semantic tokens`

**C.3 [E5] — Paid Media Plan typed renderer**

Today: Paid Media Plan falls to `GenericTypedArtifactRenderer` → title-cased raw keys + nested `<dl>` dumps.

**New file:** `src/components/research-v2/section-renderers/paid-media-plan.tsx` matching the format of the 6 positioning renderers (`SubsectionBlock` per logical sub-section, semantic typography, honest empty states).

**Route from:** `src/components/research-v2/section-renderers/typed-artifact-renderer.tsx:492` switch.

**Commit:** `feat(research-v2): PaidMediaPlanRenderer with typed sub-sections`

**C.4 [E6+E7] — Copy button + default-selection focus fix**

E6: `copyActive` (audit-reader-shell.tsx:803) copies `title\n\nverdict\n\nstatusSummary` only — drops every evidence field. Failure is silently swallowed.

E7: `computedDefault` (`:680-688`) recomputes every poll until user clicks; `useEffect` scroll-resets on `active` change (`:755-757`). Auto-selected section jumps mid-read.

**Files:**

```
src/components/research-v2/audit-reader-shell.tsx (both fixes)
```

E6 fix: serialize the full typed body to markdown (reuse `json-to-markdown.ts` if available; otherwise simple per-subsection markdown). Replace `catch {}` with a toast surface.

E7 fix: once a section is `complete` and visible, mark it as the stable `userActive` until the user explicitly clicks another. Stop recomputing `computedDefault` after first stable selection.

**Commit:** `fix(research-v2): copy full typed artifact + stop auto-selection from scroll-jumping`

### Batch D — Backend cleanup + legacy worker deletion (3 commits)

**D.1 [F5+F7] — Idempotency + race fixes**

F5: `seed_orchestration` re-call on a partially-complete fan-out inserts orphan `queued` rows for already-complete zones (migration `20260520_orchestrate_parent_child.sql:85-103`). Documented idempotency contract violated.

F7: `freezeReviewedBriefSnapshot` (`orchestrate-db.ts:82-129`) is non-atomic read-modify-write on `research_artifacts.thesis`.

**Files:**

```
supabase/migrations/20260528_seed_orchestration_complete_idempotency.sql  (NEW)
supabase/migrations/20260528_freeze_thesis_security_definer_rpc.sql        (NEW)
src/lib/research-v2/orchestrate-db.ts                                       (use new RPC)
src/lib/research-v2/__tests__/orchestrate-db.test.ts                        (extend)
```

The seed_orchestration migration: in the existing SECURITY DEFINER function, change the reuse `select` to also match `status='complete'` and return it with `reused=true` instead of inserting a fresh queued row.

The freeze migration: wrap the freeze RMW in a SECURITY DEFINER RPC with conditional `update ... where thesis->>'source' is distinct from 'onboarding_v2_review'`.

**Commit:** `fix(research-v2): seedOrchestration idempotency for complete zones + atomic thesis-freeze RPC`

**D.2 [F8+F9] — Auth + diagnostics honesty**

F8: `orchestrate/route.ts:159-168` and `run-lab-section/route.ts:188-198` wrap `auth()` in `try/catch → userId=null` → 401. Other routes call `auth()` unguarded. Mask real Clerk failures as auth errors.

F9: `_capabilities/route.ts:42-58` always returns HTTP 200, including when the worker is unreachable. String-only signal (`'unreachable'`/`'unconfigured'`) is easy to miss.

**Files:**

```
src/app/api/research-v2/orchestrate/route.ts        (drop try/catch on auth)
src/app/api/research-v2/run-lab-section/route.ts    (drop try/catch on auth)
src/app/api/research-v2/_capabilities/route.ts      (return structured worker_reachable + lastError)
src/app/api/research-v2/__tests__/_capabilities.test.ts (extend; create if absent)
```

**Commit:** `fix(research-v2): unwrap auth() try/catch + structured _capabilities worker_reachable signal`

**D.3 [legacy delete] — Delete worker positioning runners**

The legacy worker `positioning-audit-orchestrator` + 6 positioning runners + their tests are now unused — the lab path is canonical and Waves 0–2 + W3 + W4 Batches A–C bring it past parity. Time to delete.

**Files (DELETE):**

```
research-worker/src/runners/positioning-audit-orchestrator.ts
research-worker/src/runners/positioningMarketCategory.ts
research-worker/src/runners/positioningBuyerICP.ts
research-worker/src/runners/positioningCompetitorLandscape.ts
research-worker/src/runners/positioningVoiceOfCustomer.ts
research-worker/src/runners/positioningDemandIntent.ts
research-worker/src/runners/positioningOfferDiagnostic.ts
research-worker/src/runners/positioningPaidMediaPlan.ts          (if exists)
research-worker/src/runners/__tests__/positioning*.test.ts
```

**Files (UPDATE):**

```
research-worker/src/index.ts                                  (remove positioning route registration + the `reapOrphanedSectionRuns` boot call IF the lab reaper now covers it — confirm: W2-T3 added a reader-side reaper; the worker-boot reaper can stay as a belt-and-suspenders, BUT do delete the unused runner imports)
src/app/api/research-v2/orchestrate/route.ts                  (remove executionMode 'draft'|'deep'|'managed' branches; lab is the only valid mode)
src/app/api/research-v2/dispatch/route.ts                     (audit: only the corpus path should remain; verify no positioning-runner dispatch left)
src/lib/journey/server/dispatch-research.ts                   (same audit)
docs/2026-05-18-claude-managed-agents-migration-intent.md     (mark legacy path retired)
```

**Constraints:**

- **Keep `research-worker/src/runners/deepResearchProgram.ts`** (Perplexity corpus — that's the kept worker function per ADR-0007 from memory s17).
- **Keep `research-worker/src/runners/ad-scripts.ts` IF still in use** (verify before delete — the v3 onboarding integration removed `/api/scripts`, but per memory s23 it removed "stale scripts surfaces" — confirm there's no consumer).
- **The worker still boots and serves `/capabilities` + the corpus endpoint** — that's intentional.

**Verification within commit:**

- `cd research-worker && npm run build` exits 0 after deletes
- Frontend `npm run build` + `npm run test:run` green
- No grep hit for `executionMode:'draft'|'deep'|'managed'` outside test fixtures
- Worker `/capabilities` still 200s (curl test)

**Commit:** `chore(research-v2): delete legacy worker positioning runners; lab is the only section path`

### W4 verification gate

- `npm run build` exit 0 (frontend) + `cd research-worker && npm run build` exit 0
- `npm run test:run` no new failures + new parity test + new orchestrate-db tests + new capabilities test all green
- `npm run lint` clean (0 errors; pre-existing 65 warnings OK)
- `grep -r "executionMode:'draft'\|executionMode:'deep'\|executionMode:'managed'"` returns no production hits
- One smoke run on the lab path completes 7/7 end-to-end with the section-scoped corpus + the new tool descriptions + the redesigned reader UI
- Worker `/capabilities` still 200s; corpus still runs from the worker
- (Optional but recommended) Ammar eyeballs the rebuilt `:3100` reader on an existing run for the C.1/C.2/C.3/C.4 visual changes

## 5. Out-of-scope register (explicit)

So future Codex sessions don't sneak these in:

- ❌ Streaming partials on the answer-tool path (D1/D2/D3) — **Wave 5**
- ❌ LinkedIn ads / Foreplay fallback / domain-FIRST SearchAPI lookup — **Wave 6**
- ❌ Per-claim verified/inferred/gap UI calibration (A3) — **Wave 5+**
- ❌ Impersonation data-path (F4) — known deferral, project memory
- ❌ Production decision-tracing (G2) — Wave 7+
- ❌ The `commit_artifact_section` run-id active-run guard (F6) — false positive, revision-CAS is intentional
- ❌ Claude Code eval-agent build — spec'd here, built after W4 closes
- ❌ Telemetry-write path for `latestTool`/`latestSource` — W2 already chose the read-time derivation path; don't reintroduce the write path
- ❌ LLM-as-judge in CI eval — anti-API-loop preference

## 6. Open questions / risks

| # | Question / risk | Mitigation |
|---|---|---|
| Q1 | Verifier false-positive rate on legitimate paraphrased claims | Structural verifier is conservative by design (substring match) — false positives are claims flagged "unsupported" when the model paraphrased. Mitigated by fixture eval; tuneable per claim kind. Hard fail-closed only on required-evidence-class missing, NOT on individual unsupported claims. |
| Q2 | Required-class `_or_gap` predicates need careful `dataGaps[]` matching | T2 spec says "OR `body.dataGaps[]` includes a gap for that class." Verify the gap-class taxonomy matches what tools actually emit. |
| Q3 | Deleting `ga4`/`spyfu` might break a forgotten consumer | Mitigation: `git grep` for `ga4|spyfu` before delete; commit is reversible. |
| Q4 | Deleting worker positioning runners might break a forgotten codepath | Mitigation: D.3's verification gate (`grep` for `executionMode:'draft'` etc., curl `/capabilities`, run a fresh smoke). Two-commit safety net possible if needed (deprecate then delete). |
| Q5 | Color sweep might create visual regressions | Mitigation: C.2 is mechanical; before/after `:3100` screenshot diff recommended in QA. |
| Q6 | Section-scoped keyword filter might starve a section that needs broad context | Mitigation: every section also receives the "matches nothing" shared pool; tuneable by editing the per-section keyword set without code change after a live run. |

## 7. References

- **Master audit:** `docs/2026-05-27-pipeline-audit-and-restructure.md` (13H/22M/8L, §5 wave plan)
- **Sub-audits:** `docs/audit/2026-05-27-{backend-persistence,tool-layer-ad-engine,ui-streaming}-kinks.md`
- **Wave 1 handoff:** `docs/2026-05-28-wave1-codex-handoff.md` (predecessor pattern for atomic commits)
- **Wave 2 handoff:** `docs/2026-05-28-wave2-codex-handoff.md` (out-of-scope register pattern; Task 5 deferral language)
- **Anthropic** — Building Effective Agents, Multi-Agent Research, Context Engineering (cited in master plan §1)
- **AI SDK v6** — `streamObject.partialObjectStream`, `experimental_useObject`, `ToolLoopAgent`, `Output.object` (cited in master plan §1; only relevant to Wave 5+ here)
- **Project memory** — `feedback_no_api_testing_loops`, `feedback_no_fabricated_pricing`, `feedback_spend_tokens_use_opus`, `feedback_show_streaming_progress`

## 8. Sequencing

1. **Now:** user reviews this spec, requests changes if any.
2. **Next:** invoke `superpowers:writing-plans` skill to draft `docs/2026-05-28-wave3-codex-handoff.md` and `docs/2026-05-28-wave4-codex-handoff.md` in the same atomic-commit style as Waves 1+2.
3. **Then:** dispatch Codex for Wave 3 (xhigh, the existing `feat/v2-lab-section-wire` worktree). HQ reviews + QA-gates Wave 3 before Wave 4 dispatches.
4. **Then:** dispatch Codex for Wave 4. HQ reviews + QA-gates W4.
5. **Then:** Wave 5 streaming + Wave 6 ad-platform breadth become the next plan-and-handoff cycle.
