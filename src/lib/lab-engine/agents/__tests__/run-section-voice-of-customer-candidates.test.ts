import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ToolExecutionOptions } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function collectVoiceOfCustomerQuoteTexts(
  body: VoiceOfCustomerSectionOutput['body'],
): string[] {
  return [
    ...body.painLanguage.quotes.map((quote) => quote.verbatimText),
    ...body.objections.items.map((item) => item.objectionText),
    ...body.switchingStories.stories.map((story) => story.reasonToLeave),
    ...body.decisionCriteria.criteria.map((criterion) => criterion.evidenceQuote),
    ...body.successLanguage.quotes.map((quote) => quote.verbatimText),
  ];
}

function expectNoRepeatedVoiceOfCustomerQuote(
  body: VoiceOfCustomerSectionOutput['body'],
): void {
  const normalizedQuotes = collectVoiceOfCustomerQuoteTexts(body).map((quote) =>
    quote.replace(/\s+/g, ' ').trim().toLowerCase(),
  );

  expect(new Set(normalizedQuotes).size).toBe(normalizedQuotes.length);
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

// B1 dead zone (model path): 6 pain quotes across 3 independent domains —
// at the shared floor (VOC_MIN_QUOTES=6 / VOC_MIN_DOMAINS=3), not below it.
function buildSixQuoteThreeDomainVoiceOfCustomerDraft(): Omit<
  VoiceOfCustomerSectionOutput,
  'confidence' | 'sectionTitle'
> {
  const draft = buildVoiceOfCustomerDraft();
  const quoteUrls = [
    'https://g2.com/products/saaslaunch/reviews/1',
    'https://reddit.com/r/sales/comments/saaslaunch-2',
    'https://trustpilot.com/review/saaslaunch.example/3',
    'https://g2.com/products/saaslaunch/reviews/4',
    'https://reddit.com/r/sales/comments/saaslaunch-5',
    'https://trustpilot.com/review/saaslaunch.example/6',
  ];
  const quotes = draft.body.painLanguage.quotes
    .slice(0, 6)
    .map((quote, index) => ({
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

function denseVoiceOfCustomerSourceUrl({
  domain,
  index,
}: {
  domain: string;
  index: number;
}): string {
  if (domain === 'reddit.com') {
    return `https://www.reddit.com/r/sales/comments/saaslaunch_dense_${index + 1}/comment-${index + 1}`;
  }

  if (domain === 'news.ycombinator.com') {
    return `https://news.ycombinator.com/item?id=${42600 + index}`;
  }

  if (domain === 'capterra.com') {
    return `https://www.capterra.com/p/12345/saaslaunch/reviews/${index + 1}`;
  }

  if (domain === 'trustpilot.com') {
    return `https://www.trustpilot.com/reviews/0123456789abcdef${index
      .toString()
      .padStart(2, '0')}`;
  }

  return `https://${domain}/products/saaslaunch/reviews/${index + 1}`;
}

function makeVoiceOfCustomerCandidateResearchInput({
  domains,
  runId,
}: {
  domains: readonly string[];
  runId: string;
}): ResearchInput {
  const excerpts = domains.map((domain, index) => ({
    id: `excerpt_dense_voc_${index + 1}`,
    observedAt: '2026-06-01T00:00:00.000Z',
    sourceId: `source_dense_voc_${index + 1}`,
    sourceUrl: denseVoiceOfCustomerSourceUrl({ domain, index }),
    text: `Dense candidate ${index + 1} says missed handoffs happen when our account context is scattered, and after we rebuilt the weekly loop our team knows which account action matters next.`,
    title:
      domain === 'reddit.com' || domain === 'news.ycombinator.com'
        ? `Dense forum candidate ${index + 1}`
        : `Dense review candidate ${index + 1}`,
  }));

  return researchInputSchema.parse({
    ...saaslaunchResearchInput,
    runId,
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
        positioningPaidMediaPlan: [],
      },
    },
  });
}

function makeDenseVoiceOfCustomerResearchInput(): ResearchInput {
  return makeVoiceOfCustomerCandidateResearchInput({
    domains: [
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
    ],
    runId: 'run_saaslaunch_dense_voc_fixture',
  });
}

// B1 dead zone: exactly the prepass admission floor — 6 candidates across
// 3 independent domains (2 per domain, so no single-source majority).
function makeDeadZoneVoiceOfCustomerResearchInput(): ResearchInput {
  return makeVoiceOfCustomerCandidateResearchInput({
    domains: [
      'g2.com',
      'g2.com',
      'reddit.com',
      'reddit.com',
      'capterra.com',
      'capterra.com',
    ],
    runId: 'run_saaslaunch_dead_zone_voc_fixture',
  });
}

function makeUnderFloorVoiceOfCustomerResearchInput(): ResearchInput {
  return makeVoiceOfCustomerCandidateResearchInput({
    domains: [
      'capterra.com',
      'capterra.com',
      'capterra.com',
      'trustpilot.com',
      'trustpilot.com',
    ],
    runId: 'run_saaslaunch_under_floor_voc_fixture',
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

async function sourceLivenessUnavailableFetch(): Promise<Response> {
  throw new Error('source liveness network unavailable in test');
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
      'Recovered third-party quote: We keep waiting on support while handoffs are missed because account context is scattered across sales tools.',
      'Date of experience: May 20, 2026',
      'Rated 3 out of 5 stars',
      'Recovered third-party quote: Our team finds the platform hard to trust when billing handoffs and CRM cleanup still feel manual.',
      'Date of experience: May 21, 2026',
    ].join('\n');
  }

  if (targetUrl?.includes('capterra.com')) {
    return [
      '# SaaSLaunch review',
      '',
      'Cons: Our team still has account research and next steps scattered across notes, creating missed sales handoffs and manual CRM cleanup.',
      '',
      'Cons: We find reporting setup confusing and expensive when pipeline notes need manual cleanup.',
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
              link: 'https://www.g2.com/products/saaslaunch/reviews/saaslaunch-review-1',
              snippet:
                'Users say pipeline follow-up still falls through the cracks without a weekly operating loop.',
            },
            {
              link: 'https://www.capterra.com/p/saaslaunch/reviews/1769670/',
              snippet:
                'Teams complain that account research and next steps stay scattered across notes.',
            },
            {
              link: 'https://www.trustpilot.com/reviews/0123456789abcdef01',
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

      return sourceLivenessUnavailableFetch();
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave');
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');

  return { fetchMock, requestedUrls };
}

function installExpandedReviewBodyFetches(): {
  firecrawlTargetUrls: string[];
  fetchMock: ReturnType<typeof vi.fn>;
  requestedUrls: string[];
} {
  const firecrawlTargetUrls: string[] = [];
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
              link: 'https://www.g2.com/products/saaslaunch/reviews/saaslaunch-review-1',
              snippet: 'Users mention approval handoff pain.',
              title: 'SaaSLaunch reviews on G2',
            },
            {
              link: 'https://www.capterra.com/p/saaslaunch/reviews/1769670/',
              snippet: 'Teams complain about scattered account notes.',
              title: 'SaaSLaunch reviews on Capterra',
            },
            {
              link: 'https://www.trustpilot.com/reviews/0123456789abcdef01',
              snippet: 'Reviewers mention manual CRM cleanup.',
              title: 'SaaSLaunch reviews on Trustpilot',
            },
            {
              link: 'https://www.getapp.com/sales-software/a/saaslaunch/reviews/1769671/',
              snippet: 'Operators report missed sales handoffs.',
              title: 'SaaSLaunch reviews on GetApp',
            },
            {
              link: 'https://www.softwareadvice.com/crm/saaslaunch-profile/reviews/1769672/',
              snippet: 'Buyers describe slow support cleanup.',
              title: 'SaaSLaunch reviews on Software Advice',
            },
          ],
        });
      }

      if (url.includes('api.search.brave.com')) {
        return jsonResponse({ web: { results: [] } });
      }

      if (url.includes('api.firecrawl.dev')) {
        const targetUrl = getFirecrawlBodyUrl(init);
        if (targetUrl !== null) {
          firecrawlTargetUrls.push(targetUrl);
        }

        return jsonResponse({
          data: {
            markdown: buildDefaultReviewBodyMarkdown(targetUrl),
            metadata: {
              sourceURL:
                targetUrl ?? 'https://www.g2.com/products/saaslaunch/reviews',
              title: 'Recovered SaaSLaunch review',
            },
          },
        });
      }

      return sourceLivenessUnavailableFetch();
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave');
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');

  return { firecrawlTargetUrls, fetchMock, requestedUrls };
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

      return sourceLivenessUnavailableFetch();
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

        // The subject brand has NO review discovery on ANY of the three
        // subject-scoped query variants (name / "name reviews" /
        // "name complaints") [B1]; only a competitor-seeded query would hit
        // the PipelinePilot results below.
        if (decodedUrl.includes('SaaSLaunch')) {
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

      return sourceLivenessUnavailableFetch();
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
                url: 'https://www.g2.com/products/ramp/reviews/ramp-review-1',
              },
              {
                description:
                  'Teams complain that receipt cleanup is slow and approval context gets scattered.',
                extra_snippets: [
                  'Operators report difficult month-end cleanup when spend requests are blocked.',
                ],
                title: 'Ramp reviews on Capterra',
                url: 'https://www.capterra.com/p/ramp/reviews/1769670/',
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

      return sourceLivenessUnavailableFetch();
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SEARCHAPI_KEY', 'test-searchapi');
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave');
  vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');

  return { fetchMock, requestedUrls };
}

describe('runSection VoC candidate prepass', (): void => {
  beforeEach((): void => {
    vi.stubGlobal('fetch', sourceLivenessUnavailableFetch);
  });

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
        // web_search now attempts Firecrawl /v2/search first (one extra fetch)
        // before falling back to Brave [A1]; Wave 6 adds the subject-site
        // observation prepass fetch before drafting.
        expect(fetchCallsBeforeStructured).toBe(8);
        expect(requestedUrls[0]).toContain('searchapi.io');
        expect(requestedUrls.slice(1, 4)).toEqual(
          expect.arrayContaining([
            expect.stringContaining('api.firecrawl.dev'),
            expect.stringContaining('api.firecrawl.dev'),
            expect.stringContaining('api.firecrawl.dev'),
          ]),
        );
        expect(requestedUrls[4]).toContain('api.firecrawl.dev/v2/search');
        expect(requestedUrls[5]).toContain('api.search.brave.com');
        expect(requestedUrls[6]).toContain('api.firecrawl.dev');
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
          ]).then(() => buildVoiceOfCustomerDraft()),
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
    const reviewDiscoveryUrl = decodeURIComponent(requestedUrls[0] ?? '');

    expect(streamStructured).toHaveBeenCalled();
    expect(fetchCallsBeforeStructured).toBe(8);
    expect(reviewDiscoveryUrl).toContain('reviews complaints pain points');
    expect(reviewDiscoveryUrl).toContain('site:reddit.com');
    // Prepass firecrawl fetches (3 review scrapes + 1 /v2/search probe +
    // 1 URL-only recovery); budget probes now satisfy from Brave results.
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(5);
    expect(firstDraftPrompt).not.toContain(
      'Founder asks how to stop sales follow-up from disappearing after every pipeline review.',
    );
    expect(firstDraftPrompt).not.toContain(
      'Pipeline review snippets describe context loss between notes and CRM.',
    );
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('requests expanded review-body scraping during the candidate prepass', async (): Promise<void> => {
    const store = await makeStore();
    const { firecrawlTargetUrls } = installExpandedReviewBodyFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      expect(firecrawlTargetUrls).toEqual(
        expect.arrayContaining([
          'https://www.g2.com/products/saaslaunch/reviews/saaslaunch-review-1',
          'https://www.capterra.com/p/saaslaunch/reviews/1769670/',
          'https://www.trustpilot.com/reviews/0123456789abcdef01',
          'https://www.getapp.com/sales-software/a/saaslaunch/reviews/1769671/',
          'https://www.softwareadvice.com/crm/saaslaunch-profile/reviews/1769672/',
        ]),
      );
      expect(params.prompt).toContain('getapp.com');
      expect(params.prompt).toContain('softwareadvice.com');
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

    expect(streamStructured).toHaveBeenCalled();
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
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
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(body.painLanguage.quotes).toEqual([]);
    expect(body.retrievalSummary).toContain(
      'Evidence gap: independent Voice of Customer acquisition did not meet the committed evidence bar.',
    );
    expect(body.painLanguage.blockGap?.summary).toBe(
      'No pain-language quotes were promoted because independent VoC sourcing did not clear the quote floor.',
    );
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
    // Firecrawl accounting [B1]: when review bodies yield no candidates, the
    // prepass retries all 3 subject-brand review queries (name / "name
    // reviews" / "name complaints") at 3 body scrapes each = 9, + 1 web_search
    // /v2/search probe before the Brave fallback [A1] + 1 URL-only recovery.
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(11);
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
    const evidenceGapReport = result.artifact.body
      .evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).toBe(true);
    expect(evidenceGapReport.acquisitionLedger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parserStatus: 'not_attempted',
          promotionStatus: 'not_applicable',
          query: 'SaaSLaunch AI-native GTM operations',
          rejectionReason: 'api_error',
          scrapeStatus: 'failed',
          sourceUrl: expect.stringContaining('g2.com/products/saaslaunch/reviews'),
          toolGapReason: 'api_error',
        }),
      ]),
    );
    // Wave 2B: sufficiency is computed deterministically from the ledger above.
    // Every scrape failed, so no candidate was promoted -> honest "insufficient".
    expect(evidenceGapReport.sufficiency).toEqual({
      tier: 'insufficient',
      rationale: expect.any(String),
      candidatesFound: 0,
      promoted: 0,
      rejected: 0,
    });
    expect(streamStructured).not.toHaveBeenCalled();
    // Firecrawl accounting [B1]: when review bodies yield no candidates, the
    // prepass retries all 3 subject-brand review queries (name / "name
    // reviews" / "name complaints") at 3 body scrapes each = 9, + 1 web_search
    // /v2/search probe before the Brave fallback [A1] + 1 URL-only recovery.
    expect(requestedUrls.filter((url) => url.includes('api.firecrawl.dev'))).toHaveLength(11);
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

  // T4a / W2.4: VoC must reflect the SUBJECT's buyer voice only. The review
  // prepass no longer queries competitorSeeds (that pulled competitor reviews —
  // e.g. Brex/Tipalti reviews polluting Ramp's VoC). When the audited brand has
  // no review discovery, VoC commits an evidence gap instead of falling back to
  // competitor reviews.
  it('does NOT query competitor seeds in the review prepass (de-contamination)', async (): Promise<void> => {
    const researchInput = researchInputSchema.parse({
      ...saaslaunchResearchInput,
      competitorSeeds: [{ name: 'PipelinePilot' }],
      runId: 'run_saaslaunch_competitor_voc_fixture',
    });
    const store = await makeStore(researchInput);
    const { requestedUrls } = installCompetitorSeedToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
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

    const decodedSearches = requestedUrls
      .filter((url) => url.includes('searchapi.io'))
      .map((url) => decodeURIComponent(url));

    // Only the three subject-brand review query variants [B1] — NO
    // PipelinePilot competitor query. Every variant carries the category
    // disambiguator (homonym guard: bare "Anura" surfaced the film "Anora").
    expect(decodedSearches).toHaveLength(3);
    decodedSearches.forEach((query) => {
      expect(query).toContain('SaaSLaunch AI-native GTM operations');
    });
    expect(decodedSearches[0]).toContain(
      'SaaSLaunch AI-native GTM operations reviews complaints',
    );
    expect(decodedSearches[1]).toContain(
      'SaaSLaunch AI-native GTM operations reviews',
    );
    expect(decodedSearches[2]).toContain(
      'SaaSLaunch AI-native GTM operations complaints',
    );
    expect(
      decodedSearches.some((query) => query.includes('PipelinePilot')),
    ).toBe(false);

    // With no subject reviews and no competitor fallback, VoC commits an
    // evidence gap rather than promoting competitor voice as the buyer's.
    expect(result.artifact.sectionId).toBe('positioningVoiceOfCustomer');
    expect(result.artifact.body.evidenceGap).toBe(true);
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
      requiredPainQuoteCount: 6,
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

  it('commits deterministic VoC evidence when structured synthesis times out after a floor-clearing candidate prepass', async (): Promise<void> => {
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
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(streamStructured).toHaveBeenCalledTimes(1);
    // Structured synthesis timed out, but the candidate prepass cleared the pain
    // floor (6 snippets / 3 domains), so the deterministic fallback now commits
    // real disjoint VoC evidence instead of collapsing to an evidence-gap shell.
    expect(body.evidenceGap).not.toBe(true);
    expect(collectVoiceOfCustomerQuoteTexts(body).length).toBeGreaterThanOrEqual(6);
    expectNoRepeatedVoiceOfCustomerQuote(body);
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

  it('commits deterministic VoC evidence when structured synthesis cannot produce a parseable object after a floor-clearing prepass', async (): Promise<void> => {
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
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    expect(streamStructured).toHaveBeenCalledTimes(1);
    // Parseable-object generation failed, but the candidate prepass cleared the
    // floor, so the deterministic fallback now commits real disjoint VoC
    // evidence.
    expect(body.evidenceGap).not.toBe(true);
    expect(collectVoiceOfCustomerQuoteTexts(body).length).toBeGreaterThanOrEqual(6);
    expectNoRepeatedVoiceOfCustomerQuote(body);
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
    const quotes = collectVoiceOfCustomerQuoteTexts(body);

    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(quotes).toHaveLength(10);
    expect(quotes[0]).toContain('Dense candidate 1');
    expectNoRepeatedVoiceOfCustomerQuote(body);
    expect(result.artifact.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining(
        [
          ...body.painLanguage.quotes.map((quote) => quote.sourceUrl),
          ...body.objections.items.map((item) => item.sourceUrl),
          ...body.switchingStories.stories.map((story) => story.sourceUrl),
          ...body.decisionCriteria.criteria.map((criterion) => criterion.sourceUrl),
          ...body.successLanguage.quotes.map((quote) => quote.sourceUrl),
        ],
      ),
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  // WP6 evidence-floor honesty: under-floor packs still ship usable candidates
  // under an explicit shortfall note instead of committing an empty section.
  it('ships under-floor VoC quote candidates with an honest shortfall note', async (): Promise<void> => {
    const researchInput = makeUnderFloorVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run for an under-floor prepass.');
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
    const evidenceGapReport =
      body.evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(streamStructured).not.toHaveBeenCalled();
    expect(body.evidenceGap).toBe(true);
    expect(body.painLanguage.quotes).toHaveLength(5);
    const expectedQuoteUrls = (
      researchInput.corpus.sectionExcerpts?.positioningVoiceOfCustomer ?? []
    ).map((excerpt) => excerpt.sourceUrl.replace('https://www.', 'https://'));
    expect(body.painLanguage.quotes.map((quote) => quote.sourceUrl)).toEqual(
      expect.arrayContaining(expectedQuoteUrls),
    );
    expect(body.retrievalSummary).toContain(
      'We collected 5 directional quotes across 2 independent source sites that lack per-review permalinks, so they read as directional buyer signal, not independently confirmed VoC.',
    );
    expect(body.retrievalSummary).toContain(
      'That is below our bar of 6 quotes across 3 sites, so treat the themes as directional.',
    );
    expect(body.painLanguage.blockGap?.summary).toContain(
      'treat the themes as directional',
    );
    expect(body.objections.items).toHaveLength(0);
    expect(body.switchingStories.stories).toHaveLength(0);
    expect(body.decisionCriteria.criteria).toHaveLength(0);
    expect(body.objections.blockGap).toBeDefined();
    expect(body.switchingStories.blockGap).toBeDefined();
    expect(body.decisionCriteria.blockGap).toBeDefined();
    expect(evidenceGapReport).toMatchObject({
      foundDistinctPainSourceCount: 2,
      foundPainQuoteCount: 5,
      observedPainSourceDomains: ['capterra.com', 'trustpilot.com'],
      reason: 'insufficient_voice_of_customer_sources',
    });
    expect(result.artifact.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining(
        body.painLanguage.quotes.map((quote) => quote.sourceUrl),
      ),
    );
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
  });

  // B1 dead-zone regression (deterministic path): the prepass admits packs at
  // >=6 candidates, and synthesis + the schema validator now share that same
  // floor (VOC_MIN_QUOTES=6). Before the shared floor, a 6-candidate pack
  // passed the prepass but synthesis (>=10) and the schema (>=10) rejected it,
  // committing an EMPTY VoC despite real quotes (live run f06333b6).
  it('commits a NON-EMPTY deterministic VoC section from a 6-candidate 3-domain pack (dead-zone regression)', async (): Promise<void> => {
    const researchInput = makeDeadZoneVoiceOfCustomerResearchInput();
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>(() => ({
      consumeStream: () => Promise.resolve(),
      output: Promise.reject(
        new Error('No object generated: response did not match schema.'),
      ),
      partialOutputStream: emptyPartials(),
    }));

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

    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(collectVoiceOfCustomerQuoteTexts(body)).toHaveLength(6);
    expectNoRepeatedVoiceOfCustomerQuote(body);
    expect(
      new Set(
        [
          ...body.painLanguage.quotes.map((quote) => quote.sourceUrl),
          ...body.objections.items.map((item) => item.sourceUrl),
          ...body.switchingStories.stories.map((story) => story.sourceUrl),
          ...body.decisionCriteria.criteria.map((criterion) => criterion.sourceUrl),
          ...body.successLanguage.quotes.map((quote) => quote.sourceUrl),
        ].map((sourceUrl) => new URL(sourceUrl).hostname),
      ),
    ).toEqual(new Set(['g2.com', 'reddit.com', 'capterra.com']));
    expect(eventTypes).toContain('artifact-saved');
    expect(eventTypes).toContain('section-completed');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  // B1 dead-zone regression (model path): a model draft with 6 real quotes
  // across 3 domains must commit as-is instead of degrading to the empty
  // evidence-gap artifact via the old >=10 schema floor.
  it('commits a model draft with 6 pain quotes across 3 domains without an evidence gap (dead-zone regression)', async (): Promise<void> => {
    const store = await makeStore();
    installSuccessfulToolFetches();
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitVoiceOfCustomerEvidenceStep(params);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(buildSixQuoteThreeDomainVoiceOfCustomerDraft()),
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
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);

    // The fixture draft cites URLs the evidence step never observed, leaving
    // > 6 unsupported load-bearing claims — the finite repair trigger spends
    // both bounded grounding repairs (1 initial + 2) before committing the
    // best attempt. The dead-zone contract under test is unchanged: 6 quotes
    // across 3 domains commit WITHOUT an evidence gap.
    expect(streamStructured).toHaveBeenCalledTimes(3);
    expect(body.evidenceGap).not.toBe(true);
    expect(body.evidenceGapReport).toBeUndefined();
    expect(body.painLanguage.quotes).toHaveLength(6);
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
    expect(collectVoiceOfCustomerQuoteTexts(body)).toHaveLength(10);
    expectNoRepeatedVoiceOfCustomerQuote(body);
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
    expect(collectVoiceOfCustomerQuoteTexts(body)).toHaveLength(10);
    expectNoRepeatedVoiceOfCustomerQuote(body);
    expect(
      new Set(
        [
          ...body.painLanguage.quotes.map((quote) => quote.sourceUrl),
          ...body.objections.items.map((item) => item.sourceUrl),
          ...body.switchingStories.stories.map((story) => story.sourceUrl),
          ...body.decisionCriteria.criteria.map((criterion) => criterion.sourceUrl),
          ...body.successLanguage.quotes.map((quote) => quote.sourceUrl),
        ].map((sourceUrl) => new URL(sourceUrl).hostname),
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
    expect(collectVoiceOfCustomerQuoteTexts(body)).toHaveLength(10);
    expectNoRepeatedVoiceOfCustomerQuote(body);
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
      // B1 shared floor: 6 quotes now suffice — this draft still gaps on
      // domains (2 < VOC_MIN_DOMAINS), not on quote count.
      requiredPainQuoteCount: 6,
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

  // P1: VoC gap-path quote dedupe. The Ramp run (d2abf018) duplicated 2 G2
  // review URLs 3x each across cross-pass merges, producing 6-over-2 quote
  // padding and noFabrication=false. getAdmissibleVoiceOfCustomerCandidates
  // filtered admissible candidates but did NOT dedupe on the same key the
  // selection track uses (sourceInstanceId ?? url). This test feeds 6 excerpts
  // at 2 distinct G2 URLs (each URL repeated 3x) and asserts the committed pain
  // quotes are deduped to 2 and evidenceGapReport.foundPainQuoteCount is 2.
  // RED on HEAD (no dedupe -> 6 quotes, foundPainQuoteCount 6) -> green after.
  it('deduplicates VoC gap-path quotes on sourceInstanceId ?? url across repeated passes', async (): Promise<void> => {
    const g2Url1 = 'https://www.g2.com/products/saaslaunch/reviews/12943564';
    const g2Url2 = 'https://www.g2.com/products/saaslaunch/reviews/12922111';
    const expectedNormalizedUrl1 = 'https://g2.com/products/saaslaunch/reviews/12943564';
    const expectedNormalizedUrl2 = 'https://g2.com/products/saaslaunch/reviews/12922111';
    const repeatedUrls = [g2Url1, g2Url2, g2Url1, g2Url2, g2Url1, g2Url2];
    const excerpts = repeatedUrls.map((sourceUrl, index) => ({
      id: `excerpt_dup_voc_${index + 1}`,
      observedAt: '2026-06-01T00:00:00.000Z',
      sourceId: `source_dup_voc_${index + 1}`,
      sourceUrl,
      text: `Pain candidate ${index + 1} says missed handoffs happen when our account context is scattered and CRM cleanup is manual.`,
      title: `Duplicate G2 candidate ${index + 1}`,
    }));
    const researchInput = researchInputSchema.parse({
      ...saaslaunchResearchInput,
      runId: 'run_saaslaunch_dup_voc_fixture',
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
          positioningPaidMediaPlan: [],
        },
      },
    });
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run for a gap-path dedupe test.');
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
    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);
    const evidenceGapReport =
      body.evidenceGapReport as VoiceOfCustomerEvidenceGapReport;

    expect(streamStructured).not.toHaveBeenCalled();
    expect(body.evidenceGap).toBe(true);
    // P1: 6 excerpts at 2 distinct URLs must dedupe to 2 committed pain quotes.
    expect(body.painLanguage.quotes).toHaveLength(2);
    // The 2 distinct URLs must be exactly the 2 promoted (normalized: www. stripped).
    expect(body.painLanguage.quotes.map((quote) => quote.sourceUrl).sort()).toEqual(
      [expectedNormalizedUrl1, expectedNormalizedUrl2].sort(),
    );
    expect(body.painLanguage.blockGap?.foundCount).toBe(2);
    expect(evidenceGapReport.foundPainQuoteCount).toBe(2);
    expect(evidenceGapReport.observedPainSourceDomains).toEqual(['g2.com']);
    expect(
      evidenceGapReport.acquisitionLedger?.filter(
        (row) => row.promotionStatus === 'promoted',
      ),
    ).toHaveLength(2);
    expect(evidenceGapReport.sufficiency).toMatchObject({
      promoted: 2,
      tier: 'partial',
    });
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe(
      'completed',
    );
  });

  it('counts only surfaced pain quotes in VoC gap metadata and sources', async (): Promise<void> => {
    const painUrl1 = 'https://www.g2.com/survey_responses/ramp-review-12943564';
    const painUrl2 = 'https://www.g2.com/survey_responses/ramp-review-12922111';
    const afterStateUrl = 'https://www.g2.com/sellers/ramp-financial';
    const expectedPainUrl1 =
      'https://g2.com/survey_responses/ramp-review-12943564';
    const expectedPainUrl2 =
      'https://g2.com/survey_responses/ramp-review-12922111';
    const expectedAfterStateUrl = 'https://g2.com/sellers/ramp-financial';
    const excerpts = [
      {
        id: 'excerpt_voc_pain_1',
        observedAt: '2026-06-01T00:00:00.000Z',
        sourceId: 'source_voc_pain_1',
        sourceUrl: painUrl1,
        text: 'Though Ramp integrates with many accounting software brands, it does not connect with ours. We still have to download a spreadsheet.',
        title: 'Ramp G2 review 12943564',
      },
      {
        id: 'excerpt_voc_pain_2',
        observedAt: '2026-06-01T00:00:00.000Z',
        sourceId: 'source_voc_pain_2',
        sourceUrl: painUrl2,
        text: 'The lack of banking integration with Campfire has been a bit of a bummer. I would like to give HR partial access to certain spend programs, but that limited-access permission setup does not seem to exist yet.',
        title: 'Ramp G2 review 12922111',
      },
      {
        id: 'excerpt_voc_after_state',
        observedAt: '2026-06-01T00:00:00.000Z',
        sourceId: 'source_voc_after_state',
        sourceUrl: afterStateUrl,
        text: 'Real-time spend visibility and control: Ramp makes it very easy to see where company money is going, with instant transaction tracking and strong controls like spend limits and automated approvals. This helps teams avoid overspending and keeps finance teams in control without slowing people down.',
        title: 'Ramp G2 seller profile',
      },
    ];
    const researchInput = researchInputSchema.parse({
      ...saaslaunchResearchInput,
      runId: 'run_saaslaunch_voc_pain_count_fixture',
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
          positioningPaidMediaPlan: [],
        },
      },
    });
    const store = await makeStore(researchInput);
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error('Structured draft should not run for a gap-path count test.');
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

    const body = voiceOfCustomerBodySchema.parse(result.artifact.body);
    const evidenceGapReport =
      body.evidenceGapReport as VoiceOfCustomerEvidenceGapReport;
    const sourceUrls = result.artifact.sources.map((source) => source.url);

    expect(streamStructured).not.toHaveBeenCalled();
    expect(body.evidenceGap).toBe(true);
    expect(body.painLanguage.quotes).toHaveLength(2);
    expect(body.painLanguage.quotes.map((quote) => quote.sourceUrl).sort()).toEqual(
      [expectedPainUrl1, expectedPainUrl2].sort(),
    );
    expect(body.painLanguage.blockGap?.foundCount).toBe(2);
    expect(body.painLanguage.blockGap?.summary).toContain('2 directional quotes');
    expect(evidenceGapReport.foundPainQuoteCount).toBe(2);
    expect(evidenceGapReport.foundDistinctPainSourceCount).toBe(1);
    expect(evidenceGapReport.summary).toContain('2 directional quotes');
    expect(evidenceGapReport.observedPainSourceDomains).toEqual(['g2.com']);
    expect(result.artifact.statusSummary).toContain('Surfaced 2 real pain extracts');
    expect(result.artifact.statusSummary).toContain('review-page permalinks');
    expect(result.artifact.verdict).not.toContain('without per-review permalinks');
    expect(result.artifact.statusSummary).not.toContain('lacking per-review permalinks');
    expect(sourceUrls).toContain(expectedPainUrl1);
    expect(sourceUrls).toContain(expectedPainUrl2);
    expect(sourceUrls).not.toContain(expectedAfterStateUrl);
  });
});
