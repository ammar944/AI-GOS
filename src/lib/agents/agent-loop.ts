// src/lib/agents/agent-loop.ts
// Phase 2: Agent loop — single Opus 4-7 call with thinking + tools
// Produces only ResearchBundle (Layer 1). Synthesis and MediaPlan are downstream.

import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { researchTools } from './tools';
import { agentSystemPrompt } from './prompts/agent-system';
import { ResearchBundleSchema, type ResearchBundle } from './types';

export { ResearchBundleSchema, type ResearchBundle, type SynthesisOutput, type MediaPlan } from './types';

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
 * Terminal schema: ResearchBundle (Layer 1 — pure facts only).
 * Layer 2 (SynthesisOutput) and Layer 3 (MediaPlan) are separate consumers.
 */
export async function* agentLoop(options: AgentLoopOptions) {
  const { messages, query, sections = ['all'], maxSteps = 20, thinkingBudget = 4000 } = options;

  const result = streamText({
    model: anthropic('claude-opus-4-20250514'),
    system: agentSystemPrompt({ query, sections }),
    messages: await convertToModelMessages(messages),
    tools: researchTools,
  });

  for await (const part of result.fullStream) {
    yield part;
  }
}
