# Research-v2 Reader UI + Streaming Audit

> Date: 2026-05-27
> Branch: `feat/v2-lab-section-wire`
> Scope: `src/app/research-v2/**`, `src/components/research-v2/**`, audit-state polling path, DESIGN.md
> Mode: READ-ONLY. No fixes applied. Evidence-first.
> Bar: best-in-class streaming-AI-UI (Claude artifacts / Cursor / v0).

---

## How the reader actually works (verified, not assumed)

1. `page.tsx` runs a 5-state machine; the `sections` state renders `<AuditReaderShell runId>` (page.tsx:550-552).
2. `AuditReaderShell` gets ALL state from `useAuditState(runId)` — a **poll loop** hitting `GET /api/research-v2/audit-state` every **2500ms** (`use-audit-state.ts:15`, `:95`). There is no SSE, no WebSocket, no Supabase realtime channel on this surface. (Comment at shell top is explicit: "Poll-based, commit-on-complete … no token streaming here", audit-reader-shell.tsx:6-9.)
3. The worker DOES stream: `streamObject(...).partialObjectStream` is drained in `research-worker/src/runners/positioning-subagent-runner.ts` (e.g. :360, :669, :1007). But the partial object is used **only to emit a text progress event** (`[runner] streamObject: subsection N/M partial`). The artifact body is written to `research_artifact_sections.data` **once**, after `await result.object` (runner.ts:374/683/1022) — i.e. on commit.
4. `audit-state/route.ts` exposes `sectionsByZone[zone]` **only when `status === 'complete'`** (route.ts:396). So the reader physically cannot receive a partial artifact body. It receives (a) a text activity feed via `eventsByZone` while running, then (b) the entire typed card at once when the section commits.

That single fact drives the top findings: the project ships a live **text** trace (good) but the structured artifact still **pops in all-at-once**, and one whole evidence block is dropped on the floor.

---

## Findings

### H1 — Competitor renderer silently drops the richest fetched evidence (`adEvidence`)
**Bar:** #3 (render ALL evidence-bearing fields) + the explicit easy-path tell.
**Evidence:**
- Worker/lab schema CAN hold it: `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:225-243` defines `adEvidence` → `advertiserGroups[]` each with `rawCounts`, `displayableCounts`, `displayableTotal`, `returnedCreativeCount`, `creatives[]` (headline/body/imageUrl/videoUrl/landingUrl/creativeUrl/detailsUrl/format/isActive), `libraryLinks` (google/meta/linkedin), `rawSourceSamples[]`, `dataGaps[]`, `sourceErrors[]`, `observedAt`. The body schema requires it (`competitorLandscapeBodySchema` includes `adEvidence`, :241; validators walk every creative URL, :437-551).
- The renderer destructures the body at `src/components/research-v2/section-renderers/competitor-landscape.tsx:313-321` and pulls only `competitorSet, positioningTaxonomy, pricingReality, shareOfVoice, publicWeaknesses, narrativeArcs, adPresence`. **`adEvidence` is never destructured and never rendered.** Confirmed by `grep` — zero references to `adEvidence`/`advertiserGroups`/`creatives`/`libraryLinks`/`rawCounts` in `src/components/research-v2/**` or `src/app/**`.
- The renderer types against `src/lib/managed-agents/schemas/competitor-landscape.ts`, whose `CompetitorLandscapeArtifact` type **has no `adEvidence` field at all** (:118-137 — only `adPresence`). So the field is invisible to TypeScript; the drop is silent.
- Runtime: the picker (`types/positioning-artifact.ts:140-148` `normalizePickedArtifact`) spreads the entire body via `dropEnvelopeOnlyKeys(body)`, so `adEvidence` IS present on the live artifact object — the renderer just never reads it.
- A fully-built component that renders exactly this evidence already exists: `src/components/research/competitor-ad-evidence.tsx` (creatives grid, image/video previews, Meta/LinkedIn/Google library links). It is wired into the OLD `card-renderer.tsx` (:159) and `workspace/cards/competitor-card.tsx` (:308) — but NOT the new reader. The capability exists; the new reader just renders the prose-only `adPresence` summary (competitor-landscape.tsx:541-549) instead of the real fetched creatives.
**User-facing impact:** The single most expensive, hardest-to-fetch artifact in the whole product (real competitor ad creatives + Meta/Google/LinkedIn library deep-links + raw vs displayable spend counts) is invisible to the operator. They get a one-paragraph "ad presence" sentence where they should get a creatives wall with source-of-truth library links. For a media-buyer tool this is the headline feature, gone.
**Severity:** H. **Fix effort:** M (a typed sub-block + reusing the existing `CompetitorAdEvidence` component; main work is reconciling the two competitor schemas so the type carries `adEvidence`).
**One-line fix:** Add `adEvidence` to the managed-agents `CompetitorLandscapeArtifact` type, then render an `8 · Ad Evidence` `SubsectionBlock` that maps `adEvidence.advertiserGroups` into the existing `competitor-ad-evidence.tsx` (creatives + libraryLinks + rawCounts + dataGaps).

---

### H2 — No progressive streaming of structured content; cards pop in all-at-once on commit
**Bar:** #1 (PROGRESSIVE field-by-field / partial-object streaming).
**Evidence:**
- Worker has `result.partialObjectStream` in hand (positioning-subagent-runner.ts:360 etc.) but writes the body only after `await result.object` and only the committed row carries `data`.
- `audit-state/route.ts:396` gates `sectionsByZone` on `status === 'complete'`; partials are never persisted to `research_artifact_sections.data`.
- Shell renders the typed body only in the `activeStatus === 'complete'` branch (audit-reader-shell.tsx:881-910); while running it shows skeleton bars + text feed (`LiveActivity`, :336-394). There is no "partial typed card filling in" state.
**User-facing impact:** vs Claude artifacts / v0 where structured output paints field-by-field, here the operator stares at 4 grey skeleton bars + a text log for the full section duration (tens of seconds to minutes), then the entire 5-7 subsection card appears in one frame. Feels like a batch job, not a live agent. Directly contradicts the project's "stream visible progress, silent gaps unacceptable" requirement at the *content* level (it's satisfied only at the *log* level).
**Severity:** H. **Fix effort:** L (needs worker to persist partial body snapshots + route to surface them + a partial-render mode). This is architectural, not a tweak.
**One-line fix:** Persist throttled `partialObjectStream` snapshots to a `partial_data` column (or events payload), surface them from audit-state while non-terminal, and render available subsections incrementally instead of gating the whole card on `complete`.

---

### H3 — Live activity feed depends entirely on poll cadence; minimum 2.5s granularity + can miss fast events
**Bar:** #2 (LIVE tool/step progress, no silent gaps).
**Evidence:**
- Feed is built from `eventsByZone` which is refreshed only on the 2500ms poll (`use-audit-state.ts:15`). The route caps events at **60 total across all zones** and **12 per zone** (audit-state/route.ts:322, :438).
- With 6 sections running (two waves of 3 per CLAUDE.md), 60 events ÷ 6 zones ≈ 10 events/zone budget for the whole run; a burst of tool calls in one zone can evict earlier events before the UI ever polls them. The feed is newest-60-wins, so a fast-moving section's early steps silently never render.
**User-facing impact:** "searching… reading X… N sources" trace is coarse (2.5s steps) and lossy under load — the operator can see the counts jump (`3 tools`) without ever seeing the intermediate "Using searchAds" line. Acceptable, not best-in-class; Cursor/Claude stream every step sub-second.
**Severity:** H (it's the ONLY progress signal, and it's lossy). **Fix effort:** M.
**One-line fix:** Raise/scope the event cap per-zone for the active section and/or move the activity feed to an SSE endpoint so steps arrive as emitted rather than on a 2.5s sampling grid.

---

### M1 — Two diverging competitor-landscape schemas; renderer typed against the one missing fields
**Bar:** #3 (root cause of H1) + maintainability.
**Evidence:** `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts` (has `adEvidence`, strict, URL-validated) vs `src/lib/managed-agents/schemas/competitor-landscape.ts` (no `adEvidence`, header comment says it "mirrors the worker schema" — it doesn't). `typed-artifact-renderer.tsx:32` imports the managed-agents type and casts (`artifact as unknown as CompetitorLandscapeArtifact`, :485), so the cast launders away the missing field with zero type error.
**User-facing impact:** Indirect — this is why H1 is silent and why future evidence fields will keep getting dropped without a compile error.
**Severity:** M. **Fix effort:** M.
**One-line fix:** Make the managed-agents schema a re-export of (or structurally equal to) the lab-engine body schema, or generate one from the other, so the renderer's type carries every field the worker can produce.

---

### M2 — Reader is dual-pane (320px right rail) — DESIGN.md says 3-panel is the shell and standalone views are single-column ≤1080px
**Bar:** #5 (design-system consistency) + the project memory "lean one-pager, not dashboard" (2026-05-20).
**Evidence:** `audit-reader-shell.tsx:940` renders a fixed `w-[320px]` right "Sections" rail with confidence/wave chips and an avg-confidence footer (:993-1003). Reading column is capped at `max-w-[760px]` (:865). DESIGN.md:106 "Max content width 1080px for standalone views"; layout guidance + the locked "Audit Reader = readable document, not command center; demote dashboard chrome" direction. A persistent progress dashboard rail is exactly the command-center chrome that direction demotes — defensible while running, but it stays after everything is complete.
**User-facing impact:** Finished audit reads as a dashboard with a perpetual sidebar of confidence scores rather than a clean document. Mild dissonance with the locked one-pager direction; not broken.
**Severity:** M. **Fix effort:** M.
**One-line fix:** Collapse the right rail to a slim progress strip while running and hide/auto-collapse it once all six sections are terminal so the completed read is single-column.

---

### M3 — Hard-coded color literals bypass the design-token system (theme + DESIGN.md drift)
**Bar:** #5 (design-system consistency).
**Evidence:** Status colors are written as raw Tailwind palette literals throughout instead of the DESIGN.md semantic tokens (`--green/#22c55e`, `--amber`, `--red`):
- `audit-reader-shell.tsx`: `bg-rose-500/12 text-rose-600` (:169), `bg-emerald-500` / `bg-amber-500` / `bg-rose-500` activity tones (:290-292), `border-rose-500/30 bg-rose-500/5` (:416).
- Every renderer repeats `bg-rose-500/10 text-rose-600`, `bg-amber-500/10`, `bg-emerald-500/10` (offer-diagnostic.tsx:51-55, :76-81, :110-114; voice-of-customer.tsx:28-32, :50-55).
- Meanwhile `competitor-landscape.tsx` mixes a DIFFERENT system — `var(--text-primary)`, `var(--accent-blue)`, `var(--border-subtle)` (:141, :220, :203) — tokens that are NOT in DESIGN.md (which defines `--text-1..4`, `--accent`, `--border`). So one renderer uses `--text-secondary`, the shell uses `text-muted-foreground`, others use `text-rose-600`. Three different color vocabularies in one feature.
**User-facing impact:** Light/dark theming is inconsistent (literal `-600` text colors don't track the OKLCH token swap DESIGN.md specifies); `var(--accent-blue)`/`var(--text-primary)` likely resolve to nothing (undefined CSS vars → inherit) since DESIGN.md never defines them — competitor tabs/sources may render with the wrong/transparent color in one theme.
**Severity:** M (potential broken color in competitor renderer; otherwise drift). **Fix effort:** M (mechanical token sweep).
**One-line fix:** Replace `rose/amber/emerald-*` and `--text-primary/--accent-blue/--border-subtle` with the shadcn semantic tokens (`text-destructive`, `text-muted-foreground`, `border-border`, `text-foreground`) the rest of the shell already uses.

---

### M4 — Generic fallback renderer reflects raw schema keys to the user (auto-humanized labels)
**Bar:** #3 / #4 (honest, readable evidence) — affects Paid Media Plan today and any zone whose typed renderer is absent.
**Evidence:** `typed-artifact-renderer.tsx` routes the 6 positioning zones to typed renderers but sends `positioningPaidMediaPlan` (and any unmatched zone) to `GenericTypedArtifactRenderer` (:492-499, :502-508). That renderer reflects over object keys and prints `humanizeKey(key)` as the heading (:84-94, :439-464) — so users see machine-derived labels like "Raw Counts", "Displayable Total", "Source Errors" and nested `<dl>` dumps (FieldList, :176-201) up to depth 4 (:305). Numbers/booleans get coerced (`true`→"Yes", :160).
**User-facing impact:** Paid Media Plan reads as a reflected JSON tree with title-cased field names, not a designed artifact — the opposite of the typed sections next to it. Inconsistent quality within the same reader.
**Severity:** M. **Fix effort:** M (write a typed Paid Media Plan renderer).
**One-line fix:** Author a `PaidMediaPlanRenderer` and route it in the `switch` like the other six.

---

### M5 — Auto-kickoff fan-out can double-fire (race between page.tsx and the shell)
**Bar:** correctness / cost (paid API fan-out).
**Evidence:** `page.tsx` fires `POST /api/research-v2/orchestrate` on onboarding complete (page.tsx:431-438). Independently, `AuditReaderShell` ALSO fires `POST /api/research-v2/orchestrate` when it mounts and sees no parent yet (audit-reader-shell.tsx:603-632), guarded only by a per-mount `kickoffFired` ref. On a fresh run the shell mounts before the parent row exists, so both can dispatch. The shell's guard resets to `false` on any non-ok response (:617), inviting a re-fire on the next render where state still shows no parent.
**User-facing impact:** Possible duplicate orchestrator runs → duplicate worker section dispatches → wasted Anthropic/SearchAPI spend (~$1.50-2/pull per project memory) and confusing double telemetry. Idempotency presumably lives server-side, but the client races by design.
**Severity:** M. **Fix effort:** S.
**One-line fix:** Gate the shell's auto-kickoff behind "no parent AND no in-flight kickoff for this runId" persisted across renders (e.g. a module-level Set keyed by runId), and don't reset the guard on transient non-ok.

---

### M6 — Copy button copies only verdict + summary, silently omits the body
**Bar:** product polish (it's a primary top-bar action).
**Evidence:** `copyActive` builds `title\n\nverdict\n\nstatusSummary` only (audit-reader-shell.tsx:803-813). None of the actual evidence (competitors, quotes, pricing, ad data) is copied. Failure is also fully swallowed (`catch {}`, :810-812) — no toast, button just doesn't confirm.
**User-facing impact:** Operator clicks Copy expecting the section, pastes three sentences. Erodes trust in the tool's output handling.
**Severity:** M. **Fix effort:** S.
**One-line fix:** Serialize the full typed artifact (markdown of each subsection) into the clipboard payload; surface clipboard failures.

---

### L1 — Live default-selection yanks the reader to a different section mid-read
**Bar:** UX correctness.
**Evidence:** `computedDefault` = first running, else first complete (audit-reader-shell.tsx:680-688); `active = activeSectionId ?? userActive ?? computedDefault` (:690). Until the user clicks a section (`userActive` stays null), `computedDefault` recomputes every 2.5s poll. A `useEffect` resets scroll to top whenever `active` changes (:755-757). So as waves progress, the auto-selected section jumps and the scroll snaps to top under the reader.
**User-facing impact:** If the operator is reading the first completed section without clicking it, a newly-running section can steal focus and scroll-jump them. Jarring.
**Severity:** L. **Fix effort:** S.
**One-line fix:** Once a section is complete, stop auto-advancing the default (pin to first complete), or set `userActive` on first stable selection.

---

### L2 — No global error/empty state when the run never produces a parent
**Bar:** #4 (honest empty/error states).
**Evidence:** If `audit-state` keeps returning `parent_audit_run_id: null` (orchestrate never landed / failed), the shell shows six `queued`/`locked` rows forever (audit-reader-shell.tsx:933-934 `QueuedPlaceholder`, statusOf default `queued` :664). `useAuditState` stops polling only once workers exist and are terminal (:126-132) — with zero workers it polls forever. There's no "we couldn't start this audit" terminal state at the shell level (the `error` state machine branch in page.tsx only covers corpus/onboarding, not the sections phase).
**User-facing impact:** A failed kickoff looks identical to "queued, starting soon" indefinitely. Operator waits on a dead run with no error surfaced.
**Severity:** L (depends on kickoff reliability). **Fix effort:** M.
**One-line fix:** After N polls with `parent_audit_run_id === null`, surface a "couldn't start audit — retry" panel.

---

### L3 — Generic renderer `<ReactMarkdown>` per subsection + duplicate Sources block
**Bar:** #6 (perf) + consistency.
**Evidence:** `GenericTypedArtifactRenderer` mounts a `ReactMarkdown` for every subsection's prose (typed-artifact-renderer.tsx:446-448) and renders its OWN `ArtifactSources` collapsible (:467) — but the shell ALSO renders `SourcesList` (audit-reader-shell.tsx:909). For Paid Media Plan (which uses the generic path inside `PaidMediaPlanTerminalPanel`, :536-544 with `showSectionTitle={false}`) the sources can render twice (once in the body, once in the shell footer).
**User-facing impact:** Duplicate "Sources (N)" disclosures on the Paid Media Plan section; minor bundle cost from `react-markdown` on a surface that mostly renders structured data.
**Severity:** L. **Fix effort:** S.
**One-line fix:** Suppress `ArtifactSources` inside the generic renderer when the shell owns sources (it already passes `showSectionTitle={false}` — add `showSources={false}`).

---

### L4 — `prefers-reduced-motion` honored globally, but infinite spinners aren't gated
**Bar:** #6 (a11y).
**Evidence:** `globals.css:1488` has a `@media (prefers-reduced-motion: reduce)` block (good). But the reader's perpetual `animate-spin` loaders (audit-reader-shell.tsx:163, :354; status icon) and `animate-pulse` skeletons (:386) are the kind of motion that block typically can't neutralize unless it explicitly targets them. Worth confirming the global rule disables `animate-spin`/`animate-pulse` (Tailwind's defaults aren't auto-covered by a generic `* { transition: none }`).
**User-facing impact:** Reduced-motion users may still get spinning/pulsing during long runs. Minor.
**Severity:** L. **Fix effort:** S.
**One-line fix:** Ensure the global reduced-motion rule sets `animation: none` on `.animate-spin`/`.animate-pulse`, or swap to a static "Working…" indicator under `motion-reduce:`.

---

## What is genuinely good (so the report isn't all red)

- **Live text trace exists and is well-modeled.** `section-activity.ts` maps worker events (tool-started/finished, validation-failed, repair-started, sub-section-committed) into toned, deduped feed items with running counts (:157-289). This satisfies "no silent gaps" at the log level — better than most.
- **Honest empty states inside renderers.** VoC shows "No verbatim pain quotes captured" / "No objections captured" (voice-of-customer.tsx:145, :165); competitor shows "No verbatim weaknesses captured" (:525); `DataTable` has an `emptyLabel` (data-table.tsx:63-71). Gaps are surfaced, not hidden — Bar #4 mostly passes (the exception is H1, where a whole block is hidden by omission, and `adEvidence.dataGaps`/`sourceErrors` are never shown).
- **Polling self-terminates.** `useAuditState` stops once all workers are terminal (:126-132) so an idle completed page doesn't burn API calls — except the zero-worker case (L2).
- **Keys + a11y basics are mostly right.** Lists use stable composite keys (not bare index) across renderers; `DataTable` uses `scope="col"`, the competitor tabs use proper `role="tab"`/`aria-selected`/`aria-controls` (competitor-landscape.tsx:201-234); BarBreakdown segments carry `aria-label` (bar-breakdown.tsx:70). No obvious unkeyed-list React warnings.

---

## Easy-path-instead-of-hard-path tells (explicitly flagged)

| # | Easy path taken | Hard/correct path | Finding |
|---|---|---|---|
| 1 | Render the prose `adPresence` summary | Render the fetched `adEvidence` creatives + library links + raw counts (component already exists) | **H1** |
| 2 | Poll `audit-state` every 2.5s, commit-on-complete | Stream partial structured object as it fills | **H2** |
| 3 | Show structured card only at `complete` | Persist + surface partial body during the run | **H2** |
| 4 | Reflect raw schema keys via generic renderer for Paid Media Plan | Author a typed renderer | **M4** |
| 5 | Copy 3 summary lines | Serialize the full artifact | **M6** |
| 6 | Swallow clipboard + kickoff errors (`catch {}`) | Surface failure to the operator | **M5, M6, L2** |

No fabricated/placeholder DATA states were found (the renderers don't invent evidence) — the failure mode here is *omission* (H1) and *non-progressive reveal* (H2), not fabrication.

---

## Top 10, severity-ordered

1. **H1** — Competitor renderer drops `adEvidence` (creatives/libraryLinks/rawCounts) entirely; renders prose-only `adPresence`. The headline media-buyer artifact is invisible. `competitor-landscape.tsx:313-321`.
2. **H2** — No progressive structured streaming; the whole typed card pops in on commit. Worker has `partialObjectStream` but only the final object is persisted. `audit-state/route.ts:396`, runner `:374`.
3. **H3** — Live trace is the only progress signal and it's lossy: 2.5s poll grid + 60-event/12-per-zone cap can evict a fast section's steps before they ever render. `use-audit-state.ts:15`, `audit-state/route.ts:438`.
4. **M1** — Two diverging competitor schemas; renderer typed against the one missing `adEvidence`, laundered by `as unknown as` cast → silent drop (root cause of H1). `typed-artifact-renderer.tsx:485`.
5. **M2** — Persistent 320px dashboard rail conflicts with the locked "lean one-pager" direction and DESIGN.md single-column standalone view. `audit-reader-shell.tsx:940`.
6. **M3** — Three different color vocabularies; hard-coded `rose/amber/emerald` literals + undefined `--text-primary`/`--accent-blue` vars bypass DESIGN.md tokens (potential broken color in competitor renderer). `competitor-landscape.tsx:141/203/220`.
7. **M4** — Paid Media Plan falls to the generic reflection renderer → title-cased raw keys + nested `<dl>` dumps, inconsistent with the 6 typed sections. `typed-artifact-renderer.tsx:492-499`.
8. **M5** — Auto-kickoff fan-out races between `page.tsx:431` and `audit-reader-shell.tsx:603` → possible duplicate orchestrator runs / wasted paid API spend.
9. **M6** — Copy button copies only verdict+summary (omits all evidence) and swallows failures. `audit-reader-shell.tsx:803-813`.
10. **L1** — Live default-selection steals focus + scroll-jumps the operator to a newly-running section mid-read. `audit-reader-shell.tsx:680-688/755-757`.

(L2 dead-run-no-error, L3 duplicate sources on Paid Media Plan, L4 spinner reduced-motion are lower-severity tail.)
