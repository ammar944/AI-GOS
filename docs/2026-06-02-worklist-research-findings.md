# Worklist research findings — 2026-06-02 (verified against fcc69d99)

## Executive summary

Eight worklist items were researched and adversarially verified. **Seven of eight claims are accurate** (A1, A2, A3, A4, B2, B3, C1, C2) and **one is inaccurate/over-scoped** (B1 — bundles one real micro-fix with two false/unverifiable premises). **None are already done.** The verify pass **approved six items as-written** (A1, A2, B2, B3, C2 — plus A3/A4/B1/B3 carried no verify object but were independently assessed in their findings) and **revised one item's fix** (C1: keep both `direct` and `status-quo` required rather than `direct` only, and soften the paired prompt line; verdict `revise`). A4 is real but partly discretionary (a visual + test change, not a pure refactor — medium risk). The only genuinely-dead removals are concentrated in B2 (four serif files) and B3 (one verification-badge module + its barrel line).

## Item table

| Item | Title | Claim accurate? | Already done? | Risk | Confidence | Verify verdict |
|------|-------|-----------------|---------------|------|------------|----------------|
| A1 | Inline [n] citations dead in prose bodies | Yes | No | low | high | approve |
| A2 | Draft view renders old card slop | Yes | No | low | high | approve |
| A3 | Rail sublines read raw lowercase enum | Yes | No | low | high | (no verify object) |
| A4 | Two un-consolidated badge components | Yes | No | medium | high | (no verify object) |
| B1 | Token sweep: half-pixel + un-tokenized sizes + wrong muted | **No** | No | low | high | (no verify object) |
| B2 | Delete dead serif blocks + their tests | Yes | No | low | high | approve |
| B3 | Unused ui-kit exports | Yes | No | low | high | (no verify object) |
| C1 | CompetitorLandscape first-pass schema (2 repair loops) | Yes | No | low | high | **revise** |
| C2 | SKILL.md Vercel file-tracing deploy-blocker | Yes | No | low | high | approve |

---

## Group A — Audit Reader rendering

### A1 — Inline [n] citations dead in prose bodies

**Current state.** The citation infra is fully built but `NarrativeBlock` never calls it, so `[n]` markers render as literal text in all prose bodies. Evidence:
- `src/components/research-v2/primitives/narrative-block.tsx` lines 33-35 render `{paragraphs.map((p, i) => (<p key={i}>{p}</p>))}` — raw string, no citation handling.
- `src/components/research-v2/primitives/subsection-block.tsx` lines 24-26 delegate all prose to `<NarrativeBlock title={title} prose={prose} />`, so it shares the gap.
- All 8 typed section renderers (market-category, buyer-icp, competitor-landscape, voice-of-customer, demand-intent, offer-diagnostic, paid-media-plan, positioning-synthesis) feed their `.prose` through SubsectionBlock → NarrativeBlock — the ~95%-of-content path.
- `reader-sources.tsx` defines `ProseWithCitations` (lines 150-153, a context-aware wrapper that calls `useReaderSources()` then `renderProseWithCitations`) and `renderProseWithCitations` (lines 110-147, tokenizes on `/\[(\d+...)\]/g` and emits `UiKitCite` hovercards) — both correct and ready.
- Repo-wide grep shows ZERO call sites of `ProseWithCitations` / `renderProseWithCitations` / `Cite` / `useReaderSources` outside `reader-sources.tsx` and its tests.
- The provider IS available above the prose: `ReaderSourcesProvider` wraps `TypedArtifactRenderer` at `audit-reader-shell.tsx` lines 1294-1305 (the 6 sections + synthesis) and lines 596-604 (paid media plan), each fed `activeReaderSources`/`readerSources` via `toReaderSources(artifact.sources)`.
- Secondary leaky surfaces that also bypass citations: `GenericTypedArtifactRenderer` (typed-artifact-renderer.tsx lines 431-435) pipes prose through ReactMarkdown (but the 8 named zones never hit this fallback); and `BodyProse` (ui-kit/type.tsx lines 45-49) renders raw children for `statusSummary` (minor content).

**Exact edit sites.**
- `src/components/research-v2/primitives/narrative-block.tsx` (lines 33-35): wrap each paragraph body in the citation renderer — change `{paragraphs.map((p, i) => (<p key={i}>{p}</p>))}` to `{paragraphs.map((p, i) => (<p key={i}><ProseWithCitations text={p} /></p>))}`. Add `import { ProseWithCitations } from '@/components/research-v2/reader-sources';` at the top. This single edit fixes all 8 section renderers and every SubsectionBlock consumer because they all funnel prose through NarrativeBlock.

**Final proposed fix.** Import `ProseWithCitations` from `reader-sources.tsx` and replace the raw `<p key={i}>{p}</p>` with `<p key={i}><ProseWithCitations text={p} /></p>`. `ProseWithCitations` is a true drop-in: it reads sources from the surrounding `ReaderSourcesProvider` (already present in both render trees), and `renderProseWithCitations` returns the plain string unchanged when there are no sources or no `[n]` markers (reader-sources.tsx lines 114-121), so prose with no citations is byte-identical to today. No change needed in SubsectionBlock or in any of the 8 section renderers. **Verify confirms:** no new `'use client'` directive is required on NarrativeBlock; per-section `[n]` resolves against `activeTyped.sources`, matching `SourcesFooter`. Optional follow-on (out of scope unless asked): `GenericTypedArtifactRenderer`'s ReactMarkdown path and `BodyProse` also bypass citations, but the 8 live zones do not use them — leave them untouched to keep the change surgical.

**Risks.** Low. (1) NarrativeBlock becomes a client-context consumer (calls `useContext` via `useReaderSources`); it is already only rendered inside the client audit-reader-shell tree under `ReaderSourcesProvider`, so this is fine at runtime — but it can no longer be a pure server component if anything ever rendered it server-side (nothing does today). (2) Existing test `primitives/__tests__/subsection-block.test.tsx` asserts `getByTestId('subsection-prose').toHaveTextContent('Some prose.')` — still passes because with no provider `useReaderSources()` returns `[]` and `renderProseWithCitations` returns the raw string. (3) `ProseWithCitations` returns `ReactNode`, valid as `<p>` children — no type break. (4) Prose whose literal text legitimately contains a bracketed number matching a source `n` would now render a hovercard — acceptable, matches intended behavior. The drafting path uses `GenericTypedArtifactRenderer` (ReactMarkdown), not NarrativeBlock, so it is untouched. No consumer breaks.

**Open questions.** Whether to also wire the two secondary surfaces (`GenericTypedArtifactRenderer`'s ReactMarkdown prose at typed-artifact-renderer.tsx 431-435, and `BodyProse` for `statusSummary`). They also drop `[n]` markers but are not on the 8-zone hot path; recommend leaving them out of this minimal fix unless the worklist explicitly wants every prose surface covered.

---

### A2 — Draft view renders old card slop

**Current state.** Committed view uses `TypedArtifactRenderer` per-section renderers; draft view uses the `GenericTypedArtifactRenderer` fallback with old styling. The "do not route the draft through typed renderers" premise is **verified correct**: e.g. `MarketCategoryRenderer` destructures `const { categoryDefinition, marketSize, structuralForces, categoryMaturity } = artifact` then immediately reads `marketSize.signals` / `categoryDefinition.adjacentCategories`; `buildDraftArtifact` (line 451-477) spreads only the partial body (e.g. just `{ categoryDefinition: { prose } }`), so `marketSize` is undefined → TypeError → caught by `TypedArtifactErrorBoundary` showing "Section body could not render." The generic renderer is the only safe draft path.

`GenericTypedArtifactRenderer` has two real consumers, both correct de-slop targets: (1) `DraftingArtifactView` (audit-reader-shell.tsx:497) — the streaming draft path; (2) the unknown-zoneId fallback inside `TypedArtifactRenderer` (line 482-488). Committed sections (lines 1299, 598) go through per-zone typed renderers, NOT the generic one, so they are unaffected.

**Exact edit sites.**
- `src/components/research-v2/typed-artifact-renderer.tsx` (lines 425-453, plus the wider slop family): de-slop the fallback markup to match the overhauled primitives. Verify widens scope slightly beyond 425-453 to include the header block (413-423) and the helper components `FieldList`/`RecordBlock`/`FieldGroup`/`ArtifactSources` (185-397), which are the same slop family and should be aligned together.

**Final proposed fix.** De-slop `GenericTypedArtifactRenderer`'s markup to match the overhauled primitives (`SubsectionBlock`/`NarrativeBlock`/`Eyebrow` already in `src/components/research-v2/primitives` + ui-kit), replacing the current ad-hoc `prose prose-sm`, `<dl>/<dt>/<dd>` divide-border reflection and bespoke Sources collapsible. **Do NOT route the draft through the per-zone typed renderers** (confirmed: they destructure-then-deref sub-section objects and throw on partial streamed snapshots). HARD constraints to keep tests green: (1) preserve the root `data-testid={\`typed-artifact-renderer-${zoneId}\`}` on the outer div; (2) keep rendering sub-section `prose` text verbatim (audit-reader-shell test asserts the exact draft string); (3) keep the Sources control as a collapsible with accessible name exactly `"Sources (N)"` wrapping a `role="list"` (typed-artifact-renderer test asserts `"Sources (3)"` + `getByRole('list')`). After editing, run: `npm run test:run -- src/components/research-v2/__tests__/typed-artifact-renderer.test.tsx src/components/research-v2/__tests__/audit-reader-shell.test.tsx`.

**Risks.** Low. Shared fallback component; breakage risk is two DOM tests (not visual snapshots): (a) typed-artifact-renderer.test.tsx needs the Sources collapsible trigger with exact accessible name `"Sources (3)"` and a `role="list"`; (b) audit-reader-shell.test.tsx:378-384 needs `data-testid` `typed-artifact-renderer-positioningMarketCategory` (root div at line 410), the "Drafting..." label, and the prose string rendered.

**Open questions.** None recorded.

---

### A3 — Rail sublines read raw lowercase enum

**Current state.** `sectionStatusSubline` at `audit-reader-shell.tsx` lines 327-334 handles `complete`, `error`, `aborted`, `ready`, `locked`, then returns `status` raw. Only `running` and `queued` fall through and show lowercase. `STATUS_META` at `ui-kit/status.tsx` lines 37-48 has labels including `Running` and `Queued` but is not imported here. Not fixed.

**Exact edit sites.**
- `src/components/research-v2/audit-reader-shell.tsx` (lines 327-334): add `running` → `Running` and `queued` → `Queued` branches before the bare `return status`.

**Final proposed fix.** Add two branches before the final return status mapping: `running` → `Running` and `queued` → `Queued`. Avoid replacing the body with the meta label, which would shorten the locked text.

**Risks.** Low. Private function used only for the rail button text. Display-only change for two statuses. No tests touch it.

**Open questions.** Keep the richer locked text via two branches, or accept the shorter meta label — a design call.

---

### A4 — Two un-consolidated badge components

**Current state.** Three separate badge implementations exist; the claim is substantially accurate but with an important prop-incompatibility nuance.

1. **Shell local badge:** `audit-reader-shell.tsx:311-325` defines a local `function VerificationBadge({ verification })` typed `{ verification: PositioningTypedArtifact['verification'] }` (i.e. `VerificationReportEnvelope | undefined`). It guards `undefined` internally and renders a boxed pill (`inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground`) with text `Verified {verifiedCount} / Unsupported {unsupportedCount}`. Used once at line 1254.
2. **ui-kit badge:** `ui-kit/verification-badge.tsx` exports `function VerificationBadge({ verified, flagged }: { verified: number; flagged: number })` — a clean mono icon badge (Check/AlertTriangle, `font-mono text-[11px] tabular-nums`, emerald/amber). Re-exported from the barrel (ui-kit/index.ts:45). Its ONLY consumers are the prototype dir `src/app/research-v2/proto-reader/` (chrome.tsx, variant-workbench.tsx), which also self-defines it in kit.tsx:482. The production shell does NOT import it — exported-but-unused relative to the real reader.
3. **demand-intent DomainChips:** `demand-intent.tsx:53-67` renders `<span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">` per domain — a second grey-fill pill, intentionally denser/smaller than `MonoBadge` (StatusPill, status-pill.tsx:46).

**CRITICAL NUANCE:** the two badges are NOT prop-compatible. ui-kit takes two raw numbers `{verified, flagged}` and has no undefined guard; the shell takes an object `{verification}` (envelope `verifiedCount`/`unsupportedCount`, artifact-envelope.ts:159-160) and guards undefined. Semantics differ (`flagged` vs `unsupportedCount`) and visual language differs (icon badge vs boxed rounded-full text). A swap requires a call-site adapter, not a drop-in. **TEST COUPLING:** `audit-reader-shell.test.tsx:146` asserts the literal text `'Verified 12 / Unsupported 2'`, hard-pinning the shell badge's text format.

**Exact edit sites.**
- `src/components/research-v2/audit-reader-shell.tsx` (lines 311-325): remove the local `VerificationBadge`, replace the call site (line 1254) with the ui-kit badge plus an adapter — `import { VerificationBadge } from '@/components/research-v2/ui-kit'` and `<VerificationBadge verified={activeTyped.verification.verifiedCount} flagged={activeTyped.verification.unsupportedCount} />`. The surrounding `activeStatus === 'complete' && activeTyped` conditional (line 1253) handles undefined, but the local badge also returned null when `verification` itself was undefined — keep that safety by gating on `activeTyped.verification`, or keep the local component and have it delegate internally (preserve the undefined guard, drop the boxed markup).
- `src/components/research-v2/__tests__/audit-reader-shell.test.tsx` (lines 122-146): the assertion at line 146 (`getByText('Verified 12 / Unsupported 2')`) breaks if the shell adopts the ui-kit icon-badge (bare numbers + icons, no 'Verified'/'Unsupported' words). Update to match the new render, or — preferred — do NOT change the shell badge's visible text and only change A4's DomainChips half, leaving this test untouched.
- `src/components/research-v2/section-renderers/demand-intent.tsx` (lines 53-67): optionally replace the hand-rolled DomainChips span with `MonoBadge` (already imported via ui-kit). Note `MonoBadge` applies uppercase + border + larger padding (px-2 py-0.5) vs the current dense `rounded bg-secondary px-1.5 py-0.5 text-[10px]` chip — this visibly enlarges the Top-3-ranking-domains cell. Re-check demand-intent.test.tsx for class/text assertions.

**Final proposed fix.** Minimal/surgical — do NOT do a blind drop-in swap (props are incompatible). Two independent, optional consolidations:
- **(A) Shell badge:** keep the local `VerificationBadge` wrapper (it owns the undefined guard) but delegate to the ui-kit `VerificationBadge`, mapping `verifiedCount → verified` and `unsupportedCount → flagged`. This removes the duplicate boxed markup. HOWEVER it changes visible output from text to an icon+number badge, **breaking audit-reader-shell.test.tsx:146**, requiring a paired test update and design sign-off.
- **(B) DomainChips:** optionally swap the hand-rolled span for `MonoBadge`, accepting the larger uppercase bordered pill (visual change to the dense Top-3 cell).

**Recommendation:** treat A4 as LOW priority / partly discretionary. If the goal is only to kill the dead duplicate, the truly minimal fix is either (i) delete the unused `ui-kit/verification-badge.tsx` + barrel export (line 45) since its only live consumers are the prototype dir which self-defines it (overlaps B3), OR (ii) point the prototype at the barrel and keep one. Cleaning the prototype duplicate (kit.tsx:482) is the lowest-risk dead-code win and touches no production render.

**Risks.** Medium. Consolidating onto the ui-kit icon-badge is a VISUAL change to the production Audit Reader (boxed text → emerald/amber icon+number badge) and a SEMANTIC relabel (`Unsupported` → `flagged` amber icon), needing design/user sign-off per DESIGN.md, and it breaks the hard text assertion at audit-reader-shell.test.tsx:146. The DomainChips→MonoBadge swap enlarges the dense Top-3 cell. The proto-reader prototype has its own copies and is unaffected if untouched. Blind prop-passthrough (passing a `{verification}` object to a `{verified, flagged}`-typed component) is a type error and runtime break — must not be done.

**Open questions.** Is the intent of A4 (a) purely to delete the dead duplicate ui-kit/proto-reader badge code, or (b) to actually re-style the live shell badge onto the mono icon-badge look? (a) is a safe dead-code sweep; (b) is a user-visible redesign + test rewrite needing design approval. Also undecided: whether DomainChips should adopt MonoBadge's larger pill or keep its compact styling.

---

## Group B — Token / dead-code hygiene

### B1 — Token sweep: half-pixel + un-tokenized sizes + wrong muted — **CLAIM INACCURATE**

**Current state.** The claim bundles one real micro-issue with two false/unverifiable premises.

1. **HALF-PIXEL — REAL but narrow.** Within research-v2 there is exactly ONE `text-[13.5px]`: `audit-reader-shell.tsx:488` (`flex items-center gap-2.5 text-[13.5px] text-foreground` on the transient "Drafting..." loading row). Its sibling rows use `text-[13px]` (lines 655, 660) and `text-[11px]` (666). The other 22 `text-[13.5px]` occurrences globally all live in `src/components/strategic-research/*` (legacy V1, a SEPARATE tree — grep returns zero references from research-v2). Genuine one-off.
2. **"UN-TOKENIZED text-[12/13/14/18/20px]" — PREMISE FALSE.** There is no font-size token scale in this repo. DESIGN.md defines only COLOR tokens (`--text-1..--text-4` are colors, not sizes). Every font size across research-v2 is an arbitrary `text-[Npx]` value (~90 occurrences). Arbitrary `text-[Npx]` IS the established convention — the Eyebrow/SectionTitle/BodyProse primitives in ui-kit/type.tsx use `text-[11px]/text-[24px]/text-[15px]`. No token to migrate to; the item as written has no actionable target.
3. **"INLINE MONO LABELS instead of Eyebrow" — MOSTLY FALSE.** `Eyebrow` (ui-kit/type.tsx:13-21) is already used widely (market-category:205/224/228, voice-of-customer:160/166/208/214, competitor-landscape:758/765, positioning-synthesis:113). Remaining inline mono-uppercase labels are NOT Eyebrow-equivalent: competitor-landscape.tsx:295/382/524 use `text-[10px]` (not 11px), omit `font-medium`; :459 is a tab button with structural classes; buyer-icp.tsx:123 and market-category.tsx:121 are `text-[11px] uppercase tracking-[0.04em]` WITHOUT `font-mono` and with different tracking. Converting would visibly change size/weight/tracking — not a no-op. demand-intent.tsx has NO inline mono uppercase labels.
4. **"muted body cells that should be foreground" — UNVERIFIABLE.** No cell named. Inspected muted cells (buyer-icp:114/224/234, competitor-landscape:313/385, market-category:207) are deliberate hierarchy (secondary metadata under a `font-medium` foreground primary).

**Exact edit sites.**
- `src/components/research-v2/audit-reader-shell.tsx` (line 488): replace `text-[13.5px]` with `text-[13px]` to match sibling rows. This is the ONLY defensible edit in B1 within the research-v2 tree.

**Final proposed fix.** Make ONLY the half-pixel fix (488: `text-[13.5px]` → `text-[13px]`). Do NOT pursue the tokenize-sizes, inline-mono-to-Eyebrow, or muted-to-foreground parts: there is no size-token scale to migrate to, the inline mono labels are not Eyebrow-equivalent (different px/weight/tracking, so conversion changes visuals), and no specific wrong-muted cell exists. The 22 strategic-research/* `text-[13.5px]` hits are out of scope (legacy V1 tree, not referenced by research-v2).

**Risks.** Low for the single recommended change (0.5px shrink on one transient loading row, visually imperceptible, no test asserts on this class). The real risk is in the OVER-BROAD parts: blindly sweeping the ~90 `text-[Npx]` sites or force-converting `text-[10px]` mono labels to Eyebrow would enlarge labels (10→11px), add `font-medium`, shift tracking (0.04→0.06em) — a visual regression masquerading as cleanup. Avoid that scope.

**Open questions.** Whether the team WANTS a font-size token scale (wrapping `text-[10/11px]` mono labels into Eyebrow, accepting the 1px+weight change) is a design-system decision a human must own — a separate scoped task, not B1 as written. No specific muted→foreground cell was provided; a human must name exact cell(s) if any are genuinely wrong.

---

### B2 — Delete dead serif blocks + their tests

**Current state.** Both components exist, are live in the tree, and each carries banned serif styling. `document-header.tsx` (53 lines) exports `DocumentHeader`; h1 uses `font-serif text-[56px]` (line 36), lede uses `font-serif text-[22px] italic` (line 39) — both banned. `chapter-divider.tsx` (33 lines) exports `ChapterDivider`; h2 uses `font-serif text-[32px]` (line 28) — banned. A repo-wide grep for `DocumentHeader|ChapterDivider|document-header|chapter-divider` (all extensions, node_modules/.git excluded) returns exactly 4 files: the 2 components and their 2 co-located self-tests. Importers: `__tests__/document-header.test.tsx:4` and `__tests__/chapter-divider.test.tsx:4` — both TEST-OF-SELF. NO live consumer: no barrel index in `src/components/research-v2/`, no dynamic/lazy/import() reference, no string/extensionless reference. The live Audit Reader imports neither. Each test file has exactly 2 `it()` blocks, so deletion drops exactly 4 test cases.

**Exact edit sites.**
- `src/components/research-v2/document-header.tsx` — delete entire file (53 lines).
- `src/components/research-v2/chapter-divider.tsx` — delete entire file (33 lines).
- `src/components/research-v2/__tests__/document-header.test.tsx` — delete entire test file (42 lines). Only imports the deleted component; leaving it emits TS2307.
- `src/components/research-v2/__tests__/chapter-divider.test.tsx` — delete entire test file (24 lines). Only imports the deleted component; leaving it emits TS2307.

(Verify note: line counts above corrected per the verify pass — cosmetic only, since all four are whole-file deletions.)

**Final proposed fix.** Delete all four files together: the two components and their two co-located self-tests. No other edits — there is no barrel/registry to update and no live consumer to repatch. This matches the learned-patterns rule that orphan tests must be swept in the same change as their target. After deletion run `npm run build` and `npm run test:run` to confirm zero new TS2307 errors and the test count drops by exactly 4 cases.

**Risks.** Low / effectively zero consumer risk — dead code with no live importer. The only way to break the build is to delete the components but leave their `__tests__` files (orphans → TS2307); the fix mitigates by deleting all four together. No barrel re-export, no lazy/dynamic import, no API/route dependency. Worth noting: this removes the only remaining home for the audited 56px/32px/22px-italic serif tokens, which is the intent of the de-slop worklist.

**Open questions.** None.

---

### B3 — Unused ui-kit exports

**Current state.** `src/components/research-v2/ui-kit/index.ts` is a 53-line barrel with 35 re-exported symbols. All 16 real consumers import from the barrel; their combined consumed set is 21 symbols (Eyebrow, SectionTitle, BodyProse, Callout, VerdictCallout, QuoteCallout, hostname, formatSourceIndex, SourceLink, MonoBadge, DataTable, DataTableColumn, InlineStats, ACTIVITY_TONE_CLASS, PHASE_ICON, StatusIcon, ReaderSectionStatus, QueuedState, LockedState, ErrorStateBlock, SectionActions).

The 14 barrel re-exports with ZERO barrel consumers: Cite (L5), CiteSource (L5), SourcesFooter (L11), NumberedSource (L12), StatusPill (L16), toneToClass (L18), StatusPillTone (L19), DataTableProps (L25), STAT_TONE (L30), InlineStatItem (L31), InlineStatTone (L32), STATUS_META (L36), ALL_READER_SECTION_STATUSES (L40), ALL_PRODUCT_PHASES (L41), VerificationBadge (L45).

**CRITICAL nuance** — most of these symbols are still ALIVE, just not via the barrel: (1) Cite/CiteSource/SourcesFooter are consumed via DEEP module imports (reader-sources.tsx imports Cite from `.../ui-kit/cite` and SourcesFooter from `.../ui-kit/source`; callout.tsx imports Cite/CiteSource from `./cite`). (2) StatusPill is aliased internally (`MonoBadge = StatusPill`) and MonoBadge IS the consumed export. (3) NumberedSource, DataTableProps, STAT_TONE, InlineStatItem, InlineStatTone are used only inside their own module files. (4) toneToClass, StatusPillTone, STATUS_META, ALL_READER_SECTION_STATUSES, ALL_PRODUCT_PHASES are used internally AND imported by `ui-kit/__tests__/ui-kit-utils.test.ts` via DEEP paths — so removing their BARREL lines does NOT break the test.

**THE ONE TRULY-DEAD item:** `VerificationBadge`. The module `ui-kit/verification-badge.tsx` has ZERO importers anywhere (no barrel consumer, no deep import). `audit-reader-shell.tsx` defines and uses its OWN local `VerificationBadge` (def L311, used L1254). So both the barrel export (index.ts L45) and the entire `verification-badge.tsx` file (24 lines) are genuinely removable dead code. (This overlaps the A4 dead-code path.)

**Exact edit sites.**
- `src/components/research-v2/ui-kit/index.ts` (line 45): remove `export { VerificationBadge } from './verification-badge';` — zero consumers, target module unimported anywhere.
- `src/components/research-v2/ui-kit/verification-badge.tsx` (whole file, 24 lines): delete — dead (audit-reader-shell uses its own local VerificationBadge). The only genuinely-dead removal.
- `src/components/research-v2/ui-kit/index.ts` (lines 5, 7-13, 15-20, 22-26, 28-33, 35-43): **OPTIONAL barrel-tidy only** (no dead symbols). If trimming re-exports nobody pulls through the barrel, drop these tokens — Cite + type CiteSource (L5); SourcesFooter (L11) + type NumberedSource (L12); StatusPill (L16), toneToClass (L18), type StatusPillTone (L19); type DataTableProps (L25); STAT_TONE (L30), type InlineStatItem (L31), type InlineStatTone (L32); STATUS_META (L36), ALL_READER_SECTION_STATUSES (L40), ALL_PRODUCT_PHASES (L41). **Do NOT delete the underlying symbols/modules** — they survive via deep imports (reader-sources.tsx, callout.tsx), internal use, and ui-kit-utils.test.ts deep imports.

**Final proposed fix.** Minimal/surgical: delete `ui-kit/verification-badge.tsx` and remove its re-export line (index.ts L45). That is the only export whose symbol is dead end-to-end. Leave the other 13 unused-through-the-barrel re-exports ALONE unless the goal is explicitly barrel hygiene — their underlying symbols are all still used. If barrel-tidy is wanted, only trim the re-export tokens listed in the optional edit site — never the modules.

**Risks.** Low for deleting verification-badge.tsx + its barrel line (grep confirms zero importers; the same-named `audit-reader-shell.tsx VerificationBadge` is a separate local function; no test imports it). The OPTIONAL barrel-trim carries a trap: do NOT also delete the symbols/modules — Cite/CiteSource/SourcesFooter/NumberedSource are consumed via deep imports; toneToClass/StatusPillTone/STATUS_META/ALL_READER_SECTION_STATUSES/ALL_PRODUCT_PHASES are imported by ui-kit-utils.test.ts via deep paths and used internally; StatusPill backs MonoBadge; STAT_TONE/InlineStatItem/InlineStatTone/DataTableProps are internal types. Removing any module/symbol would break vitest (ui-kit-utils.test.ts, reader-sources.test.tsx) and the section renderers. Run `npm run test:run` after any change.

**Open questions.** None recorded.

---

## Group C — Worker / build-config

### C1 — CompetitorLandscape first-pass schema (2 repair loops on missing "indirect" competitor type) — **FIX REVISED**

**Current state.** The "missing competitor types" coverage check is REAL and lives in an imperative validator, not a Zod refine. In `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts`, `validateCompetitorLandscapeMinimums` (lines 554-641) computes `observedTypes` from the competitors array (577-579), then `missingTypes = competitorTypes.filter(t => !observedTypes.includes(t))` where `competitorTypes = ["direct","indirect","status-quo","diy"]` (line 9). If any bucket is absent it pushes the exact error from line 585: ``body.competitorSet.competitors: missing competitor types ${missingTypes.join(", ")}.`` — verbatim match to the worklist claim. The Zod side does NOT require all four: `competitorSchema.competitorType` is `z.enum(competitorTypes)` (line 18), and there is zero refine/superRefine in the file.

Wiring: `section-registry.ts` line 173 sets `validateMinimums: validateCompetitorLandscapeMinimums` for `positioningCompetitorLandscape`; the runner in `run-section.ts` invokes `validateMinimums` and, on errors, drives a repair loop bounded by `answerToolMaxRepairAttempts = 2` (line 796; guards 4468/4915 — verify cites 2863/3022/3742 for the invocations and 4468/4915 for the loop guards). A dropped "indirect" bucket forces up to 2 full agentic re-runs (~30s each) — the "repaired twice / ~60s of 184s" symptom. The SKILL.md ALREADY pushes all four buckets hard (IRON LAW line 51, workflow step 2 lines 104-105, "Indirect competitors" guidance lines 399-403, Output Quality Checklist line 462), so the prompt is already saturated.

**Exact edit sites.**
- `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts` (lines 580-587): relax the coverage check so a missing non-core bucket no longer forces a repair, while keeping the load-bearing buckets mandatory. Do NOT touch the Zod enum at line 9/18 — it already allows any subset.

**Final proposed fix (incorporating verify `revise`).** Apply the validator relaxation, but keep **BOTH `direct` AND `status-quo`** in the hard-required set (not `direct` only). Concretely:
```ts
const requiredCompetitorTypes = ['direct', 'status-quo'] as const;
const missingTypes = requiredCompetitorTypes.filter((t) => !observedTypes.includes(t));
```
leaving the existing `if (missingTypes.length > 0) errors.push(...)` block and the error string at line 585 unchanged. Rationale: the observed live symptom was a dropped `indirect` bucket, so demoting `indirect` and `diy` to soft (prose-gap) signals removes the exact repair-loop trigger; keeping `status-quo` required preserves the strategically load-bearing "do nothing" alternative (the SKILL.md gives it dedicated guidance and a dedicated repair-prompt branch) without reintroducing the observed loop.

In the SAME commit, **soften `build-prompts.ts:377`** so it no longer calls all four buckets a hard "minimum" — reword to require `direct` and `status-quo` and frame `indirect`/`diy` as include-when-evidence-exists-else-name-the-gap-in-prose, keeping the structured-body prompt consistent with the relaxed validator. **Do NOT add/update any schema `__tests__`** — none assert this path (the prior agent's claimed test does not exist; the only test touching the missing-types string is `build-prompts.test.ts:200-218`, which hand-constructs the string for `buildRepairPrompt` and never calls the validator, so it does not break).

**Risks.** Low. Consumers of `validateCompetitorLandscapeMinimums`: the runner (run-section.ts via section-registry.ts:173) and the fixture self-check (`fixtures/competitor-landscape-artifact.ts:452`). The fixture supplies all four types (lines 45/56/76/86), so `.ok` stays true after relaxing the required set. Renderer `competitor-landscape.tsx` does not break (maps the competitors array, reads `competitorType` per-item with a fallback label; no coverage requirement); `audit-artifact-view.ts` only type-checks `competitorType` per item. Relaxing the floor weakens output completeness on weak-evidence runs, but the IRON LAW already requires naming a thin bucket as an evidence gap in prose, so the section stays honest. Verify correction: the prior agent's claim that schema `__tests__` assert the all-four path and "will need updating" is WRONG — no such test exists. Directionally consistent with CLAUDE.md ("do not hard schema-force section cards while prompts stabilize").

**Open questions.** Whether to keep `status-quo` required (default per verify: yes) or relax to `direct` only. Status-quo is strategically load-bearing for GTM positioning, so a human should decide if dropping it to a soft signal is acceptable; default to keeping it required. Also confirm the build-prompts.ts:377 wording is softened in the same change so the prompt and validator do not diverge.

---

### C2 — SKILL.md Vercel file-tracing deploy-blocker

**Current state.** The claim is accurate in mechanism; the trace include is genuinely misplaced.
1. `next.config.ts` (lines 10-12) has exactly ONE `outputFileTracingIncludes` entry, keyed to `'/api/research-v2/orchestrate'`: `['./src/lib/lab-engine/skills/**/*']`. There is NO entry for `'/api/research-v2/run-lab-section'`.
2. The orchestrate route does NOT read SKILL.md. It imports neither `runLabSectionJob`, `loadLabSkill`, `lab-section-job`, nor `lab-section-dispatch`. It only seeds the orchestration RPC, freezes the brief snapshot, then fan-out `fetch()`es `POST /api/research-v2/run-lab-section` once per queued zone (getLabSectionUrl 84-86; kickoffLabSectionJob 124-164; dispatchLabSectionJobs 88-122). The lambda with the trace include never touches the skills dir.
3. The actual SKILL.md read happens in the run-lab-section lambda. `run-lab-section/route.ts` (311-319) calls `scheduleLabSectionJob({ ..., schedule: after })`. `scheduleLabSectionJob` (lab-section-dispatch.ts 95-114) defers the heavy job into `after()`. `runLabSectionJob` (lab-section-job.ts 54-61) passes `loadSkill: loadLabSkill`. `loadLabSkill` (lab-section-job.ts 114-130) does `readFile(join(process.cwd(),'src','lib','lab-engine','skills', slug, 'SKILL.md'),'utf8')`. `run-section.ts` calls `deps.loadSkill(definition.skillSlug)` on the primary path (4195) plus repair/rescue (4726, 5173, 5483, 5852). On Vercel the run-lab-section lambda bundle would NOT include the SKILL.md files → ENOENT → every section fails. Local `next dev` shares one process/filesystem so it is unaffected.
4. **NEW finding the worklist missed:** `rerun-section/route.ts` ALSO calls `scheduleLabSectionJob({ schedule: after })` (217-224), so `loadLabSkill` runs in the rerun-section lambda's `after()` too. That lambda is also un-traced and would ENOENT on a single-section rerun.
5. Each skill dir contains only SKILL.md (no sibling assets); 8 skill dirs total. run-lab-section handles all 8 slugs (incl. positioning-synthesis and positioning-paid-media-plan) via getDispatchZones, all through loadLabSkill — so all 8 dirs must be traced; `**/SKILL.md` covers them.
6. The misplaced `/orchestrate` include was added in commit `ccdc4235`, the same commit that wired the after()-based dispatch — the trace was pointed at the entry route instead of the worker route from day one.

**Exact edit sites.**
- `next.config.ts` (lines 10-12): add trace keys for the two lambdas that actually `readFile` SKILL.md inside their `after()` callbacks — `'/api/research-v2/run-lab-section'` and `'/api/research-v2/rerun-section'`, each globbing `'./src/lib/lab-engine/skills/**/SKILL.md'`.

**Final proposed fix (incorporating verify sharpening).** Use the **additive variant** (verify-preferred, strictly lower-risk churn): ADD the two real keys and LEAVE the orchestrate key in place. Both are verified-safe (orchestrate never reads skills), but a stale include is harmless dead weight whereas removing it gains nothing at deploy time. Resulting block:
```ts
outputFileTracingIncludes: {
  '/api/research-v2/run-lab-section': ['./src/lib/lab-engine/skills/**/SKILL.md'],
  '/api/research-v2/rerun-section': ['./src/lib/lab-engine/skills/**/SKILL.md'],
},
```
(If the team prefers a clean config, dropping the orchestrate key is also verified-safe.) The glob is narrowed from `/**/*` to `/**/SKILL.md` since SKILL.md is the only file `loadLabSkill` reads and the only file in each dir. **KEEP the verification step:** run a real production/standalone build (`npm run build`) and inspect the generated `.next/.../run-lab-section` and `rerun-section` `.nft.json` (or standalone output) to confirm all 8 SKILL.md files are traced — `next dev` cannot surface a missing-trace regression because it shares one process/filesystem.

**Risks.** Very low. `outputFileTracingIncludes` only adds files to a lambda's deploy bundle; it cannot break runtime logic or remove anything. Worst case of a typo'd route key or glob: the include silently does nothing (status quo — sections still ENOENT), not a new failure. Dropping the orchestrate key is safe (that lambda never reads SKILL.md). Only the Vercel/standalone production bundle for run-lab-section and rerun-section is affected; local `next dev` is unchanged. The trace key must match the route's on-disk path exactly as Next.js emits it; if the project moves to route groups or renames, the key must follow. Correctness can only be proven against a real build, not `next dev`.

**Open questions.** None recorded.

---

## Recommended execution order

Sequence to minimize churn and avoid touching overlapping files in conflicting ways. The verification-badge dead code is shared between A4 and B3 — handle it once.

1. **A1 — citation wiring** (`narrative-block.tsx`). Single-file, high-leverage, shared-rendering fix that lights up all 8 section renderers. Do first; it touches a file nothing else in the worklist edits.
2. **A2 — de-slop GenericTypedArtifactRenderer** (`typed-artifact-renderer.tsx` + its helper family). Self-contained to the fallback renderer; run its two named tests after.
3. **A3 — rail subline mapping** (`audit-reader-shell.tsx:327-334`). Two-branch display fix, isolated function.
4. **B3 — delete dead `verification-badge.tsx` + barrel line 45** (and, if doing it, the A4 dead-code path resolves here). Do this BEFORE any A4 badge consolidation so there is exactly one badge story. Skip the optional barrel-tidy unless explicitly asked.
5. **A4 — badge consolidation (DISCRETIONARY).** Only proceed if the user signs off on the visual/test change. If the intent was only dead-code cleanup, it is already satisfied by step 4 — otherwise the DomainChips half (and the shell-badge restyle + test:146 update) needs design approval. Lowest priority; can be deferred.
6. **B1 — half-pixel fix ONLY** (`audit-reader-shell.tsx:488`, `13.5px` → `13px`). Touches the same file as A3/A4; do the single-line size fix after those land to avoid edit conflicts. Drop the rest of B1's scope.
7. **B2 — delete the four serif files together** (two components + two self-tests). Deletions last, as a clean sweep; run `npm run build` + `npm run test:run` and confirm the test count drops by exactly 4.
8. **C1 — competitor-landscape validator relaxation + paired build-prompts.ts:377 softening.** Worker/schema change, independent of the UI tree. Keep `direct` + `status-quo` required. No schema test changes needed.
9. **C2 — next.config.ts trace fix (additive variant), last and standalone.** It is a build-config change whose correctness can only be proven by a real `npm run build` + `.nft.json` inspection, so run it after all source edits land and gate the deploy on that build.

**SKIP / DO NOT EXECUTE AS WRITTEN:**
- **B1 (most of it) — claim inaccurate.** Skip the "tokenize sizes," "inline-mono → Eyebrow," and "muted → foreground" parts: there is no font-size token scale to migrate to, the mono labels are not Eyebrow-equivalent (different px/weight/tracking — conversion is a visual regression), and no specific wrong-muted cell exists. Execute ONLY the single `13.5px → 13px` half-pixel fix (step 6). The 22 `strategic-research/*` half-pixel hits are out of scope (legacy V1 tree).
- **A4 (the live shell-badge restyle) — gate on design sign-off.** Not already-done and not claim-inaccurate, but a user-visible redesign + test rewrite that must not ship as a silent "refactor." The dead-duplicate removal portion is covered by B3.
- No items were already-done; none other than B1 are claim-inaccurate.
