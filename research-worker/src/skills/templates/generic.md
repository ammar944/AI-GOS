# Generic / Fallback Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Use this template when the business
> vertical does not match a specialized template, or as a starting framework that can be
> adapted to any industry. Represents a balanced, risk-adjusted approach.

---

## Platform Mix (Balanced Default)

| Platform           | Budget Share | Role                                              | Priority |
|--------------------|--------------|---------------------------------------------------|----------|
| Google Search      | 40% – 50%    | Bottom-funnel intent; brand + category capture    | Primary  |
| Meta Ads (FB/IG)   | 25% – 35%    | Mid-funnel; retargeting; lookalike prospecting    | Secondary|
| Google Display     | 10% – 15%    | Remarketing; contextual awareness                 | Support  |
| LinkedIn (if B2B)  | 10% – 20%    | Professional audience targeting                   | Optional |
| YouTube            | 5% – 10%     | Brand awareness; retargeting; educational content | Support  |

**Decision tree for platform selection:**
- Consumer product / service: Start with Google Search + Meta; add YouTube if budget allows
- B2B product / service: Start with Google Search + LinkedIn; add Meta for retargeting
- Local service: Start with Google LSA + Google Search; add Meta for local awareness
- App: Replace with mobile app template

---

## Campaign Architecture

### Google Ads — Core Structure

```
Account
├── Campaign: Brand Search (always run)
│   ├── Ad Group: [Brand name] exact match
│   └── Ad Group: [Brand name] + product/service variants
│
├── Campaign: Competitor Research
│   ├── Ad Group: [Main competitor A] + "alternative" / "vs" / "compare"
│   └── Ad Group: [Main competitor B] + "alternative" / "vs"
│
├── Campaign: Category / Solution Intent
│   ├── Ad Group: [Primary service keyword] variants
│   ├── Ad Group: [Problem-driven keyword] variants
│   └── Ad Group: [Solution keyword] + "best" / "top" / "buy"
│
└── Campaign: Remarketing
    ├── Ad Group: All visitors (30-day)
    └── Ad Group: High-intent page visitors (pricing, contact, demo) (14-day)
```

### Meta Ads — Core Structure

```
Account
├── Campaign: Prospecting — Lookalike (CBO)
│   ├── Ad Set: LAL 1% Best Customers
│   └── Ad Set: LAL 2-3% Customers
│
├── Campaign: Prospecting — Interest (Testing)
│   ├── Ad Set: Interest Cluster A
│   └── Ad Set: Interest Cluster B
│
└── Campaign: Retargeting (CBO)
    ├── Ad Set: All website visitors (30-day)
    └── Ad Set: High-intent page visitors (7-day)
```

### LinkedIn (B2B Only)

```
Account
├── Campaign: ICP Prospecting
│   └── Target by: Job function + seniority + company size + industry
│
└── Campaign: Retargeting
    └── Website visitors via Insight Tag (30-day)
```

---

## Creative Strategy

### Universal Creative Testing Framework

| Test Round | What to Test                           | # Variants | Decision Criteria                            |
|------------|----------------------------------------|------------|----------------------------------------------|
| Round 1    | Message angle (3 different angles)    | 3          | Highest CTR after 1,000+ impressions each   |
| Round 2    | Format (video vs. image vs. carousel) | 2–3        | Lowest CPL at equal impression volume        |
| Round 3    | Offer / CTA (different lead magnets)  | 2          | Highest CPL efficiency with acceptable quality|
| Ongoing    | Headline copy (every 4–6 weeks)       | 2          | Beat control by > 15% CTR to replace         |

### Message Angle Hierarchy (Test in This Order)

1. **Outcome-first** — "Achieve [key result] without [main obstacle]"
2. **Problem-first** — "Struggling with [pain]? Here's what [category of people like them] do instead."
3. **Authority/proof** — "How [similar company/person] achieved [result] using [your solution]"
4. **Feature-benefit** — "[Key feature] means you can [valuable capability]"
5. **Comparison** — "[Your solution] vs. [status quo/competitor] — why [audience] are switching"

### Ad Copy Structure (Universal)

```
Headline:     [Outcome or Problem Hook] — 5-8 words
Primary text: [Pain agitation] → [Value proposition] → [Social proof] → [CTA]
              (Keep under 125 characters for mobile preview; expand if needed)
CTA button:   Match to funnel stage (Learn More / Get Quote / Sign Up / Shop Now)
Visual:       [Product/service in context] or [Before/after] or [Customer face/testimonial]
```

---

## Targeting Guidelines

### Google Search — Keyword Strategy

**Tiered approach (implement in order of priority):**

**Tier 1 — Transactional / Buy Intent:**
- `[product/service] [buy/pricing/cost/compare]`
- `best [category]`
- `[brand name]` (brand campaign — always highest priority)

**Tier 2 — Solution-Seeking:**
- `[category] software/tool/service/company`
- `[category] for [specific use case]`
- `[problem] solution`

**Tier 3 — Problem-Aware:**
- `how to [solve problem]`
- `[problem] fix`
- `[problem] help`

**Universal Negative Keywords (add to all campaigns):**
- `jobs`, `career`, `hiring`, `salary`, `employment`, `internship`
- `free` (unless you have a free offer)
- `course`, `certification`, `training`, `how to learn` (unless education is your product)
- `Wikipedia`, `definition`, `what is` (high informational intent, low commercial)
- Competitor brand names (from non-competitor campaigns)

### Meta Audience Build Order

1. **Lookalike 1%** from best customers → highest quality, lowest volume
2. **Lookalike 2–5%** from customers → broader reach for scaling
3. **Interest targeting** → discovery of new audience segments
4. **Broad (Advantage+)** → let Meta AI optimize without demographic constraints

**Retargeting priority:**
1. High-intent page visitors (pricing, contact, product detail) — 7 days
2. General website visitors — 30 days
3. Social media engagers (video viewers, post engagers) — 30–60 days

---

## Budget Guidelines

### Minimum Monthly Budget (All Stages)

| Monthly Revenue Stage | Minimum Ad Budget     | Platform Priority                              |
|-----------------------|-----------------------|------------------------------------------------|
| Pre-revenue           | $1,000 – $2,000       | Google Search only; validate offer             |
| < $10K/mo revenue     | $2,000 – $5,000       | Google Search primary; add Meta for retargeting|
| $10K – $50K/mo        | $5,000 – $15,000      | Both platforms; add LinkedIn if B2B            |
| $50K – $200K/mo       | $15,000 – $50,000     | Full platform mix; optimize by CAC/ROAS        |
| $200K+/mo             | $50,000+              | Ongoing optimization; incrementality testing  |

### 70/20/10 Budget Split

| Bucket      | Allocation | What Goes Here                                  |
|-------------|------------|-------------------------------------------------|
| Proven      | 70%        | Campaigns with positive ROAS and stable CPA     |
| Testing     | 20%        | New creative, new audiences, new platforms      |
| Exploration | 10%        | Net-new hypothesis (new channel, new message)   |

### Monthly Ramp-Up Schedule

| Month  | % of Target Budget | Focus                                              |
|--------|-------------------|----------------------------------------------------|
| 1      | 30%               | Tracking verification; baseline data gathering     |
| 2      | 50%               | Identify early winners; pause clear underperformers|
| 3      | 75%               | Scale winners; creative testing begins             |
| 4      | 100%              | Full budget; Smart Bidding stabilized              |
| 5+     | 100% + growth     | Scale on positive signals; creative refresh cycle  |

---

## KPI Targets

### Setting Targets (Work Backwards)

1. **Revenue goal** → determine number of new customers needed
2. **Average order value / ACV** → determine how many purchases needed
3. **Conversion rate** (lead to customer) → determine how many leads needed
4. **Lead volume** → determine budget based on target CPL

**Example calculation:**
- Monthly revenue goal: $100,000
- AOV: $500
- Purchases needed: 200
- Lead-to-purchase rate: 10%
- Leads needed: 2,000
- Target CPL: $15
- Required budget: $30,000

### Generic KPI Benchmarks

| Metric                  | Conservative      | Target            | Strong              |
|-------------------------|-------------------|-------------------|---------------------|
| Google Search CTR       | 2% – 3%          | 4% – 6%           | 7%+                 |
| Landing page conv. rate | 2% – 4%          | 5% – 8%           | 10%+                |
| Meta CTR                | 0.8% – 1.2%      | 1.5% – 2.5%       | 3%+                 |
| Cost per lead (blended) | [Varies by vertical] | ≤ 20% of LTV  | ≤ 10% of LTV        |
| ROAS (blended)          | 2x – 3x          | 4x – 6x           | 7x+                 |
| CAC:LTV ratio           | 1:1.5            | 1:3               | 1:5+                |
| Return on Ad Spend (monthly) | Break even | 3x+ of spend    | 5x+ of spend        |

### Universal Leading vs. Lagging Indicators

**Leading indicators (optimize weekly):**
- CTR by platform and ad format
- CPL by campaign/ad set
- Landing page conversion rate
- Creative performance (hook rate, hold rate)

**Lagging indicators (review monthly):**
- CAC (Cost to Acquire Customer)
- LTV:CAC ratio
- ROAS (revenue vs. ad spend)
- Payback period

---

## Standard Operating Procedures

### Weekly Review Checklist

- [ ] Review spend vs. budget pacing
- [ ] Check CTR trends by campaign
- [ ] Identify ads below CTR threshold (Google < 2%; Meta < 0.8%) — pause or refresh
- [ ] Review CPL vs. target — flag campaigns at > 130% of target CPA for 7+ days
- [ ] Check Search Terms report (Google) — add new negatives
- [ ] Verify conversion tracking is firing correctly

### Monthly Optimization Checklist

- [ ] Creative refresh: Replace bottom-20% performing ads
- [ ] Audience review: Update custom audiences and lookalikes
- [ ] Budget reallocation: Shift from underperformers to winners
- [ ] Negative keyword expansion
- [ ] Landing page A/B test review
- [ ] Bid strategy assessment: Is current strategy appropriate for conversion volume?
- [ ] Attribution model review: Are you comparing platforms on equal footing?

### Quarterly Strategic Review

- [ ] CAC by channel and campaign — is channel mix optimal?
- [ ] LTV data update — has cohort LTV changed? Does it affect bidding strategy?
- [ ] Competitor landscape check — new entrants, pricing changes, creative observations
- [ ] Platform fee changes or policy updates
- [ ] Seasonality planning for next quarter
- [ ] Creative strategy reset for next 90 days
