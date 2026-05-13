import { describe, expect, it } from 'vitest';

/**
 * Phase 5: the positioning orchestrator is the default chat command surface.
 * LEGACY_CHAT_INTENTS=true re-enables the pre-Phase 4 intent-router path as
 * an escape hatch for a single release before Phase 7 deletes it. The
 * historical ENABLE_POSITIONING_ORCHESTRATOR=true override also keeps the
 * orchestrator path live so existing dev envs don't regress.
 *
 * This unit exercises the boolean gate exactly as it lives in the chat route
 * (src/app/api/research-v2/chat/route.ts) so the contract is asserted in
 * one place and Phase 7's flag removal is a single-find audit.
 */
function computeUseOrchestrator(env: {
  ENABLE_POSITIONING_ORCHESTRATOR?: string;
  LEGACY_CHAT_INTENTS?: string;
}): boolean {
  const legacy = env.LEGACY_CHAT_INTENTS === 'true';
  return env.ENABLE_POSITIONING_ORCHESTRATOR === 'true' || !legacy;
}

describe('chat route orchestrator gate', () => {
  it('uses the orchestrator by default (no flags set)', () => {
    expect(computeUseOrchestrator({})).toBe(true);
  });

  it('falls back to the legacy intent router when LEGACY_CHAT_INTENTS=true', () => {
    expect(computeUseOrchestrator({ LEGACY_CHAT_INTENTS: 'true' })).toBe(false);
  });

  it('keeps the orchestrator path live when ENABLE_POSITIONING_ORCHESTRATOR=true even with LEGACY_CHAT_INTENTS=true', () => {
    expect(
      computeUseOrchestrator({
        ENABLE_POSITIONING_ORCHESTRATOR: 'true',
        LEGACY_CHAT_INTENTS: 'true',
      }),
    ).toBe(true);
  });

  it('ignores non-"true" values for LEGACY_CHAT_INTENTS', () => {
    expect(computeUseOrchestrator({ LEGACY_CHAT_INTENTS: 'yes' })).toBe(true);
    expect(computeUseOrchestrator({ LEGACY_CHAT_INTENTS: '1' })).toBe(true);
  });
});
