// Message sanitization for cross-provider compatibility
// Used by the unified chat route to clean message history before
// sending to different providers (Claude vs Perplexity).
//
// SANITIZATION TARGETS:
// 'perplexity' — strip tool parts, thinking blocks, edit proposals.
//                Keep only text user/assistant turns.
//                Enforce alternating user/assistant messages.
// 'claude'     — strip Perplexity [1][2][3] citation markers from
//                assistant turns. Strip thinking block content from
//                prior turns to avoid confusion.

import type { UIMessage } from '@ai-sdk/react';

type SanitizeTarget = 'perplexity' | 'claude';

interface SanitizedMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Extract text content from a UIMessage, stripping non-text parts.
 * UIMessage in AI SDK v6 uses `parts` (not `content`).
 */
function extractTextContent(message: UIMessage): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => {
        return (
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as Record<string, unknown>).type === 'text' &&
          'text' in part &&
          typeof (part as Record<string, unknown>).text === 'string'
        );
      })
      .map((part) => part.text)
      .join('\n');
  }

  return '';
}

/**
 * Strip Perplexity citation markers [1], [2], etc. from text.
 */
function stripCitationMarkers(text: string): string {
  return text.replace(/\[(\d+)\]/g, '');
}

/**
 * Sanitize messages for a target provider.
 *
 * @param messages - UIMessage array from useChat
 * @param target - 'perplexity' or 'claude'
 * @returns Cleaned message array safe for the target provider
 */
export function sanitizeMessages(
  messages: UIMessage[],
  target: SanitizeTarget
): SanitizedMessage[] {
  const cleaned: SanitizedMessage[] = [];

  for (const msg of messages) {
    // Only keep user and assistant messages
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;

    let text = extractTextContent(msg);
    if (!text.trim()) continue;

    if (target === 'claude') {
      // Strip Perplexity citation markers from assistant messages
      if (msg.role === 'assistant') {
        text = stripCitationMarkers(text);
      }
    }

    cleaned.push({
      role: msg.role as 'user' | 'assistant',
      content: text.trim(),
    });
  }

  if (target === 'perplexity') {
    // Perplexity requires alternating user/assistant messages.
    // If we have consecutive same-role messages, merge them.
    const alternating: SanitizedMessage[] = [];
    for (const msg of cleaned) {
      const last = alternating[alternating.length - 1];
      if (last && last.role === msg.role) {
        // Merge consecutive same-role messages
        last.content += '\n\n' + msg.content;
      } else {
        alternating.push({ ...msg });
      }
    }
    return alternating;
  }

  return cleaned;
}
