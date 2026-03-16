// Sources: claude-ads/benchmarks.md, claude-ads/budget-allocation.md,
// alirezarezvani/marketing-strategy-pmm, zubair-trabzada/market-audit
// Prepend to researchIndustry sub-agent system prompt

export const INDUSTRY_MARKET_SKILL = `
## Industry & Market Analysis Domain Knowledge

### Market Sizing Methodology
- Always derive SAM (Serviceable Addressable Market) before TAM
- SAM = category-specific revenue, NOT parent-market TAM
- If SAM is unavailable, build a proxy estimate: (estimated # of target companies) × (average annual spend on this category)
- Cross-validate with analyst reports (Gartner, Forrester, IDC, Grand View Research)
- Flag when only TAM is available — a $50B "digital marketing" TAM is useless for a niche CRM

### Market Maturity Classification
- Early: <5 established players, buyers need education, category terms have low search volume
- Growing: 10-30 competitors, comparison keywords rising, G2/Capterra categories exist
- Saturated: 50+ competitors, feature parity is common, differentiation is mostly brand/price
- Signal: if "best [category] software" has >5K monthly searches, the market is at least Growing

### Demand Driver Analysis
- Regulatory drivers: compliance deadlines create urgency spikes (e.g., GDPR, SOC2, ADA)
- Technology shifts: platform migrations (e.g., GA4 forced migration, cookie deprecation)
- Economic pressure: recession = consolidation tools win; growth = expansion tools win
- Workforce trends: labor shortage = automation tools; remote work = collaboration tools

### Seasonality Patterns by Vertical
- B2B SaaS: Q4 budget flush (Oct-Dec), Q1 new-year planning, summer slowdown
- E-commerce: Black Friday/Cyber Monday, back-to-school, Valentine's Day, Prime Day
- Education: Aug-Sep enrollment, Jan-Feb spring enrollment
- Healthcare: open enrollment (Nov-Dec), fiscal year starts (Jul, Oct)
- Construction/RE: spring surge (Mar-May), year-end push

### Buying Behavior Indicators
- Impulsive: <$100 price point, single decision-maker, instant gratification
- Committee-driven: $10K+ ACV, 3-7 stakeholders, 3-6 month cycle
- ROI-based: finance approval required, business case needed, payback period matters
- Mixed: SMB starts impulsive, grows into committee as deal size increases

### Pain Point Mining Sources (Priority Order)
1. G2/Capterra negative reviews (1-3 stars) — real buyer language
2. Reddit/HackerNews complaint threads — unfiltered frustration
3. Support forums and community posts — operational pain
4. Job postings in the category — reveals what buyers are building internally
5. Google "People Also Ask" — reveals buyer confusion and knowledge gaps

### Market Intelligence Red Flags
- If no G2 category exists, the market may be too early for paid media
- If top competitors all have <50 reviews, the buyer pool may be too small
- If all competitors use the same messaging, differentiation via ads alone is expensive
- If the category leader has 80%+ market share, challenger strategy is mandatory
`;
