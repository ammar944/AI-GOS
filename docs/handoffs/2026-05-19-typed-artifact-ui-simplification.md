# Handoff — Typed-Artifact UI Visual Simplification

**Date:** 2026-05-19
**Branch:** `feat/research-v2-typed-artifact-primitives` (off `feat/research-v2`)
**Worktree:** `/tmp/aigos-arc2-pr1`
**Dev server:** `http://localhost:3003` (or start fresh: `cd /tmp/aigos-arc2-pr1 && npm run dev`)
**Dev preview route:** `http://localhost:3003/dev/typed-artifact-preview` (no auth needed — added to public routes in middleware)

---

## The vision (read this first, internalize it)

AIGOS sells GTM strategy that AI agents produce by doing real research. The UI is the moment the user reads what the agent figured out. It should feel like reading **a thoughtful AI agent's investigation**, not a financial terminal.

Reference points the user explicitly named:
- **Claude.ai** — long prose, generous whitespace, minimal chrome, one column, content-first
- **Manus AI agent output** — clean, conversational, the agent thinks out loud and you follow along
- **Codex / Codex CLI** — terse, structured but spacious, no decoration

Anti-references the user explicitly named:
- **NOT Bloomberg terminal** — no information density at all costs
- **NOT a "command center"** — no widget mosaic, no dashboard energy
- No multi-column data competing for attention
- No "every piece of data crammed in"

The product story: a user drops a URL. Agents research the market, the buyers, the competitors, the offer. They come back with **a written analysis**, like a senior strategist's memo. Data is woven INTO the analysis where it earns its place — it does not lead. Tables and charts are punctuation, not the headline.

**Mental model for the developer:** the page should read like a long-form Claude response. Imagine a user opening a Section and saying out loud: *"oh nice, the agent wrote this up clearly."* That is the bar.

---

## Current state and why it's wrong

A working dev preview exists at `/dev/typed-artifact-preview`. The page renders:
1. **CompetitorLandscapeRenderer (typed)** — the new Arc 2 UI we want to evaluate
2. **SectionNarrativeRenderer (fallback)** — what un-typed sections currently render as

The user's verdict: *"the UI looks really weird"*, *"not bloomberg not fucking command center"*. The typed renderer feels like a dashboard. Six sub-sections stacked, each with its own DataTable / BarBreakdown / PositioningAxisStack / QuoteCallout. Functionally correct, visually overwhelming. The narrative fallback at the bottom is also misleading because it's being force-fed a structured artifact — ignore that one or remove it.

What's specifically wrong (your job to confirm and add to this list):
- Sub-section labels are tiny numeric bullets ("1 · Competitor Set"). Wrong hierarchy — these are the headers of an essay, not table-of-contents numbers.
- Multiple data tables stacked vertically with no breathing room. Feels like Bloomberg.
- `QuoteCallout` reads as a styled box around text rather than a callout that lets the quote speak.
- `PositioningAxisStack` is a list, not a positioning visual — the "axis" framing is meaningless when it's rendered as bullets.
- No prose-leading flow. The agent's narrative (`competitorSet.prose`, `positioningTaxonomy.prose`, etc.) is buried above the data, not framing it.

---

## What to do

1. **Eyeball the current state.** Open `http://localhost:3003/dev/typed-artifact-preview` in a real browser at desktop width. Sit with it for two minutes. Don't sketch a fix yet.

2. **Open the references** in another tab. `claude.ai`, a Manus AI demo, a Codex output. Notice what they DO NOT do — they don't pack the screen with widgets.

3. **Propose a design philosophy** in 3–5 sentences before touching code. Examples of the kind of principles I'd accept:
   - *"Prose first, data second. Every typed sub-section opens with the agent's `prose` field in a generous reading column. Data appears below as supporting evidence, never above as the headline."*
   - *"One column, ~720px max-width content area. Generous vertical rhythm — 80px between sub-sections, not 24."*
   - *"Tables only when comparison is unavoidable. Prefer inline references woven into the prose. Where a table is used, hide chrome — no borders, monospaced numbers, lots of cell padding."*
   - *"Quote callouts ARE the quote. No surrounding box. Use a left rule, italic body, attribution as small mono caption."*
   - *"The 'axis stack' renders as a visual axis with each competitor positioned along it (an actual chart-like element), or it doesn't render and the data appears as a sentence."*

4. **Refactor the 7 primitives + CompetitorLandscape renderer** to embody that philosophy. The primitives are tiny — see file list below. Don't add new primitives; the goal is REMOVE chrome, not add it.

5. **Update the dev preview page** if the wrapper styling fights the new vision (e.g., the surrounding `<div className="rounded-lg border bg-card p-6">` wrappers around each renderer might be exactly the dashboard chrome we want to delete).

6. **Verify** with the test suite + a fresh screenshot. Side by side: current vs new.

---

## Files to touch

```
src/components/research-v2/primitives/
├── bar-breakdown.tsx
├── data-table.tsx
├── index.ts
├── inline-stats.tsx
├── milestone-timeline.tsx
├── narrative-block.tsx
├── positioning-axis-stack.tsx
└── quote-callout.tsx

src/components/research-v2/section-renderers/
└── competitor-landscape.tsx

src/app/dev/typed-artifact-preview/page.tsx   ← the dev surface that mounts both renderers
```

**Don't touch:** any of the schemas, the audit-artifact-view dispatcher, the agent-artifact-surface component, the SectionNarrativeRenderer. Those are wiring — keep them stable.

---

## Constraints

- **Stay within the existing design system.** Tokens come from `globals.css` and the brand spec is `DESIGN.md` (at the repo root). Don't introduce new colors, new font families, new spacing scales.
- **The tests must keep passing.** `cd /tmp/aigos-arc2-pr1 && npm run test:run -- src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` is the gate. 13 tests, all pass today.
- **The TypeScript baseline must hold.** `npx tsc --noEmit` reports 65 errors (pre-existing). Don't add any.
- **No new dependencies** unless absolutely necessary. The user doesn't want bloat.

---

## What I expect back

1. A 3–5 sentence written design philosophy (paste it into a section of this doc or a new one).
2. Updated primitives + renderer that embody it.
3. A fresh full-page screenshot of `/dev/typed-artifact-preview` at desktop width.
4. A short note on anything you deliberately did NOT change and why.

If you find yourself adding decoration, sidebars, chips, badges, or extra wrappers — stop. The vision is removal, not addition.

---

## Pointers for tone calibration

- The brand spec at `DESIGN.md` opens with a refined editorial / agency-of-record tone. Lean into that — serif headers, monospace metadata, generous tracking.
- The current CompetitorLandscape renderer uses `font-serif` for some headings and inline mono numerals — keep that pattern. Editorial, not corporate.
- If you find yourself reaching for emoji, status pills, color-coded badges, or anything that says "dashboard" — that's the warning sign.

When in doubt, ask: *"would this fit on Claude.ai's output panel?"* If no, cut it.
