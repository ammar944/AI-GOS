# Handoff → Codex: Live E2E validation of the rebuilt competitor ad engine

**Author:** Claude · **Date:** 2026-06-03 · **Repo:** `/Users/ammar/Dev-Projects/AI-GOS` · **Run with:** `codex exec` at `-c model_reasoning_effort=xhigh`

> You (Codex) are validating a rebuilt competitor ad engine **against live APIs**, then reporting findings.
> This spends real paid-API money. Run **exactly one pass**. No retry loops beyond the tool's built-in
> `fetchWithRetry`. Honor every abort condition. Never print, log, or commit an API key value.

---

## GOAL

Run a one-shot **live** probe of the rebuilt competitor ad path on branch `feat/ad-engine-rebuild`, for a
small set of real competitors, and produce a findings report proving (or disproving) that the new
behavior holds in production: **no wrong-company ads and no non-English ads reach the verified wall, the
quarantine is populated honestly, identity tiering works, recency is captured, and Foreplay (if keyed)
surfaces video creatives.**

## NON-GOALS

- Do NOT run the full 6-section research pipeline (corpus + DeepSeek sections) — too slow/expensive and
  out of scope. Probe the **ad path only**.
- Do NOT modify engine source. This is read-only validation + a disposable test harness + a report.
- Do NOT loop or re-run on empty results. One pass. If a provider returns zero, record it and move on.
- Do NOT touch `main`, push, or open a PR.

## CONTEXT — what changed (so you know what "correct" looks like)

The engine now tags every ad with `identityVerified`/`identityBasis` (from the `resolveBestCandidate`
verdict: `accepted→verified`, `ambiguous→low`) and detects language. The adapter sets per-creative
`verified = identityVerified && isEnglish && advertiserName reconciles with the group`, and exposes
group `identityConfidence` + `quarantinedCount`. The UI splits verified (wall) vs low-confidence
(quarantine drawer). Key files:
- `src/lib/lab-engine/agents/tools/adlibrary.ts` — `adLibraryAgentTool.execute({advertiser, platform, max_results, domain})` (live SearchAPI). Output: `{type:'result', advertiser, platform, ads:[...]}` or a gap.
- `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts` — `buildCompetitorAdEvidenceGroups({steps, observedAt, returnedCreativeLimit?})` → `CompetitorAdEvidenceGroup[]` with `.creatives[].{verified,isEnglish,language,identityBasis,advertiserName,lastSeen}` and group `.identityConfidence`, `.quarantinedCount`.
- `src/lib/lab-engine/agents/tools/ad-language.ts` — `detectAdLanguage(text)`.
- `src/lib/foreplay/service.ts` — `createForeplayService()` (null if no `FOREPLAY_API_KEY`), `service.searchBrands({domain})`, `service.searchAds({brand_id, limit})`; `normalizeForeplayAd` in `tools/foreplay-normalize.ts`.
- **Reference for the exact `steps` shape** the adapter ingests: `src/lib/lab-engine/agents/tools/__tests__/competitor-ad-adapter.test.ts` (copy its `toolCalls`/`toolResults` structure, but feed it the **live** `execute()` output instead of fixtures).

## TARGET COMPETITORS (chosen to exercise the risk surface)

| Advertiser | Domain | Why |
|---|---|---|
| Gong | gong.io | Baseline — established advertiser, should yield verified ads |
| Ramp | ramp.com | **Short name (≤6 chars)** — the wrong-entity / same-name leak risk (Todd Rampe, JP 株式会社RAMP) |
| Notion | notion.so | **Global brand** — likely runs non-English creatives → exercises the language gate |

(If one yields nothing on all platforms, that's a data point, not a failure — record and continue.)

## STEPS

1. `git checkout feat/ad-engine-rebuild` (confirm: `git branch --show-current`). Do NOT change tracked source.
2. Load env into the process WITHOUT echoing it: `set -a; source .env.local; set +a`. Confirm presence only with a redacted check, e.g. `[ -n "$SEARCHAPI_KEY" ] && echo "SEARCHAPI_KEY: present"` (never print the value). Note whether `FOREPLAY_API_KEY` is present.
3. Write a **disposable** live harness as a vitest test, gated so it can NEVER run in CI:
   `src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.test.ts`, wrapped in
   `describe.skipIf(process.env.RUN_LIVE_AD_E2E !== '1')(...)`. For each competitor:
   - call `adLibraryAgentTool.execute({ advertiser, domain, platform, max_results: 15 }, { abortSignal: AbortSignal.timeout(20000) })` for `platform` in `['google','meta','linkedin']`;
   - assemble the live outputs into the `steps` shape (one toolCall+toolResult per platform, mirroring the adapter test), call `buildCompetitorAdEvidenceGroups({ steps, observedAt: new Date().toISOString() })`;
   - if `FOREPLAY_API_KEY` present: also call `createForeplayService().searchBrands({domain})` → first brand → `searchAds({brand_id, limit:6})` → `normalizeForeplayAd`, and fold those in as a `meta`/`linkedin` synthetic result tagged `identityVerified:true` (only if the brand's domain base matches the competitor domain base — mirror the run-section guard).
   - Collect, per competitor: verified count, quarantined count + reasons, distinct languages seen, identity bases, the actual `advertiserName` values surfaced, lastSeen coverage, Foreplay creative count.
4. Run it ONCE: `RUN_LIVE_AD_E2E=1 npx vitest run src/lib/lab-engine/agents/tools/__tests__/ad-engine.live.e2e.test.ts` (env already sourced in step 2). Capture stdout to the findings doc. **Redact any accidental key leakage.**
5. Delete the disposable harness after the run (`git status` must be clean of source changes; the only new tracked file is the findings doc).

## ACCEPTANCE CRITERIA (report PASS/FAIL with evidence for each)

1. **No wrong-company in the wall** — every `verified===true` creative's `advertiserName` is plausibly the target brand (spot-check Ramp especially; flag any "Todd Rampe", foreign RAMP, or unrelated entity).
2. **No non-English in the wall** — every `verified===true` creative has `isEnglish===true`; any foreign creatives appear only in quarantine with a correct `language`/reason.
3. **Quarantine honesty** — `group.quarantinedCount` equals the number of `verified!==true` creatives in the full unique set; a quarantined sample is present in `.creatives`.
4. **Identity tiering** — at least Gong yields ≥1 verified creative; short-name Ramp does not surface an unverified same-name entity as verified.
5. **Recency** — creatives carry `lastSeen` where the provider supplies it; ranking favors recent+rich.
6. **Foreplay** — if keyed: video/transcript creatives appear and are domain-corroborated. If not keyed: graceful no-op, SearchAPI-only, no crash.
7. **Robustness** — no unhandled exception; single pass; all live calls bounded by the 20s timeout.
8. **Cost** — report approximate paid-API spend (count of SearchAPI + Foreplay calls).

## VERIFY (commands that prove the run happened)

- `git branch --show-current` → `feat/ad-engine-rebuild`
- The vitest run exits without unhandled errors and prints per-competitor structured output.
- `git status` shows no modified tracked source (harness deleted), only the new findings doc.

## DELIVERABLE

Write findings to **`docs/handoffs/2026-06-03-ad-engine-e2e-FINDINGS.md`**:
- A per-competitor table (advertiser · platforms hit · verified count · quarantined count · languages · identity bases · sample headlines · anomalies).
- PASS/FAIL for each of the 8 acceptance criteria, with concrete evidence (real advertiser names / headlines observed).
- Any **P1 bug** (a wrong-company or non-English creative that reached the verified wall) with the exact creative + why it slipped.
- Approximate API spend.
- A one-paragraph verdict: is the rebuilt engine behaviorally correct in production, yes/no, and what (if anything) to fix.

Then summarize the verdict + any P1 back to the caller in your final message.

## GUARDRAILS (non-negotiable)

- One pass. No loops. No "let me try a few more competitors to get ads" — the 3 above only.
- Never print/log/commit a key. Source `.env.local` silently; redact output.
- If `SEARCHAPI_KEY` is absent → STOP and report "cannot run: SEARCHAPI_KEY not in .env.local" (do not invent results).
- Do not edit engine source, do not push, do not open a PR.
