// src/app/api/chat/blueprint/stream/route.ts
// Streaming chat API - SSE endpoint for real-time Q&A responses

import { NextRequest } from 'next/server';
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';

interface StreamChatRequest {
  message: string;
  blueprint: Record<string, unknown>;
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

/**
 * Detect intent from message (simple heuristics for streaming decision)
 * Returns 'qa' for questions/general, 'edit' for edit requests, 'explain' for explanations
 */
function detectIntent(message: string): 'qa' | 'edit' | 'explain' {
  const lowerMessage = message.toLowerCase();

  // Edit indicators
  const editPatterns = [
    /\b(change|update|modify|edit|fix|replace|set|make)\b/,
    /\b(should be|needs to be|ought to be)\b/,
    /\brewrite\b/,
    /\brename\b/,
  ];

  for (const pattern of editPatterns) {
    if (pattern.test(lowerMessage)) {
      return 'edit';
    }
  }

  // Explain indicators
  const explainPatterns = [
    /\bwhy\s+(is|does|did|was|were|do|are)\b/,
    /\bexplain\b/,
    /\bhow come\b/,
    /\bwhat.+reasoning\b/,
    /\bwhy.+recommend/,
    /\bwhy.+chose/,
  ];

  for (const pattern of explainPatterns) {
    if (pattern.test(lowerMessage)) {
      return 'explain';
    }
  }

  // Default to Q&A (can be streamed)
  return 'qa';
}

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

    // Detect intent to decide streaming vs non-streaming
    const intent = detectIntent(body.message);

    // For edit and explain intents, return regular JSON (need structured data)
    if (intent === 'edit' || intent === 'explain') {
      return handleNonStreamingResponse(body, intent, startTime);
    }

    // For Q&A intent, stream the response
    return handleStreamingResponse(body, startTime);

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
 */
async function handleStreamingResponse(
  body: StreamChatRequest,
  startTime: number
): Promise<Response> {
  const blueprintSummary = summarizeBlueprint(body.blueprint);

  const messages = [
    { role: 'system' as const, content: STREAMING_QA_PROMPT },
    {
      role: 'user' as const,
      content: `Here is the Strategic Blueprint:\n\n${blueprintSummary}`,
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
    try {
      const contentStream = client.chatStream({
        model: MODELS.CLAUDE_SONNET,
        messages,
        temperature: 0.3,
        maxTokens: 1024,
      });

      for await (const chunk of contentStream) {
        // Send SSE format: data: {"content": "..."}\n\n
        const sseData = JSON.stringify({ content: chunk });
        await writer.write(encoder.encode(`data: ${sseData}\n\n`));
      }

      // Send completion event with metadata
      const doneData = JSON.stringify({
        done: true,
        metadata: {
          processingTime: Date.now() - startTime,
        },
      });
      await writer.write(encoder.encode(`data: ${doneData}\n\n`));

    } catch (error) {
      console.error('Streaming error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Streaming failed';
      const errorData = JSON.stringify({ error: errorMessage });
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
 * Handle edit/explain with regular JSON response (no streaming)
 */
async function handleNonStreamingResponse(
  body: StreamChatRequest,
  intent: 'edit' | 'explain',
  startTime: number
): Promise<Response> {
  const blueprintSummary = summarizeBlueprint(body.blueprint);
  const fullBlueprintJSON = JSON.stringify(body.blueprint, null, 2);

  const messages = [
    { role: 'system' as const, content: FULL_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Here is the current Strategic Blueprint:\n\n${blueprintSummary}\n\n---\n\nFull Blueprint Data (for edits):\n\`\`\`json\n${fullBlueprintJSON}\n\`\`\``,
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

  // Extract explanations if present (only if no edits)
  const explainResult = edits.length === 0 ? extractExplanation(aiResponse.content) : null;
  const hasExplanation = explainResult?.explanation !== null;

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (edits.length > 0) {
    confidence = 'high';
  } else if (hasExplanation && explainResult?.confidence) {
    confidence = explainResult.confidence;
  }

  // Format response
  let responseText = hasExplanation ? (explainResult?.text || text) : text;
  let relatedFactors: RelatedFactor[] | undefined;

  if (edits.length > 0) {
    const editSummaries = edits.map((edit, i) =>
      `### Edit ${edits.length > 1 ? `${i + 1}: ` : ''}${edit.section} / ${edit.fieldPath}\n${edit.explanation}\n\n\`\`\`diff\n${edit.diffPreview}\n\`\`\``
    ).join('\n\n');

    responseText = `${text}\n\n**Proposed ${edits.length > 1 ? `Edits (${edits.length})` : 'Edit'}:**\n\n${editSummaries}\n\nClick **Confirm ${edits.length > 1 ? 'All' : 'Edit'}** below to apply, or **Cancel** to discard.`;
  } else if (hasExplanation && explainResult) {
    responseText = explainResult.explanation || responseText;
    relatedFactors = explainResult.relatedFactors;
  }

  const response = {
    response: responseText,
    confidence,
    pendingEdit: edits.length === 1 ? edits[0] : undefined,
    pendingEdits: edits.length > 0 ? edits : undefined,
    relatedFactors: relatedFactors && relatedFactors.length > 0 ? relatedFactors : undefined,
    isExplanation: hasExplanation || undefined,
    metadata: {
      tokensUsed: aiResponse.usage.totalTokens,
      cost: aiResponse.cost,
      processingTime: Date.now() - startTime,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}
