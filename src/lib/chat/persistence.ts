import type { SupabaseClient } from '@supabase/supabase-js';
import type { UIMessage } from 'ai';

// =============================================================================
// Types
// =============================================================================

export interface ChatConversation {
  id: string;
  user_id: string;
  blueprint_id: string;
  messages: UIMessage[];
  title: string;
  created_at: string;
  updated_at: string;
}

/** Metadata-only view — messages are excluded for list queries */
export type ChatConversationMeta = Omit<ChatConversation, 'messages'>;

export interface SaveConversationParams {
  conversationId?: string;
  userId: string;
  blueprintId: string;
  messages: UIMessage[];
  title?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Derive a short title from the first user message in the array.
 * UIMessage v6 stores content in `parts`; we find the first TextUIPart.
 * Truncates to 60 characters and falls back to a default string.
 */
function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';

  // UIMessage in AI SDK v6 stores content in `parts`
  const textPart = firstUser.parts.find(
    (p): p is { type: 'text'; text: string } => p.type === 'text'
  );
  const text = textPart?.text ?? '';

  return text.slice(0, 60).trim() || 'New conversation';
}

// =============================================================================
// CRUD operations
// =============================================================================

/**
 * Upsert a chat conversation.
 *
 * - If `conversationId` is provided the existing row is updated.
 * - If not, a new row is created with a freshly generated UUID.
 *
 * Title resolution order:
 *   1. Explicitly passed `title` param
 *   2. Auto-derived from the first user message
 *   3. Fallback: "New conversation"
 *
 * Returns the conversation id (existing or newly created).
 * Never throws — logs errors and returns null on failure.
 */
export async function saveConversation(
  supabase: SupabaseClient,
  params: SaveConversationParams
): Promise<string | null> {
  const { conversationId, userId, blueprintId, messages, title } = params;

  const resolvedTitle = title?.trim() || deriveTitle(messages);
  const now = new Date().toISOString();

  try {
    if (conversationId) {
      // Update existing row
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          messages: messages as unknown as Record<string, unknown>[],
          title: resolvedTitle,
          updated_at: now,
        })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        console.error('[chat/persistence] Failed to update conversation:', error.message);
        return null;
      }

      return conversationId;
    }

    // Create new row
    const id = crypto.randomUUID();
    const { error } = await supabase.from('chat_conversations').insert({
      id,
      user_id: userId,
      blueprint_id: blueprintId,
      messages: messages as unknown as Record<string, unknown>[],
      title: resolvedTitle,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      console.error('[chat/persistence] Failed to create conversation:', error.message);
      return null;
    }

    return id;
  } catch (err) {
    console.error('[chat/persistence] Unexpected error in saveConversation:', err);
    return null;
  }
}

/**
 * Fetch a single conversation by id, including its full message history.
 * Returns null if not found or on error.
 */
export async function loadConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<ChatConversation | null> {
  try {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, user_id, blueprint_id, messages, title, created_at, updated_at')
      .eq('id', conversationId)
      .single();

    if (error) {
      // PGRST116 = no rows returned — not an application error
      if (error.code !== 'PGRST116') {
        console.error('[chat/persistence] Failed to load conversation:', error.message);
      }
      return null;
    }

    return data as ChatConversation;
  } catch (err) {
    console.error('[chat/persistence] Unexpected error in loadConversation:', err);
    return null;
  }
}

/**
 * List all conversations for a given user + blueprint, ordered by most recently
 * updated first. Messages are excluded to keep the payload small.
 *
 * Returns an empty array on error.
 */
export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  blueprintId: string
): Promise<ChatConversationMeta[]> {
  try {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, created_at, updated_at, blueprint_id, user_id')
      .eq('user_id', userId)
      .eq('blueprint_id', blueprintId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[chat/persistence] Failed to list conversations:', error.message);
      return [];
    }

    return (data ?? []) as ChatConversationMeta[];
  } catch (err) {
    console.error('[chat/persistence] Unexpected error in listConversations:', err);
    return [];
  }
}

/**
 * Hard-delete a conversation by id.
 * Returns true on success, false on failure.
 */
export async function deleteConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('[chat/persistence] Failed to delete conversation:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[chat/persistence] Unexpected error in deleteConversation:', err);
    return false;
  }
}
