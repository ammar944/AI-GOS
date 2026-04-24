# Competitor Sub-Agent Prompt (per-competitor fan-out)

You are scoped to ONE competitor. Do NOT research other companies. Produce a single JSON fragment file.

## Input

```json
{
  "run_id": "run_fellow_ai_2026_04_23",
  "name": "Fireflies.ai",
  "type": "direct",
  "homepage_url": "https://fireflies.ai",
  "domain": "fireflies.ai",
  "fragments_dir": "/tmp/research-competitor-<run_id>/fragments"
}
```

## Task

For this one competitor, produce a fragment file at `<fragments_dir>/<slug>.json` where `<slug>` is the competitor name lowercased with non-alphanumerics replaced by `-`.

Collect these five things using `WebFetch` and `WebSearch`:

1. **Positioning (homepage)** — Fetch `homepage_url`. Extract verbatim: the hero headline/subheadline (solution framing) and any pain/problem framing. Capture the exact wording.
2. **Pricing** — Fetch `<homepage_url>/pricing` (or search `"<name> pricing"` if that 404s). Record exact tier names, prices, billing terms, "Contact sales" signals, and brief packaging notes.
3. **Narrative arc** — From the homepage and any "Why X" or "About" page: identify the villain (what pain they frame), the hero (how they position themselves), and the transformation claim. Include one `evidence_verbatim` sentence from their own copy.
4. **Reviews (collect until saturated — target ≥5 per polarity)** — Work through sources in order until the floor is met OR you exhaust the budget:
   - G2 reviews page (WebSearch snippet acceptable if direct fetch 403s)
   - Capterra reviews
   - TrustRadius reviews
   - Reddit discussion threads (`"<name>" review site:reddit.com`)
   - HackerNews mentions (`"<name>" site:news.ycombinator.com`)

   Polarity comes from star rating (≤3 = negative, ≥4 = positive) or explicit review-site labeling. Never infer polarity from tone alone. Use the matching `source_site` enum (`g2`, `capterra`, `trustradius`, `getapp`, `softwareadvice`, `other`) per quote.

   If after 3 source attempts per polarity you still have <5, emit a `reviews_status` block alongside the quotes in the fragment:

   ```json
   "reviews_status": {
     "positive_count": 3,
     "negative_count": 5,
     "sources_attempted": ["g2", "capterra", "reddit"],
     "reason_if_incomplete": "G2 page 403ed; Capterra surfaced only 2 positives; Reddit quotes too short to cite verbatim."
   }
   ```

   Better an incomplete section marked honestly than fabricated quotes. `scripts/sanity-check.ts` warns when a competitor has <5 per polarity but never requires fabrication.
5. **retrieved_at** — Use the current ISO datetime on every record.

**Do not fetch ads.** Ads are handled centrally by `scripts/fetch-ads.ts` after all fragments are merged.

## Output shape

Write exactly this JSON (omit any field you could not source — never invent):

```json
{
  "name": "Fireflies.ai",
  "type": "direct",
  "homepage_url": "https://fireflies.ai",
  "retrieved_at": "2026-04-23T08:54:32.000Z",
  "competitor_ref": {
    "name": "Fireflies.ai",
    "type": "direct",
    "source_url": "https://fireflies.ai",
    "retrieved_at": "..."
  },
  "positioning": {
    "name": "Fireflies.ai",
    "problem_framing_verbatim": "...",
    "solution_framing_verbatim": "...",
    "source_url": "https://fireflies.ai",
    "retrieved_at": "..."
  },
  "pricing": {
    "name": "Fireflies.ai",
    "public_prices": ["Free: $0", "Pro: $10/seat/mo annual", "..."],
    "gated_pricing_signals": ["Enterprise CTA is 'Contact Us'"],
    "packaging_notes": "...",
    "source_url": "https://fireflies.ai/pricing",
    "retrieved_at": "..."
  },
  "reviews": [
    {
      "name": "Fireflies.ai",
      "verbatim_quote": "...",
      "source_site": "g2",
      "polarity": "positive",
      "source_url": "https://www.g2.com/products/fireflies-ai/reviews",
      "retrieved_at": "..."
    }
  ],
  "narrative_arc": {
    "name": "Fireflies.ai",
    "villain": "...",
    "hero": "...",
    "transformation_claim": "...",
    "evidence_verbatim": "...",
    "source_url": "https://fireflies.ai",
    "retrieved_at": "..."
  }
}
```

## Rules

- **Facts only.** No "our advantage", no LLM scores, no "this is better than X".
- **Verbatim means quote, not paraphrase.** Fields ending in `_verbatim` require direct quotation. If you cannot capture verbatim (page blocked, JS-rendered, snippet truncated), **omit the field entirely** — do NOT prefix with "Summary:". `scripts/sanity-check.ts` flags `Summary:`, `[paraphrased]`, `approximately`, `in essence`, `roughly` as WARN-level paraphrase markers. Omitted fields are clean; paraphrased fields are loud.
- **Subject handling.** If input `type == "subject"`, collect the same 5 things (positioning / pricing / reviews / narrative / retrieved_at) with no special casing. The subject is rendered as a competitor with an inline "You Are Here" marker in the report.
- **Every record sourced.** `source_url` + `retrieved_at` on every object.
- **One JSON file, one competitor.** Do not touch other fragments.
- **Budget: 4 minutes, 12 tool calls max.** If the site is slow or blocks you, record what you have and stop. Empty fields are fine; fabricated fields are not.

## When you're done

Write the fragment file. Report back one line: `fragments/<slug>.json written — positioning: Y/N, pricing: Y/N, reviews: N quotes, narrative: Y/N`.
