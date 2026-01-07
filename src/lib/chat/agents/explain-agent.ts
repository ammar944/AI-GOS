// src/lib/chat/agents/explain-agent.ts
// Explain Agent for providing reasoning explanations about blueprint content

import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { ExplainIntent, BlueprintSection } from '../types';

export interface ExplainContext {
  /** The full blueprint data for comprehensive context */
  fullBlueprint: Record<string, unknown>;
  /** The classified explain intent */
  intent: ExplainIntent;
  /** Optional chat history */
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface RelatedFactor {
  /** Which section the factor comes from */
  section: BlueprintSection;
  /** The factor that contributed */
  factor: string;
  /** How it connects to the explanation */
  relevance: string;
}

export interface ExplainResponse {
  /** The explanation text */
  explanation: string;
  /** Related factors from other sections */
  relatedFactors: RelatedFactor[];
  /** Confidence in the explanation */
  confidence: 'high' | 'medium' | 'low';
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost */
  cost: number;
}

const EXPLAIN_SYSTEM_PROMPT = `You are an expert explainer for Strategic Blueprint documents.
Your role is to explain WHY certain recommendations, scores, or assessments were made.

BLUEPRINT SECTIONS:
1. industryMarketOverview - Market landscape, pain points, psychological drivers, messaging opportunities
2. icpAnalysisValidation - ICP coherence, viability, reachability, pain-solution fit, risk assessment
3. offerAnalysisViability - Offer strength scores (1-10), red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns, gaps and opportunities
5. crossAnalysisSynthesis - Key insights, recommended positioning, messaging angles, platform recommendations

EXPLANATION APPROACH:
1. Directly answer the "why" question with clear reasoning
2. Reference specific data points from the blueprint as evidence
3. Show how factors from different sections connect and influence each other
4. Be conversational and educational, not just a data dump
5. Identify related factors from other sections that contributed to the recommendation

CROSS-SECTION CONNECTIONS (examples):
- Industry pain points -> ICP pain-solution fit -> Messaging angles
- Competitor weaknesses -> Competitive gaps -> Positioning recommendations
- Psychological drivers -> Messaging opportunities -> Primary messaging angles
- Offer strength scores -> Risk assessment -> Strategic recommendations

RESPONSE FORMAT:
You must respond with a valid JSON object:
{
  "explanation": "Clear explanation answering the why question with supporting evidence",
  "relatedFactors": [
    {
      "section": "sectionName",
      "factor": "The specific factor or data point",
      "relevance": "How this factor influenced the recommendation"
    }
  ],
  "confidence": "high|medium|low"
}

CONFIDENCE LEVELS:
- high: Multiple data points support the explanation, clear cross-section connections
- medium: Some supporting data, but connections are inferred
- low: Limited data available, explanation is based on general principles`;

/**
 * Handle an explain request and generate a reasoning explanation
 */
export async function handleExplain(context: ExplainContext): Promise<ExplainResponse> {
  const { fullBlueprint, intent, chatHistory = [] } = context;

  // Build the user message with blueprint data and explain request
  const userMessage = `## Full Blueprint Data:
\`\`\`json
${JSON.stringify(fullBlueprint, null, 2)}
\`\`\`

## User's Question:
Section: ${intent.section}
Field: ${intent.field}
What to explain: "${intent.whatToExplain}"

Analyze the blueprint data and explain WHY this recommendation/assessment was made.
Draw connections between sections and cite specific data as evidence.
Return ONLY the JSON response with explanation, relatedFactors, and confidence.`;

  const messages = [
    { role: 'system' as const, content: EXPLAIN_SYSTEM_PROMPT },
    ...chatHistory.slice(-4).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const client = createOpenRouterClient();
  const response = await client.chatJSON<{
    explanation: string;
    relatedFactors: RelatedFactor[];
    confidence: 'high' | 'medium' | 'low';
  }>({
    model: MODELS.CLAUDE_SONNET,
    messages,
    temperature: 0.3, // Same as Q&A for consistent, informative responses
    maxTokens: 1536, // Explanations need more space than Q&A
    jsonMode: true,
  });

  const { data, usage, cost } = response;

  return {
    explanation: data.explanation,
    relatedFactors: data.relatedFactors || [],
    confidence: data.confidence || 'medium',
    usage,
    cost,
  };
}
