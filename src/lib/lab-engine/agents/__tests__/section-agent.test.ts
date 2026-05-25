import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";
import {
  defaultAnswerToolRunner,
  defaultAnswerToolStreamer,
  defaultStructuredCaller,
  defaultStructuredStreamer,
} from "../section-agent";

const aiMocks = vi.hoisted(() => ({
  generateTextCalls: [] as unknown[],
  streamTextCalls: [] as unknown[],
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
      output: Promise.resolve({ ok: true }),
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

  it("omits Anthropic container forwarding for DeepSeek answer-tool runs with external tools", async (): Promise<void> => {
    await defaultAnswerToolRunner({
      answerTool,
      externalTools: { web_search: answerTool },
      instructions: "instructions",
      maxOutputTokens: 1000,
      maxStepCount: 2,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
    });

    expect(getLastRecord(aiMocks.toolLoopAgentSettings).prepareStep).toBeUndefined();
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

  it("omits Anthropic structured provider options for DeepSeek structured calls", async (): Promise<void> => {
    await defaultStructuredCaller({
      maxOutputTokens: 1000,
      model: createModel("deepseek.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "TestSchema",
    });

    expect(getLastRecord(aiMocks.generateTextCalls).providerOptions).toBeUndefined();
  });

  it("omits Anthropic structured provider options for DeepSeek structured streams", (): void => {
    defaultStructuredStreamer({
      maxOutputTokens: 1000,
      model: createModel("ollama.chat"),
      prompt: "prompt",
      schema: structuredSchema,
      schemaDescription: "schema",
      schemaName: "TestSchema",
    });

    expect(getLastRecord(aiMocks.streamTextCalls).providerOptions).toBeUndefined();
  });
});
