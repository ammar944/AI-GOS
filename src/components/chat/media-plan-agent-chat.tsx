'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, Undo2, Redo2 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import type { UIMessage } from 'ai';

import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';
import { EditApprovalCard } from './edit-approval-card';
import { ToolLoadingIndicator } from './tool-loading-indicator';
import { ResearchResultCard } from './research-result-card';
import { ValidationCascadeCard } from './validation-cascade-card';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { VoiceInputButton } from './voice-input-button';
import { useEditHistory } from '@/hooks/use-edit-history';
import { applyMediaPlanEdit } from '@/lib/ai/media-plan-chat-tools/utils';
import { MEDIA_PLAN_SECTION_LABELS } from '@/lib/media-plan/section-constants';
import type { MediaPlanPendingEdit, ValidationCascadeResult } from '@/lib/ai/media-plan-chat-tools/types';

// Quick suggestions specific to media plan context
const MEDIA_PLAN_SUGGESTIONS = [
  'Adjust budget allocation',
  'Explain CAC model',
  'Change platform mix',
  'Simulate budget increase',
];

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

interface MediaPlanAgentChatProps {
  mediaPlan: Record<string, unknown>;
  mediaPlanId?: string;
  onboardingData: Record<string, unknown>;
  onMediaPlanUpdate?: (updated: Record<string, unknown>) => void;
  className?: string;
}

export function MediaPlanAgentChat({
  mediaPlan,
  mediaPlanId,
  onboardingData,
  onMediaPlanUpdate,
  className,
}: MediaPlanAgentChatProps) {
  const [input, setInput] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formWrapperRef = useRef<HTMLFormElement>(null);
  const mediaPlanRef = useRef(mediaPlan);
  mediaPlanRef.current = mediaPlan;

  // Track cascade IDs that have already been auto-applied to prevent double-applies
  const appliedCascadeIds = useRef<Set<string>>(new Set());

  const { canUndo, canRedo, undoDepth, recordEdit, undo, redo } = useEditHistory(
    mediaPlanId ? `mp-${mediaPlanId}` : undefined,
  );

  // Reactive transport — useMemo recreates when deps change, and useChat
  // picks up the new instance via its internal ref update on each render.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/media-plan-agent',
        body: {
          mediaPlanId: mediaPlanId || '',
          mediaPlan,
          onboardingData,
        },
      }),
    [mediaPlan, mediaPlanId, onboardingData]
  );

  const {
    messages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
    setMessages,
  } = useChat({
    transport,
    // Auto-resubmit after user approves/rejects an edit
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (err) => {
      console.error('Media plan chat error:', err);
      // If the error is due to orphaned tool calls (MissingToolResultsError),
      // strip the last assistant message that caused it so the user can retry
      if (err?.message?.includes('Tool result is missing')) {
        setMessages((prev) => {
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
          inputRef.current.style.height = '36px';
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
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // Resize on input changes (covers programmatic voice transcript)
  useEffect(() => { autoResize(); }, [input, autoResize]);

  // Voice transcript handler — inserts at cursor position, preserving existing text
  const handleTranscript = useCallback((text: string) => {
    const el = inputRef.current;
    if (!el) {
      setInput(prev => prev ? `${prev} ${text}` : text);
      return;
    }

    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(end);

    const spaceBefore = before && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
    const newValue = before + spaceBefore + text + after;

    setInput(newValue);

    requestAnimationFrame(() => {
      const newCursorPos = start + spaceBefore.length + text.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
      el.focus();
    });
  }, [input]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSubmit(undefined, suggestion);
    },
    [handleSubmit]
  );

  const handleApproveEdit = useCallback(
    (approvalId: string, editInput: { section: string; fieldPath: string; newValue: unknown }) => {
      // Apply edit to media plan before approving
      const currentPlan = mediaPlanRef.current;
      const planBefore = JSON.parse(JSON.stringify(currentPlan));

      const pendingEdit: MediaPlanPendingEdit = {
        section: editInput.section as MediaPlanPendingEdit['section'],
        fieldPath: editInput.fieldPath,
        oldValue: undefined,
        newValue: editInput.newValue,
        explanation: '',
        diffPreview: '',
      };

      try {
        const updatedPlan = applyMediaPlanEdit(currentPlan, pendingEdit);
        recordEdit(planBefore, updatedPlan, [
          {
            section: editInput.section,
            fieldPath: editInput.fieldPath,
            oldValue: undefined,
            newValue: editInput.newValue,
            explanation: '',
            diffPreview: '',
          },
        ]);
        // Update ref immediately so sequential edits build on each other
        mediaPlanRef.current = updatedPlan;
        onMediaPlanUpdate?.(updatedPlan);
        addToolApprovalResponse({ id: approvalId, approved: true });
      } catch (err) {
        console.error('Failed to apply media plan edit:', err);
        addToolApprovalResponse({ id: approvalId, approved: false });
      }
    },
    [addToolApprovalResponse, onMediaPlanUpdate, recordEdit]
  );

  const handleRejectEdit = useCallback(
    (approvalId: string) => {
      addToolApprovalResponse({ id: approvalId, approved: false });
    },
    [addToolApprovalResponse]
  );

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) {
      mediaPlanRef.current = prev;
      onMediaPlanUpdate?.(prev);
    }
  }, [undo, onMediaPlanUpdate]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) {
      mediaPlanRef.current = next;
      onMediaPlanUpdate?.(next);
    }
  }, [redo, onMediaPlanUpdate]);

  /**
   * Auto-apply cascade fixes from recalculate tool output.
   * Uses a Set of message+part IDs to prevent double-applies.
   */
  const applyCascadeFixes = useCallback(
    (cascadeId: string, updatedSections: Record<string, unknown>) => {
      if (appliedCascadeIds.current.has(cascadeId)) return;
      appliedCascadeIds.current.add(cascadeId);

      const currentPlan = mediaPlanRef.current;
      const merged = { ...currentPlan, ...updatedSections };
      mediaPlanRef.current = merged;
      onMediaPlanUpdate?.(merged);
    },
    [onMediaPlanUpdate]
  );

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
  const renderMessageParts = (message: UIMessage, isLastStreamingMessage = false) => {
    const elements: React.ReactNode[] = [];
    let textAccumulator = '';

    const flushText = (key: string, isFinalFlush = false) => {
      if (textAccumulator) {
        elements.push(
          <MessageBubble
            key={key}
            role={message.role as 'user' | 'assistant'}
            content={textAccumulator}
            isStreaming={isFinalFlush && isLastStreamingMessage}
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
        const toolPart = part as ToolPart;
        const toolName = part.type.replace('tool-', '');

        // Loading states
        if (
          toolPart.state === 'input-streaming' ||
          toolPart.state === 'input-available'
        ) {
          // For editMediaPlan with approval, don't show loading - show approval UI below
          if (toolName !== 'editMediaPlan') {
            elements.push(
              <ToolLoadingIndicator key={`${message.id}-tool-${i}`} toolName={toolName} />
            );
          }
        }

        // Approval requested state (editMediaPlan only)
        if (toolPart.state === 'approval-requested') {
          const editInput = toolPart.input as {
            section: string;
            fieldPath: string;
            newValue: unknown;
            explanation: string;
          };
          const approvalId = toolPart.approval?.id ?? `${message.id}-${i}`;

          // Check if this edit would require a validation cascade
          const sectionLabel =
            MEDIA_PLAN_SECTION_LABELS[editInput.section as keyof typeof MEDIA_PLAN_SECTION_LABELS] ||
            editInput.section;

          elements.push(
            <EditApprovalCard
              key={`${message.id}-approval-${i}`}
              section={editInput.section}
              fieldPath={editInput.fieldPath}
              oldValue={undefined}
              newValue={editInput.newValue}
              explanation={editInput.explanation}
              diffPreview={`Section: ${sectionLabel}\nField: ${editInput.fieldPath}\nNew value: ${JSON.stringify(editInput.newValue, null, 2)?.substring(0, 200)}`}
              onApprove={() => handleApproveEdit(approvalId, editInput)}
              onReject={() => handleRejectEdit(approvalId)}
            />
          );
        }

        // Output available states
        if (toolPart.state === 'output-available') {
          const output = toolPart.output;

          // editMediaPlan - show applied confirmation + optional cascade badge
          if (toolName === 'editMediaPlan' && output && !output.error) {
            const sectionLabel =
              MEDIA_PLAN_SECTION_LABELS[output.section as keyof typeof MEDIA_PLAN_SECTION_LABELS] ||
              output.section;

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
                Edit applied to {String(sectionLabel)} / {String(output.fieldPath)}
                {!!output.requiresValidationCascade && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded ml-1"
                    style={{
                      background: 'rgba(167, 139, 250, 0.15)',
                      color: '#a78bfa',
                    }}
                  >
                    cascade needed
                  </span>
                )}
              </div>
            );
          }

          // recalculate - show validation cascade results + auto-apply fixes
          if (toolName === 'recalculate' && output) {
            const cascadeResult = output as unknown as ValidationCascadeResult;

            elements.push(
              <ValidationCascadeCard
                key={`${message.id}-cascade-${i}`}
                autoFixes={cascadeResult.autoFixes}
                warnings={cascadeResult.warnings}
                validatorsRun={cascadeResult.validatorsRun}
              />
            );

            // Auto-apply updated sections from cascade
            if (cascadeResult.updatedSections && Object.keys(cascadeResult.updatedSections).length > 0) {
              const cascadeId = `${message.id}-cascade-${i}`;
              applyCascadeFixes(cascadeId, cascadeResult.updatedSections as Record<string, unknown>);
            }
          }

          // simulateBudgetChange - render inline budget comparison card
          if (toolName === 'simulateBudgetChange' && output) {
            const sim = output as {
              current: Record<string, unknown>;
              proposed: Record<string, unknown>;
              delta: {
                budgetChange: number;
                budgetChangePercent: number;
                leadsDelta: number;
                customersDelta: number;
                cacDelta: number;
              };
            };

            const formatNum = (val: unknown) => {
              const n = Number(val);
              if (isNaN(n)) return String(val);
              return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
            };

            const formatCount = (val: unknown) => {
              const n = Number(val);
              if (isNaN(n)) return String(val);
              return n.toLocaleString();
            };

            const rows = [
              { label: 'Budget', current: formatNum(sim.current.monthlyBudget), proposed: formatNum(sim.proposed.monthlyBudget) },
              { label: 'Leads/mo', current: formatCount(sim.current.expectedMonthlyLeads), proposed: formatCount(sim.proposed.expectedMonthlyLeads) },
              { label: 'SQLs/mo', current: formatCount(sim.current.expectedMonthlySQLs), proposed: formatCount(sim.proposed.expectedMonthlySQLs) },
              { label: 'Customers/mo', current: formatCount(sim.current.expectedMonthlyCustomers), proposed: formatCount(sim.proposed.expectedMonthlyCustomers) },
              { label: 'CAC', current: formatNum(sim.current.targetCAC), proposed: formatNum(sim.proposed.targetCAC) },
              { label: 'LTV:CAC', current: String(sim.current.ltvToCacRatio), proposed: String(sim.proposed.ltvToCacRatio) },
            ];

            elements.push(
              <motion.div
                key={`${message.id}-simulation-${i}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg overflow-hidden my-2"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(0, 0, 0, 0.15)',
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Budget Simulation
                  </span>
                  <span
                    className="text-[10px] ml-auto"
                    style={{
                      color: sim.delta.budgetChange > 0 ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {sim.delta.budgetChange > 0 ? '+' : ''}
                    {sim.delta.budgetChangePercent}%
                  </span>
                </div>
                <div
                  className="grid grid-cols-2 gap-px"
                  style={{ background: 'var(--border-subtle)' }}
                >
                  {/* Current column */}
                  <div className="p-3 space-y-1.5" style={{ background: 'var(--bg-surface)' }}>
                    <div
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Current
                    </div>
                    {rows.map((row) => (
                      <div key={`current-${row.label}`} className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {row.label}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {row.current}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Proposed column */}
                  <div className="p-3 space-y-1.5" style={{ background: 'var(--bg-surface)' }}>
                    <div
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--accent-blue)' }}
                    >
                      Proposed
                    </div>
                    {rows.map((row) => (
                      <div key={`proposed-${row.label}`} className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {row.label}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: 'var(--text-primary)' }}>
                          {row.proposed}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
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

          // searchMediaPlan - show source indicator (brief)
          if (toolName === 'searchMediaPlan' && output && Array.isArray(output.sources) && output.sources.length > 0) {
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
      <div className="flex-1 overflow-y-auto py-4 chat-messages-scroll">
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
                Ask questions or request edits to your media plan
              </p>
            </motion.div>

            <MediaPlanQuickSuggestions onSelect={handleSuggestionSelect} disabled={isLoading} />
          </div>
        )}

        {/* Message list */}
        {messages.map((message, msgIndex) => {
          const isLastAssistant =
            message.role === 'assistant' &&
            msgIndex === messages.length - 1 &&
            isStreaming;
          return (
            <div key={message.id}>
              {message.role === 'user' ? (
                <MessageBubble
                  role="user"
                  content={getTextContent(message)}
                />
              ) : (
                renderMessageParts(message, isLastAssistant)
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
        className="flex-shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {/* Quick suggestions (when conversation exists) */}
        {messages.length > 0 && !isLoading && (
          <div className="mb-2">
            <MediaPlanQuickSuggestions onSelect={handleSuggestionSelect} disabled={isLoading} />
          </div>
        )}

        <form
          ref={formWrapperRef}
          onSubmit={handleSubmit}
          className={`rounded-xl transition-all duration-200 ${isVoiceRecording ? 'chat-input-recording' : ''}`}
          style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${
              isVoiceRecording
                ? 'rgba(249, 115, 22, 0.5)'
                : isFocused
                  ? 'var(--border-focus)'
                  : 'var(--border-subtle)'
            }`,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder={
              isVoiceRecording
                ? 'Listening...'
                : isStreaming
                  ? 'Receiving response...'
                  : hasPendingApproval
                    ? 'Approve or reject the edit above...'
                    : 'Ask about your media plan...'
            }
            disabled={isLoading && !isVoiceRecording}
            rows={1}
            className="w-full px-3 pt-2.5 pb-1 text-sm rounded-xl outline-none resize-none overflow-y-auto leading-relaxed bg-transparent"
            style={{
              color: 'var(--text-primary)',
              minHeight: '36px',
              maxHeight: '200px',
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span
              className="text-[10px] select-none pl-1"
              style={{ color: 'var(--text-tertiary)', opacity: isVoiceRecording ? 0 : 1 }}
            >
              <kbd className="font-sans">&#x23CE;</kbd> send
              {' · '}
              <kbd className="font-sans">&#x21E7;&#x23CE;</kbd> newline
            </span>
            <div className="flex items-center gap-1">
              <VoiceInputButton
                onTranscript={handleTranscript}
                onRecordingChange={setIsVoiceRecording}
                disabled={isLoading}
                compact
              />
              <MagneticButton
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: input.trim() && !isLoading
                    ? 'var(--accent-blue)'
                    : 'transparent',
                  color: input.trim() && !isLoading ? '#ffffff' : 'var(--text-quaternary)',
                  opacity: !input.trim() || isLoading ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <Send className="w-4 h-4" />
              </MagneticButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Inline quick suggestions component for media plan context
// ============================================================================

function MediaPlanQuickSuggestions({
  onSelect,
  disabled,
}: {
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {MEDIA_PLAN_SUGGESTIONS.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="flex-shrink-0 cursor-pointer transition-all duration-200"
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: disabled
              ? 'var(--text-quaternary, #444444)'
              : 'var(--text-tertiary, #666666)',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--border-default, rgba(255, 255, 255, 0.12))';
              e.currentTarget.style.color = 'var(--text-secondary, #a0a0a0)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255, 255, 255, 0.08))';
              e.currentTarget.style.color = 'var(--text-tertiary, #666666)';
            }
          }}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  );
}
