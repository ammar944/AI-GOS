/**
 * Intelligence card persistence — writes a validated card result to
 * journey_sessions.research_results via the existing JSONB-merge RPC.
 *
 * Each card writes to its own top-level section key (e.g., opportunityIntel)
 * so two cards writing to the same underlying research section cannot
 * clobber each other. Frontend taxonomy composes the cards for display.
 *
 * Non-fatal: all failures are logged and swallowed. A card write failure
 * never crashes the dispatcher or blocks other cards.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient } from '../supabase';
import type { CardResult } from './types';

/** Card name → research_results section key. */
const CARD_TO_SECTION: Record<string, string> = {
  opportunity: 'opportunityIntel',
  'white-space-gap': 'whiteSpaceGapIntel',
  'offer-statement': 'offerStatementIntel',
  'strategic-synthesis': 'strategicSynthesisIntel',
};

export function cardSectionKey(cardName: string): string | null {
  return CARD_TO_SECTION[cardName] ?? null;
}

export interface WriteIntelligenceCardInput {
  userId: string;
  runId: string;
  card: CardResult;
  /** Injected for tests. Defaults to the shared service-role client. */
  client?: SupabaseClient;
}

/**
 * Persist a rendered card. No-op for gated/failed cards.
 * RPC errors are logged and swallowed — the dispatcher must not crash.
 */
export async function writeIntelligenceCard(
  input: WriteIntelligenceCardInput,
): Promise<void> {
  if (input.card.status !== 'rendered') return;

  const sectionKey = cardSectionKey(input.card.cardName);
  if (!sectionKey) {
    console.warn(
      `[intelligence:write] no section mapping for card ${input.card.cardName}`,
    );
    return;
  }

  const payload = {
    status: 'complete' as const,
    section: sectionKey,
    data: input.card.data,
    durationMs: input.card.durationMs,
    model: input.card.model,
    runId: input.runId,
  };

  try {
    const client = input.client ?? getClient();
    const { error } = await client.rpc('merge_journey_session_research_result', {
      p_user_id: input.userId,
      p_run_id: input.runId,
      p_section: sectionKey,
      p_result: payload,
    });
    if (error) {
      console.warn(
        `[intelligence:write] ${input.card.cardName} → ${sectionKey} failed:`,
        error.message,
      );
      return;
    }
    console.log(
      `[intelligence:write] ${input.card.cardName} → ${sectionKey} (${input.card.durationMs}ms, ${input.card.model})`,
    );
  } catch (err) {
    console.warn(
      `[intelligence:write] ${input.card.cardName} threw:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
