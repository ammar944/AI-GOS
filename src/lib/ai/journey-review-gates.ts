import type { UIMessage } from 'ai';

export type JourneyReviewSection =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis';

export const JOURNEY_REVIEW_SECTION_ORDER: JourneyReviewSection[] = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
];

const SECTION_TO_TOOL_NAME: Record<JourneyReviewSection, string> = {
  industryMarket: 'researchIndustry',
  competitors: 'researchCompetitors',
  icpValidation: 'researchICP',
  offerAnalysis: 'researchOffer',
};

const POST_APPROVAL_TRANSITION_TOOL_NAMES: Record<JourneyReviewSection, string[]> = {
  industryMarket: ['researchCompetitors'],
  competitors: ['researchICP'],
  icpValidation: ['researchOffer'],
  offerAnalysis: ['synthesizeResearch', 'researchKeywords', 'researchMediaPlan'],
};

interface ApprovalEvent {
  messageIndex: number;
  section: JourneyReviewSection;
}

export interface JourneyApprovalState {
  approvedSections: Set<JourneyReviewSection>;
  latestApprovedSection: JourneyReviewSection | null;
  latestFeedbackSection: JourneyReviewSection | null;
  pendingReviewSection: JourneyReviewSection | null;
}

function parseSectionTag(
  text: string,
  prefix: '[SECTION_APPROVED:' | '[SECTION_FEEDBACK:',
): JourneyReviewSection | null {
  if (!text.startsWith(prefix)) {
    return null;
  }

  const endIndex = text.indexOf(']');
  if (endIndex === -1) {
    return null;
  }

  const section = text.slice(prefix.length, endIndex).trim();
  if (section === 'industryMarket' ||
      section === 'competitors' ||
      section === 'icpValidation' ||
      section === 'offerAnalysis') {
    return section;
  }

  return null;
}

function isHiddenMessage(message: UIMessage | undefined): boolean {
  if (!message) {
    return false;
  }

  const metadata = message.metadata;
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'hidden' in metadata &&
    metadata.hidden === true
  );
}

function getLatestApprovalEvent(messages: UIMessage[]): ApprovalEvent | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'user') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part) || !('text' in part)) {
        continue;
      }

      const textPart = part as { type?: string; text?: string };
      if (textPart.type !== 'text' || typeof textPart.text !== 'string') {
        continue;
      }

      if (textPart.text.startsWith('[SECTION_APPROVED]')) {
        return { section: 'industryMarket', messageIndex };
      }

      const parsed = parseSectionTag(textPart.text, '[SECTION_APPROVED:');
      if (parsed) {
        return { section: parsed, messageIndex };
      }
    }
  }

  return null;
}

function hasAssistantMessageAfter(messages: UIMessage[], messageIndex: number): boolean {
  for (let index = messageIndex + 1; index < messages.length; index += 1) {
    if (messages[index]?.role === 'assistant') {
      return true;
    }
  }

  return false;
}

function hasPostApprovalTransition(
  messages: UIMessage[],
  approvalEvent: ApprovalEvent,
): boolean {
  const nextToolNames = POST_APPROVAL_TRANSITION_TOOL_NAMES[approvalEvent.section];

  for (let messageIndex = approvalEvent.messageIndex + 1; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (message?.role !== 'assistant') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part)) {
        continue;
      }

      const typedPart = part as { type?: string; toolName?: string };
      if (
        typedPart.type === 'tool-invocation' &&
        typeof typedPart.toolName === 'string' &&
        nextToolNames.includes(typedPart.toolName)
      ) {
        return true;
      }

      if (
        typeof typedPart.type === 'string' &&
        nextToolNames.some((toolName) => typedPart.type === `tool-${toolName}`)
      ) {
        return true;
      }
    }
  }

  return false;
}

function getLatestSectionEventIndex(
  messages: UIMessage[],
  section: JourneyReviewSection,
  prefix: '[SECTION_APPROVED:' | '[SECTION_FEEDBACK:',
): number {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'user') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part) || !('text' in part)) {
        continue;
      }

      const textPart = part as { type?: string; text?: string };
      if (textPart.type !== 'text' || typeof textPart.text !== 'string') {
        continue;
      }

      if (section === 'industryMarket' && prefix === '[SECTION_APPROVED:' && textPart.text.startsWith('[SECTION_APPROVED]')) {
        return messageIndex;
      }

      const parsedSection = parseSectionTag(textPart.text, prefix);
      if (parsedSection === section) {
        return messageIndex;
      }
    }
  }

  return -1;
}

function getLatestSectionToolActivityIndex(
  messages: UIMessage[],
  section: JourneyReviewSection,
): number {
  const toolName = SECTION_TO_TOOL_NAME[section];

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part)) {
        continue;
      }

      const typedPart = part as { type?: string; toolName?: string };
      if (
        (typedPart.type === 'tool-invocation' && typedPart.toolName === toolName) ||
        (typedPart.type === `tool-${toolName}` && typedPart.toolName === toolName)
      ) {
        return messageIndex;
      }
    }
  }

  return -1;
}

function isSectionCurrentlyApproved(
  messages: UIMessage[],
  section: JourneyReviewSection,
): boolean {
  const approvalIndex = getLatestSectionEventIndex(
    messages,
    section,
    '[SECTION_APPROVED:',
  );
  if (approvalIndex === -1) {
    return false;
  }

  const feedbackIndex = getLatestSectionEventIndex(
    messages,
    section,
    '[SECTION_FEEDBACK:',
  );
  const toolActivityIndex = getLatestSectionToolActivityIndex(messages, section);

  return approvalIndex > feedbackIndex && approvalIndex > toolActivityIndex;
}

export function hasCompletedResearchOutput(
  messages: UIMessage[],
  toolName: string,
): boolean {
  return messages.some((message) => {
    if (message.role !== 'assistant') {
      return false;
    }

    return message.parts.some((part) => {
      if (typeof part !== 'object' || !part || !('type' in part) || !('state' in part)) {
        return false;
      }

      const typedPart = part as { type?: string; state?: string; toolName?: string };
      return (
        typedPart.type === `tool-${toolName}` &&
        typedPart.toolName === toolName &&
        typedPart.state === 'output-available'
      );
    });
  });
}

export function hasSectionApprovalMessage(messages: UIMessage[]): boolean {
  return getJourneyApprovalState(messages).latestApprovedSection !== null;
}

export function getLatestApprovedSection(
  messages: UIMessage[],
): JourneyReviewSection | null {
  return getJourneyApprovalState(messages).latestApprovedSection;
}

export function getApprovedSections(messages: UIMessage[]): Set<JourneyReviewSection> {
  const approved = new Set<JourneyReviewSection>();

  JOURNEY_REVIEW_SECTION_ORDER.forEach((section) => {
    if (isSectionCurrentlyApproved(messages, section)) {
      approved.add(section);
    }
  });

  return approved;
}

export function getLatestFeedbackSection(
  messages: UIMessage[],
): JourneyReviewSection | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'user') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part) || !('text' in part)) {
        continue;
      }

      const textPart = part as { type?: string; text?: string };
      if (textPart.type !== 'text' || typeof textPart.text !== 'string') {
        continue;
      }

      const parsed = parseSectionTag(textPart.text, '[SECTION_FEEDBACK:');
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

export function getPendingReviewSection(
  messages: UIMessage[],
): JourneyReviewSection | null {
  return getJourneyApprovalState(messages).pendingReviewSection;
}

export function getJourneyApprovalState(
  messages: UIMessage[],
): JourneyApprovalState {
  const approvedSections = getApprovedSections(messages);
  let latestApprovedSection: JourneyReviewSection | null = null;
  let latestApprovalIndex = -1;

  for (const section of approvedSections) {
    const approvalIndex = getLatestSectionEventIndex(
      messages,
      section,
      '[SECTION_APPROVED:',
    );
    if (approvalIndex >= latestApprovalIndex) {
      latestApprovalIndex = approvalIndex;
      latestApprovedSection = section;
    }
  }

  let pendingReviewSection: JourneyReviewSection | null = null;
  for (const section of JOURNEY_REVIEW_SECTION_ORDER) {
    if (approvedSections.has(section)) {
      continue;
    }

    const toolName = SECTION_TO_TOOL_NAME[section];
    if (hasCompletedResearchOutput(messages, toolName)) {
      pendingReviewSection = section;
      break;
    }
  }

  const latestFeedbackSection = getLatestFeedbackSection(messages);

  return {
    approvedSections,
    latestApprovedSection,
    latestFeedbackSection,
    pendingReviewSection,
  };
}

export function shouldSuppressDuplicatePostApprovalReplay(
  messages: UIMessage[],
): boolean {
  const latestUserMessageIndex = messages.findLastIndex(
    (message) => message.role === 'user',
  );

  if (latestUserMessageIndex === -1 || !isHiddenMessage(messages[latestUserMessageIndex])) {
    return false;
  }

  const approvalEvent = getLatestApprovalEvent(messages);
  if (!approvalEvent || approvalEvent.messageIndex >= latestUserMessageIndex) {
    return false;
  }

  if (!hasAssistantMessageAfter(messages, approvalEvent.messageIndex)) {
    return false;
  }

  return !hasPostApprovalTransition(messages, approvalEvent);
}
