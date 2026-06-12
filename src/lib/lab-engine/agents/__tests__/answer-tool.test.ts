import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";
import {
  createAnswerTool,
  getAnswerToolInputSchemaMode,
} from "../answer-tool";

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

function getZodInputSchema(
  tool: ReturnType<typeof createAnswerTool>,
): z.ZodType<unknown> {
  return tool.inputSchema as z.ZodType<unknown>;
}

async function executeAnswerTool(
  tool: ReturnType<typeof createAnswerTool>,
  input: unknown,
): Promise<unknown> {
  const execute = tool.execute as ((input: unknown) => unknown) | undefined;

  if (execute === undefined) {
    throw new Error("Expected answer tool execute function.");
  }

  return execute(input);
}

const sectionSchema = z
  .object({
    sectionTitle: z.string().min(1),
  })
  .strict();

describe("getAnswerToolInputSchemaMode", (): void => {
  it("keeps loose passthrough mode for Anthropic", (): void => {
    expect(getAnswerToolInputSchemaMode(createModel("anthropic.messages"))).toBe(
      "loose-passthrough",
    );
  });

  it("keeps loose passthrough for DeepSeek providers too — SDK-level inputSchema validation throws before execute(), bypassing tolerantDecode and the __answerRejected protocol (live kill, run f3993043 reruns)", (): void => {
    expect(getAnswerToolInputSchemaMode(createModel("deepseek.chat"))).toBe(
      "loose-passthrough",
    );
    expect(getAnswerToolInputSchemaMode(createModel("ollama.chat"))).toBe(
      "loose-passthrough",
    );
  });
});

describe("createAnswerTool", (): void => {
  it("keeps Anthropic inputSchema loose so execute can return field feedback", async (): Promise<void> => {
    const tool = createAnswerTool(sectionSchema, {
      model: createModel("anthropic.messages"),
      sectionId: "positioningMarketCategory",
    });

    expect(getZodInputSchema(tool).safeParse({ unexpected: true }).success).toBe(
      true,
    );
    await expect(executeAnswerTool(tool, {})).resolves.toMatchObject({
      __answerRejected: true,
      issues: ["sectionTitle: Invalid input: expected string, received undefined"],
    });
  });

  it("keeps DeepSeek inputSchema loose so the SDK never pre-validates and execute owns rejection feedback", async (): Promise<void> => {
    const tool = createAnswerTool(sectionSchema, {
      model: createModel("deepseek.chat"),
      sectionId: "positioningMarketCategory",
    });

    expect(getZodInputSchema(tool).safeParse({ unexpected: true }).success).toBe(
      true,
    );
    await expect(executeAnswerTool(tool, {})).resolves.toMatchObject({
      __answerRejected: true,
      issues: ["sectionTitle: Invalid input: expected string, received undefined"],
    });
  });

  it("accepts tolerant decode repairs but still rejects missing content", async (): Promise<void> => {
    const schema = z
      .object({
        rows: z
          .array(
            z
              .object({
                label: z.string().min(1),
                verdict: z.enum(["REVIEW", "KEEP"]),
              })
              .strict(),
          )
          .min(1),
      })
      .strict();
    const tool = createAnswerTool(schema, {
      model: createModel("anthropic.messages"),
      sectionId: "positioningPaidMediaPlan",
    });

    await expect(
      executeAnswerTool(tool, {
        rows: [{ label: "Channel", verdict: "review" }],
      }),
    ).resolves.toEqual({
      rows: [{ label: "Channel", verdict: "REVIEW" }],
    });

    // Decode policy shifted from rejecting all Zod shape drift to repairing
    // shape-only drift; true missing content remains a repair shortfall.
    await expect(executeAnswerTool(tool, { rows: [] })).resolves.toMatchObject({
      __answerRejected: true,
      issues: ["rows: Too small: expected array to have >=1 items"],
    });
  });
});
