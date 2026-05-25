import { describe, expect, it } from "vitest";

import {
  createSectionModelSelection,
  DEEPSEEK_SECTION_MODEL_ID,
  resolveSectionModelProvider,
  SONNET_SECTION_MODEL_ID,
} from "../models";

function buildEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides };
}

describe("resolveSectionModelProvider", (): void => {
  it("defaults to anthropic when LAB_ENGINE_PROVIDER is unset", (): void => {
    expect(resolveSectionModelProvider(buildEnv())).toBe("anthropic");
  });

  it("accepts the direct DeepSeek provider flag", (): void => {
    expect(
      resolveSectionModelProvider(
        buildEnv({ LAB_ENGINE_PROVIDER: "deepseek-direct" }),
      ),
    ).toBe("deepseek-direct");
  });

  it("rejects unknown provider flags", (): void => {
    expect(() =>
      resolveSectionModelProvider(
        buildEnv({ LAB_ENGINE_PROVIDER: "openrouter" }),
      ),
    ).toThrow(
      'Invalid LAB_ENGINE_PROVIDER="openrouter". Expected one of: anthropic, deepseek-direct, deepseek-ollama.',
    );
  });
});

describe("createSectionModelSelection", (): void => {
  it("selects Anthropic Sonnet by default", (): void => {
    const selection = createSectionModelSelection(buildEnv());

    expect(selection.metadata).toEqual({
      provider: "anthropic",
      modelId: SONNET_SECTION_MODEL_ID,
      repairModelId: SONNET_SECTION_MODEL_ID,
      transport: "anthropic",
    });
    expect(selection.sectionRunnerModel.provider).toBe("anthropic.messages");
    expect(selection.sectionRunnerModel.modelId).toBe(SONNET_SECTION_MODEL_ID);
  });

  it("selects direct DeepSeek v4 flash", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        DEEPSEEK_API_KEY: "test-deepseek-key",
        LAB_ENGINE_PROVIDER: "deepseek-direct",
      }),
    );

    expect(selection.metadata).toEqual({
      provider: "deepseek-direct",
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      repairModelId: DEEPSEEK_SECTION_MODEL_ID,
      transport: "deepseek-direct",
    });
    expect(selection.sectionRunnerModel.provider).toBe("deepseek.chat");
    expect(selection.sectionRunnerModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
  });

  it("selects DeepSeek v4 flash through the local Ollama transport", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        DEEPSEEK_OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1",
        LAB_ENGINE_PROVIDER: "deepseek-ollama",
      }),
    );

    expect(selection.metadata).toEqual({
      baseURL: "http://127.0.0.1:11434/v1",
      provider: "deepseek-ollama",
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      repairModelId: DEEPSEEK_SECTION_MODEL_ID,
      transport: "ollama-openai-compatible",
    });
    expect(selection.sectionRunnerModel.provider).toBe("ollama.chat");
    expect(selection.sectionRunnerModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
  });

  it("allows Ollama to use the locally installed tagged model id", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        DEEPSEEK_OLLAMA_MODEL_ID: "deepseek-v4-flash:cloud",
        LAB_ENGINE_PROVIDER: "deepseek-ollama",
      }),
    );

    expect(selection.metadata.modelId).toBe("deepseek-v4-flash:cloud");
    expect(selection.metadata.repairModelId).toBe("deepseek-v4-flash:cloud");
    expect(selection.sectionRunnerModel.modelId).toBe(
      "deepseek-v4-flash:cloud",
    );
  });
});
