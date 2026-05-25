import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  runRecordSchema,
  type RunRecord,
  type SectionRunRecord,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  type RunSectionDeps,
  type RunSectionInput,
  type RunSectionResult,
} from '@/lib/lab-engine/agents/run-section';
import { sectionIds, type SectionId } from '@/lib/lab-engine/events/activity-event';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';

import { runLabSectionJob } from '../lab-section-job';

const runId = saaslaunchResearchInput.runId;

function createSectionRecord(sectionId: SectionId): SectionRunRecord {
  return {
    sectionId,
    status: 'idle',
    artifact: null,
    startedAt: null,
    completedAt: null,
    error: null,
  };
}

function createTestRunRecord(): RunRecord {
  const createdAt = '2026-05-25T12:00:00.000Z';

  return runRecordSchema.parse({
    id: saaslaunchResearchInput.runId,
    fixtureId: saaslaunchResearchInput.fixtureId,
    source: 'live',
    status: 'idle',
    selectedSectionIds: sectionIds,
    createdAt,
    updatedAt: createdAt,
    input: saaslaunchResearchInput,
    sections: Object.fromEntries(
      sectionIds.map((sectionId): [SectionId, SectionRunRecord] => [
        sectionId,
        createSectionRecord(sectionId),
      ]),
    ),
    events: [],
  });
}

function createMockRunStore(): {
  markSectionFailed: ReturnType<typeof vi.fn>;
  store: RunStore;
} {
  const record = createTestRunRecord();
  const markSectionFailed = vi.fn(
    async (): Promise<RunRecord> => record,
  );
  const store: RunStore = {
    createRun: async (): Promise<RunRecord> => record,
    readRun: async (): Promise<RunRecord> => record,
    appendEvent: async (): Promise<RunRecord> => record,
    saveArtifact: async (): Promise<RunRecord> => record,
    markSectionRunning: async (): Promise<RunRecord> => record,
    markSectionFailed,
  };

  return { markSectionFailed, store };
}

function createRunSectionResult(input: RunSectionInput): RunSectionResult {
  return {
    runId: input.runId,
    sectionId: input.sectionId,
    artifact: marketCategoryFixtureArtifact,
  };
}

describe('runLabSectionJob', (): void => {
  afterEach((): void => {
    delete process.env.LAB_ENGINE_LIVE_TOOLS;
    vi.restoreAllMocks();
  });

  it('marks one thrown section failed while the other five section jobs complete', async (): Promise<void> => {
    const { markSectionFailed, store } = createMockRunStore();
    const failedSection: PositioningSectionId = 'positioningBuyerICP';
    const completedSections: PositioningSectionId[] = [];
    const observedDeps: RunSectionDeps[] = [];
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((): void => {});
    const runSectionImpl = vi.fn(
      async (
        input: RunSectionInput,
        deps: RunSectionDeps,
      ): Promise<RunSectionResult> => {
        observedDeps.push(deps);

        if (input.sectionId === failedSection) {
          throw new Error('forced section failure');
        }

        completedSections.push(input.sectionId);
        return createRunSectionResult(input);
      },
    );

    await Promise.all(
      POSITIONING_SECTION_IDS.map((sectionId) =>
        runLabSectionJob({
          runId,
          sectionId,
          store,
          runSectionImpl,
        }),
      ),
    );

    expect(runSectionImpl).toHaveBeenCalledTimes(6);
    expect(completedSections).toEqual(
      POSITIONING_SECTION_IDS.filter((sectionId) => sectionId !== failedSection),
    );
    expect(markSectionFailed).toHaveBeenCalledTimes(1);
    expect(markSectionFailed).toHaveBeenCalledWith(
      runId,
      failedSection,
      'forced section failure',
    );
    expect(
      observedDeps.every(
        (deps) =>
          Array.isArray(deps.allowedTools) && deps.allowedTools.length === 0,
      ),
    ).toBe(true);
    expect(consoleError).toHaveBeenCalledWith(
      '[lab-section-job] section failed',
      expect.objectContaining({
        runId,
        sectionId: failedSection,
        message: 'forced section failure',
      }),
    );
  });

  it('passes through live tools only when LAB_ENGINE_LIVE_TOOLS is explicitly enabled', async (): Promise<void> => {
    const { store } = createMockRunStore();
    const observedDeps: RunSectionDeps[] = [];
    const runSectionImpl = vi.fn(
      async (
        input: RunSectionInput,
        deps: RunSectionDeps,
      ): Promise<RunSectionResult> => {
        observedDeps.push(deps);
        return createRunSectionResult(input);
      },
    );

    await runLabSectionJob({
      runId,
      sectionId: 'positioningMarketCategory',
      store,
      runSectionImpl,
    });
    process.env.LAB_ENGINE_LIVE_TOOLS = 'true';
    await runLabSectionJob({
      runId,
      sectionId: 'positioningBuyerICP',
      store,
      runSectionImpl,
    });

    expect(observedDeps[0]?.allowedTools).toEqual([]);
    expect(observedDeps[1]?.allowedTools).toBeUndefined();
  });
});
