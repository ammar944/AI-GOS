import { describe, expect, it } from 'vitest';

import {
  VOC_CANDIDATE_PER_DOMAIN_CAP,
  createVoiceOfCustomerCandidate,
  formatVoiceOfCustomerCandidateBlock,
  selectVoiceOfCustomerCandidates,
  type VoiceOfCustomerCandidate,
  type VoiceOfCustomerAcquisitionMode,
  type VoiceOfCustomerEvidenceKind,
} from '../voice-of-customer-candidates';
import { getRegistrableDomain } from '../../domain-utils';

function acquisitionModeForKind(
  evidenceKind: VoiceOfCustomerEvidenceKind,
): VoiceOfCustomerAcquisitionMode {
  if (evidenceKind === 'review') return 'review_body';
  if (evidenceKind === 'forum') return 'forum_comment';
  return 'support_thread';
}

function makeCandidate(
  index: number,
  domain: string,
  evidenceKind: VoiceOfCustomerEvidenceKind,
): VoiceOfCustomerCandidate {
  const candidate = createVoiceOfCustomerCandidate({
    acquisitionMode: acquisitionModeForKind(evidenceKind),
    auditedCompanyDomain: 'https://ramp.com',
    evidenceKind,
    snippet: `Candidate ${index} says onboarding and handoff pain is concrete enough to quote.`,
    source: 'web_search',
    title: `Candidate ${index}`,
    url: `https://${domain}/thread-${index}`,
  });

  if (candidate === null) {
    throw new Error(`Expected candidate for ${domain}`);
  }

  return candidate;
}

describe('getRegistrableDomain', (): void => {
  it('normalizes URLs, hostnames, bare domains, and known multi-label suffixes', (): void => {
    expect(getRegistrableDomain('HTTPS://WWW.Example.COM/path')).toBe(
      'example.com',
    );
    expect(getRegistrableDomain('app.review.example.co.uk/path')).toBe(
      'example.co.uk',
    );
    expect(getRegistrableDomain('www.foo.bar.com.au')).toBe('bar.com.au');
    expect(getRegistrableDomain('g2.com/products/ramp/reviews')).toBe('g2.com');
  });

  it('returns null for invalid host inputs', (): void => {
    expect(getRegistrableDomain('')).toBeNull();
    expect(getRegistrableDomain('localhost')).toBeNull();
    expect(getRegistrableDomain('not a host')).toBeNull();
    expect(getRegistrableDomain('https://bad_host.example')).toBeNull();
  });
});

describe('createVoiceOfCustomerCandidate', (): void => {
  it('rejects audited-company registrable domains and subdomains', (): void => {
    expect(
      createVoiceOfCustomerCandidate({
        acquisitionMode: 'support_thread',
        auditedCompanyDomain: 'https://ramp.com',
        evidenceKind: 'article',
        snippet: 'A homepage quote should not be accepted as independent VoC.',
        source: 'researchInput',
        title: 'Ramp homepage',
        url: 'https://www.ramp.com/customers',
      }),
    ).toBeNull();

    expect(
      createVoiceOfCustomerCandidate({
        acquisitionMode: 'support_thread',
        auditedCompanyDomain: 'ramp.com',
        evidenceKind: 'support-thread',
        snippet: 'A subdomain support article is still first-party.',
        source: 'web_search',
        title: 'Ramp support',
        url: 'https://support.ramp.com/thread',
      }),
    ).toBeNull();
  });

  it('strips a trailing review-platform chrome tail from the stored snippet', (): void => {
    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      evidenceKind: 'review',
      snippet:
        'We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes. Verified User Mid-Market (51-1000 emp.)',
      source: 'reviews',
      title: 'Finance reviewer',
      url: 'https://www.g2.com/products/acme/reviews/acme-review-12345',
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.snippet).toBe(
      'We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes.',
    );
    expect(candidate?.snippet).not.toContain('Verified User');
    expect(candidate?.snippet).not.toContain('(51-1000 emp.)');
  });

  it('strips a synthesized meta-summary lead-in, keeping only the verbatim quote', (): void => {
    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      evidenceKind: 'review',
      snippet:
        'Customer reviews on Trustpilot highlight unexpected charges — They billed me twice and support never refunded the duplicate charge.',
      source: 'reviews',
      title: 'Finance reviewer',
      url: 'https://www.trustpilot.com/reviews/acme-review-9001',
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.snippet).toBe(
      'They billed me twice and support never refunded the duplicate charge.',
    );
    expect(candidate?.snippet).not.toContain('Customer reviews on Trustpilot');
    expect(candidate?.snippet).not.toContain('highlight');
  });

  it('keeps a natural mid-quote em-dash in a single first-person review', (): void => {
    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      evidenceKind: 'review',
      snippet:
        'Support never responds — I waited a week for a ticket reply and got ignored.',
      source: 'reviews',
      title: 'Support reviewer',
      url: 'https://www.capterra.com/reviews/acme-review-9002',
    });

    expect(candidate?.snippet).toBe(
      'Support never responds — I waited a week for a ticket reply and got ignored.',
    );
  });

  it('keeps third-party review and forum URLs even when the path mentions the audited company', (): void => {
    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      snippet: 'Users complain that receipt matching and approvals take too long.',
      source: 'reviews',
      title: 'Ramp reviews',
      url: 'https://www.g2.com/products/ramp/reviews',
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        domain: 'g2.com',
        acquisitionMode: 'review_body',
        evidenceKind: 'review',
        url: 'https://g2.com/products/ramp/reviews',
      }),
    );
  });

  it('rejects snippet-only candidates without full-body acquisition provenance', (): void => {
    expect(
      createVoiceOfCustomerCandidate({
        auditedCompanyDomain: 'https://ramp.com',
        evidenceKind: 'review',
        snippet: 'A SERP snippet says users complain about receipt matching.',
        source: 'web_search',
        title: 'Ramp reviews',
        url: 'https://g2.com/products/ramp/reviews',
      }),
    ).toBeNull();
  });

  it('rejects empty URLs and snippets', (): void => {
    expect(
      createVoiceOfCustomerCandidate({
        acquisitionMode: 'review_body',
        auditedCompanyDomain: 'ramp.com',
        evidenceKind: 'review',
        snippet: '',
        source: 'reviews',
        title: 'Empty snippet',
        url: 'https://g2.com/products/ramp/reviews',
      }),
    ).toBeNull();
    expect(
      createVoiceOfCustomerCandidate({
        acquisitionMode: 'review_body',
        auditedCompanyDomain: 'ramp.com',
        evidenceKind: 'review',
        snippet: 'Valid text',
        source: 'reviews',
        title: 'Empty URL',
        url: '',
      }),
    ).toBeNull();
  });
});

describe('selectVoiceOfCustomerCandidates', (): void => {
  it('deduplicates URLs, ranks review and forum surfaces first, caps per domain, and limits pack size', (): void => {
    const candidates = [
      ...Array.from({ length: 6 }, (_, index) =>
        makeCandidate(index, 'g2.com', 'review'),
      ),
      makeCandidate(20, 'reddit.com', 'forum'),
      makeCandidate(21, 'reddit.com', 'forum'),
      makeCandidate(30, 'capterra.com', 'review'),
      makeCandidate(31, 'capterra.com', 'review'),
      makeCandidate(40, 'forbes.com', 'article'),
      makeCandidate(41, 'forbes.com', 'article'),
      makeCandidate(30, 'capterra.com', 'review'),
    ];

    const result = selectVoiceOfCustomerCandidates(candidates);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected candidate pack');
    }

    expect(result.pack.candidates).toHaveLength(10);
    expect(
      result.pack.candidates.filter((candidate) => candidate.domain === 'g2.com'),
    ).toHaveLength(VOC_CANDIDATE_PER_DOMAIN_CAP);
    expect(result.pack.candidates.at(-1)?.evidenceKind).toBe('article');
    expect(
      new Set(result.pack.candidates.map((candidate) => candidate.url)).size,
    ).toBe(result.pack.candidates.length);
  });

  it('deduplicates equivalent www and non-www URLs before selecting the pack', (): void => {
    const duplicateNonWww = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      snippet:
        'Finance teams say monthly close pain comes from manual exception chasing.',
      source: 'web_search',
      title: 'Ramp reviews',
      url: 'https://g2.com/products/ramp/reviews',
    });
    const duplicateWww = createVoiceOfCustomerCandidate({
      acquisitionMode: 'review_body',
      auditedCompanyDomain: 'https://ramp.com',
      snippet:
        'Operators say card-policy cleanup still takes too much manual work.',
      source: 'reviews',
      title: 'Ramp reviews with www',
      url: 'https://www.g2.com/products/ramp/reviews',
    });

    if (duplicateNonWww === null || duplicateWww === null) {
      throw new Error('Expected duplicate G2 candidates');
    }

    const result = selectVoiceOfCustomerCandidates([
      duplicateNonWww,
      duplicateWww,
      makeCandidate(10, 'g2.com', 'review'),
      makeCandidate(11, 'reddit.com', 'forum'),
      makeCandidate(12, 'reddit.com', 'forum'),
      makeCandidate(13, 'capterra.com', 'review'),
      makeCandidate(14, 'trustpilot.com', 'review'),
      makeCandidate(15, 'getapp.com', 'review'),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected candidate pack');
    }

    const duplicateUrls = result.pack.candidates.filter((candidate) =>
      candidate.url.endsWith('/products/ramp/reviews'),
    );

    expect(duplicateUrls).toHaveLength(1);
    expect(duplicateUrls[0]?.url).toBe(
      'https://g2.com/products/ramp/reviews',
    );
  });

  it('returns typed gaps for missing review/forum surfaces, domains, and candidate count', (): void => {
    const articleOnly = [
      makeCandidate(1, 'news-a.com', 'article'),
      makeCandidate(2, 'news-b.com', 'article'),
      makeCandidate(3, 'news-c.com', 'article'),
      makeCandidate(4, 'news-a.com', 'article'),
      makeCandidate(5, 'news-b.com', 'article'),
      makeCandidate(6, 'news-c.com', 'article'),
    ];
    const twoDomains = [
      makeCandidate(10, 'g2.com', 'review'),
      makeCandidate(11, 'g2.com', 'review'),
      makeCandidate(12, 'g2.com', 'review'),
      makeCandidate(13, 'reddit.com', 'forum'),
      makeCandidate(14, 'reddit.com', 'forum'),
      makeCandidate(15, 'reddit.com', 'forum'),
    ];
    const tooFew = [
      makeCandidate(20, 'g2.com', 'review'),
      makeCandidate(21, 'reddit.com', 'forum'),
      makeCandidate(22, 'capterra.com', 'review'),
      makeCandidate(23, 'trustpilot.com', 'review'),
      makeCandidate(24, 'community.example', 'support-thread'),
    ];

    const articleGap = selectVoiceOfCustomerCandidates(articleOnly);
    const domainGap = selectVoiceOfCustomerCandidates(twoDomains);
    const countGap = selectVoiceOfCustomerCandidates(tooFew);

    expect(articleGap.ok).toBe(false);
    expect(articleGap.ok ? null : articleGap.gap.reason).toBe(
      'no_review_or_forum_surfaces',
    );
    expect(domainGap.ok).toBe(false);
    expect(domainGap.ok ? null : domainGap.gap.reason).toBe(
      'insufficient_independent_domains',
    );
    expect(countGap.ok).toBe(false);
    expect(countGap.ok ? null : countGap.gap.reason).toBe(
      'insufficient_candidates',
    );
  });
});

describe('formatVoiceOfCustomerCandidateBlock', (): void => {
  it('formats an instruction block for pain-language quote drafting and top-level source alignment', (): void => {
    const result = selectVoiceOfCustomerCandidates([
      makeCandidate(1, 'g2.com', 'review'),
      makeCandidate(2, 'g2.com', 'review'),
      makeCandidate(3, 'reddit.com', 'forum'),
      makeCandidate(4, 'reddit.com', 'forum'),
      makeCandidate(5, 'capterra.com', 'review'),
      makeCandidate(6, 'trustpilot.com', 'review'),
    ]);

    const block = formatVoiceOfCustomerCandidateBlock(result);

    expect(block).toContain('Voice of Customer Candidate Pack');
    expect(block).toContain('body.painLanguage.quotes[]');
    expect(block).toContain('Use at least 3 independent domains');
    expect(block).toContain('Align top-level sources');
    expect(block).toContain('g2.com');
    expect(block).toContain('reddit.com');
  });
});
