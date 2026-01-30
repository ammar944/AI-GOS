# Pitfalls Research: Pricing Page Scraping & Extraction

**Domain:** Pricing page scraping with Firecrawl and LLM-based structured extraction
**Researched:** 2026-01-31
**Overall confidence:** HIGH (verified with official Firecrawl docs and 2026 industry research)

---

## Discovery Pitfalls

### CRITICAL: Assuming Standard Pricing Page URLs

**What goes wrong:**
Teams assume pricing pages follow predictable patterns like `/pricing`, `/plans`, or `/pricing-plans`. In reality, companies use diverse URL structures:
- `/buy`, `/store`, `/subscribe`, `/get-started`
- `/pricing-and-plans`, `/product-pricing`, `/solutions/pricing`
- Region-specific paths: `/en/pricing`, `/us/pricing`
- Product-specific: `/enterprise-pricing`, `/teams-pricing`

**Why it happens:**
Initial assumptions based on popular SaaS patterns, without surveying the actual diversity of competitor sites.

**Consequences:**
- 30-50% of pricing pages missed using naive URL guessing
- Incomplete competitive intelligence
- False negatives ("competitor has no pricing page") when they actually do

**Prevention:**
1. Use Google search operators: `site:competitor.com (inurl:pricing OR inurl:plans OR inurl:buy OR inurl:subscribe)`
2. Implement multi-strategy discovery:
   - Sitemap parsing (`/sitemap.xml`)
   - Common link text matching ("Pricing", "Plans", "Buy Now")
   - Footer/header navigation extraction
   - Internal link analysis from homepage
3. Maintain domain-specific URL patterns learned from successful discoveries

**Detection:**
- Low discovery rate across competitor set (under 70%)
- Manual verification finds pricing pages that automated discovery missed
- User reports of missing competitor data

**Phase to address:** Phase 1 (Discovery & Foundation)

---

### MODERATE: Not Handling Region/Currency Redirects

**What goes wrong:**
Many pricing pages redirect based on IP geolocation or browser language headers, showing different pricing for different regions. Scraping from US-based infrastructure shows US pricing only, missing international variations.

**Why it happens:**
Companies implement region-specific pricing without considering that scraper needs access to all variants.

**Consequences:**
- Incomplete pricing data (only one region's prices)
- Inaccurate competitive analysis for global products
- Missing currency conversion logic

**Prevention:**
1. Check for region selectors on pricing page (dropdowns, links)
2. Extract all region/currency variants if available
3. Store region context with pricing data
4. Consider using proxy rotation with different geographic locations for comprehensive coverage

**Detection:**
- Pricing data shows only USD when competitor offers EUR, GBP, etc.
- User feedback about missing international pricing
- Competitor website shows region selector but extracted data has single region

**Phase to address:** Phase 2 (Enhancement & Completeness)

---

### MODERATE: Ignoring Dynamic Pricing & Personalization

**What goes wrong:**
Modern SaaS companies implement dynamic pricing based on:
- Company size (from enrichment data)
- Industry vertical
- Referral source
- Existing customer status
- Time-based promotions

A scraper sees only the "default" anonymous visitor pricing, missing these variations.

**Consequences:**
- Extracted pricing may not match what actual prospects see
- Confidence score incorrectly high (data is "accurate" but incomplete)
- Competitive analysis based on prices real customers never see

**Prevention:**
1. Flag pricing pages that show "Contact Sales" instead of specific prices
2. Detect personalization signals: forms asking for company size, industry dropdowns
3. Add metadata field: `pricing_model: "self_serve" | "contact_sales" | "hybrid"`
4. For critical competitors, manual validation of extracted vs. actual pricing

**Detection:**
- High proportion of "Contact Sales" CTAs in extracted data
- Competitor is known for enterprise sales but scraper shows public pricing
- Extracted prices don't match known market positioning

**Phase to address:** Phase 2 (Enhancement & Completeness)

---

## Scraping Pitfalls

### CRITICAL: JavaScript-Heavy Pricing Tables Not Rendering

**What goes wrong:**
In 2026, most modern websites rely on JavaScript to load critical data. Pricing tables are frequently:
- Loaded via AJAX after page load
- Rendered by React/Vue/Svelte components
- Populated from JSON endpoints
- Hidden behind interaction triggers (tabs, toggles, "Show annual pricing")

Static HTML scraping returns empty pricing sections.

**Why it happens:**
Modern web development patterns prioritize SPA architectures and dynamic content loading for better UX, but this breaks traditional scrapers.

**Consequences:**
- Complete extraction failure (0 pricing tiers found)
- Partial extraction (monthly visible, annual hidden behind toggle)
- LLM receives incomplete markdown, hallucinates missing data

**Prevention:**
1. **Use Firecrawl's JavaScript rendering by default** - includes browser execution automatically
2. Verify scraping output contains pricing data before LLM extraction:
   - Check for currency symbols ($, €, £)
   - Check for number patterns matching prices
   - Check for keywords: "month", "year", "user", "tier"
3. Set appropriate wait conditions:
   - Wait for network idle
   - Wait for specific selectors (pricing tables)
   - Allow 3-5 seconds for JS frameworks to hydrate

**Detection:**
- Firecrawl returns markdown but contains no price data
- Word count suspiciously low (under 500 words for pricing page)
- Missing expected sections (pricing table, comparison chart)
- LLM confidence score is LOW consistently

**Phase to address:** Phase 1 (Discovery & Foundation) - Must work from day one

**Source:** [Firecrawl Official Docs - JavaScript Rendering](https://www.firecrawl.dev/blog/best-web-scraping-api)

---

### CRITICAL: Anti-Bot Detection Blocking Scraper

**What goes wrong:**
Anti-bot systems use machine learning to identify and block non-human traffic through:
- Browser fingerprinting (strange/inconsistent fingerprints)
- Behavior analysis (no mouse movement, instant clicks)
- Rate pattern detection (perfectly timed requests)
- CAPTCHA challenges
- IP reputation checks

In 2026, this is an arms race with both sides wielding AI.

**Why it happens:**
Pricing pages are high-value targets for competitors, so companies protect them aggressively with anti-scraping measures.

**Consequences:**
- Complete scraping failure (403/429 errors)
- Receiving CAPTCHA pages instead of pricing content
- IP address permanently banned
- Intermittent failures that are hard to debug

**Prevention:**
1. **Use Firecrawl's built-in anti-bot handling** - includes:
   - Intelligent proxy rotation
   - Sophisticated header management
   - Browser fingerprint normalization
   - Automatic retry logic
2. Implement respectful scraping:
   - Add delays between requests (1-2 seconds minimum)
   - Respect robots.txt (check for `/pricing` disallow rules)
   - Set proper User-Agent headers
3. Monitor HTTP status codes and response content:
   - 403 Forbidden → anti-bot detected
   - 429 Too Many Requests → rate limit hit
   - Response contains "captcha", "challenge", "verify" → bot check triggered
4. Implement fallback: if scraping fails 3 times, flag for manual review

**Detection:**
- HTTP status codes: 403, 429, 503
- Response HTML contains CAPTCHA providers (reCAPTCHA, hCaptcha, Cloudflare Turnstile)
- Extracted content contains challenge text instead of pricing
- Success rate drops below 80% across competitor set

**Phase to address:** Phase 1 (Discovery & Foundation) - Scraping must be reliable

**Source:** [Web Scraping Challenges 2026](https://research.aimultiple.com/web-scraping-challenges/)

---

### MODERATE: Rate Limit Exhaustion in Production

**What goes wrong:**
Firecrawl uses tiered rate limits and credit-based billing:
- Free: 500 pages, 5 RPM, 1 crawl request/min
- Hobby ($16/mo): 3,000 pages, 20 RPM, 3 crawl requests/min
- Standard ($83/mo): 100,000 pages, 50 concurrent browsers, 10 crawl requests/min
- Growth ($333/mo): 500,000 pages, 100 concurrent browsers, 50 crawl requests/min

Each operation consumes credits: simple scrape (1 credit), JavaScript rendering (1 credit), structured extraction (may cost more).

**Why it happens:**
Underestimating production usage patterns:
- 100 competitors × 1 pricing page = 100 credits/run
- Weekly refresh = 400 credits/month minimum
- Retries on failures multiply credit usage
- Development/testing counts against quota

**Consequences:**
- API returns 429 status code mid-batch
- Pricing refresh fails for subset of competitors
- User-triggered scraping blocked ("out of credits")
- Unexpected overage charges
- Production downtime

**Prevention:**
1. **Track credit usage in application:**
   - Log credits consumed per scraping operation
   - Alert when approaching 80% of monthly quota
   - Dashboard showing credit burn rate
2. **Implement retry logic with exponential backoff:**
   ```typescript
   // Wait 1s, 2s, 4s, 8s before retries
   await exponentialBackoff(retryCount)
   ```
3. **Right-size plan for production:**
   - Calculate: (competitors × refresh_frequency × retry_multiplier)
   - Add 30% buffer for peaks and failures
   - Start with Standard plan ($83) for 50-200 competitors weekly refresh
4. **Implement request queuing:**
   - Spread scraping across hours/days instead of burst
   - Priority queue: user-triggered > scheduled refresh
   - Respect rate limits in queue processing

**Detection:**
- 429 HTTP status codes from Firecrawl API
- Credit exhaustion errors in logs
- Incomplete competitor data refreshes
- Firecrawl dashboard shows quota exceeded

**Phase to address:** Phase 2 (Production Hardening)

**Source:** [Firecrawl Rate Limits](https://docs.firecrawl.dev/rate-limits)

---

### MODERATE: CSS Selector Brittleness (If Not Using LLM Extraction)

**What goes wrong:**
If falling back to CSS selector-based extraction, selectors break when websites change:
- Class renamed: `price` → `current-price`
- Structure changed: `<div class="price">` → `<span class="amount">`
- A/B testing shows different markup to different visitors
- Framework upgrade changes DOM structure

**Why it happens:**
Websites change frequently; developers rename classes for clarity without considering external scrapers.

**Consequences:**
- Extraction returns null/empty for previously working sites
- Silent failures (scraper succeeds but extracts wrong data)
- Maintenance burden (updating selectors monthly)

**Prevention:**
1. **Use Firecrawl's `/extract` endpoint with LLM-based extraction** (recommended)
   - Provide URL and plain English prompt
   - Firecrawl AI structures data automatically
   - Resilient to layout changes
   - Uses 67% fewer tokens than raw HTML
2. **If using selectors, implement validation:**
   - Check extracted data against expected schema
   - Flag null/empty extractions
   - Compare against previous successful extraction
3. **Multiple selector strategies per field:**
   - Try semantic selectors first: `[data-testid="price"]`
   - Fallback to class selectors: `.price, .pricing-amount`
   - Last resort: text pattern matching

**Detection:**
- Extraction succeeds but returns null/empty for fields
- Previously working competitor suddenly has no pricing data
- Validation errors: extracted price is not a number
- Confidence score drops for specific competitor

**Phase to address:** Phase 1 (Foundation) - Use LLM extraction from start to avoid this entirely

**Source:** [Firecrawl Extract Endpoint](https://www.firecrawl.dev/blog/scrapingbee-pricing)

---

### MINOR: Markdown Conversion Losing Table Structure

**What goes wrong:**
Firecrawl converts HTML to markdown for LLM consumption. Complex pricing tables with merged cells, nested structures, or visual-only distinctions can lose meaning in markdown conversion:
- Comparison charts with checkmarks/X marks
- Feature matrices with cell colors indicating tier availability
- Tables with rowspan/colspan

**Consequences:**
- LLM cannot accurately extract tier features
- "Most Popular" badges lost
- Feature availability misattributed to wrong tier

**Prevention:**
1. **Validate markdown contains tabular structure:**
   - Check for markdown table syntax: `|---|---|`
   - Count table rows matches expected tier count
2. **Provide context in LLM extraction prompt:**
   - "This pricing page may contain comparison tables..."
   - "Checkmarks (✓) indicate feature is included..."
3. **Consider using Firecrawl's screenshot capability** for visual pricing tables:
   - Vision-enabled LLM can parse visual table layouts
   - Handles color-coded information
   - More expensive but higher accuracy

**Detection:**
- Extracted tiers have incomplete feature lists
- Comparison data is jumbled
- Manual inspection shows table but LLM extraction missed it

**Phase to address:** Phase 3 (Advanced Features) - Enhancement after core flow works

---

## Extraction Pitfalls

### CRITICAL: LLM Hallucination in Structured Data

**What goes wrong:**
LLMs hallucinate when extracting structured pricing data:
- **Confabulating prices:** Seeing "$99" and "$199", inventing "$149" tier that doesn't exist
- **Misattributing features:** Mixing features from different tiers
- **Inferring information:** "Professional tier probably includes email support" when page doesn't say
- **Currency confusion:** Converting prices without being asked, or mixing currencies
- **Number misreading:** "$1,999/year" extracted as "$1999/month"

**Why it happens:**
LLMs are trained to be helpful and complete responses. When pricing data is ambiguous or incomplete, they fill gaps with plausible-sounding but incorrect information.

**Consequences:**
- Incorrect competitive intelligence driving business decisions
- Customer confusion if inaccurate pricing shown in product
- Loss of trust when inaccuracies discovered
- Competitive analysis based on hallucinated data

**Prevention:**
1. **Use structured extraction with strict schema enforcement:**
   ```typescript
   interface PricingTier {
     name: string;              // REQUIRED
     price: number | null;      // null if "Contact Sales"
     currency: string;          // ISO code: USD, EUR, GBP
     billingPeriod: "month" | "year" | "one-time";
     features: string[];        // ONLY features explicitly listed
   }
   ```
2. **Prompt engineering for conservative extraction:**
   ```
   Extract ONLY pricing information explicitly stated on the page.
   - Do NOT infer or guess missing information
   - If a tier shows "Contact Sales" instead of price, set price to null
   - Do NOT assume features from one tier apply to others
   - If you cannot find information, omit the field rather than guessing
   ```
3. **Use constrained decoding/JSON mode:**
   - OpenAI JSON mode, Anthropic tool use, or schema-guided generation
   - Forces output to match exact schema structure
   - Reduces hallucination by eliminating free-form text
4. **Multi-source validation:**
   - Extract twice with different prompts, compare results
   - Cross-reference with cached previous extraction
   - Flag discrepancies for review
5. **Use smaller, task-specific models for extraction:**
   - Claude Haiku or GPT-4o Mini for structured extraction
   - 70% lower cost than GPT-4
   - Often MORE accurate for extraction tasks (less prone to overthinking)

**Detection:**
- Extracted tier count doesn't match visual inspection
- Price values not found anywhere in source markdown
- Features too generic ("customer support", "unlimited storage") vs. specific ("24/7 phone support", "1TB storage")
- Confidence scoring detects low source text overlap

**Phase to address:** Phase 1 (Foundation) - Must prevent from day one

**Sources:**
- [LLM Hallucination Detection 2026](https://arxiv.org/pdf/2601.09929)
- [Structured Data Extraction Best Practices](https://www.cloudidr.com/blog/llm-pricing-comparison-2026)

---

### CRITICAL: Inconsistent Data Normalization Across Competitors

**What goes wrong:**
Different pricing pages present information differently, creating normalization challenges:
- **Billing periods:** "per month", "/mo", "monthly", "billed monthly", "$99/user/month"
- **User pricing:** "per user", "per seat", "per member", or unclear if per-user or per-organization
- **Feature names:** "SSO" vs "Single Sign-On" vs "SAML authentication"
- **Tier names:** "Pro", "Professional", "Business", "Team" all meaning mid-tier
- **Units:** "1TB storage" vs "1000GB storage" vs "Unlimited"

Without normalization, comparisons are impossible.

**Why it happens:**
Each company uses their own terminology and presentation style. LLM extraction preserves source terminology without standardization.

**Consequences:**
- Cannot compare pricing across competitors
- "$99/month per user" vs "$99/month for team" look same but aren't
- Features don't align across competitors for comparison
- Sorting/filtering by price breaks when periods mixed

**Prevention:**
1. **Post-extraction normalization layer:**
   ```typescript
   function normalizePricingTier(raw: RawTier): NormalizedTier {
     return {
       price_per_user_per_month: normalizeToMonthlyPerUser(raw),
       billing_period_normalized: normalizeBillingPeriod(raw),
       features_canonical: mapToCanonicalFeatures(raw.features)
     }
   }
   ```
2. **Canonical feature taxonomy:**
   - Maintain mapping: "SSO" → "sso_authentication"
   - "Unlimited storage" → null (not comparable)
   - "24/7 support" → "support_24_7"
3. **Explicit per-user vs per-org extraction:**
   - Prompt: "Is this price per-user or per-organization?"
   - Schema field: `pricing_model: "per_user" | "per_org" | "flat"`
4. **Currency conversion to USD baseline:**
   - Store original currency + price
   - Calculate USD equivalent for comparison
   - Use exchange rate API, cache daily
5. **Unit normalization for storage/limits:**
   - Convert all to same unit: GB, users, API calls/month
   - "1TB" → 1000 (GB), "Unlimited" → null or Number.MAX_SAFE_INTEGER

**Detection:**
- Comparison queries return nonsensical results
- Sorting by price shows annual before monthly
- Feature comparison shows no matches across competitors
- User confusion about pricing display

**Phase to address:** Phase 2 (Data Quality & Normalization)

**Source:** [Why Unit Normalization is Critical](https://dataweave.com/blog/why-unit-of-measure-normalization-is-critical-for-accurate-and-actionable-competitive-pricing-intelligence)

---

### MODERATE: Incomplete Feature Extraction

**What goes wrong:**
Pricing pages often have features scattered across:
- Pricing table cells (checkmarks, text)
- Expandable "See all features" sections
- Footer disclaimers
- Separate feature comparison page (linked from pricing)
- Tooltips (hover-only content)

LLM extraction from single page markdown misses hidden/linked content.

**Consequences:**
- Tier appears less feature-rich than reality
- Competitive comparison incomplete
- Value proposition unclear

**Prevention:**
1. **Follow "See all features" links:**
   - Parse pricing page for feature comparison links
   - Scrape and extract from linked pages
   - Merge feature data with pricing data
2. **Extract tooltip/hover content:**
   - Firecrawl with browser rendering captures data-tooltip attributes
   - Include in markdown: `[Feature Name]^[Tooltip text]`
3. **Limit feature extraction scope:**
   - Prompt: "Extract only the top 5-10 features per tier" (most important)
   - OR: "Extract all features exactly as shown" (comprehensive but noisier)
4. **Flag incomplete extractions:**
   - If tier has fewer than 3 features, mark as potentially incomplete
   - Confidence scoring penalizes sparse feature lists

**Detection:**
- Competitor tiers show only 1-2 features
- Manual inspection shows expandable sections not captured
- User feedback: "Missing X feature we know they have"

**Phase to address:** Phase 2 (Enhancement & Completeness)

---

### MODERATE: Extraction Prompt Brittleness

**What goes wrong:**
LLM extraction quality is highly sensitive to prompt wording:
- Vague prompts → inconsistent outputs
- Over-specific prompts → fails on unexpected page layouts
- Missing examples → LLM guesses interpretation
- No constraints → hallucination and format drift

Different pricing pages need slightly different extraction logic, but a single prompt must handle all.

**Why it happens:**
Designing prompts that generalize across diverse pricing page styles (SaaS, e-commerce, freemium, enterprise) is hard.

**Consequences:**
- High extraction variance (works for 60%, fails for 40%)
- Manual prompt tuning needed per competitor
- Brittle to website changes
- Requires constant maintenance

**Prevention:**
1. **Use few-shot examples in prompt:**
   ```
   Example 1:
   Input: "Pro Plan - $99/month - Features: ..."
   Output: {"name": "Pro", "price": 99, "currency": "USD", ...}

   Example 2:
   Input: "Enterprise - Contact Sales - Custom features"
   Output: {"name": "Enterprise", "price": null, ...}
   ```
2. **Structured extraction instructions:**
   - "Extract all pricing tiers as JSON array"
   - "For each tier, extract: name, price, currency, billing period, features"
   - "If price not shown, set price to null"
3. **Validation rules in prompt:**
   - "Verify price is positive number"
   - "Verify currency is 3-letter ISO code"
   - "Verify billing period is one of: month, year, one-time"
4. **Multi-tier prompt strategy:**
   - First pass: extract raw structure with lenient prompt
   - Second pass: validate and normalize with strict prompt
   - Combine results
5. **Prompt versioning and testing:**
   - Version prompts like code (v1.0, v1.1)
   - Regression test on known pricing pages
   - A/B test prompt variations

**Detection:**
- Extraction success rate under 85%
- High variance in tier counts across similar competitors
- Validation errors after extraction
- LLM returns unstructured text instead of JSON

**Phase to address:** Phase 1 (Foundation) - Must work reliably from start

---

## Confidence Scoring Pitfalls

### CRITICAL: False High Confidence on Hallucinated Data

**What goes wrong:**
Confidence scoring uses heuristics like:
- LLM reported confidence (unreliable)
- Presence of required fields (can be hallucinated)
- Text length (longer ≠ more accurate)
- Regex matching (hallucinates valid-looking data)

These metrics fail to detect **plausible hallucination** where LLM invents reasonable-sounding but incorrect data.

**Why it happens:**
Confidence scoring focuses on format/completeness rather than **source text grounding** (did this data actually appear in the scraped content?).

**Consequences:**
- High confidence score (0.95) on completely wrong pricing
- User trusts incorrect data because confidence is high
- Hallucinated tiers mixed with real tiers, impossible to distinguish
- Business decisions based on fabricated competitor data

**Prevention:**
1. **Source text attribution:**
   - For each extracted field, LLM must cite source text
   - Example: `{"price": 99, "source_quote": "Professional plan is $99/month"}`
   - Confidence scoring verifies quote exists in scraped markdown
2. **Multi-signal confidence scoring:**
   ```typescript
   confidence = weightedAverage([
     sourceTextOverlap(extracted, markdown),      // 40%
     schemaCompleteness(extracted),               // 20%
     fieldValuePlausibility(extracted),           // 20%
     crossValidationConsistency(extracted, prev), // 10%
     llmConfidence(extracted)                     // 10%
   ])
   ```
3. **Thresholds by risk:**
   - Financial/pricing data: require 0.85+ confidence
   - Less critical features: allow 0.70+ confidence
   - Auto-reject below 0.70, flag for human review
4. **Ensemble validation:**
   - Extract with two different prompts/models
   - Confidence = agreement score between two extractions
   - If disagree, mark as LOW confidence

**Detection:**
- High confidence on data that manual review shows is wrong
- No source text found for extracted claims
- User reports inaccurate pricing despite high confidence

**Phase to address:** Phase 1 (Foundation) - Critical for trust

**Sources:**
- [Confidence Scoring Best Practices](https://www.extend.ai/resources/best-confidence-scoring-systems-document-processing)
- [LLM Confidence Score Framework](https://medium.com/wbaa/a-confidence-score-for-llm-answers-c668844d52c8)

---

### MODERATE: Confidence Threshold Miscalibration

**What goes wrong:**
Setting fixed confidence thresholds (e.g., "reject if confidence < 0.80") without calibration leads to:
- **Too strict:** Rejecting 60% of valid extractions (many false negatives)
- **Too lenient:** Accepting 20% of wrong extractions (many false positives)

Optimal threshold varies by:
- Pricing page complexity (simple table vs complex interactive)
- LLM model used (Claude Haiku vs GPT-4o)
- Data quality tolerance for use case

**Why it happens:**
Threshold chosen arbitrarily without A/B testing on real data.

**Consequences:**
- Too strict → constant manual review overhead, low automation rate
- Too lenient → poor data quality, user complaints, bad decisions

**Prevention:**
1. **Empirical threshold calibration:**
   - Manual label 100 pricing page extractions as correct/incorrect
   - Plot precision-recall curve for confidence scores
   - Choose threshold that balances precision (quality) and recall (coverage)
   - Example: 0.85 threshold → 90% precision, 75% recall
2. **Dynamic thresholds by category:**
   - SaaS pricing tables: 0.75 (usually straightforward)
   - E-commerce bundles: 0.85 (more complex)
   - Enterprise "Contact Sales": 0.90 (ambiguous)
3. **Confidence score calibration:**
   - Map raw score [0-1] to calibrated probability
   - Use logistic regression on labeled data
   - Calibrated score reflects true accuracy probability
4. **Human-in-the-loop for mid-range confidence:**
   - Auto-accept: confidence > 0.90
   - Auto-reject: confidence < 0.60
   - Human review: 0.60-0.90
5. **Recommended thresholds from industry research:**
   - Minimum: 0.70-0.90 depending on strictness
   - Financial/medical: close to 1.00 (100%)
   - Bulk labeling: 0.70-0.80

**Detection:**
- High rejection rate (>40% below threshold)
- User feedback about incorrect data passing through
- Manual review finds obvious errors in accepted extractions

**Phase to address:** Phase 2 (Optimization & Tuning)

**Source:** [Confidence Score Best Practices](https://www.mindee.com/blog/how-use-confidence-scores-ml-models)

---

### MODERATE: Not Versioning Confidence Score Calculation

**What goes wrong:**
Confidence score calculation evolves as you improve extraction:
- v1: Simple LLM confidence
- v2: Add source text overlap
- v3: Add cross-validation
- v4: Calibrate thresholds

Old data has v1 scores, new data has v4 scores. They're not comparable.

**Consequences:**
- Cannot compare confidence scores over time
- Cannot re-score old extractions with new algorithm
- A/B testing confidence improvements is impossible
- Trends over time are meaningless

**Prevention:**
1. **Store confidence version with each extraction:**
   ```typescript
   interface PricingExtraction {
     data: PricingTier[];
     confidence_score: number;
     confidence_version: "v1.0" | "v2.0" | "v3.0";
     scored_at: Date;
   }
   ```
2. **Re-score historical data when algorithm changes:**
   - Migrate v1 scores → v2 using new algorithm on stored markdown
   - Backfill: re-calculate v3 scores for all past extractions
3. **Track score distribution by version:**
   - Histogram: v1 scores vs v2 scores
   - Ensures new version doesn't radically shift distribution
4. **Deprecation policy:**
   - Support old versions for 90 days
   - Auto-migrate after deprecation

**Detection:**
- Score distributions shift unexpectedly
- Cannot reproduce historical confidence scores
- Filtering by confidence returns inconsistent results

**Phase to address:** Phase 2 (Production Hardening)

---

## Integration Pitfalls

### MODERATE: Replacing Perplexity Without Migration Strategy

**What goes wrong:**
Existing AI-GOS app uses Perplexity-based pricing extraction (inaccurate). Replacing with Firecrawl requires:
- Database schema changes (new fields for Firecrawl data)
- Handling competitors with both old and new data
- Deprecating old API endpoints
- Updating UI to show new data structure

Naive approach: delete old system, build new one → breaks existing features.

**Why it happens:**
Underestimating integration complexity. "Just swap the extraction logic" ignores downstream dependencies.

**Consequences:**
- Production downtime during migration
- Data loss (old pricing data deleted)
- Broken UI (expects old schema)
- User confusion (pricing changes)

**Prevention:**
1. **Dual-write strategy:**
   - Write to both Perplexity schema AND Firecrawl schema
   - Feature flag: `use_firecrawl_pricing` defaults to false
   - Gradually enable for subset of users
2. **Schema evolution, not replacement:**
   ```typescript
   interface CompetitorPricing {
     // Old Perplexity data
     perplexity_pricing?: string;        // deprecated
     perplexity_extracted_at?: Date;     // deprecated

     // New Firecrawl data
     firecrawl_tiers?: PricingTier[];
     firecrawl_confidence?: number;
     firecrawl_extracted_at?: Date;

     // Computed field for UI
     active_pricing: PricingTier[];      // uses Firecrawl if available, falls back to Perplexity
   }
   ```
3. **Backfill strategy:**
   - Re-scrape all competitors with Firecrawl
   - Compare old vs new data
   - Flag discrepancies for review
   - Cutover when 90%+ of competitors have Firecrawl data
4. **Rollback plan:**
   - Feature flag allows instant rollback to Perplexity
   - Keep old code path for 1-2 releases
   - Monitor error rates and data quality

**Detection:**
- Production errors after deployment
- Missing pricing data for competitors
- UI rendering errors
- User complaints about changed data

**Phase to address:** Phase 3 (Migration & Cutover)

---

### MODERATE: Not Handling Stale Data

**What goes wrong:**
Pricing pages change frequently:
- New tiers launched
- Prices increased/decreased
- Features added/removed
- Limited-time promotions

Scraped data becomes stale within weeks. Showing outdated pricing is worse than showing no pricing.

**Why it happens:**
No data freshness tracking or automatic refresh strategy.

**Consequences:**
- Showing competitor's old pricing to users
- Competitive analysis based on outdated data
- User discovers real price is different, loses trust
- Missing new competitor tiers/changes

**Prevention:**
1. **Timestamp all extractions:**
   ```typescript
   interface PricingData {
     tiers: PricingTier[];
     extracted_at: Date;
     url: string;
     confidence: number;
   }
   ```
2. **Auto-refresh schedule:**
   - High-priority competitors: weekly refresh
   - Medium-priority: bi-weekly
   - Low-priority: monthly
   - Triggered refresh when user views competitor detail
3. **Staleness indicators in UI:**
   - "Pricing last updated 3 weeks ago"
   - Warning if data is >60 days old
   - "Refresh now" button for manual trigger
4. **Change detection:**
   - Hash pricing data
   - On refresh, compare hash to previous
   - Alert if significant change detected (price change >10%, new tier)
5. **Retention policy:**
   - Keep historical pricing snapshots (time-series analysis)
   - Archive old data after 12 months
   - Allows "Pricing history" feature

**Detection:**
- User reports pricing doesn't match competitor website
- Data timestamps show months-old extractions
- Competitor announced new tier but not in system

**Phase to address:** Phase 2 (Production Operations)

---

### MINOR: Not Logging Extraction Failures

**What goes wrong:**
When scraping/extraction fails, system returns null or empty data without logging:
- Why did scraping fail? (404, 403, timeout)
- Why did extraction fail? (LLM error, invalid JSON, low confidence)
- Which competitor pricing pages consistently fail?

Silent failures prevent debugging and optimization.

**Consequences:**
- Cannot improve extraction for failing sites
- No visibility into failure patterns
- Cannot estimate real success rate
- Wasting credits on repeatedly failing URLs

**Prevention:**
1. **Structured error logging:**
   ```typescript
   interface ExtractionLog {
     competitor_id: string;
     pricing_url: string;
     timestamp: Date;
     stage: "discovery" | "scraping" | "extraction" | "validation";
     success: boolean;
     error_type?: "404" | "403" | "timeout" | "llm_error" | "low_confidence";
     error_message?: string;
     credits_consumed: number;
   }
   ```
2. **Failure rate dashboard:**
   - Overall success rate by stage
   - Top failing competitors
   - Error type distribution
   - Trend over time
3. **Alerting thresholds:**
   - Alert if success rate drops below 80%
   - Alert if specific competitor fails 3 times in a row
   - Daily digest of extraction failures
4. **Automatic retry logic:**
   - Retry with backoff on transient failures (timeout, 503)
   - Do NOT retry on permanent failures (404, 403)
   - Max 3 retries per URL

**Detection:**
- Competitors missing pricing data without explanation
- Cannot answer "why did this fail?"
- No data for optimizing extraction

**Phase to address:** Phase 1 (Foundation) - Essential observability

---

## Phase-Specific Warnings

| Phase | Focus | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| **Phase 1: Discovery & Foundation** | Build core scraping flow | JavaScript rendering failures, LLM hallucination, no logging | Use Firecrawl with JS rendering, strict schema extraction, comprehensive logging from day 1 |
| **Phase 2: Data Quality** | Improve accuracy | Inconsistent normalization, confidence miscalibration, stale data | Build normalization layer, calibrate thresholds on real data, implement auto-refresh |
| **Phase 3: Production Hardening** | Scale and reliability | Rate limit exhaustion, anti-bot blocking, integration breakage | Right-size Firecrawl plan, implement queue + backoff, dual-write migration strategy |
| **Phase 4: Enhancement** | Advanced features | Incomplete feature extraction, region/currency variants, dynamic pricing | Multi-page scraping, region detection, dynamic pricing flags |

---

## Summary: Top 5 Critical Pitfalls

### 1. LLM Hallucination in Structured Extraction
**Impact:** HIGH - Completely wrong pricing data with high confidence
**Prevention:** Strict schema, conservative prompts, source text attribution, multi-model validation
**Phase:** 1 (Foundation)

### 2. JavaScript Rendering Failures
**Impact:** HIGH - No pricing data extracted (empty results)
**Prevention:** Use Firecrawl with built-in JS rendering, validate scraped content contains pricing
**Phase:** 1 (Foundation)

### 3. Inconsistent Data Normalization
**Impact:** HIGH - Cannot compare pricing across competitors
**Prevention:** Build normalization layer for billing periods, currencies, units, features
**Phase:** 2 (Data Quality)

### 4. False High Confidence on Hallucinated Data
**Impact:** CRITICAL - Users trust wrong data
**Prevention:** Multi-signal confidence scoring with source text grounding, calibrated thresholds
**Phase:** 1 (Foundation)

### 5. Anti-Bot Detection Blocking Scraper
**Impact:** HIGH - Complete scraping failure
**Prevention:** Use Firecrawl's anti-bot handling, respectful scraping patterns, monitor status codes
**Phase:** 1 (Foundation)

---

## Sources

### Scraping & Anti-Bot
- [6 Web Scraping Challenges & Practical Solutions in 2026](https://research.aimultiple.com/web-scraping-challenges/)
- [DOs and DON'Ts of Web Scraping 2026](https://medium.com/@datajournal/dos-and-donts-of-web-scraping-e4f9b2a49431)
- [Stop Getting Blocked: Web Scraping Mistakes & Fixes](https://www.firecrawl.dev/blog/web-scraping-mistakes-and-fixes)

### Firecrawl Specifics
- [Firecrawl Rate Limits Official Docs](https://docs.firecrawl.dev/rate-limits)
- [Firecrawl Launch Week I: 2x Rate Limits](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)
- [8 Best Web Scraping APIs in 2025](https://www.firecrawl.dev/blog/best-web-scraping-api)
- [How Web Scraping APIs Handle Rate Limiting](https://www.firecrawl.dev/glossary/web-scraping-apis/how-web-scraping-apis-handle-rate-limiting-quotas)

### LLM Extraction & Hallucination
- [Hallucination Detection and Mitigation in Large Language Models (2026)](https://arxiv.org/pdf/2601.09929)
- [LLM Hallucination: Comprehensive Survey](https://arxiv.org/html/2510.06265v1)
- [Complete LLM Pricing Comparison 2026](https://www.cloudidr.com/blog/llm-pricing-comparison-2026)
- [Best Open Source LLM for Data Analysis 2026](https://www.siliconflow.com/articles/en/best-open-source-LLM-for-data-analysis)

### Confidence Scoring
- [Best Confidence Scoring Systems January 2026](https://www.extend.ai/resources/best-confidence-scoring-systems-document-processing)
- [Understanding Confidence Scores in Machine Learning](https://www.mindee.com/blog/how-use-confidence-scores-ml-models)
- [A Confidence Score for LLM Answers](https://medium.com/wbaa/a-confidence-score-for-llm-answers-c668844d52c8)
- [Interpret Confidence Score for Tables - Microsoft](https://learn.microsoft.com/en-us/ai-builder/interpret-confidence-score)

### Data Normalization
- [Why Unit of Measure Normalization is Critical](https://dataweave.com/blog/why-unit-of-measure-normalization-is-critical-for-accurate-and-actionable-competitive-pricing-intelligence)
- [Automated Data Extraction: Complete Guide for 2026](https://www.solvexia.com/automated-data-extraction)

### Pricing Discovery
- [Powerful Google Site Search Operators for Competitive Analysis 2026](https://www.clickrank.ai/google-site-search-operators-competitive-analysis/)
- [10 Best AI Tools for Competitor Analysis in 2026](https://visualping.io/blog/best-ai-tools-competitor-analysis)

---

**END OF PITFALLS RESEARCH**
