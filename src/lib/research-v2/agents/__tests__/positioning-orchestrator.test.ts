import type { ToolExecutionOptions } from 'ai';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  extractOrchestratorSideEffects,
  positioningOrchestratorTools,
} = await import('../positioning-orchestrator');

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function executeTool(
  toolName: string,
  input: unknown,
): Promise<unknown> {
  const candidate = positioningOrchestratorTools[toolName];
  if (candidate === undefined || candidate.execute === undefined) {
    throw new Error(`${toolName} tool has no execute`);
  }

  const options: ToolExecutionOptions = {
    toolCallId: 'test',
    messages: [],
    abortSignal: new AbortController().signal,
  };

  return await candidate.execute(input, options);
}

describe('positioningOrchestratorTools', () => {
  it('drafts the strategy brief through a structured side-effect intent', async () => {
    const output = await executeTool('draftStrategyBrief', {
      refinement: 'Make the angle ranking more outbound-focused.',
    });

    expect(output).toMatchObject({
      type: 'strategy-brief-requested',
      refinement: 'Make the angle ranking more outbound-focused.',
      _intent: 'draft_strategy_brief',
      _payload: {
        refinement: 'Make the angle ranking more outbound-focused.',
      },
    });
  });

  it('revises the strategy brief through a structured side-effect intent', async () => {
    const patches = [
      {
        path: 'positioning.oneLiner',
        value: 'Fellow keeps revenue meetings accountable.',
      },
    ];
    const output = await executeTool('reviseStrategyBrief', {
      patches,
      changelogSummary: 'Tightened the one-liner.',
      rationale: 'Operator requested sharper revenue language.',
    });

    expect(output).toMatchObject({
      type: 'strategy-brief-revision-requested',
      patchCount: 1,
      _intent: 'revise_strategy_brief',
      _payload: {
        patches,
        changelogSummary: 'Tightened the one-liner.',
        rationale: 'Operator requested sharper revenue language.',
      },
    });
  });

  it('mounts bounded chat research tools', () => {
    expect(positioningOrchestratorTools.web_search).toBeDefined();
    expect(positioningOrchestratorTools.perplexity_research).toBeDefined();
  });
});

describe('extractOrchestratorSideEffects', () => {
  it('keeps strategy brief intents from tool outputs', () => {
    const effects = extractOrchestratorSideEffects([
      {
        output: {
          _intent: 'draft_strategy_brief',
          _payload: { refinement: null },
        },
      },
      {
        output: {
          _intent: 'revise_strategy_brief',
          _payload: {
            patches: [
              {
                path: 'positioning.oneLiner',
                value: 'Sharper line.',
              },
            ],
            changelogSummary: 'Updated one-liner.',
            rationale: 'Operator correction.',
          },
        },
      },
    ]);

    expect(effects).toHaveLength(2);
    expect(effects[0]).toEqual({
      intent: 'draft_strategy_brief',
      payload: { refinement: null },
    });
    expect(effects[1]?.intent).toBe('revise_strategy_brief');
    expect(isRecord(effects[1]?.payload)).toBe(true);
  });
});
