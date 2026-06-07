import { describe, expect, it } from "vitest";

import {
  checkSectionModelDispatchPreflight,
  createSectionModelSelection,
  DEEPSEEK_PRO_MODEL_ID,
  DEEPSEEK_SECTION_MODEL_ID,
  GATEWAY_GPT_55_REVIEW_MODEL_ID,
  OPUS_REVIEW_MODEL_ID,
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

describe("checkSectionModelDispatchPreflight", (): void => {
  it("requires an explicit provider for local lab section dispatches", (): void => {
    const result = checkSectionModelDispatchPreflight(buildEnv());

    expect(result).toEqual({
      ok: false,
      error: "lab_engine_provider_unset",
      message:
        "LAB_ENGINE_PROVIDER is unset for a local lab section dispatch. Set LAB_ENGINE_PROVIDER=deepseek-direct with DEEPSEEK_API_KEY, or explicitly set LAB_ENGINE_PROVIDER=anthropic.",
      missingEnv: ["LAB_ENGINE_PROVIDER"],
      provider: "anthropic",
    });
  });

  it("allows the production Anthropic default only when Anthropic auth is configured", (): void => {
    expect(
      checkSectionModelDispatchPreflight(
        buildEnv({
          ANTHROPIC_API_KEY: "test-anthropic-key",
          NODE_ENV: "production",
          VERCEL: "1",
        }),
      ),
    ).toEqual({
      ok: true,
      modelId: SONNET_SECTION_MODEL_ID,
      provider: "anthropic",
    });
  });

  it("rejects the production Anthropic default when Anthropic auth is missing", (): void => {
    expect(
      checkSectionModelDispatchPreflight(
        buildEnv({
          NODE_ENV: "production",
          VERCEL: "1",
        }),
      ),
    ).toEqual({
      ok: false,
      error: "anthropic_api_key_missing",
      message:
        "LAB_ENGINE_PROVIDER resolved to anthropic but ANTHROPIC_API_KEY is missing.",
      missingEnv: ["ANTHROPIC_API_KEY"],
      provider: "anthropic",
    });
  });

  it("requires DeepSeek auth for direct DeepSeek dispatches", (): void => {
    expect(
      checkSectionModelDispatchPreflight(
        buildEnv({ LAB_ENGINE_PROVIDER: "deepseek-direct" }),
      ),
    ).toEqual({
      ok: false,
      error: "deepseek_api_key_missing",
      message:
        "LAB_ENGINE_PROVIDER=deepseek-direct requires DEEPSEEK_API_KEY.",
      missingEnv: ["DEEPSEEK_API_KEY"],
      provider: "deepseek-direct",
    });
  });

  it("passes direct DeepSeek dispatches with auth configured", (): void => {
    expect(
      checkSectionModelDispatchPreflight(
        buildEnv({
          DEEPSEEK_API_KEY: "test-deepseek-key",
          LAB_ENGINE_PROVIDER: "deepseek-direct",
        }),
      ),
    ).toEqual({
      ok: true,
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      provider: "deepseek-direct",
    });
  });
});

describe("createSectionModelSelection", (): void => {
  it("selects Anthropic Sonnet by default", (): void => {
    const selection = createSectionModelSelection(buildEnv());

    expect(selection.metadata).toEqual({
      provider: "anthropic",
      modelId: SONNET_SECTION_MODEL_ID,
      repairModelId: SONNET_SECTION_MODEL_ID,
      reviewModel: {
        provider: "anthropic",
        modelId: SONNET_SECTION_MODEL_ID,
        transport: "anthropic",
      },
      strategyModel: {
        provider: "anthropic",
        modelId: SONNET_SECTION_MODEL_ID,
        transport: "anthropic",
      },
      transport: "anthropic",
    });
    expect(selection.sectionRunnerModel.provider).toBe("anthropic.messages");
    expect(selection.sectionRunnerModel.modelId).toBe(SONNET_SECTION_MODEL_ID);
    expect(selection.reviewModel.provider).toBe("anthropic.messages");
    expect(selection.reviewModel.modelId).toBe(SONNET_SECTION_MODEL_ID);
  });

  it("selects direct DeepSeek v4 flash for sections and pro for default strategy", (): void => {
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
      reviewModel: {
        provider: "deepseek-direct",
        modelId: DEEPSEEK_SECTION_MODEL_ID,
        transport: "deepseek-direct",
      },
      strategyModel: {
        provider: "deepseek-direct",
        modelId: DEEPSEEK_PRO_MODEL_ID,
        transport: "deepseek-direct",
      },
      transport: "deepseek-direct",
    });
    expect(selection.sectionRunnerModel.provider).toBe("deepseek.chat");
    expect(selection.sectionRunnerModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
    expect(selection.reviewModel.provider).toBe("deepseek.chat");
    expect(selection.reviewModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
    expect(selection.strategyModel.provider).toBe("deepseek.chat");
    expect(selection.strategyModel.modelId).toBe(DEEPSEEK_PRO_MODEL_ID);
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
      reviewModel: {
        provider: "deepseek-ollama",
        modelId: DEEPSEEK_SECTION_MODEL_ID,
        transport: "ollama-openai-compatible",
      },
      strategyModel: {
        provider: "deepseek-ollama",
        modelId: DEEPSEEK_SECTION_MODEL_ID,
        transport: "ollama-openai-compatible",
      },
      transport: "ollama-openai-compatible",
    });
    expect(selection.sectionRunnerModel.provider).toBe("ollama.chat");
    expect(selection.sectionRunnerModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
    expect(selection.reviewModel.provider).toBe("ollama.chat");
    expect(selection.reviewModel.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
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
    expect(selection.reviewModel.modelId).toBe("deepseek-v4-flash:cloud");
    expect(selection.strategyModel.modelId).toBe("deepseek-v4-flash:cloud");
  });

  it("treats a blank review model flag as the default Sonnet model", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({ LAB_REVIEW_MODEL: "   " }),
    );

    expect(selection.metadata.reviewModel.modelId).toBe(SONNET_SECTION_MODEL_ID);
    expect(selection.reviewModel.provider).toBe("anthropic.messages");
  });

  it("allows the review and strategy model to use Anthropic Opus", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({ LAB_REVIEW_MODEL: "opus" }),
    );

    expect(selection.metadata.reviewModel).toEqual({
      provider: "anthropic",
      modelId: OPUS_REVIEW_MODEL_ID,
      transport: "anthropic",
    });
    expect(selection.metadata.strategyModel).toEqual({
      provider: "anthropic",
      modelId: OPUS_REVIEW_MODEL_ID,
      transport: "anthropic",
    });
    expect(selection.reviewModel.provider).toBe("anthropic.messages");
    expect(selection.reviewModel.modelId).toBe(OPUS_REVIEW_MODEL_ID);
    expect(selection.strategyModel.modelId).toBe(OPUS_REVIEW_MODEL_ID);
  });

  it("accepts full Anthropic review model ids", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({ LAB_REVIEW_MODEL: SONNET_SECTION_MODEL_ID }),
    );

    expect(selection.metadata.reviewModel).toEqual({
      provider: "anthropic",
      modelId: SONNET_SECTION_MODEL_ID,
      transport: "anthropic",
    });
    expect(selection.reviewModel.provider).toBe("anthropic.messages");
  });

  it("decouples the review model from the section provider", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        DEEPSEEK_API_KEY: "test-deepseek-key",
        LAB_ENGINE_PROVIDER: "deepseek-direct",
        LAB_REVIEW_MODEL: "opus",
      }),
    );

    expect(selection.metadata.modelId).toBe(DEEPSEEK_SECTION_MODEL_ID);
    expect(selection.sectionRunnerModel.provider).toBe("deepseek.chat");
    expect(selection.metadata.reviewModel.modelId).toBe(OPUS_REVIEW_MODEL_ID);
    expect(selection.metadata.strategyModel.modelId).toBe(OPUS_REVIEW_MODEL_ID);
    expect(selection.reviewModel.provider).toBe("anthropic.messages");
    expect(selection.strategyModel.provider).toBe("anthropic.messages");
  });

  it("supports GPT-5.5 through Vercel AI Gateway", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        AI_GATEWAY_API_KEY: "test-gateway-key",
        LAB_REVIEW_MODEL: "gpt-5.5",
      }),
    );

    expect(selection.metadata.reviewModel).toEqual({
      provider: "gateway",
      modelId: GATEWAY_GPT_55_REVIEW_MODEL_ID,
      transport: "gateway",
    });
    expect(selection.reviewModel.provider).toBe("gateway");
    expect(selection.reviewModel.modelId).toBe(GATEWAY_GPT_55_REVIEW_MODEL_ID);
  });

  it("supports explicit Gateway review model ids", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        AI_GATEWAY_API_KEY: "test-gateway-key",
        LAB_REVIEW_MODEL: "gateway:anthropic/claude-opus-4.6",
      }),
    );

    expect(selection.metadata.reviewModel).toEqual({
      provider: "gateway",
      modelId: "anthropic/claude-opus-4.6",
      transport: "gateway",
    });
    expect(selection.reviewModel.provider).toBe("gateway");
    expect(selection.reviewModel.modelId).toBe("anthropic/claude-opus-4.6");
  });

  it("allows Gateway review models in Vercel auth context without a local API key", (): void => {
    const selection = createSectionModelSelection(
      buildEnv({
        LAB_REVIEW_MODEL: GATEWAY_GPT_55_REVIEW_MODEL_ID,
        VERCEL: "1",
      }),
    );

    expect(selection.reviewModel.provider).toBe("gateway");
    expect(selection.reviewModel.modelId).toBe(GATEWAY_GPT_55_REVIEW_MODEL_ID);
  });

  it("requires Gateway auth when the review model uses Gateway", (): void => {
    expect(() =>
      createSectionModelSelection(
        buildEnv({ LAB_REVIEW_MODEL: GATEWAY_GPT_55_REVIEW_MODEL_ID }),
      ),
    ).toThrow(
      'LAB_REVIEW_MODEL="openai/gpt-5.5" requires AI_GATEWAY_API_KEY or Vercel Gateway auth context.',
    );
  });

  it("does not treat a Vercel OIDC token as local Gateway API-key auth", (): void => {
    expect(() =>
      createSectionModelSelection(
        buildEnv({
          LAB_REVIEW_MODEL: GATEWAY_GPT_55_REVIEW_MODEL_ID,
          VERCEL_OIDC_TOKEN: "oidc-token",
        }),
      ),
    ).toThrow(
      'LAB_REVIEW_MODEL="openai/gpt-5.5" requires AI_GATEWAY_API_KEY or Vercel Gateway auth context.',
    );
  });

  it("rejects an empty Gateway review model id", (): void => {
    expect(() =>
      createSectionModelSelection(
        buildEnv({
          AI_GATEWAY_API_KEY: "test-gateway-key",
          LAB_REVIEW_MODEL: "gateway:",
        }),
      ),
    ).toThrow(
      'Invalid LAB_REVIEW_MODEL="gateway:". Expected a Gateway model id after "gateway:".',
    );
  });

  it("rejects unknown review model flags", (): void => {
    expect(() =>
      createSectionModelSelection(buildEnv({ LAB_REVIEW_MODEL: "cheap" })),
    ).toThrow(
      'Invalid LAB_REVIEW_MODEL="cheap". Expected sonnet, opus, gpt-5.5, claude-sonnet-4-5, claude-opus-4-5, openai/gpt-5.5, or gateway:<model-id>.',
    );
  });
});
