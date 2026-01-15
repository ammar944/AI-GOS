// src/app/api/chat/messages/save/route.ts
// Save a chat message to an existing conversation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { SaveMessageResponse } from '@/lib/chat/types';

// Validation schema for saving a message
const saveMessageSchema = z.object({
  conversationId: z.string().uuid(),
  blueprintId: z.string().uuid().optional(),
  message: z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    confidenceExplanation: z.string().optional(),
    intent: z.string().optional(),
    sources: z.array(z.unknown()).optional(),
    sourceQuality: z
      .object({
        avgRelevance: z.number(),
        sourceCount: z.number(),
        highQualitySources: z.number(),
        explanation: z.string(),
      })
      .optional(),
    pendingEdits: z
      .array(
        z.object({
          section: z.string(),
          fieldPath: z.string(),
          oldValue: z.unknown(),
          newValue: z.unknown(),
          explanation: z.string(),
          diffPreview: z.string(),
        })
      )
      .optional(),
    tokensUsed: z.number().int().positive().optional(),
    cost: z.number().nonnegative().optional(),
  }),
});

/**
 * POST /api/chat/messages/save
 * Save a message to an existing conversation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = saveMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { conversationId, blueprintId, message } = parsed.data;

    // Verify conversation exists and user owns it
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, blueprint_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Optionally update blueprint_id if provided and different
    if (blueprintId && conversation.blueprint_id !== blueprintId) {
      await supabase
        .from('conversations')
        .update({ blueprint_id: blueprintId })
        .eq('id', conversationId);
    }

    // Insert the message
    const { data: savedMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        confidence: message.confidence || null,
        confidence_explanation: message.confidenceExplanation || null,
        intent: message.intent || null,
        sources: message.sources ? JSON.stringify(message.sources) : null,
        source_quality: message.sourceQuality
          ? JSON.stringify(message.sourceQuality)
          : null,
        pending_edits: message.pendingEdits
          ? JSON.stringify(message.pendingEdits)
          : null,
        tokens_used: message.tokensUsed || null,
        cost: message.cost || null,
      })
      .select('id')
      .single();

    if (msgError) {
      console.error('Failed to save message:', msgError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    const response: SaveMessageResponse = {
      messageId: savedMessage.id,
      conversationId,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Save message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
