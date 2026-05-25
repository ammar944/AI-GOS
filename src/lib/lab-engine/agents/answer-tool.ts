import type { Tool } from "ai";
import { z } from "zod";

import type { SectionLanguageModel } from "../ai/models";

// Anthropic stays loose so malformed `answer` calls reach `execute` and receive
// field-level feedback. Non-Anthropic providers get the full section schema
// bound as `inputSchema` to improve first-call conformance.
const looseAnswerInputSchema = z.object({}).passthrough();

export type AnswerToolInputSchemaMode =
  | "loose-passthrough"
  | "section-schema";

export interface CreateAnswerToolOptions {
  model: SectionLanguageModel;
}

export interface AnswerToolRejection {
  __answerRejected: true;
  message: string;
  issues: string[];
}

export function formatSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path.length === 0 ? "(root)" : path}: ${issue.message}`;
  });
}

function isAnthropicModel(model: SectionLanguageModel): boolean {
  return model.provider.startsWith("anthropic.");
}

export function getAnswerToolInputSchemaMode(
  model: SectionLanguageModel,
): AnswerToolInputSchemaMode {
  return isAnthropicModel(model) ? "loose-passthrough" : "section-schema";
}

function getAnswerToolInputSchema<TSchema extends z.ZodType<unknown>>({
  mode,
  schema,
}: {
  mode: AnswerToolInputSchemaMode;
  schema: TSchema;
}): TSchema | typeof looseAnswerInputSchema {
  return mode === "section-schema" ? schema : looseAnswerInputSchema;
}

export function createAnswerTool<TSchema extends z.ZodType<unknown>>(
  schema: TSchema,
  options: CreateAnswerToolOptions,
): Tool<unknown, unknown> {
  const inputSchemaMode = getAnswerToolInputSchemaMode(options.model);

  return {
    description:
      "Submit the final structured section output as a single JSON object. " +
      "If your input does not satisfy the schema, this tool returns " +
      "`{ __answerRejected: true, issues: [...] }` where each issue names the " +
      "exact field path and what is wrong. Read every issue, fix exactly those " +
      "fields, and call `answer` again. Do not call with empty or partial input.",
    inputSchema: getAnswerToolInputSchema({ mode: inputSchemaMode, schema }),
    execute: (input): unknown => {
      const result = schema.safeParse(input);

      if (result.success) {
        return input;
      }

      return {
        __answerRejected: true,
        message:
          "Your answer did not match the required schema. Fix exactly the " +
          "fields listed below and call `answer` again with the corrected JSON.",
        issues: formatSchemaIssues(result.error),
      } satisfies AnswerToolRejection;
    },
  };
}
