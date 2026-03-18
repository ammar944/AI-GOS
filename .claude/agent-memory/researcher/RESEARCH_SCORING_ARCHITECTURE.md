---
name: Research Pipeline Scoring & Approval Flow
description: Complete map of how scoring works across research runners, context flows between sections, and the approval mechanism
type: reference
---

# Research Pipeline Scoring Architecture

## Offer Analysis Scoring (ONLY Section with Scores Today)

**File**: `research-worker/src/runners/offer.ts` (lines 24-121)

### Output Schema
Offer runner produces **structured JSON scoring** with 7 dimensions:
```json
{
  "offerStrength": {
    "overallScore": 1-10,
    "painRelevance": 1-10,
    "urgency": 1-10,
    "differentiation": 1-10,
    "tangibility": 1-10,
    "proof": 1-10,
    "pricingLogic": 1-10
  },
  "recommendation": {
    "status": "proceed | needs-work | adjust-messaging | adjust-pricing | icp-refinement-needed | major-offer-rebuild | do-not-launch",
    "summary": "string",
    "topStrengths": ["string — 2-3 items"],
    "priorityFixes": ["string — 2-3 items"],
    "recommendedActionPlan": ["string — 3 items max"]
  },
  "redFlags": [
    {
      "issue": "string",
      "severity": "high | medium | low",
      "priority": 1,
      "recommendedAction": "string",
      "launchBlocker": true | false,
      "evidence": "string"
    }
  ],
  "pricingAnalysis": { ... },
  "marketFitAssessment": "string",
  "messagingRecommendations": ["string — 3 items"],
  "citations": [{ "url": "string", "title": "string" }]
}
```

**Scoring Logic**:
- 6 dimensions scored 1-10 each based on competitive positioning, urgency signals, differentiation vs competitors
- Overall score = average of 6 dimensions
- Recommendation status is derived from combined dimension scores (no explicit thresholds shown)
- Red flags can be launch blockers

**Tools**: web_search (2 max), firecrawlExtract/firecrawl (1 max on client pricing page only)
**Context**: Uses persisted competitor + synthesis data instead of re-researching

### Card Rendering (card-taxonomy.ts lines 300-391)
Offer output renders to **6-7 distinct cards**:
1. **stat-grid** — Overall Score + Recommendation status (2 stats)
2. **prose-card** — Recommendation Rationale (summary)
3. **pricing-card** — Pricing Analysis (4 fields)
4. **bullet-list** — Strengths (green accent)
5. **bullet-list** — Weaknesses (red accent)
6. **bullet-list** — Recommended Actions (blue accent)
7. **bullet-list** — Messaging Recommendations (cyan accent)
8. **prose-card** — Market Fit Assessment
9. **flag-card** × N — One card per red flag (issue, severity, evidence, recommended action)

---

## Other Runners (NO Scoring — Verdict/Status Only)

| Runner | Output Type | Key Field | Values |
|--------|-------------|-----------|--------|
| **industry.ts** | categorySnapshot + marketDynamics | N/A | Market maturity enum: `early \| growing \| saturated` |
| **competitors.ts** | Competitor positioning + threat assessment | threatFactors.* | 1-10 scores for 5 threat dimensions (NOT recommendation scores) |
| **icp.ts** | ICP validation verdict | finalVerdict.status | `validated \| workable \| invalid` |
| **keywords.ts** | Keyword data grid | N/A | Raw keyword metrics (no scoring) |
| **cross-analysis.ts** | Strategy + insights + charts | N/A | Narrative + charts (no scoring) |

**Key difference**: Competitors runner has threat assessment (1-10 per dimension) but NOT a single "recommendation" status like offer does.

---

## Pipeline Order & Context Flow

**Sequential Pipeline** (pipeline.ts line 3-11):
```
industryMarket → competitors → icpValidation → offerAnalysis → keywordIntel → crossAnalysis → mediaPlan
```

### Context Propagation

1. **industryMarket** → Start with business context only
2. **competitors** → Reuses market research + brand context
3. **icpValidation** → Reuses competitor data (reviews, positioning)
4. **offerAnalysis** → Reuses competitors + ICP (marked in system prompt as "reuse persisted research instead of re-running")
5. **crossAnalysis** → Uses industry + competitors + ICP + offer results
6. **mediaPlan** → Uses ALL prior research results (injected as context in dispatch/route.ts lines 67-114)

**Context Assembly** (dispatch/route.ts lines 52-65):
- Frontend passes `context` (built from collected fields)
- Route stamps `activeJourneyRunId` to Supabase BEFORE worker starts
- For mediaPlan ONLY: route fetches all prior research_results and appends to context

**Frontend Builder** (workspace-page.tsx lines 146-187):
- `buildSectionContext()` collects from localStorage (session fields) + Supabase metadata
- Returns context string for dispatch

---

## Approval Flow (Card → Section → Next)

**Card-Level Approval** (artifact-card.tsx lines 153-161):
- User clicks green Check button on individual card
- Triggers `approveCard(cardId)` via useWorkspace
- Sets card.status = 'approved' (green border, visual feedback)
- Cards can be individually approved, edited, or reverted

**Section-Level Approval** (workspace-page.tsx line 219, provider line 127-164):
- `WorkspaceApprovalBridge` watches sectionStates for transitions from 'draft' → 'approved'
- When a section transitions to 'approved':
  - All cards in that section are marked approved
  - Next section phase set to 'researching' (unless it already has cards, then 'review')
  - `onSectionApproved(sectionKey)` callback fires
  - currentSection moves to next section in pipeline

**State Machine** (types + provider):
- Section phases: `queued → researching → streaming → review → approved → (next)`
- Card statuses: `draft → edited → approved`

**Critical Behavior** (provider lines 139-149):
- If next section already has results from parallel pre-fetch, skip 'researching' and jump to 'review'
- This allows pipelined research execution

---

## Where Score-Based Retry Loop Could Inject

**Today**: No score-based re-run exists. Approval is binary (approve all cards vs retry manually).

**Injection Points** (if implementing score → recommend → re-run loop):

1. **In offer.ts** (lines 24-121):
   - Read `recommendedActionPlan` and `redFlags`
   - If any `launchBlocker: true`, auto-flag as "needs-approval-before-dispatch"

2. **In workspace-page.tsx** (line 200-214):
   - `handleGenerateMediaPlan()` could check offerAnalysis recommendation status
   - If status is "do-not-launch" or "major-offer-rebuild", prompt user before allowing media plan generation

3. **New "Re-run Offer Analysis" Flow**:
   - Add button to offer section: "Re-run with feedback"
   - User selects which actions from `priorityFixes` were addressed
   - Dispatch offer analysis again with updated context

4. **In card-taxonomy.ts** (lines 300-391):
   - Could parse `recommendedActionPlan` into checklist cards
   - Mark cards incomplete/completed as user addresses each item
   - Only allow section approval once checklist complete

---

## Summary: Scoring State Today

| Section | Has Scores? | Score Format | Used For |
|---------|-------------|--------------|----------|
| Industry | ❌ No | Enum fields (maturity, awareness) | Classification only |
| Competitors | ❌ No (threat scores exist but not for recommendation) | 1-10 threat factors per competitor | Threat assessment, not actionability |
| ICP | ❌ No | `validated \| workable \| invalid` verdict | Gate for targeting |
| **Offer** | ✅ Yes | 7-dimension scores 1-10 + status enum | Launch decision + action plan |
| Keywords | ❌ No | Raw metrics | Informational |
| Cross-Analysis | ❌ No | Narrative + charts | Strategic synthesis |
| Media Plan | ❌ No | Budget/forecasts | Execution plan |

**Only offer analysis has actionable scoring + recommendation status today.**
