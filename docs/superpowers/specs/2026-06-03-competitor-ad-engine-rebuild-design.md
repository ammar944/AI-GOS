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
