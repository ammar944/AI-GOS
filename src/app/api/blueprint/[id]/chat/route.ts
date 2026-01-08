// src/app/api/blueprint/[id]/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveRelevantChunks } from '@/lib/chat/retrieval';
import { answerQuestion } from '@/lib/chat/agents/qa-agent';
import { handleEdit, EditResult } from '@/lib/chat/agents/edit-agent';
import { classifyIntent } from '@/lib/chat/intent-router';
import { ChatIntent, EditIntent } from '@/lib/chat/types';

interface ChatRequest {
  message: string;
  conversationId?: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

interface ChatResponse {
  conversationId: string;
  response: string;
  intent: ChatIntent;
  sources: {
    chunkId: string;
    section: string;
    fieldPath: string;
    similarity: number;
  }[];
  confidence: 'high' | 'medium' | 'low';
  metadata: {
    tokensUsed: number;
    cost: number;
    processingTime: number;
    intentClassificationCost: number;
  };
  /** Edit result for confirmation flow */
  pendingAction?: {
    type: 'edit';
    editResult: EditResult;
  };
}

/**
 * Fetch full section data for edit context
 */
async function fetchFullSection(
  blueprintId: string,
  section: string
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blueprints')
    .select('output')
    .eq('id', blueprintId)
    .single();

  if (error || !data?.output) {
    return null;
  }

  return data.output[section] || null;
}

/**
 * Format edit response message with diff preview
 */
function formatEditResponse(editResult: EditResult): string {
  return `I'll make this change:

**Section:** ${editResult.section}
**Field:** ${editResult.fieldPath}
**Change:** ${editResult.explanation}

\`\`\`diff
${editResult.diffPreview}
\`\`\`

Reply **'confirm'** to apply this edit or **'cancel'** to discard.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: blueprintId } = await params;

  try {
    const body: ChatRequest = await request.json();

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const conversationId = body.conversationId || crypto.randomUUID();

    // 1. Classify intent
    const intentResult = await classifyIntent(body.message);
    const { intent } = intentResult;

    // 2. Route based on intent type
    let responseText: string;
    let qaConfidence: 'high' | 'medium' | 'low' = 'medium';
    let tokensUsed = intentResult.usage.totalTokens;
    let totalCost = intentResult.cost;
    let chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>>['chunks'] = [];
    let embeddingCost = 0;
    let pendingAction: ChatResponse['pendingAction'] = undefined;

    switch (intent.type) {
      case 'question':
      case 'general': {
        // Handle questions and general conversation with Q&A agent
        const retrievalResult = await retrieveRelevantChunks({
          blueprintId,
          query: body.message,
          matchCount: 5,
          matchThreshold: 0.65,
        });
        chunks = retrievalResult.chunks;
        embeddingCost = retrievalResult.embeddingCost;

        const qaResult = await answerQuestion({
          query: body.message,
          chunks,
          chatHistory: body.chatHistory,
        });

        responseText = qaResult.answer;
        qaConfidence = qaResult.confidence;
        tokensUsed += qaResult.usage.totalTokens;
        totalCost += qaResult.cost + embeddingCost;
        break;
      }

      case 'edit': {
        // Handle edit with edit agent
        const editIntent = intent as EditIntent;
        const fullSection = await fetchFullSection(blueprintId, editIntent.section);

        if (!fullSection) {
          responseText = `I couldn't find the ${editIntent.section} section in this blueprint. Please check that the blueprint exists and has been generated.`;
          break;
        }

        try {
          const editResponse = await handleEdit({
            fullSection,
            intent: editIntent,
            chatHistory: body.chatHistory,
          });

          // Track costs
          tokensUsed += editResponse.usage.totalTokens;
          totalCost += editResponse.cost;

          // Format response with diff preview
          responseText = formatEditResponse(editResponse.result);

          // Set pending action for confirmation flow
          pendingAction = {
            type: 'edit',
            editResult: editResponse.result,
          };
        } catch (editError) {
          console.error('Edit agent error:', editError);
          responseText = `I encountered an error while preparing the edit. Please try rephrasing your request. Error: ${editError instanceof Error ? editError.message : 'Unknown error'}`;
        }
        break;
      }

      case 'explain':
        // Placeholder for explain capability (Phase 17)
        responseText = `I understand you want an explanation about ${intent.whatToExplain || intent.field || 'something'} in the ${intent.section} section. Explain capability is coming soon. For now, I can answer questions about your blueprint.`;
        break;

      case 'regenerate':
        // Placeholder for regenerate capability (future)
        responseText = `I understand you want to regenerate the ${intent.section} section${intent.instructions ? ` with instructions: "${intent.instructions}"` : ''}. Regenerate capability is coming soon. For now, I can answer questions about your blueprint.`;
        break;

      default:
        responseText = "I'm here to help you with your Strategic Blueprint. You can ask me questions about your blueprint, and soon you'll be able to make edits, get explanations, and regenerate sections.";
    }

    // 3. Build response
    const response: ChatResponse = {
      conversationId,
      response: responseText,
      intent,
      sources: chunks.map(c => ({
        chunkId: c.id,
        section: c.section,
        fieldPath: c.fieldPath,
        similarity: c.similarity || 0,
      })),
      confidence: qaConfidence,
      metadata: {
        tokensUsed,
        cost: totalCost,
        processingTime: Date.now() - startTime,
        intentClassificationCost: intentResult.cost,
      },
      pendingAction,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Chat error:', error);

    // More detailed error info
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { message, stack, blueprintId });

    return NextResponse.json(
      { error: 'Failed to process chat message', details: message },
      { status: 500 }
    );
  }
}
