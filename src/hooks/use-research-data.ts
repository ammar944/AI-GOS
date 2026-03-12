// src/hooks/use-research-data.ts
// Extracts structured research output from the messages array.
// Research tool results live as UIMessage parts with type 'tool-researchXxx'
// and state 'output-available'. This hook makes them accessible.

import { useMemo } from 'react';
import type { UIMessage } from 'ai';

export type ResearchSectionKey =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'crossAnalysis'
  | 'keywordIntel'
  | 'mediaPlan';

export type ResearchStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ResearchSection {
  key: ResearchSectionKey;
  status: ResearchStatus;
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

// Maps section key → the tool part type emitted by Vercel AI SDK
const TOOL_TYPE_BY_SECTION: Record<ResearchSectionKey, string> = {
  industryMarket: 'tool-researchIndustry',
  competitors:    'tool-researchCompetitors',
  icpValidation:  'tool-researchICP',
  offerAnalysis:  'tool-researchOffer',
  crossAnalysis:  'tool-synthesizeResearch',
  keywordIntel:   'tool-researchKeywords',
  mediaPlan:      'tool-researchMediaPlan',
};

const SECTION_KEYS: ResearchSectionKey[] = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
  'crossAnalysis',
  'keywordIntel',
  'mediaPlan',
];

function deriveSection(key: ResearchSectionKey, messages: UIMessage[]): ResearchSection {
  const expectedType = TOOL_TYPE_BY_SECTION[key];

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (p.type !== expectedType) continue;

      const state = p.state as string | undefined;
      const output = p.output as Record<string, unknown> | undefined;

      if (state === 'output-available') {
        // Tool completed — extract data from output
        const toolOutput = output ?? {};
        const outputStatus = typeof toolOutput.status === 'string' ? toolOutput.status : 'complete';
        if (outputStatus === 'error' || outputStatus === 'partial') {
          return {
            key,
            status: 'error',
            data: (toolOutput.data ?? undefined) as Record<string, unknown> | undefined,
            error:
              (toolOutput.error as string | undefined) ??
              (outputStatus === 'partial'
                ? 'Research artifact failed validation.'
                : 'Research failed'),
          };
        }
        const data = (toolOutput.data ?? toolOutput) as Record<string, unknown>;
        return {
          key,
          status: 'complete',
          data,
          durationMs: toolOutput.durationMs as number | undefined,
        };
      }
      if (state === 'output-error') {
        const toolOutput = output ?? {};
        return {
          key,
          status: 'error',
          error: (toolOutput.error as string) ?? 'Research failed',
        };
      }
      if (state === 'input-streaming' || state === 'input-available') {
        return { key, status: 'running' };
      }
    }
  }

  return { key, status: 'pending' };
}

export interface UseResearchDataReturn {
  sections: Record<ResearchSectionKey, ResearchSection>;
  completedSections: ResearchSectionKey[];
  runningSections: ResearchSectionKey[];
  allComplete: boolean;
  anyRunning: boolean;
}

export function useResearchData(messages: UIMessage[]): UseResearchDataReturn {
  return useMemo(() => {
    const sections = {} as Record<ResearchSectionKey, ResearchSection>;
    for (const key of SECTION_KEYS) {
      sections[key] = deriveSection(key, messages);
    }
    const completedSections = SECTION_KEYS.filter((k) => sections[k].status === 'complete');
    const runningSections = SECTION_KEYS.filter((k) => sections[k].status === 'running');
    return {
      sections,
      completedSections,
      runningSections,
      allComplete: completedSections.length === SECTION_KEYS.length,
      anyRunning: runningSections.length > 0,
    };
  }, [messages]);
}
