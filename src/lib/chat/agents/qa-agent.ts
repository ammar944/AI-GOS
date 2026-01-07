// src/lib/chat/agents/qa-agent.ts
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { BlueprintChunk } from '../types';
import { buildContextFromChunks } from '../retrieval';

export interface QARequest {
  query: string;
  chunks: BlueprintChunk[];
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface QAResponse {
  answer: string;
  sources: BlueprintChunk[];
  confidence: 'high' | 'medium' | 'low';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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
6. When referencing specific data, mention which section it comes from

CONTEXT SECTIONS:
- Industry Market Overview: Market landscape, pain points, psychological drivers
- ICP Analysis & Validation: ICP viability and validation
- Offer Analysis & Viability: Offer strength scores and recommendations
- Competitor Analysis: Competitor profiles and gaps
- Cross-Analysis Synthesis: Strategic recommendations and next steps`;

/**
 * Answer a question about the blueprint using RAG context
 */
export async function answerQuestion(request: QARequest): Promise<QAResponse> {
  const { query, chunks, chatHistory = [] } = request;

  const context = buildContextFromChunks(chunks);

  // Build messages with context
  const messages = [
    { role: 'system' as const, content: QA_SYSTEM_PROMPT },
    ...chatHistory.slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user' as const,
      content: `## Blueprint Context:
${context}

## Question:
${query}

Answer the question based on the blueprint data above.`,
    },
  ];

  const client = createOpenRouterClient();
  const response = await client.chat({
    model: MODELS.CLAUDE_SONNET,
    messages,
    temperature: 0.3,
    maxTokens: 1024,
  });

  // Determine confidence based on chunk relevance
  const avgSimilarity = chunks.length > 0
    ? chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length
    : 0;

  const confidence: 'high' | 'medium' | 'low' =
    avgSimilarity > 0.85 ? 'high' :
    avgSimilarity > 0.7 ? 'medium' : 'low';

  return {
    answer: response.content,
    sources: chunks,
    confidence,
    usage: response.usage,
    cost: response.cost,
  };
}
