'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './chat-message';
import { Send, MessageSquare, X, Check, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [isOpen, setIsOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages or when pending edits appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingEdits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || pendingEdits.length > 0) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send blueprint context directly with the request - no DB needed
      const response = await fetch('/api/chat/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          blueprint, // Send full blueprint context
          chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        confidence: data.confidence,
        isEditProposal: !!(data.pendingEdits?.length || data.pendingEdit),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If there are pending edits, store them (handle both array and single)
      if (data.pendingEdits && data.pendingEdits.length > 0) {
        setPendingEdits(data.pendingEdits);
      } else if (data.pendingEdit) {
        setPendingEdits([data.pendingEdit]);
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

  // Confirm all pending edits at once
  const handleConfirmAll = () => {
    if (pendingEdits.length === 0 || isConfirming) return;

    setIsConfirming(true);

    try {
      // Apply all edits locally - update the blueprint in memory
      const updatedBlueprint = applyEdits(blueprint, pendingEdits);

      // Notify parent of the update
      onBlueprintUpdate?.(updatedBlueprint);

      // Add confirmation message
      const editCount = pendingEdits.length;
      const fieldList = pendingEdits.map(e =>
        `${SECTION_LABELS[e.section] || e.section} / ${e.fieldPath}`
      ).join(', ');

      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: editCount === 1
          ? `Edit applied! The ${pendingEdits[0].fieldPath} field in ${SECTION_LABELS[pendingEdits[0].section] || pendingEdits[0].section} has been updated.`
          : `All ${editCount} edits applied! Updated: ${fieldList}`,
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

      // Add confirmation message
      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Edit applied: ${SECTION_LABELS[edit.section] || edit.section} / ${edit.fieldPath}${remaining.length > 0 ? ` (${remaining.length} edit${remaining.length > 1 ? 's' : ''} remaining)` : ''}`,
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

    // Add rejection message
    const rejectMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Edit rejected: ${SECTION_LABELS[edit.section] || edit.section} / ${edit.fieldPath}${remaining.length > 0 ? ` (${remaining.length} edit${remaining.length > 1 ? 's' : ''} remaining)` : ''}`,
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

  // Collapsed state - just a button
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn('fixed bottom-6 left-6 rounded-full w-14 h-14 shadow-lg z-50', className)}
        size="icon"
      >
        <MessageSquare className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-6 w-96 h-[600px] max-h-[80vh] bg-background border rounded-lg shadow-xl flex flex-col z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Blueprint Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="w-8 h-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Ask questions or request edits</p>
            <p className="text-xs mt-2">
              Try: &quot;What competitors did you find?&quot; or &quot;Change the positioning to focus on speed&quot;
            </p>
          </div>
        )}

        {messages.map(message => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            confidence={message.confidence}
            isEditProposal={message.isEditProposal}
          />
        ))}

        {isLoading && (
          <ChatMessage role="assistant" content="" isLoading />
        )}

        {/* Pending Edits Confirmation UI */}
        {pendingEdits.length > 0 && !isLoading && (
          <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium">
                {pendingEdits.length === 1 ? 'Proposed Edit' : `Proposed Edits (${pendingEdits.length})`}
              </span>
            </div>

            {/* Show each edit with individual actions */}
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {pendingEdits.map((edit, index) => (
                <div key={index} className="border rounded p-3 bg-background space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {pendingEdits.length > 1 && (
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Edit {index + 1} of {pendingEdits.length}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">
                          {SECTION_LABELS[edit.section] || edit.section}
                        </span>
                        {' / '}
                        <span className="font-mono">{edit.fieldPath}</span>
                      </div>
                    </div>
                    {/* Individual approve/reject buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => handleApproveSingle(index)}
                        disabled={isConfirming}
                        title="Approve this edit"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => handleRejectSingle(index)}
                        disabled={isConfirming}
                        title="Reject this edit"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded border overflow-auto max-h-20 font-mono whitespace-pre-wrap">
                    {edit.diffPreview}
                  </pre>
                </div>
              ))}
            </div>

            {/* Bulk actions */}
            {pendingEdits.length > 1 && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  onClick={handleConfirmAll}
                  disabled={isConfirming}
                  className="flex-1"
                >
                  {isConfirming ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  Approve All ({pendingEdits.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelAll}
                  disabled={isConfirming}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject All
                </Button>
              </div>
            )}

            {/* Single edit actions (shown when only 1 edit) */}
            {pendingEdits.length === 1 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirmAll}
                  disabled={isConfirming}
                  className="flex-1"
                >
                  {isConfirming ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  Confirm Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelAll}
                  disabled={isConfirming}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={pendingEdits.length > 0 ? 'Confirm or cancel edits first...' : 'Ask about your blueprint...'}
            disabled={isLoading || pendingEdits.length > 0}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading || pendingEdits.length > 0}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
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
