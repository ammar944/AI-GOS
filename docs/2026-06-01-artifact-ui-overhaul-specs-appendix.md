# Appendix — Per-Area Migration Specs (full detail)

> Companion to `2026-06-01-artifact-ui-overhaul-PRD.md`. These are the unabridged, file:line-grounded migration specs (one per overhaul area) that the PRD work-packages summarize. Each Cursor execution agent should read its area's spec in full.


---

# Design-system component kit (`design-kit`)

I now have full ground truth. Key facts confirmed: `font-sans`/`font-mono` already resolve to Geist/Geist Mono (layout.tsx lines 14, 29), so the prototype's `font-sans`/`font-mono` classes are correct. `ProductPhase` lives in `src/lib/research-v2/section-activity.ts:19` (7 phases incl. `done`). The prototype's local `SectionStatus`/`ActivityPhase`/`SourceRef`/`Block` types live in `proto-reader/fixtures.ts` (throwaway). The real status type is `ReaderSectionStatus` in `audit-reader-shell.tsx`. Existing `ui/badge.tsx` is a `cva` rounded-full pill. Here is the spec.

## Shared De-Slopped Component Kit (`research-v2` UI Foundation)

This is the **dependency root**. Every section renderer, the reading view, and the rail import from here. It must land and pass tests before any section-renderer or chrome work package starts. Build it as a new module `src/components/research-v2/ui-kit/` (a sibling of `primitives/`, NOT a rename — see migration note) so the existing `primitives/index.ts` barrel keeps compiling while renderers are migrated one at a time.

### Target state

A single canonical kit exporting the light-surface, DESIGN-principle-compliant primitives the prototype `kit.tsx` proved, with stable typed APIs and zero per-renderer duplication:

- **Type scale primitives** — `Eyebrow` (label), `SectionTitle` (Geist sans heading), `BodyProse` (foreground body). No renderer hand-rolls `text-[10px] font-medium uppercase tracking-[...]` anymore.
- **Callouts** — `Callout` (2px left accent, no fill, tone-mapped), `VerdictCallout`, `QuoteCallout` (2px accent, foreground quote). Replaces the grey-filled `rounded-lg border bg-muted/40` quote card and the `rounded-xl bg-muted/50` verdict card.
- **One `StatusPill`** — a thin wrapper over vendored `ui/badge.tsx` with a semantic-status + neutral-mono variant, replacing all **13** bespoke `*Pill` components.
- **One `SourceLink` + `hostname()` util** — replacing **9** copies of `SourceLink` and **12** copies of `hostnameOf`.
- **One `Cite`** — inline numbered `[n]` hover-preview citation (vendored `hover-card`), the single inline-citation path.
- **One borderless `DataTable`** — transparent row borders, mono header, right-aligned tabular numerics; ALL tables route through it (generic `<T>` column-render API, so it absorbs the existing typed `primitives/data-table.tsx`).
- **`InlineStats`** — label + big tabular number, no box (absorbs the existing grid-card `primitives/inline-stats.tsx`).
- **ONE `STATUS_META` map + ONE `PHASE_ICON` map + `StatusIcon`** — single source for status icon/color/label and phase→Lucide icon, replacing the inline `SectionStatusIcon` switch (shell) and the duplicate `PHASE_ICON` (shell) and `STATUS_META` (proto).
- **`VerificationBadge`** — semantic verified/flagged counts (replaces the shell's bordered-pill version).
- **Streaming pair** — `LiveActivityRail` (vendored `ChainOfThoughtStep` + `Shimmer`) and `CompletedActivitySummary` (collapse-on-done). These are shared because both the reading view and any future per-section embed reuse them.
- **State blocks** — `QueuedState`, `LockedState`, `ErrorStateBlock` (quiet, 2px-accent, no boxed grey cards).
- **`SectionActions`** — Copy / Rerun inline action group.

All consume real domain types (`ProductPhase` from `section-activity.ts`, `ReaderSectionStatus` + `PositioningArtifactSource` from the shell/types), NOT the throwaway `proto-reader/fixtures.ts` types.

### Current slop to remove (cite file:line)

**T1 — boxed grey card fills / wrong radius (callouts & quotes):**
- `src/components/research-v2/primitives/quote-callout.tsx:31-34` — `rounded-lg border border-border bg-muted/40 p-4` grey card fill. Must become 2px-left-accent, no fill.
- `src/components/research-v2/audit-reader-shell.tsx:393-394` (`VerdictCard`) — `rounded-xl border border-border bg-muted/50 p-5` boxed verdict. Must become 2px-accent `VerdictCallout`.
- `src/components/research-v2/section-renderers/positioning-axis-stack.tsx` (in `primitives/`) `:61-65` — `rounded-md border ... bg-card` / `bg-primary/5` filled position cards (out of kit scope to rebuild, but the fill pattern is the same slop; flag for the section WP).

**T3 — un-named arbitrary type scale (every label hand-rolled):** `text-[10px] font-medium uppercase tracking-[0.08em]` / `0.12em` / `0.06em` / `0.04em` recur, e.g.:
- `src/components/research-v2/primitives/data-table.tsx:40,51` (header `tracking-[0.08em]`)
- `src/components/research-v2/primitives/inline-stats.tsx:39` (`tracking-[0.08em]`)
- `src/components/research-v2/primitives/subsection-block.tsx:19` (`tracking-[0.12em]`)
- `src/components/research-v2/primitives/milestone-timeline.tsx:39` and `bar-breakdown.tsx:48` (`tracking-[0.08em]`)
- `src/components/research-v2/audit-reader-shell.tsx:395,411,837,987,1609` (mixed `0.12em` / `0.06em`)
- `src/components/research-v2/section-renderers/voice-of-customer.tsx:85` (`MonoLabel`, `tracking-[0.08em]`)
- Shell `SearchQueryChips` uses a half-pixel `text-[11.5px]` (`audit-reader-shell.tsx:496`) — exactly the arbitrary-size slop the named scale kills.
All collapse into `Eyebrow` (mono 11px uppercase 0.06em) + the named scale.

**T4 — divergent status/phase color + icon maps (no single source):**
- `src/components/research-v2/audit-reader-shell.tsx:322-370` (`SectionStatusIcon` — 6-branch inline switch, uses `bg-destructive/10`, `border-border`, ad-hoc per status).
- `src/components/research-v2/audit-reader-shell.tsx:449-457` (`PHASE_ICON` — uses `FileText`/`Sparkles` for drafting/refining) vs prototype `kit.tsx:73-80` (`PencilLine`/`SlidersHorizontal`). Two maps disagree — must unify to ONE.
- `src/components/research-v2/audit-reader-shell.tsx:461-467` (`ACTIVITY_TONE_ICON_CLASS`) — a third tone→color map. Fold into `STATUS_META`/a single tone map.
- Per-renderer tone maps that re-encode semantic color: `offer-diagnostic.tsx:51-55,76-81,110-114` (`CONFIDENCE_PILL_CLASS`/`CHANNEL_WORKED_CLASS`/`SEVERITY_CLASS`), `voice-of-customer.tsx:28-32,50-55` (`PAIN_INTENSITY_TONE`/`DECISION_ROLE_TONE`). These should route through the `StatusPill` semantic variant, not bespoke `bg-*/10 text-*` strings.

**T6 — duplicated source/table/citation machinery:**
- **`hostnameOf` × 12:** `audit-reader-shell.tsx:137`, `sources-panel.tsx:22`, `primitives/quote-callout.tsx:13`, `primitives/positioning-axis-stack.tsx:20`, `section-renderers/{offer-diagnostic.tsx:14, positioning-synthesis.tsx:27, competitor-landscape.tsx:26, market-category.tsx:14, buyer-icp.tsx:15, voice-of-customer.tsx:10, paid-media-plan.tsx:36, demand-intent.tsx:14}`.
- **`SourceLink` × 9:** `section-renderers/{positioning-synthesis.tsx:35, competitor-landscape.tsx:89, offer-diagnostic.tsx:22, market-category.tsx:22, voice-of-customer.tsx:91, buyer-icp.tsx:23, paid-media-plan.tsx:44, demand-intent.tsx (grep-confirmed), }` — all the same `text-[10px] uppercase tracking-[0.06em] text-primary ... → ` anchor, with cosmetic drift (synthesis adds an `ExternalLink` icon; others use a `→` glyph).
- **`DataTable` × 2 implementations:** `primitives/data-table.tsx:27` (the shared one — but muted body text `text-muted-foreground` at `:87`, violating "body in foreground") vs `voice-of-customer.tsx:105-109` which hand-rolls `HEADER_CLASS`/`ROW_CLASS`/`CELL_CLASS` instead of using it.
- **Sources footer × 2:** `audit-reader-shell.tsx:403-441` (`SourcesList`, `<details>`) vs prototype `kit.tsx:440` (`SourcesFooter`, `Collapsible`). One numbered footer.
- **Inline citation:** vendored `ai-elements/inline-citation.tsx` exists and is UNUSED by renderers — they hardcode anchor links instead. The kit's `Cite` becomes the one inline-citation path.

**T1 (pills, the 13-copy bloat):** every `*Pill` is the same `inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]`:
- `buyer-icp.tsx:37` (`MonoPill`), `market-category.tsx:84` (`MonoPill`), `demand-intent.tsx:73` (`MonoPill`), `voice-of-customer.tsx:64` (`Pill`), `competitor-landscape.tsx:81` (`CompetitorTypePill`), `positioning-synthesis.tsx:53` + `paid-media-plan.tsx:62` (`SourceSectionPill`), `paid-media-plan.tsx:77` (`ChannelVerdictPill`), `offer-diagnostic.tsx:43,57,83,102,116` (`ReportedByPill`/`ConfidencePill`/`HasWorkedPill`/`SignalTypePill`/`SeverityPill`).

### Precise changes (file-by-file)

**CREATE `src/components/research-v2/ui-kit/` with these files.** (New dir, not a rename of `primitives/`; the existing `primitives/` barrel stays until every renderer is migrated, then is deleted in the section-renderer WP.)

1. **`ui-kit/type.tsx`** — port `Eyebrow`, `SectionTitle`, `BodyProse` verbatim from prototype `kit.tsx:86-157`. Keep classes exactly:
   - `Eyebrow`: `font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground` + `className` passthrough. Props: `{ children: ReactNode; className?: string }`.
   - `SectionTitle`: `font-sans text-[24px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground sm:text-[26px]`. (`font-sans` already = Geist via `layout.tsx:14` — verified; no font wiring needed.) Renders `<h1>`; add an optional `as` prop (`'h1' | 'h2'`) so section sub-titles can be `<h2>` without a second component. Props: `{ children: ReactNode; className?: string; as?: 'h1' | 'h2' }`.
   - `BodyProse`: `max-w-[68ch] text-[15px] leading-[1.6] text-foreground`. Props: `{ children: ReactNode; className?: string }`.

2. **`ui-kit/callout.tsx`** — port `Callout`, `VerdictCallout`, `QuoteCallout`, and `CALLOUT_ACCENT` from prototype `kit.tsx:118-149, 277-310`.
   - `Callout` props: `{ label: string; tone?: 'accent'|'good'|'warn'|'bad'; children: ReactNode }`. Class `border-l-2 pl-4` + `CALLOUT_ACCENT[tone]`.
   - `VerdictCallout` props: `{ verdict: string }`. `border-l-2 border-primary pl-4`.
   - `QuoteCallout` — **API change from the existing `primitives/quote-callout.tsx`**: new shape `{ text: string; source: string; meta?: string; url?: string; cite?: number; sources?: PositioningArtifactSource[] }`. Internally calls `Cite` + `hostname()`. The existing prop names (`quote`/`sourceUrl`/`emphasis`) are renamed (`quote→text`, `sourceUrl→url`); the section-renderer WP updates call sites. Do NOT keep the grey-fill version.

3. **`ui-kit/source.tsx`** — the single source-link + hostname module.
   - `export function hostname(url: string | undefined): string` — the one canonical impl (`new URL(url).hostname.replace(/^www\./,'')` in try/catch; returns `''` for undefined). Accepts `undefined` (superset of all 12 copies, two of which already guard undefined).
   - `export function SourceLink({ url }: { url?: string })` — returns `null` for empty; anchor `inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-primary underline-offset-2 hover:underline` with `hostname(url)` text + a trailing `<ExternalLink className="size-3" aria-hidden />`. (Unifies the `→`-glyph variants and the synthesis icon variant on the icon form.)
   - `export function SourcesFooter({ sources }: { sources: PositioningArtifactSource[] })` — port prototype `kit.tsx:440-470` (numbered `01/02` `Collapsible`). Replaces both shell `SourcesList` and proto `SourcesFooter`. Map `s.title`/`s.url`/`s.whyItMatters` from `PositioningArtifactSource`. Use `Eyebrow` for the `{n} sources` trigger.

4. **`ui-kit/cite.tsx`** — port `Cite` from prototype `kit.tsx:163-180`. Props: `{ source: { n: number; title: string; url: string; whyItMatters?: string } }` (a local `CiteSource` type; the section-renderer WP maps `PositioningArtifactSource` → indexed `CiteSource`). Uses vendored `hover-card`. Keep the `sup` token styling exactly.

5. **`ui-kit/status-pill.tsx`** — ONE pill, thin wrapper over `ui/badge.tsx`.
   - `export function StatusPill({ children, tone, className }: { children: ReactNode; tone?: StatusTone; className?: string })` where `StatusTone = 'neutral'|'complete'|'flagged'|'error'|'active'`.
   - `neutral` → `<Badge variant="secondary">` restyled to mono: `font-mono text-[10px] uppercase tracking-[0.04em]` (the 8 plain pills).
   - semantic tones map to no-fill or 10%-tint per DESIGN badge rule: `complete`→emerald, `flagged`→amber, `error`→red/destructive, `active`→primary. Use `bg-{color}/10 text-{color}` + the mono class (matches DESIGN "Badges: status color at 10% opacity"). Provide a `STATUS_PILL_TONE` record so renderers pass a tone, never a raw class string.
   - This replaces ALL 13 `*Pill` components. Renderers keep their `*_LABEL` lookup maps (those are domain copy, not slop) and pass `<StatusPill tone={...}>{LABEL[value]}</StatusPill>`. The bespoke `CONFIDENCE_PILL_CLASS`/`SEVERITY_CLASS`/etc. class maps are deleted in favor of a `value → tone` map per renderer (one line each).

6. **`ui-kit/data-table.tsx`** — the one borderless table. **Keep the existing generic `<T>` API** from `primitives/data-table.tsx:4-21` (`DataTableColumn<T>` with `key/header/numeric/render/className/headerClassName`, `DataTableProps<T>` with `rows/columns/emptyLabel/caption/rowKey/rowTestId`) — it's already the right shape and is consumed everywhere. Apply the prototype's de-slopped classes:
   - header: `border-b border-border pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80` (replace `tracking-[0.08em]` + `px-3 py-2`).
   - row: `border-b border-transparent transition-colors hover:bg-muted/40` (replace `border-border/60` + `hover:bg-muted/50`).
   - cell: **`text-foreground/90`** (FIX `primitives/data-table.tsx:87` which uses `text-muted-foreground` — violates "body in foreground"); numeric cells `text-right font-mono tabular-nums`; density prop (`comfortable`→`py-2.5`, `compact`→`py-1.5`).
   - Use `Eyebrow` for the optional `caption`.
   - Add `density?: 'comfortable'|'compact'` to `DataTableProps<T>`.

7. **`ui-kit/inline-stats.tsx`** — port the prototype's no-box `InlineStats` (`kit.tsx:251-271`): `dl flex flex-wrap gap-x-10 gap-y-4`, value `font-mono text-[22px] font-semibold tabular-nums` with `STAT_TONE`. **Replace** the existing `primitives/inline-stats.tsx` grid-card version (`grid-cols-2 ... lg:grid-cols-4`). Keep the existing `InlineStatItem` field names (`label/value/unit/tone`) but drop `delta` unless a call site uses it (grep first; the section WP confirms). Props: `{ items: { label: string; value: string; unit?: string; tone?: 'good'|'warn'|'bad'|'neutral' }[] }`.

8. **`ui-kit/status.tsx`** — the single status/phase vocabulary.
   - `export const STATUS_META: Record<ReaderSectionStatus, { icon: LucideIcon; cls: string; label: string; spin?: boolean }>` — port prototype `kit.tsx:62-71` but **key it off the REAL `ReaderSectionStatus`** (`running|complete|error|aborted|ready|locked|queued` — read the exact union from `audit-reader-shell.tsx`), not the proto's 5-value `SectionStatus`. Map `aborted`→X/red, `ready`→ArrowUpRight/primary to preserve the shell's current `SectionStatusIcon` behavior (`:352-357`).
   - `export const PHASE_ICON: Record<ProductPhase, LucideIcon>` — import `ProductPhase` from `@/lib/research-v2/section-activity` (7 keys incl. `done`). Resolve the FileText-vs-PencilLine disagreement: **lock to the shell's current production map** (`audit-reader-shell.tsx:449-457`: drafting→FileText, refining→Sparkles, done→CheckCircle2) so behavior is unchanged; document that the prototype's PencilLine/SlidersHorizontal was illustrative.
   - `export function StatusIcon({ status, className })` — port `kit.tsx:476-480`, driven by `STATUS_META`. This replaces the 6-branch `SectionStatusIcon` switch in the shell (the shell WP swaps to `<StatusIcon status={...} />`).
   - `export const ACTIVITY_TONE_CLASS: Record<SectionActivityTone, string>` — move the shell's `ACTIVITY_TONE_ICON_CLASS` (`:461-467`) here so tone color is single-sourced.

9. **`ui-kit/verification-badge.tsx`** — port prototype `kit.tsx:482-497` (semantic emerald/amber counts). Props: `{ verified: number; flagged: number }`. Replaces shell `VerificationBadge` (`:372-386`); the shell WP maps `verification.verifiedCount`/`unsupportedCount` → these props.

10. **`ui-kit/live-activity.tsx`** — port `LiveActivityRail` + `CompletedActivitySummary` (`kit.tsx:368-434`). `LiveActivityRail` props consume the real `CollapsedSectionActivityItem[]` / `SectionActivityItem[]` from `section-activity.ts` (the shell WP adapts; don't depend on proto `Section`). Use the kit `PHASE_ICON`, vendored `ChainOfThoughtStep` (status `'complete'|'active'|'pending'` — matches the vendored signature confirmed at `chain-of-thought.tsx:92-97`) + `Shimmer`. `CompletedActivitySummary` props: `{ sourceCount?: number; toolCount?: number; durationLabel?: string }`.

11. **`ui-kit/states.tsx`** — port `QueuedState`, `LockedState`, `ErrorStateBlock`, `SectionActions` (`kit.tsx:503-562`). `LockedState` props `{ text: string }`; `ErrorStateBlock`/`SectionActions` take an `onRerun?`/`onCopy?`/`disabled?` callback prop set (the proto's are static buttons; wire callbacks so the shell can pass handlers).

12. **`ui-kit/index.ts`** — barrel re-exporting all of the above + types. Mirror `primitives/index.ts` structure.

**KEEP (do not fold into the kit in this WP):** `primitives/positioning-axis-stack.tsx`, `primitives/bar-breakdown.tsx`, `primitives/milestone-timeline.tsx`, `primitives/narrative-block.tsx`, `primitives/subsection-block.tsx` — these are higher-level/section-specific composites. They get migrated/de-slopped in the section-renderer WP, but they consume kit primitives (e.g. `bar-breakdown` keep, but its `tracking-[0.08em]` caption → `Eyebrow`). Flag, don't rebuild here.

**DO NOT** edit `proto-reader/*` (throwaway) or delete `primitives/` in this WP — deletion happens after the last renderer migrates (sequenced in the section-renderer WP to avoid dangling barrel imports, per the learned-pattern on kill-list barrel hygiene).

### Deep modules to extract (simple testable interface) + test recommendations

These are the pure, headless units worth isolating and unit-testing (the rest is presentational and covered by render-smoke + visual QA):

1. **`hostname(url?: string): string`** (`ui-kit/source.tsx`) — pure string fn. **Tests:** `https://www.ramp.com/x` → `ramp.com`; `http://g2.com` → `g2.com`; bare `not a url` → `not a url`; `undefined` → `''`; subdomain `https://blog.ramp.com` → `blog.ramp.com` (no www only). This is the single highest-value test — it replaces 12 copies, so one test guards all.

2. **`STATUS_META` + `statusTone` completeness** (`ui-kit/status.tsx`) — assert `STATUS_META` has an entry for **every** `ReaderSectionStatus` union member and `PHASE_ICON` for every `ProductPhase` member (incl. `done`). **Test:** a type-level exhaustiveness check plus a runtime `expect(Object.keys(STATUS_META).sort()).toEqual([...ALL_STATUSES].sort())`. Guards the T4 "two maps disagree" regression — if someone adds a status, the test fails until the map is updated.

3. **`STATUS_PILL_TONE` → class resolution** (`ui-kit/status-pill.tsx`) — extract a pure `ton.toClass(tone): string` helper so the tone→class mapping is testable without rendering. **Test:** each `StatusTone` maps to the expected `text-{semantic}` token; unknown tone falls back to `neutral`.

4. **`SourcesFooter` numbering** — extract `formatSourceIndex(n: number): string` (`String(n).padStart(2,'0')`). **Test:** `1`→`'01'`, `12`→`'12'`. Trivial but pins the numbered-footer contract that 3 prior implementations got cosmetically different.

5. **`DataTable<T>` render contract** — keep the component thin; **test** via React Testing Library: renders one `<th>` per column with `scope="col"`, numeric columns get `text-right` + `tabular-nums`, `render` callback output appears, `emptyLabel` shows on `rows=[]`, `rowTestId` is applied. (Port/extend the spirit of the existing `primitives/__tests__/subsection-block.test.tsx` setup.)

Test file locations: `src/components/research-v2/ui-kit/__tests__/*.test.tsx`, run via `npm run test:run -- src/components/research-v2/ui-kit`. Keep the pure-fn tests (1–4) in a single `ui-kit-utils.test.ts` for speed.

### Acceptance criteria (checklist; objective + verifiable)

- [ ] `src/components/research-v2/ui-kit/` exists with `index.ts` exporting: `Eyebrow, SectionTitle, BodyProse, Callout, VerdictCallout, QuoteCallout, StatusPill, SourceLink, hostname, SourcesFooter, Cite, DataTable, InlineStats, STATUS_META, PHASE_ICON, StatusIcon, VerificationBadge, LiveActivityRail, CompletedActivitySummary, QueuedState, LockedState, ErrorStateBlock, SectionActions` (+ their prop/column types).
- [ ] `grep -rn "function hostnameOf" src/components/research-v2/` returns **0** results after the section-renderer WP consumes the kit (this WP delivers the single `hostname`; the count drops to 1 in `ui-kit/source.tsx`). In THIS WP's diff, `ui-kit/source.tsx` is the only new `hostname` definition.
- [ ] `grep -rn "rounded-full bg-secondary px-2 py-0.5 text-\[10px\]" src/components/research-v2/ui-kit/` returns **0** — the kit pill goes through `ui/badge.tsx`, not a hand-rolled span.
- [ ] No file in `ui-kit/` contains a grey card fill on a callout/quote: `grep -rn "bg-muted/40\|bg-muted/50\|rounded-lg\|rounded-xl" src/components/research-v2/ui-kit/` returns **0**.
- [ ] No arbitrary half-pixel sizes in the kit: `grep -rn "text-\[1[0-9]\.[0-9]px\]" src/components/research-v2/ui-kit/` returns **0**. All labels use `Eyebrow`/named classes.
- [ ] `STATUS_META` keys === the exact `ReaderSectionStatus` union (test 2 passes); `PHASE_ICON` keys === `ProductPhase` union incl. `done`.
- [ ] `StatusIcon`, `STATUS_META`, `PHASE_ICON`, `hostname`, `SourceLink`, `Cite`, `DataTable`, `InlineStats` are each imported from a vendored dep where applicable (`ui/badge`, `ui/collapsible`, `ui/hover-card`, `ai-elements/chain-of-thought`, `ai-elements/shimmer`) — **zero new npm installs** (`git diff package.json` empty).
- [ ] Body/quote/table text uses `text-foreground` / `text-foreground/90`, NOT `text-muted-foreground`, for content (verifiable by grep on the new files: table cell + BodyProse + quote use foreground).
- [ ] Icons are Lucide-only, no emoji anywhere in `ui-kit/` (`grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/components/research-v2/ui-kit/` returns 0).
- [ ] Unit tests in `ui-kit/__tests__/` cover deep modules 1–5 and pass: `npm run test:run -- src/components/research-v2/ui-kit` exits 0.
- [ ] `npx tsc --noEmit` adds **0** new errors vs the pre-existing baseline (the kit compiles against real `ReaderSectionStatus`/`ProductPhase`/`PositioningArtifactSource` types, not proto fixtures).
- [ ] `src/app/research-v2/proto-reader/*` and `src/components/research-v2/primitives/*` are **unmodified** in this WP's diff (proto is reference; primitives are deleted later, downstream).
- [ ] No `proto-reader/fixtures.ts` import anywhere in `ui-kit/` (`grep -rn "proto-reader" src/components/research-v2/ui-kit/` returns 0).

**Downstream contract note for the section-renderer + chrome WPs (not this WP's work, but the interface they bind to):** all 9 section renderers delete their local `hostnameOf`/`SourceLink`/`*Pill`/tone-class maps and import from `@/components/research-v2/ui-kit`; the shell swaps `SectionStatusIcon`→`StatusIcon`, `PHASE_ICON`/`ACTIVITY_TONE_ICON_CLASS`→kit, `VerdictCard`→`VerdictCallout`, `SourcesList`→`SourcesFooter`, `VerificationBadge`→kit; `primitives/` is deleted only after the last renderer migrates (kill-list must include the `primitives/index.ts` barrel + `primitives/__tests__/`).

Files referenced (all absolute, under worktree `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul`): prototype kit `src/app/research-v2/proto-reader/kit.tsx`; real shell `src/components/research-v2/audit-reader-shell.tsx`; real primitives `src/components/research-v2/primitives/{data-table,inline-stats,quote-callout,narrative-block,subsection-block,bar-breakdown,positioning-axis-stack,milestone-timeline,index}.tsx`; renderers `src/components/research-v2/section-renderers/{buyer-icp,market-category,competitor-landscape,offer-diagnostic,voice-of-customer,demand-intent,positioning-synthesis,paid-media-plan}.tsx`; vendored `src/components/ai-elements/{chain-of-thought,shimmer,inline-citation,sources}.tsx` + `src/components/ui/{badge,collapsible,hover-card}.tsx`; domain types `src/lib/research-v2/section-activity.ts` (`ProductPhase`); fonts confirmed in `src/app/layout.tsx:14,29` (`font-sans`/`font-mono` = Geist/Geist Mono).


---

# Audit Reader shell integration (`shell`)

I now have a complete and precise picture. I have the real shell (1697 lines), the prototype kit/chrome/variant, the page mount, the Shimmer API, the section-activity feed builder, and — critically — the two test files that pin the exact contracts (test-ids, ARIA names, exact strings). I have everything needed to write an unambiguous migration spec.

## Area: Fold Variant A "Document" into the real AuditReaderShell

### Target state

The real `audit-reader-shell.tsx` keeps 100% of its data plumbing and adopts the prototype's Variant A presentation:

- **Top bar** — `Eyebrow("Positioning Audit") / {company}` on the left; on the right a `RunStatus` bar whose live phase label is wrapped in `Shimmer`, with `verified=emerald-600` / `flagged=amber-600` (NOT blue). **No global Copy/Rerun** — they move into the reading column.
- **Left rail** — a persistent, **labeled** `SectionRail` (`w-[208px]`, status icon + section name + status subline). It renders for the **entire** lifecycle — before, during, AND after the run terminates (fixing the "vanishes when terminal" bug). A single `completed/total` count in one `Eyebrow` (kill the duplicated count).
- **Centered reading column** — `max-w-[760px] px-6 py-10`, one section at a time:
  - **running** → quiet `LiveActivityRail` (Shimmer phase label + vendored `ChainOfThoughtStep` timeline). On commit it does NOT persist as a wall of steps.
  - **complete** → `Eyebrow("Section N of 8")` + per-section `SectionActions` (Copy/Rerun) + `SectionTitle` (Geist) + `CompletedActivitySummary` (collapse-on-done one-liner) + `VerdictCallout` (2px left accent, replacing `VerdictCard`'s `rounded-xl bg-muted/50`) + typed body + numbered `SourcesFooter`.
  - **queued / error / locked** → quiet 2px-left-accent state blocks, no grey card fills.
  - **PaidMediaPlan** keeps its special-case terminal panel (checklist + typed renderer), re-skinned to drop card fills.
- Typography: Geist titles only (drop any serif/`font-display`), `text-foreground` body, Geist Mono labels.
- All arbitrary `text-[Npx]` mapped to the named scale; spacing tightened to `py-10` column / `space-y-7` body blocks.

### Current slop to remove (cite file:line)

All paths = `src/components/research-v2/audit-reader-shell.tsx` unless noted.

1. **`VerdictCard` is a grey rounded card** — `392-401`: `rounded-xl border border-border bg-muted/50 p-5` with an `11px` uppercase label. Violates "2px-left-accent, NO bg fill, kill rounded-xl card fills." Replace with `VerdictCallout`.
2. **`SectionProgressStrip` is the narrow `w-14` icon-only rail, not labeled** — `901-961`: `w-14`, icons only, tooltip-only labels. Locked direction is a **labeled** `w-[208px]` rail. Replace presentation.
3. **Duplicated completed count inside the strip** — `913-918` renders `{completedCount}/{...}` at the top AND `953-957` renders it again at the bottom (`mt-auto`). Collapse to ONE count.
4. **Rail "vanishes when terminal" bug** — `1585-1592`: `{!allSectionsTerminal ? <SectionProgressStrip .../> : null}`. The rail is conditional on the run being non-terminal, so it disappears once everything finishes. The locked direction requires it to persist before AND after completion. Remove the `!allSectionsTerminal` guard.
5. **`RunStatusBar` live label is plain text, not Shimmer; uses `text-primary` for verified** — `1038-1059`: phase label is `text-muted-foreground` (no Shimmer); verified count uses `text-primary` (blue) at `1046`, flagged uses `text-amber-500`. Locked direction: Shimmer the live label, verified=emerald, flagged=amber.
6. **Global Copy/Rerun in the top bar** — `1549-1580`: two `Button`s in the header. Locked direction moves these per-section into `SectionActions`.
7. **Arbitrary `text-[Npx]` everywhere** — e.g. title `text-[27px]...sm:text-[31px]` `1619`; `text-[13px]` header `1531/1535`; `text-[12px]` eyebrow `1609`; `text-[15px]` status summary `1628`; `text-[16px]` verdict `398`; `text-[13.5px]` `586/763`; `text-[11.5px]` `496`; `text-[12.5px]` `553`. Map to the named scale (`SectionTitle`, `Eyebrow`, `BodyProse`, etc.).
8. **`SourcesList` uses `<details>` + non-mono numbering** — `403-441`: native `<details>`, `ArrowUpRight` toggle, decimal padded numbers without `font-mono`. Replace with `SourcesFooter` (Collapsible + `ChevronRight` + `font-mono tabular-nums`).
9. **`QueuedPlaceholder` / `ErrorState` are boxed grey/destructive cards** — `641-650` (`rounded-xl border-dashed bg-muted/30`), `652-684` (`rounded-xl border-destructive/30 bg-destructive/5`). Replace with 2px-left-accent `QueuedState` / `ErrorStateBlock` patterns (but keep the live rerun wiring — prototype blocks are non-functional).
10. **`SectionStatusIcon` ring/badge style diverges from `STATUS_META`** — `322-370`: complete = bordered ring + `Check` in `text-foreground` (not emerald); error = `bg-destructive/10` rounded badge. Locked semantic palette: complete=emerald, error=red, via the one `STATUS_META`/`StatusIcon` map.
11. **`PHASE_ICON` map duplicated** — `449-457` (shell) vs `kit.tsx:73-80`. Two maps; the shell's uses `FileText`/`CircleDot`/`Sparkles`, the kit uses `PencilLine`/`SlidersHorizontal`. Must become ONE map (the kit lacks a `done` key the shell's `ProductPhase` requires — see extraction notes).
12. **`PaidMediaPlanSubSectionChecklist` + terminal panel use card fills** — `824` (`rounded-lg border bg-muted/30`), `863` (`rounded-xl border bg-muted/30`). Re-skin to remove fills (keep the checklist logic + `data-testid`s verbatim — tests at `audit-reader-shell.test.tsx:186-189` assert 12 `sub-section-status-*` testids).
13. **Column max-width swaps on terminal** — `1596-1600`: `max-w-[1080px]` terminal vs `max-w-[820px]` running. Locked direction is a single consistent `max-w-[760px]` reading column.

### Precise changes (file-by-file)

#### A. `src/components/research-v2/audit-reader-shell.tsx` (the only file edited at runtime)

This file is NOT rewritten wholesale. The data half (lines ~1131–1521 of the component body, plus all helpers `133–316`) is **kept verbatim**. Only presentation components and the JSX `return` (`1523–1696`) change.

**KEEP UNCHANGED (do not touch the logic):**
- All imports of `useAuditState`, `useSectionPartials`, types, `pickPositioningTypedArtifact`, `getSectionSubSections`.
- Markdown helpers `cleanTitle, hostnameOf, describeError, readResponseError, extractMetadata, scrollElementToTop, humanizeCopyKey, hasCopyValue, primitiveCopyValue, recordTitle, appendMarkdownValue, artifactToMarkdown` (`133–316`).
- `kickedOffRunIds`, `AUTO_KICKOFF_MIN_PARENTLESS_AGE_MS`, the constants at `103–123`.
- `buildDraftArtifact` (`726–752`) — **exported, test-covered** (`audit-reader-shell.test.tsx:43-77`). Keep name + signature + behavior.
- `TypedArtifactErrorBoundary` (`686–724`) — test at `865-891` asserts "Section body could not render." Keep.
- `DraftingArtifactView` (`754–780`) — test at `346-386` asserts "Drafting..." + `typed-artifact-renderer-positioningMarketCategory`. Keep the `<GenericTypedArtifactRenderer>` body; the `Loader2 + "Drafting..."` header may adopt Shimmer but MUST keep the literal text "Drafting...".
- `isSixSectionComplete` (`782–790`), `getCommittedPaidMediaSubSectionKeys` (`792–812`), `PaidMediaPlanSubSectionChecklist` (`814–846`, keep `data-testid`s), `PaidMediaPlanTerminalPanel` (`848–892`, re-skin fills only).
- The entire component body's hooks/derived state `1136–1520`: `meta` hydration, auto-kickoff effect, `workerById`, `typedByZone`, `sixSectionsComplete`, `statusOf`, `computedDefault`, `active`/`activeIndex`/`activeTyped`/`activeStatus`/`activeWorker`/`activeDraftArtifact`, `completedCount`, `positioningCompletedCount`, `allSectionsTerminal`, `verificationRollup`, `activePhaseLabel`, elapsed-clock machinery, `select`, keyboard effect, `rerunSection`, `copyActive`.
  - **Note**: `copyActive` and `rerunSection` are now invoked by per-section `SectionActions` instead of header buttons, but their bodies are unchanged. The test `name: /^rerun$/i` and `name: /copy/i` (`635, 728, 777, 818, 859`) must still resolve to clickable buttons — so `SectionActions` must render real buttons wired to these callbacks (see C).

**REPLACE these presentation components:**

| Old (line) | New |
|---|---|
| `SectionStatusIcon` (`322–370`) | Import/extract `StatusIcon` + `STATUS_META` (emerald/red/amber/muted palette). Map `ReaderSectionStatus` → `SectionStatus`: `'ready'`→render as `queued`-style or a distinct ready glyph; `'locked'`→`locked`; `'aborted'`→`error`. |
| `VerificationBadge` (`372–386`) | Keep EXACT text `Verified {n} / Unsupported {m}` — test `146` asserts `'Verified 12 / Unsupported 2'`. Do NOT switch to the kit's icon-only `VerificationBadge` (different output). Re-style to mono if desired but preserve the string. |
| `VerdictCard` (`392–401`) | `VerdictCallout` — `border-l-2 border-primary pl-4`, `Eyebrow("Verdict")`, prose in `text-foreground`. Delete `VerdictCard`. |
| `SourcesList` (`403–441`) | `SourcesFooter` — Collapsible, `Eyebrow("{n} sources")`, `font-mono tabular-nums` numbers. Must keep an accessible toggle and `whyItMatters` subline. Note `page-one-pager.test.tsx:361` asserts `'1 sources'` text — preserve that exact "{n} sources" string. |
| `LiveActivity` (`567–639`) | Rework into a `LiveActivityRail`: Shimmer phase label header (replace the plain `<span>{activity.currentLabel}</span>` at `591`); render `activity.items` through vendored `ChainOfThoughtStep` (icon from the single `PHASE_ICON` map, `label`, `description=item.detail`, chips via `ChainOfThoughtSearchResults`). **KEEP** the `buildSectionActivityFeed({events, latestActivity, phaseLabel})` call (`576`) and the `max-h-[340px] overflow-y-auto` internal scroll (`611`) so a long run can't grow the page. Drop the standalone count pills + skeleton-noise block, or keep a minimal skeleton ONLY for `items.length===0`. The test at `303-344` asserts the worker `latestActivity` ("Reading category evidence") AND a translated event title ("Searching source evidence") both appear — both come from `buildSectionActivityFeed`, so keep feeding it the same inputs. |
| `QueuedPlaceholder` (`641–650`) | `QueuedState` (2px dashed-left, no fill). Keep the same copy. |
| `ErrorState` (`652–684`) | `ErrorStateBlock` styled (2px red-left, no fill) BUT wired: it must call `onRerun`/`pending` like the current one (test `472-489` asserts "Section needs review" + enabled "rerun section" button). The kit's `ErrorStateBlock` is non-functional — port its className, keep this file's props + button wiring. |
| `SectionProgressStrip` (`894–961`) | Labeled `SectionRail`: `w-[208px] px-2`, ONE count `Eyebrow`, per-section button with `StatusIcon` + name + `STATUS_SUBLINE`. **CRITICAL ARIA**: keep `nav aria-label="Sections"` (test `255` does `getByRole('navigation', { name: 'Sections' })`) and per-button accessible name `"{shortLabel}: {subline}"` so the regex matchers still hit (`/market & category.*complete/i` `118`, `/buyer \/ icp/i` `256`, `/paid media plan.*locked until 6\/6/i` `278`, `/paid media plan.*ready after 6\/6/i` `299`). KEEP `data-testid="section-progress-strip"` on the rail root (tests `176, 276, 297, 341`). KEEP the subline vocabulary mapping at `922–933` verbatim: complete→"Complete", error→"Needs review", aborted→"Aborted", ready→"Ready after 6/6", locked→"Locked until 6/6". KEEP the `0/8` count substring (test `342`) — `completedCount/READER_SECTION_IDS.length` where length=8. |
| `RunStatusBar` (`1008–1068`) | Re-skin: wrap `activePhaseLabel ?? 'researching live sources'` in `Shimmer`; recolor verified→`text-emerald-600`, flagged→`text-amber-600`. KEEP `data-testid="run-status-bar"`, keep `completedCount={positioningCompletedCount}` and `/{POSITIONING_SECTION_IDS.length}` denominator, keep the elapsed clock + `RunStat` mono idiom. |
| `MobileSectionSwitcher` (`1072–1119`) | Keep; recolor `Check` complete glyph to `text-emerald-600`, error to `text-red-600` for palette consistency. KEEP `data-testid="mobile-section-switcher"` and `aria-current`. |

**REPLACE the JSX `return` (`1523–1696`):**

- Header (`1529–1582`): keep the `Eyebrow / {company}` left cluster; right side = `{!allSectionsTerminal && runDispatched ? <RunStatusBar .../> : null}` ONLY. **Delete the two header Copy/Rerun `Button`s (`1549–1580`).**
- Body row (`1584–1594`): render `<SectionRail .../>` **unconditionally** (remove `!allSectionsTerminal` guard). The `<main>` reading column keeps `ref={mainRef}` + `overflow-y-auto`; change wrapper to single `max-w-[760px] px-6 py-10 sm:px-10` (drop the terminal/running max-width swap).
- Inside the column header row (`1608–1617`): keep `Eyebrow("Section {activeIndex+1} of {READER_SECTION_IDS.length}")` (test asserts "Section 1 of 8" / "Section 8 of 8"). Add `<SectionActions disabled={!TERMINAL_READER_STATUSES.has(activeStatus)} onCopy={copyActive} onRerun={() => rerunSection(active)} copied={copied} copyError={copyError} rerunPending={rerunPending===active} />` next to the `VerificationBadge`.
- Title (`1619–1623`): `<SectionTitle>` (Geist) instead of the raw `<h1 text-[27px]>`.
- complete branch (`1625–1659`): order = optional `statusSummary` `BodyProse`-muted → `CompletedActivitySummary` (collapse-on-done, fed `sourceCount`/`toolCount`/`durationLabel` derived from `live.eventsByZone[active]` + `activeTyped.sources.length`) → `VerdictCallout` → typed body (unchanged `TypedArtifactRenderer` / PaidMedia special-case) → `SourcesFooter`. KEEP `PAID_MEDIA_PLAN_SECTION_ID` special-case (`1638–1643`) and its `live.eventsByZone[...]` wiring.
- running / error / queued / paid-media-terminal branches (`1660–1691`): same control flow, swapped to the new state components. KEEP the `activeDraftArtifact ? <DraftingArtifactView/> : <LiveActivityRail/>` fork (`1667–1678`).

#### B. NEW shared module — `src/components/research-v2/audit-reader-kit.tsx`

Extract the de-slopped primitives so the shell imports them (and they're unit-testable in isolation). Port from `kit.tsx` but type against the REAL `ReaderSectionStatus` and `PositioningArtifactSource`, not the prototype `fixtures.ts` types. Export: `Eyebrow, SectionTitle, VerdictCallout, Callout, BodyProse, SourcesFooter, StatusIcon, STATUS_META, VerificationBadge (string-preserving), SectionActions, CompletedActivitySummary, QueuedState, ErrorStateBlock, LockedState, PHASE_ICON`.

#### C. `SectionActions` contract change

Prototype `SectionActions` (`kit.tsx:503-522`) renders dead buttons. The real one must accept `{ onCopy, onRerun, copied, copyError, rerunPending, disabled }` and wire them to the shell's `copyActive`/`rerunSection`. Button labels MUST remain "Copy" and "Rerun" (regex `/copy/i`, `/^rerun$/i`). The Copy button shows `copied ? 'Copied' : copyError ? 'Copy failed' : 'Copy'` (test `834-863` asserts "Copy failed").

#### D. `src/app/research-v2/proto-reader/*` and `variant-document.tsx`

**Leave untouched** (reference/throwaway). After the fold-in lands and is verified, a follow-up commit may delete `src/app/research-v2/proto-reader/` — but that is out of scope here; flag it, don't do it.

#### E. `src/app/research-v2/page.tsx`

**No change.** Mount stays `<AuditReaderShell runId={state.runId} />` (`551`). The shell's external props (`runId`, `activeSectionId?`, `onSectionChange?`) are unchanged.

### Deep modules to extract (simple testable interface) + test recommendations

1. **`deriveCompletedActivitySummary(events: SectionEvent[], artifact: PositioningTypedArtifact | null): { sourceCount: number; toolCount: number; durationLabel: string | null }`** — in `audit-reader-kit.tsx` or a `section-summary.ts` helper. Pure function feeding `CompletedActivitySummary`. The prototype's summary reads `section.sourceCount/toolCount/durationLabel` from fixtures; the real shell must compute these from `live.eventsByZone` (count `tool-started`/`tool-finished`) and `artifact.sources.length`. **Test**: given a fixture event array, assert correct counts and a null `durationLabel` when timings absent.

2. **`mapReaderStatusToStatusMeta(status: ReaderSectionStatus): SectionStatus`** — pure mapper bridging the 6-value `ReaderSectionStatus` (`running|complete|error|aborted|queued|locked|ready`) to the kit's 5-value `SectionStatus`. **Test**: assert `aborted→error`, `ready→` (queued or a ready variant), `locked→locked`, identity for the rest.

3. **Unified `PHASE_ICON: Record<ProductPhase, LucideIcon>`** — single source in the kit, covering ALL 7 `ProductPhase` values including `done` (the prototype's map omits `done` and `committing` uses `CheckCircle2`). **Test**: assert the map is total over `ProductPhase` (no `undefined` lookups) — `Object.keys` length === 7.

4. **`SectionActions` (presentational, props-driven)** — extract with the wired contract from C. **Test**: render with `onRerun` spy, click "Rerun", assert called; render `disabled`, assert button disabled; render `copyError`, assert "Copy failed".

5. **`SourcesFooter` (real-source-typed)** — **Test**: renders `'{n} sources'` label, expands to show `whyItMatters`, numbers are `font-mono` padded (`01`, `02`). Mirror `page-one-pager.test.tsx:361` ("1 sources").

### Acceptance criteria (checklist; objective + verifiable)

- [ ] `npm run test:run -- src/components/research-v2/__tests__/audit-reader-shell.test.tsx` passes with **zero** test edits (all 30+ assertions: test-ids, ARIA names, exact strings).
- [ ] `npm run test:run -- src/app/research-v2/__tests__/page-one-pager.test.tsx` and `src/app/research-v3/__tests__/page-rehydrate.test.tsx` pass unchanged.
- [ ] `data-testid="section-progress-strip"`, `"run-status-bar"`, `"mobile-section-switcher"`, and the 12 `sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-*` testids are present.
- [ ] The section rail renders for `allSectionsTerminal === true` (terminal-state render test shows it) — the `!allSectionsTerminal` guard at line `1585` is gone. (Note: the existing test `149-190` asserts the strip is *absent* when terminal+`activeSectionId=PAID_MEDIA`; **this assertion at line 176 must be updated** to expect the persistent rail — this is the one intentional test change required by the locked "persists after completion" direction. Flag it explicitly in the PR.)
- [ ] No `VerdictCard`, no `rounded-xl`/`bg-muted/50`/`bg-muted/30` card fills remain in the shell; verdict + states use `border-l-2 ... pl-4` with no fill.
- [ ] Zero arbitrary `text-[Npx]` half-pixel sizes (`13.5/11.5/12.5/16/27/31`) remain; titles use `SectionTitle` (Geist `text-[24px] sm:text-[26px] tracking-[-0.02em]`), labels use `Eyebrow` (mono 11px), body uses `BodyProse`/`text-foreground`.
- [ ] No Instrument Serif / `font-display` class anywhere in the shell (grep clean).
- [ ] Live phase label in `RunStatusBar` AND `LiveActivityRail` is wrapped in `<Shimmer>`; verified counts are `text-emerald-600`, flagged are `text-amber-600` (no `text-primary`/blue verified, no `text-amber-500`).
- [ ] Copy/Rerun buttons exist ONLY per-section (in `SectionActions`), NOT in the global header; `name: /^rerun$/i` and `name: /copy/i` still resolve.
- [ ] Single completed-count display in the rail (the duplicate at old `953–957` is gone).
- [ ] Reading column is a single `max-w-[760px] px-6 py-10` (no terminal/running max-width swap).
- [ ] `LiveActivityRail` keeps `max-h-[340px] overflow-y-auto` internal scroll; a 50-event run does not grow page height.
- [ ] Status colors follow the locked semantic palette via ONE `STATUS_META`: emerald=complete, red=error/aborted, amber=flagged, blue=running, muted=queued/locked/ready.
- [ ] `motion-reduce:animate-none` preserved on all spinners/Shimmer; reduced-motion users see no animation.
- [ ] `npm run build` exits 0; `npx tsc --noEmit` adds no new errors vs the pre-change baseline.

**Load-bearing caveat for the executor**: the single test that must change is `audit-reader-shell.test.tsx:176` (`queryByTestId('section-progress-strip')).not.toBeInTheDocument()` under the terminal/paid-media case). The locked direction makes the rail persistent, so this assertion inverts to `.toBeInTheDocument()`. Every other assertion in both test files must pass untouched. Verify the `name: /paid media plan.*ready after 6\/6/i` and `locked until 6\/6` regexes still match after switching to the labeled `STATUS_SUBLINE` (the prototype's `STATUS_SUBLINE` says "Locked"/"Ready" — the REAL rail must keep the shell's richer "Locked until 6/6" / "Ready after 6/6" sublines, NOT adopt the prototype's shorter ones).


---

# Section renderers + primitives migration (`renderers`)

Confirmed: the entire `buyer-icp/` directory is dead production code (only its own `__tests__` reference it; no page/route imports it). The wired BuyerICP path is `section-renderers/buyer-icp.tsx`. I now have everything needed. Writing the spec.

## Typed Document Body — 8 Section Renderers, Primitives Kit, Buyer-ICP Sub-cards, Generic Fallback

### Target state

The committed reading column is a single light "OpenAI-dev" document built from one disciplined primitive spine, restyled to the locked DESIGN PRINCIPLES. Concretely:

- **One callout idiom** (2px left accent, NO fill, `rounded-md` max) for verdicts, quotes, and emphasis — the de-slopped `kit.tsx` `Callout` / `QuoteCallout` / `VerdictCallout` patterns folded into the production primitives. Zero `rounded-xl/lg` + `bg-muted/bg-card/bg-primary/5` filled cards remain in any body renderer.
- **One `DataTable`** — borderless rows (`border-transparent` + `hover:bg-muted/40`), mono `text-[10px]` uppercase `0.06em` headers, `tabular-nums` numerics, body cells in `text-foreground/90`. ALL ranked/comparative data (including VoiceOfCustomer's three forked raw `<table>`s, the PositioningAxisStack comparative grid, the paid-media creative grid, and the GenericTypedArtifactRenderer 2-col card grids) flows through it.
- **One type scale** — named primitives (`Eyebrow` mono 11px/0.06em, `SectionTitle` Geist semibold 24–26px `tracking-[-0.02em]`, `BodyProse` foreground 15px/1.6, plus `Data` / table cell sizes). Zero arbitrary `text-[Npx]` literals survive in body renderers (the grep found ~90 across these files; target = 0 outside the named scale tokens).
- **Status color only.** Every categorical/decorative tint (offer-diagnostic confidence/severity, awareness-level red/green chips, VoC pain=red / champion=blue) collapses to neutral mono badges or the single status palette (emerald=verified/complete, amber=flagged, red=error, blue=active, muted=queued/locked). Accent (`text-primary`) is spent only on the verdict accent bar and inline citations.
- **Body prose in `text-foreground`**, never `text-muted-foreground` (NarrativeBlock's defect). Muted is reserved for meta/captions/sublabels.
- **Data shape + sub-section spine preserved.** Every renderer keeps its exact artifact field reads, its `SubsectionBlock` numbering ("1 · …"), and every `data-testid` the test suite asserts. This is a restyle, not a re-architecture.
- **`GenericTypedArtifactRenderer` rebuilt** on the same de-slopped primitives so the two paths that still hit it (the streaming draft view and any unmatched/error-fallback zone) can never render slop. It is NOT deleted (it has two live call sites).
- **The dead `buyer-icp/` directory is deleted** (8 components + 8 tests + barrel), because the wired BuyerICP renderer is `section-renderers/buyer-icp.tsx` and nothing in production imports `buyer-icp/`.

### Current slop to remove (cite file:line)

**T1 — filled/over-rounded callout cards (primitive root cause):**
- `primitives/quote-callout.tsx:31-35` — `rounded-lg border border-border bg-muted/40 p-4`. This primitive is the root; it propagates to every VoC quote (`voice-of-customer.tsx:130,301`) and every competitor public-weakness quote (`competitor-landscape.tsx:774`).
- `section-renderers/positioning-synthesis.tsx:137` — `rounded-md border border-primary/30 bg-primary/5 p-4` "recommended move" card.
- `section-renderers/competitor-landscape.tsx:761` — `rounded-md border border-border bg-card p-4` wrapping the BarBreakdown.
- `primitives/positioning-axis-stack.tsx:61-65` — per-position `rounded-md border … bg-card` / `bg-primary/5` cards.
- `section-renderers/paid-media-plan.tsx:295` — creative-framework `rounded-md border border-border bg-muted/30 p-4` card grid.
- `typed-artifact-renderer.tsx:216,231,295,374` — `DataCard` / `renderRecordValue` / `ArtifactSources` `rounded-md border border-border bg-muted p-3/p-4` filled cards.
- All five `buyer-icp/*.tsx` cards use shadcn `<Card>` fills (`persona-card.tsx:20`, `awareness-level-card.tsx:25`, `trigger-card.tsx:13`, `firmographic-cut-card.tsx:16`, `cluster-venue-card.tsx:15`) — but this dir is dead (see T-delete).
- `buyer-icp.tsx:282` (wired) — awareness ladder wrapped in `rounded-md border border-border bg-card` with `divide-y`.

**T4 — broken/categorical color semantics:**
- `offer-diagnostic.tsx:51-55` `CONFIDENCE_PILL_CLASS` (`bg-primary/10 text-primary` / `bg-destructive/10 text-destructive`), `:76-81` `CHANNEL_WORKED_CLASS`, `:110-114` `SEVERITY_CLASS` — categorical rainbow tints on `high/medium/low` and `yes/partial/no`.
- `voice-of-customer.tsx:28-32` `PAIN_INTENSITY_TONE` (`bg-destructive/10 text-destructive`), `:50-55` `DECISION_ROLE_TONE` (`text-primary` champion, `text-destructive` blocker).
- `buyer-icp/awareness-level-card.tsx:9-15` `LEVEL_CHIP_CLASS` (red/green/blue per level) — dead dir.
- `primitives/milestone-timeline.tsx:35` — dead conditional `step.accent ? 'bg-primary' : 'bg-primary'` (both branches identical; accent-blue on every dot).
- `paid-media-plan.tsx:70-75` `CHANNEL_VERDICT_CLASS` (`bg-destructive/10`, `bg-primary/10`) — categorical verdict tints.

**T5 — muted body text:**
- `primitives/narrative-block.tsx:32` — `text-[14px] leading-[1.65] text-muted-foreground` sets ALL running prose muted. This is the single highest-impact readability defect; it flows into every `SubsectionBlock` via `:21-22`.
- `primitives/data-table.tsx:87` — body cells default `text-muted-foreground` (only numerics get `text-foreground` at `:88-89`).

**T6 — duplicated helpers + forked primitives:**
- `hostnameOf` copied verbatim in: `quote-callout.tsx:13`, `positioning-axis-stack.tsx:20`, `market-category.tsx:14`, `buyer-icp.tsx:15`, `competitor-landscape.tsx:26`, `voice-of-customer.tsx:10`, `demand-intent.tsx:14`, `offer-diagnostic.tsx:14`, `paid-media-plan.tsx:36`, `positioning-synthesis.tsx:27` (10 copies).
- `SourceLink` copied in: `market-category.tsx:22`, `buyer-icp.tsx:23`, `competitor-landscape.tsx:89`, `voice-of-customer.tsx:91`, `demand-intent.tsx:22`, `offer-diagnostic.tsx:22`, `paid-media-plan.tsx:44`, `positioning-synthesis.tsx:35` (8 copies, slightly divergent).
- `MonoPill` / `Pill` / `SourceSectionPill` / type-specific pills copied: `market-category.tsx:84`, `buyer-icp.tsx:37`, `demand-intent.tsx:73`, `voice-of-customer.tsx:64`, plus 5 bespoke pills in `offer-diagnostic.tsx:43,57,83,102,116` and `competitor-landscape.tsx:81`, `paid-media-plan.tsx:62,77`, `positioning-synthesis.tsx:53`.
- `voice-of-customer.tsx:105-109` + `:152-294` — forks `DataTable` as three raw `<table>` blocks with byte-identical `HEADER_CLASS`/`ROW_CLASS`/`CELL_CLASS` constants instead of using the shared primitive.

**T7 — card grids for ranked/comparative data:**
- `typed-artifact-renderer.tsx:275` — `grid grid-cols-1 gap-3 md:grid-cols-2` DataCard grid (`renderArrayValue`).
- `primitives/positioning-axis-stack.tsx:56` — `grid … sm:grid-cols-2 lg:grid-cols-3` card grid for comparative positions.
- `paid-media-plan.tsx:291` — `grid gap-3 md:grid-cols-2` creative-framework grid.
- `buyer-icp/sub-section.tsx:30` — `grid … md:grid-cols-2 lg:grid-cols-3` (dead dir).

**T3 — arbitrary text sizes:** ~90 `text-[Npx]` literals across all eight renderers + six primitives + typed-artifact-renderer (full list in grep output above; representative: `market-category.tsx:235` `text-[20px]`, `competitor-landscape.tsx:504` `text-[18px]`/`:315` `text-[15px]`, `buyer-icp.tsx:296,300` `text-[12px]/[13px]`, every `text-[10px]` mono label).

### Precise changes (what to replace / keep / create — file-by-file)

#### A. CREATE — shared primitives (single source of truth, fold from `kit.tsx`)

These do not exist in `primitives/` yet; lift the de-slopped versions from `proto-reader/kit.tsx` and add to `src/components/research-v2/primitives/`, exported from `primitives/index.ts`:

1. **`primitives/type-scale.tsx`** → `Eyebrow` (kit.tsx:86-97), `SectionTitle` (kit.tsx:99-112), `BodyProse` (kit.tsx:155-157). Named scale: Eyebrow = `font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground`; SectionTitle = `font-sans text-[24px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground`; BodyProse = `text-[15px] leading-[1.6] text-foreground max-w-[68ch]`. (These three literal sizes become the ONLY sanctioned `text-[Npx]` values; everything else must reference them.)
2. **`primitives/callout.tsx`** → `Callout` (kit.tsx:134-149) + `VerdictCallout` (kit.tsx:125-132) with the `CALLOUT_ACCENT` tone map (kit.tsx:118-123). 2px left accent, NO fill.
3. **`primitives/source-link.tsx`** → ONE `SourceLink` + `hostnameOf`. Signature must be the superset of all 8 copies: `{ url?: string; className?: string }`, renders `{hostname} →` with `ExternalLink`, returns `null` for empty. Export `hostnameOf` too.
4. **`primitives/badge.tsx`** → ONE `MonoBadge` replacing all `MonoPill`/`Pill`/`SourceSectionPill`/`*Pill` copies. Neutral by default: `inline-flex items-center rounded-[3px] bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-secondary-foreground`. Accepts an optional `status?: 'verified'|'flagged'|'error'|'active'|'neutral'` prop mapping to the semantic palette — used ONLY where a real status exists, never for categorical labels.

> Note: `kit.tsx` itself is a prototype file under `src/app/research-v2/proto-reader/` and must NOT be imported by production (it depends on `./fixtures`). Fold its patterns into `primitives/`, do not import it.

#### B. EDIT — existing primitives

- **`primitives/quote-callout.tsx`** — replace the wrapper at `:31-35`. New: `<figure className="border-l-2 border-primary/40 pl-5">`, quote in `text-[15px] leading-[1.6] text-foreground` (not muted), figcaption mono meta line, `SourceLink` from the shared primitive (drop the local `hostnameOf` at `:13-19`). Keep `QuoteCalloutProps` exactly (props `quote/source/sourceUrl/meta/emphasis/className`) — both VoC and competitor pass these.
- **`primitives/narrative-block.tsx:32`** — change `text-muted-foreground` → `text-foreground`; size token to BodyProse's 15px/1.6. Keep `paragraphsFromProse` and props.
- **`primitives/data-table.tsx`** — `:51` header already correct (keep). `:77` row border `border-border/60` → `border-transparent` + keep `hover:bg-muted/50`. `:87` body cell `text-muted-foreground` → `text-foreground/90`. Keep the generic `DataTableColumn<T>` API, `render`, `rowKey`, `rowTestId`, `caption`, `emptyLabel` — every renderer depends on it.
- **`primitives/positioning-axis-stack.tsx`** — replace the card grid (`:56-80`) with the borderless `DataTable` idiom: one row per position, "You" row gets `text-primary` label only (no `bg-primary/5` fill at `:64`). Drop local `hostnameOf` (`:20`) → shared `SourceLink`. Keep `PositioningAxisItem`/`PositioningAxisPosition` types and the `isUs` flag.
- **`primitives/milestone-timeline.tsx:35`** — fix dead conditional: `step.accent ? 'bg-primary' : 'bg-border'` (accent dot blue, others neutral). Keep `MilestoneItem`/props.
- **`primitives/inline-stats.tsx`** — already close to the kit version; align `TONE_CLASS` (`:19-24`) to the semantic palette (`good→emerald-600`, `bad→red-600`, `warn→amber-600`, `neutral→foreground`) instead of `text-primary`/`text-destructive`. Keep `InlineStatItem` API.
- **`primitives/bar-breakdown.tsx`** — keep (theme-aware, no fill slop). No change required beyond verifying tokens.
- **`primitives/subsection-block.tsx:19`** — replace inline `text-[10px]…` label with `<Eyebrow>`; route prose through the now-foreground `NarrativeBlock`. Keep `data-testid="subsection"` / `"subsection-prose"` (`:18,22`).
- **`primitives/index.ts`** — add exports for the new `Eyebrow/SectionTitle/BodyProse/Callout/VerdictCallout/SourceLink/hostnameOf/MonoBadge`.

#### C. EDIT — section renderers (restyle only; preserve every field read + testid)

For ALL eight: delete the local `hostnameOf`, `SourceLink`, and `*Pill`/`MonoPill`/`Pill` definitions; import the shared `SourceLink` and `MonoBadge` from `../primitives`. Replace every `text-[Npx]` mono label with `<Eyebrow>` and every inline body size with the scale tokens. Keep all `SubsectionBlock label="N · …"` numbering and all `rowTestId`/`data-testid` strings.

- **`market-category.tsx`** — delete `MonoPill` (`:84-96`), `SourceLink` (`:22-34`), `hostnameOf` (`:14-20`). The category-maturity block (`:233-275`): `text-[20px]` stage heading → `SectionTitle`-sub or a scale token; `MonoPill` → `MonoBadge`; keep `MATURITY_*_LABEL` maps. Keep `adjacent-item`/`signal-item`/`force-item` testids.
- **`buyer-icp.tsx`** (the WIRED one) — delete local `MonoPill`/`SourceLink`/`hostnameOf`. Awareness ladder (`:279-310`): drop the `rounded-md border border-border bg-card` + `divide-y` shell; render as a borderless `DataTable` (columns: Level badge / Share `tabular-nums` / Evidence / Sample query) OR a hairline-separated block list. Keep `awareness-row`, `persona-card`, `firmographic-item`, `trigger-item`, `cluster-item` testids and all label maps.
- **`competitor-landscape.tsx`** — delete local `CompetitorTypePill` (`:81-87`), `SourceLink` (`:89-101`), `hostnameOf` (`:26-32`). Public-weaknesses quotes already use `QuoteCallout` (inherits the primitive fix). BarBreakdown wrapper (`:761`): drop `rounded-md border bg-card` → borderless (Eyebrow caption + bar). `CompetitorFocusPanel` (`:416-572`) tab idiom is clean (keep `competitor-focus-panel`, tablist/tab roles); restyle the inner `dl` facts to foreground. Keep ALL ad-evidence testids (`ad-evidence-group`, `ad-evidence-state-*`, `transparency-link-*`) and the `CompetitorAdEvidence` import untouched (out of scope — it's a `components/research/` component).
- **`voice-of-customer.tsx`** — **delete the three raw `<table>` blocks** (`:152-294`) and the `HEADER_CLASS`/`ROW_CLASS`/`CELL_CLASS` constants (`:105-109`); rebuild Objections / Switching Stories / Decision Criteria as `DataTable` with `render` columns. Delete local `Pill` (`:64-81`), `MonoLabel`, `SourceLink`, `hostnameOf`. Kill `PAIN_INTENSITY_TONE` (`:28-32`) and `DECISION_ROLE_TONE` (`:50-55`) categorical tints → neutral `MonoBadge`. Keep `voc-quote`, `success-quote`, `objection-item`, `switching-item`, `criterion-item` testids.
- **`demand-intent.tsx`** — delete local `MonoPill`/`SourceLink`/`hostnameOf`; `DomainChips` (`:87-101`) keep but neutralize (`bg-secondary` → neutral `MonoBadge` style). Keep `keyword-item`/`question-item`/`gap-item`/`intent-item`/`venue-item` testids.
- **`offer-diagnostic.tsx`** — delete the 5 bespoke pills (`ReportedByPill`, `ConfidencePill`, `HasWorkedPill`, `SignalTypePill`, `SeverityPill`, `:43-127`) and their categorical class maps (`CONFIDENCE_PILL_CLASS`, `CHANNEL_WORKED_CLASS`, `SEVERITY_CLASS`). Replace with `MonoBadge` (neutral; confidence/severity become plain labels, NOT colored). Keep `proof-point-item`/`funnel-break-item`/`channel-item`/`retention-item`/`red-flag-item` testids.
- **`paid-media-plan.tsx`** — delete local `SourceLink`/`SourceSectionPill`/`hostnameOf`; `ChannelVerdictPill` categorical map (`:70-88`) → neutral `MonoBadge`. **Creative-framework grid** (`:291-301`): convert `md:grid-cols-2` filled-card grid → `DataTable` (or borderless stacked blocks) using `CreativeSummary`'s lines. Keep `getPaidMediaPlanBody` unwrap logic, `PAID_MEDIA_BODY_KEYS`, and `paid-media-plan-renderer` / `typed-artifact-renderer-positioningPaidMediaPlan` testids.
- **`positioning-synthesis.tsx`** — delete local `SourceLink`/`SourceSectionPill`/`hostnameOf`. "Recommended move" card (`:137-152`): `rounded-md border border-primary/30 bg-primary/5` → `VerdictCallout`/`Callout` 2px-accent no-fill. Keep `getSynthesisBody` unwrap, `positioning-synthesis-renderer` / `typed-artifact-renderer-positioningSynthesis` testids.

#### D. REBUILD — `typed-artifact-renderer.tsx` `GenericTypedArtifactRenderer`

Do NOT delete (two live call sites: `DraftingArtifactView` streaming path at shell:771-777, and the `default` fallback in `TypedArtifactRenderer` at :488-494). Rebuild its leaf renderers on the de-slopped primitives so the fallback/draft can never emit slop:
- `DataCard` (`:201-243`) and `renderRecordValue` (`:288-299`): replace `rounded-md border bg-muted p-3/4` filled cards → borderless blocks (Eyebrow label + foreground value, hairline separators).
- `renderArrayValue` (`:259-285`): primitive arrays → inline `MonoBadge` chips (drop `bg-muted/border` pills at `:261-270`); record arrays → `DataTable` instead of the `md:grid-cols-2` `DataCard` grid (`:275`).
- `FieldList` (`:174-199`), `FieldGroup` (`:309-349`): labels → `Eyebrow`; values → `text-foreground`.
- Header (`:415-427`): `verdict` → `VerdictCallout`; `text-base text-foreground` keeps; `statusSummary` stays muted (meta).
- `ArtifactSources` (`:351-399`): replace per-source `rounded-md border bg-muted p-3` cards (`:374`) with the numbered (01/02 `tabular-nums`) `SourcesFooter` idiom from kit.tsx:440-470 — but note the shell owns the committed `SourcesList`, so Generic's source list only matters for the fallback path; keep it numbered + borderless.
- Keep `TypedArtifactRenderer` dispatch switch (`:462-495`) and `data-testid="typed-artifact-renderer-${zoneId}"` (`:412`) exactly.

#### E. DELETE — dead `buyer-icp/` directory

`src/components/research-v2/buyer-icp/` has ZERO production importers (confirmed: only its own `index.ts`, `renderer.tsx`, and `__tests__/` reference it; no page/route/shell import). The wired BuyerICP renderer is `section-renderers/buyer-icp.tsx`. Delete the whole directory INCLUDING `__tests__/` (8 components, 8 test files, barrel) so orphan tests don't break the tsc/test gate (per the repo's learned-pattern on orphan tests). This removes the second copy of the persona/awareness/trigger/firmographic/venue card slop (T1+T4+T7) in one move. Verify no stray import of `@/types/buyer-icp-artifact` remains load-bearing only here (it's also used by `lib/research-v2/audit-artifact-view.ts` and `lib/lab-engine/sections/section-registry.ts` — those are out of scope; leave the type).

### Deep modules to extract (simple testable interface) + test recommendations

1. **`hostnameOf(url: string): string`** (in `primitives/source-link.tsx`) — pure. Tests: strips `www.`, returns input unchanged on malformed URL, handles `http`/`https`/subdomains. (Currently untested and duplicated 10×.)
2. **`SourceLink` / `MonoBadge` / `Callout` / `VerdictCallout` primitives** — render-tested in isolation: renders `null` for empty url (SourceLink); applies the correct semantic class for each `status` and the neutral class by default (MonoBadge); renders 2px accent + no `bg-` class (Callout — assert `className` contains `border-l-2` and contains no `bg-muted`/`bg-card`).
3. **`buildCreativeTableRows(creatives): Row[]`** (extract from paid-media `CreativeSummary`) — pure mapping from creative objects to table rows, so the grid→table conversion is unit-testable without rendering.
4. **`classifyAdEvidenceState` / `mapAdCreative` (competitor-landscape:112-196)** — already pure; KEEP and keep their existing tests green (they back the `ad-evidence-state-*` testids). Do not touch logic.
5. **A `text-[Npx]` lint guard** — add a Vitest/grep test asserting `grep -rn 'text-\[[0-9]' src/components/research-v2/{section-renderers,primitives}` returns only the three sanctioned scale literals (24/26 in SectionTitle, 11 in Eyebrow, 15 in BodyProse). This makes T3 regression-proof.

### Acceptance criteria (objective + verifiable)

- [ ] `grep -rn 'bg-muted\|bg-card\|bg-primary/5\|bg-destructive/10\|rounded-xl\|rounded-lg' src/components/research-v2/section-renderers src/components/research-v2/primitives` returns **0** lines (callout/card fills and over-rounding eliminated; `rounded-md`/`rounded-[3px]` only).
- [ ] `grep -rn 'text-\[[0-9]' src/components/research-v2/section-renderers src/components/research-v2/primitives` returns **only** the SectionTitle (24/26px), Eyebrow (11px), and BodyProse (15px) scale literals — every other arbitrary `text-[Npx]` is gone.
- [ ] `hostnameOf`, `SourceLink`, and the pill component are each defined **once** (in `primitives/`); `grep -rn 'function hostnameOf\|function SourceLink\|function MonoPill\|function Pill' src/components/research-v2/section-renderers` returns **0**.
- [ ] `voice-of-customer.tsx` contains **no** raw `<table>` / `<thead>` / `<tbody>` — `grep -c '<table' src/components/research-v2/section-renderers/voice-of-customer.tsx` == 0; Objections/Switching/Criteria render via the shared `DataTable`.
- [ ] No categorical color: `PAIN_INTENSITY_TONE`, `DECISION_ROLE_TONE`, `CONFIDENCE_PILL_CLASS`, `CHANNEL_WORKED_CLASS`, `SEVERITY_CLASS`, `CHANNEL_VERDICT_CLASS`, `LEVEL_CHIP_CLASS` are deleted; the only color classes remaining in body renderers are the semantic-status set (`emerald|amber|red|primary` for verified/flagged/error/active) and neutral `muted`.
- [ ] `milestone-timeline.tsx` dead conditional fixed — `grep "? 'bg-primary' : 'bg-primary'"` returns 0; accent dot uses `bg-primary`, others `bg-border`.
- [ ] `NarrativeBlock` and `DataTable` body cells render prose in `text-foreground` (not `text-muted-foreground`) — verified by snapshot/class assertion.
- [ ] `PositioningAxisStack`, paid-media creative framework, and GenericTypedArtifactRenderer record arrays render as tables/borderless blocks — **no** `md:grid-cols-2`/`lg:grid-cols-3` card grids remain in those code paths.
- [ ] `GenericTypedArtifactRenderer` still exists and both call sites compile (`DraftingArtifactView`, `TypedArtifactRenderer` default); its `DataCard`/`renderArrayValue`/`ArtifactSources` emit no `bg-`-filled cards.
- [ ] The `buyer-icp/` directory is deleted; `find src -path '*research-v2/buyer-icp*'` returns nothing; `npm run test:run` shows no orphaned `buyer-icp/__tests__` failures.
- [ ] **All existing section-renderer test `data-testid`s and roles still pass**: `adjacent-item, signal-item, force-item, firmographic-item, persona-card, awareness-row, trigger-item, cluster-item, voc-quote, success-quote, objection-item, switching-item, criterion-item, keyword-item, question-item, gap-item, intent-item, venue-item, proof-point-item, funnel-break-item, channel-item, retention-item, red-flag-item, ad-evidence-group, ad-evidence-state-{lookup-capped,not-checked,no-active-ads}, transparency-link-google, competitor-focus-panel, paid-media-plan-renderer, positioning-synthesis-renderer, typed-artifact-renderer-{positioningPaidMediaPlan,positioningSynthesis}, subsection, subsection-prose` — `npm run test:run -- src/components/research-v2/section-renderers` green.
- [ ] Every renderer's artifact field reads are byte-identical to before (data shape + sub-section spine unchanged) — diff shows only className/wrapper/helper-import changes, no new/removed `artifact.*` accesses.
- [ ] `npm run build` exits 0, `npm run lint` clean, full `npm run test:run` green (frontend baseline).

---

**Key files (absolute):**
- Renderers: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/components/research-v2/section-renderers/{market-category,buyer-icp,competitor-landscape,voice-of-customer,demand-intent,offer-diagnostic,paid-media-plan,positioning-synthesis}.tsx`
- Primitives: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/components/research-v2/primitives/{quote-callout,narrative-block,data-table,positioning-axis-stack,milestone-timeline,inline-stats,bar-breakdown,subsection-block,index}.ts(x)`
- Generic fallback: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/components/research-v2/typed-artifact-renderer.tsx`
- DELETE: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/components/research-v2/buyer-icp/` (dead — wired BuyerICP is `section-renderers/buyer-icp.tsx`)
- Fold-from reference (do NOT import — prototype): `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/app/research-v2/proto-reader/kit.tsx`
- Consumer (read-only context): `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-artifact-ui-overhaul/src/components/research-v2/audit-reader-shell.tsx` (lines 771-777 draft path, 880-886 paid-media, 1649-1653 committed path)

**Load-bearing facts the executor must not miss:**
- `GenericTypedArtifactRenderer` is NOT pure fallback — it backs the live streaming `DraftingArtifactView`. Deleting it breaks streaming. Rebuild, don't delete.
- There are TWO BuyerICP implementations using TWO different artifact types (`positioning-artifact`'s `BuyerICPArtifact` via the wired `section-renderers/buyer-icp.tsx`, vs `buyer-icp-artifact`'s `BuyerICPArtifact` via the dead `buyer-icp/` dir). Only the section-renderer is wired.
- VoiceOfCustomer is the only renderer that forks `DataTable` as raw `<table>` (3×) — highest-value single T6 fix.
- `competitor-landscape.tsx` imports `CompetitorAdEvidence` from `components/research/` (outside this area) — leave that import and its testids alone.


---

# Streaming / activity + corpus screen (`streaming`)

I now have a complete, verified picture. I have all file paths, line numbers, the two phase vocabularies, the three divergent UIs, the shared primitive interfaces from the prototype, and the consumers. Writing the spec.

## Live Streaming Activity & Corpus-Build Screen — Unify into ONE Activity Language

### Target state

There is exactly **one** way the app draws "an agent is working": a single vendored-stack `ActivityRail` primitive built on `ChainOfThoughtStep` + `Shimmer` (+ `Task`/`TaskTrigger`/`TaskContent` for collapsible tool detail), driven by **one** Lucide `PHASE_ICON` map and **one** phase vocabulary. It renders in two places that today are three divergent UIs:

1. **Corpus-build screen** (`/research-v2` + `/research-v3` `state.kind === 'corpus'`) — replaces the `Card` "Activity log" + emoji list in `corpus-stream.tsx`.
2. **Per-section running state** (`audit-reader-shell.tsx` reading column when `activeStatus === 'running'` and no draft artifact) — replaces the bespoke `LiveActivity` faux-timeline.

Behaviour contract for both surfaces:
- **Running** → the rail is visible: a single `Shimmer` label of the current phase, one `Loader2` spinner (and only one), a stack of `ChainOfThoughtStep` rows (Lucide phase-icon + calm outcome-oriented label + optional detail + optional search-query chips), reduced-motion safe.
- **Collapse-on-done** → on commit/complete the rail collapses to a single one-line summary: `Researched N sources · M tools · T` behind a `Collapsible`, re-expandable, never cluttering the finished read. (Today the per-section path simply unmounts `LiveActivity` and the corpus path navigates away — neither collapses; the new shared component owns this transition so any future surface gets it free.)
- **Zero emoji.** Lucide only. Both `phaseIcon()` emoji maps are deleted.
- **Color semantics honored by the consumer**: `active` = `text-primary` (blue), `success`/`committed` = `text-emerald-600`, `warning` = `text-amber-500/600`, `error` = `text-destructive`/`text-red-600`, `neutral`/`queued` = muted. Today the shell's `ACTIVITY_TONE_ICON_CLASS` flattens both `active` and `success` to `text-primary` — that distinction must be restored.
- **One narration vocabulary**: internal QA jargon (`repairs`, `unsupported claims`, `validation-failed`) is hidden behind calm phase labels; the rail never shows the word "repair" or "unsupported".

The two underlying event sources stay distinct (they genuinely differ — see below), but both are mapped into **one shared `ActivityStep[]` view model** that the single `ActivityRail` consumes. The adapter logic differs per source; the rendered primitive does not.

### Current slop to remove (cite file:line)

**Emoji phase-icon maps (hard DESIGN violation — the loudest slop tell):**
- `src/components/research-v2/corpus-stream.tsx:20-39` — `phaseIcon()` returns `🔍 🧠 💭 📄 ✓ ⏱ ✗ →`.
- `src/components/research-v2/thinking-block.tsx:25-44` — byte-identical duplicate `phaseIcon()` emoji map.

**Three divergent "agent is working" UIs (T2):**
- `src/components/research-v2/corpus-stream.tsx:86-144` — `Card`/`CardHeader`/`CardTitle` "Activity log" + `ScrollArea h-80` + emoji rows + `Skeleton` placeholders. A grey-card-fill idiom that violates the light "no boxed card fills" principle.
- `src/components/research-v2/thinking-block.tsx:76-124` — `Collapsible` rail, `animate-pulse` text, `{n} events` count, emoji rows, `border-l border-border pl-3` left rule.
- `src/components/research-v2/audit-reader-shell.tsx:567-639` — `LiveActivity` faux-timeline: hand-rolled `ActivityFeedItem` (`audit-reader-shell.tsx:511-565`), `ActivityCountPill` (`469-483`), `SearchQueryChips` (`485-509`), `PHASE_ICON` (`449-457`), `ACTIVITY_TONE_ICON_CLASS` (`461-467`). None of this is built on the vendored `ChainOfThoughtStep`/`Task`/`Shimmer` stack.

**Color-distinction slop (T4 — active vs success collapsed):**
- `src/components/research-v2/audit-reader-shell.tsx:462-463` — `active: 'text-primary'` and `success: 'text-primary'` map to the same token. `success`/committed must be emerald.

**Spinner / motion duplication (T2 motion — more than one shimmer/spinner per running section):**
- `audit-reader-shell.tsx:587-591` — a `Loader2` spinner + `<span className="font-medium">{currentLabel}</span>` (NOT a `Shimmer`), then per-item `live && animate-pulse` on every last icon (`530`). That is a spinner **plus** a pulsing icon — two motion sources. The prototype uses one `Loader2` + one `Shimmer` label and no per-item pulse (`kit.tsx:377-382`).
- `thinking-block.tsx:84` and `:97` — two independent `animate-pulse` sources (trigger text + "Starting…" line).

**Card-fill / boxed-grey slop adjacent to the running state (light-surface principle):**
- `corpus-stream.tsx:96-141` — `Card rounded-lg` wrapping the log.
- `audit-reader-shell.tsx:641-650` — `QueuedPlaceholder` uses `rounded-xl border border-dashed bg-muted/30 ... text-center` (boxed grey card; the prototype `QueuedState` at `kit.tsx:528-534` is a borderless 2px-left-accent block). In scope because it's the sibling state of the running rail and shares the activity language.
- `audit-reader-shell.tsx:662` — `ErrorState` uses `rounded-xl border border-destructive/30 bg-destructive/5` (boxed fill; prototype `ErrorStateBlock` at `kit.tsx:545-562` is a 2px-left-accent block).

**Internal-jargon narration leaking to labels:**
- `section-activity.ts:271-278` — `repair-started` produces `title: 'Refining unsupported claims'` (the word "unsupported" is QA jargon).
- `section-activity.ts:263-270` — `validation-failed` → `'Checking source support'` / `'Verifying claims against sources'` (acceptable but should be unified with the calm vocabulary).
- `section-activity.ts:606-608` — the shell renders an `ActivityCountPill` literally labeled `"repairs"` — surfaces the repair concept to the customer.

**Pre-existing duplication that the unification removes:**
- Two `formatTimestamp()` copies: `corpus-stream.tsx:41-51` and `thinking-block.tsx:46-56` (identical). The shared rail drops per-row wall-clock timestamps entirely (the `ChainOfThoughtStep` idiom doesn't show them), eliminating both.

### Precise changes (what to replace / keep / create — unambiguous, file-by-file)

**CREATE `src/components/research-v2/activity-rail.tsx`** — the single shared primitive. Three exports:

1. `ActivityRail` — props `{ steps: ActivityStep[]; currentLabel: string; live: boolean }`. Renders, exactly as `kit.tsx:373-410` `LiveActivityRail` does:
   - One header row: `Loader2` (size-4, `animate-spin text-primary motion-reduce:animate-none`, only rendered when `live`) + `Shimmer` (`text-[14px] font-medium`, `duration={2.2}`) wrapping `currentLabel`.
   - A `space-y-3` stack mapping `steps` to `ChainOfThoughtStep` (`icon={PHASE_ICON[s.phase]}`, `status={s.status}`, `label`, `description={s.detail}`). Search chips render via `ChainOfThoughtSearchResults`/`ChainOfThoughtSearchResult` exactly as `kit.tsx:394-403`.
   - NO per-item `animate-pulse` (delete that motion source). One spinner + one shimmer is the motion budget.
   - When a step has >0 tool calls worth grouping, wrap detail in `Task`/`TaskTrigger`/`TaskContent` (collapsible tool detail) — optional, gated on a `step.toolGroup` field; default off so the simple search-chip path is unchanged.
2. `CompletedActivitySummary` — props `{ sourceCount?: number; toolCount?: number; durationLabel?: string }`. Port `kit.tsx:413-434` verbatim (the `Check` emerald + `Researched N · M · T` collapsible). This is the collapse-on-done "after" state.
3. `ActivityStep`, `ActivityPhase` types — move out of the prototype `fixtures.ts:13-27` into this file (or a sibling `activity-rail-types.ts`) as the canonical types. `phaseLabel()` (`fixtures.ts:339-348`) and `PHASE_ICON` (the Lucide map from `kit.tsx:73-80`) live here as the single source of truth.

The canonical `PHASE_ICON` (Lucide, zero emoji): `preparing: CircleDot, searching: Search, drafting: PencilLine, checking: ShieldCheck, refining: SlidersHorizontal, committing: CheckCircle2`. (Reconcile the two prototype variants: `kit.tsx:73-80` uses `PencilLine`/`SlidersHorizontal`; the shell `PHASE_ICON` at `audit-reader-shell.tsx:449-457` uses `FileText`/`Sparkles` and adds a `done` key. Pick the `kit.tsx` set; add `done: CheckCircle2` only if the adapter can emit `done`.)

**CREATE `src/lib/research-v2/corpus-activity.ts`** — adapter `mapCorpusUpdatesToSteps(updates: CollapsedResearchJobUpdate[]): { steps: ActivityStep[]; currentLabel: string }`. Maps the `ResearchJobUpdate['phase']` vocabulary (`runner | tool | analysis | thinking | artifact | output | heartbeat | error`, `research-job-activity-core.ts:44`) onto the unified `ActivityPhase`. Mapping table (calm, outcome-oriented, no jargon):
- `runner` → `preparing`; `tool` → `searching` (carry `update.message`-derived chip if clean); `analysis` → `checking`; `thinking` → `drafting`; `artifact` → `committing`; `output` → `committing`; `heartbeat` → drop (it's a keepalive, not a phase — fixes the `⏱` row noise); `error` → a single `error`-toned step.
- The last non-dropped step gets `status: 'active'`; prior steps `status: 'complete'`. `currentLabel = phaseLabel(activePhase)`.
- Reuse the JSON-hint / length guards from `section-activity.ts:71` (`JSON_HINT`) and `searchChip` discipline so no raw payload reaches a label.

**MODIFY `src/lib/research-v2/section-activity.ts`** — the existing `buildSectionActivityFeed` already produces a customer-safe `CollapsedSectionActivityItem[]`. Add a thin mapper `sectionFeedToSteps(feed: SectionActivityFeed): ActivityStep[]` so the shell's `LiveActivity` can feed the shared `ActivityRail` without changing the feed builder's tested contract. Map `item.phase` (already `ProductPhase`) → `ActivityPhase` by dropping `done` (terminal sections don't show a running step) and passing the other six through 1:1 (the names already align). Map `item.tone` → step `status`: `active` → `'active'` for the last item else `'complete'`; `success` → `'complete'`; `warning`/`error` keep their tone for color via a `tone` passthrough field on `ActivityStep`.
- **Fix the jargon at the source**: change `section-activity.ts:274` `title: 'Refining unsupported claims'` → `'Strengthening claims with sources'` (calm). Keep `translateReason` (`:149-160`) — it's already calm and used as `detail`.
- Keep `JSON_HINT`, `searchChip`, `translateReason`, `buildSectionActivityFeed`, the allowlist `EVENT_PHASE`, and all existing tests passing. This is additive plus one label string change.

**REWRITE `src/components/research-v2/corpus-stream.tsx`** — keep the component's public contract (`{ userId, runId, onComplete }`, the `useResearchJobActivity` call at `:54-57`, the `isComplete`/`isError` detection at `:69-79`, the `onComplete` effect). Replace the entire render body (`:86-144`):
- Delete `phaseIcon` (`:20-39`), `formatTimestamp` (`:41-51`), the `Card`/`ScrollArea`/`Skeleton` imports, the emoji rows.
- Render: centered column (keep `min-h-svh px-4`, `max-w-2xl`), a `SectionTitle`-style heading "Researching company…" (Geist, not the old `text-lg`), the one-line subtitle, then `<ActivityRail steps={steps} currentLabel={currentLabel} live={!isComplete && !isError} />` fed from `mapCorpusUpdatesToSteps(allUpdates)`.
- Error: a single `error`-toned step + the `corpusJob?.error` line as a 2px-left-accent `ErrorStateBlock`-style block (no `text-destructive` bare list item, no card).
- Keep the auto-scroll-to-bottom behaviour only if steps overflow; the `ChainOfThought` stack is short, so prefer dropping the `bottomRef` scroll entirely.

**MODIFY `src/components/research-v2/audit-reader-shell.tsx`** — replace the bespoke `LiveActivity` internals with the shared rail:
- Delete `PHASE_ICON` (`:449-457`), `ACTIVITY_TONE_ICON_CLASS` (`:461-467`), `ActivityCountPill` (`:469-483`), `SearchQueryChips` (`:485-509`), `ActivityFeedItem` (`:511-565`).
- Rewrite `LiveActivity` (`:567-639`) to: build the feed via `buildSectionActivityFeed` (unchanged call at `:576-580`), map to steps via `sectionFeedToSteps`, render `<ActivityRail steps={steps} currentLabel={activity.currentLabel} live />`. Drop the `ActivityCountPill` row entirely (`:596-609`) — the "repairs" pill (`:606`) is the jargon leak; counts move into the collapsed summary, not the running rail.
- Keep the initial-skeleton fallback (`:626-636`) ONLY for the zero-steps state, rendered by the shared rail's own empty branch (move the 4-bar skeleton into `ActivityRail` so both surfaces share it).
- At the commit transition: where the shell currently switches `activeStatus === 'running'` → terminal render (`:1660-1691`), the terminal branch for a completed section must render `<CompletedActivitySummary sourceCount={…} toolCount={…} durationLabel={…} />` above the artifact body (the collapse-on-done "after"). Source the counts from `activity.counts` (`toolsFinished`, `subSectionsCommitted`) and the `durationDetail` already computed in `section-activity.ts:318-327`.
- Restore the active/success color split: the shared rail uses `ChainOfThoughtStep` `status` for the active-vs-complete typography; add a `tone`-based icon color so `success` steps render emerald, `active` render primary, `warning` amber, `error` destructive.

**DECISION on `thinking-block.tsx`: DELETE.** It is dead on the research-v2 surface — grep confirms its only consumers are an unrelated `src/components/chat/thinking-block.tsx` (different file, different component) re-exported from `src/components/chat/index.ts`. The research-v2 `thinking-block.tsx` (`src/components/research-v2/thinking-block.tsx`) has **zero importers** in the codebase. Remove the file. Do NOT fold it into the rail — its functionality (per-section collapsible thinking from `useResearchJobActivity`) is superseded by the shell's `LiveActivity` on the canonical fanout path. Note in the kill list: this is an orphan (its `useResearchJobActivity` + `collapseResearchJobUpdates` imports orphan with it; no barrel/registry references it).

**DELETE prototype files after fold-in** (out of this area's hands but list for the kill sweep): `src/app/research-v2/proto-reader/*` once `kit.tsx`'s `LiveActivityRail`/`CompletedActivitySummary`/`PHASE_ICON`/`phaseLabel`/`ActivityStep` are promoted into the real `activity-rail.tsx`.

### Deep modules to extract (simple testable interface) + test recommendations

**Module 1 — `src/lib/research-v2/corpus-activity.ts`** (pure, no React):
```
mapCorpusUpdatesToSteps(updates: CollapsedResearchJobUpdate[]): {
  steps: ActivityStep[];
  currentLabel: string;
}
```
Tests (`__tests__/corpus-activity.test.ts`):
- Each `ResearchJobUpdate['phase']` maps to the expected `ActivityPhase`.
- `heartbeat` updates are dropped (no step emitted).
- Only the last step is `status: 'active'`; all prior are `'complete'`.
- No emoji in any label/detail; no `JSON_HINT` payload leaks (reuse the `assertNoRawLeak` pattern from `section-activity.test.ts:13-18`).
- `error` phase emits exactly one error-toned step.
- Empty input → empty steps + a sensible default `currentLabel`.

**Module 2 — `sectionFeedToSteps(feed: SectionActivityFeed): ActivityStep[]`** in `section-activity.ts` (pure):
Tests (extend `section-activity.test.ts`):
- `ProductPhase` `done` items are dropped; the other six pass through.
- `tone: 'success'` → step tone `success` (NOT `active`); `tone: 'active'` on the last item → `'active'`.
- The repaired label no longer contains the substring `"unsupported"` or `"repair"`.
- Chips survive the mapping.

**Module 3 — `PHASE_ICON` + `phaseLabel` + `ActivityPhase`/`ActivityStep` types** (single source in `activity-rail.tsx` or `activity-rail-types.ts`):
Test: every `ActivityPhase` member has a `PHASE_ICON` entry and a `phaseLabel` case (exhaustiveness — a `Record<ActivityPhase, …>` makes this a compile-time guarantee; add one runtime test asserting no entry is an emoji via `/\p{Emoji}/u`).

**Module 4 — `ActivityRail` / `CompletedActivitySummary` (React, render tests):**
Tests (`__tests__/activity-rail.test.tsx`):
- Renders exactly one `Loader2` (querly `.animate-spin`) and one `Shimmer` when `live`; zero spinners when `!live`.
- No element text contains an emoji (`/\p{Emoji}/u` over `container.textContent`).
- `active` step icon carries `text-primary`; `success` carries an emerald class; `warning` amber; `error` destructive.
- `CompletedActivitySummary` collapsed shows `Researched 14 sources · 6 tools · 1:38`; expands on trigger click.

### Acceptance criteria (checklist; objective + verifiable)

- [ ] `grep -rn` for emoji `🔍🧠💭📄✓⏱✗` across `src/components/research-v2/` and `src/lib/research-v2/` returns **zero** matches.
- [ ] `src/components/research-v2/thinking-block.tsx` is deleted; `grep -rn "research-v2/thinking-block"` returns zero importers; worker/frontend build still green.
- [ ] `phaseIcon(` is defined in **zero** research-v2 files (both copies removed).
- [ ] `corpus-stream.tsx` and the shell's running-state both render `<ActivityRail>` from `src/components/research-v2/activity-rail.tsx` — one component, two call sites (verified by grep).
- [ ] No `Card`/`CardHeader`/`CardTitle` import remains in `corpus-stream.tsx`; no boxed grey-fill (`bg-muted/30 rounded-xl`, `bg-destructive/5 rounded-xl`) in the running/queued/error states of the activity surface — replaced by 2px-left-accent blocks.
- [ ] A running section shows **exactly one** spinning/shimmering motion source (one `Loader2` + one `Shimmer`); no per-item `animate-pulse` icons remain (`grep "animate-pulse"` in the rail returns only motion-reduce-guarded header spinner).
- [ ] In the activity icon color map, `active` resolves to `text-primary` and `success` resolves to an emerald token — they are **not** the same class (regression test asserts the two differ).
- [ ] On section commit, the running rail is replaced by a one-line `Researched N sources · M tools · T` summary that is re-expandable (`CompletedActivitySummary` rendered in the terminal branch); the full read does not show the live timeline.
- [ ] No customer-facing label contains `repair`, `repairs`, `unsupported`, `validation`, or a Zod/JSON fragment (`section-activity.test.ts` raw-leak assertions extended to the new mappers and still pass).
- [ ] All `motion` is reduced-motion safe (`motion-reduce:animate-none` on the spinner; `Shimmer` respects reduced motion — verify the vendored component or wrap it).
- [ ] `mapCorpusUpdatesToSteps` and `sectionFeedToSteps` are pure functions with unit tests; `npm run test:run` green including the new `corpus-activity.test.ts` and extended `section-activity.test.ts` / new `activity-rail.test.tsx`.
- [ ] `npm run build` exits 0; the existing `audit-reader-shell.test.tsx` assertions for `'Preparing context'` (`:425`) and `'Reading sources'` (`:902`) still pass (the unified labels must preserve those customer-safe strings or the tests are updated in the same change with justification).
- [ ] `/research-v3` corpus screen (a `CorpusStream` consumer too) renders identically to `/research-v2` — verified by the shared component, no second code path.

**Verified facts that pin this spec:** Two real phase vocabularies exist and must NOT be conflated at the source — `ProductPhase` (`section-activity.ts:19-26`, fed by `SectionEvent`s) drives the shell `LiveActivity`; `ResearchJobUpdate['phase']` (`research-job-activity-core.ts:44`, fed by `useResearchJobActivity` polling) drives corpus + thinking-block. They unify at the **view-model** layer (`ActivityStep[]`), not the event layer. The shell already imports `buildSectionActivityFeed` and has a working customer-safe feed builder with 18 passing tests — preserve it; this work wraps it in the shared rail rather than rewriting it. `research-v2/thinking-block.tsx` has zero importers and is safe to delete (its name collides with an unrelated `chat/thinking-block.tsx` — do not touch the chat one).


---

# Sources / citations + queued/error/locked states (`sources-states`)

I have everything. Key data facts for the spec:

- `sourceRefSchema` (lab-engine envelope) = `{ id, title, url, publisher?, observedAt }` — **no `whyItMatters`** at the envelope level. `whyItMatters` exists only on specific body sub-schemas (buyer-icp, competitor-landscape) AND on the UI-facing `PositioningArtifactSource` interface (which carries `whyItMatters?`). So `whyItMatters` reaches the reader through `PositioningArtifactSource`, populated upstream — it is optional and frequently absent.
- The body prose has **no inline `[n]` markers** and there is **no claim→`sources[]` index**. `verification.claims[].matchedSourceRef` is `toolResult` (no URL) or `corpusExcerpt` (`sourceUrl` only). So inline `[n]` cannot be reliably tied to verifier-supported claims at the sentence level today. This is the load-bearing scope constraint — I'll spec inline citation as **renderer-derived, source-array-keyed `[n]` markers that the model emits in prose** (opt-in, additive), not a verifier join.

I have enough to write the spec. No more reads needed.

## Sources, Citations & Non-Committed Section States

### Target state

One source/citation system across the Audit Reader, built entirely on the already-vendored `ai-elements` + shadcn primitives, on the LIGHT reading surface:

1. **One sources footer.** A single numbered (`01`/`02`, `tabular-nums`), collapsible end-of-section footer — the proto-reader `SourcesFooter` pattern — replaces BOTH today's divergent source UIs (the shell's inline `<details>` `SourcesList` AND the dead `SourcesPanel` Card). Each entry: `NN` index · title link (foreground, hover→primary underline) · optional `whyItMatters` subline (muted). Collapsed by default; trigger is a `font-mono` `Eyebrow` ("N sources") with a chevron. No Card, no `ScrollArea`, no grey fill.
2. **Inline numbered `[n]` citations** in body prose, rendered via the vendored `inline-citation` (hover-card) primitive, keyed to the section's `sources[]` array by 1-based index. A `[n]` token hover-previews that source (title · url · `whyItMatters`). This is **additive and renderer-derived from model-emitted `[n]` markers in prose** — see the data-dependency note; it is NOT a verifier-claim join.
3. **Quiet non-committed states.** `queued`, `error`, and the capstone `locked`/`ready` panels become 2px-left-accent or single-mono-line blocks (proto `QueuedState` / `ErrorStateBlock` / `LockedState`), matching the rail status vocabulary. No dashed grey boxes, no `rounded-xl bg-muted/30` placeholder cards, no `rounded-xl border-destructive/30 bg-destructive/5` error card.
4. **Offer-Diagnostic error + Paid-Media capstone locked** read with the exact same status color/icon vocabulary as the left rail (`STATUS_META`): `error`→amber/red `AlertTriangle`, `locked`→muted `Lock`. The Paid-Media terminal panel sheds its nested grey cards.

All of this consumes the existing `PositioningTypedArtifact` (`sources: PositioningArtifactSource[]`, optional `verification`). No schema change required; the inline-`[n]` capability degrades to nothing when the model emits no markers.

### Current slop to remove (cite file:line)

**Divergent / dead source UIs:**
- `src/components/research-v2/sources-panel.tsx:30-81` — entire `SourcesPanel`. Dead (zero importers besides itself, confirmed by grep). A `Card` + `CardHeader` + `CardTitle` + `ScrollArea` source list that imports `Source` from `@/components/ai/sources`. Slop: `rounded-md hover:bg-muted/60` row fills (`:57`), arbitrary `text-[10px]`/`text-[11px]` half-scale sizes (`:63,:67`), `BookText` chrome icon, dual "Sources / N" header. **Delete the file.**
- `src/components/ai/sources.tsx` — legacy duplicate of the vendored `ai-elements/sources.tsx`, only consumed by the dead `SourcesPanel`. Includes a `SourcesDemo` default export (`:56-75`). **Delete the file** once `SourcesPanel` is gone (verify no other importer at execution time).
- `src/components/research-v2/audit-reader-shell.tsx:403-441` — the live `SourcesList`. Functionally close to target but: built on a raw `<details>/<summary>` instead of the vendored `Collapsible`; uses `ArrowUpRight` (wrong glyph — should be a chevron) at `:412`; label is `uppercase tracking-[0.12em]` (`:411`) not the locked mono `0.06em` `Eyebrow`; numbering is plain `tabular-nums` muted, acceptable but should route through the shared `Eyebrow`/footer module. **Replace with the shared `SourcesFooter` module.**

**Boxed/dashed grey non-committed states (T1 violations):**
- `audit-reader-shell.tsx:641-650` — `QueuedPlaceholder`: `rounded-xl border-dashed border-border bg-muted/30 px-6 py-10 text-center`. Replace with proto `QueuedState` (2px dashed left accent, left-aligned, no fill).
- `audit-reader-shell.tsx:652-684` — `ErrorState`: `rounded-xl border-destructive/30 bg-destructive/5 px-6 py-8`. Replace with proto `ErrorStateBlock` shape (2px solid red-500 left accent, no fill).
- `audit-reader-shell.tsx:714-720` — `TypedArtifactErrorBoundary` fallback: `rounded-lg border-border bg-muted/40 p-4`. Re-skin to the same quiet left-accent error idiom.
- `audit-reader-shell.tsx:814-846` — `PaidMediaPlanSubSectionChecklist`: `rounded-lg border-border bg-muted/30`. De-card to a borderless mono-keyed list.
- `audit-reader-shell.tsx:848-892` — `PaidMediaPlanTerminalPanel`: nested `rounded-xl border-border bg-muted/30` card wrapping a `LockKeyhole` heading. Replace the lock framing with the proto `LockedState` 2px-left-accent line; render the committed artifact body directly (no grey card box).
- `audit-reader-shell.tsx:392-401` — `VerdictCard`: `rounded-xl border-border bg-muted/50` grey card. (Owned by the verdict area, but it's the same grey-card slop class — flag for the verdict/body agent; do not let the new sources/states reintroduce that container shape.)

**Citation gap:**
- `src/components/ai-elements/inline-citation.tsx` — fully vendored, **zero importers** (confirmed). Body prose currently renders as plain `BodyProse` strings with no inline citation affordance anywhere in `audit-reader-shell.tsx`. **Wire it in** (scoped per data-dependency note).

**Status-vocabulary divergence:**
- `audit-reader-shell.tsx:322-370` `SectionStatusIcon` and the proto `STATUS_META` (kit.tsx:62-71) are two separate status→icon/color maps. The error/locked states render through `SectionStatusIcon` in the rail but through ad-hoc inline JSX in the body. Both must read one shared `STATUS_META`-style map so the offer-diagnostic body error and the rail icon for the same section never disagree on color/glyph.

### Precise changes (file-by-file)

**CREATE `src/components/research-v2/reader-sources.tsx`** (new shared module — the one source/citation system):

- `export interface ReaderSource { n: number; title: string; url: string; whyItMatters?: string }` — the reader-facing, already-numbered source shape.
- `export function toReaderSources(sources: PositioningArtifactSource[]): ReaderSource[]` — pure mapper: assign `n = index + 1`, carry `title`, `url`, `whyItMatters`. (Dedup is out of scope here — `pickPositioningTypedArtifact` already filters; do not re-dedup or you'll renumber under the inline `[n]` indices.)
- `export function SourcesFooter({ sources }: { sources: ReaderSource[] })` — port proto kit.tsx:440-470 verbatim in structure, but built on the vendored `Collapsible/CollapsibleTrigger/CollapsibleContent` (already what proto uses). Trigger = chevron + `Eyebrow` "{n} sources"; content = `<ol>` of `NN` (`String(n).padStart(2,'0')`, `font-mono tabular-nums text-muted-foreground/70`) · title `<a>` (foreground → hover primary underline) · optional `whyItMatters` muted subline. Returns `null` for empty. Collapsed default.
- `export function Cite({ source }: { source: ReaderSource })` — the inline `[n]` token. Use the vendored `inline-citation` primitives (`InlineCitationCard` = hover-card wrapper, `InlineCitationCardBody`, `InlineCitationSource`) so we stay on vendored code, OR the lighter proto `Cite` (kit.tsx:163-180) which uses `HoverCard` directly. **Decision: use the proto `Cite` shape** (a `<sup>` `[n]` token with `bg-primary/10 text-primary font-mono tabular-nums` + a `HoverCardContent` showing title · mono url · `whyItMatters`). Rationale: the vendored `InlineCitationCardTrigger` renders a hostname Badge, not a numbered `[n]` — it fights the locked "numbered [n]" direction. We keep it ON the same `@/components/ui/hover-card` primitive the vendored file uses, so "zero new installs" holds. Mark a code comment pointing at `inline-citation.tsx` as the sibling vendored option.
- `export function renderProseWithCitations(text: string, sources: ReaderSource[]): ReactNode` — splits a prose string on `[n]` / `[n, m]` markers (regex `/\[(\d+(?:\s*,\s*\d+)*)\]/g`), replaces each with one or more `<Cite>` for the referenced 1-based indices that exist in `sources`; out-of-range indices render as literal text (no crash). When `sources` is empty or the string has no markers, returns the raw string unchanged. This is the ONLY citation entry point; body renderers call it instead of rendering prose strings directly.

**EDIT `src/components/research-v2/audit-reader-shell.tsx`:**
- Remove the local `SourcesList` (`:403-441`). Replace the call site `:1658` `<SourcesList sources={activeTyped.sources} />` with `<SourcesFooter sources={toReaderSources(activeTyped.sources)} />`, importing both from the new module.
- Replace `QueuedPlaceholder` (`:641-650`) body with the proto `QueuedState` markup (2px dashed left accent, `border-l-2 border-dashed border-border pl-4`, left-aligned muted text, no fill, no center).
- Replace `ErrorState` (`:652-684`) container with the proto `ErrorStateBlock` shape: `border-l-2 border-red-500 pl-4`, `AlertTriangle` + `text-red-600` heading, muted body, outlined (not filled) rerun `Button`. Keep the existing `onRerun`/`pending` props and the aborted-vs-error copy switch (`:665`) — do not lose the `'aborted'` branch.
- Replace the `TypedArtifactErrorBoundary` fallback (`:714-720`) grey card with a quiet `border-l-2 border-amber-500 pl-4` line ("Section body could not render.").
- `PaidMediaPlanSubSectionChecklist` (`:814-846`): drop the `rounded-lg border bg-muted/30` wrapper; render rows as a borderless list — label (muted) + status (`Committed`/`Queued`) as a `font-mono text-[10px] uppercase tracking-[0.06em]` token. Keep the `data-testid="sub-section-status-..."` exactly (`:836`) — it's a test contract.
- `PaidMediaPlanTerminalPanel` (`:848-892`): remove both grey card boxes. Render the `LockedState` line (proto) for the locked/ready summary, then the committed `TypedArtifactRenderer` body directly. The `statusText`/`statusSummary` becomes the `LockedState` text. Preserve the `PaidMediaPlanSubSectionChecklist` call and the `TypedArtifactErrorBoundary` wrap.
- Unify status vocabulary: import a shared `STATUS_META` map (see card-taxonomy change below) and have the body error/locked blocks pull icon+color from it, so they match `SectionStatusIcon`. Minimum: error body uses the same red/`AlertTriangle`, locked body uses the same muted `Lock` glyph as the rail. (Do not silently change the rail's `LockKeyhole` vs body `Lock` — pick ONE Lucide lock glyph across both; recommend `Lock` to match the proto.)
- Wire inline citations: in the committed-section render path, the body sub-section prose must flow through `renderProseWithCitations`. Since prose is rendered by `TypedArtifactRenderer`/`GenericTypedArtifactRenderer` (not the shell directly), the actual wiring lands in the typed-renderer area (coordinate with that agent). The shell's responsibility: pass `toReaderSources(activeTyped.sources)` down as the citation source-of-truth (via prop or context) so inline `[n]` and the footer share ONE numbered array. **Add a `ReaderSourcesContext` (or a `sources` prop) in this module and provide it around the body render at `:1633-1656`.**

**EDIT `src/components/ai/sources.tsx` + `src/components/research-v2/sources-panel.tsx`:** delete both files (after confirming `SourcesPanel` and `@/components/ai/sources` have no importers — already verified zero at spec time; re-verify in execution).

**KEEP:** `src/components/ai-elements/sources.tsx` (vendored, the canonical low-level primitive — even though the new `SourcesFooter` renders its own `<ol>`, leave the vendored file in place; it is the "no new install" budget and may be used by the footer's `Source` link if the executor prefers). `src/components/ai-elements/inline-citation.tsx` — keep, now actually imported via the `Cite` sibling note (or directly if the executor chooses the vendored trigger).

### Deep modules to extract (simple testable interface) + test recommendations

1. **`toReaderSources(sources: PositioningArtifactSource[]): ReaderSource[]`** — pure, no React.
   - Tests: empty→`[]`; 3 sources→`n` is `1,2,3`; carries `whyItMatters` when present and omits when absent; preserves input order (no re-sort, no re-dedup).

2. **`parseCitationMarkers(text: string): Array<{ kind: 'text'; value: string } | { kind: 'cite'; indices: number[] }>`** — the regex tokenizer behind `renderProseWithCitations`, extracted so it's testable without rendering.
   - Tests: `"foo"`→one text token; `"foo [1] bar"`→text/cite([1])/text; `"x [1, 3] y"`→cite indices `[1,3]`; `"[2][5]"`→two adjacent cite tokens; `"price was $4[1]m"` boundary handling; a literal `"[abc]"`→stays text (non-numeric); empty string→`[]`.

3. **`renderProseWithCitations(text, sources): ReactNode`** — thin renderer over (1)+(2).
   - Tests (RTL): a `[1]` marker with a matching source renders a `[n]` `<sup>` whose hover-card shows the source title; an out-of-range `[9]` with only 2 sources renders the literal text `[9]` (no crash, no empty hover-card); empty `sources` renders prose verbatim with markers stripped-or-literal (pick literal — document it); reduced-motion: no animation assertions needed but ensure `HoverCard` open/close works.

4. **`SourcesFooter` (component)** — RTL render tests:
   - empty sources → renders nothing (`container.firstChild === null`);
   - N sources → trigger shows "N sources", collapsed by default (list not in DOM or `aria-hidden`);
   - after click → `NN` zero-padded indices visible, links have `target="_blank" rel="noreferrer"`, `whyItMatters` subline present only when set.

5. **`statusBlockMeta(status): { Icon, colorClass, label }`** (shared map, see below) — pure lookup.
   - Tests: `error`/`aborted`/`locked`/`ready`/`queued`/`running`/`complete` each map to the expected Lucide icon name and a semantic color token; one round-trip test that the rail icon and the body block read the SAME entry (guards the "offer-diagnostic error matches rail" acceptance criterion).

**Where the shared status map lives:** add `STATUS_META` (or `READER_STATUS_META`) to `src/lib/workspace/card-taxonomy.ts` (the canonical card taxonomy per CLAUDE.md Key Files) OR co-locate in `reader-sections.tsx` next to `READER_SECTION_LABELS`. Recommend `reader-sections.tsx` since the statuses are reader-specific (`ready`/`locked` are reader concepts, not worker statuses). Both `SectionStatusIcon` (rail) and the body error/locked blocks import from it.

### Data dependency (must call out in the PRD — load-bearing)

- **Inline `[n]` cannot be tied to verifier-supported claims today.** `verification.claims[].matchedSourceRef` (artifact-envelope.ts:122-155) is a discriminated union of `toolResult` (`toolName`/`stepIndex`, no URL) and `corpusExcerpt` (`excerptIndex`/`sourceUrl`). It does **not** carry an index into the artifact's `sources[]` array, and body prose has **no per-sentence claim IDs**. There is therefore no reliable join from a sentence to a verified source.
- **Consequence / scope:** inline `[n]` citations are **renderer-derived from `[n]` markers the model writes into prose**, keyed by 1-based position in `sources[]`. This is additive and degrades gracefully (no markers → no citations; existing committed artifacts are unaffected). Do **not** spec a verifier→sources join in this phase; it would require a schema change (adding `sources[].claimIds` or `claims[].sourceIndex`) that is out of scope for the UI overhaul.
- **`whyItMatters` is optional and often absent.** It is NOT on the lab-engine `sourceRefSchema` (`{ id, title, url, publisher?, observedAt }`, artifact-envelope.ts:10-18); it reaches the UI only via the `PositioningArtifactSource` interface (`whyItMatters?`), populated upstream. The footer and hover-card must render cleanly when it is missing (already handled by the optional-chaining in proto `SourcesFooter`/`Cite`).
- **Verified/flagged rollup is unchanged** and stays owned by the run-status/verdict area (`verificationRollup`, audit-reader-shell.tsx:1349-1359). The sources/citation work does not read or write it; the only coupling is that a future verifier→source join would let `[n]` carry a verified/flagged dot — note as a follow-up, not this phase.

### Acceptance criteria (checklist)

- [ ] `src/components/research-v2/sources-panel.tsx` and `src/components/ai/sources.tsx` are deleted; `grep -rn "SourcesPanel\|@/components/ai/sources" src` returns zero hits; `npm run build` passes.
- [ ] Exactly ONE source footer component (`SourcesFooter`) is rendered in the reader; the old `<details>`-based `SourcesList` is gone from `audit-reader-shell.tsx`.
- [ ] The sources footer: collapsed by default; trigger is a chevron + mono `Eyebrow` "{N} sources"; entries show zero-padded `NN` (`tabular-nums`), a foreground title link (`target="_blank" rel="noreferrer"`, hover→primary underline), and a muted `whyItMatters` subline only when present. No `Card`, no `ScrollArea`, no `rounded-md` row fill, no `bg-muted` hover fill.
- [ ] Inline `[n]` citations render in committed-section body prose: a `[n]` token (`<sup>`, `font-mono tabular-nums`, `text-primary`, `bg-primary/10`) whose hover-card shows the matching source title · mono url · optional `whyItMatters`. Out-of-range and non-numeric markers do not crash and fall back to literal text.
- [ ] Inline `[n]` and the footer reference the SAME numbered array (`toReaderSources` output) — index `[3]` in prose links to footer row `03`.
- [ ] Vendored `inline-citation.tsx` (or `@/components/ui/hover-card`) and `Collapsible` are the only primitives used; no new dependency added to `package.json`.
- [ ] `queued` state = 2px dashed left-accent line, left-aligned, no grey fill, no centered box.
- [ ] `error`/`aborted` state = 2px solid red left-accent block, no `bg-destructive/5` fill; rerun button is outlined; aborted-vs-error copy preserved; `onRerun`/`pending` behavior unchanged.
- [ ] Offer-Diagnostic `error` body and the left-rail icon for that section use the SAME shared status map (same Lucide glyph + same semantic color); they cannot visually disagree.
- [ ] Paid-Media `locked`/`ready` capstone renders as a 2px-left-accent `LockedState` line (one Lucide lock glyph shared with the rail) — no nested `rounded-xl bg-muted/30` cards; the committed body renders directly; `data-testid="sub-section-status-..."` test ids preserved verbatim.
- [ ] `TypedArtifactErrorBoundary` fallback is a quiet left-accent line, not a grey card.
- [ ] All numbers use `tabular-nums`; all icons are Lucide (no emoji); body text and source titles are `text-foreground`, sublines `text-muted-foreground`.
- [ ] Unit tests exist and pass for `toReaderSources`, `parseCitationMarkers`, `renderProseWithCitations`, `SourcesFooter` (empty/collapsed/expanded), and the shared status-map round-trip (rail == body).
- [ ] No arbitrary half-pixel `text-[Npx]` sizes introduced in the new/edited source & state components (named scale only); reduced-motion: hover-card and collapsible respect `motion-reduce`.
- [ ] `npm run test:run` and `npm run build` both pass; `npm run lint` clean for the touched files.

