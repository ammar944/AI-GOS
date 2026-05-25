import { describe, it, expect } from 'vitest';
import { createDeepDiveTool } from '../deep-dive';

type DeepDiveSection =
  | 'industryMarketOverview'
  | 'icpAnalysisValidation'
  | 'offerAnalysisViability'
  | 'competitorAnalysis'
  | 'crossAnalysisSynthesis';

interface DeepDiveInput {
  section: DeepDiveSection;
  field?: string;
}

type DeepDiveResult =
  | {
      section: DeepDiveSection;
      label: string;
      status: 'empty';
      data: null;
      error: string;
    }
  | {
      section: DeepDiveSection;
      label: string;
      field: string;
      status: 'field-not-found';
      data: null;
      error: string;
    }
  | {
      section: DeepDiveSection;
      label: string;
      field?: string;
      status: 'loaded';
      data: unknown;
      tokenEstimate: number;
      warning?: string;
    };

type DeepDiveExecute = (
  input: DeepDiveInput,
  options: never,
) => DeepDiveResult | PromiseLike<DeepDiveResult>;

function expectLoaded(result: DeepDiveResult): asserts result is Extract<DeepDiveResult, { status: 'loaded' }> {
  expect(result.status).toBe('loaded');
  if (result.status !== 'loaded') {
    throw new Error(`Expected loaded deep-dive result, received ${result.status}`);
  }
}

function expectEmpty(result: DeepDiveResult): asserts result is Extract<DeepDiveResult, { status: 'empty' }> {
  expect(result.status).toBe('empty');
  if (result.status !== 'empty') {
    throw new Error(`Expected empty deep-dive result, received ${result.status}`);
  }
}

async function executeDeepDive(
  blueprintInput: Record<string, unknown>,
  input: DeepDiveInput,
): Promise<DeepDiveResult> {
  const execute = createDeepDiveTool(blueprintInput).execute;
  if (!execute) {
    throw new Error('createDeepDiveTool returned a tool without execute');
  }
  return (execute as unknown as DeepDiveExecute)(input, {} as never);
}

const blueprint: Record<string, unknown> = {
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
    const result = await executeDeepDive(blueprint, { section: 'crossAnalysisSynthesis' });
    expectLoaded(result);
    expect(result.data).toEqual(blueprint.crossAnalysisSynthesis);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('returns specific field data with dot-notation path', async () => {
    const result = await executeDeepDive(
      blueprint,
      { section: 'crossAnalysisSynthesis', field: 'messagingFramework.adHooks' },
    );
    expectLoaded(result);
    expect(result.data).toEqual(['hook1 — pattern interrupt', 'hook2 — fear', 'hook3 — social proof']);
  });

  it('returns specific array element with index notation', async () => {
    const result = await executeDeepDive(
      blueprint,
      { section: 'competitorAnalysis', field: 'competitors[0]' },
    );
    expectLoaded(result);
    expect((result.data as Record<string, unknown>).name).toBe('CompA');
  });

  it('returns error for missing section', async () => {
    const result = await executeDeepDive({}, { section: 'crossAnalysisSynthesis' });
    expectEmpty(result);
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('returns field-not-found for invalid path', async () => {
    const result = await executeDeepDive(
      blueprint,
      { section: 'crossAnalysisSynthesis', field: 'nonExistentField.deep' },
    );
    expect(result.status).toBe('field-not-found');
    expect(result.data).toBeNull();
  });

  it('includes tokenEstimate in response', async () => {
    const result = await executeDeepDive(blueprint, { section: 'competitorAnalysis' });
    expectLoaded(result);
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(typeof result.tokenEstimate).toBe('number');
  });
});
