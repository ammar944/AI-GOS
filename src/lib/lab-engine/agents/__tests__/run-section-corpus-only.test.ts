import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
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

function buildInvalidMarketCategoryOutput() {
  const output = buildMarketCategoryOutput();

  return {
    ...output,
    body: {
      ...output.body,
      marketSize: {
        ...output.body.marketSize,
        signals: output.body.marketSize.signals.slice(1),
      },
    },
  };
}

function buildCompetitorLandscapeOutput() {
  return {
    sectionTitle: competitorLandscapeFixtureArtifact.sectionTitle,
    verdict: competitorLandscapeFixtureArtifact.verdict,
    statusSummary: competitorLandscapeFixtureArtifact.statusSummary,
    confidence: competitorLandscapeFixtureArtifact.confidence,
    sources: competitorLandscapeFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: competitorLandscapeFixtureArtifact.body,
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
      expect(params.instructions).toContain("Corpus-only mode:");
      expect(params.instructions).toContain(
        "Do not call web_search, firecrawl, pagespeed, reviews, keyword_ad_probe, ga4, spyfu, adlibrary, google_ads, or meta_ads.",
      );
      expect(params.prompt).toContain(
        "No external research tools are available.",
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

  it('repairs answer-tool outputs that miss section minimums', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls === 2) {
        expect(params.prompt).toContain('The previous output failed validation');
        expect(params.prompt).toContain('body.marketSize.signals');
        expect(params.prompt).toContain('Previous output JSON');
      }

      return {
        steps: [],
        text: '',
        answerInput:
          calls === 1
            ? buildInvalidMarketCategoryOutput()
            : buildMarketCategoryOutput(),
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

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(runAnswerTool).toHaveBeenCalledTimes(2);
    expect(eventTypes).toContain('validation-failed');
    expect(eventTypes).toContain('repair-started');
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });

  it('skips competitor ad preprobes when external tools are disabled', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildCompetitorLandscapeOutput();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);

      return {
        steps: [],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningCompetitorLandscape',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    expect(result.artifact.sectionId).toBe('positioningCompetitorLandscape');
    expect(result.artifact.body).toMatchObject({
      competitorSet: competitorLandscapeFixtureArtifact.body.competitorSet,
    });
    expect(result.artifact.body.adEvidence).toMatchObject({
      advertiserGroups: [],
    });
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
  });
});
