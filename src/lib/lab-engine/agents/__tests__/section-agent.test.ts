import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";
import {
  defaultAnswerToolRunner,
  defaultAnswerToolStreamer,
  dropEmptyUrlStrings,
  defaultEvidencePassRunner,
  defaultEvidenceStreamRunner,
  defaultStructuredCaller,
  defaultStructuredStreamer,
} from "../section-agent";

const aiMocks = vi.hoisted(() => ({
  generateTextCalls: [] as unknown[],
  streamTextCalls: [] as unknown[],
  streamTextOutput: undefined as Promise<unknown> | undefined,
  toolLoopAgentSettings: [] as unknown[],
}));

async function* createAsyncIterable<TValue>(
  values: readonly TValue[],
): AsyncIterable<TValue> {
  for (const value of values) {
    yield value;
  }
}

vi.mock("ai", () => ({
  generateText: vi.fn(async (params: unknown) => {
    aiMocks.generateTextCalls.push(params);

    return {
      finishReason: "stop",
      output: { ok: true },
      text: "",
    };
  }),
  NoObjectGeneratedError: {
    isInstance: (): boolean => false,
  },
  Output: {
    object: vi.fn((params: unknown): unknown => ({ kind: "output.object", params })),
  },
  stepCountIs: vi.fn((count: number): unknown => ({
    count,
    kind: "step-count",
  })),
  streamText: vi.fn((params: unknown) => {
    aiMocks.streamTextCalls.push(params);

    return {
      output: aiMocks.streamTextOutput ?? Promise.resolve({ ok: true }),
      partialOutputStream: createAsyncIterable([{ ok: true }]),
    };
  }),
  ToolLoopAgent: class MockToolLoopAgent {
    constructor(settings: unknown) {
      aiMocks.toolLoopAgentSettings.push(settings);
    }

    async generate(): Promise<{ text: string }> {
      return { text: "" };
    }

    async stream(): Promise<{ textStream: AsyncIterable<string> }> {
      return { textStream: createAsyncIterable([""]) };
    }
  },
}));

function createModel(provider: string): SectionLanguageModel {
  return {
    modelId:
      provider === "anthropic.messages"
        ? "claude-sonnet-4-5"
        : "deepseek-v4-flash",
    provider,
    specificationVersion: "v3",
  } as SectionLanguageModel;
}

function getLastRecord(calls: readonly unknown[]): Record<string, unknown> {
  const value = calls.at(-1);

  if (typeof value !== "object" || value === null) {
    throw new Error("Expected a recorded object call.");
  }

  return value as Record<string, unknown>;
}

function getPrepareStep(
  calls: readonly unknown[],
): ((params: { stepNumber: number }) => unknown) | undefined {
  const prepareStep = getLastRecord(calls).prepareStep;

  if (prepareStep === undefined) {
    return undefined;
  }

  if (typeof prepareStep !== "function") {
    throw new Error("Expected prepareStep to be a function.");
  }

  return prepareStep as (params: { stepNumber: number }) => unknown;
}

const answerTool = {
  description: "answer",
  inputSchema: z.object({}),
  execute: (): unknown => ({}),
};

const structuredSchema = z.object({ ok: z.boolean() });

describe("section-agent provider-specific options", (): void => {
  beforeEach((): void => {
    aiMocks.generateTextCalls.length = 0;
    aiMocks.streamTextCalls.length = 0;
    aiMocks.streamTextOutput = undefined;
    aiMocks.toolLoopAgentSettings.length = 0;
  });

  it("keeps Anthropic container forwarding for Anthropic answer-tool runs", async (): Promise<void> => {
    await defaultAnswerToolRunner({
      answerTool,
      externalTools: {},
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("anthropic.messages"),
      prompt: "prompt",
    });

    expect(getLastRecord(aiMocks.toolLoopAgentSettings).prepareStep).toEqual(
      expect.any(Function),
    );
  });

  it("disables thinking for DeepSeek evidence passes", async (): Promise<void> => {
    await defaultEvidencePassRunner({
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      tools: { readResearchInput: answerTool },
    });

    expect(getLastRecord(aiMocks.toolLoopAgentSettings).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("disables thinking for DeepSeek evidence streams", async (): Promise<void> => {
    await defaultEvidenceStreamRunner({
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      tools: { readResearchInput: answerTool },
    });

    expect(getLastRecord(aiMocks.toolLoopAgentSettings).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("requires the answer tool for corpus-only DeepSeek answer-tool runs", async (): Promise<void> => {
    await defaultAnswerToolRunner({
      answerTool,
      externalTools: {},
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
    });

    expect(getPrepareStep(aiMocks.toolLoopAgentSettings)?.({ stepNumber: 0 })).toEqual({
      activeTools: ["answer"],
      toolChoice: { type: "tool", toolName: "answer" },
    });
    expect(getLastRecord(aiMocks.toolLoopAgentSettings).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("forces the answer tool on the final DeepSeek step when external tools are available", async (): Promise<void> => {
    await defaultAnswerToolRunner({
      answerTool,
      externalTools: { web_search: answerTool },
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 3,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
    });

    expect(getPrepareStep(aiMocks.toolLoopAgentSettings)?.({ stepNumber: 0 })).toBeUndefined();
    expect(getPrepareStep(aiMocks.toolLoopAgentSettings)?.({ stepNumber: 1 })).toBeUndefined();
    expect(getPrepareStep(aiMocks.toolLoopAgentSettings)?.({ stepNumber: 2 })).toEqual({
      activeTools: ["answer"],
      toolChoice: { type: "tool", toolName: "answer" },
    });
    expect(getLastRecord(aiMocks.toolLoopAgentSettings).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("requires the answer tool for corpus-only DeepSeek answer-tool streams", async (): Promise<void> => {
    await defaultAnswerToolStreamer({
      answerTool,
      externalTools: {},
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("ollama.chat"),
      prompt: "prompt",
    });

    expect(getPrepareStep(aiMocks.toolLoopAgentSettings)?.({ stepNumber: 0 })).toEqual({
      activeTools: ["answer"],
      toolChoice: { type: "tool", toolName: "answer" },
    });
    expect(getLastRecord(aiMocks.toolLoopAgentSettings).providerOptions).toBeUndefined();
  });

  it("keeps Anthropic structured provider options for Anthropic structured calls", async (): Promise<void> => {
    await defaultStructuredCaller({
      maxOutputTokens: 1000,
      model: createModel("anthropic.messages"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "TestSchema",
    });

    expect(getLastRecord(aiMocks.generateTextCalls).providerOptions).toEqual({
      anthropic: { structuredOutputMode: "jsonTool" },
    });
  });

  it("disables thinking for DeepSeek structured calls", async (): Promise<void> => {
    await defaultStructuredCaller({
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "TestSchema",
    });

    expect(getLastRecord(aiMocks.generateTextCalls).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("disables thinking for DeepSeek structured streams", (): void => {
    defaultStructuredStreamer({
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "TestSchema",
    });

    expect(getLastRecord(aiMocks.streamTextCalls).providerOptions).toEqual({
      deepseek: { thinking: { type: "disabled" } },
    });
  });

  it("does not fall back to a second structured call for unparseable VoC streams", async (): Promise<void> => {
    aiMocks.streamTextOutput = Promise.reject(
      new Error("No object generated: response did not match schema."),
    );

    const result = defaultStructuredStreamer({
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "VoiceOfCustomerSectionOutputBody",
    });

    await expect(result.output).rejects.toThrow(
      "No object generated: response did not match schema.",
    );
    expect(aiMocks.generateTextCalls).toHaveLength(0);
  });

  it("skips non-streaming structured fallback when remaining budget is below the floor", async (): Promise<void> => {
    aiMocks.streamTextOutput = Promise.reject(
      new Error("No object generated: response did not match schema."),
    );

    const result = defaultStructuredStreamer({
      fallbackBudget: {
        minRemainingMs: 260_000,
        remainingMs: () => 95_600,
      },
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "MarketCategorySectionOutputBody",
    });

    await expect(result.output).rejects.toThrow(
      "deadline-aware structured fallback skipped",
    );
    expect(aiMocks.generateTextCalls).toHaveLength(0);
  });

  it("uses non-streaming structured fallback when remaining budget clears the floor", async (): Promise<void> => {
    aiMocks.streamTextOutput = Promise.reject(
      new Error("No object generated: response did not match schema."),
    );

    const result = defaultStructuredStreamer({
      fallbackBudget: {
        minRemainingMs: 260_000,
        remainingMs: () => 285_000,
      },
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "MarketCategorySectionOutputBody",
    });

    await expect(result.output).resolves.toEqual({ ok: true });
    expect(aiMocks.generateTextCalls).toHaveLength(1);
  });
});

describe("dropEmptyUrlStrings", (): void => {
  it("drops empty-string url-keyed fields recursively and keeps everything else", (): void => {
    const body = {
      marketSize: {
        bottomUpTam: {
          inputs: [
            { inputType: "keyword-volume", sourceUrl: "", value: "evidence gap: unsourced" },
            { inputType: "acv", sourceUrl: "https://example.com/pricing", value: "$4,800" },
          ],
        },
        signals: [{ evidence: "grew 20%", signalType: "top-down", sourceUrl: "   " }],
      },
      sources: [{ title: "kept", url: "" }],
      statusSummary: "url: not a key match",
    };

    dropEmptyUrlStrings(body);

    expect(body.marketSize.bottomUpTam.inputs[0]).not.toHaveProperty("sourceUrl");
    expect(body.marketSize.bottomUpTam.inputs[1].sourceUrl).toBe(
      "https://example.com/pricing",
    );
    expect(body.marketSize.signals[0]).not.toHaveProperty("sourceUrl");
    expect(body.sources[0]).not.toHaveProperty("url");
    expect(body.sources[0].title).toBe("kept");
    expect(body.statusSummary).toBe("url: not a key match");
  });
});
