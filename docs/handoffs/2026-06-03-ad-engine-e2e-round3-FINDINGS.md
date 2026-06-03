# Round 3 Live E2E Findings - Competitor Ad Engine

Date: 2026-06-03  
Repo: `/Users/ammar/Dev-Projects/AI-GOS-spine`  
Branch: `feat/ad-engine-rebuild`  
HEAD before and after live run: `b7510d66 docs(ad-engine): record verified-domain spine round + Round-3 E2E gate`  
Observed at: `2026-06-03T06:56:52.534Z`  
Harness: `src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.round3.test.ts` (disposable; deleted after findings)  
Command executed once: `RUN_LIVE_AD_E2E=1 npx vitest run src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.round3.test.ts`

## Pre-Flight

Executed in `/Users/ammar/Dev-Projects/AI-GOS-spine` only.

```text
BRANCH=feat/ad-engine-rebuild
HEAD=b7510d66 docs(ad-engine): record verified-domain spine round + Round-3 E2E gate
OK_LANG
OK_SPINE
```

`.env.local` was sourced silently. The run output recorded only env presence booleans, never key values.

## Run Result

The live probe executed once and printed the structured result block. Vitest then failed on the harness's automated V4 assertion:

```text
AssertionError: Ramp verifiedCount=1, suspiciousVerified=0, financeCue=false.
```

That was a harness heuristic issue: the returned verified Ramp creative is a real Ramp accounting/bookkeeping ad, but the heuristic did not include `accounting`/`bookkeeping` as finance cues. No rerun was performed. The behavioral verdict below is based on the captured live evidence from that single run.

Spend / fetch count observed:

- SearchAPI: 15 fetches
- Foreplay: 11 fetches
- Other: 0 fetches

The Foreplay count exceeded the expected approximate 9 because the existing Foreplay service retried Notion 400 `Domain is excluded` responses and tried domain variants before the 9s prepass timeout. The harness added no retry loop.

## Verdict

PASS for required V1-V4 based on live data. V5 is measurement-only and showed no wall regression.

- V1 PASS: Croatian Gong copy was `isEnglish:false`, `language` in `bs`/`hr`/`sr`, and quarantined.
- V2 PASS: Foreplay returned 6 Gong ads and 6 Ramp ads, all with video/transcript, with no `brand.domain.trim()` crash.
- V3 PASS: Gong Meta page resolution was `ambiguous` on `gong.hr`; SearchAPI Meta ads were `identityVerified:false` and quarantined. Gong verified wall contained Foreplay-only `gong.io` revenue-platform ads.
- V4 PASS: Ramp verified wall contained a real Ramp finance/accounting creative. SearchAPI Ramp ads were conservatively quarantined because Meta page alias `rampcard` did not domain-corroborate `ramp.com`.
- V5 MEASUREMENT: Notion Foreplay was excluded. Meta page search resolved accepted to `page_alias=NotionHQ`; verified wall count was 15 (>0), so no wall regression.

## Per-Target Summary

| Target | Meta verdict | Resolved page_id | page_alias | Raw counts | Verified full / returned | Quarantined full | Foreplay ads | SearchAPI Meta identityVerified:false |
|---|---|---:|---|---|---:|---:|---:|---:|
| Gong / `gong.io` | `ambiguous` | `135611546456409` | `gong.hr` | google 0, meta 21, linkedin 0 | 6 / 6 | 15 | 6 | 15 / 15 |
| Ramp / `ramp.com` | `ambiguous` | `103437121012366` | `rampcard` | google 0, meta 21, linkedin 0 | 1 / 1 | 20 | 6 | 15 / 15 |
| Notion / `notion.so` | `accepted` | `825120160874613` | `NotionHQ` | google 15, meta 0, linkedin 0 | 15 / 6 | 0 | 0 | 0 / 0 |

## Creative Classification

### Gong

| # | wall | platform | source | advertiser | language | isEnglish | verified | identityBasis | sample |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 2 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 3 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 4 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 5 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 6 | verified | meta | foreplay | Gong | en | true | true | domain | Gong is a better way to revenue |
| 7 | quarantined | meta | SearchAPI | Gong | bs | false | false | ambiguous | `IZAĐIMO DA NAS ČUJU! Hrvatska... europske izbore...` |
| 8 | quarantined | meta | SearchAPI | Gong | bs | false | false | ambiguous | `Izađimo da nas čuju: Evo zašto je važno glasati...` |
| 9 | quarantined | meta | SearchAPI | Gong | hr | false | false | ambiguous | `NEKA SE TVOJ GLAS ČUJE - IZAĐI NA IZBORE... Hrvatska...` |
| 10 | quarantined | meta | SearchAPI | Gong | bs | false | false | ambiguous | `Kako EU državljani i državljanke mogu glasati...` |
| 11 | quarantined | meta | SearchAPI | Gong | sr | false | false | ambiguous | `Šest pitanja za Dubravku Šuicu` |
| 12 | quarantined | meta | SearchAPI | Gong | hr | false | false | ambiguous | `...vladavine prava u Hrvatskoj... https://gong.hr/...` |

### Ramp

| # | wall | platform | source | advertiser | language | isEnglish | verified | identityBasis | sample |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | verified | meta | foreplay | Ramp | en | true | true | domain | `Agentic accounting at 98% trust.` Body references Ramp Accounting Agent and bookkeeping. |
| 2 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Automate the busywork` |
| 3 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Automate the busywork` |
| 4 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Open in under a minute.` |
| 5 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Close your books faster with automated expenses.` |
| 6 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Meet the $32B Finance Platform.` |
| 7 | quarantined | meta | SearchAPI | Ramp | en | true | false | ambiguous | `Meet the $32B Finance Platform.` |

### Notion

| # | wall | platform | source | advertiser | language | isEnglish | verified | identityBasis | sample |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |
| 2 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |
| 3 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |
| 4 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |
| 5 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |
| 6 | verified | google | SearchAPI | Notion Limited | und | true | true | domain | image-only Google row |

## V1-V5 Detail

### V1 - Croatian Gong Copy

PASS. SearchAPI Meta returned 15 Gong rows from the Croatian `gong.hr` page. All 15 raw Meta rows had `identityVerified:false`; the returned quarantine sample included languages `bs`, `hr`, and `sr`, all with `isEnglish:false`, `verified:false`, `identityBasis:"ambiguous"`.

No non-English Gong creative reached the verified wall.

### V2 - Foreplay Gong + Ramp

PASS. Foreplay returned:

- Gong: 6 normalized creatives, 6 with video/transcript.
- Ramp: 6 normalized creatives, 6 with video/transcript.

No `Cannot read properties of undefined (reading 'trim')` or equivalent `brand.domain.trim()` crash occurred.

### V3 - Gong Verified Wall

PASS. Meta page search for `q=Gong` resolved to:

```json
{
  "verdict": "ambiguous",
  "page_id": "135611546456409",
  "page_alias": "gong.hr",
  "page_name": "Gong"
}
```

Resolution reason:

```text
Short name "Gong" (<=6 chars) with verified domain "gong.io": no candidate corroborates domain base "gong". Accepting top candidate "Gong" (1.00) provisionally - downstream guards will re-check.
```

Result: the SearchAPI Meta ads were quarantined. Gong's verified wall had exactly 6 returned creatives, all from Foreplay, all English revenue-platform ads for Gong.

### V4 - Ramp Verified Wall

PASS by live evidence. Meta page search for `q=Ramp` resolved to:

```json
{
  "verdict": "ambiguous",
  "page_id": "103437121012366",
  "page_alias": "rampcard",
  "page_name": "Ramp"
}
```

The verified wall contained one Ramp Foreplay creative:

```text
Headline: Agentic accounting at 98% trust.
Body: Neusha Sayadian (CFO, Valence) cut the operational drag to focus on what matters: Growth. See how the Ramp Accounting Agent handles the day-to-day bookkeeping so you don't have to.
```

No Todd Rampe / foreign RAMP / unrelated same-name creative reached the verified wall. The real SearchAPI Ramp finance ads were conservatively quarantined as `identityBasis:"ambiguous"` because `rampcard` is not a domain-shaped alias for `ramp.com`.

### V5 - Notion Measurement

MEASUREMENT, not a pass/fail gate. Foreplay excluded `notion.so`:

```text
Foreplay API error: 400 Bad Request ... "Domain is excluded", "domain":"notion.so"
```

Notion final Meta verdict:

```json
{
  "verdict": "accepted",
  "page_id": "825120160874613",
  "page_alias": "NotionHQ",
  "page_name": "Notion"
}
```

The real Notion page's page alias is `NotionHQ`. Notion verified-wall creative count was 15 full / 6 returned, so the conservative gate did not zero the wall. Those verified creatives came from Google (`advertiserName:"Notion Limited"`); Meta page resolution accepted the page but returned 0 displayable Meta rows in this pass.

## Raw Notion Meta Page Search

Captured from the live `meta_ad_library_page_search?q=Notion` response. Fields dumped: `page_id`, `name`, `page_alias`, `category`, `verification`.

| # | page_id | name | page_alias | category | verification |
|---:|---|---|---|---|---|
| 1 | 825120160874613 | Notion | NotionHQ | Product/service | NOT_VERIFIED |
| 2 | 107045415592872 | Notionnovel. | null | Product/service | NOT_VERIFIED |
| 3 | 102676449370339 | Notionnovel- | null | Product/service | NOT_VERIFIED |
| 4 | 725544923977305 | Notiontion | null | Internet Marketing Service | NOT_VERIFIED |
| 5 | 243918562344 | NOTION | NotionMagazine | Media/News Company | BLUE_VERIFIED |
| 6 | 1070971606103057 | Neighborly Notions | null | Advertising Agency | NOT_VERIFIED |
| 7 | 544870928878975 | Notion | notiondjofficial | Artist | NOT_VERIFIED |
| 8 | 109967768345953 | Notion World | null | Visual Arts | NOT_VERIFIED |
| 9 | 144370472098280 | Oliver Notion | null | Digital creator | NOT_VERIFIED |
| 10 | 109878298264839 | Notion Is Sailing | null | Travel & Transportation | NOT_VERIFIED |
| 11 | 101277445863988 | RetailNotion | null | Shopping Service | NOT_VERIFIED |
| 12 | 191485430719111 | Funny notions | null | Digital creator | NOT_VERIFIED |
| 13 | 105737334859921 | Foggy Notions | foggynotionslive | Arts & Entertainment | NOT_VERIFIED |
| 14 | 103230015692608 | MarketNotion | null | Shopping Service | NOT_VERIFIED |
| 15 | 468499340014570 | notiOne | notiOneOfficial | Producer | NOT_VERIFIED |

## Remaining Notes

- SearchAPI spend matched the expected 15 fetches.
- Foreplay spend was 11 fetches because its service retried Notion's 400 response before timeout. This is worth tightening separately if strict paid-call ceilings matter.
- The verified-domain spine is conservative for non-domain-shaped but legitimate aliases such as `rampcard` and `NotionHQ`. Notion still passed because exact-name resolution accepted it; Ramp's SearchAPI rows quarantined and Foreplay carried the verified wall.
- No tracked source change is required; the harness was disposable and removed after this report.
