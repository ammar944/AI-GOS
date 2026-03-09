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

export function sanitizeJourneyMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => {
      if (
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        typeof part.type === 'string' &&
        part.type.startsWith('tool-') &&
        part.type !== 'tool-invocation'
      ) {
        const state = (part as Record<string, unknown>).state as string | undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) {
          return false;
        }
      }

      return true;
    }),
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
