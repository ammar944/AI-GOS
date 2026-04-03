export const KEYWORD_CAMPAIGN_SKILL = `
## Campaign Group Structure Guidance

### Mandatory Group Types
Structure campaignGroups using these industry-standard group types. Name each campaign
after its group type so a media buyer can immediately recognize the strategy:

1. **Generic / Category Keywords** — non-branded terms describing the product category
   or problem space. Examples: "contractor estimating software", "home remodel financing",
   "SaaS onboarding tool". These capture net-new demand from prospects who don't know any
   brand yet. Set intent to "generic" or "category".

2. **Branded / Competitor Keywords** — competitor brand names, "vs" comparisons, and
   "[competitor] alternative" terms. Examples: "Buildertrend alternative", "Jobber vs
   Housecall Pro", "[competitor] pricing". These capture high-intent switchers. Set intent
   to "branded" or "competitor".

3. **Variable 3rd Group** — a contextual group that varies by client. Common options:
   - Language or demographic: targeting a specific language segment (e.g., Spanish-language
     keywords for bilingual markets)
   - Gender or audience variant: if the ICP has distinct sub-audiences with different
     search behavior
   - Service-line specific: if the client has multiple products/services targeting
     different needs (e.g., "estimating software" vs "contractor financing")
   - Long-tail / pain-point: highly specific queries tied to ICP pain points from the
     research context

   Choose the variable group that best fits the client's market based on the research
   context. Set intent to describe the variant (e.g., "service-line", "pain-point",
   "demographic").

### Why This Structure
Media buyers organize Google Ads into these group types because each requires different
bidding strategies, match types, and ad copy. Splitting by individual keywords (SKAGs)
is outdated. Theme-based groups aligned to buyer intent allow proper budget control and
performance measurement per funnel stage.

### Ad Group Naming
Within each campaign group, name ad groups descriptively so they reflect the keyword theme:
- Good: "Estimating Software - Commercial", "Competitor Comparisons - Pricing"
- Bad: "Ad Group 1", "Keywords Set A"

### Negative Keywords
Cross-pollinate negatives: add branded terms as negatives in the generic campaign, and
generic terms as negatives in the branded campaign to prevent cannibalization.
`;

export const KEYWORD_CAMPAIGN_SKILL_COMPACT = `
## Campaign Group Types (Required)
Structure campaignGroups as:
1. Generic/Category — non-branded industry/problem terms (intent: "generic")
2. Branded/Competitor — competitor names, "[X] alternative", "[X] vs [Y]" (intent: "competitor")
3. Variable 3rd — contextual: service-line, demographic, or pain-point group (intent: describe variant)
Do NOT split by individual keywords. Group by theme and buyer intent.
Cross-pollinate negative keywords between campaigns to prevent cannibalization.
`;
