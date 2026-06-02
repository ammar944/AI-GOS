# Competitor Ad Engine Rebuild — Design

**Date:** 2026-06-03 · **Branch:** `feat/ad-engine-rebuild` · **Status:** approved, executing

## Problem

The live competitor-ad pipeline (Audit Reader › Competitor Landscape) surfaces ads that are (a)
the wrong company, (b) unrelated, (c) non-English. Triangulated across a first-hand read, an
independent Codex (xhigh) pass, and an 18-agent workflow (7/9 hypotheses confirmed):

| # | Symptom | Confirmed root cause |
|---|---------|----------------------|
| H1 | wrong company | `isDomainVerified` faked as `domain !== undefined` (`adlibrary.ts:504/561`); for bare-name seeds every domain guard no-ops → name-only matching |
| H2 | wrong company | `ambiguous` verdict treated as accept — only `rejected` throws (`adlibrary.ts:508/565`); the matcher's uncertainty is discarded |
| H3 | non-English | zero language handling anywhere — no detection, no `hl/gl`/country params, no schema field |
| H4 | unrelated | `slice(0,4)` before filtering; ranking is pure media-richness (no relevance/recency) |
| H5 | wrong company | Foreplay prepass guard omits `adUrl` → short-name URL guard can't fire |
| H7 | stale | `active_status:"all"`, `isActive` defaults true, no recency ranking |
| H9 | masking | gate rubber-stamps on `rawSourceSamples.length>0`; group keyed on **requested** name, so wrong-company creatives hide under the right heading (advertiserName never reconciled) |

## Decisions (user-approved)

1. **Hybrid wall** — main wall shows only verified + on-language creatives; low-confidence / foreign
   / advertiser-mismatched go to a collapsed quarantine with a reason. Nothing silently dropped.
2. **Blended ranking, no new infra** — identity-confidence × recency(lastSeen) × richness × lexical
   topical overlap. No embedding dependency.
3. **Foreplay lit up** — auto-activates when a funded key is present (video/transcript hero), graceful
   no-op otherwise.

## Approach (key insight)

There is no real verified-domain signal upstream, so rather than thread a fake boolean, compute
**identity confidence at the point of truth**: the `resolveBestCandidate` verdict plus per-ad
advertiser/language reconciliation. `accepted → verified`; `ambiguous → low-confidence → quarantine`.
All changes are in-process logic + Zod artifact schema (JSONB) + UI — **no DB DDL**, so this stays
clear of the locked Supabase→Railway migration.

## Target pipeline

`resolve identity (verdict) → over-fetch locale-pinned pool → normalize + detect language →
verify identity + language per-ad (all providers incl. Foreplay) → blended rank → top-N →
persist with {identityConfidence, verified, language, identityBasis} → UI: verified wall +
quarantine + provenance chip + lastSeen`

## Phases (atomic, TDD, each independently verifiable)

- **P1 Language gate** — new `ad-language.ts` (zero-dep: Unicode-script + Latin heuristic); wire into
  `adlibrary` normalize; add `language`/`isEnglish` to ad schemas. Kills H3.
- **P2 Identity confidence + reconciliation** — capture `verdict` → `identityConfidence`; per-creative
  `verified` = confidence==='verified' && isEnglish && advertiserName reconciles with group. Kills H1/H2/H9.
- **P3 UI** — verified wall + collapsed quarantine + provenance chip + lastSeen. Implements Hybrid.
- **P4 Ranking + recency** — filter-before-truncate + over-fetch; blended score; down-rank/flag stale. Kills H4/H7.
- **P5 Foreplay** — light up when key present; prepass guard passes `adUrl` + requires domain match;
  per-ad verify applies to Foreplay rows. Kills H5 + adds wow.
- **P6 Fingerprint hardening** — hash full text, canonicalize media URL. Kills H8 (polish).

## Verification

`npm run build` (tsc clean vs baseline) · `npm run test:run` targeted (advertiser-match, adapter,
prepass-verifier, competitor-ad-probe, competitor-ad-evidence) + new tests · Codex review of the diff ·
before/after report.

## Non-goals

Embedding-based relevance · DB schema changes · touching the chat `competitorFastHits` path ·
the legacy `research-worker/src/competitors/` copy.

## Execution log (2026-06-03)

Shipped on `feat/ad-engine-rebuild` (unpushed), 5 atomic commits:
- `03bb4fa2` P1+P2 language gate + identity-confidence tiering (H1/H2/H3/H9)
- `0b6f6040` P5 Foreplay light-up + universal reseller domain guard (H5)
- `45ac0de2` P4 recency-blended ranking + over-fetch (H4/H7)
- `9c2a277e` P3 verified wall + quarantine drawer + provenance chip (Hybrid surface)

Verification: `npm run build` exit 0 · `npm run test:run` 1347 passed / 1 pre-existing skip
(+19 new tests) · tsc 0 errors. Independent Codex (xhigh) review of the diff.

### Codex review — applied fixes (commit after review)

- **P1 (fixed):** per-ad identity check preferred the ad-library `detailsUrl` (which the
  short-name domain guard exempts) over the real clickthrough — a same-name wrong-company
  ad (landing on `fathomdem.com` while probing `fathom.video`) could reach the verified
  wall. Now checks `landingUrl ?? detailsUrl ?? url`.
- **P2a (fixed):** `quarantinedCount` was computed after the verified-first cap, so a full
  cap of verified creatives could slice the quarantined ones away and the drawer would
  never show ("hidden, not dropped" contract). Now counts the full quarantined set and
  always returns a quarantined sample alongside the verified wall.
- **P2b (fixed):** language detector upgraded to two-tier markers (strong markers fire on a
  single hit — catches "Jetzt starten") + a diacritic-density backstop for unmodeled Latin
  languages (Polish/Turkish/…). Weak markers still require ≥2 so English loanwords are safe.
- **P3 (deferred):** the Foreplay domain-corroboration guard returns `[]` on mismatch with
  no provenance note. Follow-on: emit a structured `Foreplay brand resolved but failed
  domain corroboration` gap so the artifact explains the missing Foreplay path.

### Deferred follow-ons (documented, not shipped)

- **H8 fingerprint hardening** — hash full normalized text instead of the 80-char
  prefix and canonicalize media URLs (strip CDN host/query). Deferred: lowest-wow,
  and the fingerprint is duplicated between `competitor-landscape.ts` and an inlined
  copy in `competitor-ad-evidence.tsx` that must stay byte-synced — high regression
  risk for marginal gain. Workflow rated it PARTIAL.
- **Meta/LinkedIn source-side locale pin** — add `country=`/`hl` to the Meta + LinkedIn
  fetches keyed to the verified market (Google already region-pinned). Non-English is
  already caught post-fetch by the language gate, so this is a fetch-efficiency
  refinement, not a correctness gap.
- **Lexical topical relevance** in the blended rank (creative copy vs the company's
  category/value-prop). Needs the company context threaded into the adapter; identity +
  recency + richness already deliver the bulk of selection quality.
- **Verified-domain spine** — resolve each competitor's canonical domain in the
  corpus/identity prepass so `domainVerified` becomes a real Sonar-backed signal rather
  than the current verdict-derived confidence. Largest future precision gain.
