# Strategic Blueprint Generator
## Pipeline Architecture Documentation

---

## Pipeline Architecture

The Strategic Blueprint Generator processes user input through a 5-section sequential pipeline, where each section builds upon previous analysis to create a comprehensive paid media strategy.

---

## Data Flow Overview

```
OnboardingFormData → sanitizeInput() → createBusinessContext()
                              ↓
Section 1: Industry Market Overview (No previous context)
                              ↓ outputs to
Section 2: ICP Analysis & Validation (Receives: Section 1 summary)
                              ↓ outputs to
Section 3: Offer Analysis & Viability (Receives: Section 2 summary)
                              ↓ outputs to
Section 4: Competitor Analysis (Receives: Business context only)
                              ↓ outputs to
Section 5: Cross-Analysis Synthesis (Receives: ALL 4 previous sections)
                              ↓
StrategicBlueprintOutput (Complete 5-section output + metadata)
```

---

## Input: Business Context Builder

**Source:** `createBusinessContext(data: OnboardingFormData): string`

**Purpose:** Transforms the 9-step onboarding form data into a structured markdown string that gets injected into every prompt.

### Input Fields Used

| Form Section | Fields Extracted |
|--------------|------------------|
| businessBasics | businessName, websiteUrl, contactName |
| icp | primaryIcpDescription, industryVertical, jobTitles, companySize, geography, easiestToClose, buyingTriggers, bestClientSources, secondaryIcp, systemsPlatforms |
| productOffer | productDescription, coreDeliverables, offerPrice, pricingModel, valueProp, currentFunnelType, guarantees |
| marketCompetition | topCompetitors, uniqueEdge, marketBottlenecks, competitorFrustrations, proprietaryTech |
| customerJourney | situationBeforeBuying, desiredTransformation, commonObjections, salesCycleLength, salesProcessOverview |
| brandPositioning | brandPositioning, customerVoice |
| budgetTargets | monthlyAdBudget, campaignDuration, targetCpl, targetCac |
| compliance | topicsToAvoid, claimRestrictions |

### Security: Input Sanitization

Each field passes through `sanitizeInput()` which:
- Truncates to 5,000 characters max
- Filters prompt injection patterns (ignore instructions, system:/user:/assistant:, [INST], code blocks)
- Removes control characters

---

## Section 1: Industry & Market Overview

**Purpose:** Analyze the market landscape, pain points, psychological drivers, and messaging opportunities for the target industry.

**AI Role:** "You are an expert market researcher."

**Receives Context From:** Business context only (first section)

### Output Schema: IndustryMarketOverview

| Field | Type | Description |
|-------|------|-------------|
| categorySnapshot.category | string | Market category name |
| categorySnapshot.marketMaturity | enum | early \| growing \| saturated |
| categorySnapshot.awarenessLevel | enum | low \| medium \| high |
| categorySnapshot.buyingBehavior | enum | impulsive \| committee_driven \| roi_based \| mixed |
| marketDynamics.demandDrivers | string[] | 4-6 factors driving demand |
| painPoints.primary | string[] | 5-7 critical pain points |
| psychologicalDrivers.drivers | array | Emotional drivers with descriptions |
| messagingOpportunities.opportunities | string[] | 6-8 messaging angles |

### What This Section Accomplishes
- Maps the competitive landscape
- Identifies buyer psychology and emotional triggers
- Surfaces objections that ads must overcome
- Provides messaging angles for creative strategy

---

## Section 2: ICP Analysis & Validation

**Purpose:** Validate whether the Ideal Customer Profile (ICP) is viable for paid media campaigns. Checks reachability, budget, pain-solution fit, and economic feasibility.

**AI Role:** "You are an expert ICP analyst. Validate whether this ICP is viable for paid media campaigns."

**Receives Context From:**
- Business context
- Section 1 summary: Primary Pain Points (first 3), Market Maturity, Buying Behavior

### Output Schema: ICPAnalysisValidation

| Field | Type | Description |
|-------|------|-------------|
| coherenceCheck.clearlyDefined | boolean | ICP is clearly defined |
| coherenceCheck.reachableThroughPaidChannels | boolean | Can reach via Meta/LinkedIn/Google |
| painSolutionFit.fitAssessment | enum | strong \| moderate \| weak |
| riskAssessment.* | enum | low \| medium \| high \| critical |
| finalVerdict.status | enum | validated \| workable \| invalid |
| finalVerdict.recommendations | string[] | 2-4 actionable recommendations |

### What This Section Accomplishes
- Validates ICP is reachable through paid channels
- Assesses pain-solution fit strength
- Identifies economic feasibility issues
- Provides go/no-go verdict for paid media

---

## Section 3: Offer Analysis & Viability

**Purpose:** Evaluate the offer's strength, clarity, and market fit for paid media campaigns. Scores offer components 1-10 and identifies red flags.

**AI Role:** "You are an expert offer analyst. Evaluate offer viability for paid media campaigns."

**Receives Context From:**
- Business context
- Section 2 summary: ICP Validation Status, Pain-Solution Fit Assessment, Primary Pain identified

### Output Schema: OfferAnalysisViability

| Field | Type | Description |
|-------|------|-------------|
| offerStrength.painRelevance | number | 1-10 score |
| offerStrength.urgency | number | 1-10 score |
| offerStrength.differentiation | number | 1-10 score |
| offerStrength.overallScore | number | Average of 6 scores |
| redFlags | enum[] | offer_too_vague \| overcrowded_market \| price_mismatch \| weak_or_no_proof \| no_funnel_built \| transformation_unclear |
| recommendation.status | enum | proceed \| adjust_messaging \| adjust_pricing \| icp_refinement_needed \| major_offer_rebuild |

### What This Section Accomplishes
- Quantifies offer strength with 1-10 scores
- Identifies specific red flags that could hurt campaigns
- Provides clear recommendation status
- Lists actionable items to improve offer

---

## Section 4: Competitor Analysis

**Purpose:** Research the competitor landscape including their offers, ad strategies, creative formats, and funnel patterns. Identifies gaps and opportunities.

**AI Role:** "You are an expert competitive analyst. Research the competitor landscape for paid media strategy."

**Receives Context From:** Business context only (competitor data is self-contained)

### Output Schema: CompetitorAnalysis

| Field | Type | Description |
|-------|------|-------------|
| competitors[].name | string | Competitor name |
| competitors[].positioning | string | How they position themselves |
| creativeLibrary.adHooks | string[] | 5-7 actual hook examples |
| funnelBreakdown.formFriction | enum | low \| medium \| high |
| gapsAndOpportunities.messagingOpportunities | string[] | 3-4 messaging gaps |

### What This Section Accomplishes
- Maps 3-5 competitors with detailed profiles
- Extracts actual ad hooks and creative patterns
- Identifies funnel patterns and form friction
- Surfaces gaps and opportunities to exploit

---

## Section 5: Cross-Analysis Synthesis

**Purpose:** Synthesize all previous analysis into actionable paid media strategy. Provides key insights, positioning, messaging angles, platform recommendations, and next steps.

**AI Role:** "You are a strategic analyst synthesizing all research into actionable paid media strategy."

**Receives Context From:**
- Business context
- ALL 4 previous sections summarized:
  - Section 1: Market Maturity, Buying Behavior, Awareness Level, Top Pain Points
  - Section 2: ICP Validation Status, Pain-Solution Fit, Risk Levels
  - Section 3: Offer Overall Score, Recommendation Status, Red Flags
  - Section 4: Competitors Analyzed, Market Strengths, Key Opportunities

### Output Schema: CrossAnalysisSynthesis

| Field | Type | Description |
|-------|------|-------------|
| keyInsights[].insight | string | The key finding |
| keyInsights[].source | enum | industryMarketOverview \| icpAnalysisValidation \| offerAnalysisViability \| competitorAnalysis |
| recommendedPositioning | string | 2-3 sentence positioning statement |
| primaryMessagingAngles | string[] | 3-5 testable messaging angles |
| recommendedPlatforms[].platform | enum | Meta \| LinkedIn \| Google \| YouTube \| TikTok |
| criticalSuccessFactors | string[] | 4-5 must-have elements |
| nextSteps | string[] | 4-5 prioritized actions |

### What This Section Accomplishes
- Synthesizes insights from all 4 previous sections
- Provides clear positioning recommendation
- Gives specific, testable messaging angles
- Recommends platforms with reasoning
- Lists critical success factors and blockers

---

## API Call Configuration

All sections use the same configuration:

| Setting | Value | Reason |
|---------|-------|--------|
| Model | Claude Sonnet | Best balance of quality and cost for structured output |
| Temperature | 0.3 | Low randomness = consistent JSON structure |
| Max Tokens | 4096 | Allows full section output without truncation |

---

## Error Handling

The generator handles errors gracefully:
- **Abort Signal** – User can cancel generation mid-process
- **Partial Output** – Returns completed sections even if later ones fail
- **Progress Callbacks** – Real-time updates on current section and errors
- **Cost Tracking** – Accumulates cost even on failure for billing accuracy

---

## Output Metadata

Every completed generation includes:

| Field | Type | Description |
|-------|------|-------------|
| generatedAt | string | ISO timestamp |
| version | string | Schema version ("1.0") |
| processingTime | number | Total milliseconds |
| totalCost | number | USD cost |
| modelsUsed | string[] | ["anthropic/claude-sonnet-4"] |
| overallConfidence | number | Fixed at 75 currently |

---

## Section Dependencies Summary

The following diagram shows how data flows between sections:

```
Section 1: Industry Market Overview
│ provides: painPoints, marketMaturity, buyingBehavior
▼
Section 2: ICP Analysis & Validation
│ provides: finalVerdict.status, painSolutionFit, riskAssessment
▼
Section 3: Offer Analysis & Viability
│ provides: offerStrength.overallScore, recommendation.status, redFlags
▼
Section 4: Competitor Analysis (standalone)
│ provides: competitors.length, marketStrengths, gapsAndOpportunities
▼
Section 5: Cross-Analysis Synthesis
│ receives: ALL of the above
▼
Final Strategic Blueprint
```
