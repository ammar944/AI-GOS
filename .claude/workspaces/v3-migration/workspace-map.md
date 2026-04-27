# AIGOS v3 Workspace Map

**Generated** from `src/lib/skills/route-table.ts`. Do not edit by hand —
run `npx tsx scripts/generate-workspace-map.ts` after editing the route table.

**Scope:** every user-invokable v3 skill, mapped to its slash command, the
production worker tool it bridges to (matches `TOOL_RUNNERS` in
`research-worker/src/index.ts`), the dispatch pipeline section it owns
(matches `DISPATCH_PIPELINE_ORDER` in `src/app/api/journey/dispatch/route.ts`),
and migration status. `—` means no production counterpart yet.

**Status:** see `tracker.md`. Only `Wired` rows are safe for production
dispatch; everything else still flows through the legacy `dispatch/route.ts`
→ worker `TOOL_RUNNERS` path directly.

## Ingest layer

| Task | Command | Skill | Worker Tool | Dispatch Section | Status |
| --- | --- | --- | --- | --- | --- |
| URL intake | `/ingest-url` | `ingest-url` | — | — | Validated |
| Fathom call intake | `/ingest-fathom` | `ingest-fathom` | `extractMeetingTranscript` | — | Validated |
| Document intake | `/ingest-docs` | `ingest-docs` | — | — | Validated |
| Identity resolution | `/ingest-identity` | `ingest-identity` | `resolveIdentity` | `identityResolution` | Validated |

## Research layer

| Task | Command | Skill | Worker Tool | Dispatch Section | Status |
| --- | --- | --- | --- | --- | --- |
| Market research | `/research-market` | `research-market` | `researchIndustry` | `industryMarket` | Validated |
| ICP research | `/research-icp` | `research-icp` | `researchICP` | `icpValidation` | Validated |
| Competitor research | `/research-competitor` | `research-competitor` | `researchCompetitors` | `competitors` | Validated |
| Offer diagnostic | `/research-offer` | `research-offer` | `researchOffer` | `offerAnalysis` | Validated |
| Keyword intelligence | `/research-keywords` | `research-keywords` | `researchKeywords` | `keywordIntel` | Validated |
| Voice of customer | `/research-voc` | `research-voc` | — | — | Validated |
| Cross-section synthesis | `/research-cross` | `research-cross` | `synthesizeResearch` | `crossAnalysis` | Validated |

## Synthesize layer

| Task | Command | Skill | Worker Tool | Dispatch Section | Status |
| --- | --- | --- | --- | --- | --- |
| Positioning synthesis | `/synthesize-positioning` | `synthesize-positioning` | — | — | Validated |
| Media plan synthesis | `/synthesize-media-plan` | `synthesize-media-plan` | `researchMediaPlan` | `mediaPlan` | Validated |
| Script synthesis | `/synthesize-scripts` | `synthesize-scripts` | — | — | Validated |

## Sidecar — interaction

| Task | Command | Skill | Worker Tool | Dispatch Section | Status |
| --- | --- | --- | --- | --- | --- |
| Card refinement chat | `/chat-refine` | `chat-refine` | — | — | Spec'd |

## Sidecar — presenter

| Task | Command | Skill | Worker Tool | Dispatch Section | Status |
| --- | --- | --- | --- | --- | --- |
| Workspace presentation | `/present-workspace` | `present-workspace` | — | — | Validated |

## Notes

- `chat-refine` is `kind: interaction` — edits cards, never dispatches research.
- `present-workspace` is `kind: presenter` — renders / maps cards, never dispatches.
- Skills with `Worker Tool: —` are v3-only and have no legacy production counterpart.
- `research-cross` bridges to worker tool `synthesizeResearch` (file `research-worker/src/runners/synthesize.ts`); the legacy export is named for synthesis but produces cross-section output.
