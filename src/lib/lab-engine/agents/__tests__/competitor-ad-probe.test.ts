import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Tool, ToolExecutionOptions } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  competitorLandscapeBodySchema,
  type CompetitorLandscapeBody,
} from '@/lib/lab-engine/artifacts/schemas/competitor-landscape';
import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { SectionToolBudget } from '../budget';
import { runCompetitorAdProbeSteps } from '../run-section';
import type { RunSectionInput, RunSectionResult } from '../run-section';
import type {
  AgentStep,
  AnswerToolRunner,
  StructuredStreamer,
} from '../section-agent';
import type { ToolName } from '../tools';

interface AdRow {
  type: 'ad';
  advertiser: string;
  toolName: string;
}

interface GapRow {
  type: 'gap';
  reason: string;
  message: string;
}

// Mirror tool-registry's wrapWithBudget: draw from the shared budget, return the
// same gap-row shape on exhaustion, otherwise emit a real ad row.
function budgetWrappedAdTool(
  toolName: string,
  budget: SectionToolBudget,
  observe: { concurrent: number; maxConcurrent: number },
): Tool {
  return {
    execute: async (
      input: unknown,
      _context: ToolExecutionOptions,
    ): Promise<AdRow | GapRow> => {
      if (!budget.consume(toolName)) {
        return {
          type: 'gap',
          reason: 'budget_exhausted',
          message: `section budget exhausted after ${budget.max} lookups`,
        };
      }
      observe.concurrent += 1;
      observe.maxConcurrent = Math.max(observe.maxConcurrent, observe.concurrent);
      // Yield so a sibling tool call can overlap (proves google + meta run in
      // parallel within one advertiser).
      await new Promise((resolve) => setTimeout(resolve, 5));
      observe.concurrent -= 1;
      const advertiser = (input as { advertiser: string }).advertiser;
      return { type: 'ad', advertiser, toolName };
    },
  } as unknown as Tool;
}

function isAdRow(value: unknown): value is AdRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'ad'
  );
}

describe('runCompetitorAdProbeSteps with a reserved ad budget', (): void => {
  it('lands the top advertiser google + meta from the reserve when generic is exhausted', async (): Promise<void> => {
    // genericMax=6 all consumed up front; reserve=2 (one advertiser worth).
    const budget = new SectionToolBudget(6, 2);
    for (let i = 0; i < 6; i += 1) {
      expect(budget.consume('web_search')).toBe(true);
    }

    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools,
    });

    // Bounded to exactly one advertiser.
    expect(steps).toHaveLength(1);

    const [step] = steps;
    const outputs = step.toolResults.map((result) => result.output);
    expect(outputs).toHaveLength(2);
    // BOTH ad tools produced real rows (drawn from the reserve), not gap rows.
    expect(outputs.every(isAdRow)).toBe(true);
    expect(
      outputs.some(
        (output) =>
          !isAdRow(output) && (output as GapRow).reason === 'budget_exhausted',
      ),
    ).toBe(false);

    // google_ads + meta_ads overlapped (parallel within the advertiser).
    expect(observe.maxConcurrent).toBe(2);
  });

  it('returns gap rows (no fabrication) once the reserve is also exhausted', async (): Promise<void> => {
    // No reserve and generic pre-exhausted: the probe must NOT fabricate ad rows.
    const budget = new SectionToolBudget(1, 0);
    expect(budget.consume('web_search')).toBe(true);

    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools,
    });

    const outputs = steps[0]?.toolResults.map((result) => result.output) ?? [];
    expect(outputs).toHaveLength(2);
    // Both are gap rows: the verifier accepts these as adEvidence_or_gap.
    expect(outputs.every((output) => !isAdRow(output))).toBe(true);
    expect(
      outputs.every(
        (output) => (output as GapRow).reason === 'budget_exhausted',
      ),
    ).toBe(true);
  });

  it('fires three ad tool calls per advertiser (google_ads + meta_ads + linkedin_ads) when a linkedin tool is present', async (): Promise<void> => {
    // LinkedIn is now a real, agent-callable channel (linkedin_ads -> SearchAPI
    // linkedin_ad_library). When the tool is present the probe must fire all
    // three SearchAPI platforms per advertiser; Foreplay is disabled in tests
    // (no FOREPLAY_API_KEY), so no synthetic Foreplay rows appear.
    const budget = new SectionToolBudget(6, 9);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
      linkedin_ads: budgetWrappedAdTool('linkedin_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 2,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'FirstRival', domain: 'firstrival.com' },
          { name: 'SecondRival', domain: 'secondrival.com' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      const calledToolNames = step.toolCalls.map((call) => call.toolName);
      expect(calledToolNames).toEqual([
        'google_ads',
        'meta_ads',
        'linkedin_ads',
      ]);

      const resultToolNames = step.toolResults.map((result) => result.toolName);
      expect(resultToolNames).toEqual([
        'google_ads',
        'meta_ads',
        'linkedin_ads',
      ]);
    }
  });

  it('stays google_ads + meta_ads only when the linkedin tool is absent', async (): Promise<void> => {
    // LinkedIn is best-effort: with no linkedin_ads tool the probe must not
    // fabricate a linkedin call — the adapter documents linkedin=0 as a
    // not-probed sentinel instead.
    const budget = new SectionToolBudget(6, 6);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 2,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'FirstRival', domain: 'firstrival.com' },
          { name: 'SecondRival', domain: 'secondrival.com' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      const calledToolNames = step.toolCalls.map((call) => call.toolName);
      expect(calledToolNames).toEqual(['google_ads', 'meta_ads']);
      expect(
        calledToolNames.some((name) => name.includes('linkedin')),
      ).toBe(false);

      const resultToolNames = step.toolResults.map((result) => result.toolName);
      expect(resultToolNames).toEqual(['google_ads', 'meta_ads']);
      expect(
        resultToolNames.some((name) => name.includes('linkedin')),
      ).toBe(false);
    }
  });

  it('runs three advertiser probes concurrently without exceeding the reserved budget', async (): Promise<void> => {
    const budget = new SectionToolBudget(0, 6);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 3,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'FirstRival', domain: 'first.example' },
          { name: 'SecondRival', domain: 'second.example' },
          { name: 'ThirdRival', domain: 'third.example' },
          { name: 'FourthRival', domain: 'fourth.example' },
        ],
      },
      researchTools,
    });

    expect(steps.map((step) => step.stepNumber)).toEqual([0, 1, 2]);
    // The subject always rides first in the advertiser slice (its own live ads
    // are first-class evidence), so the budget covers subject + two rivals.
    expect(
      steps.map((step) => {
        const firstCall = step.toolCalls[0];
        const input = firstCall?.input as { advertiser?: unknown } | undefined;
        return input?.advertiser;
      }),
    ).toEqual(['SaaSLaunch', 'FirstRival', 'SecondRival']);
    expect(
      steps.flatMap((step) => step.toolResults.map((result) => result.output)),
    ).toHaveLength(6);
    expect(
      steps
        .flatMap((step) => step.toolResults.map((result) => result.output))
        .every(isAdRow),
    ).toBe(true);
    expect(observe.maxConcurrent).toBe(6);
    expect(budget.remaining()).toBe(0);
  });

  it('probes the subject first with a domain pinned from the brief URL', async (): Promise<void> => {
    // The subject's own ad presence is first-class evidence: it always wins
    // the advertiser-limit slice, and its domain comes straight from the brief
    // websiteUrl so identity is domain-corroborated without the resolver.
    const budget = new SectionToolBudget(6, 2);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'SeededRival', domain: 'seededrival.com' },
          { name: 'SecondRival' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(1);
    const firstCall = steps[0]?.toolCalls[0];
    const input = firstCall?.input as
      | { advertiser?: unknown; domain?: unknown }
      | undefined;
    expect(input?.advertiser).toBe('SaaSLaunch');
    expect(input?.domain).toBe('example.com');
    const outputs = steps[0]?.toolResults.map((result) => result.output) ?? [];
    expect(outputs).toHaveLength(2);
    expect(outputs.every(isAdRow)).toBe(true);
  });

  it('seeds the probe advertiser list from competitorSeeds when competitorAds is empty', async (): Promise<void> => {
    // Production condition: corpus builder leaves competitorAds empty and feeds
    // competitorSeeds (parsed from the onboarding topCompetitors brief field).
    // Seeds follow the subject in the slice.
    const budget = new SectionToolBudget(6, 2);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 2,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'SeededRival', domain: 'seededrival.com' },
          { name: 'SecondRival' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(2);
    const probedAdvertisers = steps.map((step) => {
      const input = step.toolCalls[0]?.input as
        | { advertiser?: unknown }
        | undefined;
      return input?.advertiser;
    });
    expect(probedAdvertisers).toEqual(['SaaSLaunch', 'SeededRival']);
    const seededOutputs =
      steps[1]?.toolResults.map((result) => result.output) ?? [];
    expect(seededOutputs.every(isAdRow)).toBe(true);
    expect(
      (seededOutputs as AdRow[]).every(
        (row) => row.advertiser === 'SeededRival',
      ),
    ).toBe(true);
  });
});

type FetchSearchApiOrganicResults = (input: {
  abortSignal?: AbortSignal;
  apiKey: string;
  maxResults: number;
  query: string;
}) => Promise<Array<{ url: string; title?: string; snippet?: string }>>;

async function importProbeWithOrganicSearchMock(
  implementation: FetchSearchApiOrganicResults,
): Promise<{
  fetchSearchApiOrganicResults: ReturnType<
    typeof vi.fn<FetchSearchApiOrganicResults>
  >;
  runCompetitorAdProbeSteps: typeof runCompetitorAdProbeSteps;
}> {
  vi.resetModules();
  const fetchSearchApiOrganicResults =
    vi.fn<FetchSearchApiOrganicResults>(implementation);

  vi.doMock('../tools/searchapi-organic', () => ({
    fetchSearchApiOrganicResults,
  }));

  const runSectionModule = await import('../run-section');

  return {
    fetchSearchApiOrganicResults,
    runCompetitorAdProbeSteps: runSectionModule.runCompetitorAdProbeSteps,
  };
}

function createProbeTools(): Record<string, unknown> {
  const budget = new SectionToolBudget(0, 30);
  const observe = { concurrent: 0, maxConcurrent: 0 };

  return {
    google_ads: budgetWrappedAdTool('google_ads', budget, observe),
    meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    linkedin_ads: budgetWrappedAdTool('linkedin_ads', budget, observe),
  };
}

function firstCallInput(step: AgentStep): {
  advertiser?: unknown;
  domain?: unknown;
} {
  return (step.toolCalls[0]?.input ?? {}) as {
    advertiser?: unknown;
    domain?: unknown;
  };
}

function getStep(steps: readonly AgentStep[], index: number): AgentStep {
  const step = steps[index];

  if (step === undefined) {
    throw new Error(`Expected probe step ${index}.`);
  }

  return step;
}

function gtmOnTopicOrganicResult(
  url: string,
): { url: string; title: string; snippet: string } {
  return {
    url,
    title: 'GTM pipeline operating system',
    snippet:
      'Revenue operators use account research, founder-led sales loops, and follow-up automation.',
  };
}

function codaTopicResearchInput(): typeof saaslaunchResearchInput {
  return {
    ...saaslaunchResearchInput,
    company: {
      ...saaslaunchResearchInput.company,
      category: 'Collaborative docs and tables automation',
      description:
        'A workspace for documents, tables, project planning, and lightweight app automation.',
      targetCustomer:
        'Operations teams that coordinate project plans, structured docs, and internal workflows.',
    },
    onboarding: {
      ...saaslaunchResearchInput.onboarding,
      primaryGoal:
        'Evaluate collaborative docs, tables, project planning, and automation positioning.',
      targetSegments: ['Operations teams', 'Project managers'],
      keyOffers: ['Docs and tables workspace', 'Project planning automation'],
      distributionChannels: ['Template gallery', 'Product-led adoption'],
    },
  };
}

function emptyTopicResearchInput(): typeof saaslaunchResearchInput {
  return {
    ...saaslaunchResearchInput,
    company: {
      ...saaslaunchResearchInput.company,
      category: ' ',
      description: ' ',
      targetCustomer: ' ',
    },
    onboarding: {
      ...saaslaunchResearchInput.onboarding,
      primaryGoal: ' ',
      targetSegments: [' '],
      keyOffers: [' '],
      distributionChannels: [' '],
    },
  };
}

describe('competitor ad probe advertiser organic domain fallback', (): void => {
  afterEach((): void => {
    vi.doUnmock('../tools/searchapi-organic');
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('fires only for domainless advertisers and passes resolved domains into probe tool input', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { fetchSearchApiOrganicResults, runCompetitorAdProbeSteps } =
      await importProbeWithOrganicSearchMock(async ({ query }) => {
        if (query === 'Domainless official site') {
          return [gtmOnTopicOrganicResult('https://www.domainless.com/')];
        }

        throw new Error(`Unexpected organic query: ${query}`);
      });

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [
        { advertiser: 'Domainful', domain: 'domainful.com' },
        { advertiser: 'Domainless' },
      ],
      maxAdvertisers: 2,
      researchInput: saaslaunchResearchInput,
      researchTools: createProbeTools(),
    });

    expect(fetchSearchApiOrganicResults).toHaveBeenCalledTimes(1);
    expect(fetchSearchApiOrganicResults).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-searchapi-key',
        maxResults: 3,
        query: 'Domainless official site',
      }),
    );
    expect(firstCallInput(getStep(steps, 0))).toEqual(
      expect.objectContaining({
        advertiser: 'Domainful',
        domain: 'domainful.com',
      }),
    );
    expect(firstCallInput(getStep(steps, 1))).toEqual(
      expect.objectContaining({
        advertiser: 'Domainless',
        domain: 'domainless.com',
      }),
    );
  });

  it('caps organic fallback at five domainless advertisers per probe run', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { fetchSearchApiOrganicResults, runCompetitorAdProbeSteps } =
      await importProbeWithOrganicSearchMock(async ({ query }) => {
        const advertiser = query.replace(/ official site$/u, '').toLowerCase();
        return [gtmOnTopicOrganicResult(`https://${advertiser}.com/`)];
      });

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [
        { advertiser: 'One' },
        { advertiser: 'Two' },
        { advertiser: 'Three' },
        { advertiser: 'Four' },
        { advertiser: 'Five' },
        { advertiser: 'Six' },
      ],
      maxAdvertisers: 6,
      researchInput: saaslaunchResearchInput,
      researchTools: createProbeTools(),
    });

    expect(fetchSearchApiOrganicResults).toHaveBeenCalledTimes(5);
    expect(steps).toHaveLength(6);
    expect(firstCallInput(getStep(steps, 4)).domain).toBe('five.com');
    expect(firstCallInput(getStep(steps, 5)).domain).toBeUndefined();
  });

  it('skips organic fallback when SEARCHAPI_KEY is absent', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', '');
    const { fetchSearchApiOrganicResults, runCompetitorAdProbeSteps } =
      await importProbeWithOrganicSearchMock(async () => [
        { url: 'https://domainless.com/' },
      ]);

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Domainless' }],
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools: createProbeTools(),
    });

    expect(fetchSearchApiOrganicResults).not.toHaveBeenCalled();
    expect(firstCallInput(getStep(steps, 0)).domain).toBeUndefined();
  });

  it('rejects organic fallback domains whose brand token does not match the advertiser', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { runCompetitorAdProbeSteps } = await importProbeWithOrganicSearchMock(
      async () => [
        gtmOnTopicOrganicResult('https://www.notionlimited.co.uk/'),
      ],
    );

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Notion' }],
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools: createProbeTools(),
    });

    expect(firstCallInput(getStep(steps, 0))).toEqual(
      expect.objectContaining({ advertiser: 'Notion' }),
    );
    expect(firstCallInput(getStep(steps, 0)).domain).toBeUndefined();
  });

  it('threads the section abort signal into the organic fallback helper', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const controller = new AbortController();
    const { fetchSearchApiOrganicResults, runCompetitorAdProbeSteps } =
      await importProbeWithOrganicSearchMock(async () => [
        gtmOnTopicOrganicResult('https://domainless.com/'),
      ]);

    await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Domainless' }],
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools: createProbeTools(),
      signal: controller.signal,
    });

    expect(fetchSearchApiOrganicResults).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: controller.signal }),
    );
  });

  it('rejects off-topic coda.org and resolves the first on-topic Coda result to coda.io', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { runCompetitorAdProbeSteps } = await importProbeWithOrganicSearchMock(
      async () => [
        {
          url: 'https://www.coda.org/',
          title: 'CODA community organization',
          snippet:
            'A nonprofit community for public arts, education events, music, and civic programs.',
        },
        {
          url: 'https://coda.io/',
          title: 'Coda docs and tables',
          snippet:
            'Collaborative docs, tables, project planning, and automation for operations teams.',
        },
        {
          url: 'https://coda.dev/',
          title: 'Coda developer utilities',
          snippet: 'Package documentation for unrelated developer tools.',
        },
      ],
    );

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Coda' }],
      maxAdvertisers: 1,
      researchInput: codaTopicResearchInput(),
      researchTools: createProbeTools(),
    });

    expect(firstCallInput(getStep(steps, 0))).toEqual(
      expect.objectContaining({
        advertiser: 'Coda',
        domain: 'coda.io',
      }),
    );
  });

  it('leaves the advertiser domainless when all three organic results are off-topic', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { runCompetitorAdProbeSteps } = await importProbeWithOrganicSearchMock(
      async () => [
        { url: 'https://coda.io/' },
        {
          url: 'https://www.coda.org/',
          title: 'CODA community organization',
          snippet: 'Public arts, education events, music, and civic programs.',
        },
        {
          url: 'https://coda.dev/',
          title: 'Coda developer utilities',
          snippet: 'Package documentation for unrelated developer tools.',
        },
      ],
    );

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Coda' }],
      maxAdvertisers: 1,
      researchInput: codaTopicResearchInput(),
      researchTools: createProbeTools(),
    });

    expect(firstCallInput(getStep(steps, 0))).toEqual(
      expect.objectContaining({ advertiser: 'Coda' }),
    );
    expect(firstCallInput(getStep(steps, 0)).domain).toBeUndefined();
  });

  it('keeps organic fallback domainless when topicContext is empty', async (): Promise<void> => {
    vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi-key');
    const { runCompetitorAdProbeSteps } = await importProbeWithOrganicSearchMock(
      async () => [
        {
          url: 'https://coda.io/',
          title: 'Coda docs and tables',
          snippet:
            'Collaborative docs, tables, project planning, and automation for operations teams.',
        },
      ],
    );

    const steps = await runCompetitorAdProbeSteps({
      advertisers: [{ advertiser: 'Coda' }],
      maxAdvertisers: 1,
      researchInput: emptyTopicResearchInput(),
      researchTools: createProbeTools(),
    });

    expect(firstCallInput(getStep(steps, 0))).toEqual(
      expect.objectContaining({ advertiser: 'Coda' }),
    );
    expect(firstCallInput(getStep(steps, 0)).domain).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Post-draft rescue probe regression (runs f06333b6 + 0eeebd93): when the GTM
// brief gives zero competitor seeds the deterministic prepass probe queries
// nothing, yet the section agent discovers real competitors while drafting.
// The rescue probe must run those discovered advertisers through the SAME
// deterministic ad probe and fold the recovered evidence into the committed
// artifact. When seeds are present the rescue must never fire.
// ---------------------------------------------------------------------------

type RunSectionFn = (
  input: RunSectionInput,
  deps: Parameters<typeof import('../run-section').runSection>[1],
) => Promise<RunSectionResult>;

interface RecordedProbeCall {
  advertiser: string;
  domain: string | undefined;
  platform: 'google' | 'meta' | 'linkedin';
}

const rescueNotePattern = /post-draft rescue probe/;
const rescueClientNote =
  'Additional ad evidence was checked after competitors were identified in the draft.';
const discoveredTopThree = ['PipelinePilot', 'RevenueOS Lab', 'SignalForge'];

function createRecordingAdTool(
  platform: 'google' | 'meta' | 'linkedin',
  calls: RecordedProbeCall[],
): Tool<unknown, unknown> {
  return {
    execute: async (input: unknown): Promise<unknown> => {
      const record = input as { advertiser?: unknown; domain?: unknown };
      const advertiser =
        typeof record.advertiser === 'string' ? record.advertiser : 'unknown';
      const domain =
        typeof record.domain === 'string' ? record.domain : undefined;
      calls.push({ advertiser, domain, platform });

      if (platform !== 'google') {
        return { type: 'result', advertiser, platform, ads: [] };
      }

      const slug = advertiser.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        type: 'result',
        advertiser,
        platform,
        ads: [
          {
            url: `https://adstransparency.google.com/advertiser/${slug}/ad/rescue-1`,
            id: `${slug}-rescue-1`,
            advertiserName: advertiser,
            title: `${advertiser} pipeline priority ads`,
            snippet: `${advertiser} promotes GTM workflow tooling for revenue teams.`,
            landingUrl:
              domain === undefined
                ? `https://example.com/${slug}`
                : `https://${domain}/${slug}`,
            imageUrl: `https://cdn.example.com/${slug}/rescue-creative.png`,
            detailsUrl: `https://adstransparency.google.com/advertiser/${slug}/ad/rescue-1`,
            format: 'image',
            isActive: true,
          },
        ],
      };
    },
  } as unknown as Tool<unknown, unknown>;
}

function createRescueGapTool(toolName: ToolName): Tool<unknown, unknown> {
  return {
    execute: async (): Promise<unknown> => ({
      type: 'gap',
      reason: 'not_implemented',
      message: `${toolName} is not mocked in this rescue regression.`,
    }),
  } as unknown as Tool<unknown, unknown>;
}

async function importRunSectionWithRecordingAdTools(
  calls: RecordedProbeCall[],
): Promise<RunSectionFn> {
  vi.resetModules();
  vi.doMock('../tool-registry', () => ({
    buildToolMap: (
      allowedTools: readonly ToolName[],
    ): Record<string, Tool<unknown, unknown>> => {
      const tools: Record<string, Tool<unknown, unknown>> = {};

      for (const toolName of allowedTools) {
        if (toolName === 'google_ads') {
          tools[toolName] = createRecordingAdTool('google', calls);
          continue;
        }

        if (toolName === 'meta_ads') {
          tools[toolName] = createRecordingAdTool('meta', calls);
          continue;
        }

        if (toolName === 'linkedin_ads') {
          tools[toolName] = createRecordingAdTool('linkedin', calls);
          continue;
        }

        tools[toolName] = createRescueGapTool(toolName);
      }

      return tools;
    },
  }));

  const runSectionModule = await import('../run-section');
  return runSectionModule.runSection;
}

function buildRescueSupportStep(): AgentStep {
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

function buildDiscoveredCompetitorOutput(): {
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

function assertCompetitorLandscapeBody(
  body: unknown,
): asserts body is CompetitorLandscapeBody {
  competitorLandscapeBodySchema.parse(body);
}

async function makeRescueStore(
  runId: string,
  competitorSeeds: Array<{ name: string; domain?: string }>,
): Promise<{
  store: ReturnType<typeof createRunStore>;
  runId: string;
}> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-ad-rescue-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ['positioningCompetitorLandscape'],
    now: () => new Date('2026-06-09T12:00:00.000Z'),
  });
  await store.createRun({
    ...saaslaunchResearchInput,
    runId,
    competitorAds: [],
    competitorSeeds,
  });
  return { store, runId };
}

describe('runSection post-draft competitor ad rescue probe', (): void => {
  beforeEach((): void => {
    vi.stubGlobal('fetch', async (): Promise<Response> => {
      throw new Error('source liveness network unavailable in test');
    });
  });

  afterEach((): void => {
    vi.unstubAllGlobals();
    vi.doUnmock('../tool-registry');
    vi.resetModules();
  });

  it('rescues discovered competitors when brief seeds are blank (answer-tool path)', async (): Promise<void> => {
    const calls: RecordedProbeCall[] = [];
    const runSection = await importRunSectionWithRecordingAdTools(calls);
    const { store, runId } = await makeRescueStore('run-ad-rescue-blank', []);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildRescueSupportStep()],
      text: '',
      answerInput: buildDiscoveredCompetitorOutput(),
    }));

    const result = await runSection(
      { runId, sectionId: 'positioningCompetitorLandscape' },
      {
        store,
        loadSkill: async () => 'Use deterministic ad evidence.',
        env: { LAB_SECTION_STREAMING: 'false' },
        runAnswerTool,
        now: () => new Date('2026-06-09T12:00:00.000Z'),
      },
    );

    // The prepass probed the subject (always seeded), then the rescue probed
    // EXACTLY the three ADVERTISABLE discovered competitors: status-quo and
    // DIY entries are buyer workflows, not advertisers, and are type-filtered
    // out of the probe (W5 raised the cap to the full set).
    const probedAdvertisers = [...new Set(calls.map((call) => call.advertiser))]
      .slice()
      .sort();
    expect(probedAdvertisers).toEqual(
      [...discoveredTopThree, 'SaaSLaunch'].sort(),
    );
    expect(probedAdvertisers).not.toContain('GrowthOps Studio');
    expect(probedAdvertisers).not.toContain('Spreadsheet Pipeline Review');

    assertCompetitorLandscapeBody(result.artifact.body);
    const groups = result.artifact.body.adEvidence.advertiserGroups;

    for (const advertiser of discoveredTopThree) {
      const group = groups.find(
        (candidate) => candidate.advertiserName === advertiser,
      );
      expect(group).toBeDefined();
      // The recovered creatives from the probe are on the wall.
      expect(group?.creatives.length).toBeGreaterThan(0);
      // Visibility: rescue-probed groups carry the post-draft provenance note.
      expect(
        group?.dataGaps.some(
          (gap) =>
            gap.reason === rescueClientNote &&
            rescueNotePattern.test(gap.internalDetail ?? ''),
        ),
      ).toBe(true);
    }

    // The empty-wall synthetic gap group must NOT remain once ads are rescued.
    expect(
      groups.some((group) => group.advertiserName === 'Competitor ad libraries'),
    ).toBe(false);
  });

  it('never fires the rescue when brief competitor seeds are present', async (): Promise<void> => {
    const calls: RecordedProbeCall[] = [];
    const runSection = await importRunSectionWithRecordingAdTools(calls);
    const { store, runId } = await makeRescueStore('run-ad-rescue-seeded', [
      { name: 'Gong', domain: 'gong.io' },
    ]);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildRescueSupportStep()],
      text: '',
      answerInput: buildDiscoveredCompetitorOutput(),
    }));

    const result = await runSection(
      { runId, sectionId: 'positioningCompetitorLandscape' },
      {
        store,
        loadSkill: async () => 'Use deterministic ad evidence.',
        env: { LAB_SECTION_STREAMING: 'false' },
        runAnswerTool,
        now: () => new Date('2026-06-09T12:00:00.000Z'),
      },
    );

    // Only the seeded prepass probe ran (subject + the seeded competitor): no
    // second probe for discovered names, even though the answer payload
    // contains five discovered competitors.
    expect(
      [...new Set(calls.map((call) => call.advertiser))].slice().sort(),
    ).toEqual(['Gong', 'SaaSLaunch']);

    assertCompetitorLandscapeBody(result.artifact.body);
    const groups = result.artifact.body.adEvidence.advertiserGroups;
    expect(groups.some((group) => group.advertiserName === 'Gong')).toBe(true);
    expect(
      groups.some((group) => group.advertiserName === 'SignalForge'),
    ).toBe(false);
    expect(JSON.stringify(result.artifact)).not.toMatch(rescueNotePattern);
  });

  it('rescues discovered competitors on the structured-stream path (prod default)', async (): Promise<void> => {
    const calls: RecordedProbeCall[] = [];
    const runSection = await importRunSectionWithRecordingAdTools(calls);
    const { store, runId } = await makeRescueStore(
      'run-ad-rescue-streaming',
      [],
    );

    async function* emptyPartials(): AsyncIterable<unknown> {
      // No partial frames needed; the rescue happens after the final body.
    }

    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      params.onStepFinish?.(buildRescueSupportStep());
      const output = buildDiscoveredCompetitorOutput();

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve({
          verdict: output.verdict,
          statusSummary: output.statusSummary,
          sources: output.sources,
          body: output.body,
        }),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      { runId, sectionId: 'positioningCompetitorLandscape' },
      {
        store,
        loadSkill: async () => 'Use deterministic ad evidence.',
        env: {},
        streamStructured,
        broadcastPartial: vi.fn(async () => undefined),
        now: () => new Date('2026-06-09T12:00:00.000Z'),
      },
    );

    expect(streamStructured).toHaveBeenCalledTimes(1);

    const probedAdvertisers = [...new Set(calls.map((call) => call.advertiser))]
      .slice()
      .sort();
    expect(probedAdvertisers).toEqual(
      [...discoveredTopThree, 'SaaSLaunch'].sort(),
    );

    assertCompetitorLandscapeBody(result.artifact.body);
    const groups = result.artifact.body.adEvidence.advertiserGroups;

    for (const advertiser of discoveredTopThree) {
      const group = groups.find(
        (candidate) => candidate.advertiserName === advertiser,
      );
      expect(group).toBeDefined();
      expect(group?.creatives.length).toBeGreaterThan(0);
      expect(
        group?.dataGaps.some(
          (gap) =>
            gap.reason === rescueClientNote &&
            rescueNotePattern.test(gap.internalDetail ?? ''),
        ),
      ).toBe(true);
    }

    expect(
      groups.some((group) => group.advertiserName === 'Competitor ad libraries'),
    ).toBe(false);
  });
});
