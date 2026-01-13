"use client";

import { motion } from "framer-motion";
import { User, Bot, Pencil, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderWithSubscripts } from "@/components/strategic-research/citations";
import { springs } from "@/lib/motion";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isEditProposal?: boolean;
  isExplanation?: boolean;
  confidence?: "high" | "medium" | "low";
  isLoading?: boolean;
  delay?: number;
}

/**
 * Render inline formatting (bold, inline code, links) for a text segment
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Process inline formatting: **bold**, `code`, [link](url)
  const inlineRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(inlineRegex);

  return parts.map((part, index) => {
    // Bold text
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold" style={{ color: "var(--text-primary, #ffffff)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            color: "#f472b6",
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
          style={{ color: "#60a5fa" }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Regular text with citation subscripts
    return <span key={index}>{renderWithSubscripts(part)}</span>;
  });
}

/**
 * Render a code block with optional syntax highlighting for diff
 */
function renderCodeBlock(code: string, language?: string): React.ReactNode {
  const isDiff = language === "diff";
  const lines = code.trim().split("\n");

  return (
    <pre
      className="text-xs p-3 rounded overflow-auto font-mono my-2"
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {lines.map((line, lineIndex) => {
        if (isDiff) {
          const isRemoved = line.startsWith("-");
          const isAdded = line.startsWith("+");
          return (
            <div
              key={lineIndex}
              className={cn(
                isRemoved && "text-red-400",
                isAdded && "text-green-400"
              )}
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
 * Render markdown content with support for:
 * - Headers (# ## ###)
 * - Bold (**text**)
 * - Inline code (`code`)
 * - Code blocks (```lang ... ```)
 * - Bullet lists (- item or * item)
 * - Numbered lists (1. item)
 * - Links ([text](url))
 * - Citation subscripts ([1], [2])
 */
function renderContent(content: string): React.ReactNode {
  // Split by code blocks first (they should be rendered as-is)
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(
        <span key={`text-${lastIndex}`}>{renderTextContent(textBefore)}</span>
      );
    }

    // Add code block
    const language = match[1] || undefined;
    const code = match[2];
    segments.push(
      <span key={`code-${match.index}`}>{renderCodeBlock(code, language)}</span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    segments.push(
      <span key={`text-${lastIndex}`}>{renderTextContent(remainingText)}</span>
    );
  }

  return <div className="text-sm space-y-1">{segments}</div>;
}

/**
 * Render text content (non-code-block) with markdown formatting
 */
function renderTextContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (listItems) {
      if (listItems.type === "ul") {
        elements.push(
          <ul
            key={`list-${elements.length}`}
            className="list-disc list-inside space-y-1 my-2"
            style={{ color: "inherit" }}
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
            style={{ color: "inherit" }}
          >
            {listItems.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        );
      }
      listItems = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line - flush list and add spacing
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const fontSize = level === 1 ? "text-base" : level === 2 ? "text-sm" : "text-sm";
      elements.push(
        <div
          key={`header-${i}`}
          className={cn(fontSize, "font-semibold mt-3 mb-1")}
          style={{ color: "var(--text-primary, #ffffff)" }}
          role="heading"
          aria-level={level + 2}
        >
          {renderInlineFormatting(headerText)}
        </div>
      );
      continue;
    }

    // Bullet list item (- or *)
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!listItems || listItems.type !== "ul") {
        flushList();
        listItems = { type: "ul", items: [] };
      }
      listItems.items.push(renderInlineFormatting(bulletMatch[1]));
      continue;
    }

    // Numbered list item (1. 2. etc)
    const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!listItems || listItems.type !== "ol") {
        flushList();
        listItems = { type: "ol", items: [] };
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

  // Flush any remaining list
  flushList();

  return <>{elements}</>;
}

export function MessageBubble({
  role,
  content,
  isEditProposal,
  isExplanation,
  confidence,
  isLoading,
  delay = 0,
}: MessageBubbleProps) {
  const isUser = role === "user";

  // Styles based on role and type - monochrome-first approach
  const bubbleStyles = isUser
    ? {
        background: "var(--bg-surface, #101010)",
        border: "1px solid var(--border-default, rgba(255, 255, 255, 0.12))",
        borderRadius: "16px 16px 4px 16px",
        color: "var(--text-primary, #ffffff)",
      }
    : {
        background: "var(--bg-card, #0d0d0d)",
        border: isEditProposal
          ? "1px solid rgba(245, 158, 11, 0.2)"
          : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
        borderRadius: "16px 16px 16px 4px",
        color: "var(--text-secondary, #a0a0a0)",
      };

  // Icon selection
  const Icon = isUser
    ? User
    : isEditProposal
      ? Pencil
      : isExplanation
        ? Lightbulb
        : Bot;

  // Icon backgrounds - flat monochrome, no gradients
  const iconBgColor = isUser
    ? "var(--bg-hover, #161616)"
    : isEditProposal
      ? "rgba(245, 158, 11, 0.1)"
      : "var(--bg-surface, #101010)";

  // Icon colors - muted, not bright
  const iconColor = isUser
    ? "var(--text-secondary, #a0a0a0)"
    : isEditProposal
      ? "#f59e0b"
      : "var(--text-tertiary, #666666)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.smooth, delay }}
      className={cn("flex gap-3 px-5 py-2", isUser ? "flex-row-reverse" : "")}
    >
      {/* Avatar - only show for assistant */}
      {!isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: iconBgColor }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn("max-w-[85%] px-4 py-3", isUser && "ml-auto")}
        style={bubbleStyles}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 py-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--text-tertiary, #666666)" }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--text-tertiary, #666666)" }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--text-tertiary, #666666)" }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </div>
        ) : (
          <>
            {/* Type badge for assistant messages */}
            {!isUser && (isEditProposal || isExplanation) && (
              <div className="flex items-center gap-2 mb-2">
                {isEditProposal && (
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                    }}
                  >
                    Edit Proposal
                  </span>
                )}
                {isExplanation && (
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{
                      background: "var(--bg-hover, #161616)",
                      color: "var(--text-secondary, #a0a0a0)",
                    }}
                  >
                    Explanation
                  </span>
                )}
              </div>
            )}

            {renderContent(content)}

            {/* Confidence indicator */}
            {confidence && !isUser && !isEditProposal && (
              <div className="mt-2">
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background:
                      confidence === "high"
                        ? "rgba(34, 197, 94, 0.15)"
                        : confidence === "medium"
                          ? "rgba(234, 179, 8, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                    color:
                      confidence === "high"
                        ? "#22c55e"
                        : confidence === "medium"
                          ? "#eab308"
                          : "#ef4444",
                  }}
                >
                  {confidence} confidence
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
