---
name: awareness-level-routing
version: 1.0.0
category: media-plan
domain: strategy
description: Decision framework for classifying target market awareness (Schwartz 5 levels) and routing channel selection, funnel split, and creative approach. Prevents proposing Google search to unaware markets, and prevents top-of-funnel awareness campaigns when the budget is low and audience is direct-response-ready.
triggers:
  - channel selection
  - creative angle development
  - funnel split allocation
  - media plan strategy
---

# Awareness Level Routing

## Purpose

Market awareness dictates channel. A prospect who doesn't know the problem exists cannot be reached via Google search — they're not searching. A prospect who knows every competitor and is ready to buy doesn't need a 90-second explainer video — they need a discount code and a retargeting pixel.

Running the wrong channel for the awareness level wastes budget. This methodology classifies the market into Eugene Schwartz's 5 levels and routes channel + funnel + creative accordingly.

## Frameworks Applied

- **Eugene Schwartz 5 Awareness Levels** — Breakthrough Advertising, 1966. Still the canonical model.
- **Stefan Georgi awareness-matching** — modern direct response copy matched to awareness level
- **Chet Holmes 3% Rule** — only 3% of any market is actively buying right now; the other 97% stratify across awareness levels

## The 5 Levels

### Level 1: Unaware
Prospect does not know the problem exists. Does not search for solutions. Will not click an ad that names a solution.

**Example:** Choros.io — the problem "your competitors show up on ChatGPT when customers search, you don't" is novel. Most SMBs haven't thought about it.

**Channels:**
- **Primary:** Meta (interrupts feed with problem-reveal creative), TikTok (for B2C/B2SMB), YouTube (pre-roll that educates)
- **Secondary:** None
- **Avoid:** Google search (nobody is searching), LinkedIn sponsored content (expensive for education), Google display (too passive)

**Funnel split:**
- Conversion: 80–95% (yes, even for unaware markets — if this is a DR account, the conversion campaign IS the education)
- Awareness: 5–15% (only if budget >£5k and we need impression frequency)
- Retargeting: 0–5% (no retargeting pool at launch)

**Creative approach:** Problem agitation. Lead with a pain the prospect hasn't named. Reveal the solution category in the back half. Never brand-first. Follow Schwartz: "If the prospect is completely unaware... you have to dramatize the problem first."

**Hook style:** "Your customers are searching for [service] near them on ChatGPT. Your competitors pop up. You don't." Short, visceral, pain-first.

### Level 2: Problem-Aware
Prospect knows the problem exists but doesn't know a solution category exists. Starts searching for symptoms but not for your category.

**Channels:**
- **Primary:** Meta (reveal solution via education), YouTube (tutorial + soft pitch)
- **Secondary:** Google search for symptom-level keywords ("why are my leads dropping"), not solution keywords
- **Avoid:** Competitor-branded Google search (they don't know competitors exist)

**Funnel split:**
- Conversion: 75–90%
- Awareness: 5–15%
- Retargeting: 5–10% if pool exists

**Creative approach:** Problem-agitate-solution. Open with the problem they're already wrestling with. Reveal the solution category. Position the product as the embodiment of that category.

**Hook style:** "Still manually [painful thing]? There's a category of software that does it for you — here's how ours works."

### Level 3: Solution-Aware
Prospect knows a solution category exists, is evaluating options.

**Channels:**
- **Primary:** Google search (category keywords — "best [category] tool"), Meta (comparison + differentiation)
- **Secondary:** YouTube (demo + case study), LinkedIn (B2B only)
- **OK to avoid:** TikTok (unless younger buyer)

**Funnel split:**
- Conversion: 70–85%
- Awareness: 5–15%
- Retargeting: 10–20%

**Creative approach:** Comparison + differentiation. Why you vs. competitors. Lead with the sharpest competitor weakness. Proof via case studies + specificity.

**Hook style:** "[Competitor] costs 3× more and doesn't do [thing]. Here's why [client name] switched."

### Level 4: Product-Aware
Prospect knows your brand, is comparing against alternatives or considering pricing.

**Channels:**
- **Primary:** Google search (branded + competitor-branded), Meta retargeting
- **Secondary:** Email / direct mail / dedicated account outreach
- **Avoid:** Top-of-funnel awareness campaigns (waste — they already know you)

**Funnel split:**
- Conversion: 60–80%
- Awareness: 0–5% (only to stay top-of-mind)
- Retargeting: 15–30%

**Creative approach:** Proof + objection handling. Address the specific objections blocking the purchase. Case studies at the skeptic's exact scale or industry. ROI demonstration.

**Hook style:** "You've seen the demo. Here's what 3 weeks of [client] with us looked like — [specific metric]."

### Level 5: Most-Aware
Prospect has considered buying. Needs a trigger to close.

**Channels:**
- **Primary:** Retargeting (Meta + Google), branded search, email
- **Secondary:** Direct outreach if B2B
- **Avoid:** Broad prospecting (redundant)

**Funnel split:**
- Conversion: 50–80% (retargeting is conversion-heavy by definition)
- Awareness: 0%
- Retargeting: 20–50%

**Creative approach:** Offer urgency + price. Discount, deadline, bonus, scarcity. The prospect already wants it — reduce friction.

**Hook style:** "48 hours left — [specific offer]."

## Channel Gating Rules

| Channel | Unaware | Problem-Aware | Solution-Aware | Product-Aware | Most-Aware |
|---|---|---|---|---|---|
| Meta feed | ✅ primary | ✅ primary | ✅ secondary | ✅ retargeting | ✅ retargeting |
| TikTok | ✅ if B2C/B2SMB | ✅ | Optional | Optional | Optional |
| YouTube pre-roll | ✅ | ✅ | ✅ | Optional | ❌ waste |
| Google search (category) | ❌ no volume | ⚠️ symptom kw only | ✅ primary | ✅ | ✅ branded only |
| Google search (branded) | ❌ no volume | ❌ | ⚠️ minimal | ✅ | ✅ primary |
| Google search (competitor) | ❌ | ❌ | ✅ | ✅ | ✅ |
| LinkedIn sponsored | ❌ too expensive | ⚠️ only B2B high-ticket | ✅ if B2B | ✅ if B2B | ✅ if B2B |
| Display / programmatic | ❌ | ❌ | Optional | ⚠️ retargeting only | ⚠️ retargeting only |
| Email | ❌ no list | ❌ no list | Optional | ✅ | ✅ primary |

## Funnel Split Rules (combined with DR default)

The DR default is 85–95% conversion. Awareness level adjusts the ceiling:

- Unaware + DR + budget ≤£5k: 90–95% conversion, the conversion campaign IS the education
- Unaware + DR + budget >£5k: 80–90% conversion, 10–20% awareness for impression frequency
- Problem-aware: 80–90% conversion
- Solution-aware: 75–85% conversion, 10–20% retargeting
- Product-aware: 60–80% conversion, 15–30% retargeting
- Most-aware: 50–70% conversion (retargeting-dominated), 20–40% retargeting

## Decision Rules

1. If `identityCard.awarenessLevel` is set (from classification at onboarding), use it.
2. If unset or 'unknown', derive from ICP `knowledgeOfCategory` + industry `categoryMaturity` signals.
3. If still unclear, default to `solution-aware` (the safest middle) and flag low confidence.
4. When awareness level conflicts with the business model default (e.g. SLG SaaS typically solution-aware; if research shows most-aware, trust the research over the default).

## Output Guidance

In block 1 (channel mix), name the awareness level in the rationale for each channel. In block 3 (creative), name the awareness level for each angle. Make the reasoning explicit so mismatches are easy to audit.
