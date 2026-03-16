# B2B Enterprise Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to B2B companies with ACV > $25K,
> sales cycles of 3–18 months, and multi-stakeholder buying committees. Adjust for product-led
> growth motions where applicable.

---

## Platform Mix

| Platform           | Budget Share | Role                                              | Priority |
|--------------------|--------------|---------------------------------------------------|----------|
| LinkedIn Ads       | 35% – 50%    | ABM targeting; ICP-level precision; committee reach | Primary  |
| Google Search      | 25% – 35%    | Bottom-funnel intent; demo + comparison keywords  | Primary  |
| Meta Ads (FB/IG)   | 10% – 20%    | Retargeting; executive nurture; LinkedIn spillover | Secondary|
| YouTube / Video    | 5% – 10%     | Brand and category education; long-form nurture   | Support  |
| Google Display     | 5% – 10%     | ABM display; retargeting; conference periods      | Support  |

**ACV Adjustments:**
- ACV $25K–$100K: Balanced Google + LinkedIn; Meta retargeting layer
- ACV $100K–$500K: LinkedIn ABM dominant (40–50%); high-touch intent signals
- ACV $500K+: LinkedIn ABM + executive sponsorship ads; direct outreach integration

---

## Campaign Architecture

### LinkedIn Ads Structure

```
Account
├── Campaign Group: Prospecting — ICP Personas
│   ├── Campaign: Economic Buyers (CFO, CEO, COO)
│   │   └── Awareness + consideration content
│   ├── Campaign: Technical Evaluators (CTO, IT Director, Architect)
│   │   └── Technical depth content; integration messaging
│   └── Campaign: Champion/Day-User (Managers, Senior ICs)
│       └── Pain-solving + efficiency content
│
├── Campaign Group: ABM — Target Accounts
│   ├── Campaign: Tier 1 Accounts (20–50 accounts, high-touch)
│   │   └── Personalized messaging by account segment
│   ├── Campaign: Tier 2 Accounts (51–300 accounts)
│   │   └── Industry + role personalization
│   └── Campaign: Tier 3 Accounts (300–3,000 accounts)
│       └── Broad but ICP-filtered
│
└── Campaign Group: Retargeting
    ├── Campaign: Website visitors (Insight Tag, 30-day)
    └── Campaign: Content engagers (video viewers, doc downloaders)
```

### Google Ads Structure

```
Account
├── Campaign: Brand Search (Exact + Phrase)
│
├── Campaign: Competitor Search
│   ├── Ad Group: [Competitor A] + vs / alternative / compared
│   ├── Ad Group: [Competitor B] + vs / alternative
│   └── Ad Group: Category leaders (for "best [category]" intent)
│
├── Campaign: Solution/Problem Search
│   ├── Ad Group: Primary problem keywords
│   └── Ad Group: Category + enterprise keywords
│
└── Campaign: Remarketing Display
    ├── Ad Group: Pricing page / ROI calculator visitors
    ├── Ad Group: Demo request abandons
    └── Ad Group: Whitepaper/case study downloaders
```

### Meta Ads Structure

```
Account
├── Campaign: Executive Retargeting (LinkedIn spillover)
│   └── Ad Set: Website visitors (job title enriched via CRM retargeting)
│
└── Campaign: Lookalike Prospecting
    ├── Ad Set: LAL 1% from CRM contacts
    └── Ad Set: LAL 1% from won opportunities
```

---

## Creative Strategy

### Content Types by Funnel Stage

| Stage           | Content Format                              | Message Focus                                  |
|-----------------|---------------------------------------------|------------------------------------------------|
| Awareness       | Industry report; thought leadership video   | Category problem framing; market trends        |
| Education       | Webinar; case study; ROI calculator          | How to solve the problem; success stories      |
| Consideration   | Product demo video; comparison guide; G2     | Why your solution; differentiation             |
| Decision        | Free trial; custom ROI analysis; proof packs| Remove risk; procurement/security docs         |
| Post-demo nurture| LinkedIn nurture sequence; retarget content | Objection handling; champion enablement        |

### Messaging Framework by Stakeholder

| Role                     | Primary Pain                          | Message Angle                                   |
|--------------------------|---------------------------------------|-------------------------------------------------|
| Economic buyer (CFO/CEO) | Risk, cost, ROI, competitive pressure | "Save $X/yr" or "Reduce [risk]"; board-level case|
| Technical evaluator      | Security, integration, implementation | API docs, SOC 2, existing tool integrations      |
| Champion (end user)      | Day-to-day friction, team adoption    | "Save 10 hrs/wk"; ease of use; peer comparison  |
| Procurement / Legal      | Contract risk, compliance             | SLA, DPA, MSA readiness; vendor security docs   |

### Ad Format Effectiveness for Enterprise

| Format                      | Platform     | Stage       | Notes                                         |
|-----------------------------|--------------|-------------|-----------------------------------------------|
| Sponsored content (doc/PDF) | LinkedIn     | Education   | Gated content download via lead gen form      |
| Conversation Ads            | LinkedIn     | Mid-funnel  | Personalized InMail at scale                  |
| Video (2–5 min)             | YouTube/LI   | Consideration| Deep-dive product demo or customer story      |
| Display banner series       | Google/LI    | Awareness   | Sequential messaging (ad 1 → ad 2 → ad 3)    |
| RSA with ROI headline       | Google       | Bottom      | "Save $X per employee per year" + demo CTA    |
| Case study carousel         | LinkedIn/Meta| Retarget    | Industry-specific customer results            |

---

## Targeting Guidelines

### LinkedIn ABM Setup

**Tier 1 ABM (highest ACV deals):**
- Upload 20–50 named account list (domain match)
- Target all roles (decision makers + evaluators + champions) within those accounts
- Message: Personalized to account or account segment (industry + company size)
- Frequency cap: 3–4 per week; monitor engagement carefully
- Budget: $3,000 – $10,000/mo per tier 1 ABM campaign

**Tier 2 ABM:**
- Company list: 51–300 accounts (target account list from sales)
- Role targeting overlay: Function + seniority
- Frequency cap: 2–3 per week
- Budget: $2,000 – $5,000/mo

**ICP Persona Targeting (non-ABM):**
- Define ICP by: Industry + Company Size + Job Function + Seniority
- Example ICP: Technology companies, 200–5,000 employees, IT/Engineering, Director+
- Audience size should be 50,000 – 500,000 per campaign (not smaller)

### Google Search Intent Tiers

**Bottom-funnel keywords (highest priority):**
- `[Brand] + demo/pricing/free trial` → Brand campaign
- `[Competitor] + alternative/vs/comparison` → Competitor campaign
- `best [category] software for enterprise` → Category campaign
- `[category] vendor comparison` → Category campaign

**Mid-funnel keywords:**
- `enterprise [category] platform`
- `[category] for [specific industry]`
- `how to [core use case]`

**Negative keyword list for B2B Enterprise:**
- `free`, `cheap`, `small business`, `startup` (if targeting mid-market+)
- `jobs`, `careers`, `salary`
- `tutorial`, `course`, `certification` (if they attract student intent)

---

## Budget Guidelines

### Minimum Monthly Budget by Target Segment

| Target Segment              | Minimum Monthly Budget | Notes                                           |
|-----------------------------|------------------------|-------------------------------------------------|
| SMB B2B (< 200 employees)   | $5,000 – $10,000       | Google Search dominant; LinkedIn secondary      |
| Mid-Market (200–2,000 emp.) | $10,000 – $30,000      | Full mix; LinkedIn + Google balanced            |
| Enterprise (2,000+ emp.)    | $30,000 – $100,000+    | LinkedIn ABM dominant; long-cycle investment    |

### Budget Allocation Across Funnel

| Funnel Stage     | Budget Allocation | Rationale                                          |
|------------------|-------------------|----------------------------------------------------|
| Top-funnel       | 20% – 30%         | Build pipeline of target accounts / ICP aware       |
| Mid-funnel       | 30% – 40%         | Educate and qualify; content downloads + demos      |
| Bottom-funnel    | 30% – 40%         | Capture in-market intent; defend against competitors|
| Retargeting      | 10% – 15%         | Nurture engaged prospects through long sales cycle  |

### Patience Requirement

Enterprise B2B paid media requires 6–12 months to show full pipeline impact:
- Month 1–3: Audience building; tracking calibration; baseline CPL
- Month 4–6: Creative optimization; ABM refinement; pipeline begins flowing
- Month 7–12: Attribution becomes clearer; ROAS measurable against won revenue
- Year 2: Compound effect of brand awareness + in-market capture = lower CAC

---

## KPI Targets

### Primary KPIs

| Metric                     | Target Range (Industry Benchmark)            | Notes                                         |
|----------------------------|----------------------------------------------|-----------------------------------------------|
| MQL CPL (blended)          | $80 – $300 (mid-market); $200 – $600 (enterprise) | LinkedIn CPL higher; offset by lead quality |
| MQL-to-SQL Rate            | 15% – 35%                                   | Below 15% = targeting or message/offer issue  |
| SQL-to-Opportunity Rate    | 30% – 60%                                   | Sales team handling; not purely marketing     |
| Pipeline Sourced (paid)    | 20% – 40% of total pipeline                 | Varies by marketing maturity                  |
| CAC (fully loaded)         | 15% – 25% of Year-1 ACV                     | ACV $50K = acceptable CAC $7.5K – $12.5K    |

### Secondary KPIs

| Metric                     | Target                                       | Notes                                         |
|----------------------------|----------------------------------------------|-----------------------------------------------|
| Demo Request CPA           | $200 – $800 (blended)                        | Platform-specific ranges wider                |
| Content Download CPL       | $30 – $80                                    | Top-funnel metric; not all downloads = pipeline|
| LinkedIn Engagement Rate   | 0.5% – 1.5%                                  | Thought leadership can hit 2–4%               |
| Google Search CTR          | 3% – 7% (category); 10%+ (brand)            | CTR signals message-audience fit              |
| Influenced Pipeline        | Track multi-touch                            | Paid touch within 90 days of opportunity creation|

### Enterprise Attribution Approach

Given 3–18 month sales cycles, last-click attribution severely undervalues paid media. Recommended approach:
- **Multi-touch attribution**: Track all paid touchpoints from first touch to opportunity creation
- **Pipeline influence**: Report on deals where paid media was in the last 90-day journey
- **Time-to-close correlation**: Does paid media sourced pipeline close faster or at higher win rate?
- **Account engagement score**: LinkedIn + Google touchpoints per target account as leading indicator
