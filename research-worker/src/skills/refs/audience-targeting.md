# Audience Targeting Capabilities & Best Practices

> Source: Google Ads, Meta, LinkedIn, TikTok platform documentation and practitioner playbooks
> (2024–2025). Targeting options evolve rapidly — verify current availability in each platform's UI.

---

## Google Ads Targeting

### Search Keyword Targeting

#### Keyword Match Types

| Match Type    | Symbol | Behavior                                                  | Use Case                                    |
|---------------|--------|-----------------------------------------------------------|---------------------------------------------|
| Exact Match   | [term] | Triggers only on exact query or close variant             | High-intent, efficient bottom-funnel        |
| Phrase Match  | "term" | Triggers on queries that contain the phrase               | Controlled expansion; moderate intent       |
| Broad Match   | term   | Triggers on related queries (AI-expanded)                 | Discovery; requires Smart Bidding to control CPA |

#### Keyword Strategy by Funnel Stage

| Stage           | Keyword Type                        | Example                                      |
|-----------------|-------------------------------------|----------------------------------------------|
| Bottom-funnel   | Brand + competitor + "buy" intent   | `[brand name]`, `[competitor] alternative`, `best [category] software` |
| Mid-funnel      | Problem/category awareness          | `"how to improve [problem]"`, `"[category] tools"` |
| Top-funnel      | Broad topic / informational         | `[industry] trends`, `[problem] solutions`  |

#### Negative Keywords (Essential Exclusions)

Always add these negative lists to non-brand campaigns:
- Brand terms (prevent cannibalizing organic)
- Job-seeking terms: "jobs," "careers," "salary," "hiring," "internship"
- Education terms (if not targeting students): "free," "DIY," "template," "course"
- Informational modifiers: "what is," "how does," "define," "meaning of" (for lead gen campaigns)

---

### Google Audience Targeting

#### In-Market Audiences

Users Google identifies as actively researching/comparing in a category. Highly predictive of purchase intent.

| Audience Type       | Description                                                | Best Use Case                          |
|---------------------|------------------------------------------------------------|----------------------------------------|
| In-market           | Actively researching a category                           | Search + Display prospecting           |
| Life events         | Major transitions (moved, married, new job, grad)         | Finance, insurance, home services      |
| Affinity             | Long-term interests/passions                              | Brand awareness; upper funnel          |
| Detailed demographics| Parental status, education, homeownership, employment    | Refine audience precision              |

#### Customer Match

Upload first-party data (email, phone, postal address) to target or exclude known customers.

| Use Case                              | Audience Size Needed |
|---------------------------------------|----------------------|
| Upsell to existing customers          | 1,000+ emails minimum|
| Exclude churned customers from CPA bid| 500+ emails          |
| Lookalike / Similar Audiences (Google)| 1,000+ matched users |

#### Remarketing Audiences (RLSA)

| Segment                        | Recommended Bid Adjustment | Window         |
|--------------------------------|---------------------------|----------------|
| All website visitors           | +15% – +30%               | 30–90 days     |
| Product/pricing page visitors  | +30% – +50%               | 14–30 days     |
| Demo request abandons          | +50% – +75%               | 7–14 days      |
| Cart abandons (e-commerce)     | +30% – +50%               | 7 days         |
| Past converters (upsell)       | +20% – +40%               | 90–180 days    |
| Past converters (exclude CPA)  | Exclude from prospecting  | 30–90 days     |

#### Performance Max Audience Signals

Provide audience signals to guide PMax learning (not strict targeting):
- Customer Match list (highest signal quality)
- Custom intent segments based on competitor URLs or keywords
- In-market audiences for your category
- Website remarketing list

---

## Meta Ads Targeting

### Core Audience Options

#### Interest Targeting

Meta's interest graph is broad. Best practices:
- Start with 3–6 interests per ad set (not too narrow, not too broad)
- Test interests individually to identify which drive results
- Layer interests with behavioral refinements for precision
- Use Audience Insights or Meta's suggestions to discover related interests

#### Behavioral Targeting

| Behavior Category              | Examples                                                     |
|--------------------------------|--------------------------------------------------------------|
| Purchase behavior              | "Engaged shoppers," "Online spenders," category buyers       |
| Device/platform use            | iOS users, Android users, early tech adopters                |
| Travel behaviors               | Frequent travelers, business travelers, expats               |
| Financial behaviors            | Small business owners, higher income (available in US)       |
| B2B behaviors                  | "IT decision makers," "Small business owners" (limited post-iOS) |

> **Note**: Meta behavioral targeting accuracy has decreased post-iOS 14. Interest + Lookalike
> audiences generally outperform behavioral-only targeting for conversion campaigns.

#### Demographic Targeting

| Dimension           | Options                                                      | Notes                                               |
|---------------------|--------------------------------------------------------------|-----------------------------------------------------|
| Age                 | 18–65+; custom ranges                                        | Cannot target < 18 without special permissions      |
| Gender              | Male, Female, All                                           | Cannot exclude in Special Ad Categories             |
| Location            | Country, region, city, radius (1 mi minimum)                | Cannot use ZIP code targeting in Special Ad Categories |
| Language            | Filter by language                                          | Useful for multilingual markets                     |
| Education           | In college, college grad, postgrad                          | Lower reliability than self-reported                |
| Relationship status | Single, married, in relationship, engaged                   | Useful for wedding, finance verticals               |
| Job title           | Self-reported; lower accuracy than LinkedIn                 | B2B targeting; supplement with LinkedIn for precision|

### Lookalike Audiences

| Source                         | Quality Tier | Recommended Size % | Notes                                              |
|--------------------------------|--------------|--------------------|----------------------------------------------------|
| Customers / purchasers list    | Top          | 1% – 3%            | Highest quality; needs 1,000+ matched users        |
| High-LTV customer subset       | Top          | 1%                 | Segment top 20% LTV; outperforms all-customer LA   |
| Lead form completions          | High         | 1% – 5%            | Strong signal if leads are qualified               |
| Video 75%+ viewers (30-day)    | Medium       | 2% – 5%            | Engagement-based; broader but scaled               |
| Website visitors (30-day)      | Medium       | 2% – 5%            | Volume-dependent; smaller sites = noisy signal    |
| All website visitors (180-day) | Lower        | 3% – 10%           | Use only for awareness campaigns                  |

**Lookalike Size Guide:**
- **1%**: Tightest match; highest CPM; best conversion rate
- **2–5%**: Broader reach; slight quality dilution; better for scaling
- **5–10%**: Awareness/reach focus; not recommended for bottom-funnel

### Retargeting Windows (Meta)

| Segment                          | Window      | Strategy                                        |
|----------------------------------|-------------|------------------------------------------------|
| All website visitors             | 180 days    | Broad awareness retargeting                    |
| Product/service page visitors    | 30–60 days  | Feature/benefit messaging                     |
| Pricing/checkout visitors        | 7–14 days   | Urgency + objection handling                  |
| Add-to-cart / initiate checkout  | 3–7 days    | Direct conversion; discount/reminder           |
| Video viewers (25%+)             | 30–90 days  | Mid-funnel nurture                             |
| Lead form opens (not submitted)  | 7–14 days   | Re-engage with simplified ask                 |
| Past purchasers                  | 60–180 days | Upsell / cross-sell / repurchase              |

### Advantage+ Audiences (Meta's AI Targeting)

Meta's AI-driven targeting; launched 2023. Replaces manual audience selection.

| Mode                  | Use Case                                                  |
|-----------------------|-----------------------------------------------------------|
| Advantage+ Shopping   | E-commerce; best for mature accounts with conversion data |
| Advantage+ Audiences  | Standard campaigns; AI expands beyond your defined audience |
| Audience suggestions  | You set a core audience; Meta can expand beyond it        |

> **Recommendation**: Test Advantage+ against manual audiences simultaneously. Advantage+ often
> wins on CPL for cold prospecting but may sacrifice lead quality. Add your customer list as
> an exclusion to avoid wasting spend on existing customers.

---

## LinkedIn Ads Targeting

LinkedIn has the most accurate B2B targeting of any platform due to verified professional data.

### Professional Demographic Targeting

| Attribute            | Available Options                                          | Notes                                               |
|----------------------|------------------------------------------------------------|-----------------------------------------------------|
| Job title            | Exact titles; job title groups                             | Most precise but narrow; combine with function      |
| Job function         | Marketing, Finance, IT, HR, Sales, Operations, etc.        | Broader; works well with seniority overlay          |
| Seniority            | Unpaid, Training, Entry, Senior, Manager, Director, VP, CXO, Owner | Use Director + for B2B enterprise ABM              |
| Company size         | 1–10, 11–50, 51–200, 201–500, 501–1K, 1K–5K, 5K–10K, 10K+ | Target your ICP company size band                  |
| Industry             | 150+ LinkedIn industry categories                          | Align with your ICP; multiple industries allowed    |
| Company name         | Target specific accounts (ABM)                             | Account lists up to 300,000 companies               |
| Skills               | LinkedIn skills from user profiles                        | Good for technical roles (engineers, developers)    |
| Years of experience  | Total career years                                        | Proxy for seniority when title is unclear           |
| Degrees / Fields     | University degree type and field of study                 | Useful for education and professional dev verticals |
| Member groups        | LinkedIn Group members                                    | Interest proxy; useful for niche communities        |
| Interests            | Topics members follow or engage with                      | Broader interest targeting; supplement not primary  |

### LinkedIn Audience Size Guidelines

| Target Audience Size | Performance Risk                                          | Recommendation                                      |
|----------------------|-----------------------------------------------------------|-----------------------------------------------------|
| < 50,000             | Too narrow; delivery issues                               | Broaden one dimension (add seniority levels, industries) |
| 50,000 – 200,000     | Ideal for ABM/niche campaigns                            | Good; monitor frequency carefully                   |
| 200,000 – 500,000    | Good for lead gen                                        | Standard sweet spot                                 |
| 500,000 – 2M         | Good for awareness and broad consideration               | Use for brand campaigns                             |
| 2M+                  | Very broad; dilutes targeting                            | Only for large awareness campaigns                  |

### LinkedIn Matched Audiences

| Type                      | How to Build                                              | Min Size  |
|---------------------------|-----------------------------------------------------------|-----------|
| Website retargeting       | LinkedIn Insight Tag; segment by URL                     | 300 members |
| Contact targeting         | Upload email list → matched against LinkedIn profiles    | 300 matched|
| Account targeting (ABM)   | Upload company names/domains                             | 300 companies|
| Lookalike audiences       | Based on any matched audience above                      | 300 members source |

---

## TikTok Ads Targeting

### Interest & Behavior Targeting

| Category                    | Examples                                                  |
|-----------------------------|-----------------------------------------------------------|
| Content interests           | Fashion, Beauty, Gaming, Food, Finance, Fitness, Tech     |
| Purchase intent behaviors   | Users who engaged with commerce-related content           |
| Hashtag followers           | Users who engaged with specific hashtag clusters          |
| Creator followers           | Lookalike audience of a specific creator's followers      |

### Custom Audiences (TikTok)

| Source                   | Build Method                                               | Min Size |
|--------------------------|------------------------------------------------------------|----------|
| Customer file            | Upload email/phone CSV                                    | 1,000+   |
| App activity             | SDK integration; target by in-app event                   | 1,000+   |
| Website visitors         | TikTok Pixel; segment by page/event                       | 1,000+   |
| Engagement               | Users who engaged with your TikTok content                | 1,000+   |

### TikTok Lookalike Audiences

| Source                   | Recommended Size | Notes                                              |
|--------------------------|------------------|----------------------------------------------------|
| Purchasers/customers     | Narrow (1–5%)   | Highest quality signal                             |
| Engaged viewers (75%+)   | Medium (5–10%)  | Good for scaling reach                             |
| Website visitors         | Medium (5–10%)  | Volume-dependent quality                           |

### TikTok Demographics

Age ranges available: 13–17 (restrictions apply), 18–24, 25–34, 35–44, 45–54, 55+
Gender, location (country/region/city), language, device (iOS/Android, model, price tier)

---

## Retargeting Best Practices (All Platforms)

### Retargeting Audience Exclusion Rules

Always exclude from prospecting campaigns:
- Recent purchasers (30–90 day window)
- Active customers (subscription/account based)
- Current free trial users (until trial expiry)

### Cross-Platform Retargeting Stack

Recommended retargeting sequence after initial touchpoint:

| Day Range After Visit   | Platform Priority          | Message Type                                   |
|-------------------------|----------------------------|------------------------------------------------|
| Day 1–3                 | Google Search (RLSA)       | "You were looking at us" — direct response     |
| Day 1–7                 | Meta (short window)        | Product benefit reminder; social proof         |
| Day 7–14                | Google Display / YouTube   | Brand reinforcement; objection handling        |
| Day 14–30               | Meta (medium window)       | Case study / testimonial angle                 |
| Day 30–90               | LinkedIn (B2B only)        | Thought leadership; ROI-focused content        |

### Frequency Management in Retargeting

| Platform    | Max Recommended Frequency (Retargeting)  | Signal to Reduce                              |
|-------------|------------------------------------------|-----------------------------------------------|
| Meta        | 5–10 per week                            | CTR declining; comments turning negative      |
| LinkedIn    | 4–6 per week                             | CPL rising without volume increase            |
| Google Disp.| 7–14 per week                            | View-through declining significantly          |
| YouTube     | 3–5 per week                             | Skip rate > 70%; view-through < 20%           |
