// src/app/api/chat/blueprint/stream/route.ts
// Streaming chat API - SSE endpoint for real-time Q&A responses

import { NextRequest } from 'next/server';
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { handleExplain, ExplainContext } from '@/lib/chat/agents/explain-agent';
import { calculateConfidence, buildSourceQuality } from '@/lib/chat/agents/qa-agent';
import { ChatIntent, ExplainIntent, EditIntent, IntentClassificationResult, BlueprintChunk } from '@/lib/chat/types';
import { classifyIntent } from '@/lib/chat/intent-router';
import { retrieveRelevantChunks, buildContextFromChunks } from '@/lib/chat/retrieval';

interface StreamChatRequest {
  message: string;
  blueprint: Record<string, unknown>;
  blueprintId?: string;  // Optional: enables RAG retrieval for better accuracy
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

interface PendingEdit {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

interface RelatedFactor {
  section: string;
  factor: string;
  relevance: string;
}

interface ChunkSource {
  section: string;
  fieldPath: string;
  similarity: number;
}

/**
 * Summarize blueprint for context (same as non-streaming route)
 */
function summarizeBlueprint(blueprint: Record<string, unknown>): string {
  const sections: string[] = [];

  // Section 1: Industry & Market
  const s1 = blueprint.industryMarketOverview as Record<string, unknown> | undefined;
  if (s1) {
    const painPoints = s1.painPoints as { primary?: string[]; secondary?: string[] } | undefined;
    sections.push(`## Industry & Market Overview
- Category: ${(s1.categorySnapshot as Record<string, unknown>)?.category || 'N/A'}
- Primary Pain Points: ${painPoints?.primary?.slice(0, 3).join('; ') || 'N/A'}
- Messaging Opportunities: ${((s1.messagingOpportunities as Record<string, unknown>)?.opportunities as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  // Section 2: ICP Analysis
  const s2 = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;
  if (s2) {
    const verdict = s2.finalVerdict as Record<string, unknown> | undefined;
    sections.push(`## ICP Analysis
- Status: ${verdict?.status || 'N/A'}
- Reasoning: ${verdict?.reasoning || 'N/A'}`);
  }

  // Section 3: Offer Analysis
  const s3 = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  if (s3) {
    const strength = s3.offerStrength as Record<string, unknown> | undefined;
    const rec = s3.recommendation as Record<string, unknown> | undefined;
    sections.push(`## Offer Analysis
- Overall Score: ${strength?.overallScore || 'N/A'}/10
- Recommendation: ${rec?.status || 'N/A'}`);
  }

  // Section 4: Competitors
  const s4 = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
  if (s4) {
    const competitors = s4.competitors as { name?: string; positioning?: string }[] | undefined;
    sections.push(`## Competitor Analysis
- Competitors: ${competitors?.map(c => c.name).join(', ') || 'N/A'}
- Gaps: ${(s4.gapsAndOpportunities as Record<string, unknown>)?.messagingOpportunities?.toString().slice(0, 200) || 'N/A'}`);
  }

  // Section 5: Synthesis
  const s5 = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
  if (s5) {
    sections.push(`## Cross-Analysis Synthesis
- Recommended Positioning: ${s5.recommendedPositioning || 'N/A'}
- Primary Messaging Angles: ${(s5.primaryMessagingAngles as string[])?.slice(0, 3).join('; ') || 'N/A'}
- Next Steps: ${(s5.nextSteps as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  return sections.join('\n\n');
}

// Note: detectIntent() and extractExplainIntentFromMessage() have been replaced
// by the LLM-based classifyIntent() from @/lib/chat/intent-router

/**
 * Generate diff preview for edit
 */
function generateDiffPreview(oldValue: unknown, newValue: unknown): string {
  const formatValue = (val: unknown): string => {
    if (typeof val === 'string') {
      return val.length > 100 ? `"${val.substring(0, 97)}..."` : `"${val}"`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      if (typeof val[0] === 'string') {
        return `[${val.map(v => `"${v}"`).join(', ')}]`;
      }
      return `[${val.length} items]`;
    }
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  return `- Old: ${formatValue(oldValue)}\n+ New: ${formatValue(newValue)}`;
}

/**
 * Extract edits from AI response if present
 */
function extractEdits(response: string): { text: string; edits: PendingEdit[] } {
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?"isEdit"\s*:\s*true[\s\S]*?\})\s*```/);

  if (!jsonMatch) {
    return { text: response, edits: [] };
  }

  try {
    const editData = JSON.parse(jsonMatch[1]);

    if (!editData.isEdit) {
      return { text: response, edits: [] };
    }

    const edits: PendingEdit[] = [];

    if (editData.edits && Array.isArray(editData.edits)) {
      for (const e of editData.edits) {
        if (e.section && e.fieldPath) {
          edits.push({
            section: e.section,
            fieldPath: e.fieldPath,
            oldValue: e.oldValue,
            newValue: e.newValue,
            explanation: e.explanation || '',
            diffPreview: generateDiffPreview(e.oldValue, e.newValue),
          });
        }
      }
    } else if (editData.section && editData.fieldPath) {
      edits.push({
        section: editData.section,
        fieldPath: editData.fieldPath,
        oldValue: editData.oldValue,
        newValue: editData.newValue,
        explanation: editData.explanation || '',
        diffPreview: generateDiffPreview(editData.oldValue, editData.newValue),
      });
    }

    if (edits.length > 0) {
      const text = response.replace(/```json[\s\S]*?```/, '').trim();
      return { text, edits };
    }
  } catch {
    // JSON parse failed
  }

  return { text: response, edits: [] };
}

/**
 * Extract explanation from AI response if present
 */
function extractExplanation(response: string): {
  text: string;
  explanation: string | null;
  relatedFactors: RelatedFactor[];
  confidence: 'high' | 'medium' | 'low' | null;
} {
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?"isExplanation"\s*:\s*true[\s\S]*?\})\s*```/);

  if (!jsonMatch) {
    return { text: response, explanation: null, relatedFactors: [], confidence: null };
  }

  try {
    const explainData = JSON.parse(jsonMatch[1]);

    if (!explainData.isExplanation) {
      return { text: response, explanation: null, relatedFactors: [], confidence: null };
    }

    const text = response.replace(/```json[\s\S]*?```/, '').trim();

    return {
      text,
      explanation: explainData.explanation || null,
      relatedFactors: explainData.relatedFactors || [],
      confidence: explainData.confidence || 'medium',
    };
  } catch {
    // JSON parse failed
  }

  return { text: response, explanation: null, relatedFactors: [], confidence: null };
}

/**
 * System prompt for streaming Q&A (simplified, no edit/explain JSON handling)
 */
const STREAMING_QA_PROMPT = `You are an expert assistant for Strategic Blueprint documents. You help users understand their blueprint.

The blueprint has 5 sections:
1. industryMarketOverview - Market landscape, pain points, psychological drivers, messaging opportunities
2. icpAnalysisValidation - ICP coherence check, viability, reachability, pain-solution fit, risk assessment
3. offerAnalysisViability - Offer strength scores (1-10), red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns, gaps and opportunities
5. crossAnalysisSynthesis - Key insights, recommended positioning, messaging angles, platform recommendations

RULES:
- Answer questions directly and concisely using the blueprint data
- Reference specific sections when relevant
- If information isn't in the blueprint, say so clearly
- Keep answers focused and informative
- Do NOT output JSON blocks - respond in plain text`;

/**
 * Full system prompt for non-streaming (edit/explain) requests
 */
const FULL_SYSTEM_PROMPT = `You are an expert assistant for Strategic Blueprint documents. You help users understand their blueprint and make edits.

The blueprint has 5 sections:
1. industryMarketOverview - Market landscape, pain points, psychological drivers, messaging opportunities
2. icpAnalysisValidation - ICP coherence check, viability, reachability, pain-solution fit, risk assessment
3. offerAnalysisViability - Offer strength scores (1-10), red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns, gaps and opportunities
5. crossAnalysisSynthesis - Key insights, recommended positioning, messaging angles, platform recommendations

FOR EDIT REQUESTS (user wants to change/update/modify something):
- Identify ALL fields that need to change to fulfill the request
- Respond with a JSON block containing an array of edits:

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "sectionName",
      "fieldPath": "path.to.field",
      "oldValue": "current value",
      "newValue": "proposed new value",
      "explanation": "Why this specific change is needed"
    }
  ]
}
\`\`\`

FOR EXPLANATIONS (user asks "why" or "explain" something):
- Explain the reasoning behind the recommendation or assessment
- Reference specific data points from the blueprint as evidence
- Respond with a JSON block:

\`\`\`json
{
  "isExplanation": true,
  "explanation": "Clear explanation answering the why question...",
  "relatedFactors": [
    {"section": "sectionName", "factor": "what contributed", "relevance": "how it connects"}
  ],
  "confidence": "high|medium|low"
}
\`\`\`

Always explain the overall strategy before the JSON block.`;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: StreamChatRequest = await request.json();

    if (!body.message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.blueprint || typeof body.blueprint !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Blueprint context is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Classify intent using LLM-based classification
    const classificationResult = await classifyIntent(body.message);
    const { intent } = classificationResult;

    // Route based on intent type
    switch (intent.type) {
      case 'edit':
        // Edit requests use streaming for explanation, then send edits
        return handleEditStreamingResponse(body, intent as EditIntent, classificationResult, startTime);

      case 'explain':
        // Explain needs structured response (no streaming for now)
        return handleNonStreamingResponse(body, intent, classificationResult, startTime);

      case 'regenerate':
        // Regenerate is not yet implemented - return a placeholder response
        return handleRegenerateResponse(body, intent, classificationResult, startTime);

      case 'question':
      case 'general':
      default:
        // Questions and general conversation can be streamed
        return handleStreamingResponse(body, classificationResult, startTime);
    }

  } catch (error) {
    console.error('Stream chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message', details: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle Q&A with SSE streaming
 * Uses RAG retrieval when blueprintId is provided, falls back to summarizeBlueprint() otherwise
 */
async function handleStreamingResponse(
  body: StreamChatRequest,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  // Track RAG metadata
  let retrievedChunks: BlueprintChunk[] = [];
  let ragCost = 0;
  let contextSource: 'rag' | 'summary' = 'summary';
  let contextContent: string;

  // Hybrid context building: RAG when blueprintId available, summary fallback
  if (body.blueprintId) {
    try {
      // Use RAG retrieval for better accuracy
      const retrievalResult = await retrieveRelevantChunks({
        blueprintId: body.blueprintId,
        query: body.message,
        matchCount: 5,
        matchThreshold: 0.65,
      });

      retrievedChunks = retrievalResult.chunks;
      ragCost = retrievalResult.embeddingCost;
      contextSource = 'rag';

      // Build context from retrieved chunks
      if (retrievedChunks.length > 0) {
        contextContent = buildContextFromChunks(retrievedChunks);
      } else {
        // No relevant chunks found, fall back to summary
        contextContent = summarizeBlueprint(body.blueprint);
        contextSource = 'summary';
      }
    } catch (ragError) {
      // RAG failed, fall back to summary
      console.warn('RAG retrieval failed, falling back to summary:', ragError);
      contextContent = summarizeBlueprint(body.blueprint);
      contextSource = 'summary';
    }
  } else {
    // No blueprintId provided, use summary
    contextContent = summarizeBlueprint(body.blueprint);
  }

  const messages = [
    { role: 'system' as const, content: STREAMING_QA_PROMPT },
    {
      role: 'user' as const,
      content: contextSource === 'rag'
        ? `Here is relevant context from the Strategic Blueprint:\n\n${contextContent}`
        : `Here is the Strategic Blueprint:\n\n${contextContent}`,
    },
    ...(body.chatHistory || []).slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: body.message },
  ];

  const client = createOpenRouterClient();

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Prepare sources for metadata (capture in closure)
  const sources: ChunkSource[] = retrievedChunks.map(c => ({
    section: c.section,
    fieldPath: c.fieldPath,
    similarity: c.similarity || 0,
  }));

  // Start streaming in the background
  (async () => {
    try {
      const contentStream = client.chatStream({
        model: MODELS.CLAUDE_SONNET,
        messages,
        temperature: 0.3,
        maxTokens: 1024,
      });

      for await (const chunk of contentStream) {
        // Send SSE format: data: {"type": "text", "content": "..."}\n\n
        const sseData = JSON.stringify({ type: 'text', content: chunk });
        await writer.write(encoder.encode(`data: ${sseData}\n\n`));
      }

      // Calculate confidence and source quality from retrieved chunks
      const confidenceResult = calculateConfidence(retrievedChunks);
      const sourceQuality = buildSourceQuality(retrievedChunks);

      // Send completion event with metadata (including RAG info and source quality)
      const doneData = JSON.stringify({
        type: 'done',
        done: true,
        sources: sources.length > 0 ? sources : undefined,
        sourceQuality: sources.length > 0 ? sourceQuality : undefined,
        confidence: confidenceResult.level,
        confidenceExplanation: confidenceResult.explanation,
        metadata: {
          processingTime: Date.now() - startTime,
          classificationCost: classificationResult.cost,
          classificationTokens: classificationResult.usage.totalTokens,
          intentType: classificationResult.intent.type,
          contextSource,
          ragCost: ragCost > 0 ? ragCost : undefined,
          chunksRetrieved: retrievedChunks.length > 0 ? retrievedChunks.length : undefined,
          confidenceFactors: sources.length > 0 ? confidenceResult.factors : undefined,
        },
      });
      await writer.write(encoder.encode(`data: ${doneData}\n\n`));

    } catch (error) {
      console.error('Streaming error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
      const errorData = JSON.stringify({ type: 'error', error: errorMessage });
      await writer.write(encoder.encode(`data: ${errorData}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Handle edit requests with SSE streaming
 * Streams the explanation text first, then extracts and sends edits as a separate event
 */
async function handleEditStreamingResponse(
  body: StreamChatRequest,
  intent: EditIntent,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  const blueprintSummary = summarizeBlueprint(body.blueprint);
  const fullBlueprintJSON = JSON.stringify(body.blueprint, null, 2);

  // Include intent context in the prompt for better targeting
  const intentContext = intent.field
    ? `\n\nUser intent: Edit ${intent.section}${intent.field ? `.${intent.field}` : ''} - "${intent.desiredChange}"`
    : '';

  const messages = [
    { role: 'system' as const, content: FULL_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Here is the current Strategic Blueprint:\n\n${blueprintSummary}\n\n---\n\nFull Blueprint Data (for edits):\n\`\`\`json\n${fullBlueprintJSON}\n\`\`\`${intentContext}`,
    },
    ...(body.chatHistory || []).slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: body.message },
  ];

  const client = createOpenRouterClient();

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start streaming in the background
  (async () => {
    let fullResponse = '';

    try {
      const contentStream = client.chatStream({
        model: MODELS.CLAUDE_SONNET,
        messages,
        temperature: 0.3,
        maxTokens: 2048,
      });

      // Stream text chunks while accumulating the full response
      for await (const chunk of contentStream) {
        fullResponse += chunk;

        // Send text chunk as SSE event
        const sseData = JSON.stringify({ type: 'text', content: chunk });
        await writer.write(encoder.encode(`data: ${sseData}\n\n`));
      }

      // After streaming completes, extract edits from the full response
      // Note: text is already streamed, we only need the edits
      const { edits } = extractEdits(fullResponse);

      // Determine confidence based on edit extraction success
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      if (edits.length > 0) {
        confidence = 'high';
      } else if (fullResponse.includes('```json')) {
        // JSON was present but couldn't be parsed
        confidence = 'low';
      }

      // If edits were found, send them as a separate event
      if (edits.length > 0) {
        const editsData = JSON.stringify({
          type: 'edits',
          pendingEdits: edits,
          confidence,
        });
        await writer.write(encoder.encode(`data: ${editsData}\n\n`));
      } else if (fullResponse.includes('```json')) {
        // JSON was in the response but extraction failed - send error
        const errorData = JSON.stringify({
          type: 'error',
          error: 'Could not extract valid edit data from response. Please try rephrasing your edit request.',
        });
        await writer.write(encoder.encode(`data: ${errorData}\n\n`));
      }

      // Estimate costs (approximate based on token count)
      const estimatedPromptTokens = Math.ceil(JSON.stringify(messages).length / 4);
      const estimatedCompletionTokens = Math.ceil(fullResponse.length / 4);
      const estimatedCost = (estimatedPromptTokens * 0.000003) + (estimatedCompletionTokens * 0.000015);

      // Calculate total cost (classification + edit generation)
      const totalCost = classificationResult.cost + estimatedCost;
      const totalTokens = classificationResult.usage.totalTokens + estimatedPromptTokens + estimatedCompletionTokens;

      // Send completion event with metadata
      const doneData = JSON.stringify({
        type: 'done',
        done: true,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: totalTokens,
          cost: totalCost,
          classificationCost: classificationResult.cost,
          classificationTokens: classificationResult.usage.totalTokens,
          intentType: intent.type,
          intentSection: intent.section,
          editsFound: edits.length,
          confidence,
        },
      });
      await writer.write(encoder.encode(`data: ${doneData}\n\n`));

    } catch (error) {
      console.error('Edit streaming error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Streaming failed';

      // Send error event
      const errorData = JSON.stringify({
        type: 'error',
        error: `Failed to process edit request: ${errorMessage}`,
      });
      await writer.write(encoder.encode(`data: ${errorData}\n\n`));

      // Still send done event so client knows stream is complete
      const doneData = JSON.stringify({
        type: 'done',
        done: true,
        error: true,
        metadata: {
          processingTime: Date.now() - startTime,
          classificationCost: classificationResult.cost,
          classificationTokens: classificationResult.usage.totalTokens,
          intentType: intent.type,
        },
      });
      await writer.write(encoder.encode(`data: ${doneData}\n\n`));

    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Handle edit/explain with regular JSON response (no streaming)
 */
async function handleNonStreamingResponse(
  body: StreamChatRequest,
  intent: EditIntent | ExplainIntent,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  // For explain intent, use the dedicated explain agent
  if (intent.type === 'explain') {
    return handleExplainResponse(body, intent, classificationResult, startTime);
  }

  // For edit intent, use the existing flow
  return handleEditResponse(body, intent, classificationResult, startTime);
}

/**
 * Handle explain requests using the dedicated explain agent
 */
async function handleExplainResponse(
  body: StreamChatRequest,
  intent: ExplainIntent,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  try {
    // Validate blueprint data
    if (!body.blueprint || Object.keys(body.blueprint).length === 0) {
      return new Response(
        JSON.stringify({
          response: 'I need blueprint data to explain the reasoning. Please make sure you have a generated blueprint.',
          confidence: 'low',
          isExplanation: false,
          metadata: {
            tokensUsed: 0,
            cost: classificationResult.cost,
            classificationCost: classificationResult.cost,
            classificationTokens: classificationResult.usage.totalTokens,
            processingTime: Date.now() - startTime,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use the classified ExplainIntent directly (no need for extractExplainIntentFromMessage)
    // The LLM classifier has already extracted section, field, and whatToExplain

    // Build context for the explain agent
    const explainContext: ExplainContext = {
      fullBlueprint: body.blueprint,
      intent: intent,
      chatHistory: body.chatHistory,
    };

    // Call the explain agent
    const explainResult = await handleExplain(explainContext);

    // Convert RelatedFactor type for response
    const relatedFactors: RelatedFactor[] = explainResult.relatedFactors.map(rf => ({
      section: rf.section,
      factor: rf.factor,
      relevance: rf.relevance,
    }));

    // Calculate total cost (classification + explanation)
    const totalCost = classificationResult.cost + explainResult.cost;
    const totalTokens = classificationResult.usage.totalTokens + explainResult.usage.totalTokens;

    const response = {
      response: explainResult.explanation,
      confidence: explainResult.confidence,
      relatedFactors: relatedFactors.length > 0 ? relatedFactors : undefined,
      isExplanation: true,
      metadata: {
        tokensUsed: totalTokens,
        cost: totalCost,
        classificationCost: classificationResult.cost,
        classificationTokens: classificationResult.usage.totalTokens,
        intentType: intent.type,
        intentSection: intent.section,
        processingTime: Date.now() - startTime,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Explain agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        response: `I encountered an error while generating the explanation. Please try rephrasing your question.`,
        confidence: 'low',
        isExplanation: false,
        error: errorMessage,
        metadata: {
          tokensUsed: classificationResult.usage.totalTokens,
          cost: classificationResult.cost,
          classificationCost: classificationResult.cost,
          classificationTokens: classificationResult.usage.totalTokens,
          processingTime: Date.now() - startTime,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle edit requests with the existing flow
 * Uses the classified EditIntent to provide context about what the user wants to change
 */
async function handleEditResponse(
  body: StreamChatRequest,
  intent: EditIntent,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  const blueprintSummary = summarizeBlueprint(body.blueprint);
  const fullBlueprintJSON = JSON.stringify(body.blueprint, null, 2);

  // Include intent context in the prompt for better targeting
  const intentContext = intent.field
    ? `\n\nUser intent: Edit ${intent.section}${intent.field ? `.${intent.field}` : ''} - "${intent.desiredChange}"`
    : '';

  const messages = [
    { role: 'system' as const, content: FULL_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Here is the current Strategic Blueprint:\n\n${blueprintSummary}\n\n---\n\nFull Blueprint Data (for edits):\n\`\`\`json\n${fullBlueprintJSON}\n\`\`\`${intentContext}`,
    },
    ...(body.chatHistory || []).slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: body.message },
  ];

  const client = createOpenRouterClient();
  const aiResponse = await client.chat({
    model: MODELS.CLAUDE_SONNET,
    messages,
    temperature: 0.3,
    maxTokens: 2048,
  });

  // Extract edits if present
  const { text, edits } = extractEdits(aiResponse.content);

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (edits.length > 0) {
    confidence = 'high';
  }

  // Format response
  let responseText = text;

  if (edits.length > 0) {
    const editSummaries = edits.map((edit, i) =>
      `### Edit ${edits.length > 1 ? `${i + 1}: ` : ''}${edit.section} / ${edit.fieldPath}\n${edit.explanation}\n\n\`\`\`diff\n${edit.diffPreview}\n\`\`\``
    ).join('\n\n');

    responseText = `${text}\n\n**Proposed ${edits.length > 1 ? `Edits (${edits.length})` : 'Edit'}:**\n\n${editSummaries}\n\nClick **Confirm ${edits.length > 1 ? 'All' : 'Edit'}** below to apply, or **Cancel** to discard.`;
  }

  // Calculate total cost (classification + edit generation)
  const totalCost = classificationResult.cost + aiResponse.cost;
  const totalTokens = classificationResult.usage.totalTokens + aiResponse.usage.totalTokens;

  const response = {
    response: responseText,
    confidence,
    pendingEdit: edits.length === 1 ? edits[0] : undefined,
    pendingEdits: edits.length > 0 ? edits : undefined,
    metadata: {
      tokensUsed: totalTokens,
      cost: totalCost,
      classificationCost: classificationResult.cost,
      classificationTokens: classificationResult.usage.totalTokens,
      intentType: intent.type,
      intentSection: intent.section,
      processingTime: Date.now() - startTime,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle regenerate requests (not yet fully implemented)
 * Returns a placeholder response explaining the feature is coming soon
 */
async function handleRegenerateResponse(
  body: StreamChatRequest,
  intent: ChatIntent,
  classificationResult: IntentClassificationResult,
  startTime: number
): Promise<Response> {
  // For now, return a friendly message that regeneration is coming soon
  const regenerateIntent = intent as { type: 'regenerate'; section: string; instructions: string };

  const sectionNames: Record<string, string> = {
    industryMarketOverview: 'Industry & Market Overview',
    icpAnalysisValidation: 'ICP Analysis & Validation',
    offerAnalysisViability: 'Offer Analysis & Viability',
    competitorAnalysis: 'Competitor Analysis',
    crossAnalysisSynthesis: 'Cross-Analysis Synthesis',
  };

  const sectionName = sectionNames[regenerateIntent.section] || regenerateIntent.section;

  const response = {
    response: `I understand you'd like to regenerate the **${sectionName}** section${regenerateIntent.instructions ? ` with these instructions: "${regenerateIntent.instructions}"` : ''}.\n\nSection regeneration is coming soon! For now, you can:\n\n1. **Edit specific fields** - Ask me to change particular values\n2. **Ask questions** - I can explain why certain recommendations were made\n3. **Start fresh** - Generate a new blueprint from the onboarding wizard\n\nWould you like to try one of these alternatives?`,
    confidence: 'high' as const,
    isRegenerate: true,
    metadata: {
      tokensUsed: classificationResult.usage.totalTokens,
      cost: classificationResult.cost,
      classificationCost: classificationResult.cost,
      classificationTokens: classificationResult.usage.totalTokens,
      intentType: intent.type,
      processingTime: Date.now() - startTime,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}
