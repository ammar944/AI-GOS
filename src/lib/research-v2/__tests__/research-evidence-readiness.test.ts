import { describe, expect, it } from 'vitest';

import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  evaluateResearchEvidenceReadiness,
  realBuyerQuoteCountFromArtifactData,
  type ResearchEvidenceReadinessRow,
} from '../research-evidence-readiness';

function verifiedFlag(): Record<string, unknown> {
  return {
    confidence: 1,
    evidenceGap: false,
    insufficientThreshold: 0.5,
    needsReviewThreshold: 0.75,
    tier: 'verified',
    totalClaims: 1,
    unsupportedCount: 0,
    verifiedCount: 1,
  };
}

function readyVoiceOfCustomerBody(): Record<string, unknown> {
  return {
    painLanguage: {
      quotes: [{ sourceUrl: 'https://g2.com/reviews/1', verbatimText: 'Pain quote' }],
    },
    successLanguage: {
      quotes: [
        { sourceUrl: 'https://g2.com/reviews/2', verbatimText: 'Success quote' },
      ],
    },
  };
}

function readyBuyerICPBody(): Record<string, unknown> {
  return {
    personaReality: {
      personas: [
        {
          company: 'ExampleCo',
          name: 'Jane Doe',
          role: 'economic-buyer',
          seniority: 'executive',
          sourceUrl: 'https://example.com/jane-doe',
          title: 'Chief Financial Officer',
        },
        {
          company: 'ExampleCo',
          name: 'Mina Patel',
          role: 'champion',
          seniority: 'director',
          sourceUrl: 'https://example.com/mina-patel',
          title: 'Director of Procurement',
        },
      ],
    },
  };
}

function bodyForZone(zone: PositioningSectionId): Record<string, unknown> {
  if (zone === 'positioningVoiceOfCustomer') {
    return readyVoiceOfCustomerBody();
  }

  if (zone === 'positioningBuyerICP') {
    return readyBuyerICPBody();
  }

  return {};
}

function readyRows(): ResearchEvidenceReadinessRow[] {
  return POSITIONING_SECTION_IDS.map((zone) => ({
    data: { body: bodyForZone(zone), sectionTitle: zone },
    verification_flag: verifiedFlag(),
    verification_tier: 'verified',
    zone,
  }));
}

describe('evaluateResearchEvidenceReadiness', (): void => {
  it('allows complete core sections with promotable VoC and BuyerICP evidence', (): void => {
    const result = evaluateResearchEvidenceReadiness(readyRows());

    expect(result.ready).toBe(true);
    expect(result.blockedSections).toEqual([]);
  });

  it('blocks VoC evidence-gap artifacts before capstone promotion', (): void => {
    const rows = readyRows().map((row) =>
      row.zone === 'positioningVoiceOfCustomer'
        ? {
            ...row,
            data: {
              body: {
                evidenceGap: true,
                painLanguage: { quotes: [] },
                successLanguage: { quotes: [] },
              },
              sectionTitle: row.zone,
            },
            verification_flag: {
              ...verifiedFlag(),
              evidenceGap: true,
              tier: 'insufficient',
            },
            verification_tier: 'insufficient',
          }
        : row,
    );

    const result = evaluateResearchEvidenceReadiness(rows);

    expect(result.ready).toBe(false);
    expect(result.blockedSections).toEqual([
      {
        zone: 'positioningVoiceOfCustomer',
        reasons: expect.arrayContaining([
          'positioningVoiceOfCustomer body.evidenceGap=true',
          'positioningVoiceOfCustomer has zero real buyer quotes',
        ]),
      },
    ]);
  });

  it('counts real buyer quotes straight off the persisted artifact envelope', (): void => {
    // realBuyerQuoteCountFromArtifactData takes the raw
    // research_artifact_sections.data column value ({ body: {...} } envelope).
    expect(
      realBuyerQuoteCountFromArtifactData({
        body: readyVoiceOfCustomerBody(),
        sectionTitle: 'positioningVoiceOfCustomer',
      }),
    ).toBe(2);
    // Quote records without usable verbatimText are not "real" quotes.
    expect(
      realBuyerQuoteCountFromArtifactData({
        body: {
          painLanguage: {
            quotes: [
              { sourceUrl: 'https://g2.com/reviews/3', verbatimText: null },
            ],
          },
          successLanguage: { quotes: [{ verbatimText: '   ' }] },
        },
        sectionTitle: 'positioningVoiceOfCustomer',
      }),
    ).toBe(0);
    // Missing body / non-record data degrade to zero, never throw.
    expect(realBuyerQuoteCountFromArtifactData({ sectionTitle: 'x' })).toBe(0);
    expect(realBuyerQuoteCountFromArtifactData(null)).toBe(0);
  });

  it('blocks BuyerICP when fewer than two named buyer identities are present', (): void => {
    const rows = readyRows().map((row) =>
      row.zone === 'positioningBuyerICP'
        ? {
            ...row,
            data: {
              body: {
                personaReality: {
                  personas: [
                    {
                      company: 'ExampleCo',
                      name: 'Kaela',
                      role: 'champion',
                      seniority: 'director',
                      sourceUrl: 'https://example.com/kaela',
                      title: 'Director of Finance',
                    },
                  ],
                },
              },
              sectionTitle: row.zone,
            },
          }
        : row,
    );

    const result = evaluateResearchEvidenceReadiness(rows);

    expect(result.ready).toBe(false);
    expect(result.blockedSections).toEqual([
      {
        zone: 'positioningBuyerICP',
        reasons: [
          'positioningBuyerICP named buyer identities=0; need >=2',
        ],
      },
    ]);
  });
});
