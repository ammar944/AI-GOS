import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { persistenceGateEvalCases } from '@/lib/lab-engine/fixtures/persistence-gate-evals';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import { createRunStore } from '../run-store';

describe('createRunStore persistence gate', (): void => {
  it('rejects artifacts that fail section minimums before saving locally', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-run-store-gate-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    const created = await store.createRun(saaslaunchResearchInput);
    const shortArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          signals: [],
        },
      },
    };

    await expect(
      store.saveArtifact(saaslaunchResearchInput.runId, shortArtifact),
    ).rejects.toThrow(/body\.marketSize\.signals/u);

    const persisted = await store.readRun(saaslaunchResearchInput.runId);
    expect(persisted.sections.positioningMarketCategory).toEqual(
      created.sections.positioningMarketCategory,
    );
  });

  for (const evalCase of persistenceGateEvalCases) {
    it(`${evalCase.name} before saving locally`, async (): Promise<void> => {
      const rootDir = await mkdtemp(join(tmpdir(), 'aigos-run-store-gate-'));
      const store = createRunStore({
        rootDir,
        defaultSectionIds: [evalCase.sectionId],
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      });
      const created = await store.createRun(saaslaunchResearchInput);

      await expect(
        store.saveArtifact(saaslaunchResearchInput.runId, evalCase.artifact),
      ).rejects.toThrow(evalCase.expectedError);

      const persisted = await store.readRun(saaslaunchResearchInput.runId);
      expect(persisted.sections[evalCase.sectionId]).toEqual(
        created.sections[evalCase.sectionId],
      );
    });
  }
});
