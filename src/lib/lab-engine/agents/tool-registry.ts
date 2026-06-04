import type { Tool, ToolExecutionOptions } from "ai";

import type { SectionToolBudget, ToolBudget } from "./budget";
import { TOOL_CATALOG, type ToolName } from "./tools/index";
import { ToolGapSchema } from "./tools/_shared";

// Either budget shape works: a plain ToolBudget or a two-pool SectionToolBudget.
// The wrapper passes the tool name through so a SectionToolBudget can route
// ad-tool draws to its reserved pool.
type ToolBudgetLike = ToolBudget | SectionToolBudget;

export interface BuildToolMapDeps {
  budget: ToolBudgetLike;
  webSearchMaxUses: number;
}

export function buildToolMap(
  allowedTools: readonly ToolName[],
  deps: BuildToolMapDeps,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const name of allowedTools) {
    const baseTool = TOOL_CATALOG[name] as unknown as Tool<unknown, unknown>;
    tools[name] = wrapWithBudget(baseTool, deps.budget, name);
  }

  return tools;
}

function wrapWithBudget<TInput, TOutput>(
  baseTool: Tool<TInput, TOutput>,
  budget: ToolBudgetLike,
  toolName: string,
): Tool<TInput, TOutput> {
  const wrappedTool = {
    ...baseTool,
    execute: async (
      input: TInput,
      context: ToolExecutionOptions,
    ): Promise<TOutput> => {
      const budgetReceipt = budget.consumeWithReceipt(toolName);

      if (budgetReceipt === null) {
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
      const parsedGap = ToolGapSchema.safeParse(output);

      if (
        parsedGap.success &&
        parsedGap.data.consumesBudget === false
      ) {
        budgetReceipt.refund();
      }

      return output as TOutput;
    },
  };
  return wrappedTool as unknown as Tool<TInput, TOutput>;
}
