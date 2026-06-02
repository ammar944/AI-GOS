# QA findings → next research list (2026-06-02 live /research-v3 run)

Context: the Perplexity-Sonar corpus path now works locally (no Anthropic in the loop), and the live run on `/research-v3` surfaced six gaps. None are corpus-pipeline regressions — they are UI/UX clarity, table readability, a duplicate-key render warning, a known ad-seeding gap, and one stale-doc clarification. `/research-v3` (not `/research-v2`) is the canonical live surface; all of this session's edits are visible there because both pages share the same `AuditReaderShell`.

## Priority table

| Item | Severity | Type | Quick win? | One-line action |
|------|----------|------|------------|-----------------|
| I1 — DataTable duplicate React key | P2 | bug | Yes | Suffix the row key with `rowIndex` in `data-table.tsx` (one-line shared fix). |
| I2 — Competitor ad creatives missing | P1 | bug | No | Seed the ad probe from the model-discovered competitor set; confirm SearchAPI yield on a live run. |
| I3 — DataTable unreadable (no column sizing) | P1 | design | No | Redesign shared DataTable (column budget, overflow strategy, contrast, responsive cards) + content-fit the heavy renderers. |
| I4 — Corpus search activity invisible | P2 | visibility | Yes | Surface the already-captured citations/sources post-corpus; live "searching" chips are design-gated. |
| I5 — Verification counts unlabeled (87/55) | P2 | clarification | Yes | Add inline labels + tooltip legend to `RunStatusBar`; optionally sum load-bearing subset only. |
| I6 — /research-v2 vs /research-v3 doc drift | P2 | clarification | Yes | Update CLAUDE.md/memory to name `/research-v3` canonical; v2 route is an orphaned duplicate. |

---

## I1 — DataTable duplicate React key crash (P2, bug, quick win)

**Observed:** On `/research-v3`, the Competitor Landscape section logged the React console error "Encountered two children with the same key, `https://www.airtable.com/guides/start/what-is-airtable`" originating at `data-table.tsx` (the `rows.map` key) from `CompetitorLandscapeRenderer`'s DataTable. Not a hard crash / white-screen — React keeps rendering, but the warning fires and one of the duplicate-keyed rows can be dropped / mis-reconciled.

**Root cause / current state:** `DataTable` (`data-table.tsx:76-78`) renders rows via `rows.map((row,rowIndex) => <tr key={keyFn(row,rowIndex)} ...>)` where `keyFn = rowKey ?? defaultRowKey` (line 41). `defaultRowKey` (lines 27-29) returns `String(rowIndex)` and is always unique, but a caller-supplied `rowKey` is used verbatim with no index guarantee. `CompetitorLandscapeRenderer` passes `rowKey={r => r.url || r.name}` (`competitor-landscape.tsx:715`) on `rows={competitorSet.competitors}` — the RAW artifact array, not the `getUniqueCompetitors`-filtered list. In the schema (`competitor-landscape.ts:16-17`), `competitor.url` and `competitor.name` are both `z.string().min(1)` — free-form LLM output with NO uniqueness constraint. When the model emits the same url for two competitors (here a generic Airtable guides URL reused as a placeholder/source for two rows), `keyFn` returns identical keys and React warns. The error value being a URL confirms the `r.url` branch produced the collision.

**What it needs (direct-fix):** One-line shared fix in `data-table.tsx` line 78 — make the row key always incorporate `rowIndex`, e.g. `key={`${keyFn(row,rowIndex)}-${rowIndex}`}`. `rowIndex` is always unique within the map, so this immunizes EVERY DataTable call site (current and future) in a single edit while preserving the human-meaningful prefix for stable reconciliation. No test changes needed — `data-table.test.tsx` asserts only on rendered content and `rowTestId`, never on the React key (keys aren't DOM-observable). Optional defense-in-depth: narrow the crashing call site to `rowKey={(r, idx) => `${r.url || r.name}-${idx}`}`. Verify with `npm run test:run` on data-table + competitor-landscape tests.

Other collision-prone call sites the shared fix also hardens (each returns a single unconstrained LLM-text field with NO rowIndex today): `competitor-landscape.tsx:715` (`r.url||r.name` — the reported crash); `buyer-icp.tsx:278` (`r.level`); `demand-intent.tsx:234` (`r.keyword`), `:252` (`r.topic`), `:270` (`r.name`); `market-category.tsx:176` (`r.name`); `offer-diagnostic.tsx:225` (`r.channelName`). Composite `${a}-${b}` keys are lower-risk but still collidable — the index suffix covers them too. Already-safe: `positioning-axis-stack.tsx:67`, `demand-intent.tsx:243/261`, `typed-artifact-renderer.tsx:284`, and the `defaultRowKey` path.

**Key files:** `src/components/research-v2/ui-kit/data-table.tsx`, `src/components/research-v2/section-renderers/competitor-landscape.tsx`, `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts`, plus the other renderers above.

**Open questions:** None — ready to ship.

---

## I2 — Competitor ad creatives missing (P1, bug, needs research)

**Observed:** User saw no competitor ad creatives in the Competitor Landscape section.

**Root cause / current state:** Schema, renderer, and a live SearchAPI ad probe all exist and are wired. The ad probe is seeded only from `topCompetitors`, and `competitorAds` is hardcoded empty — so a blank field means zero advertisers were ever probed.

**What it needs (needs-research):** Seed the probe from the model-discovered competitor set instead of the static `topCompetitors` list, then confirm SearchAPI yield with a live run (live run is the only way to confirm creatives actually return — code can't conjure SearchAPI output).

**Key files:** `src/lib/research-v2/corpus-to-research-input.ts`, `src/lib/lab-engine/agents/run-section.ts`.

**Open questions:** Where does the model-discovered competitor set become available relative to the probe-seeding step (is it ready before the ad probe fires)? What is the real SearchAPI creative yield per advertiser on a live run? Is `competitorAds` being hardcoded empty a leftover stub, and does re-seeding it break any downstream consumer?

---

## I3 — Research-v2 DataTable is unreadable (P1, design, needs design)

**Observed:** During live QA the user said: "so bad how our tables are designed... so many tables... readability for some of these tables is very very hard to see." Tables appear cramped, low-contrast, and hard to scan, especially in the table-heavy sections.

**Root cause / current state:** One shared `DataTable` renders all tables — 39 `<DataTable>` instances across 8 section renderers (heaviest: paid-media-plan 11; offer-diagnostic / demand-intent / competitor-landscape / buyer-icp 5 each; voice-of-customer / market-category 3; positioning-synthesis 2). The component is a width-naive `<table>`:
- **No width budget:** wrapper is `w-full overflow-x-auto`; `<table className="w-full border-collapse text-[14px]">`. NO `table-fixed`, NO per-column min/max widths anywhere (grep confirms zero `min-w`/`max-w`/`truncate`/`whitespace-nowrap`/`width:` in the component or any of the 39 column defs). Auto layout + `overflow-x-auto` means wide cells silently push horizontal scroll while narrow ones wrap to many lines.
- **Narrow container:** tables live inside the reader article `mx-auto max-w-[760px] px-6` (`audit-reader-shell.tsx:1243`) ≈ 700px usable, so 4–6 column tables of free text get ~120–180px per column.
- **Low-contrast header:** `font-mono text-[10px] uppercase ... text-muted-foreground/80` — tiny 10px muted header, bottom border only, no background, not sticky.
- **No row separation:** `border-b border-transparent ... hover:bg-muted/40` — no persistent separators, no zebra; rows distinguishable only on hover. Cell gap is only `pr-4`, no left padding.
- **Prose-in-cell offenders:** paid-media `Framework` joins SEVEN sentences via `creativeSummaryLines()`; `Detail`/`Recommendation`/`Definition`/`Messaging`/`Observation`/`Primary text` are all free-text; competitor pricing is 6 columns in 700px; buyer-icp/demand-intent/offer-diagnostic have `Why it matters`/`Hypothesis`/`Quantified evidence`/`Sample query` etc.
- **No responsive fallback:** same wide table on mobile, relying solely on `overflow-x-auto`.

This is a component-design gap (width budgeting, overflow strategy, row separation, responsive transform all absent), not a per-section bug — which is why it shows in all 8 renderers. `SourceLink` already collapses URLs to hostname, so raw URLs are not the main overflow vector.

**What it needs (needs-design):** Redesign centers on the shared DataTable plus a content-fit pass on the heaviest renderers. Directions to validate with design:
1. **Column sizing API:** add optional `width`/`minWidth`/`maxWidth`/`grow` to `DataTableColumn`, applied via `<colgroup>` + `table-fixed`. Mark short cols (Monthly, CPC, Confidence, Verdict) shrink-to-content; let one prose column grow.
2. **Text overflow:** per-column `wrap` (default, with line-clamp ~2–3) vs `truncate` (single line + tooltip) vs `nowrap` for numeric/short.
3. **Readability/contrast:** persistent hairline row separators and/or subtle zebra (`odd:bg-muted/20`); raise header to ~11–12px stronger color (optional header bg); real horizontal padding (`px-3`); sticky header for tall tables.
4. **Narrow-screen fallback:** below ~640px, stacked label/value cards instead of horizontal scroll (`responsive` prop or auto CSS-grid card mode).
5. **Content discipline (renderer side, separable):** demote the worst prose columns — paid-media 7-sentence `Framework` join and the competitor 6-col pricing table → drop columns, move prose to an expandable detail row, or switch to a definition-list/card layout.

Surgical sub-fixes that could ship first without the full redesign: `table-fixed` + a `<colgroup>` with sane widths, persistent row borders/zebra, bump header contrast, clamp the paid-media Framework column. The responsive card fallback and the column-sizing API are the larger design-gated pieces.

**Key files:** `src/components/research-v2/ui-kit/data-table.tsx`, `.../section-renderers/paid-media-plan.tsx`, `competitor-landscape.tsx`, `buyer-icp.tsx`, `demand-intent.tsx`, `offer-diagnostic.tsx`, `.../ui-kit/source.tsx`, `.../primitives/subsection-block.tsx`, `.../audit-reader-shell.tsx`.

**Open questions:** What is the column-sizing/overflow contract we want (declarative per-column or smart defaults)? Which prose columns should leave tables entirely vs. be clamped/expandable? Do we want a true responsive card mode or is horizontal scroll acceptable below 640px? Ship the quick sub-fixes now or hold for the full redesign?

---

## I4 — Corpus search activity invisible (P2, visibility, quick win)

**Observed:** During the Perplexity Sonar corpus stage, there is "literally no UI for what the agent searched." The corpus prefilled the onboarding/brief fields but displayed no search activity, no sources, and no citations.

**Root cause / current state:** Corpus progress UI is `corpus-stream.tsx`, which renders only an `ActivityRail` fed by `mapCorpusUpdatesToSteps` (`corpus-activity.ts`). The rail can show per-step chips (search-query/source strings) but ONLY for updates with `phase==='tool'` (`corpus-activity.ts:83`). The worker corpus runner (`deep-research-program.ts`) never emits a `'tool'`-phase update — only generic `emitRunnerProgress('runner', ...)` / `'analysis'` labels and hardcoded `emitArtifactProgress` markdown deltas. So the chips branch is never populated and the rail shows only abstract phase labels.

Meanwhile the data the user wants IS captured: `extractSonarSources`/`dedupeSources` collect the Perplexity citation title+url list (lines 618-640); the runner returns a numbered `citations[]` array (lines 1276-1280) and persists them into `corpus.sources` via `mergeProviderSourcesIntoCorpus`. On completion `CorpusStream` calls `onComplete` and `page.tsx` (534-548) swaps straight to `OnboardingWizard`, discarding `citations[]` for display. Per-field provenance also exists — `prefillFromCorpus` attaches `sourceUrl`/`confidence`/`reasoning` per field, threaded into the wizard as `initialPrefillMetadata`, and `buildOnboardingReviewMetadata` preserves it — but no `step-*.tsx` component reads `reviewMetadata` or `sourceUrl` (grep returns zero hits). The one component that DOES render a clickable `sourceUrl` + "Why this value?" reasoning, `prefill-summary.tsx`, is wired only to the document-upload/AI-suggest path, NOT the corpus prefill path. Net: queries, sources, and citations are captured and stored but invisible at every corpus-stage surface.

**What it needs (two-part):**
- **(A) Direct-fix, low effort — surface what's already captured:** after the corpus completes, render a collapsed "Researched N sources" list from the existing `citations[]`/`corpus.sources` (reuse `reader-sources.tsx` / `CompletedActivitySummary` patterns), and/or render the per-field `sourceUrl` + "Why this value?" reasoning in the GTM brief review by wiring `reviewMetadata` into the `step-*.tsx` fields (copy/reuse `prefill-summary.tsx`). No worker change required.
- **(B) Needs-design, medium effort — true LIVE "what was searched":** Perplexity sonar (single `generateText` with `Output.object`) does not stream intermediate search queries — sources arrive only at completion. Live per-query streaming would require emitting synthetic `'tool'`-phase events (echoing the search topics the prompt asks for) or capturing/streaming sonar's search metadata if the provider exposes it. This is a product call: show real-but-post-hoc sources vs. fabricate live "searching X" chips. Field-sync caution: any new surfaced field must not break the 6-place field-sync rule.

**Key files:** `corpus-stream.tsx`, `corpus-activity.ts`, `activity-rail.tsx`, `deep-research-program.ts`, `prefill-from-corpus.ts`, `onboarding-review.ts`, `onboarding-wizard.tsx`, `prefill-summary.tsx`, `research-v2/page.tsx`.

**Open questions:** Does the user want (a) a post-corpus "Researched N sources" summary from the already-captured `citations[]` (cheapest, no worker change), (b) per-field source links + reasoning in the GTM brief review (reuse `prefill-summary.tsx`; `reviewMetadata` is already threaded), or (c) true live "searching..." chips during the corpus (needs a worker-side design call, since sonar returns sources only at completion)? Confirm which surface(s) and whether live-vs-post-hoc matters for the UX bar.

---

## I5 — Verification counts unlabeled (P2, clarification, quick win)

**Observed:** During live QA the user saw on the right-hand side "55 warnings" and "87 tick marks" plus the section error, and could not tell what they mean or whether 55 warnings is bad.

**Root cause / current state:** Both numbers come from the top-right `RunStatusBar` in `audit-reader-shell.tsx`, rendered only while the run is non-terminal (1223-1231). It receives `verified`/`flagged` from `verificationRollup` (1022-1032), which sums `verifiedCount` and `unsupportedCount` across the 6 committed positioning sections. `RunStatusBar` (691-741) renders ticks as a green Check glyph + bare number (`verified`) and warnings as an amber AlertTriangle glyph + bare number (`flagged`). There is NO text label "verified"/"unsupported"/"warnings" anywhere on the rail bar — just two icons and two numbers, which is exactly why they read as unclear. The only labeled surface is the per-section `VerificationBadge` ("Verified X / Unsupported Y", line 322), which renders in the main column on a complete section, not in the right rail.

The counts come from `structuralVerifier()` (`structural-verifier.ts:206-245`), which extracts claims via `extractClaims()` — numeric tokens, quotes ≥6 words, URLs, entity names — then marks each "verified" if it substring-matches a tool result/corpus excerpt, else "unsupported" (`no_match`). A typical 6-section audit extracts well over a hundred tokens, so 87 verified + 55 unsupported (~61%) is a normal magnitude, not an error.

**Is 55 unsupported a quality problem? NO under current config.** The evidence gate is default-OFF — `getMaxUnsupportedAllowed()` returns `Infinity` unless `LAB_VERIFIER_MAX_UNSUPPORTED` is set, so `shouldRepairAttempt` never repairs or fails a section on unsupported count; artifacts commit regardless. When armed, the gate counts only unsupported LOAD-BEARING claims (a strict subset), whereas the right-rail `flagged` sums ALL unsupported claims of every kind — so the 55 the user sees is the broad raw tally and overstates even the quantity the gate would ever care about.

**What it needs (needs-design, surgical-leaning):** Minimal fix — add inline text labels and/or a tooltip in `RunStatusBar` (e.g. "87 verified / 55 unverified claims" with a one-line "claims matched verbatim to a fetched source" hover) so the glyphs are self-explanatory; mirror the legend on the per-section `VerificationBadge`. Optional correctness improvement: have `verificationRollup` sum the load-bearing unsupported subset (or relabel as "claims checked" vs "needs a source") so the amber number is actionable. No verifier/runner logic change required — the engine behavior is intentional and gated-off.

**Key files:** `audit-reader-shell.tsx`, `structural-verifier.ts`, `claim-extractor.ts`, `verification/types.ts`, `evidence-support.ts`, `run-section.ts`.

**Open questions:** What wording communicates "advisory, not an error" without alarming users? Should the amber count reflect the raw all-token tally or the load-bearing subset? Should the count be surfaced at all while the gate is off?

---

## I6 — /research-v2 vs /research-v3 canonical confusion (P2, clarification, quick win)

**Observed:** Crash stack showed `ResearchV3Page` rendering `AuditReaderShell` during live QA. The QA-er was on `/research-v3`, but CLAUDE.md states `/research-v2` is "the canonical user-facing surface," creating doubt about which surface to QA and whether this session's 8 commits are visible there.

**Root cause / current state:** Documentation drift, not a code defect. Three surfaces exist:
1. `/research` — server-rendered LIST of completed sessions (not a runner). Both CTAs link to `/research-v3`.
2. `/research-v2` — runs the full 5-state machine; at the sections phase mounts `<AuditReaderShell runId={...}/>` with NO section-routing props.
3. `/research-v3` — its own header comment says it "Mirrors /research-v2/page.tsx state machine exactly"; mounts the SAME shell but passes richer props `activeSectionId` + `onSectionChange`, wiring URL `?section=` deep-linking. Both pages POST to identical backend routes.

Navigation reality: homepage CTA → `/research-v3`; sidebar Compass "Research" → `/research-v3`; the `/research` list page → both buttons → `/research-v3`. Grep across all non-test src for any href/router.push/redirect to `/research-v2`: **ZERO matches** — `/research-v2` is reachable only by typing the URL. So `/research-v3` is the live front-door runner; `/research-v2` is an orphaned near-duplicate.

Session-work visibility: all 8 commits edited SHARED components (`audit-reader-shell.tsx`, `typed-artifact-renderer.tsx`, `primitives/narrative-block.tsx`, `chapter-divider.tsx`, `document-header.tsx`, `ui-kit/*`) plus lab-engine + `next.config.ts`. NOTHING under `src/app/research-v3/` or `src/components/research-v3/` was edited. Because `/research-v3` imports `AuditReaderShell` from `@/components/research-v2/...` and that shell imports the same renderer/reader-sections, every edit IS live on `/research-v3`. The QA-er is on the correct canonical surface.

**What it needs (direct-fix):** Two cheap independent cleanups — (1) update the stale "canonical surface" wording in CLAUDE.md and project memory to name `/research-v3` (doc-only). (2) Optionally delete the now-unreachable `/research-v2` route — but verify first: `src/app/research-v2/__tests__/page-one-pager.test.tsx` still imports it and the shared component dir is literally named `research-v2`, so deletion is a follow-up, not part of this QA pass. The QA crash itself (`ResearchV3Page` rendering `AuditReaderShell`) is a separate runtime issue to triage on its own; this finding only resolves the canonical clarification: QA `/research-v3`, and yes the session work is visible there.

**Key files:** `src/app/research-v3/page.tsx`, `src/app/research-v2/page.tsx`, `src/app/research/page.tsx`, `src/components/shell/app-sidebar.tsx`, `src/app/page.tsx`, `src/components/research-v2/audit-reader-shell.tsx`, `src/components/research-v2/typed-artifact-renderer.tsx`, `src/components/research-v3/reader-sections.ts`.

**Open questions:** Delete the orphaned `/research-v2` route now (with its test) or leave it as a follow-up? Should the shared `research-v2` component directory eventually be renamed to avoid future confusion?

---

## Do-now quick wins (direct-fix, ship immediately)

These need no design decision and no worker change — they can ship in this QA pass:

1. **I1 — DataTable duplicate-key fix.** One-line edit in `data-table.tsx` line 78: suffix the row key with `rowIndex`. Immunizes all 39 call sites. No test changes. Verify with the data-table + competitor-landscape tests.
2. **I6 — Canonical-surface doc fix.** Update CLAUDE.md + project memory to name `/research-v3` as canonical. Doc-only, no code. (Deleting the orphaned `/research-v2` route is a separate follow-up because a test still imports it.)
3. **I4 (Part A) — Surface captured corpus sources.** Render a collapsed "Researched N sources" summary post-corpus from the already-captured `citations[]`/`corpus.sources`, and/or wire `reviewMetadata` per-field source links into the GTM brief review by reusing the existing `prefill-summary.tsx` pattern. No worker change. (Confirm which surface the user wants first — see I4 open question.)
4. **I5 — Label the verification counts.** Add inline text labels + a one-line tooltip legend to `RunStatusBar` so "87 / 55" reads as "verified / unverified claims (matched verbatim to a fetched source)." Surgical; the only open call is copy. (Summing the load-bearing subset is an optional follow-up.)

## Needs research before implementing

Each of these must answer specific questions before any code lands:

1. **I2 — Competitor ads resurrection (P1 bug).** Must answer: at what point in the pipeline does the model-discovered competitor set exist relative to the ad-probe seeding step, and can the probe consume it there? What is the real SearchAPI creative yield per advertiser on a live run? Is `competitorAds = []` a leftover stub, and does re-seeding it break any downstream consumer? — requires a live run to confirm creatives return.
2. **I3 — DataTable redesign (P1 design).** Must answer: what column-sizing/overflow contract do we want (declarative per-column `width`/`min`/`max`/`grow` + truncate/clamp/wrap, or smart defaults)? Which prose columns leave tables entirely vs. get clamped/expandable? Do we want a true responsive card mode below 640px or is horizontal scroll acceptable? Ship the quick sub-fixes (`table-fixed` + `<colgroup>`, row borders/zebra, header contrast, clamp paid-media Framework) now or hold for the full redesign? — design-gated.
3. **I4 (Part B) — Live corpus-search UI (P2 visibility).** Must answer: does the UX bar require true live "searching X" chips during the 30–90s corpus, or is a post-hoc "Researched N sources" summary sufficient? If live, do we emit synthetic `'tool'`-phase events (echoing prompt search topics) or does Perplexity sonar expose streamable search metadata? — product/design call, since sonar returns sources only at completion.
