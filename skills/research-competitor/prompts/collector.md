# Research Competitor — Collector Prompt

You are a research agent. Your job is to collect raw facts about competitors using only your native tools (`web_search`, `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_vision`). Do not use external APIs. Do not use Serper, Firecrawl, or Meta API tokens.

## Input
A sealed JSON payload matching `schemas/input.ts`:
```json
{
  "run_id": "...",
  "company_name": "Linear",
  "product_description": "...",
  "icp": "...",
  "industry": "...",
  "geo": "...",
  "stated_competitors": [...],
  "offer_tier": "...",
  "target_plan": "...",
  "pricing": "..."
}
```

## Collection plan

### Phase 1 — Discover competitors (seed)
1. `web_search` for "{company_name} competitors" and "{product_description} alternatives"
2. Visit the top 3 comparison articles via `browser_navigate`
3. Record every competitor name + source URL + retrieved_at timestamp
4. Classify each as `direct`, `indirect`, `status_quo`, or `diy`
5. **Always include the subject company itself** in `competitor_set` with `type: "subject"`. The subject is analyzed on the same fields as rivals so the report can benchmark where they sit. Enforced by `scripts/sanity-check.ts` — subject missing = hard fail.

### Phase 1.5 — Roundup expansion (cross-check)

Before fanning out sub-agents, confirm the seed list is not missing obvious candidates (pattern from [superamped/ai-marketing-skills](https://github.com/superamped/ai-marketing-skills) — frequency-rank across independent roundups):

0. For ambiguous categories or broad products, run `prompts/competitor-set-analyst.md` first. It produces `$RUN_DIR/competitor_set_analysis.json`, `$RUN_DIR/competitors.json`, and `$RUN_DIR/excluded_seeds.json`. Use its `final_competitor_set` as the seed unless you have stronger sourced evidence.
1. Fetch 2–3 independent "best X for Y" roundups (G2 category pages, Capterra shortlists, Zapier blog, trusted vertical publications). Use domain variety — don't count 3 pages from the same publisher.
2. Extract every tool named in each roundup.
3. Tally tools that appear in **≥2 independent roundups** but are missing from the seed list.
4. For each ≥2-roundup mention:
   - ADD it to `competitor_set` (classify by fit), OR
   - RECORD it in `$RUN_DIR/excluded_seeds.json` as `[{ "name": "...", "reason": "..." }]`.
5. Cap shortlist at 10. If expansion inflates to 15+, keep the 10 most roundup-dense.

`scripts/sanity-check.ts` cross-checks SoV evidence against `competitor_set` ∪ `excluded_seeds.json` and warns on unknown names. The exclusion file is the acknowledged-and-rejected record.

### Phase 2 — Positioning & narrative
1. Visit each competitor's homepage via `browser_navigate`
2. Capture verbatim: problem framing, solution framing, hero/villain/transformation claims
3. Record `source_url` + `retrieved_at` for every capture

### Phase 3 — Pricing
1. Navigate to `/pricing` for each competitor
2. Capture verbatim: tier names, prices, gated pricing signals ("Contact sales")
3. Note packaging observations without judgment

### Phase 4 — Paid social ads (automated via SearchAPI)
1. **Do NOT browser-navigate Meta directly** — Meta blocks headless fetches and returns 403.
2. After the competitor_set is finalized, write a batch file `/tmp/research-competitor-<run_id>/competitors.json` in the form:
   ```json
   [
     { "name": "Fireflies.ai", "domain": "fireflies.ai" },
     { "name": "Otter.ai",     "domain": "otter.ai" }
   ]
   ```
3. Run the standalone fetcher (uses `SEARCHAPI_KEY` env, same engine as the research-worker):
   ```bash
   cd skills/research-competitor
   SEARCHAPI_KEY=$SEARCHAPI_KEY npx tsx scripts/fetch-ads.ts \
     --batch /tmp/research-competitor-<run_id>/competitors.json \
     > /tmp/research-competitor-<run_id>/ads.json
   ```
   This returns an array of `{ paid_social_ad_inventory, ad_activity_signals }` fragments per competitor (Meta only; LinkedIn + Google can be added later).
4. Merge fragments into the main output:
   ```bash
   npx tsx scripts/merge-ads.ts \
     /tmp/research-competitor-<run_id>/output.json \
     /tmp/research-competitor-<run_id>/ads.json
   ```
5. If `SEARCHAPI_KEY` is not set or a competitor has no matched Meta page, the fetcher writes `active_ad_count: 0` with the Meta Ad Library URL preserved as `source_url` — never hallucinate counts or hook strings.

### Phase 5 — Paid search ads
1. `web_search` for keywords each competitor likely bids on
2. Note headline/body/destination from any visible ads (mark as approximate)

### Phase 6 — Reviews
1. `browser_navigate` to G2, Capterra, TrustRadius pages for each competitor
2. Extract 1-3 verbatim quotes with polarity determined by star rating, not LLM inference
3. Record source site, review date, and URL

### Phase 7 — Share of voice
1. `web_search` for "{competitor_name} site:reddit.com" and similar
2. Note communities and publications where competitor is discussed
3. Record evidence URLs

## Normalization
After collection, populate a JSON object matching `schemas/output.ts`:
- Every object carries `source_url` (string URL) and `retrieved_at` (ISO datetime)
- Arrays may be empty if data is unsourceable
- `source_gaps` is required and must contain at least one non-empty entry explaining a remaining evidence or provider gap
- Never hallucinate fields

## Validation
After populating, run:
```bash
cd skills/research-competitor
npx tsx scripts/validate.ts /path/to/your-output.json
```
Fix any validation issues before returning the result.

## Output
Return the full validated JSON. Then run:
```bash
npx tsx scripts/generate-report.ts /path/to/your-output.json /tmp/report.html
```
Point the user to `/tmp/report.html`.

### Phase 4.5 — Ad Fetch Source Ledger

For each competitor ad fetch, record:
- `competitor_name`
- `domain`
- `matched_advertiser_name`
- `matched_ad_library_url`
- `provider`: `searchapi_meta_ads`
- `provider_status`: `matched`, `no_match`, `provider_error`, or `missing_key`
- `retrieved_at`
- `reason` for `no_match` or `provider_error`

Only merge ad hooks, active counts, or activity signals when `provider_status` is `matched`.
If status is not `matched`, preserve the attempted library URL and add a source gap.
