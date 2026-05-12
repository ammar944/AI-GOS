import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyIntent } from '../intent-router';
import type { IntentRouterInput, IntentResult } from '../intent-router.types';

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const baseInput: IntentRouterInput = {
  userMessage: '',
  auditContext: {
    runId: 'run-123',
    sections: [
      {
        sectionId: 'positioningMarketCategory',
        title: 'Market Category',
        statusSummary: 'Market category section is complete.',
        keyFindingTitles: ['Market size'],
      },
      {
        sectionId: 'positioningCompetitorLandscape',
        title: 'Competitor Landscape',
        statusSummary: 'Competitor landscape section is complete.',
        keyFindingTitles: ['Cartesia positioning'],
      },
    ],
  },
  chatHistory: [],
};

function mockGenerateTextResult(intent: IntentResult): void {
  vi.mocked(generateText).mockResolvedValue({
    text: JSON.stringify(intent),
  } as Awaited<ReturnType<typeof generateText>>);
}

function inputFor(userMessage: string): IntentRouterInput {
  return {
    ...baseInput,
    userMessage,
  };
}

describe('classifyIntent', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it('classifies redo competitor analysis as a rerun for competitor landscape', async () => {
    mockGenerateTextResult({
      kind: 'rerun',
      target_section: 'positioningCompetitorLandscape',
      instruction: 'Redo the competitor analysis.',
      patch: null,
    });

    const intent = await classifyIntent(inputFor('redo the competitor analysis'));

    expect(intent.kind).toBe('rerun');
    expect(intent.target_section).toBe('positioningCompetitorLandscape');
  });

  it('classifies focused competitor analysis as rerun with Cartesia instruction', async () => {
    mockGenerateTextResult({
      kind: 'rerun',
      target_section: 'positioningCompetitorLandscape',
      instruction: 'Make the competitor analysis focus on Cartesia.',
      patch: null,
    });

    const intent = await classifyIntent(
      inputFor('make the competitor analysis focus on Cartesia'),
    );

    expect(intent.kind).toBe('rerun');
    expect(intent.target_section).toBe('positioningCompetitorLandscape');
    expect(intent.instruction).toContain('Cartesia');
  });

  it('classifies a market size correction as a market category patch', async () => {
    mockGenerateTextResult({
      kind: 'patch',
      target_section: 'positioningMarketCategory',
      instruction: 'Correct the market size evidence.',
      patch: {
        path: 'keyFindings[0].evidence',
        value: 'Market size: $30B',
      },
    });

    const intent = await classifyIntent(inputFor('the market size should be $30B not $20B'));

    expect(intent.kind).toBe('patch');
    expect(intent.target_section).toBe('positioningMarketCategory');
    expect(intent.patch).toEqual({
      path: 'keyFindings[0].evidence',
      value: 'Market size: $30B',
    });
  });

  it('classifies discussion as converse with no target', async () => {
    mockGenerateTextResult({
      kind: 'converse',
      target_section: null,
      instruction: '',
      patch: null,
    });

    const intent = await classifyIntent(inputFor('what do you think about the Cartesia angle'));

    expect(intent).toEqual({
      kind: 'converse',
      target_section: null,
      instruction: '',
      patch: null,
    });
  });

  it('defaults to converse on malformed JSON', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{not-json',
    } as Awaited<ReturnType<typeof generateText>>);

    const intent = await classifyIntent(inputFor('redo the competitor analysis'));

    expect(intent).toEqual({
      kind: 'converse',
      target_section: null,
      instruction: '',
      patch: null,
    });
  });

  it('defaults to converse when a patch is missing the required patch field', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        kind: 'patch',
        target_section: 'positioningMarketCategory',
        instruction: 'Correct the market size evidence.',
        patch: null,
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    const intent = await classifyIntent(inputFor('the market size should be $30B not $20B'));

    expect(intent).toEqual({
      kind: 'converse',
      target_section: null,
      instruction: '',
      patch: null,
    });
  });

  it('defaults to converse when the LLM call throws', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('model unavailable'));

    const intent = await classifyIntent(inputFor('redo the competitor analysis'));

    expect(intent).toEqual({
      kind: 'converse',
      target_section: null,
      instruction: '',
      patch: null,
    });
  });
});
