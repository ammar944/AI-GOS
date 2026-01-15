// src/lib/chat/agents/qa-agent.ts
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { BlueprintChunk, ConfidenceFactors, ConfidenceResult, SourceQuality } from '../types';
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
  /** Detailed confidence calculation result */
  confidenceResult: ConfidenceResult;
  /** Quality assessment of retrieved sources */
  sourceQuality: SourceQuality;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

// Similarity thresholds for quality classification
const HIGH_QUALITY_THRESHOLD = 0.85;
const MEDIUM_QUALITY_THRESHOLD = 0.65;

/**
 * Calculate enhanced confidence based on multiple factors
 */
export function calculateConfidence(chunks: BlueprintChunk[]): ConfidenceResult {
  if (chunks.length === 0) {
    return {
      level: 'low',
      factors: {
        avgSimilarity: 0,
        chunkCount: 0,
        coverageScore: 0,
        highQualityChunks: 0,
      },
      explanation: 'No relevant sources found in the blueprint.',
    };
  }

  // Calculate individual factors
  const avgSimilarity = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
  const chunkCount = chunks.length;
  const highQualityChunks = chunks.filter(c => (c.similarity || 0) > HIGH_QUALITY_THRESHOLD).length;

  // Coverage score: estimate based on chunk diversity (unique sections)
  const uniqueSections = new Set(chunks.map(c => c.section)).size;
  const coverageScore = Math.min(1, (uniqueSections / 5) * (chunkCount / 3));

  const factors: ConfidenceFactors = {
    avgSimilarity: Math.round(avgSimilarity * 100) / 100,
    chunkCount,
    coverageScore: Math.round(coverageScore * 100) / 100,
    highQualityChunks,
  };

  // Determine confidence level using multi-factor analysis
  // High confidence requires:
  // - avgSimilarity > 0.8 AND chunkCount >= 3 AND highQualityChunks >= 2
  const isHighConfidence =
    avgSimilarity > 0.8 &&
    chunkCount >= 3 &&
    highQualityChunks >= 2;

  // Medium confidence requires:
  // - avgSimilarity > 0.65 OR chunkCount >= 2
  const isMediumConfidence =
    avgSimilarity > MEDIUM_QUALITY_THRESHOLD ||
    chunkCount >= 2;

  let level: 'high' | 'medium' | 'low';
  let explanation: string;

  if (isHighConfidence) {
    level = 'high';
    explanation = `High confidence: ${highQualityChunks} high-quality sources with ${Math.round(avgSimilarity * 100)}% average relevance across ${chunkCount} total sources.`;
  } else if (isMediumConfidence) {
    level = 'medium';
    if (avgSimilarity > MEDIUM_QUALITY_THRESHOLD) {
      explanation = `Medium confidence: ${Math.round(avgSimilarity * 100)}% average relevance, but ${chunkCount < 3 ? 'limited source count' : highQualityChunks < 2 ? 'few high-quality matches' : 'moderate match quality'}.`;
    } else {
      explanation = `Medium confidence: Found ${chunkCount} relevant sources, but average relevance is ${Math.round(avgSimilarity * 100)}%.`;
    }
  } else {
    level = 'low';
    explanation = `Low confidence: ${chunkCount === 1 ? 'Only 1 source found' : chunkCount === 0 ? 'No sources found' : `${chunkCount} sources with ${Math.round(avgSimilarity * 100)}% average relevance`}. Answer may be incomplete.`;
  }

  return { level, factors, explanation };
}

/**
 * Build source quality assessment from chunks
 */
export function buildSourceQuality(chunks: BlueprintChunk[]): SourceQuality {
  if (chunks.length === 0) {
    return {
      avgRelevance: 0,
      sourceCount: 0,
      highQualitySources: 0,
      explanation: 'No sources available.',
    };
  }

  const avgRelevance = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
  const sourceCount = chunks.length;
  const highQualitySources = chunks.filter(c => (c.similarity || 0) > HIGH_QUALITY_THRESHOLD).length;

  let explanation: string;

  if (highQualitySources >= 3) {
    explanation = `Excellent: ${highQualitySources} highly relevant sources with ${Math.round(avgRelevance * 100)}% average match.`;
  } else if (highQualitySources >= 1) {
    explanation = `Good: ${highQualitySources} highly relevant ${highQualitySources === 1 ? 'source' : 'sources'} among ${sourceCount} total with ${Math.round(avgRelevance * 100)}% average relevance.`;
  } else if (sourceCount >= 2 && avgRelevance > MEDIUM_QUALITY_THRESHOLD) {
    explanation = `Adequate: ${sourceCount} sources with ${Math.round(avgRelevance * 100)}% average relevance. No exceptionally strong matches.`;
  } else {
    explanation = `Limited: ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'} found with ${Math.round(avgRelevance * 100)}% average relevance. Results may be incomplete.`;
  }

  return {
    avgRelevance: Math.round(avgRelevance * 100) / 100,
    sourceCount,
    highQualitySources,
    explanation,
  };
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

  // Calculate enhanced confidence using multi-factor analysis
  const confidenceResult = calculateConfidence(chunks);

  // Build source quality assessment
  const sourceQuality = buildSourceQuality(chunks);

  return {
    answer: response.content,
    sources: chunks,
    confidence: confidenceResult.level,
    confidenceResult,
    sourceQuality,
    usage: response.usage,
    cost: response.cost,
  };
}
