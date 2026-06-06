import { describe, expect, it } from 'vitest';

import {
  createVoiceOfCustomerCandidate,
  type VoiceOfCustomerCandidate,
} from '../voice-of-customer-candidates';
import {
  buildVoiceOfCustomerAcquisitionLedger,
  type VoiceOfCustomerAcquisitionAttempt,
  type VoiceOfCustomerAcquisitionAttemptWithQuery,
} from '../voice-of-customer-acquisition-ledger';

function makeAttempt(
  attempt: VoiceOfCustomerAcquisitionAttempt,
  query = 'Ramp reviews',
): VoiceOfCustomerAcquisitionAttemptWithQuery {
  return { attempt, query };
}

function makeCandidate(): VoiceOfCustomerCandidate {
  const candidate = createVoiceOfCustomerCandidate({
    acquisitionMode: 'review_body',
    auditedCompanyDomain: 'https://ramp.com',
    evidenceKind: 'review',
    snippet:
      'Finance teams say exception cleanup stays manual when approvals and receipts are scattered.',
    source: 'reviews',
    title: 'Ramp G2 reviews',
    url: 'https://www.g2.com/products/ramp/reviews',
  });

  if (candidate === null) {
    throw new Error('Expected test candidate to be created.');
  }

  return candidate;
}

describe('buildVoiceOfCustomerAcquisitionLedger', (): void => {
  it('records API errors as failed scrape rows with parser work not attempted', (): void => {
    const ledger = buildVoiceOfCustomerAcquisitionLedger({
      attempts: [
        makeAttempt({
          acquisitionMode: 'review_body',
          domain: 'g2.com',
          gapReason: 'api_error',
          message: 'Firecrawl scrape status 429',
          source: 'G2',
          status: 'failed',
          title: 'Ramp G2 reviews',
          url: 'https://www.g2.com/products/ramp/reviews',
        }),
      ],
      candidates: [],
      observedAt: '2026-06-01T00:00:00.000Z',
      result: {
        ok: false,
        gap: {
          candidateCount: 0,
          domains: [],
          message: 'No independent surfaces.',
          reason: 'no_review_or_forum_surfaces',
        },
      },
      sourceQueries: {},
    });

    expect(ledger).toEqual([
      expect.objectContaining({
        parserStatus: 'not_attempted',
        promotionStatus: 'not_applicable',
        query: 'Ramp reviews',
        rejectionReason: 'api_error',
        scrapeStatus: 'failed',
        sourceUrl: 'https://www.g2.com/products/ramp/reviews',
        toolGapReason: 'api_error',
      }),
    ]);
  });

  it('separates parser misses from scrape failures', (): void => {
    const ledger = buildVoiceOfCustomerAcquisitionLedger({
      attempts: [
        makeAttempt({
          acquisitionMode: 'review_body',
          domain: 'g2.com',
          gapReason: 'parser_no_match',
          source: 'G2',
          status: 'failed',
          title: 'Ramp G2 reviews',
          url: 'https://www.g2.com/products/ramp/reviews',
        }),
      ],
      candidates: [],
      observedAt: '2026-06-01T00:00:00.000Z',
      result: {
        ok: false,
        gap: {
          candidateCount: 0,
          domains: [],
          message: 'No independent surfaces.',
          reason: 'no_review_or_forum_surfaces',
        },
      },
      sourceQueries: {},
    });

    expect(ledger).toEqual([
      expect.objectContaining({
        parserStatus: 'failed',
        rejectionReason: 'parser_no_match',
        scrapeStatus: 'succeeded',
        toolGapReason: 'parser_no_match',
      }),
    ]);
  });

  it('records extracted candidates that were rejected by the selection floor', (): void => {
    const candidate = makeCandidate();
    const ledger = buildVoiceOfCustomerAcquisitionLedger({
      attempts: [],
      candidates: [candidate],
      observedAt: '2026-06-01T00:00:00.000Z',
      result: {
        ok: false,
        gap: {
          candidateCount: 1,
          domains: ['g2.com'],
          message: 'Found one domain; need three.',
          reason: 'insufficient_independent_domains',
        },
      },
      sourceQueries: { reviews: 'Ramp reviews' },
    });

    expect(ledger).toEqual([
      expect.objectContaining({
        candidateText: expect.stringContaining('exception cleanup'),
        evidenceKind: 'review',
        parserStatus: 'succeeded',
        promotionStatus: 'rejected',
        query: 'Ramp reviews',
        rejectionReason: 'insufficient_independent_domains',
        scrapeStatus: 'succeeded',
        source: 'reviews',
        sourceUrl: 'https://g2.com/products/ramp/reviews',
      }),
    ]);
  });
});
