import type { UIMessage } from 'ai';

const RESEARCH_TOOL_TO_SECTION: Record<string, string> = {
  researchIndustry: 'industryMarket',
  researchCompetitors: 'competitors',
  researchICP: 'icpValidation',
  researchOffer: 'offerAnalysis',
  synthesizeResearch: 'crossAnalysis',
  researchKeywords: 'keywordIntel',
  researchMediaPlan: 'mediaPlan',
};

export interface ResearchDispatchState {
  status: 'queued' | 'error';
  error?: string;
}

function parseToolOutput(output: unknown): Record<string, unknown> | null {
  if (typeof output === 'string') {
    try {
      return JSON.parse(output) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof output === 'object' && output !== null) {
    return output as Record<string, unknown>;
  }

  return null;
}

export function extractResearchDispatchState(
  messages: UIMessage[],
): Record<string, ResearchDispatchState> {
  const states: Record<string, ResearchDispatchState> = {};

  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue;
    }

    for (const part of message.parts) {
      if (typeof part !== 'object' || !part || !('type' in part)) {
        continue;
      }

      const typedPart = part as Record<string, unknown>;

      if (typedPart.type === 'tool-invocation') {
        const toolName =
          typeof typedPart.toolName === 'string' ? typedPart.toolName : undefined;
        const section = toolName ? RESEARCH_TOOL_TO_SECTION[toolName] : undefined;
        if (section && !states[section]) {
          states[section] = { status: 'queued' };
        }
        continue;
      }

      const toolType =
        typeof typedPart.type === 'string' && typedPart.type.startsWith('tool-')
          ? typedPart.type.replace('tool-', '')
          : null;
      if (!toolType || !RESEARCH_TOOL_TO_SECTION[toolType]) {
        continue;
      }

      const section = RESEARCH_TOOL_TO_SECTION[toolType];
      const state = typeof typedPart.state === 'string' ? typedPart.state : undefined;

      if (state === 'output-error') {
        states[section] = {
          status: 'error',
          error:
            typeof typedPart.errorText === 'string'
              ? typedPart.errorText
              : 'Research dispatch failed',
        };
        continue;
      }

      if (state !== 'output-available') {
        continue;
      }

      const parsedOutput = parseToolOutput(typedPart.output);
      const outputStatus =
        typeof parsedOutput?.status === 'string' ? parsedOutput.status : undefined;

      if (outputStatus === 'error') {
        states[section] = {
          status: 'error',
          error:
            typeof parsedOutput?.error === 'string'
              ? parsedOutput.error
              : 'Research dispatch failed',
        };
        continue;
      }

      if (outputStatus === 'queued' && !states[section]) {
        states[section] = { status: 'queued' };
        continue;
      }

      if (outputStatus === 'complete' || outputStatus === 'partial') {
        delete states[section];
      }
    }
  }

  return states;
}
