import { describe, it, expect } from 'vitest';
import { createDeepDiveTool } from '../deep-dive';

type DeepDiveTool = ReturnType<typeof createDeepDiveTool>;
type DeepDiveInput = Parameters<NonNullable<DeepDiveTool['execute']>>[0];

interface DeepDiveResult {
  status: 'loaded' | 'empty' | 'field-not-found';
  data: unknown;
  tokenEstimate: number;
  error?: string;
}

async function executeDeepDive(
  tool: DeepDiveTool,
  input: DeepDiveInput,
): Promise<DeepDiveResult> {
  if (tool.execute === undefined) {
    throw new Error('Expected deep dive tool to expose execute.');
  }

  const result = await tool.execute(input, {} as never);
  return result as DeepDiveResult;
}

const blueprint = {
  crossAnalysisSynthesis: {
    recommendedPositioning: 'Market leader for SMBs',
    messagingFramework: {
      adHooks: ['hook1 — pattern interrupt', 'hook2 — fear', 'hook3 — social proof'],
      advertisingAngles: [
        { angle: 'fear of loss', targetEmotion: 'anxiety', format: 'short-form video' },
        { angle: 'social proof', targetEmotion: 'trust', format: 'image' },
      ],
    },
    nextSteps: ['step1', 'step2'],
  },
  competitorAnalysis: {
    competitors: [
      { name: 'CompA', positioning: 'cheap', weaknesses: ['w1', 'w2'] },
      { name: 'CompB', positioning: 'premium', weaknesses: ['w3'] },
    ],
  },
};

describe('createDeepDiveTool', () => {
  it('returns full section data when no field specified', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await executeDeepDive(deepDive, { section: 'crossAnalysisSynthesis' });
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(blueprint.crossAnalysisSynthesis);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('returns specific field data with dot-notation path', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await executeDeepDive(
      deepDive,
      { section: 'crossAnalysisSynthesis', field: 'messagingFramework.adHooks' },
    );
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(['hook1 — pattern interrupt', 'hook2 — fear', 'hook3 — social proof']);
  });

  it('returns specific array element with index notation', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await executeDeepDive(
      deepDive,
      { section: 'competitorAnalysis', field: 'competitors[0]' },
    );
    expect(result.status).toBe('loaded');
    expect((result.data as Record<string, unknown>).name).toBe('CompA');
  });

  it('returns error for missing section', async () => {
    const deepDive = createDeepDiveTool({});
    const result = await executeDeepDive(deepDive, { section: 'crossAnalysisSynthesis' });
    expect(result.status).toBe('empty');
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('returns field-not-found for invalid path', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await executeDeepDive(
      deepDive,
      { section: 'crossAnalysisSynthesis', field: 'nonExistentField.deep' },
    );
    expect(result.status).toBe('field-not-found');
    expect(result.data).toBeNull();
  });

  it('includes tokenEstimate in response', async () => {
    const deepDive = createDeepDiveTool(blueprint);
    const result = await executeDeepDive(deepDive, { section: 'competitorAnalysis' });
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(typeof result.tokenEstimate).toBe('number');
  });
});
