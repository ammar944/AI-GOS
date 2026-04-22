// src/lib/agents/agent-loop.ts
// Phase 1: Agent loop skeleton — single Opus 4-7 call with thinking + tools

import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { researchTools } from './tools';
import { agentSystemPrompt } from './prompts/agent-system';
import { ResearchReportSchema, type ResearchReport } from './types';

export { ResearchReportSchema, type ResearchReport } from './types';

export interface AgentLoopOptions {
  messages: UIMessage[];
  query: string;
  sections?: string[];
  maxSteps?: number;
  thinkingBudget?: number;
}

/**
 * Single Opus 4-7 agent loop with tool use.
 * One model call. Full context. Tools for external data.
 */
export async function* agentLoop(options: AgentLoopOptions) {
  const { messages, query, sections = ['all'], maxSteps = 20, thinkingBudget = 4000 } = options;

  const result = streamText({
    model: anthropic('claude-opus-4-20250514'),
    system: agentSystemPrompt({ query, sections }),
    messages: await convertToModelMessages(messages),
    tools: researchTools,
    maxSteps,
  });

  for await (const part of result.fullStream) {
    yield part;
  }
}
