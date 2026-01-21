// src/app/api/chat/conversations/route.ts
// Create and list chat conversations

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type {
  CreateConversationResponse,
  ListConversationsResponse,
} from '@/lib/chat/types';
import {
  unauthorizedResponse,
  handleSupabaseError,
  isRLSError,
} from '@/lib/auth/errors';

// Validation schema for creating a conversation
const createConversationSchema = z.object({
  blueprintId: z.string().uuid().optional(),
  title: z.string().max(255).optional(),
});

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return unauthorizedResponse('Authentication required');
    }

    const supabase = await createClient();

    // Parse and validate request body
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { blueprintId, title } = parsed.data;

    // Create conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        blueprint_id: blueprintId || null,
        title: title || null,
      })
      .select('id')
      .single();

    if (error) {
      if (isRLSError(error)) {
        return handleSupabaseError(error);
      }
      console.error('Failed to create conversation:', error);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    const response: CreateConversationResponse = {
      conversationId: data.id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/conversations?blueprintId=xxx
 * List conversations, optionally filtered by blueprint
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return unauthorizedResponse('Authentication required');
    }

    const supabase = await createClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const blueprintId = searchParams.get('blueprintId');

    // Build query - RLS policies will also filter by user_id
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    // Filter by blueprint if provided
    if (blueprintId) {
      query = query.eq('blueprint_id', blueprintId);
    }

    const { data, error } = await query;

    if (error) {
      if (isRLSError(error)) {
        return handleSupabaseError(error);
      }
      console.error('Failed to list conversations:', error);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to list conversations' },
        { status: 500 }
      );
    }

    const response: ListConversationsResponse = {
      conversations: data || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
