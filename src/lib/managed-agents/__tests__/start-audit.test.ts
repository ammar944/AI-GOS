import { describe, expect, it, vi } from 'vitest';

import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { startManagedAudit } from '../start-audit';

const SIX_SECTION_RUN_IDS = POSITIONING_SECTION_IDS.map((sectionId, index) => ({
  section_id: sectionId,
  section_run_id: `sr-${index + 1}`,
  ordinal: index,
  reused: false,
}));

function makeFakeClient() {
  const sentEvents: Array<{ sessionId: string; events: unknown[] }> = [];
  return {
    sentEvents,
    sendEvents: vi.fn(async (sessionId: string, events: unknown[]) => {
      sentEvents.push({ sessionId, events });
    }),
  };
}

function makeFactories() {
  return {
    createOrReuseEnvironment: vi.fn(async () => ({ id: 'env-1', reused: false })),
    createOrReuseSpecialistAgent: vi.fn(
      async ({ sectionId }: { sectionId: PositioningSectionId }) => ({
        id: `spec-${sectionId}`,
        reused: false,
        sectionId,
      }),
    ),
    createOrReuseCoordinatorAgent: vi.fn(async () => ({
      id: 'coord-1',
      reused: false,
      sectionId: POSITIONING_SECTION_IDS[0],
    })),
    createSession: vi.fn(async () => ({
      id: 'sesn-1',
      agent: 'coord-1',
      environment_id: 'env-1',
    })),
  };
}

function makeSeedImpl(sectionRunIds = SIX_SECTION_RUN_IDS) {
  return vi.fn(async () => ({
    parent_audit_run_id: 'parent-1',
    section_run_ids: sectionRunIds,
  }));
}

describe('startManagedAudit', () => {
  it('kicks off all six positioning sections by default', async () => {
    const client = makeFakeClient() as never;
    const factories = makeFactories();
    const seedOrchestrationImpl = makeSeedImpl() as never;

    const result = await startManagedAudit({
      userId: 'user-1',
      runId: 'run-1',
      gtmBrief: { advertiser: 'monday.com' },
      client,
      factories,
      seedOrchestrationImpl,
    });

    expect(result.sectionRunIds).toHaveLength(6);
    expect(result.sectionRunIds.map((r) => r.sectionId).sort()).toEqual(
      [...POSITIONING_SECTION_IDS].sort(),
    );

    expect(factories.createOrReuseSpecialistAgent).toHaveBeenCalledTimes(6);
    const specialistSectionIds = factories.createOrReuseSpecialistAgent.mock.calls
      .map((call) => (call[0] as { sectionId: string }).sectionId)
      .sort();
    expect(specialistSectionIds).toEqual([...POSITIONING_SECTION_IDS].sort());

    expect(factories.createOrReuseCoordinatorAgent).toHaveBeenCalledTimes(1);
    const coordinatorCalls = factories.createOrReuseCoordinatorAgent.mock
      .calls as unknown as Array<[{ specialists: Array<{ sectionId: string }> }]>;
    const coordinatorArgs = coordinatorCalls[0][0];
    expect(coordinatorArgs.specialists).toHaveLength(6);
    expect(coordinatorArgs.specialists.map((s) => s.sectionId).sort()).toEqual(
      [...POSITIONING_SECTION_IDS].sort(),
    );
  });

  it('lists all six sections in the kickoff message', async () => {
    const client = makeFakeClient();
    const factories = makeFactories();
    const seedOrchestrationImpl = makeSeedImpl() as never;

    await startManagedAudit({
      userId: 'user-1',
      runId: 'run-1',
      gtmBrief: { advertiser: 'monday.com' },
      client: client as never,
      factories,
      seedOrchestrationImpl,
    });

    expect(client.sentEvents).toHaveLength(1);
    const event = (client.sentEvents[0].events[0] as {
      type: string;
      content: Array<{ type: string; text: string }>;
    });
    expect(event.type).toBe('user.message');
    const kickoffText = event.content[0].text;
    for (const sectionId of POSITIONING_SECTION_IDS) {
      expect(kickoffText).toContain(sectionId);
    }
    for (const row of SIX_SECTION_RUN_IDS) {
      expect(kickoffText).toContain(row.section_run_id);
    }
  });

  it('honors an explicit sections override (single-section canary path)', async () => {
    const client = makeFakeClient() as never;
    const factories = makeFactories();
    const seedOrchestrationImpl = makeSeedImpl() as never;

    const result = await startManagedAudit({
      userId: 'user-1',
      runId: 'run-1',
      gtmBrief: { advertiser: 'monday.com' },
      sections: ['positioningBuyerICP'],
      client,
      factories,
      seedOrchestrationImpl,
    });

    expect(result.sectionRunIds).toHaveLength(1);
    expect(result.sectionRunIds[0].sectionId).toBe('positioningBuyerICP');
    expect(factories.createOrReuseSpecialistAgent).toHaveBeenCalledTimes(1);
    const coordinatorCalls = factories.createOrReuseCoordinatorAgent.mock
      .calls as unknown as Array<[{ specialists: Array<{ sectionId: string }> }]>;
    const coordinatorArgs = coordinatorCalls[0][0];
    expect(coordinatorArgs.specialists).toHaveLength(1);
    expect(coordinatorArgs.specialists[0].sectionId).toBe('positioningBuyerICP');
  });
});
