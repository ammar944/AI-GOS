interface JourneyPart {
  type: string;
  toolName?: string;
  [key: string]: unknown;
}

function isResearchToolName(toolName: string | undefined): boolean {
  return toolName === 'researchIndustry' ||
    toolName === 'researchCompetitors' ||
    toolName === 'researchICP' ||
    toolName === 'researchOffer' ||
    toolName === 'synthesizeResearch' ||
    toolName === 'researchKeywords' ||
    toolName === 'researchMediaPlan';
}

function isJourneyPart(part: unknown): part is JourneyPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    typeof part.type === 'string'
  );
}

export function filterJourneyMessageParts(parts: unknown[]): JourneyPart[] {
  return parts.filter((part): part is JourneyPart => {
    if (!isJourneyPart(part)) {
      return false;
    }

    if (part.type === 'reasoning') {
      return false;
    }

    if (part.type === 'tool-invocation') {
      return !isResearchToolName(part.toolName);
    }

    if (part.type.startsWith('tool-')) {
      return !isResearchToolName(part.type.replace('tool-', ''));
    }

    return true;
  });
}
