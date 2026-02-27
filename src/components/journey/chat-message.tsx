'use client';

import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  className?: string;
}

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

function UserMessage({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('flex justify-end mb-4', className)}>
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
    </div>
  );
}

function AssistantMessage({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3 mb-4 items-start', className)}>
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
        {renderMarkdown(content)}
        {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  className,
}: ChatMessageProps) {
  if (role === 'user') {
    return <UserMessage content={content} className={className} />;
  }
  return (
    <AssistantMessage content={content} isStreaming={isStreaming} className={className} />
  );
}
