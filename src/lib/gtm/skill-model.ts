import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export interface GtmSkillModelConfig {
  provider: "ollama";
  model: string;
  baseUrl: string;
  usesApiKey: boolean;
  supportsStructuredOutputs: boolean;
}

const DEFAULT_OLLAMA_MODEL = "deepseek-v4-flash:cloud";
const LOCAL_OLLAMA_OPENAI_BASE_URL = "http://localhost:11434/v1";
const CLOUD_OLLAMA_OPENAI_BASE_URL = "https://ollama.com/v1";

export function getGtmSkillModelConfig(): GtmSkillModelConfig {
  const apiKey = getOptionalEnv("OLLAMA_API_KEY");
  const configuredBaseUrl =
    getOptionalEnv("OLLAMA_BASE_URL") ?? getOptionalEnv("OLLAMA_HOST");
  const baseUrl = normalizeOllamaOpenAiBaseUrl(
    configuredBaseUrl ??
      (apiKey ? CLOUD_OLLAMA_OPENAI_BASE_URL : LOCAL_OLLAMA_OPENAI_BASE_URL)
  );

  if (isOllamaCloudBaseUrl(baseUrl) && !apiKey) {
    throw new Error(
      `OLLAMA_API_KEY is required when using Ollama cloud base_url=${baseUrl}. Set OLLAMA_API_KEY or point OLLAMA_BASE_URL/OLLAMA_HOST at a local Ollama server.`
    );
  }

  return {
    provider: "ollama",
    model:
      getOptionalEnv("AIGOS_OLLAMA_MODEL") ??
      getOptionalEnv("OLLAMA_MODEL") ??
      DEFAULT_OLLAMA_MODEL,
    baseUrl,
    usesApiKey: Boolean(apiKey),
    supportsStructuredOutputs:
      getOptionalEnv("AIGOS_OLLAMA_STRUCTURED_OUTPUTS") === "true" ||
      getOptionalEnv("OLLAMA_STRUCTURED_OUTPUTS") === "true",
  };
}

export function getGtmSkillLanguageModel(): LanguageModel {
  const config = getGtmSkillModelConfig();
  const provider = createOpenAICompatible({
    name: config.provider,
    baseURL: config.baseUrl,
    apiKey: getOptionalEnv("OLLAMA_API_KEY"),
    supportsStructuredOutputs: config.supportsStructuredOutputs,
  });

  return provider(config.model) as LanguageModel;
}

function normalizeOllamaOpenAiBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  if (trimmedBaseUrl.length === 0) {
    throw new Error("Ollama base URL cannot be empty.");
  }

  if (trimmedBaseUrl.endsWith("/v1")) {
    return trimmedBaseUrl;
  }

  if (trimmedBaseUrl.endsWith("/api")) {
    return `${trimmedBaseUrl.slice(0, -"/api".length)}/v1`;
  }

  return `${trimmedBaseUrl}/v1`;
}

function isOllamaCloudBaseUrl(baseUrl: string): boolean {
  return baseUrl.startsWith(CLOUD_OLLAMA_OPENAI_BASE_URL);
}

function getOptionalEnv(key: string): string | undefined {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}
