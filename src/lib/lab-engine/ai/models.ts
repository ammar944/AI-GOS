import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { wrapLanguageModel } from "ai";

export const SONNET_SECTION_MODEL_ID = "claude-sonnet-4-5";
export const DEEPSEEK_SECTION_MODEL_ID = "deepseek-v4-flash";
export const DEFAULT_DEEPSEEK_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_DEEPSEEK_OLLAMA_MODEL_ID = DEEPSEEK_SECTION_MODEL_ID;

export type SectionModelProvider =
  | "anthropic"
  | "deepseek-direct"
  | "deepseek-ollama";

type AnthropicModelFactory = ReturnType<typeof createAnthropic>;

export type SectionLanguageModel = ReturnType<AnthropicModelFactory>;

export interface SectionModelMetadata {
  provider: SectionModelProvider;
  modelId: string;
  repairModelId: string;
  transport: "anthropic" | "deepseek-direct" | "ollama-openai-compatible";
  baseURL?: string;
}

export interface SectionModelSelection {
  metadata: SectionModelMetadata;
  repairModel: SectionLanguageModel;
  sectionRunnerModel: SectionLanguageModel;
}

const SECTION_MODEL_PROVIDERS: readonly SectionModelProvider[] = [
  "anthropic",
  "deepseek-direct",
  "deepseek-ollama",
];

function isSectionModelProvider(value: string): value is SectionModelProvider {
  return SECTION_MODEL_PROVIDERS.includes(value as SectionModelProvider);
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
    model,
    middleware: devToolsMiddleware(),
  }) as SectionLanguageModel;
}

function createAnthropicSelection(env: NodeJS.ProcessEnv): SectionModelSelection {
  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });
  const sectionRunnerModel = anthropic(SONNET_SECTION_MODEL_ID);

  return {
    metadata: {
      provider: "anthropic",
      modelId: SONNET_SECTION_MODEL_ID,
      repairModelId: SONNET_SECTION_MODEL_ID,
      transport: "anthropic",
    },
    repairModel: sectionRunnerModel,
    sectionRunnerModel,
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

  return {
    metadata: {
      provider: "deepseek-direct",
      modelId: DEEPSEEK_SECTION_MODEL_ID,
      repairModelId: DEEPSEEK_SECTION_MODEL_ID,
      transport: "deepseek-direct",
    },
    repairModel: sectionRunnerModel,
    sectionRunnerModel,
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

  return {
    metadata: {
      baseURL,
      provider: "deepseek-ollama",
      modelId,
      repairModelId: modelId,
      transport: "ollama-openai-compatible",
    },
    repairModel: sectionRunnerModel,
    sectionRunnerModel,
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
export const sectionRunnerModel = withLocalDevTools(
  selectedSectionModelSelection.sectionRunnerModel,
);
export const repairModel = withLocalDevTools(
  selectedSectionModelSelection.repairModel,
);
