# Strategic Research Pipeline & AI Models

This document provides a comprehensive overview of how strategic research is generated, the AI models used throughout the application, and the complete pipeline architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [AI Models & Configuration](#ai-models--configuration)
3. [Strategic Research Pipeline](#strategic-research-pipeline)
4. [Data Structures](#data-structures)
5. [Component Architecture](#component-architecture)
6. [Cost Tracking](#cost-tracking)

---

## Overview

The AI-GOS application uses a **multi-model architecture** accessed through OpenRouter's unified API. The strategic research pipeline generates comprehensive business intelligence through web-augmented AI research, producing a 5-section strategic blueprint.

### Provider Configuration

| Setting | Value |
|---------|-------|
| Provider | OpenRouter (https://openrouter.ai/api/v1) |
| Auth | `OPENROUTER_API_KEY` environment variable |
| Client | `src/lib/openrouter/client.ts` |

---

## AI Models & Configuration

### Model Inventory

All models are defined in `src/lib/openrouter/client.ts`:

```typescript
export const MODELS = {
  // Google - Fast extraction and reasoning
  GEMINI_FLASH: "google/gemini-2.0-flash-001",
  GEMINI_25_FLASH: "google/gemini-2.5-flash",

  // OpenAI - Reasoning and logic
  GPT_4O: "openai/gpt-4o",
  O3_MINI: "openai/o3-mini",

  // Anthropic - Synthesis and writing
  CLAUDE_SONNET: "anthropic/claude-sonnet-4",
  CLAUDE_OPUS: "anthropic/claude-opus-4",

  // Perplexity - Web search and research
  PERPLEXITY_SONAR: "perplexity/sonar-pro",
  PERPLEXITY_DEEP_RESEARCH: "perplexity/sonar-deep-research",

  // Embeddings
  EMBEDDING: "openai/text-embedding-3-small",
}
```

### Model Capabilities

| Capability | Models |
|------------|--------|
| **Reasoning** | O3_MINI, GEMINI_25_FLASH, CLAUDE_OPUS, PERPLEXITY_DEEP_RESEARCH |
| **Web Search** | PERPLEXITY_SONAR, PERPLEXITY_DEEP_RESEARCH |
| **JSON Mode** | All except Perplexity models |
| **Embeddings** | text-embedding-3-small |

### Model Selection by Task

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Fast Extraction | `GEMINI_FLASH` | Lowest cost, fastest |
| Web Research | `PERPLEXITY_SONAR` | Real-time data + citations |
| Logic & Strategy | `GPT_4O` | Strong reasoning |
| Writing & Synthesis | `CLAUDE_SONNET` | Best prose quality |
| Intent Classification | `CLAUDE_SONNET` | Highest accuracy |
| Embeddings | `text-embedding-3-small` | Optimized for retrieval |

### Temperature Settings by Task

```
0.0  Intent classification (deterministic)
0.2  Edit operations (precision)
0.3  Q&A, Explanations, Extract (consistent)
0.5  Research stage (balanced)
0.7  Chat, default (natural)
```

### Pricing (Per 1M Tokens)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| GEMINI_FLASH | $0.075 | $0.30 | Fast extraction |
| GEMINI_25_FLASH | $0.30 | $2.50 | Fast reasoning |
| O3_MINI | $1.10 | $4.40 | Cost-efficient reasoning |
| GPT_4O | $2.50 | $10.00 | Logic & planning |
| CLAUDE_SONNET | $3.00 | $15.00 | Synthesis & chat |
| CLAUDE_OPUS | $15.00 | $75.00 | Complex reasoning |
| PERPLEXITY_SONAR | $3.00 | $15.00 | + $5/K searches |
| text-embedding-3-small | $0.02 | N/A | Embeddings |

---

## Strategic Research Pipeline

### API Endpoint

**POST `/api/strategic-blueprint/generate`**

```typescript
// Request
{ onboardingData: OnboardingFormData }

// Response
{
  success: boolean;
  strategicBlueprint: StrategicBlueprintOutput;
  metadata: { totalTime: number; totalCost: number; }
}
```

**Configuration:**
- Timeout: 300 seconds (Vercel Pro max)
- Max input: 5000 chars per field
- Error codes: TIMEOUT, RATE_LIMITED, VALIDATION_FAILED

### Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INPUT SANITIZATION                                        │
│    - Max 5000 chars per field                                │
│    - Filter prompt injection patterns                        │
│    - Remove special control characters                       │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BUILD BUSINESS CONTEXT                                    │
│    - Combine all onboarding data                             │
│    - Company info, ICP, product, market, brand, budget       │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SECTION GENERATION (Sequential)                           │
│                                                              │
│    Section 1: Industry Market (PERPLEXITY_SONAR)            │
│         ↓ (context passed to next)                          │
│    Section 2: ICP Analysis (PERPLEXITY_SONAR)               │
│         ↓ (context passed to next)                          │
│    Section 3: Offer Analysis (PERPLEXITY_SONAR)             │
│         ↓ (context passed to next)                          │
│    Section 4: Competitor Analysis (PERPLEXITY_SONAR)        │
│         ↓ (all sections as context)                         │
│    Section 5: Cross-Analysis Synthesis (CLAUDE_SONNET)      │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. COMPILE OUTPUT                                            │
│    - Combine 5 sections                                      │
│    - Aggregate citations by section                          │
│    - Calculate total cost & time                             │
│    - Generate metadata                                       │
└─────────────────────────────────────────────────────────────┘
```

### Research Modules

| Section | File | Model | Purpose |
|---------|------|-------|---------|
| Industry Market | `industry-market-research.ts` | PERPLEXITY_SONAR | Market trends, pain points, behaviors |
| ICP Analysis | `icp-research.ts` | PERPLEXITY_SONAR | Validate ICP against market signals |
| Offer Analysis | `offer-research.ts` | PERPLEXITY_SONAR | Analyze offer strength |
| Competitor Analysis | `competitor-research.ts` | PERPLEXITY_SONAR | Competitive landscape |
| Cross-Analysis | `strategic-blueprint-generator.ts` | CLAUDE_SONNET | Synthesize all research |

**Location:** `src/lib/strategic-blueprint/pipeline/`

### Research Agent

```typescript
// src/lib/research/agent.ts
class ResearchAgent {
  async research(options): ResearchResponse<string>
  async researchJSON<T>(options, schema): ResearchResponse<T>
  getCostSummary(): ResearchCostSummary
  resetCostTracking(): void
}
```

---

## Data Structures

### Core Output Type

**File:** `src/lib/strategic-blueprint/output-types.ts`

```typescript
interface StrategicBlueprintOutput {
  industryMarketOverview: IndustryMarketOverview;
  icpAnalysisValidation: ICPAnalysisValidation;
  offerAnalysisViability: OfferAnalysisViability;
  competitorAnalysis: CompetitorAnalysis;
  crossAnalysisSynthesis: CrossAnalysisSynthesis;
  metadata: StrategicBlueprintMetadata;
}
```

### Section 1: Industry & Market Overview

```typescript
interface IndustryMarketOverview {
  categorySnapshot: {
    category: string;
    marketMaturity: "early" | "growing" | "saturated";
    awarenessLevel: "low" | "medium" | "high";
    buyingBehavior: "impulsive" | "committee_driven" | "roi_based" | "mixed";
    averageSalesCycle: string;
    seasonality: string;
  };
  marketDynamics: {
    demandDrivers: string[];
    buyingTriggers: string[];
    barriersToPurchase: string[];
    macroRisks: { ... };
  };
  painPoints: { primary: string[]; secondary: string[] };
  psychologicalDrivers: { drivers: { driver: string; description: string }[] };
  audienceObjections: { objections: { objection: string; howToAddress: string }[] };
  messagingOpportunities: { opportunities: string[]; summaryRecommendations: string[] };
}
```

### Section 2: ICP Analysis & Validation

```typescript
interface ICPAnalysisValidation {
  coherenceCheck: { /* 5 boolean fields */ };
  painSolutionFit: {
    primaryPain: string;
    offerComponentSolvingIt: string;
    fitAssessment: "strong" | "moderate" | "weak";
    notes: string;
  };
  marketReachability: { /* boolean fields + contradicting signals */ };
  economicFeasibility: { /* boolean fields + notes */ };
  riskAssessment: {
    reachability: "low" | "medium" | "high" | "critical";
    budget: "low" | "medium" | "high" | "critical";
    painStrength: "low" | "medium" | "high" | "critical";
    competitiveness: "low" | "medium" | "high" | "critical";
  };
  finalVerdict: {
    status: "validated" | "workable" | "invalid";
    reasoning: string;
    recommendations: string[];
  };
}
```

### Section 3: Offer Analysis & Viability

```typescript
interface OfferAnalysisViability {
  offerClarity: { /* 5 boolean fields */ };
  offerStrength: {
    painRelevance: number;     // 1-10
    urgency: number;
    differentiation: number;
    tangibility: number;
    proof: number;
    pricingLogic: number;
    overallScore: number;
  };
  marketOfferFit: { /* 5 boolean fields */ };
  redFlags: ("offer_too_vague" | "overcrowded_market" | ...)[];
  recommendation: {
    status: "proceed" | "adjust_messaging" | "adjust_pricing" | ...;
    reasoning: string;
    actionItems: string[];
  };
}
```

### Section 4: Competitor Analysis

```typescript
interface CompetitorAnalysis {
  competitors: {
    name: string;
    positioning: string;
    offer: string;
    price: string;
    adPlatforms: string[];
    funnels: string;
    strengths: string[];
    weaknesses: string[];
  }[];
  creativeLibrary: { adHooks: string[]; /* format booleans */ };
  funnelBreakdown: { /* patterns, structures, methods */ };
  marketStrengths: string[];
  marketWeaknesses: string[];
  gapsAndOpportunities: {
    messagingOpportunities: string[];
    creativeOpportunities: string[];
    funnelOpportunities: string[];
  };
}
```

### Section 5: Cross-Analysis Synthesis

```typescript
interface CrossAnalysisSynthesis {
  keyInsights: {
    insight: string;
    source: string;
    implication: string;
    priority: "high" | "medium" | "low";
  }[];
  recommendedPositioning: string;
  primaryMessagingAngles: string[];
  recommendedPlatforms: {
    platform: string;
    reasoning: string;
    priority: "primary" | "secondary" | "testing";
  }[];
  criticalSuccessFactors: string[];
  potentialBlockers: string[];
  nextSteps: string[];
}
```

### Metadata & Citations

```typescript
interface StrategicBlueprintMetadata {
  generatedAt: string;
  version: string;
  processingTime: number;
  totalCost: number;
  modelsUsed: string[];
  overallConfidence: number;
  sectionCitations?: Record<string, Citation[]>;
}

interface Citation {
  url: string;
  title?: string;
  date?: string;
  snippet?: string;
}
```

---

## Component Architecture

### Display Components

**Location:** `src/components/strategic-research/`

| Component | Purpose |
|-----------|---------|
| `StrategicResearchReview` | Main review/approval interface |
| `SectionCard` | Individual section wrapper with metadata |
| `SectionContentRenderer` | Routes to section-specific content |
| `IndustryMarketContent` | Section 1 renderer |
| `ICPAnalysisContent` | Section 2 renderer |
| `OfferAnalysisContent` | Section 3 renderer |
| `CompetitorAnalysisContent` | Section 4 renderer |
| `CrossAnalysisContent` | Section 5 renderer |
| `CitationBadge` | Shows citation count |
| `SourcesList` | Collapsible source list |
| `SourcedText` | Text with source indicators |
| `EditableText` | Click-to-edit text |
| `EditableList` | Editable list items |

### Review Workflow

```typescript
// State management in review.tsx
const [editingSection, setEditingSection] = useState<StrategicBlueprintSection | null>(null);
const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, unknown>>>({});
const [editHistory, setEditHistory] = useState<...[]>([]);  // Undo
const [futureEdits, setFutureEdits] = useState<...[]>([]);  // Redo
```

### Approval Workflow

**File:** `src/lib/strategic-blueprint/approval.ts`

```typescript
function createApprovedBlueprint(original, pendingEdits): StrategicBlueprintOutput {
  // Deep clone original
  // Apply each pending edit using setFieldAtPath
  // Add approvalMetadata
  return approved;
}
```

---

## Cost Tracking

### Calculation

```typescript
// API cost from model pricing
const apiCost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;

// Citation cost for web search models
const citationCost = (ESTIMATED_CITATION_TOKENS * citationCount / 1_000_000) * 2.0;

// Total
const totalCost = apiCost + citationCost;
```

### Tracking

- Per-call tracking via ResearchAgent
- Cumulative tracking via `getCostSummary()`
- Breakdown by model: `byModel` dictionary
- Displayed in UI review header

---

## File Reference

| Component | Location |
|-----------|----------|
| Model definitions | `src/lib/openrouter/client.ts` |
| Environment config | `src/lib/env.ts` |
| Research agent | `src/lib/research/agent.ts` |
| Pipeline modules | `src/lib/strategic-blueprint/pipeline/` |
| Output types | `src/lib/strategic-blueprint/output-types.ts` |
| Approval logic | `src/lib/strategic-blueprint/approval.ts` |
| UI components | `src/components/strategic-research/` |
| API endpoint | `src/app/api/strategic-blueprint/generate/route.ts` |
| Page integration | `src/app/generate/page.tsx` |
