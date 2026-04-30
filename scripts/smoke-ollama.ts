/**
 * Ollama provider smoke test.
 *
 * Run: npx tsx --env-file=.env.local scripts/smoke-ollama.ts
 * Requires: Ollama running locally OR OLLAMA_API_KEY set for Cloud.
 *
 * Verifies the `ollama` provider in src/lib/ai/providers.ts can complete a
 * one-shot text generation against the configured ORCHESTRATOR_MODEL.
 */

import { generateText } from "ai";
import { ollama, ORCHESTRATOR_MODEL } from "@/lib/ai/providers";

async function main() {
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
  console.log(`[smoke] ollama baseURL=${baseURL} model=${ORCHESTRATOR_MODEL}`);
  console.log(
    `[smoke] OLLAMA_API_KEY ${process.env.OLLAMA_API_KEY ? "set" : "not set"}`,
  );

  const start = Date.now();
  const { text, usage, finishReason } = await generateText({
    model: ollama(ORCHESTRATOR_MODEL),
    prompt: 'Reply with exactly the word: ok',
  });
  const elapsed = Date.now() - start;

  console.log(`[smoke] elapsed_ms=${elapsed}`);
  console.log(`[smoke] finish_reason=${finishReason}`);
  console.log(`[smoke] usage=${JSON.stringify(usage)}`);
  console.log(`[smoke] text=${text.slice(0, 200)}`);

  if (!text.trim()) {
    console.error("[smoke] FAIL: empty response");
    process.exit(1);
  }
  console.log("[smoke] PASS");
}

main().catch((err) => {
  console.error("[smoke] FAIL:", err?.message ?? err);
  if (err?.cause) console.error("[smoke] cause:", err.cause);
  process.exit(1);
});
