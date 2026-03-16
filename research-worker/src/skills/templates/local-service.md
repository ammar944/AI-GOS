# Local Services Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to local and regional service
> businesses: HVAC, plumbing, roofing, legal, dental, medical practices, cleaning, landscaping,
> auto repair, and similar geo-targeted service businesses.

---

## Platform Mix

| Platform             | Budget Share | Role                                              | Priority |
|----------------------|--------------|---------------------------------------------------|----------|
| Google Local Services Ads | 25% – 35% | Pay-per-lead; Google Guaranteed badge; reviews | Primary  |
| Google Search        | 30% – 40%    | Service + location keywords; intent capture       | Primary  |
| Meta Ads (FB/IG)     | 15% – 25%    | Awareness + promotion in geo; retargeting         | Secondary|
| Google Display / Remarketing | 5% – 10% | Past visitor nurture; seasonal promotions     | Support  |
| Yelp / Local Directories | 5% – 10% | Local intent capture; review platform ads        | Support  |

**Geography note**: Most local businesses should set tight geographic radius (5–25 miles).
Never run national targeting for local-only service businesses.

---

## Campaign Architecture

### Google LSA Setup

Google Local Services Ads appear above all Search ads. Pay per qualified lead (phone call or message).

**Setup Requirements:**
- Complete business profile with hours, service area, services offered
- Minimum 3–5 Google reviews to show "Google Screened" or "Google Guaranteed" badge
- Pass Google's background check (varies by category)
- Set geographic service area precisely — zip codes or city-level
- Budget: Set weekly budget; Google charges per lead, not per click

**LSA Categories (most common):**
- Home services: HVAC, plumbing, electrical, roofing, cleaning, landscaping
- Professional services: Legal, financial advisors, real estate
- Healthcare: Dentists, physicians, mental health
- Automotive: Auto repair, roadside assistance

### Google Search Campaign Structure

```
Account
├── Campaign: Brand Search
│   └── Ad Group: [Business Name] exact + phrase
│
├── Campaign: Service Keywords — Exact/Phrase
│   ├── Ad Group: [Core Service 1] + location modifier
│   ├── Ad Group: [Core Service 2] + location modifier
│   ├── Ad Group: Emergency/Urgent modifiers
│   └── Ad Group: [Service] near me
│
├── Campaign: Competitor Campaigns
│   └── Ad Group: [Local competitor names]
│
└── Campaign: Remarketing Display
    └── Ad Group: All visitors (30-day)
```

**Essential location modifiers to include in keyword strategy:**
- "near me" — high intent; growing dramatically on mobile
- "[City name] + service" — geographic specificity
- "[Zip code] + service" — hyper-local
- "[Neighborhood] + service" — dense urban markets

### Meta Ads Structure

```
Account
├── Campaign: Awareness + Promotion (CBO)
│   └── Ad Set: Geo-targeted (radius around service area)
│       Audiences: Broad by age + interests relevant to service
│
├── Campaign: Seasonal Promotion
│   └── Ad Set: Current promotion (limited time offer)
│
└── Campaign: Retargeting
    └── Ad Set: Website visitors (30-day)
```

---

## Creative Strategy

### Ad Formats by Service Type

| Service Type     | Best Performing Format          | Message                                         |
|------------------|---------------------------------|-------------------------------------------------|
| Emergency services (HVAC, plumbing) | Call extension RSA + LSA | "Available 24/7"; "Same-day service"; phone # |
| Scheduled services (landscaping, cleaning) | Lead form or call | "Free estimate"; "Book in 60 seconds"         |
| High-ticket (roofing, remodeling) | Video + carousel | Before/after photos; testimonials; warranty    |
| Professional (legal, dental, finance) | Appointment booking | Credentials; "Free consultation"; trust signals|

### Trust Signals for Local Service Ads

Essential elements in ad copy and landing pages:
- Year in business ("Family-owned since 1995")
- License number or "Licensed & Insured"
- Google rating + review count ("4.9 stars — 380+ reviews")
- Service area specificity ("Serving Austin and surrounding areas")
- Response time or availability ("Same-day service available")
- Guarantees ("100% satisfaction guarantee" or "Price match guarantee")

### Call Extension Best Practices

- Always enable call extensions for local service businesses
- Phone number must ring a staffed line during business hours
- Enable call reporting to track call conversions
- Set call conversion window to 60 days minimum

---

## Targeting Guidelines

### Geographic Targeting

| Business Type           | Radius Recommendation          | Notes                                         |
|-------------------------|--------------------------------|-----------------------------------------------|
| Emergency services      | 10–20 miles                    | Response time constrains radius               |
| Cleaning / landscaping  | 10–15 miles                    | Travel time affects profitability             |
| Medical / dental        | 5–10 miles                     | Patients rarely travel far for routine care   |
| Legal services          | 20–40 miles (city + suburbs)   | Broader radius acceptable; clients will travel|
| Roofing / construction  | 20–50 miles                    | Larger projects justify travel               |
| Retail / restaurant     | 1–5 miles                      | Local convenience service                     |

**Advanced geo targeting:**
- Exclude locations you don't service (adjacent cities you don't cover)
- Increase bids in highest-value ZIP codes (higher income = larger jobs / higher LTV)
- Bid modifier by location: Core service area +20%, outer radius –15%

### Keyword Strategy for Local Search

**Always include these modifiers with service keywords:**
```
[service] [city]
[service] near me
[service] [zip code]
best [service] in [city]
[service] company [city]
[service] contractor [area]
emergency [service] [city] (where applicable)
24 hour [service] (where applicable)
affordable [service] [city] (budget-sensitive categories)
```

**Negative keywords for local:**
- "DIY", "how to", "yourself" — informational intent, not buyer
- Out-of-area city names (if geo radius doesn't cover them)
- "free" — unless you offer free consultations
- Competitor names (unless running conquest campaigns)

### Meta Local Targeting

- Radius: 10–25 miles around business address
- Age: Adjust to property-owning/decision-making demographic (typically 25–65)
- Interests: Home improvement, homeowner interests for home services; local community groups
- Lookalike: Build from customer email list; 1% LAL within geo radius

---

## Budget Guidelines

### Minimum Monthly Budget by Service Type

| Service Category      | Minimum Monthly Budget | Notes                                           |
|-----------------------|------------------------|-------------------------------------------------|
| Emergency home services| $2,000 – $4,000       | Google Search + LSA; high intent = fast payback |
| Scheduled home services| $1,500 – $3,000       | LSA + Search; seasonal adjustments critical     |
| Medical / dental      | $2,000 – $5,000        | Google Search primary; Meta for promotions      |
| Legal services        | $3,000 – $8,000        | High CPC ($8–$30); CPL tracked rigorously       |
| Restaurants           | $1,000 – $2,000        | Meta primary; Google Maps / local discovery     |
| Professional services | $2,000 – $5,000        | Google Search + LinkedIn for commercial work   |

### LSA Budget Guidance

- Set weekly LSA budget based on lead volume goal × avg cost per lead
- Typical LSA CPL: $20 – $80 for home services; $50 – $150 for professional services
- Review lead quality weekly; dispute invalid leads through LSA dashboard
- Pause LSA during capacity constraints (fully booked periods)

### Seasonality (Home Services Example)

| Month         | Relative Demand      | Budget Adjustment                               |
|---------------|----------------------|-------------------------------------------------|
| Jan – Feb     | Low (HVAC heating)   | Reduce AC; maintain heating                     |
| Mar – May     | High (spring projects)| +20–30%; peak for landscaping, exterior work  |
| Jun – Aug     | High (HVAC cooling)  | +30–40% for cooling services; peak season      |
| Sep – Oct     | Medium               | Ramp for fall/winter preparation               |
| Nov – Dec     | Low (most services)  | Reduce; run holiday promotions where applicable |

---

## KPI Targets

### Primary KPIs

| Metric              | Target Range (Industry Benchmark)         | Notes                                            |
|---------------------|-------------------------------------------|--------------------------------------------------|
| CPL (Google LSA)    | $20 – $80 (home services)                | Pay-per-qualified-lead; varies widely by category|
| CPL (Google Search) | $30 – $100 (home services)               | Click-to-call + form; competitive market variance|
| CPL (Meta)          | $15 – $60 (local services)               | Form lead quality varies; qualify on call        |
| Cost Per Booked Job | $40 – $200 (home services)               | Lead-to-appointment rate typically 20–50%        |
| ROAS (service revenue)| 4x – 10x on direct tracked revenue     | LTV of repeat customers amplifies true ROAS      |

### Secondary KPIs

| Metric              | Target                                    | Notes                                            |
|---------------------|-------------------------------------------|--------------------------------------------------|
| Phone Call Rate     | 30% – 60% of Google ad clicks            | Enable call extensions; call tracking numbers   |
| Lead-to-Appointment | 30% – 70%                                | Depends on service type and follow-up speed     |
| Review Acquisition  | Track monthly                             | Reviews improve LSA ranking and CTR             |
| Google Star Rating  | ≥ 4.5 stars                              | Below 4.0 reduces LSA impressions significantly |
| Response Speed      | First response < 2 hours                 | Google LSA factors response rate into ranking   |

### Attribution for Local Services

- Enable call tracking (Google forwarding numbers or third-party like CallRail)
- Assign call duration threshold for conversion (e.g., calls > 60 seconds = lead)
- Import call conversions back into Google Ads for Smart Bidding signal
- Track booked jobs, not just leads — work with CRM or job-management software to close loop
