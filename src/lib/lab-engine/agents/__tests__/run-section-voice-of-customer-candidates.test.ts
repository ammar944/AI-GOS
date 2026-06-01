import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ToolExecutionOptions } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VoiceOfCustomerSectionOutput } from '@/lib/lab-engine/artifacts/schemas/voice-of-customer';
import { voiceOfCustomerFixtureArtifact } from '@/lib/lab-engine/fixtures/voice-of-customer-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { runSection, SectionRunnerError } from '../run-section';
import type { StructuredStreamer } from '../section-agent';

interface ExecutableTool {
  execute: (
    input: unknown,
    context: ToolExecutionOptions,
  ) => Promise<unknown> | unknown;
}

async function makeStore(): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-voc-candidates-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ['positioningVoiceOfCustomer'],
    now: () => new Date('2026-06-01T00:00:00.000Z'),
  });
  await store.createRun(saaslaunchResearchInput);
  return store;
}

async function* emptyPartials(): AsyncIterable<unknown> {}

function requireExecutableTool(value: unknown, name: string): ExecutableTool {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Expected ${name} tool object.`);
  }

  const execute = (value as { execute?: unknown }).execute;
  if (typeof execute !== 'function') {
    throw new Error(`Expected ${name} tool execute function.`);
  }

  return {
    execute: execute as ExecutableTool['execute'],
  };
}

function collectSourceUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSourceUrls(item));
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const current =
    typeof record.sourceUrl === 'string' ? [record.sourceUrl] : [];

  return [
    ...current,
    ...Object.values(record).flatMap((item) => collectSourceUrls(item)),
  ];
}

function collapseSourceUrls(
  value: Record<string, unknown>,
  urls: readonly string[],
): Record<string, unknown> {
  const cloned = structuredClone(value) as Record<string, unknown>;
  let index = 0;

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item));
      return;
    }

    if (typeof current !== 'object' || current === null) {
      return;
    }

    const record = current as Record<string, unknown>;
    if (typeof record.sourceUrl === 'string') {
      record.sourceUrl = urls[index % urls.length] ?? record.sourceUrl;
      index += 1;
    }

    Object.values(record).forEach((child) => visit(child));
  };

  visit(cloned);

  return cloned;
}

function buildVoiceOfCustomerDraft(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const independentBody = collapseSourceUrls(
    voiceOfCustomerFixtureArtifact.body,
    [
      'https://independent-voc-one.example/pain',
      'https://independent-voc-two.example/pain',
      'https://independent-voc-three.example/pain',
    ],
  );

  return {
    body: independentBody as VoiceOfCustomerSectionOutput['body'],
    sources: voiceOfCustomerFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    statusSummary: voiceOfCustomerFixtureArtifact.statusSummary,
    verdict: voiceOfCustomerFixtureArtifact.verdict,
  };
}

function emitVoiceOfCustomerEvidenceStep(
  params: Parameters<StructuredStreamer>[0],
): void {
  params.onStepFinish?.({
    finishReason: 'stop',
    stepNumber: 1,
    text: 'Fixture VoC evidence supplied for structured body verification.',
    toolCalls: [],
    toolResults: Array.from(
      new Set(collectSourceUrls(voiceOfCustomerFixtureArtifact.body)),
    ).map((sourceUrl) => ({
      output: {
        sourceUrl,
        text: `Fixture buyer-language evidence for ${sourceUrl}`,
      },
      toolName: 'fixture_evidence',
    })),
  });
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function installSuccessfulToolFetches(): {
  fetchMock: ReturnType<typeof vi.fn>;
  requestedUrls: string[];
} {
  const requestedUrls: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requestedUrls.push(url);

      if (url.includes('searchapi.io')) {
        return jsonResponse({
          organic_results: [
            {
              link: 'https://www.g2.com/products/saaslaunch/reviews',
              snippet:
                'Users say pipeline follow-up still falls through the cracks without a weekly operating loop.',
            },
            {
              link: 'https://www.capterra.com/p/saaslaunch/reviews',
              snippet:
                'Teams complain that account research and next steps stay scattered across notes.',
            },
            {
              link: 'https://www.trustpilot.com/review/saaslaunch.example',
              snippet:
                'Reviewers mention manual CRM cleanup and missed handoffs as recurring pain.',
            },
          ],
        });
      }

      if (url.includes('api.search.brave.com')) {
        return jsonResponse({
          web: {
            results: [
              {
                description:
                  'Founder asks how to stop sales follow-up from disappearing after every pipeline review.',
                title: 'Weekly founder sales workflow pain',
                url: 'https://www.reddit.com/r/sales/comments/saaslaunch_followup_loop/',
              },
              {
                description:
                  'Operators discuss support-thread complaints about handoffs after founder-led sales calls.',
                title: 'Support thread on handoff misses',
                url: 'https://community.revops.example/t/founder-sales-handoff',
              },
              {
                description:
                  'A forum thread describes account context getting lost between research and outreach.',
                title: 'Account research gets lost',
                url: 'https://news.ycombinator.com/item?id=42601',
              },
            ],
          },
        });
      }

      if (url.includes('api.firecrawl.dev')) {
        return jsonResponse({
          data: {
            markdown:
              'Recovered third-party quote: "Our founder-led follow-up dies when notes and account context split across tools."',
            metadata: {
              sourceURL: 'https://www.g2.com/products/saaslaunch/reviews',
              title: 'Recovered SaaSLaunch review',
            },
          },
        });
      }

      return jsonResponse({});
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave');
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');

  return { fetchMock, requestedUrls };
}

const recoveryTargetUrl =
  'https://revopsforum.com/t/saaslaunch-handoff-breakdowns';

function installRecoveryToolFetches({
  firecrawlMarkdown,
  firecrawlSourceUrl = recoveryTargetUrl,
}: {
  firecrawlMarkdown: string;
  firecrawlSourceUrl?: string;
}): {
  fetchMock: ReturnType<typeof vi.fn>;
  requestedUrls: string[];
} {
  const requestedUrls: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requestedUrls.push(url);

      if (url.includes('searchapi.io')) {
        return jsonResponse({
          organic_results: [
            {
              link: 'https://www.g2.com/products/saaslaunch/reviews',
              snippet:
                'Users say follow-up still falls through the cracks without a weekly operating loop.',
            },
            {
              link: 'https://www.capterra.com/p/saaslaunch/reviews',
              snippet:
                'Teams complain that account research and next steps stay scattered across notes.',
            },
            {
              link: 'https://www.trustpilot.com/review/saaslaunch.example',
              snippet:
                'Reviewers mention manual CRM cleanup and missed handoffs as recurring pain.',
            },
          ],
        });
      }

      if (url.includes('api.search.brave.com')) {
        return jsonResponse({
          web: {
            results: [
              {
                description:
                  'Operators discuss support-thread complaints about handoffs after founder-led sales calls.',
                title: 'Support thread on handoff misses',
                url: 'https://community.revops.example/t/founder-sales-handoff',
              },
              {
                description:
                  'A forum thread describes account context getting lost between research and outreach.',
                title: 'Account research gets lost',
                url: 'https://news.ycombinator.com/item?id=42601',
              },
              {
                title: 'SaaSLaunch handoff breakdowns',
                url: recoveryTargetUrl,
              },
            ],
          },
        });
      }

      if (url.includes('api.firecrawl.dev')) {
        return jsonResponse({
          data: {
            markdown: firecrawlMarkdown,
            metadata: {
              sourceURL: firecrawlSourceUrl,
              title: 'Recovered SaaSLaunch forum thread',
            },
          },
        });
      }

      return jsonResponse({});
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave');
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');

  return { fetchMock, requestedUrls };
}

describe('runSection VoC candidate prepass', (): void => {
  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds a valid candidate pack before drafting, injects it into the prompt, and shares the section budget', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installSuccessfulToolFetches();
    let fetchCallsBeforeStructured = 0;
    let checkedFirstDraft = false;
    const budgetProbeOutputs: unknown[] = [];
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');
      expect(params.prompt).toContain('body.painLanguage.quotes[]');
      expect(params.prompt).toContain('Use at least 3 independent domains');
      expect(params.prompt).toContain('Align top-level sources');
      expect(params.prompt).toContain('g2.com');
      expect(params.prompt).toContain('reddit.com');

      emitVoiceOfCustomerEvidenceStep(params);
      if (!checkedFirstDraft) {
        checkedFirstDraft = true;
        fetchCallsBeforeStructured = requestedUrls.length;
        expect(fetchCallsBeforeStructured).toBe(2);
        expect(requestedUrls[0]).toContain('searchapi.io');
        expect(requestedUrls[1]).toContain('api.search.brave.com');
        expect(
          requestedUrls.some((url) => url.includes('api.firecrawl.dev')),
        ).toBe(false);

        const webSearchTool = requireExecutableTool(
          params.tools?.web_search,
          'web_search',
        );
        const toolContext = {} as ToolExecutionOptions;

        return {
          consumeStream: () => Promise.resolve(),
          output: Promise.all([
            webSearchTool.execute(
              { count: 1, country: 'US', q: 'budget probe one' },
              toolContext,
            ),
            webSearchTool.execute(
              { count: 1, country: 'US', q: 'budget probe two' },
              toolContext,
            ),
            webSearchTool.execute(
              { count: 1, country: 'US', q: 'budget probe three' },
              toolContext,
            ),
            webSearchTool.execute(
              { count: 1, country: 'US', q: 'budget probe four' },
              toolContext,
            ),
          ]).then((outputs) => {
            budgetProbeOutputs.push(...outputs);
            return buildVoiceOfCustomerDraft();
          }),
          partialOutputStream: emptyPartials(),
        };
      }

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildVoiceOfCustomerDraft()),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: ['reviews', 'web_search', 'firecrawl'],
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const budgetProbeTypes = budgetProbeOutputs.map((output) =>
      typeof output === 'object' && output !== null && 'type' in output
        ? (output as { type: unknown }).type
        : 'result',
    );

    expect(streamStructured).toHaveBeenCalled();
    expect(fetchCallsBeforeStructured).toBe(2);
    expect(requestedUrls.some((url) => url.includes('api.firecrawl.dev'))).toBe(
      false,
    );
    expect(budgetProbeTypes.slice(0, 2)).toEqual(['result', 'result']);
    expect(budgetProbeTypes).toContain('gap');
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('recovers one independent URL-only surface with Firecrawl before drafting', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installRecoveryToolFetches({
      firecrawlMarkdown:
        'Recovered third-party quote: "Our founder-led follow-up dies when notes and account context split across tools."',
    });
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(requestedUrls).toHaveLength(3);
      expect(requestedUrls[2]).toContain('api.firecrawl.dev');
      expect(params.prompt).toContain('revopsforum.com');
      expect(params.prompt).toContain('Recovered SaaSLaunch forum thread');
      expect(params.prompt).toContain('Recovered third-party quote');

      emitVoiceOfCustomerEvidenceStep(params);
      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildVoiceOfCustomerDraft()),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: ['reviews', 'web_search', 'firecrawl'],
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(requestedUrls.some((url) => url.includes('api.firecrawl.dev'))).toBe(
      true,
    );
    expect(JSON.stringify(record.events)).toContain('"toolName":"firecrawl"');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('keeps the VoC gap when Firecrawl cannot recover a strict candidate', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installRecoveryToolFetches({
      firecrawlMarkdown: '',
    });
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run after recovery gap.');
    });

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: 'positioningVoiceOfCustomer',
        },
        {
          allowedTools: ['reviews', 'web_search', 'firecrawl'],
          loadSkill: async () => 'Use deterministic VoC candidates.',
          now: () => new Date('2026-06-01T00:00:00.000Z'),
          store,
          streamStructured,
        },
      ),
    ).rejects.toThrow(SectionRunnerError);

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationEvent = record.events.find(
      (event) => event.type === 'validation-failed',
    );

    expect(streamStructured).not.toHaveBeenCalled();
    expect(requestedUrls.some((url) => url.includes('api.firecrawl.dev'))).toBe(
      true,
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'reason=insufficient_candidates',
    );
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe('failed');
  });

  it('emits validation-failed and skips the full structured draft when the prepass has a gap', async (): Promise<void> => {
    const store = await makeStore();
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not be called after VoC gap.');
    });

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: 'positioningVoiceOfCustomer',
        },
        {
          allowedTools: [],
          loadSkill: async () => 'Use deterministic VoC candidates.',
          now: () => new Date('2026-06-01T00:00:00.000Z'),
          store,
          streamStructured,
        },
      ),
    ).rejects.toThrow(SectionRunnerError);

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationEvent = record.events.find(
      (event) => event.type === 'validation-failed',
    );

    expect(streamStructured).not.toHaveBeenCalled();
    expect(record.events.map((event) => event.type)).not.toContain(
      'structured-output-started',
    );
    expect(validationEvent?.message).toBe(
      'Voice of Customer candidate prepass failed validation',
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'reason=no_review_or_forum_surfaces',
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'candidateCount=0',
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'subjectDomain=example.com',
    );
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe('failed');
  });
});
