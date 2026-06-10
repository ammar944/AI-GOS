import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockLanguageModel {
  modelId: string;
  wrapped?: boolean;
}

interface MockMiddleware {
  name: string;
}

interface ModelModuleMocks {
  anthropicModel: (modelId: string) => MockLanguageModel;
  createAnthropic: () => (modelId: string) => MockLanguageModel;
  createDeepSeek: () => (modelId: string) => MockLanguageModel;
  createGateway: () => (modelId: string) => MockLanguageModel;
  deepseekModel: (modelId: string) => MockLanguageModel;
  devToolsMiddleware: () => MockMiddleware;
  wrapLanguageModel: (input: {
    model: MockLanguageModel;
    middleware: MockMiddleware;
  }) => MockLanguageModel;
}

const modelMocks = vi.hoisted((): ModelModuleMocks => {
  const anthropicModel = vi.fn((modelId: string): MockLanguageModel => ({
    modelId,
  }));
  const deepseekModel = vi.fn((modelId: string): MockLanguageModel => ({
    modelId,
  }));
  const devToolsMiddleware = vi.fn(
    (): MockMiddleware => ({ name: 'devtools' }),
  );
  const wrapLanguageModel = vi.fn(
    (input: {
      model: MockLanguageModel;
      middleware: MockMiddleware;
    }): MockLanguageModel => ({
      ...input.model,
      wrapped: true,
    }),
  );

  return {
    anthropicModel,
    createAnthropic: vi.fn((): ((modelId: string) => MockLanguageModel) => anthropicModel),
    createDeepSeek: vi.fn((): ((modelId: string) => MockLanguageModel) => deepseekModel),
    createGateway: vi.fn((): ((modelId: string) => MockLanguageModel) => anthropicModel),
    deepseekModel,
    devToolsMiddleware,
    wrapLanguageModel,
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: modelMocks.createAnthropic,
}));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: modelMocks.createGateway,
}));

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: modelMocks.createDeepSeek,
}));

vi.mock('@ai-sdk/devtools', () => ({
  devToolsMiddleware: modelMocks.devToolsMiddleware,
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');

  return {
    ...actual,
    wrapLanguageModel: modelMocks.wrapLanguageModel,
  };
});

async function importModels(): Promise<typeof import('../models')> {
  return import('../models');
}

describe('lab engine AI models — local DevTools', (): void => {
  afterEach((): void => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('keeps AI SDK DevTools disabled by default', async (): Promise<void> => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('NODE_ENV', 'test');

    const models = await importModels();

    expect(models.isAiSdkDevToolsEnabled()).toBe(false);
    expect(models.sectionRunnerModel).toEqual({
      modelId: 'claude-sonnet-4-5',
    });
    expect(models.reviewModel).toEqual({
      modelId: 'deepseek-v4-flash',
    });
    expect(models.strategyModel).toEqual({
      modelId: 'deepseek-v4-flash',
    });
    expect(modelMocks.wrapLanguageModel).not.toHaveBeenCalled();
  });

  it('imports without creating the selected provider client before preflight runs', async (): Promise<void> => {
    vi.stubEnv('LAB_ENGINE_PROVIDER', 'deepseek-direct');
    vi.stubEnv('DEEPSEEK_API_KEY', '');

    const models = await importModels();

    expect(models.checkSectionModelDispatchPreflight()).toEqual({
      ok: false,
      error: 'deepseek_api_key_missing',
      message:
        'LAB_ENGINE_PROVIDER=deepseek-direct requires DEEPSEEK_API_KEY.',
      missingEnv: ['DEEPSEEK_API_KEY'],
      provider: 'deepseek-direct',
    });
    expect(modelMocks.createAnthropic).not.toHaveBeenCalled();
  });

  it('wraps lab models with AI SDK DevTools only when explicitly enabled locally', async (): Promise<void> => {
    vi.stubEnv('AI_SDK_DEVTOOLS', 'true');
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('NODE_ENV', 'development');

    const models = await importModels();

    expect(models.isAiSdkDevToolsEnabled()).toBe(true);
    expect(models.sectionRunnerModel).toEqual({
      modelId: 'claude-sonnet-4-5',
      wrapped: true,
    });
    expect(models.repairModel).toEqual({
      modelId: 'claude-sonnet-4-5',
      wrapped: true,
    });
    expect(models.reviewModel).toEqual({
      modelId: 'deepseek-v4-flash',
      wrapped: true,
    });
    expect(models.strategyModel).toEqual({
      modelId: 'deepseek-v4-flash',
      wrapped: true,
    });
    expect(modelMocks.devToolsMiddleware).toHaveBeenCalledTimes(4);
    expect(modelMocks.wrapLanguageModel).toHaveBeenCalledTimes(4);
  });

  it('does not enable AI SDK DevTools in production', async (): Promise<void> => {
    vi.stubEnv('AI_SDK_DEVTOOLS', 'true');
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('NODE_ENV', 'production');

    const models = await importModels();

    expect(models.isAiSdkDevToolsEnabled()).toBe(false);
    expect(models.sectionRunnerModel).toEqual({
      modelId: 'claude-sonnet-4-5',
    });
    expect(models.reviewModel).toEqual({
      modelId: 'deepseek-v4-flash',
    });
    expect(modelMocks.wrapLanguageModel).not.toHaveBeenCalled();
  });
});
