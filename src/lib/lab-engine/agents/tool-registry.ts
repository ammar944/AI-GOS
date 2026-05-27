import type { Tool, ToolExecutionOptions } from "ai";

import type { ToolBudget } from "./budget";
import { TOOL_CATALOG, type ToolName } from "./tools/index";

export interface BuildToolMapDeps {
  budget: ToolBudget;
  webSearchMaxUses: number;
}

export function buildToolMap(
  allowedTools: readonly ToolName[],
  deps: BuildToolMapDeps,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const name of allowedTools) {
    const baseTool = TOOL_CATALOG[name] as unknown as Tool<unknown, unknown>;
    tools[name] = wrapWithBudget(baseTool, deps.budget);
  }

  return tools;
}

function wrapWithBudget<TInput, TOutput>(
  baseTool: Tool<TInput, TOutput>,
  budget: ToolBudget,
): Tool<TInput, TOutput> {
  const wrappedTool = {
    ...baseTool,
    execute: async (
      input: TInput,
      context: ToolExecutionOptions,
    ): Promise<TOutput> => {
      if (!budget.consume()) {
        return {
          type: "gap",
          reason: "rate_limited",
          message: `section budget exhausted after ${budget.max} lookups`,
        } as unknown as TOutput;
      }

      if (baseTool.execute === undefined) {
        return {
          type: "gap",
          reason: "not_implemented",
          message: "tool has no execute function",
        } as unknown as TOutput;
      }

      const output = await baseTool.execute(input, context);
      return output as TOutput;
    },
  };
  return wrappedTool as unknown as Tool<TInput, TOutput>;
}
