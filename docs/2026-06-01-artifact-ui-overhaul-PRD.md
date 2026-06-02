# PRD — research-v2 Audit Reader UI/UX Overhaul

> **Status:** ready-for-agent (Cursor multi-agent execution)
> **Branch / worktree base:** `feat/v2-artifact-ui-overhaul` off `feat/v2-lab-section-wire` @ `738558f8` (lab-wire = system of record).
> **References (read before executing):**
> - Research + slop inventory: `docs/2026-06-01-artifact-ui-overhaul-research.md`
> - **Approved visual + code reference (the winning prototype, Variant A):** `src/app/research-v2/proto-reader/` — `kit.tsx` (de-slopped components), `chrome.tsx` (TopBar/RunStatus/SectionRail/ReadingView), `variant-document.tsx` (the A layout). **Fold these patterns in; do NOT import the prototype — it depends on throwaway `./fixtures`.**
> **How Cursor should use this:** execute the Work Packages in dependency order (§7). WP-0 is the root and must land + pass tests first. WP-1/WP-2/WP-3 run in parallel. WP-4 (the only package that edits `audit-reader-shell.tsx`) runs after WP-2/WP-3 land. WP-5 is cleanup. Every WP lists exact files, deep modules, and greppable acceptance criteria.

---

## 1. Problem Statement

The `/research-v2` Audit Reader — the surface where the six positioning research sections fan out, stream their progress, and render as a typed document — looks like AI slop. It was assembled from prototypes and never unified. Operators see: over-rounded grey filled cards everywhere, three different "agent is working" UIs (two of which use 🔍🧠 **emoji icons**), an editorial serif title that reads "huge and italic" (wrong for an AI app), a half-pixel type ladder with no scale, broken status color (the *success* state is the only colorless one), washed-out muted body text, the section nav that **vanishes when the run finishes**, duplicated helpers copied 5–12×, and card-grids where tables belong. It does not read like the clean Codex/Claude-grade AI app it should.

## 2. Solution

Overhaul the Audit Reader into one clean, calm, readable AI-app surface, built on components the repo **already vendors** (Vercel AI Elements + shadcn — **zero new installs**), restyled to a disciplined design system. The information architecture, theme, streaming behaviour, and typography were prototyped and **approved live** (Variant A). This PRD folds the approved prototype into the production shell, primitives, renderers, streaming, and sources — and deletes the slop and the dead code uncovered along the way.

## 3. Locked decisions (do not relitigate)

1. **IA = Variant A "Document":** a **persistent, labeled** left section rail (`w-[208px]`, status icon + section name + status subline; **single** count; renders before, during, AND after the run — fixes the "vanishes when terminal" bug) + a single centered reading column (`max-w-[760px]`, one section at a time). No right panel.
2. **Light reading column** (shadcn semantic tokens, "OpenAI dev platform" style). **Not** the DESIGN.md dark theme. User override, locked.
3. **Collapse-on-done streaming:** while running, a quiet `Researching…` rail (vendored `ChainOfThoughtStep` timeline + `Shimmer` label, one Lucide phase-icon map). On commit it collapses to one line `Researched N sources · M tools · T` (re-expandable), never cluttering the finished read.
4. **Typography = Geist sans** for titles (`font-sans`, semibold, 24–26px, `tracking-[-0.02em]`). **Drop Instrument Serif / `font-display` entirely.** Body = Geist 15px/1.6 **foreground**. Labels = Geist Mono (`font-mono`) 11px uppercase `0.06em`. (`font-sans`/`font-mono` already resolve to Geist/Geist Mono — `layout.tsx:14,29`; no font wiring needed.)
5. **Tight, consistent spacing:** column `py-10`, body-block gaps ~28px (`space-y-7`), no uneven gaps. Zero slop.
6. **DESIGN principles on the light surface:** named type scale (no arbitrary `text-[Npx]` half-pixel sizes), 2px-left-accent callouts with **NO** bg fill (kill `rounded-xl/lg` grey card fills), radius ≤6px (`rounded-md`), ONE accent (`text-primary`), **semantic status color only** (emerald=complete/verified, amber=flagged, red=error, blue=active, muted=queued/locked), tables over cards for ranked data, `tabular-nums`, **Lucide icons only — never emoji**, minimal motion (one shimmer + collapsible slide, reduced-motion safe), body text in foreground.
7. **Zero new installs.** Already vendored at `src/components/ai-elements/`: chain-of-thought, task, artifact, inline-citation, queue, sources, shimmer, reasoning, tool, conversation — plus `ui/*` (badge, collapsible, hover-card, scroll-area, separator, skeleton, tabs, tooltip, alert).

## 4. User Stories

1. As an operator, I want the reading column to use a clean geometric sans (Geist) for titles, so the audit reads like a modern AI app, not an editorial magazine.
2. As an operator, I want body text in full foreground contrast, so I can actually read the research without straining against muted grey.
3. As an operator, I want one consistent, tight vertical rhythm, so the document feels deliberate, not assembled.
4. As an operator, I want the verdict to stand out as a 2px-accent callout (not another grey card), so the single most important line is obvious at a glance.
5. As an operator, I want ranked/comparative data (competitors, keywords, personas, spend) in clean borderless tables, so I can scan it, not hunt through card grids.
6. As an operator, I want verbatim customer quotes as restrained left-accent blocks, so the emotional payload reads as a quote, not a generic card.
7. As an operator, I want one calm streaming "Researching…" rail with a Lucide phase icon, so a running section feels alive without flashing emoji or three competing spinners.
8. As an operator, I want the activity to collapse to a one-line "Researched N sources · M tools · T" summary when a section commits, so the finished document is clean but I can re-expand the trace if I want.
9. As an operator, I want the corpus-build screen and the per-section running state to look like the **same** component, so the product feels like one app, not stitched screens.
10. As an operator, I never want to see emoji (🔍🧠💭📄) or internal QA jargon ("repairs", "unsupported claims") in the activity feed, so the tool reads as trustworthy and professional.
11. As an operator, I want status color to mean one thing everywhere (emerald=done/verified, amber=flagged, red=error, blue=active), so I can read section state at a glance.
12. As an operator, I want the left section rail to stay visible and labeled before, during, AND after the run, so I can navigate the finished audit without the nav disappearing.
13. As an operator, I want one count of completed sections, not a duplicated counter, so the rail is quiet.
14. As an operator, I want Copy/Rerun on each section (not in the global top bar), so the action applies to what I'm reading.
15. As an operator, I want one numbered (01/02) collapsible sources footer per section with "why it matters" sublines, so citations are consistent and useful.
16. As an operator, I want inline `[n]` citations in the prose that hover-preview their source, so claims are traceable to evidence.
17. As an operator, I want queued / error / locked states as quiet left-accent lines (not dashed grey boxes), so non-committed sections don't shout.
18. As an operator, I want a failed section's error state and its rail icon to use the same red/glyph, so state never visually contradicts itself.
19. As an operator, I want the Paid-Media capstone's "locked until 6/6" state to read like a calm line, not a nested grey card.
20. As an operator on a slow machine, I want all motion to respect `prefers-reduced-motion`, so the surface is calm and accessible.
21. As an operator on mobile, I want the section switcher and reading column to stay legible and consistent with desktop.
22. As a developer, I want one `DataTable`, one `Eyebrow`, one `Callout`, one `SourceLink`, one `Badge`, one `hostname()`, and one status/phase map — so a single styling change propagates everywhere and renderers stop drifting.
23. As a developer, I want the dead `buyer-icp/` directory, the dead `thinking-block.tsx`, the dead `sources-panel.tsx`, and the dead `ai/sources.tsx` removed, so the codebase stops carrying duplicate slop.
24. As a developer, I want the generic fallback renderer rebuilt on the shared primitives (not deleted — it backs the streaming draft view), so no code path can ever render slop.
25. As a developer, I want every existing `data-testid`, ARIA name, and exact-string test contract preserved (with exactly one documented exception), so the overhaul is provably behaviour-preserving.
26. As a developer, I want the work split so only one package edits `audit-reader-shell.tsx`, so multiple Cursor agents can run in parallel without merge conflicts.
27. As a developer, I want pure deep modules (`hostname`, status maps, citation parser, activity adapters) unit-tested, so the high-leverage logic is regression-proof.
28. As a release owner, I want `tsc`, `lint`, `test:run`, and `build` all green and the prototype + temp middleware cleaned up, so the overhaul is shippable.

## 5. Implementation Decisions

### 5.1 Module map (the canonical homes — resolves the two specs' naming)

- **`src/components/research-v2/ui-kit/`** — NEW. The shared de-slopped leaf primitives and single-source maps (the dependency root, WP-0). Owns: `Eyebrow`, `SectionTitle`, `BodyProse`, `Callout`, `VerdictCallout`, `QuoteCallout`, `StatusPill`/`MonoBadge` (one pill over `ui/badge`), `SourceLink` + `hostname()`, `Cite`, borderless `DataTable<T>`, `InlineStats`, `STATUS_META` + `PHASE_ICON` + `StatusIcon`, `VerificationBadge` (string-preserving), `SectionActions`, `QueuedState`/`LockedState`/`ErrorStateBlock`. Typed against **real** domain types (`ReaderSectionStatus`, `ProductPhase`, `PositioningArtifactSource`) — never the prototype `fixtures.ts` types. Zero `proto-reader` imports.
- **`src/components/research-v2/activity-rail.tsx`** + **`src/lib/research-v2/corpus-activity.ts`** — NEW (WP-2). The single `ActivityRail` + `CompletedActivitySummary` + the corpus adapter. One phase vocabulary, view-model layer.
- **`src/components/research-v2/reader-sources.tsx`** — NEW (WP-3). `SourcesFooter`, `Cite`, `toReaderSources`, `renderProseWithCitations`. (Coordinate `Cite` ownership with ui-kit: put the canonical `Cite` in ui-kit, re-export here, to avoid two copies.)
- **`src/components/research-v2/primitives/`** — KEEP the section composites (`bar-breakdown`, `positioning-axis-stack`, `milestone-timeline`, `narrative-block`, `subsection-block`); de-slop them in place and make them **consume ui-kit**. The duplicated leaf primitives (`quote-callout`, `data-table`, `inline-stats`) are superseded by ui-kit; migrate consumers then delete the leaf files + barrel entries (WP-1, sequenced last to avoid dangling barrel imports per the repo's learned kill-list pattern).
- **`audit-reader-shell.tsx`** — edited **only** in WP-4. Keeps 100% of its data plumbing; swaps presentation + wires in the new modules.

> **Reconciliation note:** the design-kit spec proposes `ui-kit/`; the renderers spec proposed adding to `primitives/`. **`ui-kit/` wins** as the home for the shared leaf primitives + maps; renderers import from `@/components/research-v2/ui-kit`. The shell spec's "create `audit-reader-kit.tsx`" is **superseded** — the shell imports `ui-kit/` (no second kit file).

### 5.2 Status & phase single source

- `STATUS_META: Record<ReaderSectionStatus, {icon, cls, label, spin?}>` keyed off the **real** union `running|complete|error|aborted|ready|locked|queued` (read it from `audit-reader-shell.tsx`). Semantic palette: complete→emerald-600, error/aborted→red-600, flagged→amber-600, running→primary, queued/locked/ready→muted (ready keeps its `ArrowUpRight` glyph to preserve current behaviour). One `StatusIcon` replaces the 6-branch `SectionStatusIcon`.
- `PHASE_ICON: Record<ProductPhase, LucideIcon>` over **all 7** `ProductPhase` values incl. `done` (import `ProductPhase` from `@/lib/research-v2/section-activity`). Lucide set: `preparing:CircleDot, searching:Search, drafting:PencilLine, checking:ShieldCheck, refining:SlidersHorizontal, committing:CheckCircle2, done:CheckCircle2`. **No emoji, no Sparkles.**
- `active` tone = `text-primary`; `success`/committed = `text-emerald-600` — these must NOT collapse to the same class (the current `ACTIVITY_TONE_ICON_CLASS` flattens them).

### 5.3 Behaviour-preserving constraints (test contracts — DO NOT break)

- `VerificationBadge` must keep the exact string **`Verified {n} / Unsupported {m}`** (asserted) — do not switch to an icon-only badge in the shell's committed header.
- Rail must keep `nav aria-label="Sections"`, per-button accessible name `"{shortLabel}: {subline}"`, `data-testid="section-progress-strip"`, the **richer** sublines (`"Complete"`, `"Needs review"`, `"Aborted"`, `"Ready after 6/6"`, `"Locked until 6/6"` — NOT the prototype's shorter `"Ready"`/`"Locked"`), and the `0/8` count substring (denominator = `READER_SECTION_IDS.length` = 8).
- Keep `data-testid`: `run-status-bar`, `mobile-section-switcher`, the 12 `sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-*`, `typed-artifact-renderer-${zoneId}`, and every section-renderer item testid (`adjacent-item`, `persona-card`, `voc-quote`, `objection-item`, `proof-point-item`, `ad-evidence-state-*`, `competitor-focus-panel`, `subsection`, … — full list in WP-1/WP-4 acceptance).
- Keep exact strings: `"Drafting..."`, `"Section needs review"`, `"Section body could not render."`, `"{n} sources"`, `"Section N of 8"`, `"Preparing context"`, `"Reading sources"`, `"Searching source evidence"`.
- **The one intentional test change:** `audit-reader-shell.test.tsx:176` asserts the rail is *absent* when terminal — the locked "rail persists" direction inverts this to `.toBeInTheDocument()`. Change it in the same PR with justification. Every other assertion passes untouched.

### 5.4 Inline citation scope constraint (load-bearing)

There is **no** reliable claim→source join today: `verification.claims[].matchedSourceRef` is `toolResult` (no URL) or `corpusExcerpt` (`sourceUrl` only), and prose has no per-sentence IDs. Inline `[n]` is therefore **renderer-derived from `[n]` markers the model writes into prose**, keyed by 1-based index into the section's `sources[]`. Additive; degrades to nothing when no markers are present. **Do not** spec a verifier→sources join (it needs a schema change — out of scope). `whyItMatters` is optional and often absent (not on the lab-engine `sourceRefSchema`) — render cleanly when missing.

## 6. Work Packages

### WP-0 — Shared UI Kit (`ui-kit/`) · DEPENDENCY ROOT · blocks WP-1/2/3/4

**Goal:** one canonical, testable, light-surface kit; zero per-renderer duplication.
**Depends on:** nothing. **Must land + pass tests before any other WP starts.**

**Create `src/components/research-v2/ui-kit/`** with (port classes verbatim from `proto-reader/kit.tsx`, retype against real domain types):
- `type.tsx` → `Eyebrow` (`font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground`), `SectionTitle` (`font-sans text-[24px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground`; add `as?: 'h1'|'h2'`), `BodyProse` (`max-w-[68ch] text-[15px] leading-[1.6] text-foreground`).
- `callout.tsx` → `Callout`, `VerdictCallout`, `QuoteCallout` (2px left accent, NO fill). `QuoteCallout` new shape `{text, source, meta?, url?, cite?, sources?: PositioningArtifactSource[]}`.
- `source.tsx` → one `hostname(url?: string): string` (try/catch, strips `www.`, `''` on undefined), one `SourceLink({url?})` (mono 11px, hostname + `ExternalLink`, `null` on empty), `SourcesFooter` (numbered 01/02 Collapsible).
- `cite.tsx` → `Cite({source})` — `<sup>[n]</sup>` token + `ui/hover-card` preview (title · mono url · whyItMatters). **Canonical home for `Cite`; WP-3 re-exports it.**
- `status-pill.tsx` → ONE `StatusPill`/`MonoBadge` over `ui/badge` with `tone?: 'neutral'|'complete'|'flagged'|'error'|'active'` (neutral = mono secondary; semantic tones = `text-{color}` / `bg-{color}/10`). Replaces all **13** bespoke `*Pill`.
- `data-table.tsx` → keep the existing generic `DataTableColumn<T>`/`DataTableProps<T>` API (it's already right), apply de-slopped classes: header `font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/80`; row `border-b border-transparent hover:bg-muted/40`; **cell `text-foreground/90`** (fix the muted-cell defect); add `density?: 'comfortable'|'compact'`.
- `inline-stats.tsx` → no-box `InlineStats` (`dl`, value `font-mono text-[22px] font-semibold tabular-nums`, `STAT_TONE` semantic: good→emerald, bad→red, warn→amber, neutral→foreground). Replaces the grid-card version.
- `status.tsx` → `STATUS_META` (real `ReaderSectionStatus`), `PHASE_ICON` (real `ProductPhase`, all 7 keys), `StatusIcon`, `ACTIVITY_TONE_CLASS`. See §5.2.
- `verification-badge.tsx` → `VerificationBadge({verified, flagged})` semantic emerald/amber. (Shell uses the **string-preserving** variant in its committed header — see WP-4; this icon variant is for the rail/run-status.)
- `states.tsx` → `QueuedState`, `LockedState({text})`, `ErrorStateBlock({onRerun?, pending?, status?})`, `SectionActions({onCopy, onRerun, copied, copyError, rerunPending, disabled})` (wired, not the prototype's dead buttons).
- `index.ts` → barrel.

**Deep modules + tests** (`ui-kit/__tests__/`): `hostname()` (www-strip, malformed passthrough, undefined→`''`, subdomain); `STATUS_META`/`PHASE_ICON` exhaustiveness over the real unions; `StatusPill` tone→class; `formatSourceIndex` (`1→'01'`); `DataTable<T>` render contract.

**Acceptance:** barrel exports the full list; `grep` shows zero grey card fills / zero half-pixel `text-[N.5px]` / zero emoji in `ui-kit/`; `STATUS_META` keys === `ReaderSectionStatus`, `PHASE_ICON` keys === `ProductPhase` (incl. `done`); content text uses `text-foreground`; `git diff package.json` empty; `npm run test:run -- src/components/research-v2/ui-kit` exits 0; `tsc` adds 0 new errors; `proto-reader/*` and `primitives/*` unmodified in this WP.

### WP-1 — Section renderers + primitives + generic fallback + delete dead `buyer-icp/` · depends WP-0 · does NOT touch the shell

**Goal:** restyle the typed document body to one disciplined primitive spine; preserve every data read + testid.

**Edit existing primitives** (de-slop in place, consume ui-kit): `quote-callout.tsx` → 2px-accent figure, foreground quote, ui-kit `SourceLink`; `narrative-block.tsx:32` → `text-muted-foreground`→`text-foreground`; `positioning-axis-stack.tsx` → replace card grid with borderless `DataTable` idiom ("You" row = `text-primary` label, no `bg-primary/5`); `milestone-timeline.tsx:35` → fix dead conditional → `step.accent ? 'bg-primary' : 'bg-border'`; `inline-stats` tone map → semantic; `subsection-block.tsx:19` → ui-kit `Eyebrow` (keep `subsection`/`subsection-prose` testids); `bar-breakdown` → verify tokens (keep). Then **delete the superseded leaf primitives** (`primitives/quote-callout` if fully moved, `data-table`, `inline-stats`) and their barrel entries + `__tests__` **after** all consumers import ui-kit.

**Edit all 8 section renderers** (`market-category, buyer-icp[wired], competitor-landscape, voice-of-customer, demand-intent, offer-diagnostic, paid-media-plan, positioning-synthesis`): delete every local `hostnameOf` (10 copies), `SourceLink` (8), `*Pill` (13) → import from ui-kit; replace every `text-[Npx]` label with `Eyebrow` and body sizes with scale tokens; **VoiceOfCustomer:** delete the 3 raw `<table>` + `HEADER/ROW/CELL_CLASS` constants → shared `DataTable`; **kill categorical color** (`PAIN_INTENSITY_TONE`, `DECISION_ROLE_TONE`, `CONFIDENCE_PILL_CLASS`, `CHANNEL_WORKED_CLASS`, `SEVERITY_CLASS`, `CHANNEL_VERDICT_CLASS`) → neutral `MonoBadge`; convert card-grids (paid-media creative grid, axis-stack) → tables/borderless. Keep every artifact field read + sub-section `"N · …"` numbering + every item testid. Leave `CompetitorAdEvidence` (in `components/research/`) and its testids untouched.

**Rebuild (don't delete) `typed-artifact-renderer.tsx` `GenericTypedArtifactRenderer`** — it backs `DraftingArtifactView` (streaming) AND the dispatch `default`. De-slop `DataCard`/`renderRecordValue`/`renderArrayValue`/`ArtifactSources` → borderless blocks + `DataTable` for record arrays + `MonoBadge` chips for primitive arrays; verdict→`VerdictCallout`. Keep the dispatch switch + `typed-artifact-renderer-${zoneId}` testid.

**Delete dead `src/components/research-v2/buyer-icp/`** (8 components + 8 `__tests__` + barrel) — zero production importers; the wired BuyerICP is `section-renderers/buyer-icp.tsx`. Leave the `@/types/buyer-icp-artifact` type (used elsewhere).

**Deep modules + tests:** `hostnameOf` (pure); `SourceLink`/`MonoBadge`/`Callout` render tests; `buildCreativeTableRows` (paid-media grid→rows); keep `classifyAdEvidenceState`/`mapAdCreative` tests green; add a `text-[Npx]` grep guard test.

**Acceptance:** `grep 'bg-muted\|bg-card\|bg-primary/5\|bg-destructive/10\|rounded-xl\|rounded-lg' section-renderers primitives` → 0; `grep 'text-\[[0-9]' section-renderers primitives` → only the 24/26/11/15 scale literals; `grep 'function hostnameOf\|function SourceLink\|function MonoPill\|function Pill' section-renderers` → 0; `grep -c '<table' voice-of-customer.tsx` → 0; categorical color maps deleted; milestone dead-conditional gone; `buyer-icp/` deleted (`find` → nothing); generic renderer still compiles at both call sites; **all section-renderer testids green** (`npm run test:run -- src/components/research-v2/section-renderers`); diffs show only className/import changes, no changed `artifact.*` reads; `build`+`lint`+`test:run` green.

### WP-2 — Activity rail + corpus + delete dead `thinking-block.tsx` · depends WP-0 · does NOT edit the shell

**Goal:** one `ActivityRail` for corpus-build AND per-section running; collapse-on-done; zero emoji; one phase vocabulary. (Shell *wiring* lives in WP-4 — this WP delivers the module + the corpus rewrite + the `section-activity` mapper + the deletion.)

**Create `activity-rail.tsx`** → `ActivityRail({steps, currentLabel, live})` (one `Loader2` when `live` + one `Shimmer` label + `ChainOfThoughtStep` stack via ui-kit `PHASE_ICON`; chips via `ChainOfThoughtSearchResults`; **no per-item `animate-pulse`** — one spinner + one shimmer is the motion budget; optional `Task` collapsible tool detail gated on `step.toolGroup`); `CompletedActivitySummary({sourceCount?, toolCount?, durationLabel?})` (collapse-on-done, emerald Check). Canonical `ActivityStep`/`ActivityPhase` types + `phaseLabel` live here.

**Create `src/lib/research-v2/corpus-activity.ts`** → pure `mapCorpusUpdatesToSteps(updates): {steps, currentLabel}` mapping `ResearchJobUpdate['phase']` (`runner|tool|analysis|thinking|artifact|output|heartbeat|error`) → `ActivityPhase` (drop `heartbeat`; last step `active`, prior `complete`; reuse `JSON_HINT`/chip guards; no jargon).

**Modify `section-activity.ts`** → add pure `sectionFeedToSteps(feed): ActivityStep[]` (drop `done` items; map `tone` → step `status`/`tone`; preserve the tested `buildSectionActivityFeed` contract). Change the jargon label `:274` `'Refining unsupported claims'` → `'Strengthening claims with sources'`. Keep `JSON_HINT`/`searchChip`/`translateReason`/allowlist + all 18 tests.

**Rewrite `corpus-stream.tsx`** render body → centered column + Geist heading + `<ActivityRail>` from `mapCorpusUpdatesToSteps`. Delete `phaseIcon` (emoji), `formatTimestamp`, the `Card`/`ScrollArea`/`Skeleton` imports. Keep the `{userId, runId, onComplete}` contract + `useResearchJobActivity` + completion detection. Error → one error-toned step + a 2px-accent block. (Also covers `/research-v3` — same component.)

**Delete `src/components/research-v2/thinking-block.tsx`** — zero importers (do NOT touch the unrelated `src/components/chat/thinking-block.tsx`).

**Deep modules + tests:** `mapCorpusUpdatesToSteps` (phase mapping, heartbeat dropped, one active, no leak, error→1 step); `sectionFeedToSteps` (done dropped, success≠active, no "unsupported"/"repair", chips survive); `PHASE_ICON`/`phaseLabel` exhaustive + no-emoji; `ActivityRail`/`CompletedActivitySummary` render (one spinner+one shimmer, no emoji in textContent, active=primary vs success=emerald, summary expands).

**Acceptance:** zero emoji across `research-v2`/`lib/research-v2`; `thinking-block.tsx` deleted + zero importers; `phaseIcon(` defined nowhere; `corpus-stream` + the rail both render `<ActivityRail>` (one component, two sites); no `Card`/grey-fill in corpus running/error states; exactly one motion source per running section; `active`≠`success` class; jargon (`repair|unsupported|validation`) absent from labels; reduced-motion safe; new/extended unit tests + `build` green; `/research-v3` corpus identical (shared component).

### WP-3 — Sources / citations module + delete dead source files · depends WP-0 · does NOT edit the shell

**Goal:** one numbered sources footer + inline `[n]` citations; delete the dead/divergent source UIs. (Shell wiring → WP-4.)

**Create `reader-sources.tsx`** → `ReaderSource {n,title,url,whyItMatters?}`; pure `toReaderSources(sources: PositioningArtifactSource[]): ReaderSource[]` (1-based `n`, preserve order, no re-dedup); `SourcesFooter({sources: ReaderSource[]})` (vendored `Collapsible`, chevron + `Eyebrow` "{n} sources", `<ol>` of `NN`/title-link/whyItMatters, `null` on empty); `Cite` (re-export ui-kit `Cite`); pure `parseCitationMarkers(text)` + `renderProseWithCitations(text, sources)` (regex `/\[(\d+(?:\s*,\s*\d+)*)\]/g` → text/cite tokens; out-of-range → literal; no markers/empty → verbatim).

**Delete** `src/components/research-v2/sources-panel.tsx` (dead) and `src/components/ai/sources.tsx` (legacy dup, only used by the dead panel) — re-verify zero importers at execution. **Keep** `ai-elements/sources.tsx` + `ai-elements/inline-citation.tsx` (vendored budget).

**Add `ReaderSourcesContext`** (or a `sources` prop API) so inline `[n]` and the footer share ONE numbered array — provided by the shell in WP-4 around the body render, consumed by `renderProseWithCitations` in the renderers.

**Deep modules + tests:** `toReaderSources` (n=1..N, whyItMatters optional, order preserved); `parseCitationMarkers` (`"foo [1] bar"`, `"[1, 3]"`, `"[2][5]"`, `"[abc]"`→text, boundary `$4[1]m`, empty); `renderProseWithCitations` (matching `[1]` → hover-card; `[9]` of 2 → literal, no crash; empty sources → verbatim); `SourcesFooter` (empty→null, collapsed default, expanded NN/links `target=_blank rel=noreferrer`/whyItMatters); shared status-map round-trip.

**Acceptance:** `sources-panel.tsx` + `ai/sources.tsx` deleted; `grep 'SourcesPanel\|@/components/ai/sources'` → 0; one `SourcesFooter`; inline `[n]` renders `<sup>` mono primary token with hover-card; `[n]` and footer share `toReaderSources` numbering; only vendored `hover-card`/`Collapsible` used (no new dep); `tabular-nums` + Lucide-only + foreground titles; unit tests pass; `build`/`lint`/`test:run` green.

### WP-4 — Shell integration (the ONLY WP that edits `audit-reader-shell.tsx`) · depends WP-0, WP-2, WP-3 · run last (before cleanup)

**Goal:** fold Variant A into the real shell; wire in the WP-2/WP-3 modules. **Keep 100% of the data half** (`useAuditState`, `useSectionPartials`, `statusOf`, `computedDefault`, `active*`, `rerunSection`, `copyActive`, auto-kickoff, keyboard nav, elapsed clock, all markdown helpers `133–316`, `buildDraftArtifact` [exported+tested], `TypedArtifactErrorBoundary`, `DraftingArtifactView` [keep "Drafting..."], `isSixSectionComplete`, `PaidMediaPlan*`). **Replace only presentation + the JSX return.**

**Replace** (per the shell spec, with exact line refs): `SectionStatusIcon`→ui-kit `StatusIcon`/`STATUS_META`; `VerdictCard`→`VerdictCallout`; `SourcesList`→`SourcesFooter`(+`toReaderSources`); `LiveActivity` internals→`<ActivityRail>` (delete `PHASE_ICON`/`ACTIVITY_TONE_ICON_CLASS`/`ActivityCountPill`/`SearchQueryChips`/`ActivityFeedItem`; feed `buildSectionActivityFeed`→`sectionFeedToSteps`; drop the "repairs" pill); add `<CompletedActivitySummary>` in the terminal branch (counts from `activity.counts` + `activeTyped.sources.length` + duration); `SectionProgressStrip`→labeled persistent `SectionRail` (**remove the `!allSectionsTerminal` guard at :1585**, kill the duplicated count, keep ARIA/testid/sublines per §5.3); `RunStatusBar`→Shimmer live label + emerald/amber counts (keep testid/denominator/clock); `QueuedPlaceholder`/`ErrorState`/error-boundary fallback/`PaidMediaPlan*`→quiet 2px-accent ui-kit states (keep rerun wiring + 12 sub-section testids + aborted branch); move global Copy/Rerun → per-section `SectionActions` (wired to `copyActive`/`rerunSection`; keep "Copy"/"Rerun" labels + "Copied"/"Copy failed"). Title→`SectionTitle`. All `text-[Npx]`→scale. Column→single `max-w-[760px] px-6 py-10` (drop the terminal/running width swap). Keep the **string-preserving** `VerificationBadge` (`Verified {n} / Unsupported {m}`). Provide `ReaderSourcesContext` around the body render.

**`page.tsx`:** no change (mount unchanged).

**Deep modules + tests:** `deriveCompletedActivitySummary(events, artifact)` (counts + null duration); `mapReaderStatusToStatusMeta` (aborted→error, ready→…, identity); `SectionActions` wired (rerun spy, disabled, "Copy failed"); `SourcesFooter` real-typed.

**Acceptance:** `audit-reader-shell.test.tsx` passes with **only** the `:176` change (§5.3); `page-one-pager.test.tsx` + rehydrate tests pass unchanged; rail renders when `allSectionsTerminal`; no `VerdictCard`/`rounded-xl`/`bg-muted/50` in the shell; zero arbitrary `text-[Npx]`; no `font-display`/serif; live labels Shimmered, verified=emerald/flagged=amber; Copy/Rerun per-section only; single rail count; single `max-w-[760px] py-10`; `LiveActivityRail` keeps `max-h-[340px]` internal scroll; one `STATUS_META`; reduced-motion safe; `build` 0 + `tsc` no new errors.

### WP-5 — Cleanup & full verification · depends WP-1..WP-4

- Delete the prototype: `src/app/research-v2/proto-reader/` (worktree) **and** the viewing copy in lab-wire `src/app/research-v2/proto-reader/`.
- Revert the temp public-route line in lab-wire `src/middleware.ts` (`/research-v2/proto-reader(.*)` // TEMP PROTOTYPE).
- Confirm `primitives/` leaf files + barrel + `__tests__` for fully-migrated primitives are deleted (no dangling imports).
- Full gates: `npm run build` 0, `npm run lint` clean, `npm run test:run` green, `cd research-worker && npm run build` green (worker baseline — capture BEFORE per the repo's handoff-hygiene rule), `npx tsc --noEmit` no new errors.
- Visual QA on `/research-v2` (live run or fixtures): font=Geist, no emoji anywhere, 2px-accent callouts (no grey cards), rail persists after completion, collapse-on-done works, tables borderless, sources footer numbered, inline `[n]` hovers.

## 7. Execution order (dependency graph)

```
WP-0 (ui-kit, ROOT)
   ├─► WP-1 (renderers + primitives + generic + delete buyer-icp)   ┐ parallel
   ├─► WP-2 (activity-rail + corpus + delete thinking-block)        │ (none edit
   └─► WP-3 (reader-sources + delete dead source files)            ┘  the shell)
                         └─► WP-4 (shell integration — wires WP-2/WP-3) 
                                        └─► WP-5 (cleanup + full gates)
```
- **Only WP-4 edits `audit-reader-shell.tsx`** — assign it to a single agent, run after WP-2/WP-3 land.
- WP-1/WP-2/WP-3 are independent file sets → safe to run concurrently once WP-0 is merged.

## 8. Testing Decisions

- **Good test = external behaviour, not implementation.** Assert rendered text, roles, testids, and pure-function outputs — not class strings except where a class encodes a locked decision (no-fill callout, semantic status color, single motion source).
- **Unit-test the deep modules** (pure, high-leverage): `hostname`, `STATUS_META`/`PHASE_ICON` exhaustiveness, `StatusPill` tone map, `toReaderSources`, `parseCitationMarkers`, `renderProseWithCitations`, `mapCorpusUpdatesToSteps`, `sectionFeedToSteps`, `deriveCompletedActivitySummary`, `mapReaderStatusToStatusMeta`. These replace 8–13 duplicated copies, so one test guards many sites.
- **Render-test** the kit components and `ActivityRail`/`SourcesFooter`/`SectionActions` in isolation (RTL).
- **Preserve the existing suites** (`audit-reader-shell.test.tsx`, `page-one-pager.test.tsx`, `section-activity.test.ts`, `section-renderers/*`) — they are the behaviour contract. Exactly **one** assertion changes (`audit-reader-shell.test.tsx:176`, §5.3).
- **Prior art:** `primitives/__tests__/subsection-block.test.tsx` (RTL setup), `section-activity.test.ts:13-18` (`assertNoRawLeak`), the `ad-evidence-state-*` renderer tests.
- **Regression guards:** a grep test that `text-[Npx]` in renderers/primitives is only the sanctioned scale literals; a no-emoji unicode grep test over the activity surface.

## 9. Out of Scope

- The post-research **chat sidebar** (`chat-thread.tsx`, edit-only) — untouched.
- **Onboarding** (already cleaned), worker/runner logic, lab-engine, schemas, DB.
- A **verifier→sources join** for inline citations (needs a schema change; §5.4) — inline `[n]` is model-marker-derived and additive only.
- The **dark theme** / DESIGN.md dark migration — explicitly overridden to light.
- `CompetitorAdEvidence` (`components/research/`) internals + its testids.
- Variants **B (Workbench)** and **C (Briefing)** — A won; they're deleted with the prototype.
- Deploy (Vercel/Railway) — user-gated.

## 10. Further Notes / load-bearing gotchas

- **Do not import the prototype** (`proto-reader/*` depends on throwaway `./fixtures`). Fold patterns in; retype against real domain types (`ReaderSectionStatus`, `ProductPhase`, `PositioningArtifactSource`).
- **`GenericTypedArtifactRenderer` is NOT pure fallback** — it backs the live streaming `DraftingArtifactView`. Rebuild, never delete.
- **Two BuyerICP impls, two artifact types** — only `section-renderers/buyer-icp.tsx` (`positioning-artifact`'s `BuyerICPArtifact`) is wired; the `buyer-icp/` dir (`buyer-icp-artifact`'s type) is dead → delete the dir incl. `__tests__`.
- **`research-v2/thinking-block.tsx` ≠ `chat/thinking-block.tsx`** — delete the dead research-v2 one only.
- **Two phase vocabularies** unify at the **view-model** layer (`ActivityStep[]`), not the event layer: `ProductPhase` (section feed) and `ResearchJobUpdate['phase']` (corpus poll) stay distinct sources.
- **`worktree` reminder:** the canonical work tree is `feat/v2-artifact-ui-overhaul` off lab-wire `738558f8`. The session's default checkout `/Users/ammar/Dev-Projects/AI-GOS` is a **stale orphan** (182 behind) — do not base work there.
- **Prototype currently exists in two places** (the isolated worktree + a viewing copy dropped into lab-wire) + a temp public-route line in lab-wire `middleware.ts` — WP-5 removes all three.
- The user **approved Variant A live** with the Geist font + tightened spacing already applied in `proto-reader/kit.tsx` — that file is the visual source of truth.
