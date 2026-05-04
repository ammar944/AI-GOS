import { afterEach, describe, expect, it, vi } from "vitest";
import { getGtmSkillModelConfig } from "@/lib/gtm/skill-model";

describe("getGtmSkillModelConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses local Ollama by default", () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("OLLAMA_HOST", "");
    vi.stubEnv("AIGOS_OLLAMA_MODEL", "");
    vi.stubEnv("OLLAMA_MODEL", "");

    expect(getGtmSkillModelConfig()).toEqual({
      provider: "ollama",
      model: "deepseek-v4-flash:cloud",
      baseUrl: "http://localhost:11434/v1",
      usesApiKey: false,
      supportsStructuredOutputs: false,
    });
  });

  it("uses the Ollama API key with the direct cloud endpoint", () => {
    vi.stubEnv("OLLAMA_API_KEY", "test-ollama-key");
    vi.stubEnv("OLLAMA_BASE_URL", "");
    vi.stubEnv("OLLAMA_HOST", "");

    expect(getGtmSkillModelConfig()).toEqual({
      provider: "ollama",
      model: "deepseek-v4-flash:cloud",
      baseUrl: "https://ollama.com/v1",
      usesApiKey: true,
      supportsStructuredOutputs: false,
    });
  });

  it("normalizes Ollama API URLs to the OpenAI-compatible v1 endpoint", () => {
    vi.stubEnv("OLLAMA_API_KEY", "test-ollama-key");
    vi.stubEnv("OLLAMA_BASE_URL", "https://ollama.com/api/");

    expect(getGtmSkillModelConfig().baseUrl).toBe("https://ollama.com/v1");
  });

  it("throws a specific error when Ollama cloud has no API key", () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "https://ollama.com/v1");

    expect(() => getGtmSkillModelConfig()).toThrow(
      "OLLAMA_API_KEY is required"
    );
  });

  it("honors the model and structured-output overrides", () => {
    vi.stubEnv("OLLAMA_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("AIGOS_OLLAMA_MODEL", "qwen3:8b");
    vi.stubEnv("AIGOS_OLLAMA_STRUCTURED_OUTPUTS", "true");

    expect(getGtmSkillModelConfig()).toEqual({
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://localhost:11434/v1",
      usesApiKey: false,
      supportsStructuredOutputs: true,
    });
  });
});
