import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { type LanguageModel, wrapLanguageModel } from "ai";

export const SONNET_SECTION_MODEL_ID = "claude-sonnet-4-5";
export const OPUS_REVIEW_MODEL_ID = "claude-opus-4-5";
export const GATEWAY_GPT_55_REVIEW_MODEL_ID = "openai/gpt-5.5";
export const DEEPSEEK_SECTION_MODEL_ID = "deepseek-v4-flash";
export const DEFAULT_DEEPSEEK_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_DEEPSEEK_OLLAMA_MODEL_ID = DEEPSEEK_SECTION_MODEL_ID;

export type SectionModelProvider =
  | "anthropic"
  | "deepseek-direct"
  | "deepseek-ollama";

export type ReviewModelProvider = "anthropic" | "gateway";

export type SectionLanguageModel = Exclude<LanguageModel, string>;

export interface ReviewModelMetadata {
  provider: ReviewModelProvider;
  modelId: string;
  transport: "anthropic" | "gateway";
}

export interface SectionModelMetadata {
  provider: SectionModelProvider;
  modelId: string;
  repairModelId: string;
  reviewModel: ReviewModelMetadata;
  strategyModel: ReviewModelMetadata;
  transport: "anthropic" | "deepseek-direct" | "ollama-openai-compatible";
  baseURL?: string;
}

export interface SectionModelSelection {
  metadata: SectionModelMetadata;
  repairModel: SectionLanguageModel;
  reviewModel: SectionLanguageModel;
  sectionRunnerModel: SectionLanguageModel;
  strategyModel: SectionLanguageModel;
}

const SECTION_MODEL_PROVIDERS: readonly SectionModelProvider[] = [
  "anthropic",
  "deepseek-direct",
  "deepseek-ollama",
];

function isSectionModelProvider(value: string): value is SectionModelProvider {
  return SECTION_MODEL_PROVIDERS.includes(value as SectionModelProvider);
}

function hasGatewayAuthContext(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    getTrimmedEnvValue(env, "AI_GATEWAY_API_KEY") ??
      getTrimmedEnvValue(env, "VERCEL") ??
      getTrimmedEnvValue(env, "VERCEL_ENV") ??
      getTrimmedEnvValue(env, "VERCEL_URL"),
  );
}

function getTrimmedEnvValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
}

export function resolveSectionModelProvider(
  env: NodeJS.ProcessEnv = process.env,
): SectionModelProvider {
  const provider = getTrimmedEnvValue(env, "LAB_ENGINE_PROVIDER");

  if (provider === undefined) {
    return "anthropic";
  }

  if (isSectionModelProvider(provider)) {
    return provider;
  }

  throw new Error(
    `Invalid LAB_ENGINE_PROVIDER="${provider}". Expected one of: ${SECTION_MODEL_PROVIDERS.join(
      ", ",
    )}.`,
  );
}

export function isAiSdkDevToolsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.AI_SDK_DEVTOOLS === "true" && env.NODE_ENV !== "production";
}

// Local AI SDK DevTools observability (T2.3). Provider-agnostic: wraps whichever
// model the provider-switch selects, so traces work on Anthropic and DeepSeek alike.
function withLocalDevTools(
  model: SectionLanguageModel,
  env: NodeJS.ProcessEnv = process.env,
): SectionLanguageModel {
  if (!isAiSdkDevToolsEnabled(env)) {
    return model;
  }

  return wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]["model"],
    middleware: devToolsMiddleware(),
  }) as SectionLanguageModel;
}

function createGatewayModel(
  env: NodeJS.ProcessEnv,
  modelId: string,
): SectionLanguageModel {
  if (!hasGatewayAuthContext(env)) {
    throw new Error(
      `LAB_REVIEW_MODEL="${modelId}" requires AI_GATEWAY_API_KEY or Vercel Gateway auth context.`,
    );
  }

  const apiKey = getTrimmedEnvValue(env, "AI_GATEWAY_API_KEY");
  const gateway =
    apiKey === undefined ? createGateway() : createGateway({ apiKey });

  return gateway(modelId);
}

function createReviewModelSelection(env: NodeJS.ProcessEnv): {
  metadata: ReviewModelMetadata;
  model: SectionLanguageModel;
} {
  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });
  const rawReviewModel = getTrimmedEnvValue(env, "LAB_REVIEW_MODEL");

  if (rawReviewModel === undefined || rawReviewModel === "sonnet") {
    return {
      metadata: {
        provider: "anthropic",
        modelId: SONNET_SECTION_MODEL_ID,
        transport: "anthropic",
      },
      model: anthropic(SONNET_SECTION_MODEL_ID),
    };
  }

  if (rawReviewModel === "opus") {
    return {
      metadata: {
        provider: "anthropic",
        modelId: OPUS_REVIEW_MODEL_ID,
        transport: "anthropic",
      },
      model: anthropic(OPUS_REVIEW_MODEL_ID),
    };
  }

  if (
    rawReviewModel === "gpt-5.5" ||
    rawReviewModel === GATEWAY_GPT_55_REVIEW_MODEL_ID
  ) {
    return {
      metadata: {
        provider: "gateway",
        modelId: GATEWAY_GPT_55_REVIEW_MODEL_ID,
        transport: "gateway",
      },
      model: createGatewayModel(env, GATEWAY_GPT_55_REVIEW_MODEL_ID),
    };
  }

  if (rawReviewModel.startsWith("gateway:")) {
    const modelId = rawReviewModel.slice("gateway:".length).trim();

    if (modelId.length === 0) {
      throw new Error(
        'Invalid LAB_REVIEW_MODEL="gateway:". Expected a Gateway model id after "gateway:".',
      );
    }

    return {
      metadata: {
        provider: "gateway",
        modelId,
        transport: "gateway",
      },
      model: createGatewayModel(env, modelId),
    };
  }

  if (
    rawReviewModel === SONNET_SECTION_MODEL_ID ||
    rawReviewModel === OPUS_REVIEW_MODEL_ID
  ) {
    return {
      metadata: {
        provider: "anthropic",
        modelId: rawReviewModel,
        transport: "anthropic",
      },
      model: anthropic(rawReviewModel),
    };
  }

  throw new Error(
    `Invalid LAB_REVIEW_MODEL="${rawReviewModel}". Expected sonnet, opus, gpt-5.5, ${SONNET_SECTION_MODEL_ID}, ${OPUS_REVIEW_MODEL_ID}, ${GATEWAY_GPT_55_REVIEW_MODEL_ID}, or gateway:<model-id>.`,
  );
}

function createAnthropicSelection(env: NodeJS.ProcessEnv): SectionModelSelection {
  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });
  const sectionRunnerModel = anthropic(SONNET_SECTION_MODEL_ID);
  const reviewModelSelection = createReviewModelSelection(env);

  return {
    metadata: {
      provider: "anthropic",
      modelId: SONNET_SECTION_MODEL_ID,
      repairModelId: SONNET_SECTION_MODEL_ID,
      reviewModel: reviewModelSelection.metadata,
      strategyModel: reviewModelSelection.metadata,
      transport: "anthropic",
    },
    repairModel: sectionRunnerModel,
    reviewModel: reviewModelSelection.model,
    sectionRunnerModel,
    strategyModel: reviewModelSelection.model,
  };
}

function createDeepSeekDirectSelection(
  env: NodeJS.ProcessEnv,
): SectionModelSelection {
  const apiKey = getTrimmedEnvValue(env, "DEEPSEEK_API_KEY");

  if (apiKey === undefined) {
    throw new Error(
      "LAB_ENGINE_PROVIDER=deepseek-direct requires DEEPSEEK_API_KEY.",
    );
  }

  const deepseek = createDeepSeek({ apiKey });
  const sectionRunnerModel = deepseek(DEEPSEEK_SECTION_MODEL_ID);
  const reviewModelSelection = createReviewModelSelection(env);

  return {
    metadata: {
      provider: "deepseek-direct",
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      repairModelId: DEEPSEEK_SECTION_MODEL_ID,
      reviewModel: reviewModelSelection.metadata,
      strategyModel: reviewModelSelection.metadata,
      transport: "deepseek-direct",
    },
    repairModel: sectionRunnerModel,
    reviewModel: reviewModelSelection.model,
    sectionRunnerModel,
    strategyModel: reviewModelSelection.model,
  };
}

function createDeepSeekOllamaSelection(
  env: NodeJS.ProcessEnv,
): SectionModelSelection {
  const baseURL =
    getTrimmedEnvValue(env, "DEEPSEEK_OLLAMA_BASE_URL") ??
    DEFAULT_DEEPSEEK_OLLAMA_BASE_URL;
  const modelId =
    getTrimmedEnvValue(env, "DEEPSEEK_OLLAMA_MODEL_ID") ??
    DEFAULT_DEEPSEEK_OLLAMA_MODEL_ID;
  const ollama = createOpenAICompatible({
    apiKey: getTrimmedEnvValue(env, "OLLAMA_API_KEY") ?? "ollama",
    baseURL,
    name: "ollama",
  });
  const sectionRunnerModel = ollama(modelId);
  const reviewModelSelection = createReviewModelSelection(env);

  return {
    metadata: {
      baseURL,
      provider: "deepseek-ollama",
      modelId,
      repairModelId: modelId,
      reviewModel: reviewModelSelection.metadata,
      strategyModel: reviewModelSelection.metadata,
      transport: "ollama-openai-compatible",
    },
    repairModel: sectionRunnerModel,
    reviewModel: reviewModelSelection.model,
    sectionRunnerModel,
    strategyModel: reviewModelSelection.model,
  };
}

export function createSectionModelSelection(
  env: NodeJS.ProcessEnv = process.env,
): SectionModelSelection {
  const provider = resolveSectionModelProvider(env);

  if (provider === "deepseek-direct") {
    return createDeepSeekDirectSelection(env);
  }

  if (provider === "deepseek-ollama") {
    return createDeepSeekOllamaSelection(env);
  }

  return createAnthropicSelection(env);
}

const selectedSectionModelSelection = createSectionModelSelection();

export const selectedSectionModelMetadata =
  selectedSectionModelSelection.metadata;
export const SECTION_RUNNER_MODEL_ID = selectedSectionModelMetadata.modelId;
export const REPAIR_MODEL_ID = selectedSectionModelMetadata.repairModelId;
export const REVIEW_MODEL_ID =
  selectedSectionModelMetadata.reviewModel.modelId;
export const STRATEGY_MODEL_ID =
  selectedSectionModelMetadata.strategyModel.modelId;
export const sectionRunnerModel = withLocalDevTools(
  selectedSectionModelSelection.sectionRunnerModel,
);
export const repairModel = withLocalDevTools(
  selectedSectionModelSelection.repairModel,
);
export const reviewModel = withLocalDevTools(
  selectedSectionModelSelection.reviewModel,
);
export const strategyModel = withLocalDevTools(
  selectedSectionModelSelection.strategyModel,
);
