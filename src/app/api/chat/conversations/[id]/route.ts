// src/app/api/chat/conversations/[id]/route.ts
// Load, update, and delete a specific conversation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { LoadConversationResponse } from '@/lib/chat/types';

// Validation schema for updating a conversation
const updateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  blueprintId: z.string().uuid().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/conversations/:id
 * Load a conversation with all its messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const idValidation = uuidSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    // Fetch conversation (RLS will ensure user owns it)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError) {
      if (convError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Failed to fetch conversation:', convError);
      return NextResponse.json(
        { error: 'Failed to fetch conversation' },
        { status: 500 }
      );
    }

    // Fetch messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Failed to fetch messages:', msgError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    const response: LoadConversationResponse = {
      conversation,
      messages: messages || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Load conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat/conversations/:id
 * Update conversation metadata (title, blueprint_id)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const idValidation = uuidSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) {
      updates.title = parsed.data.title;
    }
    if (parsed.data.blueprintId !== undefined) {
      updates.blueprint_id = parsed.data.blueprintId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update conversation (RLS will ensure user owns it)
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Failed to update conversation:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation and all its messages
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const idValidation = uuidSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    // Delete conversation (RLS will ensure user owns it, cascade will delete messages)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete conversation:', error);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
