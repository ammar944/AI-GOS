# Marketplace Business-Model Template

> Applies to two-sided marketplaces where supply (providers / sellers) and demand (buyers) must both be acquired and kept in liquidity. Examples: Uber, Airbnb, Etsy, DoorDash, TaskRabbit, Upwork.

**Signals this model applies:** two distinct user types (supply + demand), revenue model based on commission / transaction fees, liquidity is a core KPI, network effects matter.

---

## Funnel (TWO funnels — one per side)

### Supply side (providers / sellers / workers)

Impression → Signup → Onboarding → First Active Listing/Shift → First Earning

### Demand side (buyers / riders / guests)

Impression → Signup → Browse → First Transaction → Repeat

**A single-funnel plan is a classification failure. Marketplace plans ALWAYS have two sub-plans.**

---

## KPI Framework (directional — NO client-specific targets)

Each side has its own KPI tree.

### Supply side KPIs
| KPI | What it measures | Industry range |
|---|---|---|
| Cost per provider signup | Supply-side paid efficiency | Varies hugely — $10–$200 |
| Onboarding completion rate | Supply-side activation | 30–70% |
| Time to first listing | Supply quality | Category-specific |
| Supply retention (90-day) | Supply health | 40–70% |

### Demand side KPIs
| KPI | What it measures | Industry range |
|---|---|---|
| CPA (cost per buyer acquisition) | Demand-side paid efficiency | Category-specific |
| First-transaction conversion | Demand activation | 15–40% of signups |
| Repeat rate (90-day) | Demand retention | 20–50% |
| Buyer LTV | Demand revenue quality | Category-specific |

### Liquidity KPIs (both sides)
| KPI | What it measures |
|---|---|
| Match rate | Supply-to-demand pairing success |
| Time-to-fulfillment | Demand-to-match speed |
| Utilization | Supply activity rate |

---

## Default Channel Mix

**Each side gets its own mix.** Do not merge the two.

### Supply-side channel mix
| Channel | Share | Role |
|---|---|---|
| LinkedIn | 15–30% | If provider is professional (Upwork-style) |
| Meta | 25–40% | Broad provider acquisition |
| Industry-specific forums / platforms | 15–30% | Niche provider recruitment |
| Referral programs | 15–25% | Existing providers bring providers |

### Demand-side channel mix
| Channel | Share | Role |
|---|---|---|
| Meta + Instagram | 35–50% | Primary consumer acquisition |
| Google Search | 20–35% | Intent capture |
| TikTok | 10–25% | Discovery (if consumer-facing) |
| Influencer / content | 5–20% | Authority + awareness |

**Budget tier rules:**
- ≤£10k/mo: cannot run both sides concurrently. Sequence: acquire supply first (cheaper to get liquidity going), then demand.
- £10k–£25k: split 50/50 between sides, revisit monthly based on liquidity
- £25k+: optimize independently per side based on liquidity ratios

---

## Campaign Types

**Allowed (per side):**
- Signup conversion campaigns (split by side, different funnels)
- Referral campaigns (provider-to-provider, buyer-to-buyer)
- Retargeting (by side — site visitors who browsed but didn't book)
- Local geo campaigns (if marketplace is geo-bounded, per-city campaigns)

**Forbidden / avoid:**
- Mixing supply and demand creative in one campaign
- Generic "join us" campaigns that don't clarify which side
- Lookalikes built off mixed user data (must be single-side seed)

---

## Creative Approach

### Supply-side creative
- Earning potential: "make £X/month", "flexible hours"
- Onboarding ease: "get listed in 5 minutes"
- Community: testimonials from existing providers
- Brand alignment: why this platform vs. alternatives

### Demand-side creative
- Variety / discovery: "thousands of providers near you"
- Trust: reviews, verified providers, insurance/guarantees
- Use-case-driven: show a specific job-to-be-done completed

---

## Gotchas

- Single funnel, single KPI is a classification error — always two
- CAC is ambiguous — always specify which side
- Unit economics depend on liquidity — a plan without liquidity targets is incomplete
- Geo-bounded marketplaces require per-city sub-plans — global campaigns don't work
- Supply side often has lower CAC but harder retention; demand is the opposite
- Chicken-and-egg at launch — supply must lead unless demand is pre-aggregated (rare)

---

## Sales cycle

Each side has its own cycle:
- Supply: signup-to-first-listing ranges from same-day (gig economy) to 2 weeks (professional marketplaces)
- Demand: signup-to-first-transaction ranges from same-session (food delivery) to weeks (travel, real estate)

Attribution windows must match per-side cycles.

---

## Mini-plan structure

When writing a marketplace media plan, produce two distinct blocks per section:
- `channelMixBudget.supply` + `channelMixBudget.demand`
- `audienceCampaign.supply` + `audienceCampaign.demand`
- `creativeSystem.supply` + `creativeSystem.demand`

Unified blocks (measurement, rollout, strategy snapshot) must call out liquidity as a top-level concern alongside per-side KPIs.
