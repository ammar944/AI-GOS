import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Tool } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  competitorLandscapeBodySchema,
  type CompetitorLandscapeBody,
} from '@/lib/lab-engine/artifacts/schemas/competitor-landscape';
import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import type { RunSectionInput, RunSectionResult } from '../run-section';
import type { AgentStep, AnswerToolRunner } from '../section-agent';
import type { ToolName } from '../tools';

type RunSectionFn = (
  input: RunSectionInput,
  deps: Parameters<typeof import('../run-section').runSection>[1],
) => Promise<RunSectionResult>;

const prepassCreativeUrl =
  'https://cdn.example.com/prepass/gong-creative.png';
const prepassDetailsUrl =
  'https://adstransparency.google.com/advertiser/gong/ad/prepass-1';
const prepassLandingUrl = 'https://www.gong.io/prepass-demo';
const unsupportedNonAdUrl =
  'https://unsupported.example.com/not-from-ad-prepass';

function buildCompetitorLandscapeSupportStep(): AgentStep {
  return {
    stepNumber: 0,
    finishReason: 'stop',
    text: '',
    toolCalls: [],
    toolResults: [
      {
        toolName: 'fixture_support',
        output: {
          text: [
            'https://example.com/signalforge',
            'https://example.com/pipelinepilot',
            'https://example.com/revenueos-lab',
            'https://example.com/growthops-studio',
            'https://example.com/diy-spreadsheet',
            'https://example.com/saaslaunch/positioning-notes',
            'https://example.com/fixtures/ad-library/signalforge-linkedin',
            'https://example.com/fixtures/ad-library/pipelinepilot-google',
            'https://example.com/fixtures/ad-library/revenueos-meta',
            'https://example.com/fixtures/ad-library/growthops-linkedin',
            'https://example.com/signalforge/pipeline-priority',
            'https://example.com/pipelinepilot/crm-cleanup',
            'https://example.com/revenueos-lab/operator',
            'https://example.com/fixtures/creative/revenueos-operator.png',
          ].join(' '),
        },
      },
    ],
  };
}

function buildCompetitorLandscapeOutput(): {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sources: Array<{ title: string; url: string; publisher?: string }>;
  body: CompetitorLandscapeBody;
} {
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

function buildOutputWithUnsupportedNonAdUrl(): ReturnType<
  typeof buildCompetitorLandscapeOutput
> {
  const output = buildCompetitorLandscapeOutput();

  return {
    ...output,
    body: {
      ...output.body,
      adPresence: {
        ...output.body.adPresence,
        signals: output.body.adPresence.signals.map((signal, index) =>
          index === 0
            ? { ...signal, sourceUrl: unsupportedNonAdUrl }
            : signal,
        ),
      },
    },
  };
}

function createAdTool(
  platform: 'google' | 'meta',
): Tool<Record<string, unknown>, unknown> {
  return {
    execute: async (input: Record<string, unknown>): Promise<unknown> => {
      const advertiser =
        typeof input.advertiser === 'string' ? input.advertiser : 'Gong';

      if (platform === 'meta') {
        return {
          type: 'result',
          advertiser,
          platform,
          ads: [],
        };
      }

      return {
        type: 'result',
        advertiser,
        platform,
        ads: [
          {
            url: prepassDetailsUrl,
            id: 'gong-prepass-1',
            advertiserName: advertiser,
            title: 'Improve forecast accuracy',
            snippet: 'Pipeline teams use Gong to inspect forecast risk.',
            landingUrl: prepassLandingUrl,
            imageUrl: prepassCreativeUrl,
            detailsUrl: prepassDetailsUrl,
            format: 'image',
            isActive: true,
          },
        ],
      };
    },
  } as unknown as Tool<Record<string, unknown>, unknown>;
}

function createGapTool(toolName: ToolName): Tool<unknown, unknown> {
  return {
    execute: async (): Promise<unknown> => ({
      type: 'gap',
      reason: 'not_implemented',
      message: `${toolName} is not mocked in this verifier regression.`,
    }),
  } as unknown as Tool<unknown, unknown>;
}

async function importRunSectionWithMockedAdTools(): Promise<RunSectionFn> {
  vi.resetModules();
  vi.doMock('../tool-registry', () => ({
    buildToolMap: (
      allowedTools: readonly ToolName[],
    ): Record<string, Tool<unknown, unknown>> => {
      const tools: Record<string, Tool<unknown, unknown>> = {};

      for (const toolName of allowedTools) {
        if (toolName === 'google_ads') {
          tools[toolName] = createAdTool('google') as Tool<unknown, unknown>;
          continue;
        }

        if (toolName === 'meta_ads') {
          tools[toolName] = createAdTool('meta') as Tool<unknown, unknown>;
          continue;
        }

        tools[toolName] = createGapTool(toolName);
      }

      return tools;
    },
  }));

  const runSectionModule = await import('../run-section');
  return runSectionModule.runSection;
}

function assertCompetitorLandscapeBody(
  body: unknown,
): asserts body is CompetitorLandscapeBody {
  competitorLandscapeBodySchema.parse(body);
}

describe('runSection ad-prepass verifier provenance', (): void => {
  afterEach((): void => {
    vi.doUnmock('../tool-registry');
    vi.resetModules();
  });

  it('treats deterministic ad-prepass creative URLs as verifier-supported evidence', async (): Promise<void> => {
    const runSection = await importRunSectionWithMockedAdTools();
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-ad-prepass-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });
    const researchInput = {
      ...saaslaunchResearchInput,
      runId: 'run-ad-prepass-verifier',
      competitorAds: [],
      competitorSeeds: [{ name: 'Gong', domain: 'gong.io' }],
    };
    await store.createRun(researchInput);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildCompetitorLandscapeSupportStep()],
      text: '',
      answerInput: buildCompetitorLandscapeOutput(),
    }));

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningCompetitorLandscape',
      },
      {
        store,
        loadSkill: async () => 'Use deterministic ad prepass evidence.',
        env: { LAB_SECTION_STREAMING: 'false' },
        runAnswerTool,
        now: () => new Date('2026-06-01T12:00:00.000Z'),
      },
    );

    assertCompetitorLandscapeBody(result.artifact.body);
    expect(
      result.artifact.body.adEvidence.advertiserGroups[0]?.creatives[0],
    ).toEqual(
      expect.objectContaining({
        creativeUrl: prepassCreativeUrl,
        detailsUrl: prepassDetailsUrl,
        landingUrl: prepassLandingUrl,
        sourceUrl: prepassDetailsUrl,
      }),
    );

    for (const value of [
      prepassCreativeUrl,
      prepassDetailsUrl,
      prepassLandingUrl,
    ]) {
      expect(result.artifact.verification?.claims).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'verified',
            claim: expect.objectContaining({
              kind: 'url',
              value,
            }),
            matchedSourceRef: expect.objectContaining({
              kind: 'toolResult',
              toolName: 'google_ads',
            }),
          }),
        ]),
      );
    }

    const record = await store.readRun(researchInput.runId);
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
    expect(record.events.map((event) => event.type)).not.toContain(
      'validation-failed',
    );
  });

  it('does not treat unrelated non-ad URLs as verifier-supported by ad prepass evidence', async (): Promise<void> => {
    const runSection = await importRunSectionWithMockedAdTools();
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-ad-prepass-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });
    const researchInput = {
      ...saaslaunchResearchInput,
      runId: 'run-ad-prepass-verifier-negative',
      competitorAds: [],
      competitorSeeds: [{ name: 'Gong', domain: 'gong.io' }],
    };
    await store.createRun(researchInput);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildCompetitorLandscapeSupportStep()],
      text: '',
      answerInput: buildOutputWithUnsupportedNonAdUrl(),
    }));

    await expect(
      runSection(
        {
          runId: researchInput.runId,
          sectionId: 'positioningCompetitorLandscape',
        },
        {
          store,
          loadSkill: async () => 'Use deterministic ad prepass evidence.',
          env: {
            LAB_SECTION_STREAMING: 'false',
            LAB_VERIFIER_MAX_UNSUPPORTED: '0',
          },
          runAnswerTool,
          now: () => new Date('2026-06-01T12:00:00.000Z'),
        },
      ),
    ).rejects.toThrow('evidence-gate');

    const record = await store.readRun(researchInput.runId);
    const eventJson = JSON.stringify(record.events);

    expect(eventJson).toContain(unsupportedNonAdUrl);
    expect(eventJson).not.toContain(
      `url claim "${prepassCreativeUrl}" is not supported`,
    );
  });
});
