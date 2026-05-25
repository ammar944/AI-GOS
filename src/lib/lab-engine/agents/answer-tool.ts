import type { Tool } from "ai";
import { z } from "zod";

// The model's `answer` call must always reach `execute` so we can validate it
// ourselves and return field-level feedback. Binding the full section schema to
// `inputSchema` made the SDK reject malformed input with an unactionable value
// dump before `execute` ran, so the model kept repeating the same shape error.
const looseAnswerInputSchema = z.object({}).passthrough();

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

export function createAnswerTool<TSchema extends z.ZodType<unknown>>(
  schema: TSchema,
): Tool<unknown, unknown> {
  return {
    description:
      "Submit the final structured section output as a single JSON object. " +
      "If your input does not satisfy the schema, this tool returns " +
      "`{ __answerRejected: true, issues: [...] }` where each issue names the " +
      "exact field path and what is wrong. Read every issue, fix exactly those " +
      "fields, and call `answer` again. Do not call with empty or partial input.",
    inputSchema: looseAnswerInputSchema,
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
