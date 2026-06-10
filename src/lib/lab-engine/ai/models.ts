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
export const DEEPSEEK_PRO_MODEL_ID = "deepseek-v4-pro";
export const DEFAULT_DEEPSEEK_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_DEEPSEEK_OLLAMA_MODEL_ID = DEEPSEEK_SECTION_MODEL_ID;

export type SectionModelProvider =
  | "anthropic"
  | "deepseek-direct"
  | "deepseek-ollama";

export type ReviewModelProvider =
  | "anthropic"
  | "deepseek-direct"
  | "deepseek-ollama"
  | "gateway";

export type SectionLanguageModel = Exclude<LanguageModel, string>;

export interface ReviewModelMetadata {
  provider: ReviewModelProvider;
  modelId: string;
  transport:
    | "anthropic"
    | "deepseek-direct"
    | "gateway"
    | "ollama-openai-compatible";
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

interface WrappedSectionModels {
  repairModel: SectionLanguageModel;
  reviewModel: SectionLanguageModel;
  sectionRunnerModel: SectionLanguageModel;
  strategyModel: SectionLanguageModel;
}

export type SectionModelDispatchPreflightResult =
  | {
      ok: true;
      modelId: string;
      provider: SectionModelProvider;
    }
  | {
      ok: false;
      error:
        | "anthropic_api_key_missing"
        | "deepseek_api_key_missing"
        | "invalid_lab_engine_provider"
        | "lab_engine_provider_unset";
      message: string;
      missingEnv: string[];
      provider?: SectionModelProvider;
    };

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

function hasHostedRuntimeContext(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
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

export function checkSectionModelDispatchPreflight(
  env: NodeJS.ProcessEnv = process.env,
): SectionModelDispatchPreflightResult {
  let provider: SectionModelProvider;

  try {
    provider = resolveSectionModelProvider(env);
  } catch (error) {
    return {
      ok: false,
      error: "invalid_lab_engine_provider",
      message: error instanceof Error ? error.message : String(error),
      missingEnv: [],
    };
  }

  const rawProvider = getTrimmedEnvValue(env, "LAB_ENGINE_PROVIDER");
  if (
    rawProvider === undefined &&
    env.NODE_ENV !== "production" &&
    !hasHostedRuntimeContext(env)
  ) {
    return {
      ok: false,
      error: "lab_engine_provider_unset",
      message:
        "LAB_ENGINE_PROVIDER is unset for a local lab section dispatch. Set LAB_ENGINE_PROVIDER=deepseek-direct with DEEPSEEK_API_KEY, or explicitly set LAB_ENGINE_PROVIDER=anthropic.",
      missingEnv: ["LAB_ENGINE_PROVIDER"],
      provider,
    };
  }

  if (
    provider === "anthropic" &&
    getTrimmedEnvValue(env, "ANTHROPIC_API_KEY") === undefined
  ) {
    return {
      ok: false,
      error: "anthropic_api_key_missing",
      message:
        "LAB_ENGINE_PROVIDER resolved to anthropic but ANTHROPIC_API_KEY is missing.",
      missingEnv: ["ANTHROPIC_API_KEY"],
      provider,
    };
  }

  if (
    provider === "deepseek-direct" &&
    getTrimmedEnvValue(env, "DEEPSEEK_API_KEY") === undefined
  ) {
    return {
      ok: false,
      error: "deepseek_api_key_missing",
      message: "LAB_ENGINE_PROVIDER=deepseek-direct requires DEEPSEEK_API_KEY.",
      missingEnv: ["DEEPSEEK_API_KEY"],
      provider,
    };
  }

  if (provider === "deepseek-direct") {
    return { ok: true, modelId: DEEPSEEK_SECTION_MODEL_ID, provider };
  }

  if (provider === "deepseek-ollama") {
    return {
      ok: true,
      modelId:
        getTrimmedEnvValue(env, "DEEPSEEK_OLLAMA_MODEL_ID") ??
        DEFAULT_DEEPSEEK_OLLAMA_MODEL_ID,
      provider,
    };
  }

  return { ok: true, modelId: SONNET_SECTION_MODEL_ID, provider };
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
  const deepseekApiKey = getTrimmedEnvValue(env, "DEEPSEEK_API_KEY");
  const rawReviewModel = getTrimmedEnvValue(env, "LAB_REVIEW_MODEL");

  if (rawReviewModel === undefined) {
    if (deepseekApiKey === undefined) {
      throw new Error(
        "Default LAB_REVIEW_MODEL requires DEEPSEEK_API_KEY. Set DEEPSEEK_API_KEY or explicitly set LAB_REVIEW_MODEL.",
      );
    }

    const deepseek = createDeepSeek({ apiKey: deepseekApiKey });

    return {
      metadata: {
        provider: "deepseek-direct",
        modelId: DEEPSEEK_SECTION_MODEL_ID,
        transport: "deepseek-direct",
      },
      model: deepseek(DEEPSEEK_SECTION_MODEL_ID),
    };
  }

  if (rawReviewModel === "sonnet") {
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

function createDefaultReviewModelSelection({
  model,
  modelId,
  provider,
  transport,
}: {
  model: SectionLanguageModel;
  modelId: string;
  provider: ReviewModelProvider;
  transport: ReviewModelMetadata["transport"];
}): {
  metadata: ReviewModelMetadata;
  model: SectionLanguageModel;
} {
  return {
    metadata: {
      provider,
      modelId,
      transport,
    },
    model,
  };
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
  const strategyModel = deepseek(DEEPSEEK_PRO_MODEL_ID);
  const hasReviewModelOverride =
    getTrimmedEnvValue(env, "LAB_REVIEW_MODEL") !== undefined;
  const reviewModelSelection =
    !hasReviewModelOverride
      ? createDefaultReviewModelSelection({
          model: sectionRunnerModel,
          modelId: DEEPSEEK_SECTION_MODEL_ID,
          provider: "deepseek-direct",
          transport: "deepseek-direct",
        })
      : createReviewModelSelection(env);
  const strategyModelSelection = hasReviewModelOverride
    ? reviewModelSelection
    : createDefaultReviewModelSelection({
        model: strategyModel,
        modelId: DEEPSEEK_PRO_MODEL_ID,
        provider: "deepseek-direct",
        transport: "deepseek-direct",
      });

  return {
    metadata: {
      provider: "deepseek-direct",
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      repairModelId: DEEPSEEK_SECTION_MODEL_ID,
      reviewModel: reviewModelSelection.metadata,
      strategyModel: strategyModelSelection.metadata,
      transport: "deepseek-direct",
    },
    repairModel: sectionRunnerModel,
    reviewModel: reviewModelSelection.model,
    sectionRunnerModel,
    strategyModel: strategyModelSelection.model,
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
  const reviewModelSelection =
    getTrimmedEnvValue(env, "LAB_REVIEW_MODEL") === undefined
      ? createDefaultReviewModelSelection({
          model: sectionRunnerModel,
          modelId,
          provider: "deepseek-ollama",
          transport: "ollama-openai-compatible",
        })
      : createReviewModelSelection(env);

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

let cachedSelectedSectionModelSelection: SectionModelSelection | undefined;
let cachedWrappedSectionModels: WrappedSectionModels | undefined;

function getSelectedSectionModelSelection(): SectionModelSelection {
  cachedSelectedSectionModelSelection ??= createSectionModelSelection();

  return cachedSelectedSectionModelSelection;
}

function getWrappedSectionModels(): WrappedSectionModels {
  if (cachedWrappedSectionModels === undefined) {
    const selection = getSelectedSectionModelSelection();
    cachedWrappedSectionModels = {
      repairModel: withLocalDevTools(selection.repairModel),
      reviewModel: withLocalDevTools(selection.reviewModel),
      sectionRunnerModel: withLocalDevTools(selection.sectionRunnerModel),
      strategyModel: withLocalDevTools(selection.strategyModel),
    };
  }

  return cachedWrappedSectionModels;
}

function createLazyObject<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property, receiver): unknown {
      return Reflect.get(resolve(), property, receiver);
    },
    getOwnPropertyDescriptor(_target, property): PropertyDescriptor | undefined {
      const descriptor = Object.getOwnPropertyDescriptor(resolve(), property);

      if (descriptor === undefined) {
        return undefined;
      }

      return { ...descriptor, configurable: true };
    },
    has(_target, property): boolean {
      return property in resolve();
    },
    ownKeys(): ArrayLike<string | symbol> {
      return Reflect.ownKeys(resolve());
    },
  });
}

export function getSelectedSectionModelMetadata(): SectionModelMetadata {
  return getSelectedSectionModelSelection().metadata;
}

export function getSectionRunnerModelId(): string {
  return getSelectedSectionModelMetadata().modelId;
}

export function getRepairModelId(): string {
  return getSelectedSectionModelMetadata().repairModelId;
}

export function getReviewModelId(): string {
  return getSelectedSectionModelMetadata().reviewModel.modelId;
}

export function getStrategyModelId(): string {
  return getSelectedSectionModelMetadata().strategyModel.modelId;
}

export function getStrategyModelTransport(): ReviewModelMetadata["transport"] {
  return getSelectedSectionModelMetadata().strategyModel.transport;
}

export const selectedSectionModelMetadata = createLazyObject<SectionModelMetadata>(
  getSelectedSectionModelMetadata,
);
export const sectionRunnerModel = createLazyObject<SectionLanguageModel>(
  () => getWrappedSectionModels().sectionRunnerModel,
);
export const repairModel = createLazyObject<SectionLanguageModel>(
  () => getWrappedSectionModels().repairModel,
);
export const reviewModel = createLazyObject<SectionLanguageModel>(
  () => getWrappedSectionModels().reviewModel,
);
export const strategyModel = createLazyObject<SectionLanguageModel>(
  () => getWrappedSectionModels().strategyModel,
);
