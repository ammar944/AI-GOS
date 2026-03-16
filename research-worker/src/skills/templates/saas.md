# SaaS / Software Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to B2B and B2C SaaS with
> free trial, freemium, or demo-driven acquisition models. Adjust platform mix based on ACV.

---

## Platform Mix

| Platform           | Budget Share | Role                                              | Priority |
|--------------------|--------------|---------------------------------------------------|----------|
| Google Search      | 35% – 45%    | Bottom-funnel intent capture; demo + trial keywords| Primary  |
| LinkedIn Ads       | 25% – 35%    | B2B audience targeting; ICP-level precision       | Primary  |
| Meta Ads (FB/IG)   | 15% – 25%    | Retargeting + mid-funnel nurture; lookalike prosp.| Secondary|
| Google Display/YouTube | 5% – 10% | Remarketing; brand awareness for longer sales cycles| Support|

**ACV-Based Adjustments:**
- ACV < $5K/yr: Lean into Google Search + Meta; reduce LinkedIn (CPL too high relative to deal size)
- ACV $5K–$25K/yr: Balanced mix above; LinkedIn justified
- ACV > $25K/yr: Increase LinkedIn to 35–40%; ABM targeting on company accounts
- PLG / Freemium: Google Search + Meta dominant; LinkedIn only for enterprise tier

---

## Campaign Architecture

### Google Ads Structure

```
Account
├── Campaign: Brand Search
│   └── Ad Group: [Brand Name] Exact + Phrase
│
├── Campaign: Competitor Search
│   ├── Ad Group: [Competitor 1] + alternative/vs
│   ├── Ad Group: [Competitor 2] + alternative/vs
│   └── Ad Group: [Competitor 3] + alternative/vs
│
├── Campaign: Category/Problem Search
│   ├── Ad Group: [Primary Problem] keywords
│   ├── Ad Group: [Category Name] software/tool/platform
│   └── Ad Group: [Use Case] keywords
│
├── Campaign: Performance Max (Prospecting)
│   └── Asset Group: Core ICP — all assets
│
└── Campaign: Remarketing (Display/YouTube)
    ├── Ad Group: Trial starts (nurture)
    ├── Ad Group: Pricing page visitors (7-day)
    └── Ad Group: Demo page abandons (14-day)
```

**Naming Convention**: `[Market]-[Objective]-[Audience]-[Match Type]`
Example: `US-Demo-Category-Exact`

### LinkedIn Ads Structure

```
Account
├── Campaign Group: Prospecting — Cold
│   ├── Campaign: [Job Function + Seniority] — Awareness
│   │   └── Format: Single Image / Video (educational)
│   └── Campaign: [ICP Titles] — Conversion
│       └── Format: Lead Gen Form / Sponsored Message
│
├── Campaign Group: Retargeting
│   ├── Campaign: Website Visitors 30-day
│   └── Campaign: Lead Form Openers (no submit)
│
└── Campaign Group: ABM (ACV > $25K only)
    └── Campaign: Target Account List — Sponsored Content
```

### Meta Ads Structure

```
Account
├── Campaign: Prospecting — Lookalike (CBO)
│   ├── Ad Set: LAL 1% Customers
│   └── Ad Set: LAL 2% High-LTV
│
├── Campaign: Interest Prospecting (ABO testing)
│   ├── Ad Set: Interest Cluster A
│   └── Ad Set: Interest Cluster B
│
└── Campaign: Retargeting (CBO)
    ├── Ad Set: Pricing/Demo Page (7-day)
    ├── Ad Set: Blog/Content readers (30-day)
    └── Ad Set: Trial users — upgrade (Custom Audience)
```

---

## Creative Strategy

### Ad Formats by Funnel Stage

| Stage          | Platform      | Format                  | Message Angle                                  |
|----------------|---------------|-------------------------|------------------------------------------------|
| Awareness      | LinkedIn/YT   | Video (60–90 sec)        | Problem education; category creation           |
| Consideration  | Meta/LinkedIn | Single image + carousel  | Product demo screens; feature highlight        |
| Conversion     | Google        | RSA                     | Demo/trial CTA; competitor comparison           |
| Retargeting    | Meta/Display  | Single image / dynamic   | Social proof; objection handling; urgency      |

### Messaging Angles to Test (Priority Order)

1. **Problem-first**: Lead with the pain the software solves ("Still exporting to spreadsheets?")
2. **Outcome-first**: Lead with the result the customer achieves ("Close 30% more deals")
3. **Competitor comparison**: "The [Competitor] alternative built for [ICP]"
4. **Social proof**: Customer logos, G2 rating, specific customer result
5. **Free trial / no CC**: Lower friction of the offer prominently
6. **Integration**: "Works with Salesforce, HubSpot, Slack" (reduces adoption risk)

### Creative Testing Cadence

- New creatives: every 4–6 weeks minimum (creative fatigue sets in faster in SaaS)
- Test: Video vs. static image for trial campaigns
- Test: Demo-focused imagery vs. abstract/lifestyle
- Test: Feature highlight carousel vs. single benefit
- Evergreen: Customer testimonial / case study ads (refresh proof point quarterly)

---

## Targeting Guidelines

### Google Search Keywords (Priority Tiers)

**Tier 1 — Highest Intent (start here):**
- `[Brand name]` (exact)
- `[Competitor name] alternative` (phrase)
- `[Competitor name] vs [Category]` (phrase)
- `best [category software]` (phrase)
- `[category software] pricing` (phrase)

**Tier 2 — Solution-Aware:**
- `[primary use case] software`
- `[primary problem] tool`
- `[category] platform for [industry]`

**Tier 3 — Problem-Aware:**
- `how to [solve problem]`
- `[problem] solution`
- `[workflow pain point] automation`

### ICP Targeting (LinkedIn)

Define your ICP along these dimensions for LinkedIn targeting:
- Job function: Marketing / Sales / IT / Finance / Operations (pick 1–2 primary)
- Seniority: Manager + Director + VP + CXO (exclude Entry/Junior for B2B)
- Company size: Match your ICP (e.g., 50–500 employees for SMB SaaS)
- Industry: Top 3–5 verticals where you have case studies

### Meta Lookalike Sources (Priority)

1. Customer email list (all-time customers or last 12 months)
2. Trial signups (last 90 days)
3. Pricing page visitors (last 30 days)
4. Demo form completions (last 90 days)

### Exclusions (Always Apply)

- Current customers (email Custom Audience)
- Current active trial users
- Employees and related emails
- Job seekers (negative keywords: "jobs," "career," "salary")
- Brand terms in competitor campaigns (unless testing conquest)

---

## Budget Guidelines

### Minimum Monthly Budget

| Company Stage      | Minimum Monthly Budget | Platform Priority                               |
|--------------------|------------------------|-------------------------------------------------|
| Pre-PMF / Testing  | $3,000 – $5,000        | Google Search only; no LinkedIn yet             |
| Early traction     | $5,000 – $15,000       | Google Search (60%) + Meta (40%)               |
| Growth stage       | $15,000 – $50,000      | Full platform mix; LinkedIn justified           |
| Scale              | $50,000+               | Optimize mix based on CAC data; ABM layer       |

### Budget Ramp-Up Schedule

| Month  | Budget Level | Focus                                              |
|--------|-------------|----------------------------------------------------|
| Month 1| 40% of target| Brand + Competitor Search; tracking setup         |
| Month 2| 65% of target| Add Category Search; launch Meta retargeting      |
| Month 3| 85% of target| Add LinkedIn prospecting; expand Meta to LAL       |
| Month 4+| 100%        | Full mix; optimize toward CAC by channel           |

### Scaling Triggers

- Google Search: CAC ≤ 80% of target for 3+ consecutive weeks → +20% budget increment
- LinkedIn: MQL-to-SQL rate ≥ 15% from LinkedIn leads → increase LinkedIn allocation
- Meta: Trial-to-paid conversion ≥ target → scale prospecting campaigns

---

## KPI Targets

### Primary KPIs

| Metric                     | Target Range (Industry Benchmark)             | Notes                                    |
|----------------------------|-----------------------------------------------|------------------------------------------|
| Trial/Demo CAC (blended)   | $50 – $300 (SMB); $300 – $1,000+ (enterprise) | Depends on ACV; CAC:LTV ratio ≥ 1:3    |
| Trial-to-Paid Conversion   | 10% – 25% (product-led); 20% – 40% (sales)  | Key efficiency lever                     |
| MQL-to-SQL Rate            | 15% – 30%                                    | Indicates lead quality                   |
| CAC Payback Period         | 6–18 months                                  | < 12 months preferred for growth         |
| Blended ROAS (paid)        | 2x – 5x (on LTV; not first-year revenue)    | Use LTV-based ROAS for bidding           |

### Secondary KPIs

| Metric                     | Target                                        | Notes                                    |
|----------------------------|-----------------------------------------------|------------------------------------------|
| Trial/Demo CPA             | $40 – $200 (varies by market)                | Platform-specific; lower for Meta        |
| CTR (Google Search)        | 4% – 8%                                      | < 3% = headline or match type issue     |
| CTR (LinkedIn)             | 0.4% – 0.8%                                  | > 0.8% = strong creative                |
| Trial Activation Rate      | 40% – 70%                                    | % of trials who complete key activation  |
| Feature Adoption (in-trial)| Varies by product                            | Leading indicator of paid conversion     |

### Attribution Model for SaaS

- Use 30-day click / 1-day view window (accounts for longer consideration cycles)
- Google: Data-driven attribution if ≥ 300 trials/month; else last-click
- Meta: 7-day click / 1-day view (standard)
- Cross-channel: Import GA4 goals into Google Ads; compare platform-reported vs. GA4 de-duplicated
