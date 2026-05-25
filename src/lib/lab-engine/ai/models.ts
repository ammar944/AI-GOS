import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SECTION_RUNNER_MODEL_ID = "claude-sonnet-4-5";
export const REPAIR_MODEL_ID = SECTION_RUNNER_MODEL_ID;
export const sectionRunnerModel = anthropic(SECTION_RUNNER_MODEL_ID);
export const repairModel = anthropic(REPAIR_MODEL_ID);
