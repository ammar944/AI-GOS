# Card Taxonomy

`present-workspace` emits one presentation card for each supported upstream output.

## Presentation Card

- `type`: one of `icp`, `voc`, `market`, `offer`, `keywords`, `competitor`, `cross-analysis`, `positioning`, `media-plan`, `scripts`.
- `title` and `subtitle`: human-readable card header data.
- `sections[]`: normalized rows, bullets, stats, or prose for document-like workspace views.
- `evidence[]`: source-linked claims extracted from upstream output.
- `source_gaps[]`: non-empty normalized gaps preserved from upstream output or generated for missing/invalid stages.
- `status`: `ready`, `partial`, `missing`, or `error`.

## UI Card

Each card also includes `ui`, a skill-local copy of the current workspace `CardState` shape:

```text
id, sectionKey, cardType, label, description, content, status, versions
```

The skill does not import the app type. It duplicates the minimal data contract so the package remains portable.

## Status Decision Tree

For each card:
1. Upstream path absent -> `missing`
2. Upstream JSON parse or transform failed -> `error`
3. Renderable sections exist but evidence or gaps are weak -> `partial`
4. Renderable sections, preserved evidence, and source_gaps exist -> `ready`

Workspace status is derived from card counts.
One failed upstream output must not change unrelated cards to `error`.
