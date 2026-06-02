# Live Run Verdict: ramp.com

Date: 2026-06-01 06:55 PKT
Target: ramp.com
Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch / HEAD: `feat/v2-lab-section-wire` / `c89d46fc`
Run ID: `81147e6d-eba6-407b-a980-26e6877c45ba`
Parent artifact ID: not captured. The authenticated Codex browser rendered the reader and server logs showed authenticated `audit-state` 200s, but direct API navigation to `/api/research-v2/audit-state` in the Codex browser was blocked with `net::ERR_BLOCKED_BY_CLIENT`; no Supabase MCP was available in this session.

## Run Health

- Corpus started through `/research-v2` at 06:33:57 PKT and opened the GTM Brief Review for the same `runId`.
- The brief had 23 required fields still empty. I filled only blocking fields, using explicit `Not publicly disclosed in the corpus` text for unknown metrics.
- Audit fan-out started from the UI. After ~60s the reader showed 5/8 sections complete, with `positioningCompetitorLandscape` still running.
- After ~120s the reader showed the six positioning sections available enough to unlock capstones; Synthesis and Paid Media started.
- Synthesis committed. Paid Media Plan did not commit; the reader showed `Section needs review`.
- Runtime log cause for Paid Media Plan: schema validation failed at `body.creativeStrategy.angleTypesInMix[]`; the model emitted values outside the enum `unique-selling-point | problem-solution-transformation | objection-handling | founder-talking-head | product-demo`.
- Runtime log also recorded late failures for `positioningVoiceOfCustomer` and `positioningCompetitorLandscape` even though committed artifacts were copied from the reader. This looks like a stale/duplicate runner or status-priority issue, not absence of rendered artifacts.
- No retry was run. The handoff allowed a second paid run only for a first-run mid-fan-out failure; the core run produced the required artifacts and the capstone failure is part of this verdict.

## Verdict Table

| Check | Verdict | Evidence |
|---|---|---|
| P1.4 VoC self-source ban | PASS, with status anomaly | Committed VoC artifact has 10 `body.painLanguage.quotes[]`. `sourceUrl` domains: reddit.com, g2.com, stampli.com, getkleercard.com, capterra.com. Zero `ramp.com` / subdomain pain sources. Distinct source domains: 5. Largest source share by rendered artifact is reddit.com at 5/10, not a majority. However the reader badge showed `Needs review`, and server log recorded a failed VoC attempt claiming `g2.com supplies 6 of 10 pain quotes`; the copied committed artifact does not match that failure text. |
| P1.3 real keyword demand signal | INCONCLUSIVE | `body.keywordDemand.keywords[]` rendered 12 rows and zero `not disclosed` monthlyVolume values. Sample rows: `expense management software` = `8,900 (SpyFu-estimated)`, `procurement software` = `6,600 (SpyFu-estimated)`, `ramp vs brex` = `3,600 (SpyFu-estimated)`. But the section prose says `keyword_volume` was `rate_limited` and the volumes were estimated from comparable public data, while the schema/renderer exposes no CPC field. Numeric guard passed; real SpyFu provenance was not proven. |
| P1.1 cross-section synthesis | PASS | `positioningSynthesis` committed. It produced 3 positioning options. `recommendedMove.optionAngle` rendered as `One AI-powered platform that replaces 4+ tools - saving you 5% of total spend and closing your books 3 days faster`, exactly matching the first option angle. Options and messaging directions carried `Source Section` values including `positioningOfferDiagnostic`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, and `positioningMarketCategory`. The section was coherent and specific to Ramp. |
| G6 goal recitation / grounding | PASS, with caveats | The six primary artifacts stayed on Ramp, finance operations, spend management, CFO/controller buyers, Brex/Concur/BILL/Navan competitors, and evidence-backed category/demand/VoC themes. I did not see homepage-as-pain drift in the committed VoC pain quotes; all pain quote URLs were non-Ramp domains. Caveats: Competitor ad evidence was weak, Demand provenance contradicted itself, and the reader surfaced stale/failed worker statuses after committed artifacts rendered. |
| CompetitorLandscape latency | DATA POINT | It was the clear outlier in the primary six. At ~60s after fan-out it was the only primary section still running while 5/6 primary sections had committed. By ~120s it had rendered as complete. Later server log recorded `positioningCompetitorLandscape` timeout at `270000ms`, likely a duplicate/stale runner because the committed artifact was copyable from the reader. |

## Additional Health Checks

- Parent status / `children_complete`: exact `audit-state` JSON was not captured due the Codex browser API-navigation block. UI evidence showed the six positioning sections became available and capstones unlocked, so the reader reached the equivalent of six positioning artifacts available. I am not claiming a raw `parent_status === "complete"` read.
- Synthesis committed: yes.
- Paid Media Plan committed: no. It failed schema validation and rendered `Section needs review`.
- Competitor ad evidence: zero displayable creatives. The committed Competitor artifact says the ad-library tool surfaced `0` creatives across Google/Meta/LinkedIn groups. It also shows malformed advertiser parsing from onboarding seeds and budget exhaustion after 12 lookups.
- External spot-check: the surprising Brex/Capital One acquisition claim used throughout the artifacts is real as of 2026; Capital One announced the $5.15B acquisition on 2026-01-22 and completion on 2026-04-07.

## Bottom Line

Phase 1 mostly held up for the six primary positioning artifacts: VoC self-sourcing is fixed in the committed artifact, synthesis works, and the outputs stay on-goal. The biggest blocker before Phase 2 is not section quality; it is run integrity and tool/result provenance. Paid Media Plan failed schema validation, Demand labeled rows as SpyFu-estimated while saying SpyFu was rate-limited, and the reader/logs show stale failed worker statuses after committed artifacts rendered. I would not start Phase 2 threshold tuning until those status/provenance contradictions are resolved or explicitly accepted as known run-health debt.
