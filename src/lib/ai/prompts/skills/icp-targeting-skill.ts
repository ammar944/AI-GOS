// Sources: coreyhaines31/marketing-psychology, alirezarezvani/marketing-strategy-pmm,
// ComposioHQ/lead-research-assistant, claude-ads/budget-allocation.md
// Prepend to researchICP sub-agent system prompt

export const ICP_TARGETING_SKILL = `
## ICP & Buyer Targeting Domain Knowledge

### B2B Buying Committee Roles
- Economic Buyer: controls budget, cares about ROI and payback period
- Technical Buyer: evaluates feasibility, cares about integration and security
- Champion: internal advocate, needs ammunition to sell internally
- Blocker: raises objections, often IT/security/legal — must be neutralized
- End User: daily operator, cares about UX and time savings
- In ads, target Champions and Economic Buyers — they initiate evaluation

### Platform Targeting Capabilities (2026)
- LinkedIn: job title, company size, industry, seniority, skills, groups (most precise for B2B)
- Meta: interest + behavior + lookalike audiences, Advantage+ for broad targeting
- Google: keyword intent (highest purchase intent), in-market audiences, customer match
- TikTok: interest + behavior, spark ads for creator content, limited B2B targeting
- Microsoft: LinkedIn profile targeting via Microsoft Ads (unique cross-platform signal)

### Audience Sizing Rules
- LinkedIn: minimum 50K matched audience for campaign viability
- Meta: 1M-10M for cold prospecting, 100K-500K for lookalikes
- Google Search: minimum 1K monthly searches for core intent keywords
- If total reachable audience < 30K on any platform, paid media is high-risk

### ICP Validation Checklist
1. Can you name 10 real companies that fit? If not, ICP is too abstract
2. Do they have budget authority for this price point?
3. Are they reachable on at least 2 ad platforms?
4. Do they actively search for solutions (search volume evidence)?
5. Is there a triggering event that creates urgency?

### Buyer Psychology Mental Models
- Jobs-to-Be-Done: what job is the buyer hiring this product to do?
- Loss Aversion: buyers feel losses 2x more than gains — "stop losing $X" > "save $X"
- Anchoring: first number seen sets the reference point — lead with big value, then price
- Social Proof: "2,000 companies use us" reduces perceived risk for committee buyers
- Goal-Gradient: buyers accelerate when they feel close to a goal — show progress in funnel
- Peak-End Rule: buyers remember the peak moment and the end — nail the demo and close
- Status Quo Bias: switching cost is psychological, not just financial — quantify inaction cost

### Objection Mapping Framework
- Price objection → needs ROI proof (case study with $ savings)
- Trust objection → needs social proof (logos, reviews, certifications)
- Complexity objection → needs simplicity proof (time to value, onboarding speed)
- Risk objection → needs safety net (free trial, money-back guarantee, pilot program)
- Timing objection → needs urgency trigger (competitor pressure, compliance deadline, cost of delay)

### ICP Confidence Scoring
- 80-100: validated — real buyer language sourced, platform targeting confirmed, budget authority verified
- 60-79: workable — some assumptions, may need testing with small budget first
- Below 60: invalid — too speculative, recommend primary research before ad spend
`;
