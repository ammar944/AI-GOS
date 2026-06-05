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
}: {
  domain: string;
  evidenceKind: VoiceOfCustomerEvidenceKind;
  index: number;
}): VoiceOfCustomerCandidate {
  const candidate = createVoiceOfCustomerCandidate({
    acquisitionMode: acquisitionModeForKind(evidenceKind),
    auditedCompanyDomain: saaslaunchResearchInput.company.websiteUrl,
    evidenceKind,
    snippet: `Dense candidate ${index} says missed handoffs create urgent account-follow-up pain, and after rebuilding the weekly loop the team knows which account action matters next.`,
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
    expect(result.output.body.painLanguage.quotes).toHaveLength(10);
    expect(new Set(result.output.body.painLanguage.quotes.map((quote) => new URL(quote.sourceUrl).hostname))).toEqual(
      new Set(['g2.com', 'reddit.com', 'capterra.com']),
    );
    expect(result.output.body.painLanguage.quotes.map((quote) => quote.verbatimText)).toEqual(
      pack.candidates.slice(0, 10).map((candidate) => candidate.snippet),
    );
    expect(
      new Set(result.output.sources.map((source) => source.url)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(result.output.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining(
        pack.candidates.slice(0, 10).map((candidate) => candidate.url),
      ),
    );
    expect(minimums).toEqual({ ok: true, errors: [] });
    expect(selfSourcing).toEqual({ ok: true, errors: [] });
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
