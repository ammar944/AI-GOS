# Phase 6: Visual Elevation — Session Handoff Prompt

Copy-paste this into a new Claude Code session:

---

Read PRIMER.md and DESIGN.md first.

## Task

Make every research section visually match the design preview at `/tmp/design-consultation-preview-v2.html`. Open that file in a browser first — that's the target. The current app looks nothing like it.

## What's already done (don't redo)

- Section shell architecture: `src/lib/workspace/section-shells.ts` routes sections to shell layouts (signal-board, synthesis-cockpit, ops-board). Both `artifact-canvas.tsx` and `research-document.tsx` use them.
- ArtifactCard chrome removed (no border/bg/rounded, no motion stagger)
- 33 card components have typography class updates (10px mono labels, 13-14px body)
- Accent colors unified to one blue

## What's NOT done (your job)

The sections still look like a Google Doc, not like the preview. The gap is:

1. **Stat-grid** — preview shows SHORT values as big 20px mono numbers in a tight flex row. Long paragraph values (like "Estimated SAM: $800M...") should NOT be 20px mono — they need body text treatment. Current component has a length check but the overall layout doesn't match the preview's inline stat row.

2. **No actual tables** — the preview uses real `<table>` elements for keywords (with sortable columns, no borders, hover bg, mono right-aligned numbers, colored difficulty/priority badges). The competitor overview also uses a borderless table. The app uses card components instead.

3. **Callout blocks** — preview: `padding:12px 16px; border-left:2px solid var(--accent); no background`. Callout meta: `11px mono text-3 mt-6px`. Current insight-card and strategy-card are close but need exact padding/spacing match.

4. **Offer statements** — preview: type tag at `9px mono`, text at `13px`, copy button at `10px mono`. Row separator with subtle border. Already close.

5. **Overall density** — the preview is MUCH tighter. Less vertical spacing between elements. The app has too much padding/margin between cards and zones.

6. **Font loading** — verify DM Sans, Instrument Sans, JetBrains Mono are actually rendering (not falling back to system fonts).

## How to work

1. Open the preview HTML in a browser (`open /tmp/design-consultation-preview-v2.html`)
2. Open the app at `localhost:3002`, log into a research session
3. Go section by section, comparing preview vs app
4. Fix each component to match the preview's CSS (the preview source has exact values)
5. Use the frontend design workflow: UI/UX Pro Max skill, Refero MCP, Magic UI MCP, shadcn MCP, Frontend Design plugin
6. Both workspace mode AND document mode must match
7. Screenshot before/after each section change

## Key CSS from preview (extract these, apply to components)

```css
/* Stats */
.stat-val { font-family:var(--font-mono); font-size:20px; font-weight:600; tabular-nums; }
.stat-sm  { font-family:var(--font-mono); font-size:11px; color:var(--text-4); }

/* Tables */
table { width:100%; border-collapse:collapse; font-size:13px; }
th { font-mono; 10px; uppercase; 0.05em tracking; color:var(--text-4); padding:6px 10px; border-bottom:1px solid var(--border); }
td { padding:8px 10px; border-bottom:1px solid transparent; }
tr:hover { background:var(--bg-hover); }
td:nth-child(n+2) { font-mono; tabular-nums; text-align:right; }

/* Callouts */
.callout { padding:12px 16px; border-left:2px solid var(--accent); margin-bottom:12px; }
.callout-text { color:var(--text-1); font-size:14px; line-height:1.55; }
.callout-meta { font-size:11px; color:var(--text-3); margin-top:6px; font-mono; }

/* Offer statements */
.offer-tag { font-mono; 9px; uppercase; 0.04em tracking; color:var(--accent); bg:var(--accent-dim); padding:2px 6px; border-radius:3px; }
.offer-text { flex:1; color:var(--text-1); font-size:13px; line-height:1.5; }

/* Competitor sub-tabs */
.subtabs { display:inline-flex; gap:2px; bg:var(--bg-2); padding:2px; border-radius:5px; }
.subtab { padding:5px 12px; font-size:12px; font-weight:500; color:var(--text-3); border-radius:3px; }
.subtab.on { bg:var(--bg-3); color:var(--text-1); }
```

## Section priority (worst first)

1. Strategic Synthesis — was a prose wall, now has shell zones but still doesn't look like the preview's callout blocks
2. Market Overview — stat-grid values too large for paragraph text, layout too spacious
3. ICP Validation — same stat-grid issue
4. Offer Analysis — scores should be inline, offer statements need tighter spacing
5. Competitor Intel — overview table needs borderless table treatment, URLs need `<a>` tags
6. Keywords — already has sortable table, light polish only
7. Media Plan — most complex, do last. Charts are fine, but platform/campaign/phase cards need density

## DO NOT break

- Inline editing (pencil/save/cancel in ArtifactCard)
- Chat editCard flow
- Version history dropdown
- CompetitorTabs navigation
- Keyword sortable table

## Dev server: port 3002

No office-hours, no design docs, no adversarial reviews. Just make it match the preview.
