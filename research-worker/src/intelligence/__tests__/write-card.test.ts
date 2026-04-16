import { describe, expect, it, vi } from 'vitest';
import { cardSectionKey, writeIntelligenceCard } from '../write-card';
import type { CardResult } from '../types';

describe('cardSectionKey', () => {
  it('maps card names to section keys', () => {
    expect(cardSectionKey('opportunity')).toBe('opportunityIntel');
    expect(cardSectionKey('white-space-gap')).toBe('whiteSpaceGapIntel');
    expect(cardSectionKey('offer-statement')).toBe('offerStatementIntel');
    expect(cardSectionKey('strategic-synthesis')).toBe('strategicSynthesisIntel');
  });
  it('returns null for unknown card', () => {
    expect(cardSectionKey('mystery')).toBeNull();
  });
});

describe('writeIntelligenceCard', () => {
  it('skips when status is not rendered', async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as import('@supabase/supabase-js').SupabaseClient;
    const result: CardResult = {
      cardName: 'opportunity',
      status: 'gated',
      durationMs: 10,
      model: 'n/a',
      gateReason: 'no_evidence_in_wiki',
    };
    await writeIntelligenceCard({
      userId: 'u1',
      runId: 'r1',
      card: result,
      client,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls RPC with the mapped section key when rendered', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc } as unknown as import('@supabase/supabase-js').SupabaseClient;
    const result: CardResult = {
      cardName: 'opportunity',
      status: 'rendered',
      data: { opportunities: [] },
      durationMs: 500,
      model: 'claude-haiku-4-5-20251001',
    };
    await writeIntelligenceCard({
      userId: 'u1',
      runId: 'r1',
      card: result,
      client,
    });
    expect(rpc).toHaveBeenCalledWith(
      'merge_journey_session_research_result',
      expect.objectContaining({
        p_user_id: 'u1',
        p_run_id: 'r1',
        p_section: 'opportunityIntel',
      }),
    );
  });

  it('does not throw when RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const client = { rpc } as unknown as import('@supabase/supabase-js').SupabaseClient;
    const result: CardResult = {
      cardName: 'opportunity',
      status: 'rendered',
      data: { opportunities: [] },
      durationMs: 500,
      model: 'claude-haiku-4-5-20251001',
    };
    await expect(
      writeIntelligenceCard({ userId: 'u1', runId: 'r1', card: result, client }),
    ).resolves.toBeUndefined();
  });
});
