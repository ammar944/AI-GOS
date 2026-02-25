'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Undo2, Redo2, Loader2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import type { UIMessage } from 'ai';

import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { QuickSuggestions } from './quick-suggestions';
import { EditApprovalCard } from './edit-approval-card';
import { ToolLoadingIndicator } from './tool-loading-indicator';
import { ResearchResultCard } from './research-result-card';
import { ViewInBlueprintButton } from './view-in-blueprint-button';
import { VoiceTranscriptPreview } from './voice-transcript-preview';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { VoiceInputButton } from './voice-input-button';
import { useEditHistory } from '@/hooks/use-edit-history';
import { applyEdits } from '@/lib/ai/chat-tools/utils';
import type { PendingEdit } from '@/lib/ai/chat-tools/types';
import { useOptionalBlueprintEditContext } from '@/components/strategic-blueprint/blueprint-edit-context';

interface AgentChatProps {
  blueprint: Record<string, unknown>;
  blueprintId?: string;
  conversationId?: string;
  onBlueprintUpdate?: (updated: Record<string, unknown>) => void;
  className?: string;
}

export function AgentChat({
  blueprint,
  blueprintId,
  conversationId,
  onBlueprintUpdate,
  className,
}: AgentChatProps) {
  const [input, setInput] = useState('');
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;
  const blueprintVersionRef = useRef(0);

  const { canUndo, canRedo, undoDepth, recordEdit, undo, redo } = useEditHistory(blueprintId);

  // Blueprint edit context — optional (no provider = no highlight, no crash)
  const editCtx = useOptionalBlueprintEditContext();

  const transport = useRef(
    new DefaultChatTransport({
      api: '/api/chat/agent',
      body: {
        blueprintId: blueprintId || '',
        blueprint,
        conversationId,
      },
    })
  );

  // Update transport body when blueprint changes and increment version
  useEffect(() => {
    blueprintVersionRef.current += 1;
    transport.current = new DefaultChatTransport({
      api: '/api/chat/agent',
      body: {
        blueprintId: blueprintId || '',
        blueprint,
        conversationId,
      },
    });
  }, [blueprint, blueprintId, conversationId]);

  const {
    messages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    transport: transport.current,
    // Auto-resubmit after user approves/rejects an edit
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (err) => {
      console.error('Chat error:', err);
      // If the error is due to orphaned tool calls (MissingToolResultsError),
      // strip the last assistant message that caused it so the user can retry
      if (err?.message?.includes('Tool result is missing')) {
        setMessages((prev) => {
          // Remove the last assistant message with incomplete tool parts
          const cleaned = [...prev];
          for (let i = cleaned.length - 1; i >= 0; i--) {
            if (cleaned[i].role === 'assistant') {
              cleaned.splice(i, 1);
              break;
            }
          }
          return cleaned;
        });
      }
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

  // Check if any tool is waiting for user approval (prevent sending new messages)
  const hasPendingApproval = messages.some(
    (msg) =>
      msg.role === 'assistant' &&
      msg.parts.some(
        (part) =>
          typeof part === 'object' &&
          'state' in part &&
          (part as Record<string, unknown>).state === 'approval-requested'
      )
  );

  const isLoading = isStreaming || isSubmitted || hasPendingApproval;

  // Notify blueprint view of pending edits via effect (not during render)
  const lastProposedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editCtx) return;
    // Scan messages for the latest approval-requested edit
    for (let m = messages.length - 1; m >= 0; m--) {
      const msg = messages[m];
      if (msg.role !== 'assistant') continue;
      for (let p = msg.parts.length - 1; p >= 0; p--) {
        const part = msg.parts[p] as Record<string, unknown>;
        if (!part.type || !(part.type as string).startsWith('tool-')) continue;
        if (part.state !== 'approval-requested') continue;
        const editInput = part.input as { section: string; fieldPath: string; explanation?: string };
        const approval = part.approval as { id?: string } | undefined;
        const id = approval?.id ?? `${msg.id}-${p}`;
        // Only fire once per unique edit
        if (lastProposedIdRef.current === id) return;
        lastProposedIdRef.current = id;
        editCtx.notifyEditProposed({
          section: editInput.section,
          fieldPath: editInput.fieldPath,
          explanation: editInput.explanation,
          id,
        });
        return;
      }
    }
  }, [messages, editCtx]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent, directContent?: string) => {
      e?.preventDefault();
      const content = directContent ?? input.trim();
      if (!content || isLoading) return;

      sendMessage({ text: content });
      setInput('');

      // Reset textarea height after sending
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = '40px';
        }
      });
    },
    [input, isLoading, sendMessage]
  );

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  // Resize on input changes (covers programmatic voice transcript)
  useEffect(() => { autoResize(); }, [input, autoResize]);

  // Voice transcript preview handlers
  const handleTranscript = useCallback((text: string) => {
    setTranscriptPreview(text);
  }, []);

  const handleTranscriptConfirm = useCallback((text: string) => {
    setTranscriptPreview(null);
    handleSubmit(undefined, text);
  }, [handleSubmit]);

  const handleTranscriptDismiss = useCallback(() => {
    setTranscriptPreview(null);
  }, []);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSubmit(undefined, suggestion);
    },
    [handleSubmit]
  );

  const handleApproveEdit = useCallback(
    (approvalId: string, editInput: { section: string; fieldPath: string; newValue: unknown }, proposedAtVersion?: number) => {
      // Optimistic locking: warn if blueprint changed since edit was proposed
      if (proposedAtVersion !== undefined && proposedAtVersion !== blueprintVersionRef.current) {
        console.warn(
          `Blueprint version mismatch: edit proposed at v${proposedAtVersion}, current is v${blueprintVersionRef.current}. Applying anyway.`
        );
      }

      // Apply edit to blueprint before approving
      const currentBlueprint = blueprintRef.current;
      const blueprintBefore = JSON.parse(JSON.stringify(currentBlueprint));

      const pendingEdit: PendingEdit = {
        section: editInput.section,
        fieldPath: editInput.fieldPath,
        oldValue: undefined,
        newValue: editInput.newValue,
        explanation: '',
        diffPreview: '',
      };

      try {
        const updatedBlueprint = applyEdits(currentBlueprint, [pendingEdit]);
        recordEdit(blueprintBefore, updatedBlueprint, [pendingEdit]);
        // Update ref immediately so sequential edits build on each other
        // (don't wait for React re-render to propagate the new prop)
        blueprintRef.current = updatedBlueprint;
        onBlueprintUpdate?.(updatedBlueprint);
        // Notify the blueprint view that this edit was approved
        editCtx?.notifyEditApproved(approvalId);
        addToolApprovalResponse({ id: approvalId, approved: true });
      } catch (err) {
        console.error('Failed to apply edit:', err);
        // Reject so the model knows the edit failed
        editCtx?.notifyEditRejected(approvalId);
        addToolApprovalResponse({ id: approvalId, approved: false });
      }
    },
    [addToolApprovalResponse, onBlueprintUpdate, recordEdit, editCtx]
  );

  const handleRejectEdit = useCallback(
    (approvalId: string) => {
      editCtx?.notifyEditRejected(approvalId);
      addToolApprovalResponse({ id: approvalId, approved: false });
    },
    [addToolApprovalResponse, editCtx]
  );

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) {
      onBlueprintUpdate?.(prev);
    }
  }, [undo, onBlueprintUpdate]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      onBlueprintUpdate?.(next);
    }
  }, [redo, onBlueprintUpdate]);

  /**
   * Extract text content from message parts
   */
  const getTextContent = (message: UIMessage): string => {
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('');
  };

  /**
   * Render a single message's parts
   */
  const renderMessageParts = (message: UIMessage) => {
    const elements: React.ReactNode[] = [];
    let textAccumulator = '';

    const flushText = (key: string) => {
      if (textAccumulator) {
        elements.push(
          <MessageBubble
            key={key}
            role={message.role as 'user' | 'assistant'}
            content={textAccumulator}
          />
        );
        textAccumulator = '';
      }
    };

    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];

      if (part.type === 'text') {
        textAccumulator += part.text;
        continue;
      }

      // Flush accumulated text before rendering tool parts
      flushText(`${message.id}-text-${i}`);

      // Tool part rendering
      if (part.type.startsWith('tool-')) {
        const toolPart = part as any;
        const toolName = part.type.replace('tool-', '');

        // Loading states
        if (
          toolPart.state === 'input-streaming' ||
          toolPart.state === 'input-available'
        ) {
          // For editBlueprint with approval, don't show loading - show approval UI below
          if (toolName !== 'editBlueprint') {
            elements.push(
              <ToolLoadingIndicator key={`${message.id}-tool-${i}`} toolName={toolName} />
            );
          }
        }

        // Approval requested state (editBlueprint only)
        if (toolPart.state === 'approval-requested') {
          const editInput = toolPart.input as {
            section: string;
            fieldPath: string;
            newValue: unknown;
            explanation: string;
          };
          // Always use a stable fallback so handlers never receive undefined
          const approvalId = toolPart.approval?.id ?? `${message.id}-${i}`;
          const proposedVersion = blueprintVersionRef.current;

          elements.push(
            <EditApprovalCard
              key={`${message.id}-approval-${i}`}
              section={editInput.section}
              fieldPath={editInput.fieldPath}
              oldValue={undefined}
              newValue={editInput.newValue}
              explanation={editInput.explanation}
              diffPreview={`Field: ${editInput.fieldPath}\nNew value: ${(() => { try { return JSON.stringify(editInput.newValue, null, 2)?.substring(0, 200); } catch { return '[complex value]'; } })()}`}
              onApprove={() => handleApproveEdit(approvalId, editInput, proposedVersion)}
              onReject={() => handleRejectEdit(approvalId)}
            />
          );

          // "View in Blueprint" button — user-triggered navigation
          if (editCtx) {
            elements.push(
              <ViewInBlueprintButton
                key={`${message.id}-view-${i}`}
                section={editInput.section}
                fieldPath={editInput.fieldPath}
                onClick={() => editCtx.requestNavigation(editInput.section, editInput.fieldPath)}
              />
            );
          }
        }

        // Output available states
        if (toolPart.state === 'output-available') {
          const output = toolPart.output;

          // editBlueprint - show applied confirmation
          if (toolName === 'editBlueprint' && output && !output.error) {
            elements.push(
              <div
                key={`${message.id}-edit-done-${i}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg my-1 text-xs"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                }}
              >
                <span className="flex-1">
                  Edit applied to {output.section} / {output.fieldPath}
                </span>
                {editCtx && (
                  <button
                    onClick={() => editCtx.requestNavigation(output.section, output.fieldPath)}
                    className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium transition-colors hover:brightness-125"
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#4ade80',
                    }}
                  >
                    View Change
                  </button>
                )}
              </div>
            );
          }

          // webResearch - show research result card
          if (toolName === 'webResearch' && output?.research) {
            elements.push(
              <ResearchResultCard
                key={`${message.id}-research-${i}`}
                research={output.research}
                cost={output.cost}
              />
            );
          }

          // searchBlueprint - show source indicator (brief)
          if (toolName === 'searchBlueprint' && output?.sources?.length > 0) {
            elements.push(
              <div
                key={`${message.id}-sources-${i}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] my-1"
                style={{ color: 'var(--text-quaternary)' }}
              >
                Found {output.sources.length} source{output.sources.length !== 1 ? 's' : ''} ({output.confidence} confidence)
              </div>
            );
          }
        }

        // Error state
        if (toolPart.state === 'output-error') {
          elements.push(
            <div
              key={`${message.id}-error-${i}`}
              className="px-3 py-2 rounded-lg my-1 text-xs"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
              }}
            >
              Tool error: {toolPart.errorText || 'Unknown error'}
            </div>
          );
        }
      }
    }

    // Flush any remaining text
    flushText(`${message.id}-text-final`);

    return elements;
  };

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Chat
          </span>
        </div>

        {(canUndo || canRedo) && (
          <div className="flex items-center gap-1">
            <MagneticButton
              onClick={handleUndo}
              disabled={!canUndo}
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: 'transparent', opacity: canUndo ? 1 : 0.4 }}
              title={canUndo ? `Undo (${undoDepth})` : 'Nothing to undo'}
            >
              <Undo2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </MagneticButton>
            <MagneticButton
              onClick={handleRedo}
              disabled={!canRedo}
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: 'transparent', opacity: canRedo ? 1 : 0.4 }}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </MagneticButton>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
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
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Sparkles className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Ask questions or request edits to your blueprint
              </p>
            </motion.div>

            <QuickSuggestions onSelect={handleSuggestionSelect} disabled={isLoading} blueprint={blueprint} />
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'user' ? (
              <MessageBubble
                role="user"
                content={getTextContent(message)}
              />
            ) : (
              renderMessageParts(message)
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && <TypingIndicator />}

        {/* Error display */}
        {error && (
          <div
            className="mx-5 my-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
            }}
          >
            {error.message || 'An error occurred. Please try again.'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 p-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {/* Quick suggestions (when conversation exists) */}
        {messages.length > 0 && !isLoading && (
          <div className="mb-3">
            <QuickSuggestions onSelect={handleSuggestionSelect} disabled={isLoading} blueprint={blueprint} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {transcriptPreview !== null ? (
            <motion.div
              key="transcript-preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-2 items-start">
                <VoiceInputButton
                  onTranscript={handleTranscript}
                  disabled={isLoading}
                  hasTranscript={true}
                  onClear={handleTranscriptDismiss}
                />
                <div className="flex-1">
                  <VoiceTranscriptPreview
                    transcript={transcriptPreview}
                    onConfirm={handleTranscriptConfirm}
                    onDismiss={handleTranscriptDismiss}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="input-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="flex gap-2 items-end"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  isStreaming
                    ? 'Receiving response...'
                    : hasPendingApproval
                    ? 'Approve or reject the edit above...'
                    : 'Ask about your blueprint...'
                }
                disabled={isLoading}
                rows={1}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg outline-none transition-all duration-200 resize-none overflow-y-auto leading-5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  minHeight: '40px',
                  maxHeight: '128px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              />
              <VoiceInputButton onTranscript={handleTranscript} disabled={isLoading} />
              <MagneticButton
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: input.trim() && !isLoading
                    ? 'var(--accent-blue)'
                    : 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: input.trim() && !isLoading ? '#ffffff' : 'var(--text-quaternary)',
                  opacity: !input.trim() || isLoading ? 0.5 : 1,
                }}
              >
                <Send className="w-4 h-4" />
              </MagneticButton>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
