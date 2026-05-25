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
    devToolsMiddleware,
    wrapLanguageModel,
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: modelMocks.createAnthropic,
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
    vi.stubEnv('NODE_ENV', 'test');

    const models = await importModels();

    expect(models.isAiSdkDevToolsEnabled()).toBe(false);
    expect(models.sectionRunnerModel).toEqual({
      modelId: 'claude-sonnet-4-5',
    });
    expect(modelMocks.wrapLanguageModel).not.toHaveBeenCalled();
  });

  it('wraps lab models with AI SDK DevTools only when explicitly enabled locally', async (): Promise<void> => {
    vi.stubEnv('AI_SDK_DEVTOOLS', 'true');
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
    expect(modelMocks.devToolsMiddleware).toHaveBeenCalledTimes(2);
    expect(modelMocks.wrapLanguageModel).toHaveBeenCalledTimes(2);
  });

  it('does not enable AI SDK DevTools in production', async (): Promise<void> => {
    vi.stubEnv('AI_SDK_DEVTOOLS', 'true');
    vi.stubEnv('NODE_ENV', 'production');

    const models = await importModels();

    expect(models.isAiSdkDevToolsEnabled()).toBe(false);
    expect(models.sectionRunnerModel).toEqual({
      modelId: 'claude-sonnet-4-5',
    });
    expect(modelMocks.wrapLanguageModel).not.toHaveBeenCalled();
  });
});
