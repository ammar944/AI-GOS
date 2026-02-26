'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { createClientWithAuth } from '@/lib/supabase/client';
import {
  saveConversation,
  loadConversation,
  listConversations,
  deleteConversation,
} from '@/lib/chat/persistence';
import type { UIMessage } from 'ai';
import type { ChatConversation, ChatConversationMeta } from '@/lib/chat/persistence';

// =============================================================================
// Types
// =============================================================================

export interface UseChatPersistenceReturn {
  /** The active conversation id (may be undefined before the first save) */
  conversationId: string | undefined;
  /** Title derived from the first user message or set explicitly */
  conversationTitle: string;
  /** Metadata list of all conversations for this blueprint, newest first */
  conversations: ChatConversationMeta[];
  /** Messages loaded from storage on mount (empty array until loading is done) */
  initialMessages: UIMessage[];
  /** True while the initial conversation load is in progress */
  isLoading: boolean;
  /** Debounced (2 s) save — call this after every message exchange */
  saveMessages: (messages: UIMessage[]) => void;
  /** Switch to a different conversation and load its messages */
  loadConversationById: (id: string) => Promise<void>;
  /** Re-fetch the conversation list for this blueprint */
  refreshList: () => Promise<void>;
  /** Hard-delete a conversation; refreshes the list on success */
  deleteConversationById: (id: string) => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Provides Supabase-backed conversation persistence for the chat agent.
 *
 * Usage:
 *   const { initialMessages, saveMessages, conversationId, ... } =
 *     useChatPersistence(blueprintId, conversationId);
 *
 * - If `conversationId` is provided on mount the corresponding conversation is
 *   loaded and its messages are returned as `initialMessages`.
 * - After each message exchange, call `saveMessages(messages)`. Saves are
 *   debounced by 2 s to avoid hammering the DB on rapid token streaming.
 * - All persistence failures are caught and logged — they never crash the chat.
 */
export function useChatPersistence(
  blueprintId?: string,
  conversationId?: string
): UseChatPersistenceReturn {
  const { session } = useSession();
  const { user } = useUser();

  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(
    conversationId
  );
  const [conversationTitle, setConversationTitle] = useState<string>('New conversation');
  const [conversations, setConversations] = useState<ChatConversationMeta[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!conversationId);

  // Keep the current conversation id in a ref so the debounced save callback
  // always sees the latest value without triggering re-renders.
  const conversationIdRef = useRef<string | undefined>(conversationId);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Supabase client factory — recreated only when the Clerk session changes
  // ---------------------------------------------------------------------------

  const getSupabase = useCallback(() => {
    return createClientWithAuth(async () => {
      if (!session) return null;
      return session.getToken({ template: 'supabase' });
    });
  }, [session]);

  // ---------------------------------------------------------------------------
  // Load the initial conversation on mount (if an id was provided)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !session) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInitial() {
      setIsLoading(true);
      try {
        const supabase = getSupabase();
        const conversation: ChatConversation | null = await loadConversation(
          supabase,
          conversationId!
        );

        if (cancelled) return;

        if (conversation) {
          setInitialMessages(conversation.messages);
          setConversationTitle(conversation.title);
          conversationIdRef.current = conversation.id;
          setCurrentConversationId(conversation.id);
        }
      } catch (err) {
        // Never crash — just log
        console.error('[useChatPersistence] Failed to load initial conversation:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
    // session is intentionally included: re-run if auth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session]);

  // ---------------------------------------------------------------------------
  // Fetch the conversation list whenever blueprintId or session changes
  // ---------------------------------------------------------------------------

  const refreshList = useCallback(async () => {
    if (!blueprintId || !user?.id || !session) return;

    try {
      const supabase = getSupabase();
      const list = await listConversations(supabase, user.id, blueprintId);
      setConversations(list);
    } catch (err) {
      console.error('[useChatPersistence] Failed to refresh conversation list:', err);
    }
  }, [blueprintId, user?.id, session, getSupabase]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // ---------------------------------------------------------------------------
  // Debounced save
  // ---------------------------------------------------------------------------

  const saveMessages = useCallback(
    (messages: UIMessage[]) => {
      if (!blueprintId || !user?.id || !session) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const supabase = getSupabase();
          const savedId = await saveConversation(supabase, {
            conversationId: conversationIdRef.current,
            userId: user.id,
            blueprintId: blueprintId,
            messages,
          });

          if (savedId && savedId !== conversationIdRef.current) {
            // First-time save — capture the newly created id
            conversationIdRef.current = savedId;
            setCurrentConversationId(savedId);
          }

          // Update the title from the latest state
          // UIMessage v6 uses parts[] instead of content
          const firstUser = messages.find((m) => m.role === 'user');
          if (firstUser) {
            const textPart = firstUser.parts.find(
              (p): p is { type: 'text'; text: string } => p.type === 'text'
            );
            const text = textPart?.text ?? '';
            if (text) {
              setConversationTitle(text.slice(0, 60).trim());
            }
          }

          // Keep the list in sync after each save
          await refreshList();
        } catch (err) {
          console.error('[useChatPersistence] Failed to save messages:', err);
        }
      }, 2000);
    },
    [blueprintId, user?.id, session, getSupabase, refreshList]
  );

  // Clean up pending debounce on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load a specific conversation by id (user-triggered switch)
  // ---------------------------------------------------------------------------

  const loadConversationById = useCallback(
    async (id: string) => {
      if (!session) return;

      setIsLoading(true);
      try {
        const supabase = getSupabase();
        const conversation = await loadConversation(supabase, id);

        if (conversation) {
          setInitialMessages(conversation.messages);
          setConversationTitle(conversation.title);
          conversationIdRef.current = conversation.id;
          setCurrentConversationId(conversation.id);
        }
      } catch (err) {
        console.error('[useChatPersistence] Failed to load conversation by id:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [session, getSupabase]
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const deleteConversationById = useCallback(
    async (id: string) => {
      if (!session) return;

      if (!user?.id) return;

      try {
        const supabase = getSupabase();
        const ok = await deleteConversation(supabase, id, user.id);

        if (ok) {
          // If the deleted conversation was the active one, reset state
          if (conversationIdRef.current === id) {
            conversationIdRef.current = undefined;
            setCurrentConversationId(undefined);
            setInitialMessages([]);
            setConversationTitle('New conversation');
          }
          await refreshList();
        }
      } catch (err) {
        console.error('[useChatPersistence] Failed to delete conversation:', err);
      }
    },
    [session, user?.id, getSupabase, refreshList]
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    conversationId: currentConversationId,
    conversationTitle,
    conversations,
    initialMessages,
    isLoading,
    saveMessages,
    loadConversationById,
    refreshList,
    deleteConversationById,
  };
}
