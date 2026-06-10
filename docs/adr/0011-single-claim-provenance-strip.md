---
status: accepted
date: 2026-06-10
---

# Amendment to ADR-0010: single-claim provenance strip, never section hard-fail

Amends [ADR-0010](0010-annotated-research-input-quality-architecture.md). The live run `f06333b6` quality audit (2026-06-09) found ~10 real fabrications shipping through the truthgate — quotes attributed to G2/Capterra/Reddit whose actual `sourceUrl` was a vendor blog. The verifier already *detected* these (`misattributed` provenance flag in `evidence-support.ts`) but only badged them: the false platform label still shipped in the committed artifact body.

## Decision

**Strip the lie, keep the section.** Fabricated provenance is repaired at the **single-claim level, before persistence** — never escalated to a section-level hard-fail.

- `stripMisattributedQuoteAttributions` (`src/lib/lab-engine/agents/verification/evidence-support.ts`) walks the final artifact body for the same record shape the claim extractor turns into `quoteAttribution` claims (quote field + `source`/`platform` + `sourceUrl`). Where the asserted platform's accepted hosts don't match the `sourceUrl` host, the false label is relabeled; the quote itself is kept.
- Relabel shape is schema-driven per section, wired in `annotateEvidenceSupportReview` (`run-section.ts`) for the two review-citing sections:
  - **CompetitorLandscape** — quote `source` is a free string → relabeled to the host that actually served the quote (e.g. `G2` → `baserow.io`).
  - **VoiceOfCustomer** — quote `source` is a closed enum (`vocSourceTypes`) → relabeled to `"other"`, the only schema-legal honest value.
- Every relabel is **visible**: recorded as `verifierSummary.strippedQuoteAttributions` (`{ value, claimedSource, claimedPlatform, actualHost, relabeledTo, field, path }`) alongside the existing `provenanceFlags`, so the UI badge can say "1 quote relabeled: claimed G2, source was vendor blog". `needs_review` stays true and grounded confidence keeps its provenance penalty.

## Invariants

- The committed body must **never** assert a platform the `sourceUrl` host doesn't support.
- The section still **commits**. The only hard-fail remains the existing evidence gate (`LAB_VERIFIER_MAX_UNSUPPORTED` semantics untouched); `quoteAttribution`/`numericAttribution` stay out of `loadBearingKinds`.
- Numeric `no-source` flags stay badge-only — they are frequently legitimate operator estimates (ADR-0010's provenance rationale).
- The strip re-walks the body rather than matching flag values back, so duplicate-quote records collapsed by claim dedup are still relabeled.

## Why not hard-fail or delete

A section-level hard-fail over one fabricated source label deletes five honest insights to punish one lie — the exact repair-storm/honesty-punishing failure mode ADR-0010 rejected. Deleting the quote outright discards real customer language that *is* sourced, just mislabeled. Relabeling preserves the evidence, removes the fabrication, and keeps the deliverable client-trustworthy.
