# Blueprint AI Chat
## RAG-Powered Conversational Interface Specification
### Version 1.1 - OpenRouter Compatible

---

## Executive Summary

The Blueprint AI Chat is a conversational interface that allows users to interact with their generated Strategic Blueprints. Using Retrieval-Augmented Generation (RAG), users can ask questions about the blueprint, request explanations, make edits through natural language, and regenerate specific sections with custom instructions.

**This specification is fully compatible with OpenRouter's unified API**, using a single SDK and API key for all LLM and embedding operations.

---

## Core Capabilities

| Capability | Description | Example User Input |
|------------|-------------|-------------------|
| **Q&A Mode** | Answer questions about blueprint content | "What competitors did you find?" |
| **Edit Mode** | Modify specific fields through conversation | "Change the positioning to focus on speed" |
| **Explain Mode** | Explain reasoning behind conclusions | "Why is my offer score only 6/10?" |
| **Regenerate Mode** | Redo sections with new instructions | "Redo competitor analysis with these 3 competitors" |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BLUEPRINT AI CHAT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   User Chat  │───▶│Intent Router │───▶│  Dispatcher  │       │
│  │   Interface  │    │   (Claude)   │    │              │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│                                                  │               │
│         ┌────────────────┬───────────────┬──────┴────────┐      │
│         ▼                ▼               ▼               ▼      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Q&A Agent │  │Edit Agent  │  │  Explain   │  │Regenerate │  │
│  │            │  │            │  │   Agent    │  │  Agent    │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │               │               │               │        │
│        └───────────────┴───────────────┴───────────────┘        │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │   RAG Context Layer   │                    │
│                    │  (Blueprint Chunks)   │                    │
│                    └───────────┬───────────┘                    │
│                                │                                 │
│         ┌──────────────────────┼──────────────────────┐         │
│         ▼                      ▼                      ▼         │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐    │
│  │  Supabase   │      │   Blueprint  │      │   Version    │    │
│  │  pgvector   │      │    Store     │      │   History    │    │
│  └─────────────┘      └──────────────┘      └──────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    OPENROUTER API                        │    │
│  │   Single SDK • Unified Billing • All Models Available   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## OpenRouter Configuration

### Single Client Setup

All LLM calls (chat completions AND embeddings) go through OpenRouter using the OpenAI SDK.

```typescript
// lib/openrouter.ts
import OpenAI from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'AI-GOS Blueprint Chat',
  },
});
```

### Model Configuration

```typescript
// lib/models.ts
export const MODELS = {
  // ============================================
  // Chat/Completion Models
  // ============================================
  
  // Intent Classification - Fast, cheap
  INTENT_CLASSIFIER: 'anthropic/claude-haiku-4',
  
  // Q&A Agent - Balanced quality/cost
  QA_AGENT: 'anthropic/claude-sonnet-4',
  
  // Edit Agent - Needs precision for JSON output
  EDIT_AGENT: 'anthropic/claude-sonnet-4',
  
  // Explain Agent - Needs depth for explanations
  EXPLAIN_AGENT: 'anthropic/claude-sonnet-4',
  
  // Regenerate Agent - Match original pipeline quality
  REGENERATE_AGENT: 'anthropic/claude-sonnet-4',
  
  // ============================================
  // Embedding Models
  // ============================================
  
  // Primary - Good balance of quality/cost, 1536 dimensions
  EMBEDDING: 'openai/text-embedding-3-small',
  
  // Alternative options:
  // 'openai/text-embedding-3-large'    - Higher quality, 3072 dims
  // 'google/gemini-embedding-001'      - Top MTEB scores, 768 dims
  // 'qwen/qwen3-embedding-8b'          - Long context, 4096 dims
  
} as const;

// Pricing per million tokens (for cost tracking)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-haiku-4': { input: 0.25, output: 1.25 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-opus-4.5': { input: 5, output: 25 },
  'openai/text-embedding-3-small': { input: 0.02, output: 0 },
  'openai/text-embedding-3-large': { input: 0.13, output: 0 },
  'google/gemini-embedding-001': { input: 0.01, output: 0 },
};
```

### Available Embedding Models on OpenRouter

| Model ID | Dimensions | Pricing/M tokens | Best For |
|----------|------------|------------------|----------|
| `openai/text-embedding-3-small` | 1536 | $0.02 | Cost-effective RAG ✓ |
| `openai/text-embedding-3-large` | 3072 | $0.13 | Higher accuracy |
| `google/gemini-embedding-001` | 768 | ~$0.01 | Multilingual, top MTEB |
| `qwen/qwen3-embedding-8b` | 4096 | Low | Long context |
| `mistralai/mistral-embed-2312` | 1024 | Low | Semantic search |

**Recommendation:** Use `openai/text-embedding-3-small` - good balance of quality/cost, 1536 dims works well with pgvector.

---

## Data Flow

```
User Message
     │
     ▼
┌─────────────────┐
│ Intent Router   │ ──▶ Classify: question | edit | explain | regenerate | general
│ (Claude Haiku)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RAG Retrieval   │ ──▶ Generate embedding → Query pgvector → Get relevant chunks
│ (text-embed-3)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Dispatch  │ ──▶ Route to appropriate agent based on intent
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Process   │ ──▶ Generate response with context
│ (Claude Sonnet) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response/Action │ ──▶ Return answer OR request confirmation for edits
└─────────────────┘
```

---

## Component Specifications

### 1. Intent Router

**Purpose:** Classify user messages into actionable intents.

**Model:** `anthropic/claude-haiku-4` (via OpenRouter)

#### Intent Types

```typescript
type ChatIntent = 
  | { 
      type: 'question'; 
      topic: string;
      sections: string[];
    }
  | { 
      type: 'edit'; 
      section: string;
      field: string;
      desiredChange: string;
    }
  | { 
      type: 'explain'; 
      section: string;
      field: string;
      whatToExplain: string;
    }
  | { 
      type: 'regenerate'; 
      section: string;
      instructions: string;
    }
  | { 
      type: 'general';
      topic: string;
    };
```

#### Intent Router Implementation

```typescript
// lib/services/intent-router.ts
import { openrouter, MODELS } from '../openrouter';

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a Strategic Blueprint document system.

The blueprint has 5 sections:
1. industryMarketOverview - Market landscape, pain points, psychological drivers
2. icpAnalysisValidation - ICP viability, reachability, pain-solution fit
3. offerAnalysisViability - Offer strength scores, red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns
5. crossAnalysisSynthesis - Key insights, positioning, messaging angles, next steps

Classify the user's message into one of these intents:
- question: User wants information from the blueprint
- edit: User wants to change/modify something in the blueprint
- explain: User wants to understand WHY something is the way it is
- regenerate: User wants to redo/recreate a section with new instructions
- general: General conversation, greetings, or unclear intent

Return JSON only:
{
  "type": "question|edit|explain|regenerate|general",
  "section": "section name if applicable or null",
  "field": "specific field if applicable or null",
  "topic": "what they're asking about",
  "desiredChange": "for edits, what they want changed or null",
  "instructions": "for regenerate, special instructions or null"
}`;

export async function classifyIntent(message: string): Promise<ChatIntent> {
  const response = await openrouter.chat.completions.create({
    model: MODELS.INTENT_CLASSIFIER,
    max_tokens: 256,
    temperature: 0,
    messages: [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      { role: 'user', content: message }
    ],
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{}');
  
  return {
    type: parsed.type || 'general',
    ...parsed
  };
}
```

#### Intent Classification Examples

| User Message | Classified Intent |
|--------------|-------------------|
| "What competitors did you analyze?" | `{ type: 'question', topic: 'competitors', sections: ['competitorAnalysis'] }` |
| "Change the positioning to focus more on ROI" | `{ type: 'edit', section: 'crossAnalysisSynthesis', field: 'recommendedPositioning', desiredChange: 'focus more on ROI' }` |
| "Why did you give my offer a 6/10?" | `{ type: 'explain', section: 'offerAnalysisViability', field: 'offerStrength.overallScore' }` |
| "Redo the competitor section but only analyze Salesforce and HubSpot" | `{ type: 'regenerate', section: 'competitorAnalysis', instructions: 'only analyze Salesforce and HubSpot' }` |
| "Hello!" | `{ type: 'general', topic: 'greeting' }` |

---

### 2. Document Chunking Strategy

**Purpose:** Split the blueprint into searchable chunks for RAG retrieval.

#### Chunk Schema

```typescript
interface BlueprintChunk {
  id: string;                    // UUID
  blueprintId: string;           // Parent blueprint UUID
  section: BlueprintSection;     // Which section this belongs to
  fieldPath: string;             // JSON path (e.g., "painPoints.primary[0]")
  content: string;               // The actual text content
  contentType: 'array' | 'object' | 'string' | 'number' | 'enum';
  embedding: number[];           // 1536-dim vector (text-embedding-3-small)
  metadata: {
    sectionTitle: string;        // Human-readable section name
    fieldDescription: string;    // What this field represents
    isEditable: boolean;         // Can this be edited via chat?
    originalValue: any;          // For tracking changes
  };
  createdAt: Date;
  updatedAt: Date;
}

type BlueprintSection = 
  | 'industryMarketOverview'
  | 'icpAnalysisValidation'
  | 'offerAnalysisViability'
  | 'competitorAnalysis'
  | 'crossAnalysisSynthesis';
```

#### Chunking Rules

| Section | Chunking Strategy | Reason |
|---------|-------------------|--------|
| **industryMarketOverview** | Chunk each pain point, driver, and opportunity individually | Precise retrieval for specific topics |
| **icpAnalysisValidation** | Chunk coherenceCheck, painSolutionFit, riskAssessment, finalVerdict separately | Distinct validation aspects |
| **offerAnalysisViability** | Chunk each score individually + redFlags as array + recommendation | Allows targeted questions about scores |
| **competitorAnalysis** | Chunk each competitor as one unit | Competitors are self-contained entities |
| **crossAnalysisSynthesis** | Chunk keyInsights individually, positioning as one, messaging angles as array | Mix of specific and holistic data |

#### Chunking Implementation

```typescript
// lib/services/chunking.ts
import { openrouter, MODELS } from '../openrouter';
import { StrategicBlueprintOutput } from '../types';

interface ChunkInput {
  blueprintId: string;
  section: string;
  fieldPath: string;
  content: string;
  contentType: string;
  metadata: Record<string, any>;
}

export async function chunkBlueprint(
  blueprint: StrategicBlueprintOutput
): Promise<ChunkInput[]> {
  const chunks: ChunkInput[] = [];
  const blueprintId = blueprint.id;

  // ============================================
  // SECTION 1: Industry Market Overview
  // ============================================
  
  // Category Snapshot (single chunk)
  chunks.push({
    blueprintId,
    section: 'industryMarketOverview',
    fieldPath: 'categorySnapshot',
    content: `Market Category: ${blueprint.industryMarketOverview.categorySnapshot.category}
Market Maturity: ${blueprint.industryMarketOverview.categorySnapshot.marketMaturity}
Awareness Level: ${blueprint.industryMarketOverview.categorySnapshot.awarenessLevel}
Buying Behavior: ${blueprint.industryMarketOverview.categorySnapshot.buyingBehavior}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'Industry Market Overview',
      fieldDescription: 'Market category snapshot and characteristics',
      isEditable: true,
      originalValue: blueprint.industryMarketOverview.categorySnapshot
    }
  });

  // Each Pain Point (individual chunks)
  blueprint.industryMarketOverview.painPoints.primary.forEach((pain, index) => {
    chunks.push({
      blueprintId,
      section: 'industryMarketOverview',
      fieldPath: `painPoints.primary[${index}]`,
      content: `Pain Point ${index + 1}: ${pain}`,
      contentType: 'string',
      metadata: {
        sectionTitle: 'Industry Market Overview',
        fieldDescription: 'Primary pain point identified in market research',
        isEditable: true,
        originalValue: pain
      }
    });
  });

  // Psychological Drivers (individual chunks)
  blueprint.industryMarketOverview.psychologicalDrivers.drivers.forEach((driver, index) => {
    chunks.push({
      blueprintId,
      section: 'industryMarketOverview',
      fieldPath: `psychologicalDrivers.drivers[${index}]`,
      content: `Psychological Driver: ${driver.driver} - ${driver.description}`,
      contentType: 'object',
      metadata: {
        sectionTitle: 'Industry Market Overview',
        fieldDescription: 'Emotional/psychological buying driver',
        isEditable: true,
        originalValue: driver
      }
    });
  });

  // Messaging Opportunities (as array)
  chunks.push({
    blueprintId,
    section: 'industryMarketOverview',
    fieldPath: 'messagingOpportunities.opportunities',
    content: `Messaging Opportunities:\n${blueprint.industryMarketOverview.messagingOpportunities.opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Industry Market Overview',
      fieldDescription: 'Identified messaging angles and opportunities',
      isEditable: true,
      originalValue: blueprint.industryMarketOverview.messagingOpportunities.opportunities
    }
  });

  // ============================================
  // SECTION 2: ICP Analysis & Validation
  // ============================================

  // Coherence Check
  chunks.push({
    blueprintId,
    section: 'icpAnalysisValidation',
    fieldPath: 'coherenceCheck',
    content: `ICP Coherence Check:
- Clearly Defined: ${blueprint.icpAnalysisValidation.coherenceCheck.clearlyDefined}
- Reachable Through Paid Channels: ${blueprint.icpAnalysisValidation.coherenceCheck.reachableThroughPaidChannels}
- Notes: ${blueprint.icpAnalysisValidation.coherenceCheck.notes || 'None'}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'ICP Analysis & Validation',
      fieldDescription: 'ICP definition and reachability assessment',
      isEditable: false,
      originalValue: blueprint.icpAnalysisValidation.coherenceCheck
    }
  });

  // Pain-Solution Fit
  chunks.push({
    blueprintId,
    section: 'icpAnalysisValidation',
    fieldPath: 'painSolutionFit',
    content: `Pain-Solution Fit Assessment: ${blueprint.icpAnalysisValidation.painSolutionFit.fitAssessment}
Primary Pain Addressed: ${blueprint.icpAnalysisValidation.painSolutionFit.primaryPainAddressed}
Explanation: ${blueprint.icpAnalysisValidation.painSolutionFit.explanation}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'ICP Analysis & Validation',
      fieldDescription: 'How well the solution addresses ICP pain points',
      isEditable: false,
      originalValue: blueprint.icpAnalysisValidation.painSolutionFit
    }
  });

  // Final Verdict
  chunks.push({
    blueprintId,
    section: 'icpAnalysisValidation',
    fieldPath: 'finalVerdict',
    content: `ICP Validation Verdict: ${blueprint.icpAnalysisValidation.finalVerdict.status}
Summary: ${blueprint.icpAnalysisValidation.finalVerdict.summary}
Recommendations: ${blueprint.icpAnalysisValidation.finalVerdict.recommendations.join('; ')}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'ICP Analysis & Validation',
      fieldDescription: 'Final verdict on ICP viability for paid media',
      isEditable: false,
      originalValue: blueprint.icpAnalysisValidation.finalVerdict
    }
  });

  // ============================================
  // SECTION 3: Offer Analysis & Viability
  // ============================================

  // Offer Strength Scores (individual for precise Q&A)
  const offerStrength = blueprint.offerAnalysisViability.offerStrength;
  const scoreFields = ['painRelevance', 'urgency', 'differentiation', 'clarity', 'proofStrength', 'pricingAlignment'];
  
  scoreFields.forEach(field => {
    if (offerStrength[field] !== undefined) {
      chunks.push({
        blueprintId,
        section: 'offerAnalysisViability',
        fieldPath: `offerStrength.${field}`,
        content: `Offer ${field.replace(/([A-Z])/g, ' $1').trim()} Score: ${offerStrength[field]}/10`,
        contentType: 'number',
        metadata: {
          sectionTitle: 'Offer Analysis & Viability',
          fieldDescription: `Score for offer ${field}`,
          isEditable: false,
          originalValue: offerStrength[field]
        }
      });
    }
  });

  // Overall Score
  chunks.push({
    blueprintId,
    section: 'offerAnalysisViability',
    fieldPath: 'offerStrength.overallScore',
    content: `Overall Offer Score: ${offerStrength.overallScore}/10`,
    contentType: 'number',
    metadata: {
      sectionTitle: 'Offer Analysis & Viability',
      fieldDescription: 'Average of all offer strength scores',
      isEditable: false,
      originalValue: offerStrength.overallScore
    }
  });

  // Red Flags
  chunks.push({
    blueprintId,
    section: 'offerAnalysisViability',
    fieldPath: 'redFlags',
    content: `Offer Red Flags: ${blueprint.offerAnalysisViability.redFlags.length > 0 
      ? blueprint.offerAnalysisViability.redFlags.join(', ') 
      : 'None identified'}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Offer Analysis & Viability',
      fieldDescription: 'Identified issues that could hurt campaign performance',
      isEditable: false,
      originalValue: blueprint.offerAnalysisViability.redFlags
    }
  });

  // Recommendation
  chunks.push({
    blueprintId,
    section: 'offerAnalysisViability',
    fieldPath: 'recommendation',
    content: `Offer Recommendation: ${blueprint.offerAnalysisViability.recommendation.status}
Reasoning: ${blueprint.offerAnalysisViability.recommendation.reasoning}
Action Items: ${blueprint.offerAnalysisViability.recommendation.actionItems?.join('; ') || 'None'}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'Offer Analysis & Viability',
      fieldDescription: 'Recommendation for proceeding with the offer',
      isEditable: false,
      originalValue: blueprint.offerAnalysisViability.recommendation
    }
  });

  // ============================================
  // SECTION 4: Competitor Analysis
  // ============================================

  // Each Competitor (self-contained chunks)
  blueprint.competitorAnalysis.competitors.forEach((competitor, index) => {
    chunks.push({
      blueprintId,
      section: 'competitorAnalysis',
      fieldPath: `competitors[${index}]`,
      content: `Competitor ${index + 1}: ${competitor.name}
Positioning: ${competitor.positioning}
Strengths: ${competitor.strengths?.join(', ') || 'Not specified'}
Weaknesses: ${competitor.weaknesses?.join(', ') || 'Not specified'}
Pricing: ${competitor.pricing || 'Unknown'}
Key Differentiator: ${competitor.keyDifferentiator || 'Not specified'}`,
      contentType: 'object',
      metadata: {
        sectionTitle: 'Competitor Analysis',
        fieldDescription: `Analysis of competitor: ${competitor.name}`,
        isEditable: true,
        originalValue: competitor
      }
    });
  });

  // Ad Hooks
  chunks.push({
    blueprintId,
    section: 'competitorAnalysis',
    fieldPath: 'creativeLibrary.adHooks',
    content: `Competitor Ad Hooks:\n${blueprint.competitorAnalysis.creativeLibrary.adHooks.map((hook, i) => `${i + 1}. "${hook}"`).join('\n')}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Competitor Analysis',
      fieldDescription: 'Ad hooks used by competitors',
      isEditable: true,
      originalValue: blueprint.competitorAnalysis.creativeLibrary.adHooks
    }
  });

  // Gaps and Opportunities
  chunks.push({
    blueprintId,
    section: 'competitorAnalysis',
    fieldPath: 'gapsAndOpportunities',
    content: `Market Gaps: ${blueprint.competitorAnalysis.gapsAndOpportunities.marketGaps?.join('; ') || 'None identified'}
Messaging Opportunities: ${blueprint.competitorAnalysis.gapsAndOpportunities.messagingOpportunities?.join('; ') || 'None identified'}
Positioning Opportunities: ${blueprint.competitorAnalysis.gapsAndOpportunities.positioningOpportunities?.join('; ') || 'None identified'}`,
    contentType: 'object',
    metadata: {
      sectionTitle: 'Competitor Analysis',
      fieldDescription: 'Identified gaps and opportunities in competitive landscape',
      isEditable: true,
      originalValue: blueprint.competitorAnalysis.gapsAndOpportunities
    }
  });

  // ============================================
  // SECTION 5: Cross-Analysis Synthesis
  // ============================================

  // Key Insights (individual)
  blueprint.crossAnalysisSynthesis.keyInsights.forEach((insight, index) => {
    chunks.push({
      blueprintId,
      section: 'crossAnalysisSynthesis',
      fieldPath: `keyInsights[${index}]`,
      content: `Key Insight ${index + 1}: ${insight.insight}
Source: ${insight.source}
Implication: ${insight.implication || 'Not specified'}`,
      contentType: 'object',
      metadata: {
        sectionTitle: 'Cross-Analysis Synthesis',
        fieldDescription: 'Strategic insight derived from analysis',
        isEditable: true,
        originalValue: insight
      }
    });
  });

  // Recommended Positioning
  chunks.push({
    blueprintId,
    section: 'crossAnalysisSynthesis',
    fieldPath: 'recommendedPositioning',
    content: `Recommended Positioning: ${blueprint.crossAnalysisSynthesis.recommendedPositioning}`,
    contentType: 'string',
    metadata: {
      sectionTitle: 'Cross-Analysis Synthesis',
      fieldDescription: 'Strategic positioning recommendation',
      isEditable: true,
      originalValue: blueprint.crossAnalysisSynthesis.recommendedPositioning
    }
  });

  // Messaging Angles
  chunks.push({
    blueprintId,
    section: 'crossAnalysisSynthesis',
    fieldPath: 'primaryMessagingAngles',
    content: `Primary Messaging Angles:\n${blueprint.crossAnalysisSynthesis.primaryMessagingAngles.map((angle, i) => `${i + 1}. ${angle}`).join('\n')}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Cross-Analysis Synthesis',
      fieldDescription: 'Recommended messaging angles for campaigns',
      isEditable: true,
      originalValue: blueprint.crossAnalysisSynthesis.primaryMessagingAngles
    }
  });

  // Platform Recommendations
  chunks.push({
    blueprintId,
    section: 'crossAnalysisSynthesis',
    fieldPath: 'recommendedPlatforms',
    content: `Recommended Platforms:\n${blueprint.crossAnalysisSynthesis.recommendedPlatforms.map(p => `- ${p.platform}: ${p.reasoning}`).join('\n')}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Cross-Analysis Synthesis',
      fieldDescription: 'Recommended advertising platforms with reasoning',
      isEditable: true,
      originalValue: blueprint.crossAnalysisSynthesis.recommendedPlatforms
    }
  });

  // Next Steps
  chunks.push({
    blueprintId,
    section: 'crossAnalysisSynthesis',
    fieldPath: 'nextSteps',
    content: `Next Steps:\n${blueprint.crossAnalysisSynthesis.nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    contentType: 'array',
    metadata: {
      sectionTitle: 'Cross-Analysis Synthesis',
      fieldDescription: 'Prioritized action items',
      isEditable: true,
      originalValue: blueprint.crossAnalysisSynthesis.nextSteps
    }
  });

  return chunks;
}
```

---

### 3. Embedding Generation

**Purpose:** Convert text chunks into vector embeddings for similarity search.

**Model:** `openai/text-embedding-3-small` (via OpenRouter)

```typescript
// lib/services/embeddings.ts
import { openrouter, MODELS } from '../openrouter';

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openrouter.embeddings.create({
    model: MODELS.EMBEDDING,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than individual calls
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // OpenRouter supports batch embedding
  const response = await openrouter.embeddings.create({
    model: MODELS.EMBEDDING,
    input: texts,
  });

  // Return in same order as input
  return response.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}

/**
 * Store chunks with embeddings in Supabase
 */
export async function storeChunksWithEmbeddings(
  chunks: ChunkInput[],
  supabase: SupabaseClient
): Promise<void> {
  // Generate all embeddings in batch
  const contents = chunks.map(c => c.content);
  const embeddings = await generateEmbeddings(contents);

  // Prepare rows for insert
  const rows = chunks.map((chunk, index) => ({
    blueprint_id: chunk.blueprintId,
    section: chunk.section,
    field_path: chunk.fieldPath,
    content: chunk.content,
    content_type: chunk.contentType,
    embedding: embeddings[index],
    metadata: chunk.metadata,
  }));

  // Batch insert
  const { error } = await supabase
    .from('blueprint_chunks')
    .insert(rows);

  if (error) {
    throw new Error(`Failed to store chunks: ${error.message}`);
  }
}
```

---

### 4. RAG Retrieval Pipeline

**Purpose:** Find relevant blueprint chunks to answer user queries.

```typescript
// lib/services/retrieval.ts
import { openrouter, MODELS } from '../openrouter';
import { supabase } from '../supabase';

interface RAGContext {
  relevantChunks: BlueprintChunk[];
  fullSection?: any;
  chatHistory: ChatMessage[];
  userQuery: string;
  intent: ChatIntent;
}

interface RetrievalOptions {
  blueprintId: string;
  query: string;
  intent: ChatIntent;
  matchThreshold?: number;
  matchCount?: number;
  includeHistory?: boolean;
  historyLimit?: number;
}

export async function retrieveContext(options: RetrievalOptions): Promise<RAGContext> {
  const {
    blueprintId,
    query,
    intent,
    matchThreshold = 0.7,
    matchCount = 5,
    includeHistory = true,
    historyLimit = 10
  } = options;

  // 1. Generate query embedding via OpenRouter
  const response = await openrouter.embeddings.create({
    model: MODELS.EMBEDDING,
    input: query,
  });
  const queryEmbedding = response.data[0].embedding;

  // 2. Vector similarity search in Supabase
  const { data: relevantChunks, error } = await supabase.rpc('match_blueprint_chunks', {
    query_embedding: queryEmbedding,
    p_blueprint_id: blueprintId,
    match_threshold: matchThreshold,
    match_count: matchCount,
    section_filter: intent.section || null
  });

  if (error) {
    console.error('RAG retrieval error:', error);
    throw new Error('Failed to retrieve context');
  }

  // 3. For edit/regenerate intents, fetch full section
  let fullSection = null;
  if ((intent.type === 'edit' || intent.type === 'regenerate') && intent.section) {
    fullSection = await fetchFullSection(blueprintId, intent.section);
  }

  // 4. Get chat history for context continuity
  let chatHistory: ChatMessage[] = [];
  if (includeHistory) {
    chatHistory = await getChatHistory(blueprintId, historyLimit);
  }

  return {
    relevantChunks: relevantChunks || [],
    fullSection,
    chatHistory,
    userQuery: query,
    intent
  };
}

async function fetchFullSection(blueprintId: string, section: string): Promise<any> {
  const { data: blueprint } = await supabase
    .from('blueprints')
    .select('output')
    .eq('id', blueprintId)
    .single();

  return blueprint?.output?.[section] || null;
}

async function getChatHistory(blueprintId: string, limit: number): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('blueprint_chat_messages')
    .select('*')
    .eq('blueprint_id', blueprintId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).reverse();
}
```

---

### 5. Agent Implementations

All agents use OpenRouter with the OpenAI SDK pattern.

#### Q&A Agent

**Purpose:** Answer questions about the blueprint using retrieved context.

**Model:** `anthropic/claude-sonnet-4` (via OpenRouter)

```typescript
// lib/services/agents/qa-agent.ts
import { openrouter, MODELS, MODEL_PRICING } from '../../openrouter';

interface QAResponse {
  answer: string;
  sources: BlueprintChunk[];
  confidence: 'high' | 'medium' | 'low';
  tokensUsed: number;
  cost: number;
}

const QA_SYSTEM_PROMPT = `You are an expert assistant for Strategic Blueprint documents.
Your role is to answer questions about the blueprint accurately and helpfully.

RULES:
1. Answer using ONLY the provided context - do not make up information
2. If the answer isn't in the context, clearly say "I don't have that information in the blueprint"
3. Be specific and reference actual data from the blueprint
4. If multiple chunks are relevant, synthesize them into a coherent answer
5. Keep answers concise but complete

CONTEXT SECTIONS:
- industryMarketOverview: Market landscape, pain points, psychological drivers
- icpAnalysisValidation: ICP viability and validation
- offerAnalysisViability: Offer strength scores and recommendations
- competitorAnalysis: Competitor profiles and gaps
- crossAnalysisSynthesis: Strategic recommendations and next steps`;

export async function handleQuestion(context: RAGContext): Promise<QAResponse> {
  const userPrompt = `## Blueprint Context:
${context.relevantChunks.map(c => `[${c.section}/${c.field_path}]:\n${c.content}`).join('\n\n')}

## Recent Chat History:
${context.chatHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

## User Question:
${context.userQuery}

Answer the question based on the blueprint data above.`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.QA_AGENT,
    max_tokens: 1024,
    temperature: 0.3,
    messages: [
      { role: 'system', content: QA_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });

  const tokensUsed = response.usage?.total_tokens || 0;
  const cost = calculateCost(response.usage, MODELS.QA_AGENT);

  // Determine confidence based on chunk relevance
  const avgSimilarity = context.relevantChunks.reduce((sum, c) => 
    sum + (c.similarity || 0), 0) / (context.relevantChunks.length || 1);
  
  const confidence = avgSimilarity > 0.85 ? 'high' : avgSimilarity > 0.7 ? 'medium' : 'low';

  return {
    answer: response.choices[0].message.content || '',
    sources: context.relevantChunks,
    confidence,
    tokensUsed,
    cost
  };
}

function calculateCost(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  model: string
): number {
  if (!usage) return 0;
  
  const rates = MODEL_PRICING[model] || { input: 0, output: 0 };
  
  return (
    ((usage.prompt_tokens || 0) / 1_000_000) * rates.input +
    ((usage.completion_tokens || 0) / 1_000_000) * rates.output
  );
}
```

#### Edit Agent

**Purpose:** Interpret edit requests and generate modified values.

**Model:** `anthropic/claude-sonnet-4` (via OpenRouter)

```typescript
// lib/services/agents/edit-agent.ts
import { openrouter, MODELS, MODEL_PRICING } from '../../openrouter';

interface EditResult {
  section: string;
  fieldPath: string;
  oldValue: any;
  newValue: any;
  explanation: string;
  diffPreview: string;
  requiresConfirmation: boolean;
  tokensUsed: number;
  cost: number;
}

const EDIT_SYSTEM_PROMPT = `You are an editor for Strategic Blueprint documents.
The user wants to modify part of the blueprint through natural language.

YOUR TASK:
1. Identify the exact field to edit based on the user's request
2. Generate an appropriate new value that matches the original format
3. Explain why the change makes sense

RULES:
1. Maintain the same data type (string, array, object) as the original
2. For arrays, return the complete new array (not just additions)
3. For objects, return the complete new object
4. Be faithful to the user's intent while maintaining quality
5. If the request is ambiguous, set "needsClarification": true

OUTPUT FORMAT (JSON only):
{
  "fieldPath": "exact.path.to.field",
  "oldValue": <current value>,
  "newValue": <proposed new value>,
  "explanation": "Why this change addresses the user's request",
  "needsClarification": false
}`;

export async function handleEdit(context: RAGContext): Promise<EditResult> {
  const userPrompt = `## Current Section Data:
${JSON.stringify(context.fullSection, null, 2)}

## User Edit Request:
${context.userQuery}

## Recent Chat History:
${context.chatHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Determine the edit and return JSON only.`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.EDIT_AGENT,
    max_tokens: 2048,
    temperature: 0.2,
    messages: [
      { role: 'system', content: EDIT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const editData = JSON.parse(response.choices[0].message.content || '{}');
  const tokensUsed = response.usage?.total_tokens || 0;
  const cost = calculateCost(response.usage, MODELS.EDIT_AGENT);

  // Generate diff preview
  const diffPreview = generateDiffPreview(editData.oldValue, editData.newValue);

  return {
    section: context.intent.section || '',
    fieldPath: editData.fieldPath,
    oldValue: editData.oldValue,
    newValue: editData.newValue,
    explanation: editData.explanation,
    diffPreview,
    requiresConfirmation: true,
    tokensUsed,
    cost
  };
}

function generateDiffPreview(oldValue: any, newValue: any): string {
  const oldStr = typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue, null, 2);
  const newStr = typeof newValue === 'string' ? newValue : JSON.stringify(newValue, null, 2);
  
  return `--- Old Value ---
${oldStr}

--- New Value ---
${newStr}`;
}
```

#### Explain Agent

**Purpose:** Explain the reasoning behind blueprint conclusions.

**Model:** `anthropic/claude-sonnet-4` (via OpenRouter)

```typescript
// lib/services/agents/explain-agent.ts
import { openrouter, MODELS } from '../../openrouter';

interface ExplainResponse {
  explanation: string;
  relatedFactors: string[];
  sources: BlueprintChunk[];
  tokensUsed: number;
  cost: number;
}

const EXPLAIN_SYSTEM_PROMPT = `You are a strategy consultant explaining a Strategic Blueprint.
Your role is to help users understand WHY certain conclusions were reached.

APPROACH:
1. Explain the reasoning process, not just the outcome
2. Reference the input data that led to the conclusion
3. Connect dots between different sections when relevant
4. Be educational and help build understanding
5. Use concrete examples from the blueprint

STRUCTURE YOUR EXPLANATION:
1. What the conclusion/score/recommendation is
2. What factors contributed to it
3. How those factors were weighted or considered
4. What would change the outcome (if applicable)`;

export async function handleExplain(context: RAGContext): Promise<ExplainResponse> {
  const userPrompt = `## Blueprint Context:
${context.relevantChunks.map(c => `[${c.section}/${c.field_path}]:\n${c.content}`).join('\n\n')}

## User wants explanation of:
${context.userQuery}

Explain the reasoning behind this part of the blueprint.`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.EXPLAIN_AGENT,
    max_tokens: 1500,
    temperature: 0.4,
    messages: [
      { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });

  const tokensUsed = response.usage?.total_tokens || 0;
  const cost = calculateCost(response.usage, MODELS.EXPLAIN_AGENT);

  // Extract related factors mentioned
  const relatedFactors = context.relevantChunks
    .filter(c => response.choices[0].message.content?.toLowerCase()
      .includes(c.field_path.split('.')[0].toLowerCase()))
    .map(c => c.field_path);

  return {
    explanation: response.choices[0].message.content || '',
    relatedFactors,
    sources: context.relevantChunks,
    tokensUsed,
    cost
  };
}
```

#### Regenerate Agent

**Purpose:** Regenerate a blueprint section with new instructions.

**Model:** `anthropic/claude-sonnet-4` (via OpenRouter)

```typescript
// lib/services/agents/regenerate-agent.ts
import { openrouter, MODELS, MODEL_PRICING } from '../../openrouter';

interface RegenerateResult {
  section: string;
  currentContent: any;
  newContent: any;
  instructions: string;
  tokensUsed: number;
  estimatedCost: number;
  requiresConfirmation: boolean;
}

const SECTION_CONFIGS: Record<string, { title: string; systemPrompt: string }> = {
  industryMarketOverview: {
    title: 'Industry & Market Overview',
    systemPrompt: 'You are an expert market researcher. Analyze the market landscape, pain points, psychological drivers, and messaging opportunities for the target industry.'
  },
  icpAnalysisValidation: {
    title: 'ICP Analysis & Validation',
    systemPrompt: 'You are an expert ICP analyst. Validate whether this ICP is viable for paid media campaigns.'
  },
  offerAnalysisViability: {
    title: 'Offer Analysis & Viability',
    systemPrompt: 'You are an expert offer analyst. Evaluate offer viability for paid media campaigns.'
  },
  competitorAnalysis: {
    title: 'Competitor Analysis',
    systemPrompt: 'You are an expert competitive analyst. Research the competitor landscape for paid media strategy.'
  },
  crossAnalysisSynthesis: {
    title: 'Cross-Analysis Synthesis',
    systemPrompt: 'You are a strategic analyst synthesizing all research into actionable paid media strategy.'
  }
};

export async function handleRegenerate(
  context: RAGContext,
  businessContext: string,
  previousSections?: Record<string, any>
): Promise<RegenerateResult> {
  const section = context.intent.section || '';
  const instructions = context.intent.instructions || '';
  const sectionConfig = SECTION_CONFIGS[section];

  if (!sectionConfig) {
    throw new Error(`Unknown section: ${section}`);
  }

  // Build enhanced system prompt with user instructions
  const enhancedSystemPrompt = `${sectionConfig.systemPrompt}

## ADDITIONAL USER INSTRUCTIONS:
The user has requested the following modifications for this regeneration:
${instructions}

Please incorporate these instructions while maintaining the quality and structure of the output.
Return valid JSON matching the section schema.`;

  // Build context from previous sections if available
  const previousContext = previousSections 
    ? buildPreviousContext(section, previousSections)
    : '';

  const response = await openrouter.chat.completions.create({
    model: MODELS.REGENERATE_AGENT,
    max_tokens: 4096,
    temperature: 0.3,
    messages: [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: `${businessContext}\n\n${previousContext}\n\nGenerate the ${sectionConfig.title} section.` }
    ],
    response_format: { type: 'json_object' }
  });

  const tokensUsed = response.usage?.total_tokens || 0;
  const estimatedCost = calculateCost(response.usage, MODELS.REGENERATE_AGENT);

  return {
    section,
    currentContent: context.fullSection,
    newContent: JSON.parse(response.choices[0].message.content || '{}'),
    instructions,
    tokensUsed,
    estimatedCost,
    requiresConfirmation: true
  };
}

function buildPreviousContext(section: string, previousSections: Record<string, any>): string {
  // Build context based on section dependencies
  const contextParts: string[] = [];

  if (section === 'icpAnalysisValidation' && previousSections.industryMarketOverview) {
    contextParts.push(`## Previous Section: Industry Market Overview
- Pain Points: ${previousSections.industryMarketOverview.painPoints?.primary?.slice(0, 3).join(', ')}
- Market Maturity: ${previousSections.industryMarketOverview.categorySnapshot?.marketMaturity}`);
  }

  // Add more section dependencies as needed...

  return contextParts.join('\n\n');
}
```

---

## Database Schema

### Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Blueprint Chunks (for RAG)
-- ============================================
CREATE TABLE blueprint_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  field_path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  embedding vector(1536),  -- Matches text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_section CHECK (section IN (
    'industryMarketOverview',
    'icpAnalysisValidation', 
    'offerAnalysisViability',
    'competitorAnalysis',
    'crossAnalysisSynthesis'
  )),
  CONSTRAINT valid_content_type CHECK (content_type IN (
    'string', 'number', 'array', 'object', 'enum'
  ))
);

-- Vector similarity search index (IVFFlat for large datasets)
CREATE INDEX idx_blueprint_chunks_embedding 
ON blueprint_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for filtering by blueprint
CREATE INDEX idx_blueprint_chunks_blueprint_id 
ON blueprint_chunks(blueprint_id);

-- Index for filtering by section
CREATE INDEX idx_blueprint_chunks_section 
ON blueprint_chunks(blueprint_id, section);

-- ============================================
-- Chat Messages
-- ============================================
CREATE TABLE blueprint_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  intent_type TEXT,
  intent_data JSONB,
  sources JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- Index for fetching conversation history
CREATE INDEX idx_chat_messages_conversation 
ON blueprint_chat_messages(blueprint_id, conversation_id, created_at);

-- ============================================
-- Version History
-- ============================================
CREATE TABLE blueprint_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  changes JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  conversation_id UUID,
  full_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_change_type CHECK (change_type IN ('edit', 'regenerate', 'revert')),
  CONSTRAINT valid_changed_by CHECK (changed_by IN ('user', 'ai_chat'))
);

-- Index for version history lookup
CREATE INDEX idx_blueprint_versions_blueprint 
ON blueprint_versions(blueprint_id, version_number DESC);

-- Unique constraint on version numbers per blueprint
CREATE UNIQUE INDEX idx_blueprint_versions_unique 
ON blueprint_versions(blueprint_id, version_number);

-- ============================================
-- RPC Functions
-- ============================================

-- Vector similarity search with optional section filter
CREATE OR REPLACE FUNCTION match_blueprint_chunks(
  query_embedding vector(1536),
  p_blueprint_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  section_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  section TEXT,
  field_path TEXT,
  content TEXT,
  content_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.section,
    bc.field_path,
    bc.content,
    bc.content_type,
    bc.metadata,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM blueprint_chunks bc
  WHERE bc.blueprint_id = p_blueprint_id
    AND (section_filter IS NULL OR bc.section = section_filter)
    AND 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get next version number for a blueprint
CREATE OR REPLACE FUNCTION get_next_version_number(p_blueprint_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM blueprint_versions
  WHERE blueprint_id = p_blueprint_id;
  
  RETURN next_version;
END;
$$;
```

---

## API Endpoints

### Chat Endpoint

**POST** `/api/blueprint/[id]/chat`

```typescript
// app/api/blueprint/[id]/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/services/intent-router';
import { retrieveContext } from '@/lib/services/retrieval';
import { handleQuestion } from '@/lib/services/agents/qa-agent';
import { handleEdit } from '@/lib/services/agents/edit-agent';
import { handleExplain } from '@/lib/services/agents/explain-agent';
import { handleRegenerate } from '@/lib/services/agents/regenerate-agent';

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatResponse {
  conversationId: string;
  response: string;
  intent: ChatIntent;
  pendingAction?: EditResult | RegenerateResult;
  sources: {
    chunkId: string;
    section: string;
    fieldPath: string;
    similarity: number;
  }[];
  metadata: {
    tokensUsed: number;
    cost: number;
    processingTime: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const blueprintId = params.id;
  const body: ChatRequest = await request.json();
  
  const conversationId = body.conversationId || crypto.randomUUID();

  try {
    // 1. Classify intent
    const intent = await classifyIntent(body.message);

    // 2. Retrieve context
    const context = await retrieveContext({
      blueprintId,
      query: body.message,
      intent,
    });

    // 3. Route to appropriate agent
    let response: string;
    let pendingAction: EditResult | RegenerateResult | undefined;
    let tokensUsed = 0;
    let cost = 0;

    switch (intent.type) {
      case 'question': {
        const result = await handleQuestion(context);
        response = result.answer;
        tokensUsed = result.tokensUsed;
        cost = result.cost;
        break;
      }
      case 'edit': {
        const result = await handleEdit(context);
        response = `I'll make this change:\n\n**Field:** ${result.fieldPath}\n**Change:** ${result.explanation}\n\n${result.diffPreview}\n\nPlease confirm to apply this edit.`;
        pendingAction = result;
        tokensUsed = result.tokensUsed;
        cost = result.cost;
        break;
      }
      case 'explain': {
        const result = await handleExplain(context);
        response = result.explanation;
        tokensUsed = result.tokensUsed;
        cost = result.cost;
        break;
      }
      case 'regenerate': {
        const businessContext = await getBusinessContext(blueprintId);
        const result = await handleRegenerate(context, businessContext);
        response = `I'll regenerate the ${result.section} section with your instructions.\n\n**Estimated cost:** $${result.estimatedCost.toFixed(4)}\n\nPlease confirm to proceed.`;
        pendingAction = result;
        tokensUsed = result.tokensUsed;
        cost = result.estimatedCost;
        break;
      }
      default:
        response = "I'm here to help you with your Strategic Blueprint. You can ask me questions, request explanations, make edits, or regenerate sections.";
    }

    // 4. Save messages to history
    await saveMessages(blueprintId, conversationId, [
      { role: 'user', content: body.message, intent },
      { role: 'assistant', content: response, sources: context.relevantChunks }
    ]);

    return NextResponse.json<ChatResponse>({
      conversationId,
      response,
      intent,
      pendingAction,
      sources: context.relevantChunks.map(c => ({
        chunkId: c.id,
        section: c.section,
        fieldPath: c.field_path,
        similarity: c.similarity
      })),
      metadata: {
        tokensUsed,
        cost,
        processingTime: Date.now() - startTime
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
```

### Confirm Edit Endpoint

**POST** `/api/blueprint/[id]/confirm-edit`

```typescript
// app/api/blueprint/[id]/confirm-edit/route.ts
interface ConfirmEditRequest {
  conversationId: string;
  editResult: EditResult;
  confirmed: boolean;
  userNote?: string;
}

interface ConfirmEditResponse {
  success: boolean;
  versionId?: string;
  versionNumber?: number;
  message: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const blueprintId = params.id;
  const body: ConfirmEditRequest = await request.json();

  if (!body.confirmed) {
    return NextResponse.json<ConfirmEditResponse>({
      success: true,
      message: 'Edit cancelled'
    });
  }

  try {
    // Apply the edit using RPC function
    const { data: versionId, error } = await supabase.rpc('apply_blueprint_edit', {
      p_blueprint_id: blueprintId,
      p_section: body.editResult.section,
      p_field_path: body.editResult.fieldPath,
      p_new_value: body.editResult.newValue,
      p_conversation_id: body.conversationId
    });

    if (error) throw error;

    // Re-chunk the affected section
    await rechunkSection(blueprintId, body.editResult.section);

    return NextResponse.json<ConfirmEditResponse>({
      success: true,
      versionId,
      message: 'Edit applied successfully'
    });

  } catch (error) {
    console.error('Confirm edit error:', error);
    return NextResponse.json(
      { error: 'Failed to apply edit' },
      { status: 500 }
    );
  }
}
```

### Confirm Regenerate Endpoint

**POST** `/api/blueprint/[id]/confirm-regenerate`

```typescript
interface ConfirmRegenerateRequest {
  conversationId: string;
  regenerateResult: RegenerateResult;
  confirmed: boolean;
}

interface ConfirmRegenerateResponse {
  success: boolean;
  versionId?: string;
  versionNumber?: number;
  tokensUsed: number;
  cost: number;
  message: string;
}
```

### Version History Endpoint

**GET** `/api/blueprint/[id]/versions`

```typescript
interface VersionHistoryResponse {
  versions: {
    id: string;
    versionNumber: number;
    changeType: 'edit' | 'regenerate' | 'revert';
    changeSummary: string;
    changes: {
      fieldPath: string;
      oldValue: any;
      newValue: any;
    }[];
    changedBy: 'user' | 'ai_chat';
    createdAt: string;
  }[];
  currentVersion: number;
}
```

### Revert Version Endpoint

**POST** `/api/blueprint/[id]/revert/[versionId]`

```typescript
interface RevertResponse {
  success: boolean;
  newVersionId: string;
  newVersionNumber: number;
  message: string;
}
```

---

## Cost Estimation

### Per-Operation Costs (via OpenRouter)

| Operation | Model | Est. Tokens | Est. Cost |
|-----------|-------|-------------|-----------|
| Intent Classification | `anthropic/claude-haiku-4` | ~200 | ~$0.0003 |
| Embedding Generation | `openai/text-embedding-3-small` | ~100/chunk | ~$0.000002 |
| Q&A Response | `anthropic/claude-sonnet-4` | ~1,500 | ~$0.02 |
| Explain Response | `anthropic/claude-sonnet-4` | ~2,000 | ~$0.03 |
| Edit Generation | `anthropic/claude-sonnet-4` | ~2,500 | ~$0.04 |
| Section Regeneration | `anthropic/claude-sonnet-4` | ~5,000 | ~$0.08 |

### Cost Per Conversation (Estimated)

| Conversation Type | Messages | Estimated Cost |
|-------------------|----------|----------------|
| Light Q&A (5 messages) | 5 | $0.05-0.10 |
| Mixed Q&A + Explain (10 messages) | 10 | $0.15-0.25 |
| Edit Session (5 messages + 2 edits) | 7 | $0.15-0.20 |
| Regenerate Session | 3-5 | $0.15-0.30 |

### Initial Chunk Embedding Cost

| Chunks per Blueprint | Embedding Cost |
|---------------------|----------------|
| ~30 chunks | ~$0.0006 |

---

## Implementation Phases

### Phase 1: Basic Q&A with RAG (Week 1)

**Scope:**
- Set up Supabase pgvector
- Implement document chunking
- Create embedding generation via OpenRouter
- Build basic chat API endpoint
- Implement Q&A agent only
- Basic chat UI

**Deliverables:**
- Users can ask questions about their blueprint
- Sources are shown for answers
- Chat history is persisted

### Phase 2: Edit Capability (Week 2)

**Scope:**
- Implement intent router (question vs edit)
- Build Edit agent
- Create edit confirmation flow
- Add version history table
- Build diff preview UI

**Deliverables:**
- Users can request edits through chat
- Edits require confirmation
- Changes are versioned

### Phase 3: Regenerate & Explain (Days 1-4, Week 3)

**Scope:**
- Implement Explain agent
- Implement Regenerate agent
- Build regenerate confirmation UI
- Add cost estimation for regeneration

**Deliverables:**
- Users can request explanations
- Users can regenerate sections with instructions
- Regeneration shows cost estimate

### Phase 4: Version History & Polish (Days 5-7, Week 3)

**Scope:**
- Build version history UI
- Implement revert functionality
- Add version comparison view
- Optimize embedding search
- Polish chat UX

**Deliverables:**
- Full version history with revert
- Optimized retrieval performance
- Production-ready chat interface

---

## OpenRouter Compatibility Summary

| Component | OpenRouter Model ID | Dimensions/Notes |
|-----------|---------------------|------------------|
| Intent Classification | `anthropic/claude-haiku-4` | Fast, cheap |
| Q&A Agent | `anthropic/claude-sonnet-4` | Balanced |
| Edit Agent | `anthropic/claude-sonnet-4` | JSON output |
| Explain Agent | `anthropic/claude-sonnet-4` | Detailed |
| Regenerate Agent | `anthropic/claude-sonnet-4` | Full section |
| Embeddings | `openai/text-embedding-3-small` | 1536 dims |

**Single API Key** • **Single SDK (OpenAI)** • **Unified Billing**

---

## Environment Variables

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=https://your-app.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Q&A Answer Relevance | >85% user satisfaction |
| Edit Accuracy | >90% correct field identification |
| Average Response Time | <3 seconds for Q&A |
| Cost per Conversation | <$0.25 average |
| Version Revert Usage | <5% of edits reverted |

---

## Security Considerations

1. **Input Sanitization:** All user messages pass through sanitization before processing
2. **Rate Limiting:** Max 20 messages per minute per user
3. **Cost Caps:** Per-user daily cost limit (~$5)
4. **Audit Logging:** All edits logged with user ID and timestamp
5. **Access Control:** Users can only chat with their own blueprints

---

## Future Enhancements

1. **Multi-Blueprint Q&A:** Compare multiple blueprints in one conversation
2. **Collaborative Chat:** Multiple team members in one conversation
3. **Export Chat:** Download conversation as PDF/Markdown
4. **Suggested Questions:** AI suggests relevant follow-up questions
5. **Voice Input:** Speech-to-text for chat messages
6. **Scheduled Regeneration:** Auto-refresh sections with latest market data
