'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThinkingBlock } from '@/components/chat/thinking-block';
import { ToolLoadingIndicator } from '@/components/chat/tool-loading-indicator';
import { DeepResearchCard } from '@/components/chat/deep-research-card';
import { EditApprovalCard } from '@/components/chat/edit-approval-card';
import { ComparisonTableCard } from '@/components/chat/comparison-table-card';
import { AnalysisScoreCard } from '@/components/chat/analysis-score-card';
import { VisualizationCard } from '@/components/chat/visualization-card';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content?: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
  messageId?: string;
  isStreaming?: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ---------------------------------------------------------------------------
// Markdown rendering helpers (kept from v1)
// ---------------------------------------------------------------------------

/**
 * Render inline formatting: **bold**, *italic*, `code`, [link](url)
 */
function renderInlineFormatting(text: string): React.ReactNode {
  const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(inlineRegex);

  return parts.map((part, index) => {
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'var(--accent-cyan)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Links
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--accent-blue)' }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

/**
 * Render a fenced code block with optional diff highlighting
 */
function renderCodeBlock(code: string, language?: string): React.ReactNode {
  const isDiff = language === 'diff';
  const lines = code.trim().split('\n');

  return (
    <pre
      className="text-xs p-3 rounded overflow-auto font-mono my-2"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {lines.map((line, lineIndex) => {
        if (isDiff) {
          const isRemoved = line.startsWith('-');
          const isAdded = line.startsWith('+');
          return (
            <div
              key={lineIndex}
              className={cn(isRemoved && 'text-red-400', isAdded && 'text-green-400')}
            >
              {line}
            </div>
          );
        }
        return <div key={lineIndex}>{line}</div>;
      })}
    </pre>
  );
}

/**
 * Render text content with markdown-style formatting:
 * headers, bullet lists, numbered lists, paragraphs
 */
function renderTextContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listItems) return;
    if (listItems.type === 'ul') {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="list-disc list-inside space-y-1 my-2"
          style={{ color: 'inherit' }}
        >
          {listItems.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol
          key={`list-${elements.length}`}
          className="list-decimal list-inside space-y-1 my-2"
          style={{ color: 'inherit' }}
        >
          {listItems.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    }
    listItems = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const sizeClass = level === 1 ? 'text-base' : 'text-sm';
      elements.push(
        <div
          key={`header-${i}`}
          className={cn(sizeClass, 'font-semibold mt-3 mb-1')}
          style={{ color: 'var(--text-primary)' }}
          role="heading"
          aria-level={Math.min(level + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}
        >
          {renderInlineFormatting(headerText)}
        </div>
      );
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!listItems || listItems.type !== 'ul') {
        flushList();
        listItems = { type: 'ul', items: [] };
      }
      listItems.items.push(renderInlineFormatting(bulletMatch[1]));
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!listItems || listItems.type !== 'ol') {
        flushList();
        listItems = { type: 'ol', items: [] };
      }
      listItems.items.push(renderInlineFormatting(numberedMatch[1]));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`para-${i}`} className="leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  flushList();
  return <>{elements}</>;
}

/**
 * Render markdown content, splitting out fenced code blocks first
 */
function renderMarkdown(content: string): React.ReactNode {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(<span key={`text-${lastIndex}`}>{renderTextContent(textBefore)}</span>);
    }
    const language = match[1] || undefined;
    const code = match[2];
    segments.push(
      <span key={`code-${match.index}`}>{renderCodeBlock(code, language)}</span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    segments.push(<span key={`text-${lastIndex}`}>{renderTextContent(remaining)}</span>);
  }

  return <div className="space-y-1">{segments}</div>;
}

// ---------------------------------------------------------------------------
// Tool part rendering
// ---------------------------------------------------------------------------

function renderToolPart(
  part: Record<string, unknown>,
  key: string,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
): React.ReactNode {
  const toolName = (part.type as string).replace('tool-', '');
  const state = part.state as string;
  const input = part.input as Record<string, unknown> | undefined;
  const output = part.output as Record<string, unknown> | undefined;

  // Loading states
  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <ToolLoadingIndicator
        key={key}
        toolName={toolName}
        args={input}
      />
    );
  }

  // Error state
  if (state === 'output-error') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
        }}
      >
        {(part.errorText as string) || 'Tool execution failed'}
      </div>
    );
  }

  // Output available — render specific card
  if (state === 'output-available' && output) {
    switch (toolName) {
      case 'deepResearch':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <DeepResearchCard key={key} data={output as any} />;
      case 'compareCompetitors':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <ComparisonTableCard key={key} data={output as any} />;
      case 'analyzeMetrics':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <AnalysisScoreCard key={key} data={output as any} />;
      case 'createVisualization':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <VisualizationCard key={key} data={output as any} />;
      case 'webResearch':
        return (
          <div
            key={key}
            className="px-3 py-2 rounded-lg text-xs my-1"
            style={{
              background: 'rgba(54, 94, 255, 0.06)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            Research complete
          </div>
        );
      case 'editBlueprint':
        return (
          <div
            key={key}
            className="px-3 py-2 rounded-lg text-xs my-1 flex items-center gap-1.5"
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Edit applied
          </div>
        );
      default:
        return null;
    }
  }

  // Approval requested state — render EditApprovalCard for editBlueprint
  if (state === 'approval-requested' && toolName === 'editBlueprint' && input) {
    const approvalId = (part.approval as Record<string, unknown> | undefined)?.id as string | undefined;
    const editInput = input as {
      section: string;
      fieldPath: string;
      newValue: unknown;
      explanation: string;
    };
    const fallbackId = `${key}-approval`;

    return (
      <EditApprovalCard
        key={key}
        section={editInput.section}
        fieldPath={editInput.fieldPath}
        oldValue={undefined}
        newValue={editInput.newValue}
        explanation={editInput.explanation}
        diffPreview={`Field: ${editInput.fieldPath}\nNew value: ${(() => { try { return JSON.stringify(editInput.newValue, null, 2)?.substring(0, 200); } catch { return '[complex value]'; } })()}`}
        onApprove={() => onToolApproval?.(approvalId ?? fallbackId, true)}
        onReject={() => onToolApproval?.(approvalId ?? fallbackId, false)}
      />
    );
  }

  // Approval responded — tool is executing after user approved
  if (state === 'approval-responded') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        Applying edit...
      </div>
    );
  }

  // Output denied — user rejected the edit
  if (state === 'output-denied') {
    return (
      <div
        key={key}
        className="px-3 py-2 rounded-lg text-xs my-1"
        style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          color: 'var(--text-tertiary)',
        }}
      >
        Edit rejected
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Message parts rendering
// ---------------------------------------------------------------------------

function renderMessageParts(
  parts: Array<{ type: string; [key: string]: unknown }>,
  messageId: string,
  isStreaming: boolean,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let textAccumulator = '';

  const flushText = (key: string, isFinal = false) => {
    if (textAccumulator.trim()) {
      elements.push(
        <div key={key} className="space-y-1">
          {renderMarkdown(textAccumulator)}
          {isFinal && isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
        </div>
      );
    } else if (isFinal && isStreaming) {
      elements.push(
        <span key={key} className="streaming-cursor" aria-hidden="true" />
      );
    }
    textAccumulator = '';
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Text parts — accumulate
    if (part.type === 'text') {
      textAccumulator += (part.text as string) || '';
      continue;
    }

    // Reasoning/thinking parts
    if (part.type === 'reasoning') {
      flushText(`${messageId}-text-before-reasoning-${i}`);
      elements.push(
        <ThinkingBlock
          key={`${messageId}-thinking-${i}`}
          content={(part.text as string) || ''}
        />
      );
      continue;
    }

    // Tool parts
    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
      flushText(`${messageId}-text-before-tool-${i}`);
      const toolElement = renderToolPart(part as Record<string, unknown>, `${messageId}-tool-${i}`, onToolApproval);
      if (toolElement) {
        elements.push(toolElement);
      }
      continue;
    }
  }

  // Flush remaining text
  flushText(`${messageId}-text-final`, true);

  return <>{elements}</>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserMessage({ content, className }: { content: string; className?: string }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn('flex justify-end mb-4', className)}
    >
      <div
        className="px-4 py-2.5 max-w-[85%]"
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-default)',
          borderRadius: '14px 14px 4px 14px',
          color: 'var(--text-primary)',
          fontSize: '13.5px',
          lineHeight: '1.65',
        }}
      >
        {content}
      </div>
    </motion.div>
  );
}

function AssistantMessage({
  content,
  parts,
  messageId,
  isStreaming,
  onToolApproval,
  className,
}: {
  content?: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
  messageId: string;
  isStreaming: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn('flex gap-3 mb-4 items-start', className)}
    >
      {/* Gradient avatar */}
      <div
        className="flex-shrink-0 rounded-[7px] flex items-center justify-center"
        style={{
          width: '24px',
          height: '24px',
          background: 'linear-gradient(135deg, var(--accent-blue), #006fff)',
          marginTop: '1px',
        }}
        aria-hidden="true"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l1.88 5.76a2 2 0 001.27 1.27L21 12l-5.85 1.97a2 2 0 00-1.27 1.27L12 21l-1.88-5.76a2 2 0 00-1.27-1.27L3 12l5.85-1.97a2 2 0 001.27-1.27L12 3z" />
        </svg>
      </div>

      {/* Message content */}
      <div
        className="flex-1 min-w-0"
        style={{
          fontSize: '13.5px',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
        }}
      >
        {parts
          ? renderMessageParts(parts, messageId, isStreaming, onToolApproval)
          : (
            <>
              {renderMarkdown(content || '')}
              {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
            </>
          )
        }
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ChatMessage({
  role,
  content,
  parts,
  messageId,
  isStreaming = false,
  onToolApproval,
  className,
}: ChatMessageProps) {
  if (role === 'user') {
    const textContent = parts
      ? parts.filter((p) => p.type === 'text').map((p) => p.text as string).join('')
      : (content || '');
    return <UserMessage content={textContent} className={className} />;
  }
  return (
    <AssistantMessage
      content={content}
      parts={parts}
      messageId={messageId ?? (content ? 'welcome' : 'msg')}
      isStreaming={isStreaming}
      onToolApproval={onToolApproval}
      className={className}
    />
  );
}
