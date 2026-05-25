import { anthropic } from "@ai-sdk/anthropic";
import type { Tool } from "ai";

export interface CreateWebSearchProviderToolOptions {
  maxUses: number;
}

export function createWebSearchProviderTool(
  options: CreateWebSearchProviderToolOptions,
): Tool {
  // Use the 20250305 web search, NOT 20260209. The 20260209 variant makes the
  // SDK attach the `code-execution-web-tools` beta, which lets Claude emit a
  // server-executed `code_execution` tool the SDK mishandles (vercel/ai#11855),
  // intermittently hanging the agent loop's first step. 20250305 is identical
  // for web search (same query in, same web_search_result out) without that beta.
  return anthropic.tools.webSearch_20250305({
    maxUses: options.maxUses,
  }) as unknown as Tool;
}

export function createCodeExecutionProviderTool(): Tool {
  return anthropic.tools.codeExecution_20250522() as unknown as Tool;
}
