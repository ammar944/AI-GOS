// Sources: claude-ads/benchmarks.md + bidding-strategies.md + budget-allocation.md,
// coreyhaines31/paid-ads + ad-creative, kaancat/mb-google-ads-audit,
// cohnen/mcp-google-ads, ComposioHQ/competitive-ads-extractor
// Prepend to researchKeywords sub-agent system prompt

export const KEYWORD_PPC_SKILL = `
## Keyword & PPC Strategy Domain Knowledge

### 2026 Platform Benchmarks (Cited: WordStream/LocaliQ 16K campaigns, Databox, Revealbot)
Google Ads:
- Avg CPC: $5.26 (search), $0.63 (display)
- Avg CTR: 6.66% (search), 0.60% (display)
- Avg CVR: 7.52% (search), 1.12% (display)
- Performance Max: 15-30% lower CPA vs standard campaigns when properly configured

Meta Ads:
- CPC: $0.70-$1.32 (varies by objective)
- CPM: $5.82 (broad) to $50+ (narrow B2B)
- ROAS: 2.19 median, 4.52 with Advantage+ Shopping Campaigns (ASC)
- Creative fatigue: refresh every 2-4 weeks or when frequency >3

LinkedIn Ads:
- CPC: $5-$7 (Sponsored Content)
- CTR: 0.44-0.65%
- Lead Gen Form CVR: 13% (3.25x vs landing pages)
- Minimum viable budget: $3K/month for meaningful data

TikTok Ads:
- CPM: $3.21-$10
- CPC: $0.20-$2.00
- Smart+ median ROAS: 1.41-1.67
- Best for: awareness and DTC, weak for B2B enterprise

Microsoft Ads:
- CPC: $1.20-$1.55 (20-35% discount vs Google)
- Copilot placements: 73% higher CTR (emerging channel)

### Keyword Intent Classification
- Navigational: brand name searches — own your brand, bid on competitor brands selectively
- Informational: "how to", "what is" — top-of-funnel, low conversion, use for content/remarketing
- Commercial Investigation: "best X", "X vs Y", "X reviews" — mid-funnel, high intent
- Transactional: "buy X", "X pricing", "X demo" — bottom-funnel, highest conversion rate
- Priority for paid: Transactional > Commercial > Navigational > Informational

### Campaign Architecture Patterns
- Alpha/Beta structure: Alpha = exact match proven winners, Beta = phrase/broad for discovery
- Single Keyword Ad Groups (SKAGs): legacy, still useful for top 10 highest-value terms
- Theme-based ad groups: 5-15 tightly related keywords per group (2026 best practice)
- Negative keyword mining: run weekly search term reports, add irrelevant matches as negatives

### Budget Allocation by Business Type (claude-ads, 2026)
- SaaS B2B: Google 35-45%, LinkedIn 30-40%, Meta 15-25% — min $5K/mo
- E-commerce: Meta 50-68%, Google PMax 23-30%, TikTok 5-15% — min $3K/mo
- Local Services: Google 60-70%, Meta 20-30%, Yelp/LSA 10% — min $1.5K/mo
- B2B Enterprise: LinkedIn 40-50%, Google 30-40%, ABM platforms 10-20% — min $10K/mo

### Bidding Strategy Decision Tree (Google Ads, 2026)
- <15 conversions/month: Max Clicks (insufficient data for smart bidding)
- 15-29 conversions/month: Maximize Conversions (learning phase)
- 30-49 conversions/month: Target CPA (enough signal for optimization)
- 50+ conversions/month: Target ROAS (full smart bidding capability)
- NOTE: eCPC deprecated March 31, 2025. DDA (data-driven attribution) mandatory September 2025.

### Match Type Strategy (2026)
- Exact match: use for proven, high-intent keywords (brand terms, "pricing", "demo")
- Phrase match: primary discovery tool in 2026 — Google's AI expands intelligently
- Broad match: ONLY with smart bidding + sufficient conversion data (30+ conv/mo)
- Negative exact: block specific irrelevant queries
- Negative phrase: block categories of irrelevant traffic

### Quality Score Optimization
- Expected CTR: ad relevance to query — use dynamic keyword insertion for top terms
- Ad relevance: headline must echo the keyword theme
- Landing page experience: message match, speed (<3s), mobile-friendly, clear CTA
- Each 1-point QS improvement = ~16% CPC reduction

### Keyword Opportunity Scoring
- Priority Score = (Search Volume × Intent Score × Relevance) / (CPC × Difficulty)
- High priority: score >70, commercial/transactional intent, CPC within budget
- Medium priority: score 40-70, needs testing
- Low priority: score <40, informational or too expensive for current budget

### PPC Audit Red Flags (kaancat framework)
- >20% of spend on search terms with no conversion history = wasted spend
- <3 ad variations per ad group = insufficient testing
- No negative keyword list = bleeding money
- Click-to-conversion rate <2% on search = landing page or offer problem
- Average position data deprecated — use impression share and top-of-page rate instead
`;
