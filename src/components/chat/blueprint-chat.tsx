'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatPanel } from './chat-panel';
import { MessageBubble, SourceQuality, SourceReference } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { QuickSuggestions } from './quick-suggestions';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { GradientBorder } from '@/components/ui/gradient-border';
import { springs } from '@/lib/motion';
import type { ChatMessageRecord, PendingEdit as DbPendingEdit, EditHistoryEntry, EditHistoryState } from '@/lib/chat/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  confidenceExplanation?: string;
  sourceQuality?: SourceQuality;
  sources?: SourceReference[];
  /** Whether this message contains an edit proposal */
  isEditProposal?: boolean;
  /** Streaming state tracking */
  streamingState?: 'text' | 'awaiting-edits' | 'complete';
  /** Token usage for assistant messages */
  tokensUsed?: number;
  /** Cost for assistant messages */
  cost?: number;
}

interface PendingEdit {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

interface BlueprintChatProps {
  /** The full blueprint data - chat works with this directly, no DB required */
  blueprint: Record<string, unknown>;
  /** Blueprint ID for persistence */
  blueprintId?: string;
  /** Optional existing conversation ID to load */
  conversationId?: string;
  className?: string;
  /** Callback when an edit is confirmed - receives the updated blueprint */
  onBlueprintUpdate?: (updatedBlueprint: Record<string, unknown>) => void;
}

// Section labels for display (moved outside component for use in callbacks)
const SECTION_LABELS: Record<string, string> = {
  industryMarketOverview: 'Industry & Market',
  icpAnalysisValidation: 'ICP Analysis',
  offerAnalysisViability: 'Offer Analysis',
  competitorAnalysis: 'Competitors',
  crossAnalysisSynthesis: 'Synthesis',
};

export function BlueprintChat({
  blueprint,
  blueprintId,
  conversationId: initialConversationId,
  className,
  onBlueprintUpdate
}: BlueprintChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  // Persistence state
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const conversationCreatedRef = useRef(false);

  // Edit history state (undo/redo)
  const [editHistory, setEditHistory] = useState<EditHistoryState>({
    history: [],
    currentIndex: -1,
    maxDepth: 50
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // SessionStorage key for edit history persistence
  const historyStorageKey = blueprintId ? `blueprint-edit-history-${blueprintId}` : null;

  /**
   * Generate a human-readable label for a set of edits
   */
  const generateEditLabel = useCallback((edits: PendingEdit[]): string => {
    if (edits.length === 1) {
      const edit = edits[0];
      const sectionLabel = SECTION_LABELS[edit.section] || edit.section;
      return `${sectionLabel}: ${edit.fieldPath}`;
    }
    const uniqueSections = [...new Set(edits.map(e => SECTION_LABELS[e.section] || e.section))];
    if (uniqueSections.length === 1) {
      return `${edits.length} edits in ${uniqueSections[0]}`;
    }
    return `${edits.length} edits across ${uniqueSections.length} sections`;
  }, []);

  /**
   * Record a batch of edits in history for undo/redo
   */
  const recordEditInHistory = useCallback((
    blueprintBefore: Record<string, unknown>,
    blueprintAfter: Record<string, unknown>,
    edits: PendingEdit[]
  ) => {
    const entry: EditHistoryEntry = {
      id: crypto.randomUUID(),
      appliedAt: new Date(),
      edits,
      blueprintBefore,
      blueprintAfter,
      label: generateEditLabel(edits)
    };

    setEditHistory(prev => {
      // If we're not at the end, trim future entries (user did undo then made new edit)
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(entry);

      // Enforce max depth
      if (newHistory.length > prev.maxDepth) {
        newHistory.shift();
      }

      return {
        ...prev,
        history: newHistory,
        currentIndex: newHistory.length - 1
      };
    });
  }, [generateEditLabel]);

  /**
   * Handle undo - restore previous blueprint state
   */
  const handleUndo = useCallback(() => {
    if (editHistory.currentIndex < 0) return;

    const entry = editHistory.history[editHistory.currentIndex];
    const previousBlueprint = entry.blueprintBefore;

    // Apply the previous state
    onBlueprintUpdate?.(previousBlueprint);

    // Move back in history
    setEditHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex - 1
    }));

    // Add undo message to chat
    const undoMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Undid: ${entry.label}`
    };
    setMessages(prev => [...prev, undoMessage]);
  }, [editHistory, onBlueprintUpdate]);

  /**
   * Handle redo - reapply previously undone edit
   */
  const handleRedo = useCallback(() => {
    if (editHistory.currentIndex >= editHistory.history.length - 1) return;

    const nextEntry = editHistory.history[editHistory.currentIndex + 1];

    // Apply the next state
    onBlueprintUpdate?.(nextEntry.blueprintAfter);

    // Move forward in history
    setEditHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1
    }));

    // Add redo message to chat
    const redoMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Reapplied: ${nextEntry.label}`
    };
    setMessages(prev => [...prev, redoMessage]);
  }, [editHistory, onBlueprintUpdate]);

  // Derived undo/redo state
  const canUndo = editHistory.currentIndex >= 0;
  const canRedo = editHistory.currentIndex < editHistory.history.length - 1;
  const undoDepth = editHistory.currentIndex + 1;

  // Load edit history from sessionStorage on mount
  useEffect(() => {
    if (!historyStorageKey) return;

    try {
      const stored = sessionStorage.getItem(historyStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as EditHistoryState;
        // Restore dates from ISO strings
        parsed.history = parsed.history.map(entry => ({
          ...entry,
          appliedAt: new Date(entry.appliedAt)
        }));
        setEditHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load edit history from sessionStorage:', error);
    }
  }, [historyStorageKey]);

  // Persist edit history to sessionStorage on change
  useEffect(() => {
    if (!historyStorageKey) return;

    try {
      sessionStorage.setItem(historyStorageKey, JSON.stringify(editHistory));
    } catch (error) {
      console.error('Failed to save edit history to sessionStorage:', error);
    }
  }, [editHistory, historyStorageKey]);

  /**
   * Transform database message record to component Message format
   */
  const dbMessageToComponentMessage = useCallback((dbMsg: ChatMessageRecord): Message => {
    // Parse JSON strings if needed (DB stores as JSON strings)
    let sources = dbMsg.sources;
    let sourceQuality = dbMsg.source_quality;
    let pendingEditsFromDb = dbMsg.pending_edits;

    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch { sources = null; }
    }
    if (typeof sourceQuality === 'string') {
      try { sourceQuality = JSON.parse(sourceQuality); } catch { sourceQuality = null; }
    }
    if (typeof pendingEditsFromDb === 'string') {
      try { pendingEditsFromDb = JSON.parse(pendingEditsFromDb); } catch { pendingEditsFromDb = null; }
    }

    return {
      id: dbMsg.id,
      role: dbMsg.role,
      content: dbMsg.content,
      confidence: dbMsg.confidence ?? undefined,
      confidenceExplanation: dbMsg.confidence_explanation ?? undefined,
      sourceQuality: sourceQuality as SourceQuality | undefined,
      sources: sources as SourceReference[] | undefined,
      isEditProposal: !!(pendingEditsFromDb && (pendingEditsFromDb as DbPendingEdit[]).length > 0),
      streamingState: 'complete',
      tokensUsed: dbMsg.tokens_used ?? undefined,
      cost: dbMsg.cost ?? undefined,
    };
  }, []);

  /**
   * Save a message to the database (non-blocking)
   */
  const saveMessage = useCallback(async (
    convId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
      confidence?: 'high' | 'medium' | 'low';
      confidenceExplanation?: string;
      sources?: SourceReference[];
      sourceQuality?: SourceQuality;
      pendingEdits?: PendingEdit[];
      tokensUsed?: number;
      cost?: number;
    }
  ): Promise<void> => {
    try {
      const response = await fetch('/api/chat/messages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          blueprintId,
          message,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save message:', await response.text());
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }, [blueprintId]);

  /**
   * Load or create a conversation for this blueprint
   */
  const loadOrCreateConversation = useCallback(async (): Promise<string | null> => {
    // Skip if already created in this session
    if (conversationCreatedRef.current && conversationId) {
      return conversationId;
    }

    setIsLoadingHistory(true);

    try {
      // If we have an initial conversationId, load that conversation
      if (initialConversationId) {
        const response = await fetch(`/api/chat/conversations/${initialConversationId}`);

        if (response.ok) {
          const data = await response.json();
          const loadedMessages = data.messages.map(dbMessageToComponentMessage);
          setMessages(loadedMessages);
          setConversationId(initialConversationId);
          conversationCreatedRef.current = true;
          return initialConversationId;
        }
      }

      // Check if there's an existing conversation for this blueprint
      if (blueprintId) {
        const listResponse = await fetch(`/api/chat/conversations?blueprintId=${blueprintId}`);

        if (listResponse.ok) {
          const listData = await listResponse.json();

          // Load the most recent conversation if one exists
          if (listData.conversations && listData.conversations.length > 0) {
            const existingConvId = listData.conversations[0].id;
            const convResponse = await fetch(`/api/chat/conversations/${existingConvId}`);

            if (convResponse.ok) {
              const convData = await convResponse.json();
              const loadedMessages = convData.messages.map(dbMessageToComponentMessage);
              setMessages(loadedMessages);
              setConversationId(existingConvId);
              conversationCreatedRef.current = true;
              return existingConvId;
            }
          }
        }

        // No existing conversation - create a new one
        const createResponse = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blueprintId }),
        });

        if (createResponse.ok) {
          const createData = await createResponse.json();
          setConversationId(createData.conversationId);
          conversationCreatedRef.current = true;
          return createData.conversationId;
        }
      }

      return null;
    } catch (error) {
      console.error('Error loading/creating conversation:', error);
      return null;
    } finally {
      setIsLoadingHistory(false);
    }
  }, [blueprintId, initialConversationId, conversationId, dbMessageToComponentMessage]);

  // Load or create conversation when panel opens and blueprintId is available
  useEffect(() => {
    if (isOpen && blueprintId && !conversationCreatedRef.current) {
      loadOrCreateConversation();
    }
  }, [isOpen, blueprintId, loadOrCreateConversation]);

  // Scroll to bottom on new messages or when pending edits appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingEdits]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  /** Result returned from processStream for persistence */
  interface StreamResult {
    content: string;
    confidence?: 'high' | 'medium' | 'low';
    confidenceExplanation?: string;
    sourceQuality?: SourceQuality;
    sources?: SourceReference[];
    pendingEdits?: PendingEdit[];
    tokens?: number;
    cost?: number;
  }

  /**
   * Process SSE stream and update message content incrementally
   * Supports both new typed format (type: 'text'|'edits'|'done') and legacy format
   * Returns collected metadata for persistence
   */
  const processStream = async (
    response: Response,
    messageId: string
  ): Promise<StreamResult> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let receivedEdits = false;
    let collectedPendingEdits: PendingEdit[] = [];

    // Track metadata from stream completion
    const streamMetadata: {
      confidence?: 'high' | 'medium' | 'low';
      confidenceExplanation?: string;
      sourceQuality?: SourceQuality;
      sources?: SourceReference[];
      tokens?: number;
      cost?: number;
    } = {};

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Skip empty lines and comments
          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }

          // Check for data: prefix
          if (!trimmedLine.startsWith('data:')) {
            continue;
          }

          // Extract and parse data
          const dataContent = trimmedLine.slice(5).trim();

          try {
            const data = JSON.parse(dataContent);

            // Handle new typed format: { type: 'text', content: '...' }
            if (data.type === 'text' && data.content) {
              fullContent += data.content;
              // Update the message content incrementally with streaming state
              setMessages(prev =>
                prev.map(m =>
                  m.id === messageId
                    ? { ...m, content: fullContent, streamingState: 'text' as const }
                    : m
                )
              );
            }
            // Handle legacy format: { content: '...' } without type field
            else if (!data.type && data.content) {
              fullContent += data.content;
              setMessages(prev =>
                prev.map(m =>
                  m.id === messageId ? { ...m, content: fullContent } : m
                )
              );
            }

            // Handle edit events: { type: 'edits', pendingEdits: [...] }
            if (data.type === 'edits' && data.pendingEdits) {
              receivedEdits = true;
              collectedPendingEdits = data.pendingEdits;
              // Mark message as edit proposal
              setMessages(prev =>
                prev.map(m =>
                  m.id === messageId
                    ? { ...m, isEditProposal: true, streamingState: 'complete' as const }
                    : m
                )
              );
              // Store edits for confirmation UI
              setPendingEdits(data.pendingEdits);
            }

            // Handle metadata (can arrive with content or at completion)
            if (data.confidence) {
              streamMetadata.confidence = data.confidence;
            }
            if (data.confidenceExplanation) {
              streamMetadata.confidenceExplanation = data.confidenceExplanation;
            }
            if (data.sourceQuality) {
              streamMetadata.sourceQuality = data.sourceQuality;
            }
            if (data.sources) {
              streamMetadata.sources = data.sources;
            }
            if (data.tokens) {
              streamMetadata.tokens = data.tokens;
            }
            if (data.cost) {
              streamMetadata.cost = data.cost;
            }

            // Handle completion - new format: { type: 'done', done: true, metadata }
            // or legacy format: { done: true }
            if (data.done || data.type === 'done') {

              // Extract metadata from done event if present
              if (data.metadata) {
                if (data.metadata.confidence) streamMetadata.confidence = data.metadata.confidence;
                if (data.metadata.confidenceExplanation) streamMetadata.confidenceExplanation = data.metadata.confidenceExplanation;
                if (data.metadata.sourceQuality) streamMetadata.sourceQuality = data.metadata.sourceQuality;
                if (data.metadata.sources) streamMetadata.sources = data.metadata.sources;
                if (data.metadata.tokens) streamMetadata.tokens = data.metadata.tokens;
                if (data.metadata.cost) streamMetadata.cost = data.metadata.cost;
              }

              // Update message with all collected metadata and final state
              setMessages(prev =>
                prev.map(m => {
                  if (m.id !== messageId) return m;

                  const updates: Partial<Message> = { ...streamMetadata };

                  // If text is done but no edits received yet, show awaiting-edits state
                  // This only applies if message was marked as edit proposal
                  if (m.isEditProposal && !receivedEdits) {
                    updates.streamingState = 'awaiting-edits';
                  } else {
                    updates.streamingState = 'complete';
                  }

                  return { ...m, ...updates };
                })
              );

              // Return collected data for persistence
              return {
                content: fullContent,
                ...streamMetadata,
                pendingEdits: collectedPendingEdits.length > 0 ? collectedPendingEdits : undefined,
              };
            }

            // Handle errors
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // Log parsing errors for debugging (except [DONE] which is expected)
            if (dataContent !== '[DONE]') {
              console.error('Failed to parse SSE data:', dataContent, parseError);
            }
          }
        }
      }

      // Stream ended without done signal - still apply any collected metadata
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            ...streamMetadata,
            streamingState: 'complete' as const,
          };
        })
      );

      // Return what we collected
      return {
        content: fullContent,
        ...streamMetadata,
        pendingEdits: collectedPendingEdits.length > 0 ? collectedPendingEdits : undefined,
      };
    } finally {
      reader.releaseLock();
    }
  };

  const handleSubmit = async (e?: React.FormEvent, directContent?: string) => {
    e?.preventDefault();

    // Use directContent if provided (from quick suggestions), otherwise use input state
    const content = directContent ?? input.trim();
    if (!content || isLoading || isStreaming || pendingEdits.length > 0) return;

    // Ensure we have a conversation for persistence
    let currentConversationId = conversationId;
    if (blueprintId && !currentConversationId) {
      currentConversationId = await loadOrCreateConversation();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message (non-blocking)
    if (currentConversationId) {
      saveMessage(currentConversationId, {
        role: 'user',
        content: userMessage.content,
      });
    }

    try {
      // Use streaming endpoint
      const response = await fetch('/api/chat/blueprint/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          blueprint,
          chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to get response');
      }

      // Check content type to determine streaming vs JSON response
      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        // Streaming response - create empty message and populate incrementally
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '', // Will be populated by stream
          confidence: 'medium', // Default for streamed responses
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false); // No longer loading, now streaming
        setIsStreaming(true);

        // Process the stream and get result for persistence
        try {
          const streamResult = await processStream(response, assistantMessageId);

          // Save assistant message after streaming completes (non-blocking)
          if (currentConversationId && streamResult.content) {
            saveMessage(currentConversationId, {
              role: 'assistant',
              content: streamResult.content,
              confidence: streamResult.confidence,
              confidenceExplanation: streamResult.confidenceExplanation,
              sources: streamResult.sources,
              sourceQuality: streamResult.sourceQuality,
              pendingEdits: streamResult.pendingEdits,
              tokensUsed: streamResult.tokens,
              cost: streamResult.cost,
            });
          }
        } finally {
          setIsStreaming(false);
        }

      } else {
        // JSON response (edit/explain) - simulate streaming with typewriter effect
        const data = await response.json();
        const fullContent = data.response;
        const assistantMessageId = crypto.randomUUID();

        // Collect pending edits for persistence
        const jsonPendingEdits = data.pendingEdits?.length > 0
          ? data.pendingEdits
          : data.pendingEdit
            ? [data.pendingEdit]
            : undefined;

        // Create empty message first with all metadata
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          confidence: data.confidence,
          confidenceExplanation: data.confidenceExplanation,
          sourceQuality: data.sourceQuality,
          sources: data.sources,
          isEditProposal: !!jsonPendingEdits,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        setIsStreaming(true);

        // Typewriter effect - reveal content progressively
        const chunkSize = 3; // Characters per tick
        const delay = 15; // ms between chunks
        let currentIndex = 0;

        await new Promise<void>((resolve) => {
          const typeInterval = setInterval(() => {
            currentIndex += chunkSize;
            const currentContent = fullContent.slice(0, currentIndex);

            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId ? { ...m, content: currentContent } : m
              )
            );

            if (currentIndex >= fullContent.length) {
              clearInterval(typeInterval);
              resolve();
            }
          }, delay);
        });

        setIsStreaming(false);

        // If there are pending edits, store them after typewriter completes
        if (jsonPendingEdits) {
          setPendingEdits(jsonPendingEdits);
        }

        // Save assistant message after typewriter completes (non-blocking)
        if (currentConversationId && fullContent) {
          saveMessage(currentConversationId, {
            role: 'assistant',
            content: fullContent,
            confidence: data.confidence,
            confidenceExplanation: data.confidenceExplanation,
            sources: data.sources,
            sourceQuality: data.sourceQuality,
            pendingEdits: jsonPendingEdits,
            tokensUsed: data.tokensUsed,
            cost: data.cost,
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick suggestion selection - submit directly without relying on state
  const handleSuggestionSelect = (suggestion: string) => {
    handleSubmit(undefined, suggestion);
  };

  // Confirm all pending edits at once
  const handleConfirmAll = () => {
    if (pendingEdits.length === 0 || isConfirming) return;

    setIsConfirming(true);

    try {
      // Capture blueprint state before edit for undo
      const blueprintBefore = JSON.parse(JSON.stringify(blueprint));

      // Apply all edits locally - update the blueprint in memory
      const updatedBlueprint = applyEdits(blueprint, pendingEdits);

      // Record in history for undo/redo
      recordEditInHistory(blueprintBefore, updatedBlueprint, pendingEdits);

      // Notify parent of the update
      onBlueprintUpdate?.(updatedBlueprint);

      // Add confirmation message - concise summary
      const editCount = pendingEdits.length;
      const uniqueSections = [...new Set(pendingEdits.map(e => SECTION_LABELS[e.section] || e.section))];
      const sectionSummary = uniqueSections.length === 1
        ? uniqueSections[0]
        : `${uniqueSections.length} sections`;

      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: editCount === 1
          ? `Done! Updated ${SECTION_LABELS[pendingEdits[0].section] || pendingEdits[0].section}.`
          : `Done! Applied ${editCount} edits across ${sectionSummary}.`,
      };
      setMessages(prev => [...prev, confirmMessage]);
      setPendingEdits([]);
    } catch (error) {
      console.error('Apply edit error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to apply the edits. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsConfirming(false);
    }
  };

  // Cancel all pending edits
  const handleCancelAll = () => {
    if (pendingEdits.length === 0 || isConfirming) return;

    const editCount = pendingEdits.length;
    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: editCount === 1
        ? 'Edit cancelled. The blueprint was not modified.'
        : `All ${editCount} edits cancelled. The blueprint was not modified.`,
    };
    setMessages(prev => [...prev, cancelMessage]);
    setPendingEdits([]);
  };

  // Approve a single edit by index
  const handleApproveSingle = (index: number) => {
    if (isConfirming) return;

    const edit = pendingEdits[index];
    if (!edit) return;

    setIsConfirming(true);

    try {
      // Capture blueprint state before edit for undo
      const blueprintBefore = JSON.parse(JSON.stringify(blueprint));

      // Apply single edit
      const updatedBlueprint = applyEdits(blueprint, [edit]);

      // Record in history for undo/redo
      recordEditInHistory(blueprintBefore, updatedBlueprint, [edit]);

      onBlueprintUpdate?.(updatedBlueprint);

      // Remove from pending list
      const remaining = pendingEdits.filter((_, i) => i !== index);
      setPendingEdits(remaining);

      // Add confirmation message - concise
      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: remaining.length > 0
          ? `Applied. ${remaining.length} remaining.`
          : `Applied.`,
      };
      setMessages(prev => [...prev, confirmMessage]);
    } catch (error) {
      console.error('Apply single edit error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Failed to apply edit for ${edit.fieldPath}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsConfirming(false);
    }
  };

  // Reject a single edit by index
  const handleRejectSingle = (index: number) => {
    if (isConfirming) return;

    const edit = pendingEdits[index];
    if (!edit) return;

    // Remove from pending list
    const remaining = pendingEdits.filter((_, i) => i !== index);
    setPendingEdits(remaining);

    // Add rejection message - concise
    const rejectMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: remaining.length > 0
        ? `Skipped. ${remaining.length} remaining.`
        : `Skipped.`,
    };
    setMessages(prev => [...prev, rejectMessage]);
  };

  return (
    <>
      {/* Floating chat trigger button - solid blue CTA, no pulse */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={springs.smooth}
            className={cn('fixed bottom-6 left-6 z-50', className)}
          >
            <MagneticButton
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--accent-blue, #3b82f6)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Sparkles className="w-6 h-6 text-white" />
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        undoRedo={{
          canUndo,
          canRedo,
          undoDepth,
          onUndo: handleUndo,
          onRedo: handleRedo,
        }}
      >
        <div className="flex flex-col h-full">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto py-4">
            {/* Loading history state */}
            {isLoadingHistory && (
              <div className="px-5 py-8 text-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <Loader2
                    className="w-8 h-8 animate-spin"
                    style={{ color: 'var(--text-tertiary, #666666)' }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-tertiary, #666666)' }}
                  >
                    Loading conversation...
                  </p>
                </motion.div>
              </div>
            )}

            {/* Empty state with quick suggestions */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="px-5 py-8 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6"
                >
                  <div
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'var(--bg-surface, #101010)',
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                    }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: 'var(--text-tertiary, #666666)' }} />
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-tertiary, #666666)' }}
                  >
                    Ask questions or request edits to your blueprint
                  </p>
                </motion.div>

                <QuickSuggestions
                  onSelect={handleSuggestionSelect}
                  disabled={isLoading || isStreaming}
                />
              </div>
            )}

            {/* Message list */}
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                role={message.role}
                content={message.content}
                confidence={message.confidence}
                confidenceExplanation={message.confidenceExplanation}
                sourceQuality={message.sourceQuality}
                sources={message.sources}
                isEditProposal={message.isEditProposal}
                delay={index * 0.05}
              />
            ))}

            {/* Typing indicator */}
            {(isLoading || isStreaming) && <TypingIndicator />}

            {/* Awaiting edits indicator - shown when text is done but edits haven't arrived */}
            <AnimatePresence>
              {messages.length > 0 &&
                messages[messages.length - 1].streamingState === 'awaiting-edits' &&
                pendingEdits.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={springs.smooth}
                    className="px-5 py-3"
                  >
                    <div
                      className="rounded-lg p-3 flex items-center gap-3"
                      style={{
                        background: 'var(--bg-surface, #101010)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                      }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ background: '#f59e0b' }}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: 'var(--text-secondary, #a0a0a0)' }}
                      >
                        Generating edit proposal...
                      </span>
                      <Loader2
                        className="w-4 h-4 animate-spin ml-auto"
                        style={{ color: '#f59e0b' }}
                      />
                    </div>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* Pending Edits Confirmation UI */}
            <AnimatePresence>
              {pendingEdits.length > 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ ...springs.smooth, duration: 0.3 }}
                className="px-5 py-3"
              >
                <GradientBorder
                  className="w-full"
                  innerClassName="p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#f59e0b' }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: '#f59e0b' }}
                    >
                      {pendingEdits.length === 1 ? 'Proposed Edit' : `Proposed Edits (${pendingEdits.length})`}
                    </span>
                  </div>

                  {/* Show each edit with individual actions */}
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {pendingEdits.map((edit, index) => (
                      <div
                        key={index}
                        className="rounded-lg p-3 space-y-2"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {pendingEdits.length > 1 && (
                              <div
                                className="text-xs font-medium mb-1"
                                style={{ color: 'var(--text-muted, #666666)' }}
                              >
                                Edit {index + 1} of {pendingEdits.length}
                              </div>
                            )}
                            <div
                              className="text-xs truncate"
                              style={{ color: 'var(--text-secondary, #a0a0a0)' }}
                            >
                              <span className="font-medium">
                                {SECTION_LABELS[edit.section] || edit.section}
                              </span>
                              {' / '}
                              <span className="font-mono">{edit.fieldPath}</span>
                            </div>
                          </div>
                          {/* Individual approve/reject buttons */}
                          <div className="flex gap-1 flex-shrink-0">
                            <MagneticButton
                              onClick={() => handleApproveSingle(index)}
                              disabled={isConfirming}
                              className="w-7 h-7 rounded flex items-center justify-center"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                              }}
                            >
                              <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
                            </MagneticButton>
                            <MagneticButton
                              onClick={() => handleRejectSingle(index)}
                              disabled={isConfirming}
                              className="w-7 h-7 rounded flex items-center justify-center"
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                              }}
                            >
                              <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                            </MagneticButton>
                          </div>
                        </div>
                        <pre
                          className="text-xs p-2 rounded overflow-auto max-h-20 font-mono whitespace-pre-wrap"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-secondary, #a0a0a0)',
                          }}
                        >
                          {edit.diffPreview}
                        </pre>
                      </div>
                    ))}
                  </div>

                  {/* Bulk actions */}
                  {pendingEdits.length > 1 && (
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <MagneticButton
                        onClick={handleConfirmAll}
                        disabled={isConfirming}
                        className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                        style={{
                          background: '#22c55e',
                          color: '#ffffff',
                        }}
                      >
                        {isConfirming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Approve All ({pendingEdits.length})
                      </MagneticButton>
                      <MagneticButton
                        onClick={handleCancelAll}
                        disabled={isConfirming}
                        className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                        style={{
                          background: 'var(--bg-surface, #101010)',
                          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                          color: 'var(--text-secondary, #a0a0a0)',
                        }}
                      >
                        <X className="w-4 h-4" />
                        Reject All
                      </MagneticButton>
                    </div>
                  )}

                  {/* Single edit actions (shown when only 1 edit) */}
                  {pendingEdits.length === 1 && (
                    <div className="flex gap-2">
                      <MagneticButton
                        onClick={handleConfirmAll}
                        disabled={isConfirming}
                        className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                        style={{
                          background: '#22c55e',
                          color: '#ffffff',
                        }}
                      >
                        {isConfirming ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Confirm Edit
                      </MagneticButton>
                      <MagneticButton
                        onClick={handleCancelAll}
                        disabled={isConfirming}
                        className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
                        style={{
                          background: 'var(--bg-surface, #101010)',
                          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                          color: 'var(--text-secondary, #a0a0a0)',
                        }}
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </MagneticButton>
                    </div>
                  )}
                </GradientBorder>
              </motion.div>
            )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            className="flex-shrink-0 p-4"
            style={{
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            }}
          >
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  pendingEdits.length > 0
                    ? 'Confirm or cancel edits first...'
                    : isStreaming
                    ? 'Receiving response...'
                    : 'Ask about your blueprint...'
                }
                disabled={isLoading || isStreaming || pendingEdits.length > 0}
                className="flex-1 h-10 px-4 text-sm rounded-lg outline-none transition-all duration-200"
                style={{
                  background: 'var(--bg-elevated, #0a0a0a)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  color: 'var(--text-primary, #ffffff)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus, rgba(255, 255, 255, 0.22))';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255, 255, 255, 0.08))';
                }}
              />
              <MagneticButton
                type="submit"
                disabled={!input.trim() || isLoading || isStreaming || pendingEdits.length > 0}
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: input.trim() && !isLoading && !isStreaming && pendingEdits.length === 0
                    ? 'var(--accent-blue, #3b82f6)'
                    : 'var(--bg-surface, #101010)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  color: input.trim() && !isLoading && !isStreaming && pendingEdits.length === 0
                    ? '#ffffff'
                    : 'var(--text-quaternary, #444444)',
                  opacity: !input.trim() || isLoading || isStreaming || pendingEdits.length > 0 ? 0.5 : 1,
                }}
              >
                <Send className="w-4 h-4" />
              </MagneticButton>
            </form>
          </div>
        </div>
      </ChatPanel>
    </>
  );
}

/**
 * Apply a single edit to a blueprint object (mutates the passed object)
 */
function applySingleEdit(
  result: Record<string, unknown>,
  edit: PendingEdit
): void {
  // Navigate to the section
  const section = result[edit.section];
  if (!section || typeof section !== 'object') {
    throw new Error(`Section ${edit.section} not found`);
  }

  // Parse field path and set value
  const pathParts = edit.fieldPath.split('.').flatMap(part => {
    // Handle array notation like "competitors[0]"
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      return [match[1], parseInt(match[2], 10)];
    }
    return [part];
  });

  let current: unknown = section;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (typeof part === 'number') {
      if (!Array.isArray(current)) throw new Error(`Expected array at ${pathParts.slice(0, i).join('.')}`);
      current = current[part];
    } else {
      if (typeof current !== 'object' || current === null) throw new Error(`Expected object at ${pathParts.slice(0, i).join('.')}`);
      current = (current as Record<string, unknown>)[part];
    }
  }

  // Set the final value
  const lastPart = pathParts[pathParts.length - 1];
  if (typeof lastPart === 'number') {
    if (!Array.isArray(current)) throw new Error('Expected array for final path part');
    current[lastPart] = edit.newValue;
  } else {
    if (typeof current !== 'object' || current === null) throw new Error('Expected object for final path part');
    (current as Record<string, unknown>)[lastPart] = edit.newValue;
  }
}

/**
 * Apply multiple edits to a blueprint object (immutable update)
 */
function applyEdits(
  blueprint: Record<string, unknown>,
  edits: PendingEdit[]
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(blueprint)); // Deep clone

  // Apply each edit
  for (const edit of edits) {
    applySingleEdit(result, edit);
  }

  return result;
}
