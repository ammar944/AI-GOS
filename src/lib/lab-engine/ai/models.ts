import { createAnthropic } from "@ai-sdk/anthropic";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { wrapLanguageModel } from "ai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SECTION_RUNNER_MODEL_ID = "claude-sonnet-4-5";
export const REPAIR_MODEL_ID = SECTION_RUNNER_MODEL_ID;

export function isAiSdkDevToolsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.AI_SDK_DEVTOOLS === "true" && env.NODE_ENV !== "production";
}

function withLocalDevTools(
  model: ReturnType<typeof anthropic>,
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof anthropic> {
  if (!isAiSdkDevToolsEnabled(env)) {
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: devToolsMiddleware(),
  }) as ReturnType<typeof anthropic>;
}

export const sectionRunnerModel = withLocalDevTools(
  anthropic(SECTION_RUNNER_MODEL_ID),
);
export const repairModel = withLocalDevTools(anthropic(REPAIR_MODEL_ID));
