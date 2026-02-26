'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Undo2, Redo2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import type { UIMessage } from 'ai';

import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { QuickSuggestions } from './quick-suggestions';
import { FollowUpSuggestions, generateFollowUpSuggestions } from './follow-up-suggestions';
import { EditApprovalCard } from './edit-approval-card';
import { ToolLoadingIndicator } from './tool-loading-indicator';
import { ResearchResultCard } from './research-result-card';
import { ResearchProgressCard } from './research-progress-card';
import { DeepResearchCard } from './deep-research-card';
import { GenerateSectionCard } from './generate-section-card';
import { ComparisonTableCard } from './comparison-table-card';
import { AnalysisScoreCard } from './analysis-score-card';
import { VisualizationCard } from './visualization-card';
import { ViewInBlueprintButton } from './view-in-blueprint-button';
import { ChatInput } from './chat-input';
import { ThinkingBlock } from './thinking-block';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { useEditHistory } from '@/hooks/use-edit-history';
import { useChatPersistence } from '@/hooks/use-chat-persistence';
import { applyEdits } from '@/lib/ai/chat-tools/utils';
import type { PendingEdit, DeepResearchResult, ComparisonResult, AnalysisResult, VisualizationResult } from '@/lib/ai/chat-tools/types';
import { useOptionalBlueprintEditContext } from '@/components/strategic-blueprint/blueprint-edit-context';

/** Typed shape for AI SDK v6 tool parts — avoids `as any` casts */
interface ToolPart {
  type: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  approval?: { id?: string };
}

interface AgentChatProps {
  blueprint: Record<string, unknown>;
  blueprintId?: string;
  conversationId?: string;
  onBlueprintUpdate?: (updated: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Parse <think>...</think> blocks from text, returning an array of
 * { type: 'text', content } and { type: 'thinking', content } segments.
 * Only complete pairs are parsed; unclosed tags are left as plain text.
 */
function parseThinkingBlocks(text: string): Array<{ type: 'text' | 'thinking'; content: string }> {
  const segments: Array<{ type: 'text' | 'thinking'; content: string }> = [];
  const regex = /<think>([\s\S]*?)<\/think>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the thinking block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) segments.push({ type: 'text', content: before });
    }
    // The thinking block content
    segments.push({ type: 'thinking', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match (or all text if no matches)
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

export function AgentChat({
  blueprint,
  blueprintId,
  conversationId,
  onBlueprintUpdate,
  className,
}: AgentChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;
  const blueprintVersionRef = useRef(0);

  const { canUndo, canRedo, undoDepth, recordEdit, undo, redo } = useEditHistory(blueprintId);

  // Conversation persistence
  const {
    initialMessages,
    isLoading: isPersistenceLoading,
    saveMessages,
  } = useChatPersistence(blueprintId, conversationId);

  // Blueprint edit context — optional (no provider = no highlight, no crash)
  const editCtx = useOptionalBlueprintEditContext();

  // Increment version when blueprint changes (for optimistic locking)
  useEffect(() => {
    blueprintVersionRef.current += 1;
  }, [blueprint, blueprintId, conversationId]);

  // Reactive transport — useMemo recreates when deps change, and useChat
  // picks up the new instance via its internal ref update on each render.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/agent',
        body: {
          blueprintId: blueprintId || '',
          blueprint,
          conversationId,
        },
      }),
    [blueprint, blueprintId, conversationId]
  );

  const {
    messages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    transport,
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

  // Load persisted messages when they arrive from the hook
  const didLoadPersistedRef = useRef(false);
  useEffect(() => {
    if (initialMessages.length > 0 && !didLoadPersistedRef.current) {
      didLoadPersistedRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // Auto-save messages to Supabase (debounced 2s via the persistence hook)
  useEffect(() => {
    if (messages.length > 0 && status === 'ready') {
      saveMessages(messages);
    }
  }, [messages, status, saveMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

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
    (content: string) => {
      if (!content || isLoading) return;
      sendMessage({ text: content });
    },
    [isLoading, sendMessage]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSubmit(suggestion);
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
   * Extract the last completed tool name from a message for follow-up suggestions
   */
  const getLastToolName = (message: UIMessage): string | undefined => {
    for (let i = message.parts.length - 1; i >= 0; i--) {
      const part = message.parts[i];
      if (typeof part === 'object' && 'type' in part && typeof part.type === 'string' && part.type.startsWith('tool-')) {
        const toolPart = part as ToolPart;
        if (toolPart.state === 'output-available') {
          return part.type.replace('tool-', '');
        }
      }
    }
    return undefined;
  };

  /**
   * Render a single message's parts
   */
  const renderMessageParts = (message: UIMessage, isLastStreamingMessage = false) => {
    const elements: React.ReactNode[] = [];
    let textAccumulator = '';

    const flushText = (key: string, isFinalFlush = false) => {
      if (textAccumulator) {
        // Parse <think>...</think> blocks from accumulated text
        const segments = parseThinkingBlocks(textAccumulator);

        segments.forEach((segment, segIdx) => {
          if (segment.type === 'thinking') {
            elements.push(
              <ThinkingBlock
                key={`${key}-think-${segIdx}`}
                content={segment.content}
              />
            );
          } else if (segment.content) {
            elements.push(
              <MessageBubble
                key={`${key}-${segIdx}`}
                role={message.role as 'user' | 'assistant'}
                content={segment.content}
                isStreaming={isFinalFlush && isLastStreamingMessage && segIdx === segments.length - 1}
              />
            );
          }
        });

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
        const toolPart = part as ToolPart;
        const toolName = part.type.replace('tool-', '');

        // Loading states
        if (
          toolPart.state === 'input-streaming' ||
          toolPart.state === 'input-available'
        ) {
          // For approval tools, don't show loading - show approval UI below
          if (toolName !== 'editBlueprint' && toolName !== 'generateSection') {
            // Show research progress card for deepResearch instead of generic loader
            if (toolName === 'deepResearch') {
              elements.push(
                <ResearchProgressCard
                  key={`${message.id}-research-progress-${i}`}
                  phases={[
                    { name: 'Decomposing query', status: toolPart.state === 'input-streaming' ? 'active' : 'done' },
                    { name: 'Researching sub-queries', status: toolPart.state === 'input-available' ? 'active' : 'pending', count: toolPart.state === 'input-available' ? 'running...' : undefined },
                    { name: 'Synthesizing findings', status: 'pending' },
                  ]}
                />
              );
            } else {
              elements.push(
                <ToolLoadingIndicator
                  key={`${message.id}-tool-${i}`}
                  toolName={toolName}
                  args={toolPart.input}
                />
              );
            }
          }
        }

        // Approval requested state (editBlueprint)
        if (toolPart.state === 'approval-requested' && toolName === 'editBlueprint') {
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

        // Approval requested state (generateSection)
        // Note: at this point, execute() hasn't run yet — it runs after approval.
        // We only send the approval signal here; the actual blueprint edit is
        // applied in the output-available handler below once newContent arrives.
        if (toolPart.state === 'approval-requested' && toolName === 'generateSection') {
          const sectionInput = toolPart.input as {
            section: string;
            instruction: string;
            style: string;
          };
          const approvalId = toolPart.approval?.id ?? `${message.id}-${i}`;

          elements.push(
            <GenerateSectionCard
              key={`${message.id}-gensec-${i}`}
              section={sectionInput.section}
              instruction={sectionInput.instruction}
              style={sectionInput.style || 'rewrite'}
              oldContent={undefined}
              newContent={undefined}
              diffPreview="Awaiting generation result..."
              onApprove={() => addToolApprovalResponse({ id: approvalId, approved: true })}
              onReject={() => handleRejectEdit(approvalId)}
            />
          );
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
                  Edit applied to {String(output.section)} / {String(output.fieldPath)}
                </span>
                {editCtx && (
                  <button
                    onClick={() => editCtx.requestNavigation(String(output.section), String(output.fieldPath))}
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
                research={String(output.research ?? '')}
                cost={typeof output.cost === 'number' ? output.cost : undefined}
              />
            );
          }

          // searchBlueprint - show source indicator (brief)
          if (toolName === 'searchBlueprint' && output && Array.isArray(output.sources) && output.sources.length > 0) {
            const srcCount = (output.sources as unknown[]).length;
            elements.push(
              <div
                key={`${message.id}-sources-${i}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] my-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Found {srcCount} source{srcCount !== 1 ? 's' : ''} ({String(output.confidence)} confidence)
              </div>
            );
          }

          // deepResearch - show deep research card
          if (toolName === 'deepResearch' && output && !output.error) {
            const researchData = output as unknown as DeepResearchResult;
            elements.push(
              <DeepResearchCard
                key={`${message.id}-deepresearch-${i}`}
                data={researchData}
              />
            );
          }

          // generateSection - apply section rewrite to blueprint and show result
          if (toolName === 'generateSection' && output && !output.error) {
            // Apply the generated content to the blueprint (idempotent — only if
            // newContent is present and the section hasn't already been overwritten)
            if (output.newContent && output.section) {
              const sectionKey = output.section as string;
              const currentBlueprint = blueprintRef.current;
              const currentSection = currentBlueprint[sectionKey];
              // Only apply if section content differs (prevents double-apply on re-renders)
              if (JSON.stringify(currentSection) !== JSON.stringify(output.newContent)) {
                const blueprintBefore = JSON.parse(JSON.stringify(currentBlueprint));
                const updatedBlueprint = { ...currentBlueprint, [sectionKey]: output.newContent };
                const pendingEdit: PendingEdit = {
                  section: sectionKey,
                  fieldPath: '',
                  oldValue: currentSection,
                  newValue: output.newContent,
                  explanation: `Section rewrite: ${output.instruction || ''}`,
                  diffPreview: typeof output.diffPreview === 'string' ? output.diffPreview : '',
                };
                recordEdit(blueprintBefore, updatedBlueprint, [pendingEdit]);
                blueprintRef.current = updatedBlueprint;
                onBlueprintUpdate?.(updatedBlueprint);
              }
            }

            elements.push(
              <GenerateSectionCard
                key={`${message.id}-gensec-done-${i}`}
                section={String(output.section ?? '')}
                instruction={String(output.instruction ?? '')}
                style={String(output.style ?? 'rewrite')}
                oldContent={output.oldContent}
                newContent={output.newContent}
                diffPreview={String(output.diffPreview ?? '')}
                isApproved
              />
            );
          }

          // compareCompetitors - show comparison table
          if (toolName === 'compareCompetitors' && output && !output.error) {
            const compData = output as unknown as ComparisonResult;
            elements.push(
              <ComparisonTableCard
                key={`${message.id}-compare-${i}`}
                data={compData}
              />
            );
          }

          // analyzeMetrics - show analysis score card
          if (toolName === 'analyzeMetrics' && output && !output.error) {
            const analysisData = output as unknown as AnalysisResult;
            elements.push(
              <AnalysisScoreCard
                key={`${message.id}-analyze-${i}`}
                data={analysisData}
              />
            );
          }

          // createVisualization - show chart card
          if (toolName === 'createVisualization' && output) {
            const vizData = output as unknown as VisualizationResult;
            elements.push(
              <VisualizationCard
                key={`${message.id}-viz-${i}`}
                data={vizData}
              />
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

    // Flush any remaining text — mark as final so streaming cursor appears on last bubble
    flushText(`${message.id}-text-final`, true);

    return elements;
  };

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Undo/Redo toolbar — only visible when edit history exists */}
      {(canUndo || canRedo) && (
        <div
          className="flex-shrink-0 px-3 py-1.5 flex items-center justify-end gap-1"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 px-0 chat-messages-scroll">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && !isPersistenceLoading && (
          <div className="px-4 py-8 text-center">
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
        {messages.map((message, msgIndex) => {
          const isLastAssistant =
            message.role === 'assistant' &&
            msgIndex === messages.length - 1 &&
            isStreaming;

          // Show follow-up suggestions after the last completed assistant message
          const isAssistantDone =
            message.role === 'assistant' &&
            !isLastAssistant && // not currently streaming
            status !== 'submitted';
          const isLastReadyAssistant =
            message.role === 'assistant' &&
            msgIndex === messages.length - 1 &&
            status === 'ready';
          const showFollowUps = isAssistantDone || isLastReadyAssistant;
          const lastToolName = showFollowUps ? getLastToolName(message) : undefined;
          const followUps = lastToolName ? generateFollowUpSuggestions(lastToolName) : [];
          // Only show follow-ups on the most recent assistant message
          const isLatestAssistant =
            showFollowUps &&
            !messages.slice(msgIndex + 1).some((m) => m.role === 'assistant');

          return (
            <div key={message.id}>
              {message.role === 'user' ? (
                <MessageBubble
                  role="user"
                  content={getTextContent(message)}
                />
              ) : (
                <>
                  {renderMessageParts(message, isLastAssistant)}
                  {isLatestAssistant && followUps.length > 0 && !isLoading && (
                    <div className="px-4 pt-1 pb-2">
                      <FollowUpSuggestions
                        suggestions={followUps}
                        onSelect={handleSuggestionSelect}
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Typing indicator — only before first text token arrives */}
        {(isSubmitted || (isStreaming && !messages.some(
          (m, i) => m.role === 'assistant' && i === messages.length - 1 &&
            m.parts.some(p => p.type === 'text' && p.text.length > 0)
        ))) && <TypingIndicator />}

        {/* Error display */}
        {error && (
          <div
            className="mx-4 my-2 px-3 py-2 rounded-lg text-xs"
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
      <div className="flex-shrink-0 px-3.5 pb-3.5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-chat)' }}>
        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
}
