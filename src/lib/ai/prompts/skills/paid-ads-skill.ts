// Extracted from marketingskills/paid-ads skill
// Prepend to sub-agent system prompts that need paid media expertise

export const PAID_ADS_SKILL = `
## Paid Media Domain Knowledge

### Platform Benchmarks (2024-2025)
- Google Search: avg CPC $2-8 for mid-market SaaS, CTR 3-6% for branded terms
- LinkedIn Ads: CPL $150-400 for B2B, CPC $8-20, best for titles/functions targeting
- Meta Ads: CPM $20-50 for B2B audiences, CPL $30-80 for SMB, $100-200 for enterprise
- YouTube: CPV $0.03-0.10, 25-40% view-through rate on 30s ads

### CAC by Business Model
- B2B SaaS: $800-3,000 (SMB), $3,000-15,000 (mid-market), $15,000+ (enterprise)
- B2C SaaS: $20-150 (consumer), $50-500 (prosumer)
- E-commerce: $15-80 (impulse buys), $50-200 (considered purchases)
- Marketplace: $20-100 (supply side), $5-30 (demand side)

### ROAS Benchmarks
- Minimum viable ROAS: 2x (covering ad spend)
- Target ROAS: 3-4x for scaling, 5x+ for profitable growth
- Cold traffic ROAS is always lower than retargeting (expect 30-50% lower)

### Creative Performance Patterns
- Hook quality determines 80% of ad performance — first 3 seconds on video, first line on static
- Pain-agitation-solution outperforms feature-benefit for B2B
- Social proof (customer logos, review counts) lifts CTR 15-25% on landing pages
- Specificity beats generality: "$47K saved" > "save money", "3x faster" > "saves time"

### Budget Allocation by Funnel Stage
- Awareness (cold traffic): 50-60% of budget
- Consideration (warm/retargeting): 25-30%
- Conversion (hot retargeting): 15-20%
`;
