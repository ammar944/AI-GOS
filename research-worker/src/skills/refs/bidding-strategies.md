# Bid Strategy Decision Framework

> Source: Google Ads bidding documentation, Meta Campaign Budget Optimization guides, LinkedIn
> bidding guidance, and practitioner benchmark aggregates (2024–2025).

---

## Google Ads Bid Strategy Decision Tree

### Step 1: Establish Account Maturity

```
Do you have ≥ 30 conversions in the last 30 days (per campaign)?
├── NO → Manual CPC or Maximize Clicks (volume building phase)
└── YES → Continue to Step 2
```

### Step 2: Define Primary Objective

```
Primary goal?
├── Leads / Demo Requests → tCPA or Maximize Conversions
├── Revenue / ROAS → tROAS or Maximize Conversion Value
├── Traffic / Awareness → Maximize Clicks or Target Impression Share
└── App Installs → Target CPA (UAC)
```

### Step 3: Conversion Volume Check for Smart Bidding

```
Conversions per campaign per month?
├── < 30 → Maximize Conversions (no target) — build volume first
├── 30–50 → tCPA (set at current avg CPA × 1.2 — give headroom)
├── 50–100 → tCPA or tROAS (stable enough for targets)
└── 100+ → Data-driven attribution + tCPA/tROAS with tight targets
```

---

## Google Ads Bid Strategy Reference

### Manual CPC

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Maximum — you set the exact bid per keyword             |
| Best for          | New accounts, small budgets, highly competitive niches  |
| Learning phase    | None — no algorithm to learn                            |
| Requires          | Active monitoring (adjust bids weekly)                  |
| Avoid when        | Account has > 50 conversions/month — Smart Bidding likely outperforms |
| Budget floor      | No minimum, but < $500/mo means too few impressions to optimize manually |

### Enhanced CPC (eCPC)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — your bids adjusted ±30% by Google              |
| Best for          | Transition from manual CPC toward Smart Bidding         |
| Learning phase    | 2–4 weeks                                               |
| Requires          | Some conversion history (≥ 10–15 conversions)          |
| Avoid when        | Account is fully mature — tCPA/tROAS will outperform   |

### Maximize Clicks

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Budget-based — Google maximizes click volume            |
| Best for          | Brand awareness, traffic to new landing pages, early testing |
| Learning phase    | 1–2 weeks                                               |
| Requires          | Max CPC cap recommended to prevent overpaying           |
| Avoid when        | Optimizing for conversions — clicks ≠ leads             |

### Target Impression Share (tIS)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | You set desired impression share % and position         |
| Best for          | Brand terms, defensive bidding, competitor conquest     |
| Learning phase    | 1–2 weeks                                               |
| Requires          | Position target: "Anywhere on page," "Top of page," or "Absolute top" |
| Avoid when        | Budget is limited — Google may overspend CPC to hit share goals |
| Recommended targets | Brand terms: 90–95% absolute top; Competitor terms: 60–80% top |

### Maximize Conversions (No Target)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Low — Google maximizes conversion volume within budget  |
| Best for          | New Smart Bidding adopters; campaigns with < 50 conv/mo |
| Learning phase    | 2–4 weeks (7–10 days active learning, then optimization)|
| Requires          | No minimum; more conversions = better performance       |
| Avoid when        | CPA is exceeding business threshold — add tCPA target   |
| Warning           | Will spend entire budget daily; may accept high-CPA conversions |

### Target CPA (tCPA)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — Google tries to hit your CPA target            |
| Best for          | Lead gen campaigns with stable, known CPAs              |
| Learning phase    | 2–6 weeks; avoid major changes during learning          |
| Conversion minimum| 30+ conversions/month per campaign (Google recommendation)|
| tCPA starting point| Set at current avg CPA × 1.1 – 1.2 (give algorithm headroom) |
| Adjustment rules  | Change target by no more than ±15% per adjustment; wait 1–2 weeks before next change |
| Warning           | Setting tCPA too low starves campaign; Google may limit impressions |

### Target ROAS (tROAS)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — Google optimizes for revenue, not leads        |
| Best for          | E-commerce, subscription products with known LTV        |
| Learning phase    | 4–6 weeks                                               |
| Conversion minimum| 50+ conversions/month with conversion values assigned   |
| tROAS starting point | Set at current avg ROAS × 0.85 (give headroom for learning) |
| Requires          | Conversion value must be passed with every conversion   |
| Avoid when        | Conversions have no value assigned; use tCPA instead    |

### Maximize Conversion Value (No Target)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Low — Google maximizes total revenue within budget      |
| Best for          | E-commerce with product catalog; conversion values vary |
| Learning phase    | 2–4 weeks                                               |
| Requires          | Conversion values assigned (static or dynamic)          |
| Transition to     | tROAS once ROAS is stable for 30+ days                  |

---

## Learning Phase Management

### Learning Phase Rules

The learning phase begins whenever a significant change is made to a campaign using Smart Bidding.

| Change Type                          | Triggers New Learning Phase?       |
|--------------------------------------|------------------------------------|
| New campaign creation                | Yes — always                       |
| Budget change > 50%                  | Yes                                |
| Bid strategy type change             | Yes — always                       |
| tCPA/tROAS target change > 20%      | Yes                                |
| Adding/removing conversions actions  | Yes                                |
| Significant audience change          | Sometimes                          |
| Ad copy change                       | Usually not                        |
| Keyword addition (small)             | Usually not                        |

**During learning phase:**
- Expect CPAs to fluctuate 20–40% above/below target — this is normal
- Do NOT make additional changes — compounding learning phases extend instability
- Minimum 7–10 days before evaluating performance
- If learning phase shows "Limited" status, budget or tCPA target may be too restrictive

---

## Meta Ads Bidding Strategies

### Lowest Cost (Automatic Bidding)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Low — Meta spends budget to get cheapest results        |
| Best for          | New campaigns; scaling proven audiences; learning phase  |
| Learning phase    | 50 optimization events within 7 days per ad set         |
| Recommended for   | Most campaigns; default starting point                  |

### Cost Cap

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — you set max avg cost per result                |
| Best for          | Accounts with known CPL targets; after learning phase   |
| Learning phase    | More complex — algorithm must find volume at cost       |
| Setting guidance  | Set cost cap at current CPL × 1.1 – 1.2 (initial)     |
| Warning           | Too low a cap = under-delivery; Meta can't find enough volume |

### Bid Cap

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | High — you set maximum bid in each auction              |
| Best for          | Auction control; specific target audiences; experienced buyers |
| Risk              | Under-delivery if bid cap is set too low                |
| Use case          | When you know auction dynamics and want to prevent overbidding |

### ROAS Goal (Meta Advantage Shopping)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — Meta optimizes for purchase value              |
| Best for          | E-commerce with product catalog; DPA campaigns          |
| Requires          | Purchase value passed via Pixel/CAPI                    |
| Learning phase    | 50 purchase events within 7 days per campaign           |

### Meta Learning Phase Requirements

- **50 optimization events in 7 days** per ad set to exit learning phase
- During learning: CPA volatile; do not evaluate performance yet
- **Consolidation rule**: Fewer, larger ad sets exit learning faster than many small ad sets
- Advantage+ campaigns have relaxed learning phase requirements — often better for smaller budgets

---

## LinkedIn Ads Bidding

### Automated Bidding (Max Delivery)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Low — LinkedIn maximizes delivery within budget        |
| Best for          | New campaigns; brand awareness; thought leadership      |
| Min daily budget  | $10/day per campaign                                    |

### Target Cost

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Medium — LinkedIn tries to hit your avg CPC/CPL        |
| Best for          | Lead gen campaigns; after establishing cost baselines   |
| Setting guidance  | Set 20–30% above the CPC you actually want to pay      |

### Manual Bidding (CPC / CPM)

| Attribute         | Detail                                                   |
|-------------------|----------------------------------------------------------|
| Control level     | Maximum                                                 |
| Best for          | Experienced buyers; budget control; specific CTR goals  |
| Starting CPC      | Set at LinkedIn's suggested bid midpoint initially      |

---

## Budget-to-Bid Ratios

### Google Ads

- **Daily budget minimum for Smart Bidding**: At least 10x your target CPA per day
  - Example: tCPA = $100 → Daily budget ≥ $1,000 (30 conversions/month at target)
- **Manual CPC**: Daily budget can be lower; set max CPC at 20–30% of target CPL

### Meta Ads

- **Minimum per ad set per day**: $5 (absolute), $20–$50 (recommended for learning)
- **Campaign Budget Optimization (Advantage+)**: Total campaign budget at least 50x target CPL per week
  - Example: Target CPL = $50 → Weekly budget ≥ $2,500

### LinkedIn Ads

- **Per campaign per day**: $50 minimum for meaningful data; $100+ recommended
- **Total campaign budget**: At least $1,500 for a statistically meaningful test

---

## When to Switch Bid Strategies

| Current Situation                             | Recommended Switch                              |
|-----------------------------------------------|-------------------------------------------------|
| Manual CPC, account now has 30+ conv/mo       | Migrate to Maximize Conversions                 |
| Maximize Conversions running 8+ weeks stable  | Add tCPA target at current avg CPA × 1.1       |
| tCPA stable, want more volume                 | Increase tCPA target by 10–15%                 |
| tCPA starved (< 5 conv/week), budget not used | Raise tCPA target or switch to Maximize Conv   |
| E-commerce, LTV known, ROAS stable 4+ weeks  | Migrate from tCPA to tROAS                     |
| CPA rising despite tCPA held constant         | Audience fatigue or competition increase — expand targeting |
| Learning phase stuck > 3 weeks                | Reset: pause campaign, duplicate with fresh settings |
