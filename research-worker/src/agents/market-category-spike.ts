/**
 * Phase 3a spike: minimal ToolLoopAgent for Market Category that proves
 * the new agent-tool wrappers work end-to-end. Runs against a real URL,
 * writes via commit_artifact_section (Phase 2 RPCs), surfaces credential
 * gaps via the outputSchema instead of throwing.
 *
 * This is intentionally not wired into the dispatch route yet — Phase 3b
 * gates the cutover. Run manually:
 *
 *   tsx research-worker/src/agents/market-category-spike.ts <runId>
 *
 * The spike validates:
 * 1. AI SDK v6 ToolLoopAgent + anthropic provider work in this worker process
 * 2. POSITIONING_TOOL_MAPS.positioningMarketCategory composes into the agent
 * 3. abortSignal propagates through tool execute()s
 * 4. commit_artifact_section writes the final result via Phase 2 helpers
 */

import { anthropic } from '@ai-sdk/anthropic';
import { stepCountIs, ToolLoopAgent } from 'ai';

import {
  POSITIONING_TOOL_MAPS,
  ANTHROPIC_WEB_SEARCH_PROVIDER_TOOL,
} from '../agent-tools';
import {
  commitArtifactSection,
  ensureArtifact,
  startSectionRun,
} from '../supabase';

const MARKET_CATEGORY_INSTRUCTIONS = `You are the Market Category Intelligence specialist for an AI-GOS positioning audit.

Goal: produce a structured analysis of the company's market category. Use the provided tools to gather evidence:
- web_search for fresh market signals, category definitions, competitor announcements
- firecrawl to deeply read a specific page (competitor positioning page, analyst report)
- pagespeed if the company's own site performance is relevant to the category narrative

Be terse. Cite sources. When a tool returns a "gap" payload (missing credential, API error), do NOT retry — surface it as a known data gap in your output.

Output a single markdown document with these sections:
- # Market Category — <category>
- ## Category definition
- ## Market dynamics (growth signals + barriers)
- ## Confidence note (what's solid, what's a gap)

Stop after at most 12 tool calls or once you have a coherent answer.`;

export const marketCategorySpikeAgent = new ToolLoopAgent({
  // Anthropic native web_search lands as a provider tool in Phase 3b once the
  // subagents wire it via providerOptions. Phase 3a's spike uses the AI SDK
  // fallback (agent-tools/web-search.ts) so the agent can compile in
  // isolation; in production we configure web_search_20250901 on the
  // provider call rather than as an AI SDK tool().
  model: anthropic('claude-opus-4-6'),
  tools: POSITIONING_TOOL_MAPS.positioningMarketCategory,
  // Stop conditions cap runaway loops.
  stopWhen: stepCountIs(12),
  // AI SDK telemetry — Phase 4 wires OTEL.
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningMarketCategory',
  },
});

export interface SpikeInput {
  userId: string;
  runId: string;
  companyUrl: string;
  abortSignal?: AbortSignal;
}

export async function runMarketCategorySpike(input: SpikeInput): Promise<{
  artifactId: string;
  sectionRunId: string;
  markdown: string;
}> {
  const artifactId = await ensureArtifact(input.userId, input.runId);
  if (!artifactId) {
    throw new Error('ensure_artifact returned null — Phase 2 migration not applied?');
  }
  const sectionRunId = await startSectionRun(
    artifactId,
    'positioningMarketCategory',
    input.userId,
    `URL: ${input.companyUrl}`,
  );
  if (!sectionRunId) {
    throw new Error('start_section_run returned null');
  }

  const prompt = `Company URL: ${input.companyUrl}

${MARKET_CATEGORY_INSTRUCTIONS}`;

  let markdown = '';
  let terminalStatus: 'complete' | 'error' = 'complete';
  let errorPayload: Record<string, unknown> | null = null;
  try {
    const generation = await marketCategorySpikeAgent.generate({
      prompt,
      abortSignal: input.abortSignal,
    });
    markdown = generation.text;
  } catch (err) {
    terminalStatus = 'error';
    errorPayload = {
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Commit terminal state — covers both success and failure so the section
  // never gets stuck in `running`. start_section_run pins revision=0 +
  // section_run_id, so the first CAS lands at expected=0.
  const commit = await commitArtifactSection(
    artifactId,
    'positioningMarketCategory',
    sectionRunId,
    0,
    {
      status: terminalStatus,
      title: 'Market Category',
      markdown,
      claims: [],
      sources: [],
      error: errorPayload,
    },
  );

  if (!commit?.ok) {
    throw new Error(
      `Phase 3a spike commit failed (conflict=${commit?.conflict}, revision=${commit?.revision}). A concurrent run already advanced the section — check research_section_runs for the live run id.`,
    );
  }

  if (terminalStatus === 'error') {
    throw new Error(
      `Phase 3a spike agent.generate failed: ${errorPayload?.message ?? 'unknown'}`,
    );
  }

  return { artifactId, sectionRunId, markdown };
}

// CLI entry point — `tsx research-worker/src/agents/market-category-spike.ts ...`
if (require.main === module) {
  const [userId, runId, companyUrl] = process.argv.slice(2);
  if (!userId || !runId || !companyUrl) {
    console.error(
      'Usage: tsx market-category-spike.ts <userId> <runId> <companyUrl>',
    );
    process.exit(1);
  }
  runMarketCategorySpike({ userId, runId, companyUrl })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[spike] failed:', err);
      process.exit(1);
    });
}
