# Phase-0 live E2E audit findings - notion.so

Run ID: `a4671da7-6577-43fc-a3a2-d6e9e1a87bf2`
Artifact ID: `24c3deac-8179-415d-8e5a-7ea89b40eb46`
Submitted from Codex in-app browser at `2026-06-01T05:05:38.030Z`.

No source files were edited while the live run was active.

## Executive verdict

B3 ads: no real ad creatives rendered. This was not a missing-key/credential failure: `SEARCHAPI_KEY` was present in the runtime config, and DB events show `google_ads`, `meta_ads`, and `adlibrary` tools actually ran. The failure mode was advertiser matching plus budget exhaustion: Google/Meta could not match the malformed competitor strings with enough confidence, and later clean-name checks hit `section budget exhausted after 12 lookups`.

B4 latency: CompetitorLandscape was the outlier at 186s wall-clock. DB events record 4 `repair-started` events for the same section run; the UI visibly showed 2 repairs at `/tmp/aigos-fanout-02-40s.png` and 3 repairs at `/tmp/aigos-fanout-03-final-or-running.png` before commit. The repair loop, not the initial ad probe alone, consumed most of the delay.

## B3 - competitor ads

Verdict: confirmed empty/gap state. No displayable creatives were committed.

Browser evidence:

- `/tmp/aigos-competitor-scroll-01.png` shows the committed competitor card reporting `Ad presence: Google - unknown - no displayable ad creative returned`.
- `/tmp/aigos-competitor-ad-evidence-visible.png` shows the ad evidence gap state: no matched advertisers, LinkedIn not queryable, and lookup-capped rows for Confluence and Coda.

DB evidence:

- `research_artifact_sections.zone='positioningCompetitorLandscape'`, `status='complete'`, `updated_at='2026-06-01T05:08:57.659744+00:00'`.
- `data.body.adEvidence.advertiserGroups[*].creatives` is `[]`.
- `returnedCreativeCount=0`, `displayableTotal=0`, and `displayableCounts.google/meta/linkedin=0` across committed advertiser groups.
- Committed source errors include:
  - `No google advertiser matched "Confluence (Atlassian) - enterprise wiki/docs" with sufficient confidence.`
  - `No meta advertiser matched "Confluence (Atlassian) - enterprise wiki/docs" with sufficient confidence.`
  - `section budget exhausted after 12 lookups`
  - `LinkedIn ad library is not queryable via the current SearchAPI integration`

Event evidence:

- `google_ads`: 7 started / 7 finished, first `2026-06-01T05:05:59.687766+00:00`, last `2026-06-01T05:06:14.661979+00:00`.
- `meta_ads`: 7 started / 7 finished, first `2026-06-01T05:06:00.003604+00:00`, last `2026-06-01T05:06:14.980294+00:00`.
- `adlibrary`: 6 started / 6 finished, first `2026-06-01T05:06:10.097444+00:00`, last `2026-06-01T05:06:19.147281+00:00`.

So what: Step-zero should not be "add key"; the live runtime reached the tools. Fix the ad probe input normalization and budget policy first: parse competitor names/domains cleanly, avoid descriptive suffixes as advertiser queries, and keep LinkedIn/Foreplay represented as explicit unsupported channels instead of implied zeros.

## B4 - CompetitorLandscape latency and repair rate

Verdict: measured. CompetitorLandscape was the slowest base section and triggered repeated validation repair.

Section wall-clock from `research_section_runs`:

| Zone | Status | Started | Completed | Wall-clock |
| --- | --- | --- | --- | --- |
| positioningOfferDiagnostic | complete | 05:05:50.892Z | 05:06:39.949631Z | 49s |
| positioningBuyerICP | complete | 05:05:51.481Z | 05:07:04.585559Z | 73s |
| positioningMarketCategory | complete | 05:05:51.489Z | 05:07:00.879427Z | 69s |
| positioningVoiceOfCustomer | complete | 05:05:52.017Z | 05:06:50.041005Z | 58s |
| positioningDemandIntent | complete | 05:05:52.104Z | 05:06:57.219906Z | 65s |
| positioningCompetitorLandscape | complete | 05:05:52.122Z | 05:08:57.659744Z | 186s |
| positioningSynthesis | complete | 05:08:57.969Z | 05:09:40.057807Z | 42s |
| positioningPaidMediaPlan | complete | 05:08:57.915Z | 05:09:49.449650Z | 52s |

Repair evidence from `research_section_events` for section run `d10e99d8-1e95-4afe-9af6-bcc837377255`:

- `2026-06-01T05:07:29.081448+00:00` - repair started, `grounding 10 unsupported claim(s)`.
- `2026-06-01T05:07:45.075805+00:00` - repair started, `grounding 9 unsupported claim(s)`.
- `2026-06-01T05:08:07.924658+00:00` - repair started, `grounding 10 unsupported claim(s)`.
- `2026-06-01T05:08:19.782913+00:00` - repair started, `grounding 9 unsupported claim(s)`.

The validation failures were mostly unsupported ad transparency/library URL claims created from the ad gap objects. The ad tools themselves ran from roughly 05:05:59 to 05:06:19, while first validation failure did not land until 05:07:28 and final commit landed at 05:08:57. Rough split: ad probe/tooling was about 20s wall-clock, initial generation plus evidence work was about 96s from section start to first validation failure, and validation/repair occupied about 89s from first repair to commit.

So what: attack the repair loop and ad-gap URL grounding first. Moving ad probes off the critical path helps, but the bigger live delay came from repeated answer validation failures on unsupported ad-library URLs.

## B1 - visibility and reader behavior

Verdict: partially confirmed in live browser. The run captured several visibility defects, but not a clean side-by-side "silent section next to active section" proof in the narrow Codex browser viewport.

Confirmed browser evidence:

- `/tmp/aigos-fanout-00-after-submit.png`: immediate post-submit card showed `Queued - this section will begin once a worker is free`.
- `/tmp/aigos-fanout-01-15s.png`: the view stayed on completed Market & Category while the side rail showed Competitors still running. This confirms at least a transient auto-active/pinning lag while another section was still active.
- `/tmp/aigos-fanout-02-40s.png`: Competitors showed real activity rows plus decorative pulse bars underneath them.
- `/tmp/aigos-fanout-03-final-or-running.png`: Competitors still running with `3 repairs` visible before final commit.

Not fully proven in this run:

- I did not capture a DB-running section mislabeled `Queued`; the queued screenshot was immediately after submit before the section run rows were visible.
- I did not capture a side-by-side silent-section starvation state. The Codex browser viewport rendered a narrow/mobile-like layout, so it did not show multiple section activity feeds simultaneously.

So what: the skeleton bars and active-section pinning are confirmed UI issues. The global-limit starvation hypothesis still needs a wider viewport or instrumented audit-state sample during a concurrent multi-section run.

## Bonus - provider reasoning / step.text

Verdict: no reasoning feed content observed.

DB evidence:

- All completed section runs recorded `model='deepseek-v4-flash'` and `provider='deepseek-direct'`.
- Searching `research_section_events` after submit for `reasoning`, `step.text`, `thinking`, `thought`, `deepseek`, `sonnet`, and `model` returned 0 event hits.

Dev-log evidence:

- Dev logs only showed AI SDK warnings for `deepseek.chat / deepseek-v4-flash` response format support.
- No `reasoning`, `step.text`, or `thinking` log lines appeared in the captured dev log window.

So what: B2 streaming should not assume reasoning text exists for this provider path. The feed needs to be built from durable tool/validation/subsection events unless provider reasoning is explicitly enabled and persisted.

## Other run notes

- The UI exposed 8 sections. After the six base positioning sections completed, Synthesis and Paid Media Plan auto-started and completed. The handoff expected them to stay locked until 6/6, but this live run completed all 8 sections by `2026-06-01T05:09:49.449650Z`.
- `positioningVoiceOfCustomer` has a suspicious telemetry mismatch: `research_section_runs.status='complete'`, artifact section status is `complete`, and no artifact error is stored, but telemetry says `phase='Needs review'` and `latestActivity='positioningVoiceOfCustomer failed'`.
- The dev log window still contained the pre-existing onboarding auto-fill evidence: `POST /api/onboarding/research 200 in 77s`, after scraping 11/12 Notion pages. I did not re-run auto-fill.

## Evidence inventory

- Brief screenshots: `/tmp/aigos-brief-step-1.png` through `/tmp/aigos-brief-step-7.png`, plus `/tmp/aigos-brief-step-8-before-submit.png`.
- Fan-out screenshots: `/tmp/aigos-fanout-00-after-submit.png`, `/tmp/aigos-fanout-01-15s.png`, `/tmp/aigos-fanout-02-40s.png`, `/tmp/aigos-fanout-03-final-or-running.png`, `/tmp/aigos-fanout-04-all-complete.png`.
- Ad evidence screenshots: `/tmp/aigos-competitor-scroll-01.png`, `/tmp/aigos-competitor-ad-evidence-visible.png`.
