# Handoff → Codex: Round-2 live E2E — validate fixes + capture data for the verified-domain spine

**Author:** Claude · **Date:** 2026-06-03 · **Repo:** `/Users/ammar/Dev-Projects/AI-GOS` · **Branch:** `feat/ad-engine-rebuild` (now clean — 6 ad-engine commits, no profile work) · **Run with:** `codex exec -c model_reasoning_effort=xhigh`

> Live run against paid APIs. **One pass.** No retry loops beyond the tool's built-in `fetchWithRetry`.
> Never print/log/commit an API key value. Same ~cents cost as Round 1 (3 competitors).

---

## GOAL

Two things in one run:
1. **Validate the Round-2 fixes** behaviorally: the Croatian "Gong" creatives must now be **quarantined**
   (not verified), and **Foreplay must surface creatives** for at least one competitor (no crash).
2. **Capture diagnostic data to unblock the verified-domain spine**: dump the RAW Meta `page_search`
   response for "Gong" and the RAW Foreplay brand response, so we can see which field distinguishes the
   real `gong.io` page from the Croatian `gong.hr` page, and what shape the Foreplay brand actually has.

## CONTEXT — what changed since the Round-1 FAIL (see `2026-06-03-ad-engine-e2e-FINDINGS.md`)

Round 1 found: (P1.2) Croatian GONG civic creatives classified `isEnglish:true` and reached the wall;
(P1.6) Foreplay crashed (`brand.domain.trim()` on undefined) → 0 creatives; (P1.1) Meta resolved
`q=Gong` → the Croatian GONG page, not `gong.io`. Round-2 fixes (this branch):
- `ad-language.ts` now uses **`franc-min`** (statistical detector) as primary — Croatian/Polish/Turkish/
  Dutch are caught. So the Croatian Gong creatives should now be `isEnglish:false` → quarantined.
- The Foreplay prepass guard (`run-section.ts`) is now **null-safe** and rejects only on a *conflicting*
  brand domain (falls back to the name match when `brand.domain` is absent) → Foreplay should run.
- P1.1 (wrong page) is only PARTIALLY fixed by language. The real fix needs the page candidate's
  website/domain, which `readCandidates` does not currently capture — hence the diagnostic capture below.

## TARGET COMPETITORS (same as Round 1, for comparability)

Gong / gong.io · Ramp / ramp.com · Notion / notion.so

## STEPS

1. `git checkout feat/ad-engine-rebuild` (confirm `git branch --show-current`; this branch no longer
   contains the v3 profile-save commit). Do NOT edit tracked engine source.
2. `set -a; source .env.local; set +a` (silently). Confirm presence only: `[ -n "$SEARCHAPI_KEY" ] && echo present` (never echo the value). Note `FOREPLAY_API_KEY` presence.
3. Write a **disposable**, CI-gated harness `src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.round2.test.ts` (`describe.skipIf(process.env.RUN_LIVE_AD_E2E !== '1')`). It must:
   - For each competitor, run the live probe exactly as Round 1 (`adLibraryAgentTool.execute({advertiser, domain, platform, max_results:15}, {abortSignal: AbortSignal.timeout(20000)})` for google/meta/linkedin → `buildCompetitorAdEvidenceGroups`), and exercise Foreplay (`createForeplayService().searchBrands({domain})` → `searchAds`).
   - Collect per competitor: verified count, quarantined count + each quarantined creative's `language`/reason, every verified creative's `advertiserName`+`isEnglish`+sample headline, Foreplay creative count + whether any has video/transcript.
   - **DIAGNOSTIC DUMP (the important new part):**
     - Call SearchAPI **directly** for `engine=meta_ad_library_page_search&q=Gong` (the same endpoint the tool uses; reuse `fetchSearchApiJson` or a raw fetch to `https://www.searchapi.io/api/v1/search`). Print the FULL JSON of every entry in `page_results` (all fields — id, name, and especially any website / page_alias / link / category / verification / likes / ig_username / page_profile_uri). This is public ad-library data; only the `api_key` query param must never be printed.
     - Print the FULL raw Foreplay `getBrandsByDomain` response for `gong.io` (every field of `data[0]` — confirm whether a domain/website/url field exists and under what key).
4. Run ONCE: `RUN_LIVE_AD_E2E=1 npx vitest run src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.round2.test.ts`. Capture stdout. Redact any accidental key leakage.
5. Delete the disposable harness; `git status` clean of source changes (only the new findings doc is added).

## VALIDATION CRITERIA (PASS/FAIL with evidence)

- **V1 — Croatian quarantined:** the Croatian "Gong" creatives are now `verified:false`, `isEnglish:false`,
  `language` ∈ {hr, sr, bs, …}, and appear in the quarantine, NOT the verified wall. (This is the core
  Round-2 regression check.)
- **V2 — Foreplay alive:** for at least one of Gong/Ramp, Foreplay returns ≥1 creative with no
  `Cannot read properties of undefined` crash. Note video/transcript presence.
- **V3 — No non-English in any verified wall** (Gong/Ramp/Notion).
- **V4 — Ramp still clean** (no Todd Rampe / foreign RAMP in the wall).

## DIAGNOSTIC FINDINGS (for the verified-domain spine — the real P1.1 fix)

- **D1:** From the raw Meta `page_search` for "Gong", list every field present per page candidate, and
  state which field(s) would let us pick `gong.io` (Gong revenue AI) over the Croatian GONG NGO — e.g.
  a website/domain field, page category ("Software" vs "Non-Governmental Organization"), verification, or
  follower count. Quote the actual values for the real Gong vs the Croatian GONG entries.
- **D2:** From the raw Foreplay brand response, list the brand object's fields and whether any
  domain/website/url is present (and its key), so the prepass guard can use it reliably.
- **D3:** Recommend the concrete field + matching rule for `resolveBestCandidate` to select the
  domain-corroborated page (this is what Claude will implement next).

## DELIVERABLE

Write `docs/handoffs/2026-06-03-ad-engine-e2e-round2-FINDINGS.md`:
- V1–V4 PASS/FAIL with concrete evidence (real advertiser names, headlines, languages observed).
- The raw `page_search` JSON capture for "Gong" (or the relevant fields per candidate) and the raw
  Foreplay brand fields.
- D3 recommendation (which field + rule unblocks the spine).
- Approximate spend (fetch counts).
- One-paragraph verdict: did Round 2 fix the two confirmed P1s, yes/no.

Then summarize the verdict + the D3 recommendation back to the caller.

## GUARDRAILS

One pass, no loops. Never print/commit a key (only the `page_results` content, which is public). If
`SEARCHAPI_KEY` is absent → STOP and report. Do not edit engine source, do not push, do not open a PR.
