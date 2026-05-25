import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { runSection } from '../run-section';
import type { AnswerToolRunner } from '../section-agent';

function buildMarketCategoryOutput() {
  return {
    sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
    verdict: marketCategoryFixtureArtifact.verdict,
    statusSummary: marketCategoryFixtureArtifact.statusSummary,
    confidence: marketCategoryFixtureArtifact.confidence,
    sources: marketCategoryFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: marketCategoryFixtureArtifact.body,
  };
}

describe('runSection corpus-only mode', (): void => {
  it('passes an empty external tool map and still validates a section output', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildMarketCategoryOutput();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);
      expect(params.telemetry).toEqual(
        expect.objectContaining({
          functionId: 'lab-section.answer-tool',
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          metadata: expect.objectContaining({
            model: 'claude-sonnet-4-5',
            operation: 'answer-tool',
            runId: saaslaunchResearchInput.runId,
            sectionId: 'positioningMarketCategory',
            traceId: saaslaunchResearchInput.runId,
          }),
        }),
      );
      return {
        steps: [],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
  });
});
