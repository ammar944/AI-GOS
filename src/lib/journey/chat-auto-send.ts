import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai';

function isRealtimeSyntheticMessage(message: UIMessage | undefined): boolean {
  return Boolean(message?.id?.startsWith('realtime-'));
}

export function shouldAutoSendJourneyMessages(messages: UIMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || isRealtimeSyntheticMessage(lastMessage)) {
    return false;
  }

  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
  );
}
