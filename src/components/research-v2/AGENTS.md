# AGENTS.md - src/components/research-v2

## Purpose

- Owns the Audit Reader UI, typed artifact rendering, section renderers, live activity rail, reader sources, welcome/corpus views, primitives, and research-v2 UI kit.

## Ownership

- `audit-reader-shell.tsx` owns the reader composition.
- `typed-artifact-renderer.tsx` owns zone-to-renderer dispatch.
- `section-renderers/` owns per-section card rendering.
- `ui-kit/` and `primitives/` own local reusable display components.

## Local Contracts

- Render persisted, schema-backed artifacts only. Do not invent missing research values.
- AI-authored prose fields (subsection `prose`, `statusSummary`, executive-brief thesis/moves) render as markdown through `src/components/ai-elements/response.tsx` (streamdown wrapper); citation `[n]` markers must keep resolving to Cite hover-cards (see `narrative-block.tsx` component overrides).
- Verification tier/badge chrome is removed from the reader by user decision (2026-06-11): no tier badges, tier dots, tier sublines, flagged-count run summaries, or verified/unverified claim rollups render anywhere in the reader, shared view, or profile surfaces. Verification data still persists in DB/API (`src/lib/research-v2/verification-tier.ts` and server consumers stay); do not reintroduce tier chrome without an explicit ask. The status-axis 'Needs review' subline for FAILED sections (rerun UX) is a different axis and stays. Review metadata renders client-facing `clientQuestions` only — tier rationale and removed-items lists stay hidden.
- Keep source/citation affordances visible when the artifact provides source data.
- Renderer behavior must match artifact schemas in `src/lib/lab-engine/artifacts/` and contracts in `src/lib/research-v2/`.
- Preserve stable section IDs and zone IDs.
- UI should degrade cleanly for absent optional fields but must not hide invalid required data upstream.

## Work Guidance

- Add or update renderer fixtures when artifact shape changes.
- Keep section renderer exports centralized through existing index files.
- Prefer local primitives over bespoke markup when a primitive already covers the pattern.

## Verification

- Run `npm run test:run -- src/components/research-v2`.
- For schema/renderer changes, also run relevant `src/lib/lab-engine/artifacts` tests.

## Child DOX Index

- No child `AGENTS.md` files yet. Subfolders are governed by this file unless a closer file is added.
