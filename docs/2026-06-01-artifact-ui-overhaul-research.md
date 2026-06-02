# research-v2 Artifact / Streaming UI Overhaul — Research & Direction

> Phase 1 (discovery + design intelligence) deliverable.
> Branch/worktree: `feat/v2-artifact-ui-overhaul` off `feat/v2-lab-section-wire` @ 738558f8.
> Method: 11-agent workflow (6 component-cluster audits + 5 design-intel) + 2 recovery agents + manual ground-truth verification.
> Next phase: `/prototype` (toggleable variants) → integrate.

## 0. Scope

The "fanout research window" = everything `/research-v2` renders once the brief is submitted and the six positioning sections fan out and stream. Anatomy:

```
AuditReaderShell  (src/components/research-v2/audit-reader-shell.tsx, 1697 lines)
├─ top bar            Positioning Audit / {company} · RunStatusBar · Copy/Rerun
├─ SectionProgressStrip   left 56px icon rail (8 sections)
├─ reading column (one section at a time)
│   ├─ RUNNING   → LiveActivity feed  OR  DraftingArtifactView (streamed partial)
│   ├─ COMPLETE  → VerdictCard + TypedArtifactRenderer(body) + SourcesList
│   ├─ QUEUED    → QueuedPlaceholder
│   └─ ERROR     → ErrorState
└─ MobileSectionSwitcher  (< sm)

TypedArtifactRenderer → 8 section renderers → primitives kit (DataTable, QuoteCallout,
  SubsectionBlock, NarrativeBlock, BarBreakdown, InlineStats, PositioningAxisStack,
  MilestoneTimeline) + buyer-icp sub-cards.

Pre-fanout: CorpusStream (corpus build screen). Legacy: ThinkingBlock.
```

## 1. The single most important finding: we already own the components

**Zero new dependencies are required.** The repo already vendors the entire Vercel AI Elements set:

- `src/components/ai-elements/` (17): **agent, artifact, chain-of-thought, code-block, conversation, inline-citation, message, plan, prompt-input, queue, reasoning, shimmer, sources, suggestion, task, terminal, tool**
- `src/components/ai/` (7, older partial copy): code-block, conversation, message, reasoning, shimmer, sources, tool
- `src/components/ui/` (42 shadcn new-york): incl. alert, badge, collapsible, hover-card, scroll-area, separator, skeleton, tabs, tooltip, carousel

`sources-panel.tsx` + `chat-thread.tsx` already import from these, so the adoption pattern is proven. The overhaul is **route the bespoke slop through primitives we own, then restyle to DESIGN.md** — not a green-field build.

(Cleanup opportunity for integration: `ai/` and `ai-elements/` overlap; `ai-elements/` is the superset. `components.json` has `registries: {}` — adding the ai-sdk registry is optional polish so the shadcn MCP can see them.)

## 2. Slop inventory — eight cross-cutting themes (ranked)

Every cluster audit converged on the same defects. Ranked by impact:

### T1 — Over-rounded filled cards (the #1 AI-slop tell) · HIGH
`rounded-xl/lg` + `bg-muted/card` fills used as the default container everywhere: `VerdictCard`, `QueuedPlaceholder`, `ErrorState`, **`QuoteCallout` (primitive → every VoC + competitor quote inherits it)**, `PositioningAxisStack`, `GenericTypedArtifactRenderer` DataCards, paid-media creative grid, positioning-synthesis "recommended move" (`bg-primary/5`), all five buyer-icp cards.
DESIGN.md: callouts = **2px left accent, NO fill**, radius ≤8px (6px module). Radius tightening is called out as *"the biggest anti-AI-slop move."*
→ **Fix:** kill fills, convert to 2px-left-accent callouts, cap radius at `md` (6px). The verdict — the highest-value line — must stop looking like every other grey box.

### T2 — Three divergent streaming UIs + EMOJI icons · HIGH
The same concept (agent is working) is drawn three ways: `LiveActivity` (faux timeline), `CorpusStream` (Card "Activity log"), `ThinkingBlock` (collapsible rail). **`CorpusStream` and `ThinkingBlock` use emoji phase icons (🔍🧠💭📄✓⏱✗)** via duplicated `phaseIcon()` maps — a hard DESIGN.md *"Lucide only, never emoji"* violation and the loudest slop tell on the surface.
→ **Fix:** ONE activity primitive built on vendored `chain-of-thought` + `task` + `reasoning` + `shimmer`/`loader`, one Lucide phase-icon map (the shell already has the correct `PHASE_ICON` map to lift), same vocabulary for corpus build AND per-section running. This is the core of the streaming overhaul.

### T3 — No shared type scale · MED (death by a thousand cuts)
Arbitrary half-pixel sizes everywhere (`text-[11.5px]/[12px]/[12.5px]/[13px]/[13.5px]/[15px]/[18px]/[20px]/[27px]/[31px]`), label tracking drifts per file (`0.04 / 0.06 / 0.08 / 0.12em`), "mono labels" faked with sans (Geist, not Geist Mono), headings in body font where the scale mandates Instrument Serif. The half-pixel ladder (12/12.5/13/13.5) is the textbook tuned-by-eyeball slop signature.
→ **Fix:** a small set of type utilities/primitives (`Eyebrow`/`Label`, `Data`, body) encoding the DESIGN scale; zero arbitrary `text-[Npx]`; one tracking value (0.06em).

### T4 — Broken color semantics · MED
`complete` is colorless while `active`/`ready` are accent-blue (success is the *only* state with no color — inverted hierarchy); verified counts use blue where green belongs; `committed/queued` and `verified/unsupported` render in identical grey; **offer-diagnostic, awareness-level-card, and VoC use categorical red/blue backgrounds** (high-pain=red, champion=blue, confidence=primary) — the rainbow-tagging DESIGN.md explicitly dropped. Accent is spent on chrome (every `MilestoneTimeline` dot is blue via a **dead conditional** `step.accent ? 'bg-primary' : 'bg-primary'`).
→ **Fix:** ONE status token map used everywhere — active=blue, success/verified=green, warn/flagged=amber, error=red, queued/locked=text-3. Accent reserved for the one thing that matters per view. Delete categorical color.

### T5 — Muted body text + weak hierarchy · MED (biggest readability tax)
`NarrativeBlock` sets **all** running prose in `text-muted-foreground`, so the primary reading content of every section is rendered in the muted tier → washed-out, low-contrast document. Stacked subsections are separated only by a gap (no rule, no weight change).
→ **Fix:** body in `text-foreground` ~15px/1.6; muted reserved for meta/captions; hairline/`Separator` between subsections.

### T6 — Duplicated helpers + forked primitives · MED
`MonoPill`/`SourceLink`/`hostnameOf` copied 4-5×; **`VoiceOfCustomer` forks `DataTable` as raw `<table>`** with byte-identical class constants; 5 near-identical pill variants in `offer-diagnostic`; two divergent source UIs (`sources-panel` Card vs shell `SourcesList`). `MonoPill` is misnamed — it's `rounded-full bg-secondary` sans, not the spec'd mono status badge.
→ **Fix:** shared `Badge`/`SourceLink`/`hostname` primitives; route ALL tabular data through one `DataTable`; unify sources on vendored `Sources` + the numbered (01/02 tabular) idiom.

### T7 — Card-proliferation for ranked/comparative data · MED
`GenericTypedArtifactRenderer` (2-col card grids), `PositioningAxisStack` (card grid for comparative data), buyer-icp persona/trigger/awareness/firmographic/venue (card grids), paid-media creative framework (`md:grid-cols-2` grid). DESIGN.md: *"tables over cards for ranked data; no multi-column card grids."*
→ **Fix:** `DataTable` for ranked/comparative; keep genuine entity profiles as de-rounded **borderless** blocks, not filled cards.

### T8 — IA discontinuity · MED
`SectionProgressStrip` renders the completed-count twice, is icon-only (guess-the-glyph), and **vanishes once the run is terminal**; the column max-width jumps 820→1080 on completion (the layout you navigate during the run ≠ the one you read after); `CompetitorLandscape` is an 8-subsection monolith with overlapping facts and no in-section nav.
→ **Fix:** one persistent labeled nav (present during AND after the run), consistent layout, in-section sub-nav for the dense sections.

### Keep (already clean — do not touch)
`document-header.tsx` (Instrument Serif 56px + mono metadata), `chapter-divider.tsx`, `section-error-card.tsx` (uses the `Alert` primitive correctly), `sub-section.tsx`, and the `RunStat`/`MobileSectionSwitcher` idioms (correct mono-label + Section-Tabs treatments) are the reference for what "good" looks like in this codebase.

## 3. Surface zone → target component map

| Zone | Today | Target |
|---|---|---|
| Top bar | bespoke; Copy/Rerun in global chrome | Keep bespoke mono telemetry; **move Copy/Rerun into per-section artifact actions**; `shimmer` the live phase label; verified=green / flagged=amber |
| Left rail | 56px icon strip, dup count, vanishes on done | Persistent labeled rail (before+after); fix dup count; optional `stepper`-style; locked-gated for the 2 capstones |
| Reading col — RUNNING | LiveActivity faux-timeline + emoji siblings | `chain-of-thought` (phase steps) + `task` (collapsible tool groups) + `tool` (real tool calls) + `shimmer`/`loader`, inside `conversation` (stick-to-bottom). Collapse to a one-line "Researched N sources · M tools" summary on commit |
| Reading col — COMMITTED | inline header + VerdictCard + TypedArtifactRenderer | Wrap each section in a `SectionFrame` (over vendored `artifact`, restyled to DESIGN tokens): header = title + Verified badge + Copy/Rerun; body = TypedArtifactRenderer. **Keep the 6 typed renderers; restyle the primitives.** Verdict = 2px left-accent callout |
| Sources | shell `SourcesList` ⟂ `sources-panel` (divergent) | Unify on vendored `sources` + the numbered idiom; add `inline-citation` hover-previews in body, tied to verifier-supported claims |
| Corpus screen | Card "Activity log" + emoji | Rebuild on the **same** chain-of-thought vocabulary → one streaming language across corpus + fanout |

## 4. The one open decision (for the prototype gate)

**Reading-column theme + density.** Three signals, one tension:
- DESIGN.md → **dark** industrial (#07090e / panels #0a0c12), data-dense.
- The shipped reader → **light** "OpenAI developer platform" column (you previously loved this; locked 2026-05-26).
- Your new reference (Codex screenshot) → clean **dark**, *spacious/calm* (not Bloomberg-dense).

Every design-intel agent converged on **dark + calm**, and the vendored ai-elements are token-driven → they render correctly in **either** theme with no code change. So this does not block component work; it's the one thing to *see* before committing.

→ **Prototype shows it.** Build the new surface once on the vendored primitives, then toggle: **(A) Dark Codex-calm**, **(B) Light OpenAI-dev refined**, with a density toggle. You pick from the live route.

## 5. Plan

1. **`/prototype`** — one throwaway route rendering the full overhauled fanout reader (running + committed + sources states) on the vendored ai-elements, restyled to DESIGN.md, with the light/dark + density toggles. No production wiring.
2. **Lock direction** from the live prototype.
3. **Integrate** into `audit-reader-shell.tsx` + primitives + section-renderers in the worktree, behind the existing surface, gate-green (tsc/lint/test/build), then hand to QA + a live run.

Non-goals this phase: the post-research chat sidebar (edit-only), onboarding (already cleaned), worker/runner logic, schema changes.
