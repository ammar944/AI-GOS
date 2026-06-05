import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ToolExecutionOptions } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  voiceOfCustomerBodySchema,
  type VoiceOfCustomerEvidenceGapReport,
  type VoiceOfCustomerSectionOutput,
} from '@/lib/lab-engine/artifacts/schemas/voice-of-customer';
import {
  researchInputSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import { voiceOfCustomerFixtureArtifact } from '@/lib/lab-engine/fixtures/voice-of-customer-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { runSection } from '../run-section';
import type { AnswerToolRunner, StructuredStreamer } from '../section-agent';

interface ExecutableTool {
  execute: (
    input: unknown,
    context: ToolExecutionOptions,
  ) => Promise<unknown> | unknown;
}

async function makeStore(
  researchInput: ResearchInput = saaslaunchResearchInput,
): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-voc-candidates-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ['positioningVoiceOfCustomer'],
    now: () => new Date('2026-06-01T00:00:00.000Z'),
  });
  await store.createRun(researchInput);
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

function buildThinVoiceOfCustomerDraft(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildVoiceOfCustomerDraft();
  const quotes = draft.body.painLanguage.quotes.slice(0, 6).map(
    (quote, index) => ({
      ...quote,
      sourceUrl:
        index % 2 === 0
          ? `https://g2.com/products/saaslaunch/reviews/${index + 1}`
          : `https://reddit.com/r/sales/comments/saaslaunch-${index + 1}`,
    }),
  );

  return {
    ...draft,
    body: {
      ...draft.body,
      painLanguage: {
        ...draft.body.painLanguage,
        quotes,
      },
    },
  };
}

function buildSingleSourceMajorityVoiceOfCustomerDraft(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildVoiceOfCustomerDraft();
  const quoteUrls = [
    'https://g2.com/products/saaslaunch/reviews/1',
    'https://g2.com/products/saaslaunch/reviews/2',
    'https://g2.com/products/saaslaunch/reviews/3',
    'https://g2.com/products/saaslaunch/reviews/4',
    'https://g2.com/products/saaslaunch/reviews/5',
    'https://g2.com/products/saaslaunch/reviews/6',
    'https://reddit.com/r/sales/comments/saaslaunch-7',
    'https://reddit.com/r/sales/comments/saaslaunch-8',
    'https://trustpilot.com/review/saaslaunch.example/9',
    'https://trustpilot.com/review/saaslaunch.example/10',
  ];
  const quotes = draft.body.painLanguage.quotes.map((quote, index) => ({
    ...quote,
    sourceUrl: quoteUrls[index] ?? quote.sourceUrl,
  }));

  return {
    ...draft,
    body: {
      ...draft.body,
      painLanguage: {
        ...draft.body.painLanguage,
        quotes,
      },
    },
  };
}

function buildVoiceOfCustomerDraftWithInvalidPainQuoteSource(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildThinVoiceOfCustomerDraft();
  const quotes = draft.body.painLanguage.quotes.map((quote, index) =>
    index === 2
      ? {
          ...quote,
          source: 'reviews',
        }
      : quote,
  );

  return {
    ...draft,
    body: {
      ...draft.body,
      painLanguage: {
        ...draft.body.painLanguage,
        quotes,
      },
    },
  } as Omit<VoiceOfCustomerSectionOutput, 'confidence' | 'sectionTitle'>;
}

function buildVoiceOfCustomerDraftWithBlankPainQuoteMetadata(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildThinVoiceOfCustomerDraft();
  const quotes = draft.body.painLanguage.quotes.map((quote, index) =>
    index === 1
      ? {
          ...quote,
          date: '',
          role: '',
        }
      : quote,
  );

  return {
    ...draft,
    body: {
      ...draft.body,
      painLanguage: {
        ...draft.body.painLanguage,
        quotes,
      },
    },
  };
}

function buildMixedEvidenceGapVoiceOfCustomerDraft(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildVoiceOfCustomerDraft();

  return {
    ...draft,
    body: voiceOfCustomerBodySchema.parse({
      ...draft.body,
      evidenceGap: true,
      evidenceGapReport: {
        foundDistinctPainSourceCount: 3,
        foundPainQuoteCount: 10,
        observedPainSourceDomains: [
          'independent-voc-one.example',
          'independent-voc-two.example',
          'independent-voc-three.example',
        ],
        reason: 'insufficient_voice_of_customer_sources',
        requiredDistinctPainSourceCount: 3,
        requiredPainQuoteCount: 10,
        sourcingPlan: [
          'Recover full review bodies from approved third-party review surfaces.',
        ],
        summary:
          'Model-authored evidence gap remained on an otherwise full Voice of Customer draft.',
      },
    }),
  };
}

function makeDenseVoiceOfCustomerResearchInput(): ResearchInput {
  const domains = [
    'g2.com',
    'g2.com',
    'g2.com',
    'g2.com',
    'reddit.com',
    'reddit.com',
    'reddit.com',
    'capterra.com',
    'capterra.com',
    'capterra.com',
  ];
  const excerpts = domains.map((domain, index) => ({
    id: `excerpt_dense_voc_${index + 1}`,
    observedAt: '2026-06-01T00:00:00.000Z',
    sourceId: `source_dense_voc_${index + 1}`,
    sourceUrl: `https://${domain}/voc/dense-${index + 1}`,
    text: `Dense candidate ${index + 1} says missed handoffs create urgent account-follow-up pain, and after rebuilding the weekly loop the team knows which account action matters next.`,
    title:
      domain === 'reddit.com' || domain === 'news.ycombinator.com'
        ? `Dense forum candidate ${index + 1}`
        : `Dense review candidate ${index + 1}`,
  }));

  return researchInputSchema.parse({
    ...saaslaunchResearchInput,
    runId: 'run_saaslaunch_dense_voc_fixture',
    sources: [
      ...saaslaunchResearchInput.sources,
      ...excerpts.map((excerpt) => ({
        id: excerpt.sourceId,
        observedAt: excerpt.observedAt,
        title: excerpt.title,
        url: excerpt.sourceUrl,
      })),
    ],
    corpus: {
      ...saaslaunchResearchInput.corpus,
      excerpts: [...saaslaunchResearchInput.corpus.excerpts, ...excerpts],
      sectionExcerpts: {
        ...saaslaunchResearchInput.corpus.sectionExcerpts,
        positioningMarketCategory: [],
        positioningBuyerICP: [],
        positioningCompetitorLandscape: [],
        positioningVoiceOfCustomer: excerpts,
        positioningDemandIntent: [],
        positioningOfferDiagnostic: [],
        positioningCrossSectionReasoning: [],
        positioningSynthesis: [],
        positioningPaidMediaPlan: [],
      },
    },
  });
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

function getFirecrawlBodyUrl(init: RequestInit | undefined): string | null {
  if (typeof init?.body !== 'string') {
    return null;
  }

  try {
    const body = JSON.parse(init.body) as { url?: unknown };
    return typeof body.url === 'string' ? body.url : null;
  } catch {
    return null;
  }
}

function buildDefaultReviewBodyMarkdown(targetUrl: string | null): string {
  if (targetUrl?.includes('trustpilot.com')) {
    return [
      'Rated 2 out of 5 stars',
      'Recovered third-party quote: Support is slow and handoffs are missed when account context is scattered across sales tools.',
      'Date of experience: May 20, 2026',
      'Rated 3 out of 5 stars',
      'Recovered third-party quote: The platform is hard to trust when billing handoffs and CRM cleanup still feel manual.',
      'Date of experience: May 21, 2026',
    ].join('\n');
  }

  if (targetUrl?.includes('capterra.com')) {
    return [
      '# SaaSLaunch review',
      '',
      'Cons: Teams complain that account research and next steps stay scattered across notes, creating missed sales handoffs and manual CRM cleanup.',
      '',
      'Cons: Operators say reporting setup is confusing and expensive when pipeline notes need manual cleanup.',
    ].join('\n');
  }

  return [
    'What do you dislike about SaaSLaunch?',
    'Recovered third-party quote: Our founder-led follow-up gets manual and confusing when notes and account context split across tools.',
    'Review collected by and hosted on G2.com.',
    'What problems are you solving with SaaSLaunch?',
    'Recovered third-party quote: We still miss handoffs after calls because account notes are scattered and support is slow to clean them up.',
    'Review collected by and hosted on G2.com.',
  ].join('\n');
}

function installSuccessfulToolFetches({
  firecrawlMode = 'result',
  firecrawlMarkdown,
}: {
  firecrawlMode?: 'result' | 'api-error';
  firecrawlMarkdown?: string;
} = {}): {
  fetchMock: ReturnType<typeof vi.fn>;
  requestedUrls: string[];
} {
  const requestedUrls: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
                extra_snippets: [
                  'Buyers mention missed handoffs after founder-led sales calls.',
                  '',
                  42,
                  '   ',
                  'Pipeline review snippets describe context loss between notes and CRM.',
                ],
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
        if (firecrawlMode === 'api-error') {
          return new Response('firecrawl rate limit', { status: 429 });
        }

        const targetUrl = getFirecrawlBodyUrl(init);
        return jsonResponse({
          data: {
            markdown:
              firecrawlMarkdown ?? buildDefaultReviewBodyMarkdown(targetUrl),
            metadata: {
              sourceURL:
                targetUrl ?? 'https://www.g2.com/products/saaslaunch/reviews',
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

function installCompetitorSeedToolFetches(): {
  fetchMock: ReturnType<typeof vi.fn>;
  requestedUrls: string[];
} {
  const requestedUrls: string[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requestedUrls.push(url);

      if (url.includes('searchapi.io')) {
        const decodedUrl = decodeURIComponent(url);

        if (decodedUrl.includes('SaaSLaunch reviews complaints')) {
          return jsonResponse({ organic_results: [] });
        }

        return jsonResponse({
          organic_results: [
            {
              link: 'https://www.g2.com/products/pipelinepilot/reviews',
              snippet:
                'Users say handoffs and account follow-up still need manual cleanup.',
              title: 'PipelinePilot reviews on G2',
            },
            {
              link: 'https://www.capterra.com/p/pipelinepilot/reviews',
              snippet:
                'Teams complain that pipeline notes and CRM context are scattered.',
              title: 'PipelinePilot reviews on Capterra',
            },
            {
              link: 'https://www.trustpilot.com/review/pipelinepilot.example',
              snippet:
                'Reviewers mention missed handoffs and slow reporting setup.',
              title: 'PipelinePilot reviews on Trustpilot',
            },
          ],
        });
      }

      if (url.includes('api.search.brave.com')) {
        return jsonResponse({ web: { results: [] } });
      }

      if (url.includes('api.firecrawl.dev')) {
        const targetUrl = getFirecrawlBodyUrl(init);

        return jsonResponse({
          data: {
            markdown: buildDefaultReviewBodyMarkdown(targetUrl),
            metadata: {
              sourceURL:
                targetUrl ?? 'https://www.g2.com/products/pipelinepilot/reviews',
              title: 'Recovered PipelinePilot review',
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

function installWebSearchSnippetToolFetches(): {
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
        return jsonResponse({ organic_results: [] });
      }

      if (url.includes('api.search.brave.com')) {
        return jsonResponse({
          web: {
            results: [
              {
                description:
                  'Users say approvals feel manual and handoffs are missed when finance notes are scattered.',
                extra_snippets: [
                  'Reviewers mention slow support and confusing cleanup after card-policy exceptions.',
                ],
                title: 'Ramp reviews on G2',
                url: 'https://www.g2.com/products/ramp/reviews',
              },
              {
                description:
                  'Teams complain that receipt cleanup is slow and approval context gets scattered.',
                extra_snippets: [
                  'Operators report difficult month-end cleanup when spend requests are blocked.',
                ],
                title: 'Ramp reviews on Capterra',
                url: 'https://www.capterra.com/p/ramp/reviews',
              },
              {
                description:
                  'Customers say support delays make expense approval handoffs hard to trust.',
                extra_snippets: [
                  'Finance teams describe manual reconciliation pain after procurement changes.',
                ],
                title: 'Ramp discussion thread',
                url: 'https://www.reddit.com/r/accounting/comments/ramp-expense-review/',
              },
            ],
          },
        });
      }

      if (url.includes('api.firecrawl.dev')) {
        return jsonResponse({
          data: {
            markdown: '',
            metadata: {
              sourceURL: 'https://www.g2.com/products/ramp/reviews',
              title: 'Empty enrichment',
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
    let firstDraftPrompt = '';
    const budgetProbeOutputs: unknown[] = [];
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');
      expect(params.prompt).toContain('body.painLanguage.quotes[]');
      expect(params.prompt).toContain('Use at least 3 independent domains');
      expect(params.prompt).toContain('Align top-level sources');
      expect(params.prompt).toContain('g2.com');
      expect(params.prompt).toContain('capterra.com');
      expect(params.prompt).toContain('trustpilot.com');

      emitVoiceOfCustomerEvidenceStep(params);
      if (!checkedFirstDraft) {
        checkedFirstDraft = true;
        firstDraftPrompt = params.prompt;
        fetchCallsBeforeStructured = requestedUrls.length;
        expect(fetchCallsBeforeStructured).toBe(6);
        expect(requestedUrls[0]).toContain('searchapi.io');
        expect(requestedUrls.slice(1, 4)).toEqual(
          expect.arrayContaining([
            expect.stringContaining('api.firecrawl.dev'),
            expect.stringContaining('api.firecrawl.dev'),
            expect.stringContaining('api.firecrawl.dev'),
          ]),
        );
        expect(requestedUrls[4]).toContain('api.search.brave.com');
        expect(requestedUrls[5]).toContain('api.firecrawl.dev');
        expect(params.prompt).toContain('Recovered SaaSLaunch review');
        expect(params.prompt).toContain('Recovered third-party quote');

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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
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
    const reviewDiscoveryUrl = decodeURIComponent(requestedUrls[0] ?? '');

    expect(streamStructured).toHaveBeenCalled();
    expect(fetchCallsBeforeStructured).toBe(6);
    expect(reviewDiscoveryUrl).toContain('reviews complaints pain points');
    expect(reviewDiscoveryUrl).toContain('site:reddit.com');
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(4);
    expect(firstDraftPrompt).not.toContain(
      'Founder asks how to stop sales follow-up from disappearing after every pipeline review.',
    );
    expect(firstDraftPrompt).not.toContain(
      'Pipeline review snippets describe context loss between notes and CRM.',
    );
    expect(budgetProbeTypes).toEqual([
      'result',
      'result',
      'result',
      'result',
    ]);
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact when review-body scraping has no usable bodies', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installSuccessfulToolFetches({
      firecrawlMarkdown: '',
    });
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run from body-mode snippets.');
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: ['reviews', 'web_search', 'firecrawl'],
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const evidenceGapReport = result.artifact.body
      .evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(evidenceGapReport.acquisitionAttempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gapReason: 'empty_markdown',
          status: 'failed',
          url: expect.stringContaining('g2.com/products/saaslaunch/reviews'),
        }),
      ]),
    );
    expect(streamStructured).not.toHaveBeenCalled();
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(4);
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact when review-body scraping returns API gaps', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installSuccessfulToolFetches({
      firecrawlMode: 'api-error',
    });
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run after body scrape gaps.');
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: ['reviews', 'web_search', 'firecrawl'],
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );
    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(streamStructured).not.toHaveBeenCalled();
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(4);
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
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

  it('falls back to competitor-seed review bodies when audited-brand review discovery is empty', async (): Promise<void> => {
    const researchInput = researchInputSchema.parse({
      ...saaslaunchResearchInput,
      competitorSeeds: [{ name: 'PipelinePilot' }],
      runId: 'run_saaslaunch_competitor_voc_fixture',
    });
    const store = await makeStore(researchInput);
    const { requestedUrls } = installCompetitorSeedToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      const decodedSearches = requestedUrls
        .filter((url) => url.includes('searchapi.io'))
        .map((url) => decodeURIComponent(url));

      expect(decodedSearches).toHaveLength(2);
      expect(decodedSearches[0]).toContain('SaaSLaunch reviews complaints');
      expect(decodedSearches[1]).toContain('PipelinePilot reviews complaints');
      expect(params.prompt).toContain('PipelinePilot');
      expect(params.prompt).toContain('g2.com');
      expect(params.prompt).toContain('capterra.com');
      expect(params.prompt).toContain('trustpilot.com');

      emitVoiceOfCustomerEvidenceStep(params);
      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildVoiceOfCustomerDraft()),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: ['reviews', 'web_search', 'firecrawl'],
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(
      requestedUrls.filter((url) => url.includes('api.firecrawl.dev')),
    ).toHaveLength(3);
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).not.toBe(true);
  });

  it('promotes explicit independent buyer-language web snippets into the candidate pack', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installWebSearchSnippetToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Users say approvals feel manual');
      expect(params.prompt).toContain('Teams complain that receipt cleanup is slow');
      expect(params.prompt).toContain('Customers say support delays');
      expect(params.prompt).toContain('g2.com');
      expect(params.prompt).toContain('capterra.com');
      expect(params.prompt).toContain('reddit.com');

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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(requestedUrls.some((url) => url.includes('api.search.brave.com'))).toBe(
      true,
    );
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).not.toBe(true);
  });

  it('commits an evidence-gap artifact when Firecrawl cannot recover a strict candidate', async (): Promise<void> => {
    const store = await makeStore();
    const { requestedUrls } = installRecoveryToolFetches({
      firecrawlMarkdown: '',
    });
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run after recovery gap.');
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
    const validationEvent = record.events.find(
      (event) => event.type === 'validation-failed',
    );
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).not.toHaveBeenCalled();
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      reason: 'insufficient_voice_of_customer_sources',
      requiredDistinctPainSourceCount: 3,
      requiredPainQuoteCount: 10,
    });
    expect(requestedUrls.some((url) => url.includes('api.firecrawl.dev'))).toBe(
      true,
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'reason=no_review_or_forum_surfaces',
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact and skips the full structured draft when the prepass has a gap', async (): Promise<void> => {
    const store = await makeStore();
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not be called after VoC gap.');
    });

    const result = await runSection(
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
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationEvent = record.events.find(
      (event) => event.type === 'validation-failed',
    );
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).not.toHaveBeenCalled();
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      foundDistinctPainSourceCount: 0,
      foundPainQuoteCount: 0,
      reason: 'insufficient_voice_of_customer_sources',
    });
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
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact when structured synthesis times out after a valid candidate prepass', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.reject(
          new Error('Structured output timed out after 150000ms.'),
        ),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const validationEvent = record.events.find(
      (event) => event.type === 'validation-failed',
    );
    const evidenceGapReport = result.artifact.body
      .evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(evidenceGapReport).toMatchObject({
      foundDistinctPainSourceCount: 3,
      foundPainQuoteCount: 7,
      observedPainSourceDomains: [
        'g2.com',
        'capterra.com',
        'trustpilot.com',
      ],
      reason: 'insufficient_voice_of_customer_sources',
    });
    expect(evidenceGapReport.summary).toContain(
      'structured synthesis timed out',
    );
    expect(validationEvent?.metadata.issues.join('\n')).toContain(
      'Structured output timed out after 150000ms.',
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact when structured synthesis cannot produce a parseable object', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.reject(
          new Error('No object generated: response did not match schema.'),
        ),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const evidenceGapReport = result.artifact.body
      .evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(evidenceGapReport.summary).toContain(
      'failed to produce a parseable source-backed artifact',
    );
    expect(evidenceGapReport.summary).toContain(
      'No object generated: response did not match schema.',
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('repair-started');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits deterministic VoC synthesis when parseable-object generation fails after a dense candidate prepass', async (): Promise<void> => {
    const researchInput = makeDenseVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');
      expect(params.prompt).toContain('Dense candidate 1 says missed handoffs');

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.reject(
          new Error('No object generated: response did not match schema.'),
        ),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: [],
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(researchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);
    const quotes = body.painLanguage.quotes;

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(quotes).toHaveLength(10);
    expect(quotes[0]?.verbatimText).toContain('Dense candidate 1');
    expect(result.artifact.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining(quotes.map((quote) => quote.sourceUrl)),
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits deterministic VoC synthesis instead of a mixed full-quotes evidence-gap draft after a dense candidate prepass', async (): Promise<void> => {
    const researchInput = makeDenseVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(params.prompt).toContain('Voice of Customer Candidate Pack');
      expect(params.prompt).toContain('Dense candidate 1 says missed handoffs');
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildMixedEvidenceGapVoiceOfCustomerDraft()),
        partialOutputStream: emptyPartials(),
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: [],
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '3' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(researchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(body.painLanguage.quotes).toHaveLength(10);
    expect(body.painLanguage.quotes[0]?.sourceUrl).toContain('g2.com');
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits deterministic VoC synthesis on the answer-tool path when the model never calls answer after a dense candidate prepass', async (): Promise<void> => {
    const researchInput = makeDenseVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(params.instructions).toContain('Voice of Customer Candidate Pack');
      expect(params.instructions).toContain('Dense candidate 1 says missed handoffs');

      return {
        answerInput: undefined,
        steps: [],
        text: '',
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: [],
        env: {
          LAB_SECTION_STREAMING: 'false',
          LAB_VERIFIER_MAX_UNSUPPORTED: '3',
        },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        runAnswerTool,
        store,
      },
    );

    const record = await store.readRun(researchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(body.painLanguage.quotes).toHaveLength(10);
    expect(
      new Set(
        body.painLanguage.quotes.map((quote) => new URL(quote.sourceUrl).hostname),
      ),
    ).toEqual(new Set(['g2.com', 'reddit.com', 'capterra.com']));
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits deterministic VoC synthesis on the answer-tool path instead of a mixed full-quotes evidence-gap draft', async (): Promise<void> => {
    const researchInput = makeDenseVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(params.instructions).toContain('Voice of Customer Candidate Pack');
      expect(params.instructions).toContain('Dense candidate 1 says missed handoffs');

      return {
        answerInput: {
          ...buildMixedEvidenceGapVoiceOfCustomerDraft(),
          confidence: 0.82,
          sectionTitle: 'Voice of Customer',
        },
        steps: [],
        text: '',
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        allowedTools: [],
        env: {
          LAB_SECTION_STREAMING: 'false',
          LAB_VERIFIER_MAX_UNSUPPORTED: '3',
        },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        runAnswerTool,
        store,
      },
    );

    const record = await store.readRun(researchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(body.painLanguage.quotes).toHaveLength(10);
    expect(body.painLanguage.quotes[0]?.sourceUrl).toContain('g2.com');
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact after repairs when drafted VoC remains source-thin', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildThinVoiceOfCustomerDraft()),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '50' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).toHaveBeenCalledTimes(3);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      foundDistinctPainSourceCount: 2,
      foundPainQuoteCount: 6,
      observedPainSourceDomains: ['g2.com', 'reddit.com'],
      reason: 'insufficient_voice_of_customer_sources',
      requiredDistinctPainSourceCount: 3,
      requiredPainQuoteCount: 10,
    });
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact after repairs when drafted VoC has a single-source majority', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildSingleSourceMajorityVoiceOfCustomerDraft()),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '50' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).toHaveBeenCalledTimes(3);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      foundDistinctPainSourceCount: 3,
      foundPainQuoteCount: 10,
      observedPainSourceDomains: ['g2.com', 'reddit.com', 'trustpilot.com'],
      reason: 'insufficient_voice_of_customer_sources',
    });
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact after repairs when drafted VoC keeps an invalid quote source enum', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(
          buildVoiceOfCustomerDraftWithInvalidPainQuoteSource(),
        ),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '50' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).toHaveBeenCalledTimes(3);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      foundPainQuoteCount: 6,
      reason: 'insufficient_voice_of_customer_sources',
    });
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('commits an evidence-gap artifact after repairs when drafted VoC keeps blank quote metadata', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(
          buildVoiceOfCustomerDraftWithBlankPainQuoteMetadata(),
        ),
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
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: '50' },
        loadSkill: async () => 'Use deterministic VoC candidates.',
        now: () => new Date('2026-06-01T00:00:00.000Z'),
        store,
        streamStructured,
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).toHaveBeenCalledTimes(3);
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(result.artifact.body.evidenceGapReport).toMatchObject({
      foundPainQuoteCount: 6,
      reason: 'insufficient_voice_of_customer_sources',
    });
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });
});
