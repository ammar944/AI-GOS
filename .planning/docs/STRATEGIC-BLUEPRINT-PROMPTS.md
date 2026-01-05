# Strategic Blueprint Pipeline - Prompt Documentation

> Generated from `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts`

## Overview

The Strategic Blueprint Generator uses a **5-section sequential pipeline** where each section builds upon the previous ones. All sections use **Claude Sonnet** with `temperature: 0.3` for consistent JSON output.

---

## Pipeline Architecture

```
┌──────────────────────┐
│  OnboardingFormData  │  User input from 9-step wizard
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  sanitizeInput()     │  Security layer - prevents prompt injection
│  createBusinessContext()
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                    SECTION 1                                 │
│              Industry Market Overview                        │
│         (No previous context - first section)                │
└──────────┬───────────────────────────────────────────────────┘
           │ outputs to ▼
┌──────────────────────────────────────────────────────────────┐
│                    SECTION 2                                 │
│              ICP Analysis & Validation                       │
│         (Receives: Section 1 summary)                        │
└──────────┬───────────────────────────────────────────────────┘
           │ outputs to ▼
┌──────────────────────────────────────────────────────────────┐
│                    SECTION 3                                 │
│              Offer Analysis & Viability                      │
│         (Receives: Section 2 summary)                        │
└──────────┬───────────────────────────────────────────────────┘
           │ outputs to ▼
┌──────────────────────────────────────────────────────────────┐
│                    SECTION 4                                 │
│              Competitor Analysis                             │
│         (Receives: Business context only)                    │
└──────────┬───────────────────────────────────────────────────┘
           │ outputs to ▼
┌──────────────────────────────────────────────────────────────┐
│                    SECTION 5                                 │
│              Cross-Analysis Synthesis                        │
│         (Receives: ALL 4 previous sections)                  │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│  StrategicBlueprintOutput  │  Complete 5-section output + metadata
└──────────────────────┘
```

---

## Input: Business Context Builder

### Source
`createBusinessContext(data: OnboardingFormData): string`

### Purpose
Transforms the 9-step onboarding form data into a structured markdown string that gets injected into every prompt.

### Input Fields Used

| Form Section | Fields Extracted |
|--------------|------------------|
| `businessBasics` | businessName, websiteUrl, contactName |
| `icp` | primaryIcpDescription, industryVertical, jobTitles, companySize, geography, easiestToClose, buyingTriggers, bestClientSources, secondaryIcp, systemsPlatforms |
| `productOffer` | productDescription, coreDeliverables, offerPrice, pricingModel, valueProp, currentFunnelType, guarantees |
| `marketCompetition` | topCompetitors, uniqueEdge, marketBottlenecks, competitorFrustrations, proprietaryTech |
| `customerJourney` | situationBeforeBuying, desiredTransformation, commonObjections, salesCycleLength, salesProcessOverview |
| `brandPositioning` | brandPositioning, customerVoice |
| `budgetTargets` | monthlyAdBudget, campaignDuration, targetCpl, targetCac |
| `compliance` | topicsToAvoid, claimRestrictions |

### Output Format
```markdown
## BUSINESS CONTEXT FOR STRATEGIC BLUEPRINT

### Company Information
- Business Name: {businessName}
- Website: {websiteUrl}
- Contact: {contactName}

### Ideal Customer Profile (ICP)
- Primary ICP: {primaryIcpDescription}
- Industry: {industryVertical}
- Target Job Titles: {jobTitles}
- Company Size: {companySize}
- Geography: {geography}
- Easiest to Close: {easiestToClose}
- Buying Triggers: {buyingTriggers}
- Best Client Sources: {bestClientSources}
- Secondary ICP: {secondaryIcp}
- Systems & Platforms Used: {systemsPlatforms}

### Product & Offer
- Product Description: {productDescription}
- Core Deliverables: {coreDeliverables}
- Offer Price: ${offerPrice}
- Pricing Model: {pricingModel}
- Value Proposition: {valueProp}
- Current Funnel Type: {currentFunnelType}
- Guarantees: {guarantees}

### Market & Competition
- Top Competitors: {topCompetitors}
- Unique Edge: {uniqueEdge}
- Market Bottlenecks: {marketBottlenecks}
- Competitor Frustrations: {competitorFrustrations}
- Proprietary Tech: {proprietaryTech}

### Customer Journey
- Situation Before Buying: {situationBeforeBuying}
- Desired Transformation: {desiredTransformation}
- Common Objections: {commonObjections}
- Sales Cycle Length: {salesCycleLength}
- Sales Process: {salesProcessOverview}

### Brand & Positioning
- Brand Positioning: {brandPositioning}
- Customer Voice: {customerVoice}

### Budget & Targets
- Monthly Ad Budget: ${monthlyAdBudget}
- Campaign Duration: {campaignDuration}
- Target CPL: ${targetCpl}
- Target CAC: ${targetCac}

### Compliance
- Topics to Avoid: {topicsToAvoid}
- Claim Restrictions: {claimRestrictions}
```

### Security: Input Sanitization

Each field passes through `sanitizeInput()` which:

1. **Truncates** to 5,000 characters max
2. **Filters** prompt injection patterns:
   - `ignore all previous instructions`
   - `disregard prior context`
   - `system:`, `assistant:`, `user:`
   - `[INST]`, `[/INST]`
   - `<|im_start|>`, `<|im_end|>`
   - Code block markers (` ``` `)
3. **Removes** control characters

---

## Section 1: Industry & Market Overview

### Purpose
Analyze the market landscape, pain points, psychological drivers, and messaging opportunities for the target industry.

### AI Role
> "You are an expert market researcher."

### Receives Context From
- Business context only (first section)

### System Prompt

```
You are an expert market researcher. Generate a JSON object for Industry & Market Overview.

REQUIRED STRUCTURE (follow EXACTLY):
{
  "categorySnapshot": {
    "category": "string - market category name",
    "marketMaturity": "early" | "growing" | "saturated",
    "awarenessLevel": "low" | "medium" | "high",
    "buyingBehavior": "impulsive" | "committee_driven" | "roi_based" | "mixed",
    "averageSalesCycle": "string - e.g. '2-4 weeks' or '3-6 months'",
    "seasonality": "string - seasonal patterns or 'Year-round'"
  },
  "marketDynamics": {
    "demandDrivers": ["string array - 4-6 factors driving demand"],
    "buyingTriggers": ["string array - 4-6 events that trigger purchases"],
    "barriersToPurchase": ["string array - 3-5 obstacles to buying"],
    "macroRisks": {
      "regulatoryConcerns": "string - regulatory risks",
      "marketDownturnRisks": "string - economic risks",
      "industryConsolidation": "string - M&A/consolidation risks"
    }
  },
  "painPoints": {
    "primary": ["string array - 5-7 most critical pain points"],
    "secondary": ["string array - 5-8 additional pain points"]
  },
  "psychologicalDrivers": {
    "drivers": [
      {"driver": "string - emotional driver name", "description": "string - how it manifests"}
    ]
  },
  "audienceObjections": {
    "objections": [
      {"objection": "string - common objection", "howToAddress": "string - response strategy"}
    ]
  },
  "messagingOpportunities": {
    "opportunities": ["string array - 6-8 messaging angles"],
    "summaryRecommendations": ["string array - 3 key strategic recommendations"]
  }
}

RULES:
- Use ONLY the exact enum values shown above (e.g., "early", "growing", "saturated" for marketMaturity)
- All arrays must contain the specified number of items
- Be specific and actionable based on the provided business context
```

### User Prompt
```
Create an Industry & Market Overview for:

{BUSINESS_CONTEXT}
```

### Output Schema: `IndustryMarketOverview`

| Field | Type | Description |
|-------|------|-------------|
| `categorySnapshot.category` | string | Market category name |
| `categorySnapshot.marketMaturity` | enum | `early` \| `growing` \| `saturated` |
| `categorySnapshot.awarenessLevel` | enum | `low` \| `medium` \| `high` |
| `categorySnapshot.buyingBehavior` | enum | `impulsive` \| `committee_driven` \| `roi_based` \| `mixed` |
| `categorySnapshot.averageSalesCycle` | string | e.g., "2-4 weeks", "3-6 months" |
| `categorySnapshot.seasonality` | string | Seasonal patterns or "Year-round" |
| `marketDynamics.demandDrivers` | string[] | 4-6 factors driving demand |
| `marketDynamics.buyingTriggers` | string[] | 4-6 purchase trigger events |
| `marketDynamics.barriersToPurchase` | string[] | 3-5 obstacles to buying |
| `marketDynamics.macroRisks` | object | Regulatory, economic, consolidation risks |
| `painPoints.primary` | string[] | 5-7 critical pain points |
| `painPoints.secondary` | string[] | 5-8 additional pain points |
| `psychologicalDrivers.drivers` | array | Emotional drivers with descriptions |
| `audienceObjections.objections` | array | Objections with response strategies |
| `messagingOpportunities.opportunities` | string[] | 6-8 messaging angles |
| `messagingOpportunities.summaryRecommendations` | string[] | 3 strategic recommendations |

### What This Section Accomplishes
- Maps the competitive landscape
- Identifies buyer psychology and emotional triggers
- Surfaces objections that ads must overcome
- Provides messaging angles for creative strategy

---

## Section 2: ICP Analysis & Validation

### Purpose
Validate whether the Ideal Customer Profile (ICP) is viable for paid media campaigns. Checks reachability, budget, pain-solution fit, and economic feasibility.

### AI Role
> "You are an expert ICP analyst. Validate whether this ICP is viable for paid media campaigns."

### Receives Context From
- Business context
- Section 1 summary:
  - Primary Pain Points (first 3)
  - Market Maturity
  - Buying Behavior

### System Prompt

```
You are an expert ICP analyst. Validate whether this ICP is viable for paid media campaigns.

CONTEXT FROM PREVIOUS ANALYSIS:
- Primary Pain Points: {section1.painPoints.primary[0:3]}
- Market Maturity: {section1.categorySnapshot.marketMaturity}
- Buying Behavior: {section1.categorySnapshot.buyingBehavior}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "coherenceCheck": {
    "clearlyDefined": true | false,
    "reachableThroughPaidChannels": true | false,
    "adequateScale": true | false,
    "hasPainOfferSolves": true | false,
    "hasBudgetAndAuthority": true | false
  },
  "painSolutionFit": {
    "primaryPain": "string - the main pain point being solved",
    "offerComponentSolvingIt": "string - which part of the offer addresses this",
    "fitAssessment": "strong" | "moderate" | "weak",
    "notes": "string - additional context on the fit"
  },
  "marketReachability": {
    "metaVolume": true | false,
    "linkedInVolume": true | false,
    "googleSearchDemand": true | false,
    "contradictingSignals": ["string array - any conflicting data, can be empty []"]
  },
  "economicFeasibility": {
    "hasBudget": true | false,
    "purchasesSimilar": true | false,
    "tamAlignedWithCac": true | false,
    "notes": "string - economic viability notes"
  },
  "riskAssessment": {
    "reachability": "low" | "medium" | "high" | "critical",
    "budget": "low" | "medium" | "high" | "critical",
    "painStrength": "low" | "medium" | "high" | "critical",
    "competitiveness": "low" | "medium" | "high" | "critical"
  },
  "finalVerdict": {
    "status": "validated" | "workable" | "invalid",
    "reasoning": "string - 2-3 sentences explaining the verdict",
    "recommendations": ["string array - 2-4 actionable recommendations"]
  }
}

RULES:
- Be honest and critical - flag real concerns
- Use ONLY the exact enum values shown
- "validated" = ICP is solid and ready for paid campaigns
- "workable" = ICP has issues but can proceed with adjustments
- "invalid" = ICP needs major rework before running ads
```

### User Prompt
```
Validate the ICP for:

{BUSINESS_CONTEXT}
```

### Output Schema: `ICPAnalysisValidation`

| Field | Type | Description |
|-------|------|-------------|
| `coherenceCheck.clearlyDefined` | boolean | ICP is clearly defined |
| `coherenceCheck.reachableThroughPaidChannels` | boolean | Can reach via Meta/LinkedIn/Google |
| `coherenceCheck.adequateScale` | boolean | Enough audience volume exists |
| `coherenceCheck.hasPainOfferSolves` | boolean | ICP has the pain the offer solves |
| `coherenceCheck.hasBudgetAndAuthority` | boolean | Has budget and decision-making power |
| `painSolutionFit.primaryPain` | string | Main pain being solved |
| `painSolutionFit.offerComponentSolvingIt` | string | Which offer component addresses it |
| `painSolutionFit.fitAssessment` | enum | `strong` \| `moderate` \| `weak` |
| `marketReachability.metaVolume` | boolean | Enough audience on Meta |
| `marketReachability.linkedInVolume` | boolean | Enough audience on LinkedIn |
| `marketReachability.googleSearchDemand` | boolean | Search demand exists |
| `riskAssessment.*` | enum | `low` \| `medium` \| `high` \| `critical` |
| `finalVerdict.status` | enum | `validated` \| `workable` \| `invalid` |
| `finalVerdict.reasoning` | string | 2-3 sentence explanation |
| `finalVerdict.recommendations` | string[] | 2-4 actionable recommendations |

### What This Section Accomplishes
- Validates ICP is reachable through paid channels
- Assesses pain-solution fit strength
- Identifies economic feasibility issues
- Provides go/no-go verdict for paid media

---

## Section 3: Offer Analysis & Viability

### Purpose
Evaluate the offer's strength, clarity, and market fit for paid media campaigns. Scores offer components 1-10 and identifies red flags.

### AI Role
> "You are an expert offer analyst. Evaluate offer viability for paid media campaigns."

### Receives Context From
- Business context
- Section 2 summary:
  - ICP Validation Status
  - Pain-Solution Fit Assessment
  - Primary Pain identified

### System Prompt

```
You are an expert offer analyst. Evaluate offer viability for paid media campaigns.

CONTEXT FROM PREVIOUS ANALYSIS:
- ICP Status: {section2.finalVerdict.status}
- Pain-Solution Fit: {section2.painSolutionFit.fitAssessment}
- Primary Pain: {section2.painSolutionFit.primaryPain}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "offerClarity": {
    "clearlyArticulated": true | false,
    "solvesRealPain": true | false,
    "benefitsEasyToUnderstand": true | false,
    "transformationMeasurable": true | false,
    "valuePropositionObvious": true | false
  },
  "offerStrength": {
    "painRelevance": 1-10,
    "urgency": 1-10,
    "differentiation": 1-10,
    "tangibility": 1-10,
    "proof": 1-10,
    "pricingLogic": 1-10,
    "overallScore": number (average of above scores, 1 decimal)
  },
  "marketOfferFit": {
    "marketWantsNow": true | false,
    "competitorsOfferSimilar": true | false,
    "priceMatchesExpectations": true | false,
    "proofStrongForColdTraffic": true | false,
    "transformationBelievable": true | false
  },
  "redFlags": ["array of applicable flags - use ONLY these exact values:
    'offer_too_vague', 'overcrowded_market', 'price_mismatch',
    'weak_or_no_proof', 'no_funnel_built', 'transformation_unclear'
    - can be empty array [] if no red flags"],
  "recommendation": {
    "status": "proceed" | "adjust_messaging" | "adjust_pricing" | "icp_refinement_needed" | "major_offer_rebuild",
    "reasoning": "string - 2-3 sentences explaining the recommendation",
    "actionItems": ["string array - 2-4 specific action items"]
  }
}

RULES:
- Score honestly based on information provided (don't inflate scores)
- overallScore must be the mathematical average of the 6 scores above it
- redFlags array should only contain flags that actually apply
- Use ONLY the exact enum values shown for status and redFlags
```

### User Prompt
```
Analyze the offer viability for:

{BUSINESS_CONTEXT}
```

### Output Schema: `OfferAnalysisViability`

| Field | Type | Description |
|-------|------|-------------|
| `offerClarity.clearlyArticulated` | boolean | Offer is easy to explain |
| `offerClarity.solvesRealPain` | boolean | Addresses a real problem |
| `offerClarity.transformationMeasurable` | boolean | Results can be measured |
| `offerClarity.valuePropositionObvious` | boolean | Value clear in <3 seconds |
| `offerStrength.painRelevance` | number | 1-10 score |
| `offerStrength.urgency` | number | 1-10 score |
| `offerStrength.differentiation` | number | 1-10 score |
| `offerStrength.tangibility` | number | 1-10 score |
| `offerStrength.proof` | number | 1-10 score |
| `offerStrength.pricingLogic` | number | 1-10 score |
| `offerStrength.overallScore` | number | Average of 6 scores |
| `marketOfferFit.*` | boolean | Various fit checks |
| `redFlags` | enum[] | `offer_too_vague` \| `overcrowded_market` \| `price_mismatch` \| `weak_or_no_proof` \| `no_funnel_built` \| `transformation_unclear` |
| `recommendation.status` | enum | `proceed` \| `adjust_messaging` \| `adjust_pricing` \| `icp_refinement_needed` \| `major_offer_rebuild` |
| `recommendation.actionItems` | string[] | 2-4 specific actions |

### What This Section Accomplishes
- Quantifies offer strength with 1-10 scores
- Identifies specific red flags that could hurt campaigns
- Provides clear recommendation status
- Lists actionable items to improve offer

---

## Section 4: Competitor Analysis

### Purpose
Research the competitor landscape including their offers, ad strategies, creative formats, and funnel patterns. Identifies gaps and opportunities.

### AI Role
> "You are an expert competitive analyst. Research the competitor landscape for paid media strategy."

### Receives Context From
- Business context only (competitor data is self-contained)

### System Prompt

```
You are an expert competitive analyst. Research the competitor landscape for paid media strategy.

REQUIRED STRUCTURE (follow EXACTLY):
{
  "competitors": [
    {
      "name": "string - competitor name",
      "positioning": "string - how they position themselves",
      "offer": "string - their main offer/product",
      "price": "string - e.g. '$997/mo', '$5,000 one-time', 'Custom pricing'",
      "funnels": "string - e.g. 'Demo call, Free trial'",
      "adPlatforms": ["array of platforms - e.g. 'Meta', 'LinkedIn', 'Google'"],
      "strengths": ["array of 2-3 key strengths"],
      "weaknesses": ["array of 2-3 key weaknesses"]
    }
  ],
  "creativeLibrary": {
    "adHooks": ["array of 5-7 hook examples that competitors use in their ads"],
    "creativeFormats": {
      "ugc": true | false,
      "carousels": true | false,
      "statics": true | false,
      "testimonial": true | false,
      "productDemo": true | false
    }
  },
  "funnelBreakdown": {
    "landingPagePatterns": ["array of 3-4 common landing page patterns"],
    "headlineStructure": ["array of 3-4 headline formulas used"],
    "ctaHierarchy": ["array of 2-3 CTA patterns"],
    "socialProofPatterns": ["array of 3-4 social proof types used"],
    "leadCaptureMethods": ["array of 2-3 lead capture approaches"],
    "formFriction": "low" | "medium" | "high"
  },
  "marketStrengths": ["array of 3-4 industry-wide strengths"],
  "marketWeaknesses": ["array of 3-4 industry-wide weaknesses"],
  "gapsAndOpportunities": {
    "messagingOpportunities": ["array of 3-4 messaging gaps to exploit"],
    "creativeOpportunities": ["array of 2-3 creative format opportunities"],
    "funnelOpportunities": ["array of 2-3 funnel improvement opportunities"]
  }
}

RULES:
- Include 3-5 competitors based on the competitor list provided
- If specific competitors aren't named, infer likely competitors from the industry
- Be specific with hooks and patterns - give actual examples, not generic descriptions
- formFriction should reflect typical forms in this market
```

### User Prompt
```
Analyze competitors for:

{BUSINESS_CONTEXT}
```

### Output Schema: `CompetitorAnalysis`

| Field | Type | Description |
|-------|------|-------------|
| `competitors[].name` | string | Competitor name |
| `competitors[].positioning` | string | How they position themselves |
| `competitors[].offer` | string | Main offer/product |
| `competitors[].price` | string | Price point |
| `competitors[].funnels` | string | Funnel types used |
| `competitors[].adPlatforms` | string[] | Ad platforms used |
| `competitors[].strengths` | string[] | 2-3 key strengths |
| `competitors[].weaknesses` | string[] | 2-3 key weaknesses |
| `creativeLibrary.adHooks` | string[] | 5-7 actual hook examples |
| `creativeLibrary.creativeFormats` | object | Boolean flags for format types |
| `funnelBreakdown.landingPagePatterns` | string[] | 3-4 LP patterns |
| `funnelBreakdown.headlineStructure` | string[] | 3-4 headline formulas |
| `funnelBreakdown.formFriction` | enum | `low` \| `medium` \| `high` |
| `gapsAndOpportunities.messagingOpportunities` | string[] | 3-4 messaging gaps |
| `gapsAndOpportunities.creativeOpportunities` | string[] | 2-3 creative gaps |
| `gapsAndOpportunities.funnelOpportunities` | string[] | 2-3 funnel gaps |

### What This Section Accomplishes
- Maps 3-5 competitors with detailed profiles
- Extracts actual ad hooks and creative patterns
- Identifies funnel patterns and form friction
- Surfaces gaps and opportunities to exploit

---

## Section 5: Cross-Analysis Synthesis

### Purpose
Synthesize all previous analysis into actionable paid media strategy. Provides key insights, positioning, messaging angles, platform recommendations, and next steps.

### AI Role
> "You are a strategic analyst synthesizing all research into actionable paid media strategy."

### Receives Context From
- Business context
- **ALL 4 previous sections summarized:**
  - Section 1: Market Maturity, Buying Behavior, Awareness Level, Top Pain Points
  - Section 2: ICP Validation Status, Pain-Solution Fit, Risk Levels
  - Section 3: Offer Overall Score, Recommendation Status, Red Flags
  - Section 4: Competitors Analyzed, Market Strengths, Key Opportunities

### System Prompt

```
You are a strategic analyst synthesizing all research into actionable paid media strategy.

PREVIOUS ANALYSIS SUMMARY:
- Market Maturity: {section1.categorySnapshot.marketMaturity}
- Buying Behavior: {section1.categorySnapshot.buyingBehavior}
- Awareness Level: {section1.categorySnapshot.awarenessLevel}
- Top Pain Points: {section1.painPoints.primary[0:3]}

- ICP Validation Status: {section2.finalVerdict.status}
- Pain-Solution Fit: {section2.painSolutionFit.fitAssessment}
- Risk Levels: Reachability={section2.riskAssessment.reachability}, Budget={section2.riskAssessment.budget}, Competition={section2.riskAssessment.competitiveness}

- Offer Overall Score: {section3.offerStrength.overallScore}/10
- Offer Recommendation: {section3.recommendation.status}
- Red Flags: {section3.redFlags}

- Competitors Analyzed: {section4.competitors.length}
- Market Strengths: {section4.marketStrengths[0:2]}
- Key Opportunities: {section4.gapsAndOpportunities.messagingOpportunities[0:2]}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "keyInsights": [
    {
      "insight": "string - the key finding",
      "source": "industryMarketOverview" | "icpAnalysisValidation" | "offerAnalysisViability" | "competitorAnalysis",
      "implication": "string - what this means for the paid media strategy",
      "priority": "high" | "medium" | "low"
    }
  ],
  "recommendedPositioning": "string - 2-3 sentence ideal market positioning statement",
  "primaryMessagingAngles": [
    "string - specific messaging angle to test in ads"
  ],
  "recommendedPlatforms": [
    {
      "platform": "Meta" | "LinkedIn" | "Google" | "YouTube" | "TikTok",
      "reasoning": "string - why this platform fits the ICP and offer",
      "priority": "primary" | "secondary" | "testing"
    }
  ],
  "criticalSuccessFactors": [
    "string - must-have element for campaign success"
  ],
  "potentialBlockers": [
    "string - factor that could prevent success"
  ],
  "nextSteps": [
    "string - specific recommended next action"
  ]
}

RULES:
- keyInsights: Include 5-7 insights with at least one from each section
- primaryMessagingAngles: Include 3-5 specific, testable messaging angles
- recommendedPlatforms: Include 2-3 platforms, exactly one should be "primary"
- criticalSuccessFactors: Include 4-5 specific success factors
- potentialBlockers: Include 2-3 realistic blockers based on the analysis
- nextSteps: Include 4-5 actionable next steps in priority order
- Use ONLY the exact enum values shown for source, priority, and platform
```

### User Prompt
```
Synthesize all analysis into a strategic blueprint for:

{BUSINESS_CONTEXT}
```

### Output Schema: `CrossAnalysisSynthesis`

| Field | Type | Description |
|-------|------|-------------|
| `keyInsights[].insight` | string | The key finding |
| `keyInsights[].source` | enum | Which section it came from |
| `keyInsights[].implication` | string | What it means for strategy |
| `keyInsights[].priority` | enum | `high` \| `medium` \| `low` |
| `recommendedPositioning` | string | 2-3 sentence positioning statement |
| `primaryMessagingAngles` | string[] | 3-5 testable messaging angles |
| `recommendedPlatforms[].platform` | enum | `Meta` \| `LinkedIn` \| `Google` \| `YouTube` \| `TikTok` |
| `recommendedPlatforms[].reasoning` | string | Why this platform fits |
| `recommendedPlatforms[].priority` | enum | `primary` \| `secondary` \| `testing` |
| `criticalSuccessFactors` | string[] | 4-5 must-have elements |
| `potentialBlockers` | string[] | 2-3 realistic blockers |
| `nextSteps` | string[] | 4-5 prioritized actions |

### What This Section Accomplishes
- Synthesizes insights from all 4 previous sections
- Provides clear positioning recommendation
- Gives specific, testable messaging angles
- Recommends platforms with reasoning
- Lists critical success factors and blockers
- Provides prioritized next steps

---

## API Call Configuration

All sections use the same configuration:

```typescript
await client.chatJSON({
  model: MODELS.CLAUDE_SONNET,  // "anthropic/claude-sonnet-4"
  messages: [systemPrompt, userPrompt],
  temperature: 0.3,             // Low for consistent JSON
  maxTokens: 4096,              // Max response length
});
```

### Why These Settings?

| Setting | Value | Reason |
|---------|-------|--------|
| Model | Claude Sonnet | Best balance of quality and cost for structured output |
| Temperature | 0.3 | Low randomness = consistent JSON structure |
| Max Tokens | 4096 | Allows full section output without truncation |

---

## Error Handling

The generator handles errors gracefully:

1. **Abort Signal** - User can cancel generation mid-process
2. **Partial Output** - Returns completed sections even if later ones fail
3. **Progress Callbacks** - Real-time updates on current section and errors
4. **Cost Tracking** - Accumulates cost even on failure for billing accuracy

---

## Output Metadata

Every completed generation includes:

```typescript
metadata: {
  generatedAt: string;       // ISO timestamp
  version: "1.0";            // Schema version
  processingTime: number;    // Total ms
  totalCost: number;         // USD cost
  modelsUsed: string[];      // ["anthropic/claude-sonnet-4"]
  overallConfidence: number; // Fixed at 75 currently
}
```

---

## Section Dependencies Diagram

```
Section 1: Industry Market Overview
    │
    │ provides: painPoints, marketMaturity, buyingBehavior
    │
    ▼
Section 2: ICP Analysis & Validation
    │
    │ provides: finalVerdict.status, painSolutionFit, riskAssessment
    │
    ▼
Section 3: Offer Analysis & Viability
    │
    │ provides: offerStrength.overallScore, recommendation.status, redFlags
    │
    ▼
Section 4: Competitor Analysis (standalone)
    │
    │ provides: competitors.length, marketStrengths, gapsAndOpportunities
    │
    ▼
Section 5: Cross-Analysis Synthesis
    │
    │ receives: ALL of the above
    │
    ▼
    Final Strategic Blueprint
```
