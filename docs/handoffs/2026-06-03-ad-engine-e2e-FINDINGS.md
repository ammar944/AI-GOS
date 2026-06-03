# Live E2E Findings - Rebuilt Competitor Ad Engine

Date: 2026-06-03  
Branch: `feat/ad-engine-rebuild`  
Repo: `/Users/ammar/Dev-Projects/AI-GOS`  
Observed at: `2026-06-03T05:04:01.637Z`  
Command: `RUN_LIVE_AD_E2E=1 npx vitest run src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.test.ts`  
Result: Vitest passed, 1 test, 41.81s. This was one live pass only.

Environment gate:

- `SEARCHAPI_KEY`: present
- `FOREPLAY_API_KEY`: present

Spend:

- SearchAPI fetches observed: 15
- Foreplay fetches observed: 9
- Other fetches observed: 0

## Verdict

FAIL. The rebuilt engine is not behaviorally correct in production.

Two P1 failures reached the verified wall:

1. Wrong-company ads reached the wall for target `Gong` / `gong.io`. The verified Meta creatives are Croatian civic/election ads for a different Gong entity, not Gong's revenue platform.
2. Non-English Croatian copy reached the wall as `verified: true`, `isEnglish: true`, `language: "en"`.

The Ramp short-name case looked clean in this pass: displayed verified Ramp creatives were plausibly Ramp finance-platform ads. Foreplay did not surface any video/transcript creatives despite the key being present.

## Per-Competitor Summary

| Advertiser | Platforms hit | Verified | Quarantined | Languages | Identity bases | Sample headlines / copy | Anomalies |
|---|---:|---:|---:|---|---|---|---|
| Gong (`gong.io`) | Google 0, Meta 15, LinkedIn 0 | 6 displayed / 15 displayable | 0 | `en` reported | `domain` | `Izađimo da nas čuju: Evo zašto je važno glasati na parlamentarnim izborima!`; `Kako EU državljani i državljanke mogu glasati na lokalnim izborima u Hrvatskoj?`; copy includes `Hrvatska`, `izbore`, `glasanje`, and `https://gong.hr/...` | P1 wrong-company and P1 non-English in verified wall |
| Ramp (`ramp.com`) | Google 0, Meta 15, LinkedIn 0 | 6 displayed / 15 displayable | 0 | `en` | `domain` | `Automate the busywork`; `Open in under a minute.`; `Meet the $32B Finance Platform.` | No wrong-company sample observed |
| Notion (`notion.so`) | Google 15, Meta 0, LinkedIn 0 | 6 displayed / 15 displayable | 0 | `und` | `domain` | Google image-only rows, advertiser `Notion Limited`, no headline/body in displayed rows | No non-English copy visible, but no `lastSeen` coverage |

## Acceptance Criteria

1. No wrong-company in the wall: FAIL  
   Gong verified creatives are for Croatian election/civic content, not `gong.io` revenue AI. Evidence: displayed creative `advertiserName: "Gong"`, `verified: true`, `identityBasis: "domain"`, body starts `IZAĐIMO DA NAS ČUJU! Hrvatska...`, and another displayed body links to `https://gong.hr/2024/08/20/...`.

2. No non-English in the wall: FAIL  
   The same Gong creatives are Croatian, but the adapter emitted `isEnglish: true`, `language: "en"`, `verified: true`. This means the language gate did not quarantine Latin-script Croatian.

3. Quarantine honesty: FAIL  
   The Gong group reported `quarantinedCount: 0` while violating creatives reached the verified wall. Internally the count is consistent with the engine's misclassification, but behaviorally the quarantine is not populated honestly.

4. Identity tiering: FAIL overall, PASS for Ramp-only short-name spot check  
   Ramp did not show Todd Rampe / JP RAMP / unrelated same-name ads in the displayed wall. But the Gong same-name collision proves identity tiering still accepts a wrong same-name entity as verified when candidate/ad rows lack usable domain corroboration.

5. Recency: PARTIAL PASS  
   12 of 18 displayed creatives carried `lastSeen`. Ramp and Gong Meta rows had `lastSeen`; Notion Google image rows had `lastSeen: null`.

6. Foreplay: FAIL  
   `FOREPLAY_API_KEY` was present, but no Foreplay creatives reached the evidence groups. Gong and Ramp brand search found brands, then the prepass failed with `Cannot read properties of undefined (reading 'trim')` because the returned brand object did not expose `domain` in the expected shape. Notion Foreplay returned repeated 400s for `Domain is excluded`, then the 9s prepass timeout fired. Result: `foreplayCreativeCount: 0`, `foreplayVideoOrTranscriptCount: 0`.

7. Robustness: PASS  
   The run completed without unhandled exceptions. The ad-library calls used `AbortSignal.timeout(20000)`, and the Foreplay prepass was bounded by 9000ms. Provider failures were preserved as source errors.

8. Cost: PASS  
   Actual observed network counts were 15 SearchAPI fetches and 9 Foreplay fetches.

## P1 Bugs

### P1 - Wrong Gong entity verified

Target: `Gong` / `gong.io`  
Provider: Meta via SearchAPI  
Group: `advertiserName: "Gong"`, `identityConfidence: "verified"`, `identityBasis: "domain"`  
Counts: `rawCounts.meta: 15`, `displayableTotal: 15`, `returnedCreativeCount: 6`, `quarantinedCount: 0`

Evidence from displayed verified creatives:

- Body: `IZAĐIMO DA NAS ČUJU! Hrvatska kao najmlađa članica Europske unije...`
- Headline: `Izađimo da nas čuju: Evo zašto je važno glasati na parlamentarnim izborima!`
- Headline: `Kako EU državljani i državljanke mogu glasati na lokalnim izborima u Hrvatskoj?`
- Body includes a `gong.hr` URL: `https://gong.hr/2024/08/20/dvije-strane-iste-medalje-komisija-stavila-ruzicaste-naocale-u-izbornoj-godini/`

Why it slipped: the engine accepted same-name `Gong` rows as verified even though the creative content and visible URL point to a Croatian civic/election organization, not `gong.io`. The final wall check reconciles `advertiserName` to the target brand name but does not have enough per-creative domain evidence to reject this same-name collision.

### P1 - Croatian copy classified as English

Target: `Gong` / `gong.io`  
Provider: Meta via SearchAPI  
Displayed state: `isEnglish: true`, `language: "en"`, `verified: true`

Evidence from displayed verified creatives includes Croatian phrases:

- `Izađimo da nas čuju`
- `Hrvatska`
- `izbore`
- `građani i građanke`
- `vladavine prava u Hrvatskoj`

Why it slipped: `detectAdLanguage()` treats Latin-script languages as non-English only for a small set of Spanish, German, French, Portuguese, and Italian markers, plus a diacritic-density backstop. Croatian text with sparse diacritics can fall through to the default English path.

## Raw Stdout Capture

The live run's structured stdout block is captured below. Foreplay's verbose provider logs were reviewed during the run; the finding-critical values are the result block, the Foreplay error strings, and the concrete creative samples above.

```json
{
  "acceptance": {
    "noWrongCompanyInWall": "PASS",
    "noNonEnglishInWall": "PASS",
    "quarantineHonesty": "PASS",
    "identityTiering": "PASS",
    "recency": "PASS: 12/18 displayed creatives carry lastSeen",
    "foreplay": "FAIL: FOREPLAY_API_KEY present but Foreplay returned 0 displayed creatives and 0 video/transcript creatives",
    "robustness": "PASS: test completed; ad tool calls used AbortSignal.timeout(20000), Foreplay prepass used 9000ms timeout",
    "cost": "PASS: actual fetch counts reported in spend"
  },
  "fetchCounts": {
    "foreplay": 9,
    "other": 0,
    "searchApi": 15
  },
  "observedAt": "2026-06-03T05:04:01.637Z"
}
```

Note: the generated `acceptance.noWrongCompanyInWall` and `acceptance.noNonEnglishInWall` fields are not accepted as the final verdict because they reused the same engine predicates under test. The manual evidence review above overrides them.
