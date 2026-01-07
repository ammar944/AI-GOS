// src/app/api/blueprint/[id]/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantChunks } from '@/lib/chat/retrieval';
import { answerQuestion, QAResponse } from '@/lib/chat/agents/qa-agent';

interface ChatRequest {
  message: string;
  conversationId?: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

interface ChatResponse {
  conversationId: string;
  response: string;
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
  };
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

    // 1. Retrieve relevant chunks
    const { chunks, embeddingCost } = await retrieveRelevantChunks({
      blueprintId,
      query: body.message,
      matchCount: 5,
      matchThreshold: 0.65, // Slightly lower for better recall
    });

    // 2. Generate answer using Q&A agent
    const qaResult = await answerQuestion({
      query: body.message,
      chunks,
      chatHistory: body.chatHistory,
    });

    // 3. Build response
    const response: ChatResponse = {
      conversationId,
      response: qaResult.answer,
      sources: chunks.map(c => ({
        chunkId: c.id,
        section: c.section,
        fieldPath: c.fieldPath,
        similarity: c.similarity || 0,
      })),
      confidence: qaResult.confidence,
      metadata: {
        tokensUsed: qaResult.usage.totalTokens,
        cost: qaResult.cost + embeddingCost,
        processingTime: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Chat error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process chat message', details: message },
      { status: 500 }
    );
  }
}
