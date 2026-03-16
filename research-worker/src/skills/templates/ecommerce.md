# E-commerce / DTC Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to direct-to-consumer e-commerce
> brands selling physical products online. Adjust based on AOV (average order value) and
> purchase frequency.

---

## Platform Mix

| Platform            | Budget Share | Role                                             | Priority |
|---------------------|--------------|--------------------------------------------------|----------|
| Google Shopping     | 30% – 40%    | High-intent product discovery; product feed ads | Primary  |
| Meta Ads (FB/IG)    | 25% – 35%    | Cold acquisition; DPA retargeting; UGC          | Primary  |
| Google Search       | 10% – 20%    | Brand + competitor terms; generic product search| Secondary|
| TikTok Ads          | 10% – 15%    | Top-of-funnel; Gen Z/Millennial acquisition      | Secondary|
| Google Performance Max | 10% – 15% | Cross-channel automation; feed-based campaigns  | Secondary|
| YouTube / Display   | 5% – 10%     | Retargeting; brand building                     | Support  |

**AOV-Based Adjustments:**
- AOV < $50: Google Shopping + Meta dominant; TikTok for volume
- AOV $50–$150: Balanced mix; DPA retargeting critical
- AOV $150–$500: Google Search + Shopping; Meta retargeting; YouTube consideration
- AOV $500+: Google Search + Shopping; YouTube; reduce impulse-driven TikTok share

---

## Campaign Architecture

### Google Ads Structure

```
Account
├── Campaign: Shopping — Brand (Smart / PMax)
│   └── Product feed: Brand-specific products
│
├── Campaign: Shopping — Best Sellers (Smart / PMax)
│   └── Product groups: Top 20% revenue-generating SKUs
│
├── Campaign: Shopping — Prospecting
│   └── Full catalog with segmented product groups
│
├── Campaign: Search — Brand
│   ├── Ad Group: [Brand Name] exact
│   └── Ad Group: [Brand Name] + product category
│
├── Campaign: Search — Competitor / Category
│   ├── Ad Group: [Competitor] alternatives
│   └── Ad Group: [Category keyword] best/top/buy
│
└── Campaign: Performance Max (optional layer)
    └── Asset groups by product category
```

**Shopping Campaign Priority Hierarchy:**
Set "Brand" campaign priority = High, "Best Sellers" = Medium, "Prospecting" = Low. Higher priority campaigns win the auction first, preserving ROAS on known winners.

### Meta Ads Structure

```
Account
├── Campaign: Prospecting — Advantage+ Shopping (CBO)
│   └── Catalog: Full product feed; Advantage+ audience
│
├── Campaign: Prospecting — Cold Audiences (CBO)
│   ├── Ad Set: LAL 1% Purchasers
│   ├── Ad Set: LAL 2% Purchasers
│   └── Ad Set: Interest Clusters (category-aligned)
│
├── Campaign: Retargeting — DPA (CBO)
│   ├── Ad Set: Cart abandons (3-day)
│   ├── Ad Set: Product viewers — no cart (7-day)
│   └── Ad Set: Checkout initiators (1-day)
│
└── Campaign: Past Purchasers — Upsell/Repurchase
    └── Ad Set: 30-day, 60-day, 90-day purchase windows
```

### TikTok Ads Structure

```
Account
├── Campaign: Awareness — Video (Spark Ads)
│   └── Ad Group: Broad audience; UGC-style video
│
├── Campaign: Conversion — Cold Prospecting
│   ├── Ad Group: Interest targeting (category)
│   └── Ad Group: Behavioral (online shoppers)
│
└── Campaign: Retargeting
    └── Ad Group: Website visitors (7-day)
```

---

## Creative Strategy

### Ad Formats by Funnel Stage

| Stage          | Platform         | Format                   | Message Angle                                  |
|----------------|------------------|--------------------------|------------------------------------------------|
| Awareness      | TikTok/Instagram | Video 15–30 sec (UGC)   | Problem/aspiration hook; lifestyle context     |
| Consideration  | Meta/Display     | Carousel; single image   | Product features; compare variants; reviews    |
| Purchase intent| Google Shopping  | Product listing ad        | Price, reviews, in-stock signal                |
| Retargeting    | Meta/Display     | DPA / catalog ads         | "You viewed this" + social proof + urgency     |
| Repurchase     | Meta/Email       | Single image / GIF        | Replenishment timing; bundle offers; LTV push  |

### Creative Pillars for E-commerce

1. **Product hero shots**: Clean white/lifestyle background; show product clearly
2. **UGC / Customer video**: Real people using the product; authentic > polished for cold audiences
3. **Social proof**: Review count, star rating, "X people bought this week"
4. **Value proposition**: Key differentiator vs. generic alternatives
5. **Promotion / offer**: Discount, free shipping, bundle deal — especially effective in retargeting
6. **Before/after**: Applicable for beauty, fitness, home products

### Testing Priority

1. Creative format: UGC video vs. studio product video vs. static image
2. Hook variation: Problem-first vs. product-first vs. social proof-first
3. Offer framing: Dollar off vs. percentage off vs. free shipping
4. Catalog overlay: Price overlay vs. no price in DPA creative
5. Video length: 7-second vs. 15-second vs. 30-second

---

## Targeting Guidelines

### Google Shopping

**Product Feed Optimization (highest ROAS lever):**
- Titles: Lead with category + brand + key attribute (e.g., "Women's Running Shoes - Nike Air - Size 8")
- Include size, color, material in title for attribute-specific searches
- Descriptions: First 170 characters = most important; include keywords naturally
- Images: White background for apparel; lifestyle for home/beauty
- GTINs: Required for branded products; improves eligibility and ROAS
- Price: Must match exactly; discrepancy = suspension risk

**Bidding by Product Tier:**
- Best sellers (top 20% by revenue): Highest bids; monitor daily
- Mid-tier: Target ROAS bidding; auto-optimize
- Long-tail / low-volume: Lower bids; exclude if no conversions in 60 days

### Meta Targeting

**Cold Prospecting Audiences:**
- Advantage+ Shopping (recommended first test)
- LAL 1% from purchasers (last 180 days)
- Interest clusters: 2–4 category-relevant interests per ad set (keep ad sets broad; $50+/day)
- Demographic overlay: Age range aligned with customer data; exclude obviously wrong demographics

**DPA Retargeting Setup:**
- Product catalog fully synced (Shopify/WooCommerce plugin)
- Catalog ads with price overlay
- Exclude purchasers from cart-abandon retargeting (use 7-day purchase window exclusion)
- Custom overlay template: "You left this behind" or star-rating overlay for social proof

### Audience Exclusions

- Current subscribers / loyalty members from acquisition campaigns
- Recent purchasers (14–30 days) from prospecting
- Known fraud signals (if identifiable via CRM)

---

## Budget Guidelines

### Minimum Monthly Budget

| Revenue Stage       | Minimum Monthly Ad Budget | Platform Priority                              |
|---------------------|---------------------------|------------------------------------------------|
| Pre-revenue testing | $2,000 – $3,000           | Meta only; validate creative and offer         |
| $0–$50K/mo revenue  | $3,000 – $8,000           | Meta + Google Shopping                        |
| $50K–$200K/mo       | $8,000 – $30,000          | Full mix; performance max test                |
| $200K+/mo           | $30,000+                  | All channels; TV/influencer possible           |

**Rule of thumb**: Paid ad spend should represent 10–25% of gross revenue target. Higher during growth phase, lower during profitability phase.

### Seasonality Budget Allocation

| Period                  | Budget Adjustment    | Notes                                          |
|-------------------------|----------------------|------------------------------------------------|
| Q4 (Oct–Dec)            | +40% – +80%          | Biggest revenue period; defend share           |
| Black Friday / Cyber Mon.| 2x – 3x weekly budget| Pre-load creatives Oct 1; raise bids Nov 15   |
| January                 | –20% (then recovery) | Lower intent; use for creative testing         |
| Mother's / Father's Day | +20% – +30%          | Gift categories only                           |
| Back-to-School          | +20% – +30%          | Relevant categories only                       |

---

## KPI Targets

### Primary KPIs

| Metric               | Target Range (Industry Benchmark)         | Notes                                            |
|----------------------|-------------------------------------------|--------------------------------------------------|
| Blended ROAS         | 3x – 5x (mature brands)                  | New brands: 2x – 3x acceptable while scaling     |
| CAC (first order)    | ≤ 30% – 40% of AOV                        | CAC:LTV ratio must be ≥ 1:3 for sustainability   |
| Google Shopping ROAS | 4x – 8x (brand terms); 2x – 4x (generic)| Brand campaign ROAS should never drop below 5x  |
| Meta DPA ROAS        | 4x – 10x (retargeting)                   | Cart abandon DPA is typically highest ROAS asset|
| Meta Prospecting ROAS| 2x – 4x                                  | Cold audiences; lower than retargeting expected  |

### Secondary KPIs

| Metric               | Target                                    | Notes                                            |
|----------------------|-------------------------------------------|--------------------------------------------------|
| Cart Abandon Recovery Rate | 10% – 25%                         | Via email + DPA retargeting combined             |
| Repeat Purchase Rate | 20% – 40% (12-month cohort)              | Paid media efficiency improves as repeat % rises |
| LTV:CAC Ratio        | ≥ 3:1                                    | Below 2:1 = acquisition economics unsustainable  |
| Add-to-Cart Rate     | 5% – 15% (landing page)                  | Below 5% = product-market or pricing issue       |
| Checkout Rate        | 50% – 80% of add-to-cart                 | Below 50% = checkout friction issue              |
| Return Rate (%)      | Monitor; high returns signal messaging mismatch | Inflated ROAS from high-return products   |

### Attribution Notes

- Use 7-day click / 1-day view on Meta for e-commerce (standard)
- Google Shopping: Use data-driven attribution if ≥ 100 purchases/month; else last-click
- Beware: Platform-reported ROAS is always higher than GA4 because of attribution overlap
- True incrementality: Consider holdout testing quarterly on mature accounts ($50K+/mo)
