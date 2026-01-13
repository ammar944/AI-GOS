'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatPanel } from './chat-panel';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { QuickSuggestions } from './quick-suggestions';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { GradientBorder } from '@/components/ui/gradient-border';
import { springs } from '@/lib/motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  /** Whether this message contains an edit proposal */
  isEditProposal?: boolean;
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
  className?: string;
  /** Callback when an edit is confirmed - receives the updated blueprint */
  onBlueprintUpdate?: (updatedBlueprint: Record<string, unknown>) => void;
}

export function BlueprintChat({ blueprint, className, onBlueprintUpdate }: BlueprintChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Process SSE stream and update message content incrementally
   */
  const processStream = async (
    response: Response,
    messageId: string
  ): Promise<void> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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

            // Handle content chunks
            if (data.content) {
              fullContent += data.content;
              // Update the message content incrementally
              setMessages(prev =>
                prev.map(m =>
                  m.id === messageId ? { ...m, content: fullContent } : m
                )
              );
            }

            // Handle completion
            if (data.done) {
              return;
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
    } finally {
      reader.releaseLock();
    }
  };

  const handleSubmit = async (e?: React.FormEvent, directContent?: string) => {
    e?.preventDefault();

    // Use directContent if provided (from quick suggestions), otherwise use input state
    const content = directContent ?? input.trim();
    if (!content || isLoading || isStreaming || pendingEdits.length > 0) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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

        // Process the stream
        try {
          await processStream(response, assistantMessageId);
        } finally {
          setIsStreaming(false);
        }

      } else {
        // JSON response (edit/explain) - simulate streaming with typewriter effect
        const data = await response.json();
        const fullContent = data.response;
        const assistantMessageId = crypto.randomUUID();

        // Create empty message first
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          confidence: data.confidence,
          isEditProposal: !!(data.pendingEdits?.length || data.pendingEdit),
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
        if (data.pendingEdits && data.pendingEdits.length > 0) {
          setPendingEdits(data.pendingEdits);
        } else if (data.pendingEdit) {
          setPendingEdits([data.pendingEdit]);
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
      // Apply all edits locally - update the blueprint in memory
      const updatedBlueprint = applyEdits(blueprint, pendingEdits);

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
      // Apply single edit
      const updatedBlueprint = applyEdits(blueprint, [edit]);
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

  // Section labels for display
  const SECTION_LABELS: Record<string, string> = {
    industryMarketOverview: 'Industry & Market',
    icpAnalysisValidation: 'ICP Analysis',
    offerAnalysisViability: 'Offer Analysis',
    competitorAnalysis: 'Competitors',
    crossAnalysisSynthesis: 'Synthesis',
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
      <ChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="flex flex-col h-full">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto py-4">
            {/* Empty state with quick suggestions */}
            {messages.length === 0 && (
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
                isEditProposal={message.isEditProposal}
                delay={index * 0.05}
              />
            ))}

            {/* Typing indicator */}
            {(isLoading || isStreaming) && <TypingIndicator />}

            {/* Pending Edits Confirmation UI */}
            {pendingEdits.length > 0 && !isLoading && (
              <div className="px-5 py-3">
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
              </div>
            )}

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
