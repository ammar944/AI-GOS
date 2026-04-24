# Rules — research-competitor

Load-bearing constraints extracted from team feedback (Choros, Mahdy, Wasam, Asfand). These gate output correctness — `scripts/sanity-check.ts` enforces the hard ones.

> **Note**: this file lives in `references/rules.md`. The existing `skills/research-competitor/` was built before the `references/` canonical directory; if this path conflicts with a rename (see architecture doc §Decisions), reconcile before Phase B.

## Hard constraints

### [CONSTRAINT] No empty-creative ad counts
If `activeAdCount > 0`, the `creatives[]` array MUST be non-empty. Remove any `|| allRawAds.length` fallback that inflates counts.
- Failure mode observed: ad count showed 5+ but carousel was empty after filtering.
- *Source: Choros feedback, commit `7d4ab3c8`, line 1325*

### [CONSTRAINT] Every weakness cites a source URL
Weakness strings must match `/\bsource:\s*https?:\/\//i` inline. Strip generic hallucinations like "too complicated" if unsourced.
- *Source: Choros feedback #8, commit `7d4ab3c8`, line 493*

### [CONSTRAINT] Ad-library lookup by keyword, not company name
Use `identityCard.coreKeywords[]` as search parameters on Meta/Google ad platforms. Never use company name alone — causes "Fathom ≠ Fathom Inc" false positives.
- *Source: Choros feedback #5, commit `7d4ab3c8`; user direct quote: "Scrape based off profile and keywords rather than searching up the name of the company."*

### [CONSTRAINT] Deduplicate competitor ads
Carousel output must dedupe by canonical ad ID or creative-hash before rendering.
- *Source: `project_competitor_ads.md` — duplicate ads is an active complaint*

### [CONSTRAINT] Name-matching must use Jaro-Winkler + domain corroboration
See `scripts/name-matcher.ts`. Company name alone is not enough.
- **Known duplication gap** (per 2026-04-24 adversarial review): `src/lib/ad-library/name-matcher.ts` has the tested version. Reconcile in Phase B.

## Sanity gates (`scripts/sanity-check.ts`)

- **[FAIL]** if `activeAdCount ≥ 5` and `creatives[].length == 0` — emit diagnostic: "Active ads reported but no creatives loaded. Check normalization in `fetch-ads.ts`."
- **[FAIL]** if ≥3 competitors all show `activeAdCount == 0` — name matching is likely broken (existing rule)
- **[WARN]** if SearchAPI returns >20% unrelated ads (domain-mismatch ratio) — advertiser-matching potentially broken
- **[WARN]** if any weakness lacks `source:` URL — strip and flag
- **[WARN]** on paraphrase markers in `*_verbatim` fields (existing rule)

## Verbatim customer language worth preserving

> "Unrelated ads" — the #1 complaint. Mahdy, Asfand, and others report irrelevant ads breaking credibility.
> *Source: `project_competitor_ads.md`*

> "Scrape based off profile and keywords rather than searching up the name of the company."
> *Source: Choros feedback, user direct quote*

## Cross-cutting

- No CVR/pricing/review hallucination. 3-layer defense.
- Reviews must include Capterra + G2 + Trustpilot with actual 1–3★ text, not just links. (Per Wasam feedback #3.)
- Every field carries `source_url` + `retrieved_at`. Unsourceable fields are omitted, never hallucinated.
- No LLM-scored metrics. No recommendations. Facts only.
