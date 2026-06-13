import { describe, expect, it, vi } from 'vitest';

const commitMocks = vi.hoisted(() => ({
  seedOrchestration: vi.fn().mockResolvedValue({
    parent_audit_run_id: 'parent-1',
    section_run_ids: [],
  }),
  commitChatPatchAuto: vi
    .fn()
    .mockResolvedValue({ ok: true, revision: 1 }),
}));

vi.mock('@/lib/research-v2/orchestrate-db', () => ({
  seedOrchestration: commitMocks.seedOrchestration,
}));
vi.mock('@/lib/research-v2/chat-write-through', () => ({
  commitChatPatchAuto: commitMocks.commitChatPatchAuto,
}));

import { commitStrategyBrief } from '../commit';

describe('commitStrategyBrief', (): void => {
  it('seeds the strategyBrief zone then commits through chat-write-through', async () => {
    const artifact = {
      sectionTitle: 'Offer & Angle Brief',
      verdict: 'v',
      statusSummary: 's',
      confidence: 0.5,
      sources: [{ title: 't', url: 'https://x' }],
      body: {
        positioning: { oneLiner: 'one', valueProp: 'value', mechanism: 'm' },
        angles: [
          {
            name: 'angle',
            vignette: 'vignette',
            coreEmotion: 'emotion',
            adFrame: 'frame',
            rank: 1,
            sourceEvidence: ['positioningVoiceOfCustomer'],
          },
        ],
        lexicon: { approved: [], banned: [] },
        funnelStance: 'stance',
        gaps: [],
        changelog: [{ revision: 1, summary: 's', rationale: 'r', at: 'now' }],
      },
    };

    const result = await commitStrategyBrief({
      supabase: {} as never,
      userId: 'u1',
      runId: 'r1',
      artifact,
    });

    expect(commitMocks.seedOrchestration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        runId: 'r1',
        zones: ['strategyBrief'],
      }),
    );
    expect(commitMocks.commitChatPatchAuto).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        zone: 'strategyBrief',
        patchedSection: expect.objectContaining({
          title: 'Offer & Angle Brief',
          data: artifact,
        }),
      }),
    );
    expect(result).toEqual({ ok: true, revision: 1 });
  });
});
