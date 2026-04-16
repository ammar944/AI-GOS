---
name: haynes-leak-audit
version: 1.0.0
category: framework
domain: media-planning
description: Jeremy Haynes' Lifetime-Spend Demographic Audit methodology. Identifies where ad budget is misallocated vs. where revenue actually comes from. Enables immediate budget reallocation for 2-5x efficiency lift.
triggers:
  - spend audit
  - budget reallocation
  - demographic analysis
  - retargeting ladder
---

# Haynes Leak Audit & Budget Reallocation

> Source: Jeremy Haynes — Megalodon Marketing, Digital Marketing Manuscript (DMM)
> Scale: Manages $550K-$1.2M/month in ad spend. Frameworks validated at 8-figure agency scale.

## Core Thesis

Most ad accounts spend money across broad demographics when 20-40% of demographics produce 80-90% of buyers. The "leak" is budget going to demographics that LOOK like buyers but don't actually buy.

**The playbook**: Pull the demographic audit → find the 20% that buy → cut the rest → retargeting ladder only to verified engagement.

## The 6-Step Haynes Methodology

### Step 1: Lifetime-Spend Demographic Audit

Pull lifetime ad-spend data broken down by age × gender × geography. Cross-reference with actual purchase data (not just leads).

**Decision rule**: Identify demographics where:
- Spend share ≥ 10% of total
- AND purchase share < 5% of total
- = LEAKING DEMOGRAPHIC. Cut or deprioritize.

Example from Haynes: Of $6M lifetime spend, $4M should funnel to the 24-40 demographic producing 90% of buyers.

### Step 2: Digitized Know-Like-Trust (KLT)

**95% of businesses skip this step.** They jump to direct sales before building an engagement audience.

**Decision rule**: For monthly ad budget:
- < $10K/month → MUST start with engagement campaigns (no direct-response yet)
- $10K-$50K/month → 30% engagement / 70% direct-response
- > $50K/month → 15% engagement / 85% direct-response

### Step 3: Engagement-Based Retargeting Ladder

Build custom audiences from video-view thresholds:

```
Cold Prospects
  → 3s View (~40% of reach)
  → 10s View (~25% of reach) — "curious"
  → 25% Video View — "interested"
  → 50% Video View — "engaged" ← PITCH ONLY FROM HERE
  → 75% Video View — "warm"
  → 95% Video View — "hot" ← BEST LTV
```

**Decision rule**: Direct-response pitches (lead form, call booking, checkout) only to ≥50% view cohorts.

### Step 4: Simple High-Ticket Funnel Stack

**Anti-pattern** (common): Webinar → 17-email sequence → VSL → case study → book call → qualification survey → call.

**Haynes pattern** (proven):
- Option A: Ad → Lead form → Call
- Option B: Ad → Simple VSL → Call

NO complex webinars. NO 17-step sequences. NO endless upsells.

**Decision rule for funnel choice**:
- Price point $5K-$50K → call funnel (Option A or B)
- Price point < $500 → checkout funnel, not call funnel
- Price point $500-$5K → hybrid (VSL → optional call OR checkout)

### Step 5: Risk-Mitigated Ad Account Setup

**Assume you'll get banned.** Build redundancy:

- 3+ ad accounts (primary + 2 backups)
- 2+ Facebook Pages (live pages in rotation)
- Shadow Pixels (secondary pixel on backup account)
- Separate Business Managers

**Decision rule**: Never run a single ad account for any client. Always have ready backup.

### Step 6: 4-Part Backend Selling System

**Pre-call information delivery** — address "scanner mode" (prospect skimming without absorbing):

1. **Booking confirmation** with expectation-setting content
2. **Pre-call education** delivered asynchronously (video + docs + case studies)
3. **Reminder sequence** with objection pre-handling
4. **Trust-building social proof** in the 24hr window before call

**Result documented by Haynes**: 30% show-rate lift.

**Rule**: Sales call becomes 20% education / 80% transaction. If your call is still 50-80% education, your pre-call is broken.

## Application to AI-GOS Research Pipeline

### ICP Validation Runner
- Segment LTV by age/gender/geography (if data present)
- Surface the 20% cohort producing 80% of revenue
- Flag demographics spending > purchasing (leak candidates)

### Competitor Runner
- Classify competitor ad strategy: engagement-first OR direct-response
- Note: competitors running direct-response cold = Haynes would call this inefficient
- Opportunity: if competitors skip engagement, we can build warm pool cheaper

### Media Plan Runner
- Output retargeting ladder explicitly (3s/10s/25%/50%/75%/95%)
- Allocate engagement budget based on total spend (Step 2 rule)
- Flag if pitching direct-response to cold (Haynes red flag)
- Recommend funnel choice by price point (Step 4 rule)

### Scripts Runner
- Produce DIFFERENT scripts for each ladder rung:
  - Cold → 3s/10s — pure engagement value, no pitch
  - 25-50% — mechanism reveal, soft pitch
  - 50%+ — direct offer, urgency, CTA
- Never use a cold-traffic pitch on a warm retargeting audience

## Quality Standards

**Amateur**: Tests creative to "see what works."
**Expert**: Knows the winning demographic BEFORE testing; engineers creative FOR that demo.

**Amateur**: One ad account, hope for the best.
**Expert**: 3+ accounts, backup Pages, shadow Pixels, ban-resistant architecture.

**Amateur**: Pitches cold traffic.
**Expert**: Pitches only 50%+ video viewers or form-fills.

**Amateur**: "Build once" funnel.
**Expert**: Backend educates lead asynchronously; sales calls are transactions.

## Anti-Patterns (Red Flags)

- Spending on 18-24 or 50+ when data shows they don't buy
- Complex webinar funnels for high-ticket (Haynes: simpler is better)
- Running without backup accounts/Pages/Pixels
- Treating sales calls as "discovery/education" instead of transactions
- Skipping engagement campaigns because "they don't convert directly" (they build the retargeting pool that DOES convert)
- Direct-response ads to cold audience when budget is < $10K/month

## Output Format (when applied to research)

```json
{
  "haynesLeakAudit": {
    "demographicLeaks": [
      {
        "demographic": "age:18-24 + gender:any",
        "spendShare": "18%",
        "revenueShare": "3%",
        "action": "cut"
      }
    ],
    "winningCohort": {
      "description": "age:24-40 + gender:male + tier-1 cities",
      "revenueShare": "72%",
      "recommendedBudgetShare": "80%"
    },
    "retargetingLadderGap": "No 25%/50% video-view custom audiences exist; direct-response pitched to cold traffic",
    "funnelRecommendation": "Switch from 8-step webinar to 2-step VSL → call (current price point $8K supports call funnel)",
    "accountRiskFlag": "Single ad account, single Page, single Pixel — high ban risk. Build 2 backups before scaling spend > $5K/day.",
    "backendSystemScore": "0 of 4 components present (booking confirm, pre-call education, reminders, social proof). Expected 30% show-rate lift on implementation."
  }
}
```

## Sources

- Jeremy Haynes, Megalodon Marketing: https://megalodonmarketing.net
- Digital Marketing Manuscript: https://dmmguide.com
- Backend Selling System: https://jeremyhaynes.com/jeremy-haynes-backend-selling-system-show-rate-increase/
- 5M/month Call Funnels: https://jeremyhaynes.com/5-million-month-call-funnels/
