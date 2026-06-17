import { describe, expect, it } from 'vitest';

import {
  artifactEnvelopeSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  checkVoiceOfCustomerSelfSourcing,
  validateVoiceOfCustomerMinimums,
  voiceOfCustomerBodySchema,
  type VoiceOfCustomerArtifact,
  type VoiceOfCustomerSectionOutput,
} from '@/lib/lab-engine/artifacts/schemas/voice-of-customer';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import {
  createVoiceOfCustomerCandidate,
  type VoiceOfCustomerAcquisitionMode,
  type VoiceOfCustomerCandidate,
  type VoiceOfCustomerCandidatePack,
  type VoiceOfCustomerEvidenceKind,
} from '../voice-of-customer-candidates';
import { synthesizeVoiceOfCustomerFromCandidates } from '../voice-of-customer-synthesis';

function acquisitionModeForKind(
  evidenceKind: VoiceOfCustomerEvidenceKind,
): VoiceOfCustomerAcquisitionMode {
  if (evidenceKind === 'review') return 'review_body';
  if (evidenceKind === 'forum') return 'forum_comment';
  return 'support_thread';
}

function makeCandidate({
  domain,
  evidenceKind,
  index,
  snippet,
}: {
  domain: string;
  evidenceKind: VoiceOfCustomerEvidenceKind;
  index: number;
  snippet?: string;
}): VoiceOfCustomerCandidate {
  const candidate = createVoiceOfCustomerCandidate({
    acquisitionMode: acquisitionModeForKind(evidenceKind),
    auditedCompanyDomain: saaslaunchResearchInput.company.websiteUrl,
    evidenceKind,
    snippet:
      snippet ??
      `Dense candidate ${index} says missed handoffs create urgent account-follow-up pain, and after rebuilding the weekly loop the team knows which account action matters next.`,
    source: evidenceKind === 'review' ? 'reviews' : 'web_search',
    title: `Dense candidate ${index}`,
    url: `https://${domain}/voc/dense-${index}`,
  });

  if (candidate === null) {
    throw new Error(`Expected valid candidate ${index} for ${domain}`);
  }

  return candidate;
}

function makeCandidatePack(
  domainPlan: ReadonlyArray<{
    domain: string;
    evidenceKind: VoiceOfCustomerEvidenceKind;
  }>,
): VoiceOfCustomerCandidatePack {
  const candidates = domainPlan.map((entry, index) =>
    makeCandidate({
      domain: entry.domain,
      evidenceKind: entry.evidenceKind,
      index: index + 1,
    }),
  );

  return {
    candidates,
    domains: Array.from(new Set(candidates.map((candidate) => candidate.domain))),
  };
}

function makeValidCandidatePack(): VoiceOfCustomerCandidatePack {
  return makeCandidatePack([
    { domain: 'g2.com', evidenceKind: 'review' },
    { domain: 'g2.com', evidenceKind: 'review' },
    { domain: 'g2.com', evidenceKind: 'review' },
    { domain: 'g2.com', evidenceKind: 'review' },
    { domain: 'reddit.com', evidenceKind: 'forum' },
    { domain: 'reddit.com', evidenceKind: 'forum' },
    { domain: 'reddit.com', evidenceKind: 'forum' },
    { domain: 'capterra.com', evidenceKind: 'review' },
    { domain: 'capterra.com', evidenceKind: 'review' },
    { domain: 'capterra.com', evidenceKind: 'review' },
  ]);
}

function makeLiveLikeCandidatePack(): VoiceOfCustomerCandidatePack {
  const plan: Array<{
    domain: string;
    evidenceKind: VoiceOfCustomerEvidenceKind;
    snippet: string;
  }> = [
    {
      domain: 'g2.com',
      evidenceKind: 'review',
      snippet:
        'Buyer review says approvals used to be slow, but it takes literally seconds to approve spend and issue cards instantly.',
    },
    {
      domain: 'g2.com',
      evidenceKind: 'review',
      snippet:
        'Finance user says manual expense follow-up was painful, but Ramp helps keep spending under control by surfacing duplicate subscriptions.',
    },
    {
      domain: 'g2.com',
      evidenceKind: 'review',
      snippet:
        'Reviewer says approval cleanup was hard, but the platform is easy to use and gives real-time visibility into spend.',
    },
    {
      domain: 'g2.com',
      evidenceKind: 'review',
      snippet:
        'Admin says card management created support friction, but virtual cards are simple to create, revoke, and monitor.',
    },
    {
      domain: 'trustpilot.com',
      evidenceKind: 'review',
      snippet:
        'Customer says expense approvals created delays, but fast approval flows make spend easier to manage for small teams.',
    },
    {
      domain: 'trustpilot.com',
      evidenceKind: 'review',
      snippet:
        'Reviewer says onboarding support was disappointing and created avoidable implementation friction.',
    },
    {
      domain: 'apify.com',
      evidenceKind: 'support-thread',
      snippet:
        'Operator says high-volume approvals become blocked when batch actions are missing from the spend workflow.',
    },
    {
      domain: 'apify.com',
      evidenceKind: 'support-thread',
      snippet:
        'Finance team says sudden credit limit changes create trust problems and budget planning anxiety.',
    },
    {
      domain: 'creatoreconomy.so',
      evidenceKind: 'support-thread',
      snippet:
        'Founder says scattered subscription spend makes it difficult to catch duplicated tools before renewal.',
    },
    {
      domain: 'creatoreconomy.so',
      evidenceKind: 'support-thread',
      snippet:
        'Buyer says invoice matching still creates manual cleanup when AP workflows do not connect to card spend.',
    },
  ];
  const candidates = plan.map((entry, index) =>
    makeCandidate({
      domain: entry.domain,
      evidenceKind: entry.evidenceKind,
      index: index + 1,
      snippet: entry.snippet,
    }),
  );

  return {
    candidates,
    domains: Array.from(new Set(candidates.map((candidate) => candidate.domain))),
  };
}

function buildArtifact(
  output: VoiceOfCustomerSectionOutput,
  researchInput: ResearchInput,
): VoiceOfCustomerArtifact {
  return artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .parse({
      id: 'art_synthesized_voc',
      runId: researchInput.runId,
      sectionId: 'positioningVoiceOfCustomer',
      sectionTitle: output.sectionTitle,
      verdict: output.verdict,
      statusSummary: output.statusSummary,
      confidence: output.confidence,
      sources: output.sources.map((source, index) => ({
        id: `src_synthesized_voc_${index + 1}`,
        observedAt: '2026-06-05T00:00:00.000Z',
        title: source.title,
        url: source.url,
        ...(source.publisher === undefined ? {} : { publisher: source.publisher }),
      })),
      body: output.body,
      createdAt: '2026-06-05T00:00:00.000Z',
    }) as VoiceOfCustomerArtifact;
}

const normalizeVerbatim = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

// Every verbatim quote string a block can carry, keyed by block name.
function quotesByBlock(
  body: VoiceOfCustomerSectionOutput['body'],
): Record<string, string[]> {
  return {
    painLanguage: body.painLanguage.quotes.map((quote) => quote.verbatimText),
    objections: body.objections.items.map((item) => item.objectionText),
    switchingStories: body.switchingStories.stories.map(
      (story) => story.reasonToLeave,
    ),
    decisionCriteria: body.decisionCriteria.criteria.map(
      (criterion) => criterion.evidenceQuote,
    ),
    successLanguage: body.successLanguage.quotes.map(
      (quote) => quote.verbatimText,
    ),
  };
}

// Maps each normalized verbatim to the set of blocks it appears in.
function blockMembershipByVerbatim(
  body: VoiceOfCustomerSectionOutput['body'],
): Map<string, Set<string>> {
  const membership = new Map<string, Set<string>>();
  for (const [block, quotes] of Object.entries(quotesByBlock(body))) {
    for (const quote of quotes) {
      const key = normalizeVerbatim(quote);
      if (!membership.has(key)) membership.set(key, new Set());
      membership.get(key)?.add(block);
    }
  }
  return membership;
}

describe('synthesizeVoiceOfCustomerFromCandidates', (): void => {
  it('promotes a dense 3-domain candidate pack into a validated non-gap VoC artifact body', (): void => {
    const pack = makeValidCandidatePack();
    const result = synthesizeVoiceOfCustomerFromCandidates({
      candidateResult: { ok: true, pack },
      now: () => new Date('2026-06-05T00:00:00.000Z'),
      researchInput: saaslaunchResearchInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.gap.message);
    }

    const artifact = buildArtifact(result.output, saaslaunchResearchInput);
    const minimums = validateVoiceOfCustomerMinimums(artifact);
    const selfSourcing = checkVoiceOfCustomerSelfSourcing({
      artifact,
      subjectDomain: saaslaunchResearchInput.company.websiteUrl,
    });

    expect(result.output.body.evidenceGap).not.toBe(true);
    // Pain keeps the bulk of the pack and >=3 distinct sources, but no longer
    // the whole pack — derived blocks now draw DISJOINT evidence.
    expect(result.output.body.painLanguage.quotes.length).toBeGreaterThanOrEqual(3);
    expect(
      new Set(
        result.output.body.painLanguage.quotes.map(
          (quote) => new URL(quote.sourceUrl).hostname,
        ),
      ).size,
    ).toBeGreaterThanOrEqual(3);
    // No verbatim quote may appear in more than one block (no laundering one
    // customer sentence into pain + objection + switching + decision + success).
    const reused = [...blockMembershipByVerbatim(result.output.body).entries()].filter(
      ([, blocks]) => blocks.size > 1,
    );
    expect(reused).toEqual([]);
    expect(
      new Set(result.output.sources.map((source) => source.url)).size,
    ).toBeGreaterThanOrEqual(3);
    expect(minimums).toEqual({ ok: true, errors: [] });
    expect(selfSourcing).toEqual({ ok: true, errors: [] });
  });

  it('promotes after-state quotes as success language that is DISJOINT from pain language', (): void => {
    const pack = makeLiveLikeCandidatePack();
    const result = synthesizeVoiceOfCustomerFromCandidates({
      candidateResult: { ok: true, pack },
      now: () => new Date('2026-06-05T00:00:00.000Z'),
      researchInput: saaslaunchResearchInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.gap.message);
    }

    const artifact = buildArtifact(result.output, saaslaunchResearchInput);
    const minimums = validateVoiceOfCustomerMinimums(artifact);
    const selfSourcing = checkVoiceOfCustomerSelfSourcing({
      artifact,
      subjectDomain: saaslaunchResearchInput.company.websiteUrl,
    });

    expect(result.output.body.evidenceGap).not.toBe(true);
    // Some after-state language is promoted to success...
    expect(
      result.output.body.successLanguage.quotes.length,
    ).toBeGreaterThan(0);
    // ...but NO success quote may also be a pain quote (the c9bc2056 laundering
    // promoted the same blob into both blocks).
    const painVerbatims = new Set(
      result.output.body.painLanguage.quotes.map((quote) =>
        normalizeVerbatim(quote.verbatimText),
      ),
    );
    for (const successQuote of result.output.body.successLanguage.quotes) {
      expect(painVerbatims.has(normalizeVerbatim(successQuote.verbatimText))).toBe(
        false,
      );
    }
    expect(minimums).toEqual({ ok: true, errors: [] });
    expect(selfSourcing).toEqual({ ok: true, errors: [] });
  });

  it('keeps every block disjoint and gaps any block emptied by partitioning', (): void => {
    const pack = makeValidCandidatePack();
    const result = synthesizeVoiceOfCustomerFromCandidates({
      candidateResult: { ok: true, pack },
      now: () => new Date('2026-06-05T00:00:00.000Z'),
      researchInput: saaslaunchResearchInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.gap.message);
    }

    const body = result.output.body;

    // No verbatim quote appears in more than one block.
    const reused = [...blockMembershipByVerbatim(body).entries()].filter(
      ([, blocks]) => blocks.size > 1,
    );
    expect(reused).toEqual([]);

    // Any quote-bearing block that the partition empties must carry an honest
    // blockGap (a partition-emptied block without one fails validateMinimums and
    // silently kills the whole section).
    const requireGapWhenEmpty = (
      empty: boolean,
      block: { blockGap?: unknown },
      label: string,
    ): void => {
      if (empty) {
        expect(block.blockGap, `${label} emptied without a blockGap`).toBeDefined();
      }
    };
    requireGapWhenEmpty(
      body.objections.items.length === 0,
      body.objections,
      'objections',
    );
    requireGapWhenEmpty(
      body.switchingStories.stories.length === 0,
      body.switchingStories,
      'switchingStories',
    );
    requireGapWhenEmpty(
      body.decisionCriteria.criteria.length === 0,
      body.decisionCriteria,
      'decisionCriteria',
    );
    requireGapWhenEmpty(
      body.successLanguage.quotes.length === 0,
      body.successLanguage,
      'successLanguage',
    );

    const artifact = buildArtifact(result.output, saaslaunchResearchInput);
    expect(validateVoiceOfCustomerMinimums(artifact)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('commits pain-rich evidence with a success block-gap when after-state language is thin', (): void => {
    // The Airtable-shape defect: the pack clears the pain floor (>=6 quotes /
    // 3 domains) but fewer than VOC_MIN_SUCCESS_QUOTES snippets express an
    // after-state. The section must ship its pain/objection/switching/decision
    // evidence with an honest success block-gap — NOT collapse to evidenceGap.
    const painOnly = (
      domain: string,
      evidenceKind: VoiceOfCustomerEvidenceKind,
      index: number,
    ): VoiceOfCustomerCandidate =>
      makeCandidate({
        domain,
        evidenceKind,
        index,
        snippet: `Independent reviewer ${index}: constant missed handoffs create urgent account follow-up pain, and the team loses visibility into which customer deal needs attention this week.`,
      });
    const pack: VoiceOfCustomerCandidatePack = {
      candidates: [
        painOnly('g2.com', 'review', 1),
        painOnly('g2.com', 'review', 2),
        painOnly('g2.com', 'review', 3),
        painOnly('g2.com', 'review', 4),
        painOnly('reddit.com', 'forum', 5),
        painOnly('reddit.com', 'forum', 6),
        painOnly('reddit.com', 'forum', 7),
        painOnly('capterra.com', 'review', 8),
        painOnly('capterra.com', 'review', 9),
        painOnly('capterra.com', 'review', 10),
      ],
      domains: ['g2.com', 'reddit.com', 'capterra.com'],
    };

    const result = synthesizeVoiceOfCustomerFromCandidates({
      candidateResult: { ok: true, pack },
      now: () => new Date('2026-06-05T00:00:00.000Z'),
      researchInput: saaslaunchResearchInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.gap.message);
    }

    const body = result.output.body;
    expect(body.evidenceGap).not.toBe(true);
    expect(body.painLanguage.quotes.length).toBeGreaterThanOrEqual(3);
    expect(
      new Set(
        body.painLanguage.quotes.map((quote) => new URL(quote.sourceUrl).hostname),
      ).size,
    ).toBeGreaterThanOrEqual(3);
    // Each derived block is either populated OR honestly gapped — partitioning a
    // pain-only pack may starve a derived block of distinct evidence, in which
    // case it gaps rather than launders a pain quote into it.
    const nonEmptyOrGapped = (
      empty: boolean,
      block: { blockGap?: unknown },
    ): boolean => !empty || block.blockGap !== undefined;
    expect(
      nonEmptyOrGapped(body.objections.items.length === 0, body.objections),
    ).toBe(true);
    expect(
      nonEmptyOrGapped(
        body.switchingStories.stories.length === 0,
        body.switchingStories,
      ),
    ).toBe(true);
    expect(
      nonEmptyOrGapped(
        body.decisionCriteria.criteria.length === 0,
        body.decisionCriteria,
      ),
    ).toBe(true);
    // No after-state language exists, so success is an honest gap.
    expect(body.successLanguage.quotes).toHaveLength(0);
    expect(body.successLanguage.blockGap).toBeDefined();
    expect(body.successLanguage.blockGap?.requiredCount).toBe(3);

    const artifact = buildArtifact(result.output, saaslaunchResearchInput);
    expect(validateVoiceOfCustomerMinimums(artifact)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('does not promote chrome-only "after-state" snippets as success language', (): void => {
    // The c9bc2056 trap: a PAIN snippet whose only after-state signal is the
    // employee-count chrome "(50 or fewer emp.)" matched expressesAfterState via
    // "fewer". cleanQuoteText strips that chrome at candidate construction, so
    // the snippet must NOT be promoted to success.
    const chromePain = (
      domain: string,
      evidenceKind: VoiceOfCustomerEvidenceKind,
      index: number,
    ): VoiceOfCustomerCandidate =>
      makeCandidate({
        domain,
        evidenceKind,
        index,
        snippet: `Independent reviewer ${index}: the gantt view is clunky and attachments cannot be edited inline, which slows our weekly planning. Verified User Small-Business (50 or fewer emp.)`,
      });
    const pack: VoiceOfCustomerCandidatePack = {
      candidates: [
        chromePain('g2.com', 'review', 1),
        chromePain('g2.com', 'review', 2),
        chromePain('g2.com', 'review', 3),
        chromePain('reddit.com', 'forum', 4),
        chromePain('reddit.com', 'forum', 5),
        chromePain('reddit.com', 'forum', 6),
        chromePain('capterra.com', 'review', 7),
        chromePain('capterra.com', 'review', 8),
        chromePain('capterra.com', 'review', 9),
      ],
      domains: ['g2.com', 'reddit.com', 'capterra.com'],
    };

    const result = synthesizeVoiceOfCustomerFromCandidates({
      candidateResult: { ok: true, pack },
      now: () => new Date('2026-06-05T00:00:00.000Z'),
      researchInput: saaslaunchResearchInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.gap.message);
    }

    // No chrome survives the stored snippet, and the cleaned pain text has no
    // genuine after-state, so success is honestly gapped — not laundered pain.
    for (const quote of result.output.body.painLanguage.quotes) {
      expect(quote.verbatimText).not.toContain('(50 or fewer emp.)');
      expect(quote.verbatimText).not.toContain('Verified User');
    }
    expect(result.output.body.successLanguage.quotes).toHaveLength(0);
    expect(result.output.body.successLanguage.blockGap).toBeDefined();
  });

  it('returns an explicit gap for candidate packs below promotion gates', (): void => {
    const tooFewQuotes = makeCandidatePack([
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'reddit.com', evidenceKind: 'forum' },
      { domain: 'capterra.com', evidenceKind: 'review' },
      { domain: 'trustpilot.com', evidenceKind: 'review' },
      { domain: 'news.ycombinator.com', evidenceKind: 'forum' },
    ]);
    const tooFewDomains = makeCandidatePack(
      Array.from({ length: 10 }, (_, index) => ({
        domain: index % 2 === 0 ? 'g2.com' : 'reddit.com',
        evidenceKind: index % 2 === 0 ? 'review' : 'forum',
      })),
    );
    const singleSourceMajority = makeCandidatePack([
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'g2.com', evidenceKind: 'review' },
      { domain: 'reddit.com', evidenceKind: 'forum' },
      { domain: 'reddit.com', evidenceKind: 'forum' },
      { domain: 'capterra.com', evidenceKind: 'review' },
      { domain: 'trustpilot.com', evidenceKind: 'review' },
    ]);
    const selfSourced: VoiceOfCustomerCandidatePack = {
      ...makeValidCandidatePack(),
      candidates: [
        {
          ...makeValidCandidatePack().candidates[0],
          domain: 'example.com',
          title: 'Audited company customer page',
          url: 'https://example.com/saaslaunch/customers',
        },
        ...makeValidCandidatePack().candidates.slice(1),
      ],
    };

    const cases = [
      tooFewQuotes,
      tooFewDomains,
      singleSourceMajority,
      selfSourced,
    ];

    cases.forEach((pack) => {
      const result = synthesizeVoiceOfCustomerFromCandidates({
        candidateResult: { ok: true, pack },
        now: () => new Date('2026-06-05T00:00:00.000Z'),
        researchInput: saaslaunchResearchInput,
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          gap: expect.objectContaining({
            evidenceGap: true,
            message: expect.any(String),
          }),
        }),
      );
    });
  });
});
