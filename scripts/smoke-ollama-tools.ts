/**
 * Ollama tool-calling smoke test.
 *
 * Run: npx tsx --env-file=.env.local scripts/smoke-ollama-tools.ts
 *
 * Verifies the orchestrator brain (deepseek-v4-flash:cloud or whatever
 * ORCHESTRATOR_MODEL points at) can invoke a Zod-defined tool through
 * Vercel AI SDK + @ai-sdk/openai-compatible. This is the assumption T5+T6
 * (orchestrator chat loop) rests on. If this fails, those tasks rewrite.
 */

import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { ollama, ORCHESTRATOR_MODEL } from "@/lib/ai/providers";

async function main() {
  console.log(`[smoke-tools] model=${ORCHESTRATOR_MODEL}`);

  const calls: Array<{ name: string; input: unknown }> = [];

  const dispatchSkill = tool({
    description:
      "Dispatch a lighthouse research skill against the current GTM run. Use exactly when the user asks to run or re-run a research stage.",
    inputSchema: z.object({
      skill: z
        .enum([
          "ingest-url",
          "ingest-identity",
          "research-icp",
          "research-competitor",
          "research-offer",
        ])
        .describe("The lighthouse skill slug to dispatch"),
      refinement_context: z
        .string()
        .optional()
        .describe("Optional refinement instructions to pass to the skill"),
    }),
    execute: async ({ skill, refinement_context }) => {
      calls.push({ name: "dispatch_skill", input: { skill, refinement_context } });
      return {
        artifact_id: "fake-uuid-test",
        version: 1,
        skill,
      };
    },
  });

  const start = Date.now();
  const result = await generateText({
    model: ollama(ORCHESTRATOR_MODEL),
    tools: { dispatch_skill: dispatchSkill },
    stopWhen: stepCountIs(3),
    system:
      "You are the GTM orchestrator. When the user asks for research, call dispatch_skill with the matching skill slug. Always invoke the tool — never reply with prose alone.",
    prompt:
      "Run the competitor analysis for this prospect, focusing on G2 reviews only.",
  });
  const elapsed = Date.now() - start;

  console.log(`[smoke-tools] elapsed_ms=${elapsed}`);
  console.log(`[smoke-tools] steps=${result.steps.length}`);
  console.log(`[smoke-tools] finish_reason=${result.finishReason}`);
  console.log(`[smoke-tools] tool_calls_observed=${calls.length}`);
  console.log(`[smoke-tools] calls=${JSON.stringify(calls, null, 2)}`);
  console.log(
    `[smoke-tools] final_text=${result.text.slice(0, 200) || "(none — pure tool call)"}`,
  );

  const passed =
    calls.length >= 1 &&
    calls[0].name === "dispatch_skill" &&
    (calls[0].input as { skill: string }).skill === "research-competitor";

  if (passed) {
    console.log("[smoke-tools] PASS");
    process.exit(0);
  }
  console.error("[smoke-tools] FAIL: tool was not invoked correctly");
  process.exit(1);
}

main().catch((err) => {
  console.error("[smoke-tools] FAIL:", err?.message ?? err);
  if (err?.cause) console.error("[smoke-tools] cause:", err.cause);
  process.exit(1);
});
