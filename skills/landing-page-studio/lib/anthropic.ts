// skills/landing-page-studio/lib/anthropic.ts
// Skill-local Anthropic provider + model constants.
// Mirrors the relevant exports from src/lib/ai/providers.ts so this skill stays
// portable per CLAUDE.md ("each skill is a self-contained island").
//
// Per .claude/rules/ai-sdk-patterns.md, this skill is exempted from the
// global Ollama-first rule for HTML generation: Ollama produces malformed
// HTML and ignores OKLCH constraints, so generate-html.ts and regen-section.ts
// use Anthropic Sonnet directly.

import { createAnthropic } from "@ai-sdk/anthropic";

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  CLAUDE_SONNET: "claude-sonnet-4-20250514",
} as const;
