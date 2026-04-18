---
name: business-model-routing
version: 1.0.0
category: media-plan
domain: strategy
description: Decision framework for classifying a business model (PLG / SLG / e-commerce / transactional / marketplace) and routing the media plan to model-specific funnel, KPIs, channels, and campaign types. Prevents forcing SLG lead->SQL funnels on PLG clients.
triggers:
  - media plan generation
  - measurement framework
  - CAC modeling
  - channel selection
---

# Business Model Routing

## Purpose

Before drafting any block of the media plan, classify the business model from the identity card. The business model determines the funnel shape, the KPI framework, and the viable channel set. A PLG freemium SaaS cannot be planned with an SLG lead-to-SQL funnel — the math produces absurd CAC numbers (e.g. $600 CAC on a $17/mo product, 50-year payback) and the KPIs describe nothing the business measures.

Classification is the FIRST decision, before anything else in the plan.

## Frameworks Applied

- **Wes Bush PLG Playbook** — product-led growth dynamics, freemium vs free-trial, activation-centric funnel
- **David Skok SaaS Metrics** — CAC, LTV, payback period, expansion revenue by model
- **Alex Hormozi Value Equation** — offer-to-channel fit (high-ticket SLG vs low-ticket PLG)
- **Eric Ries Lean Startup** — metrics by business model type

## Classification Signals (from identity card)

| Signal | PLG | SLG | E-commerce | Transactional | Marketplace |
|---|---|---|---|---|---|
| Free trial / freemium | YES, defining | Rare | No | No | Sometimes |
| Demo required before purchase | No | YES, defining | No | No | No |
| Self-serve signup | YES | No | YES | YES | YES |
| Sales team closes | Occasionally upsells | YES, defining | No | No | No |
| AOV / price point | $5–$500/mo | $5k–$500k ACV | $20–$500 per order | Varies | Commission-based |
| Sales cycle | Same-day to 30 days | 30–180 days | Same-session | Same-session to 1 week | Varies by side |
| Typical buyer | Individual user or team lead | Committee | Individual consumer | Individual or small business | Two sides (supply + demand) |

If 2+ signals match a model strongly, classify as that model. If signals are split, classify as `unknown` and flag low confidence — do NOT guess.

## Per-Model Routing

### PLG (Product-Led Growth)

**Funnel:** Visit → Signup → Activation → Paid Conversion → Expansion

**KPIs (directional, no client-specific targets):** cost per signup, activation rate, time-to-value, free-to-paid rate, expansion revenue %

**NEVER use:** lead → MQL → SQL → opportunity → customer. That is SLG.

**Channel bias:**
- **Primary:** Meta (educational creative, product demos), YouTube (tutorial + product walkthrough), TikTok (if B2C or B2SMB)
- **Secondary:** Google search ONLY if awareness level is solution-aware or higher
- **Avoid:** LinkedIn (wrong buyer), high-minimum display networks

**Budget tier rule:** Under £2k/mo → single platform (Meta). £2k–£5k → Meta + one supplement.

**Campaign types:** Signup conversion, video views (for awareness), retargeting (only if pixel exists). DO NOT create a separate "trial conversion" campaign — the trial IS the conversion event.

**Creative approach:** Product demo clips, "watch what it does in 30 seconds", social proof via user counts or logos, problem-agitation framing if unaware market.

**Gotchas:**
- Don't publish CAC targets — payback on low-ticket PLG depends entirely on activation + retention, which paid media does not control
- Don't force a lead-to-SQL rate — there's no SQL stage
- Don't require a demo booking — it contradicts the self-serve model

### SLG (Sales-Led Growth)

**Funnel:** Impression → Lead → MQL → SQL → Opportunity → Customer

**KPIs (directional):** CPL, MQL rate, SQL rate, opportunity rate, sales cycle length, win rate

**Channel bias:**
- **Primary:** LinkedIn (for B2B with committee buying), Google search (high-intent keywords)
- **Secondary:** Meta for retargeting site visitors, YouTube pre-roll on category searches
- **Avoid:** TikTok (rare B2B buyer), Snapchat, broad-reach display

**Budget tier rule:** LinkedIn has ~£4k/mo practical minimum. If budget < £4k, LinkedIn is not viable — use Google + Meta retargeting instead.

**Campaign types:** Lead-gen forms, website conversions, content downloads, demo-booking campaigns.

**Creative approach:** Authority-driven (case studies, analyst quotes, ROI calculators), thought leadership, offer a valuable gated resource.

**Gotchas:**
- Don't publish CAC targets — depends on sales process, close rate, offer, not paid media
- Don't promise lead-to-customer rates — that's the sales team's KPI, not the media plan's
- Long sales cycles require 3–6 month measurement windows, not 30 days

### E-commerce

**Funnel:** Impression → Session → ATC → Purchase → Repeat

**KPIs (directional):** CPC, CTR, ROAS, AOV, MER (marketing efficiency ratio), repeat purchase rate

**Channel bias:**
- **Primary:** Meta (best for awareness + mid-funnel), Google Shopping, TikTok (for apparel/beauty/consumer goods)
- **Secondary:** Pinterest (for visual categories), YouTube, influencer partnerships
- **Avoid:** LinkedIn, display networks (low ROAS)

**Budget tier rule:** Under £2k → Meta only. £2k–£10k → Meta + Google Shopping.

**Campaign types:** Advantage+ / Performance Max, catalog-based dynamic retargeting, prospecting with broad lookalikes, abandoned cart retargeting.

**Creative approach:** Product-first, UGC, unboxing, before/after. Fast hooks for social.

**Gotchas:**
- ROAS is the headline KPI but don't publish client-specific targets — depends on margin, AOV, creative
- Seasonality matters — plans must call out Q4 / BFCM amplification
- Catalog health determines ceiling — if product feed is weak, no media plan fixes it

### Transactional (Local Service / One-Time Purchase)

**Funnel:** Impression → Click → Lead → Booking → Completed Service

**KPIs (directional):** CPL, show rate, booking-to-complete rate, cost per completed job

**Channel bias:**
- **Primary:** Google LSA (Local Services Ads) + Google search for high-intent keywords
- **Secondary:** Meta for retargeting + lookalikes from customer list
- **Avoid:** LinkedIn (wrong buyer), TikTok, long-form video

**Budget tier rule:** LSA + search baseline £500–£2k/mo. Meta adds £500+. Most local service accounts viable at £1k–£5k.

**Campaign types:** Search campaigns with location extensions, call-only ads, form-fills for non-call services.

**Creative approach:** Trust signals (years in business, license numbers, reviews), speed (same-day service, 24h response), locality (city name in every headline).

**Gotchas:**
- Lead-to-job conversion is the service team's job — don't forecast revenue in the media plan
- Seasonality is high — plans must acknowledge peak/off-peak

### Marketplace

**Funnel:** TWO funnels. Supply side (providers / sellers) and demand side (buyers).

**KPIs (directional):** CPA per side, LTV per side, liquidity ratio (supply-to-demand match rate), repeat usage

**Channel bias:** Depends on side — each side gets its own mini-plan.
- Demand side (often consumers): Meta, Google, TikTok
- Supply side (often SMBs or professionals): LinkedIn, industry-specific channels, referral programs

**Budget tier rule:** Generally needs £10k+/mo to run both sides simultaneously. Below that, sequence (supply first, then demand).

**Campaign types:** Two separate campaign trees, one per side, with different creative + landing pages.

**Gotchas:**
- Single funnel with single KPI is a classification failure — marketplace plans always have two
- "CAC" is ambiguous — specify which side
- Unit economics depend on liquidity — a plan without a liquidity target is incomplete

## Decision Rules

1. If `identityCard.businessModelType` is present (PLG/SLG/e-commerce/transactional/marketplace), use it. No re-classification.
2. If `businessModelType` is `unknown`, attempt to classify from the identity card free text + ICP + industry context. If still unclear, proceed with SLG as the safest default and flag `classificationConfidence: low` in output.
3. If the model is marketplace but no two-sided strategy has been provided in the research, output ONE funnel and flag "marketplace detected; second-side strategy required for complete plan".
4. Never mix funnel types. A plan with both "signup → activation" (PLG) and "lead → SQL" (SLG) is internally incoherent — pick one.

## Output Guidance

In every block, reference the business model in prose (e.g. "Because this is a PLG freemium SaaS, we recommend Meta as the primary acquisition channel..."). This makes the reasoning auditable and catches classification errors early.
