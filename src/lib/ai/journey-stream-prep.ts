import type { UIMessage } from 'ai';

const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
]);

interface CompactJourneyMessagesOptions {
  preserveRecentMessages?: number;
  maxResearchContentChars?: number;
}

function compactResearchOutput(
  output: Record<string, unknown>,
  maxResearchContentChars: number,
): Record<string, unknown> {
  const content = typeof output.content === 'string' ? output.content : '';
  const compactedContent =
    content.length > maxResearchContentChars
      ? `${content.slice(0, maxResearchContentChars)}…`
      : content;

  return {
    status: output.status,
    sectionId: output.sectionId,
    content: compactedContent,
    compacted: true,
  };
}

function isIncompleteToolPart(part: UIMessage['parts'][number]): boolean {
  if (
    typeof part !== 'object' ||
    part === null ||
    !('type' in part) ||
    typeof part.type !== 'string' ||
    !part.type.startsWith('tool-') ||
    part.type === 'tool-invocation'
  ) {
    return false;
  }

  const state = 'state' in part && typeof part.state === 'string'
    ? part.state
    : undefined;

  return state !== undefined && INCOMPLETE_TOOL_STATES.has(state);
}

function hasReasoningPart(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      part.type === 'reasoning',
  );
}

function isUnsupportedThinkingPart(part: UIMessage['parts'][number]): boolean {
  if (typeof part !== 'object' || part === null || !('type' in part)) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- guard against runtime parts not in SDK types
  const t = (part as any).type;
  return t === 'thinking' || t === 'redacted_thinking';
}

export function sanitizeJourneyMessages(messages: UIMessage[]): UIMessage[] {
  const latestAssistantMessageIndex = messages.findLastIndex(
    (message) => message.role === 'assistant',
  );

  return messages.map((msg, index) => ({
    ...msg,
    parts:
      msg.role === 'assistant' &&
      (hasReasoningPart(msg) || index === latestAssistantMessageIndex)
        ? msg.parts.filter((part) => !isUnsupportedThinkingPart(part))
        : msg.parts.filter(
            (part) =>
              !isIncompleteToolPart(part) && !isUnsupportedThinkingPart(part),
          ),
  })) as UIMessage[];
}

export function compactJourneyMessagesForModel(
  messages: UIMessage[],
  options: CompactJourneyMessagesOptions = {},
): UIMessage[] {
  const preserveRecentMessages = options.preserveRecentMessages ?? 2;
  const maxResearchContentChars = options.maxResearchContentChars ?? 600;
  const compactBeforeIndex = Math.max(0, messages.length - preserveRecentMessages);

  return messages.map((message, index) => {
    if (index >= compactBeforeIndex) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (
          typeof part !== 'object' ||
          part == null ||
          part.type !== 'tool-generateResearch' ||
          (part as Record<string, unknown>).state !== 'output-available'
        ) {
          return part;
        }

        const record = part as Record<string, unknown>;
        const output = record.output;
        if (typeof output !== 'object' || output == null) {
          return part;
        }

        return {
          ...record,
          output: compactResearchOutput(
            output as Record<string, unknown>,
            maxResearchContentChars,
          ),
        };
      }),
    } as UIMessage;
  });
}
