import { describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_SPECS } from '../positioning';
import { runJourneySectionViaSubagent } from '../positioning-subagent-runner';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  streamObject: vi.fn(),
  modelIds: [] as string[],
}));

vi.mock('@ai-sdk/anthropic', () => {
  const anthropic = (modelId: string) => {
    mocks.modelIds.push(modelId);
    return { modelId };
  };

  return {
    anthropic: Object.assign(anthropic, {
      tools: {
        webSearch_20250305: () => ({ type: 'provider-defined', name: 'web_search' }),
      },
    }),
  };
});

vi.mock('ai', () => ({
  ToolLoopAgent: class {
    generate = mocks.generate;
    constructor() {
      // Settings are intentionally ignored; this test only verifies whether
      // the evidence loop is entered for the selected execution mode.
    }
  },
  streamObject: (...args: unknown[]) => mocks.streamObject(...args),
  tool: (definition: unknown) => definition,
}));

const marketCategoryArtifact = {
  sectionTitle: 'Market & Category Intelligence',
  verdict: 'Category is validated with explicit gaps.',
  statusSummary: 'The draft uses the Section Context Pack directly.',
  confidence: 7,
  sources: [
    { title: 'Source 1', url: 'https://example.com/1' },
    { title: 'Source 2', url: 'https://example.com/2' },
    { title: 'Source 3', url: 'https://example.com/3' },
  ],
  categoryDefinition: {
    prose: 'Category definition prose.',
    adjacentCategories: [
      {
        name: 'CRM',
        whyBuyersConfuseIt: 'Both manage pipeline work.',
        disambiguatingSignal: 'Automation-first workflows.',
      },
      {
        name: 'Meeting notes',
        whyBuyersConfuseIt: 'Both touch post-meeting workflows.',
        disambiguatingSignal: 'Revenue workflow activation.',
      },
    ],
  },
  marketSize: {
    prose: 'Market size prose.',
    signals: [
      {
        signalType: 'public-data',
        name: 'Analyst read',
        evidence: 'Public category estimate.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Analyst',
        sourceUrl: 'https://example.com/analyst',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'hiring-velocity',
        name: 'Hiring',
        evidence: 'Hiring demand is visible.',
        trajectory: 'expanding',
        methodology: 'bottom-up',
        sourceTitle: 'Jobs',
        sourceUrl: 'https://example.com/jobs',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'search-trend',
        name: 'Search',
        evidence: 'Search demand is visible.',
        trajectory: 'stable',
        methodology: 'bottom-up',
        sourceTitle: 'Search',
        sourceUrl: 'https://example.com/search',
        dateObserved: '2026-05-15',
      },
    ],
  },
  structuralForces: {
    prose: 'Structural force prose.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Compliance',
        evidence: 'Regulated workflows need audit trails.',
        implication: 'Trust claims matter.',
        impact: 'medium',
        direction: 'neutral',
      },
      {
        forceType: 'platform-shift',
        name: 'AI workflows',
        evidence: 'AI-native workflows are spreading.',
        implication: 'Speed matters.',
        impact: 'high',
        direction: 'accelerating',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Async follow-up',
        evidence: 'Teams expect async recaps.',
        implication: 'Outcome language matters.',
        impact: 'high',
        direction: 'accelerating',
      },
    ],
  },
  categoryMaturity: {
    prose: 'Maturity prose.',
    classification: {
      stage: 'growing',
      evidenceSummary: 'Buyer education exists but packaging is still moving.',
      supportingSignals: [
        {
          signalType: 'player-count',
          evidence: 'Multiple named players exist.',
          implication: 'Category is past invention.',
        },
        {
          signalType: 'buyer-education',
          evidence: 'Buyers search category terms.',
          implication: 'Education remains useful.',
        },
      ],
    },
  },
};

async function* partialObjectStream(): AsyncGenerator<typeof marketCategoryArtifact> {
  yield marketCategoryArtifact;
}

describe('runJourneySectionViaSubagent execution modes', () => {
  it('draft mode skips agent.generate and streams the typed artifact with the standard model', async () => {
    mocks.generate.mockReset();
    mocks.streamObject.mockReset();
    mocks.streamObject.mockReturnValue({
      partialObjectStream: partialObjectStream(),
      object: Promise.resolve(marketCategoryArtifact),
    });

    const result = await runJourneySectionViaSubagent(
      POSITIONING_SECTION_SPECS.positioningMarketCategory,
      'SECTION CONTEXT PACK\nmaxExternalLookups: 2\nEvidence gaps\n- gap-001: verify category',
      undefined,
      undefined,
      undefined,
      {
        executionMode: 'draft',
        toolBudget: { maxExternalLookups: 2, allowedTools: ['web_search'] },
      },
    );

    expect(result.status).toBe('complete');
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.streamObject).toHaveBeenCalledTimes(1);
    expect(mocks.streamObject.mock.calls[0]?.[0]).toMatchObject({
      model: { modelId: 'claude-sonnet-4-6' },
    });
  });
});
