import { describe, expect, it } from 'vitest';

import type { ReaderSectionId } from '@/components/research-v3/reader-sections';
import { SECTION_REGISTRY } from '@/lib/lab-engine/sections/section-registry';
import type {
  LiveQualityGateInput,
  LiveQualityGateResult,
  LiveQualityGateSectionEvidence,
  LiveQualityGateSectionRow,
} from '@/lib/research-v3/live-quality-gate';
import {
  buildReportResult,
  renderReport,
} from '../../../../scripts/research-quality-gate-report';
import { parseBackfillOptions } from '../../../../scripts/backfill-research-quality-gates';

const runId = '00000000-0000-4000-8000-0000000000bb';
const artifactId = '11111111-1111-4111-8111-1111111111bb';

function baseInput(
  sections: readonly LiveQualityGateSectionRow[] = [],
): LiveQualityGateInput {
  return {
    runId,
    artifact: {
      id: artifactId,
      runId,
      status: 'complete',
      childrenComplete: 6,
      childrenTotal: 6,
    },
    sections: [...sections],
    sectionRuns: [],
  };
}

function baseResult(
  overrides: Partial<LiveQualityGateResult> = {},
): LiveQualityGateResult {
  return {
    runId,
    verdict: 'nine_of_ten_research_achieved',
    researchQualityStatus: 'verified',
    gates: {
      pipeline: {
        status: 'recovered',
        reasons: [],
      },
      researchQuality: {
        status: 'verified',
        reasons: [],
      },
      actionability: {
        status: 'verified',
        reasons: [],
      },
      projectionSync: {
        status: 'verified',
        reasons: [],
      },
      projectionTrust: {
        status: 'verified',
        reasons: [],
      },
    },
    blockedBy: [],
    researchQualityReasons: [],
    failures: [],
    warnings: [],
    completion: [],
    sectionEvidence: [],
    vocAudit: {
      painQuoteCount: 10,
      successQuoteCount: 5,
      painSourceDomains: ['g2.com', 'reddit.com', 'capterra.com'],
      painSourceUrls: [
        'https://g2.com/reviews/1',
        'https://reddit.com/r/reviews/2',
        'https://capterra.com/reviews/3',
        'https://trustpilot.com/reviews/4',
        'https://news.ycombinator.com/item?id=5',
      ],
      acquisitionModes: ['review_body'],
      gapReasons: [],
      subjectDomain: 'example.com',
      selfSourcedPainQuoteCount: 0,
      passesQuoteFloor: true,
      passesSourceDiversity: true,
      passesSourceUrlFloor: true,
      passesSubjectDomainExclusion: true,
    },
    profileTrust: {
      present: true,
      matched: true,
      checkedZones: ['positioningMarketCategory'] satisfies ReaderSectionId[],
      failures: [],
    },
    shareTrust: {
      present: true,
      matched: true,
      checkedZones: ['positioningMarketCategory'] satisfies ReaderSectionId[],
      failures: [],
    },
    ...overrides,
  };
}

function sectionEvidence(
  input: Partial<LiveQualityGateSectionEvidence> & {
    zone: ReaderSectionId;
  },
): LiveQualityGateSectionEvidence {
  return {
    artifactPresent: true,
    schemaValid: true,
    schemaErrors: [],
    verificationTier: 'verified',
    verificationFlag: null,
    reviewTier: null,
    evidenceGap: false,
    evidenceGapReasons: [],
    qualityStatus: 'verified',
    qualityReasons: [],
    actionabilityStatus: 'verified',
    actionabilityReasons: [],
    verifiedCount: 8,
    unsupportedCount: 0,
    totalClaims: 8,
    ...input,
  };
}

describe('research quality gate report', (): void => {
  it('renders the additive gate sections and deterministic quality summary', (): void => {
    const report = buildReportResult({
      gateInput: baseInput(),
      result: baseResult(),
    });
    const markdown = renderReport(report);

    expect(report.gates.researchQuality.status).toBe('verified');
    expect(markdown).toContain('## Final verdict');
    expect(markdown).toContain('## Gate readout');
    expect(markdown).toContain('## Research quality reasons');
    expect(markdown).toContain('## Actionability');
    expect(markdown).toContain('## Projection trust');
    expect(markdown).not.toContain('## Strategy quality');
    expect(markdown).toContain('Blocked by: none');
    expect(markdown).toContain('## Section rules table');
    expect(markdown).toContain('## Voice of Customer diagnostics');
    expect(markdown).toContain('## BuyerICP diagnostics');
    expect(markdown).toContain('## Failures');
    expect(markdown).toContain('## Warnings');
  });

  it('maps zero VoC quotes to insufficient research quality and not verified actionability', (): void => {
    const evaluatorResult = baseResult();
    const report = buildReportResult({
      gateInput: baseInput(),
      result: {
        ...evaluatorResult,
        gates: {
          ...evaluatorResult.gates,
          researchQuality: {
            status: 'insufficient',
            reasons: ['positioningVoiceOfCustomer has zero real buyer quotes'],
          },
          actionability: {
            status: 'not_verified',
            reasons: ['positioningVoiceOfCustomer has zero real buyer quotes'],
          },
        },
        sectionEvidence: [
          sectionEvidence({
            zone: 'positioningVoiceOfCustomer',
            verificationTier: 'insufficient',
            evidenceGap: true,
            evidenceGapReasons: ['insufficient_voice_of_customer_sources'],
            qualityStatus: 'research_grade_with_gaps',
            qualityReasons: ['structured evidence-gap report is present'],
          }),
        ],
        vocAudit: {
          ...evaluatorResult.vocAudit,
          painQuoteCount: 0,
          successQuoteCount: 0,
          painSourceDomains: [],
          painSourceUrls: [],
          gapReasons: ['insufficient_voice_of_customer_sources'],
          passesQuoteFloor: false,
          passesSourceDiversity: false,
          passesSourceUrlFloor: false,
        },
      },
    });

    expect(report.gates.researchQuality.status).toBe('insufficient');
    expect(report.gates.actionability.status).toBe('not_verified');
    expect(
      report.sectionRules.find(
        (row) => row.zone === 'positioningVoiceOfCustomer',
      ),
    ).toEqual(
      expect.objectContaining({
        researchQuality: 'insufficient',
        actionability: 'not_verified',
      }),
    );
  });

  it('treats two named BuyerICP identities plus a specific gap as usable with caveats', (): void => {
    const evaluatorResult = baseResult();
    const fixture = SECTION_REGISTRY.positioningBuyerICP.fixtureArtifact;
    const buyerArtifact = {
      ...fixture,
      body: {
        ...fixture.body,
        evidenceGap: true,
        personaReality: {
          ...fixture.body.personaReality,
          personas: fixture.body.personaReality.personas.slice(0, 2),
        },
        evidenceGapReport: {
          reason: 'insufficient_named_buyer_personas',
          summary: 'Found 2 named buyer personas; required 5.',
          foundNamedPersonaCount: 2,
          requiredNamedPersonaCount: 5,
          rejectedPersonaLabels: ['Finance leaders'],
          sourcingPlan: ['Recover three more named buyer identities.'],
        },
      },
    };
    const buyerSection: LiveQualityGateSectionRow = {
      id: 'section-positioningBuyerICP',
      zone: 'positioningBuyerICP',
      sectionRunId: 'run-positioningBuyerICP',
      status: 'complete',
      title: buyerArtifact.sectionTitle,
      data: buyerArtifact,
      verificationTier: 'insufficient',
      verificationFlag: {
        tier: 'insufficient',
        evidenceGap: true,
      },
      countsTowardRollup: true,
      updatedAt: '2026-06-06T00:00:00.000Z',
    };

    const report = buildReportResult({
      gateInput: baseInput([buyerSection]),
      result: {
        ...evaluatorResult,
        gates: {
          ...evaluatorResult.gates,
          researchQuality: {
            status: 'research_grade_with_gaps',
            reasons: ['positioningBuyerICP named buyer identities=2'],
          },
          actionability: {
            status: 'usable_with_caveats',
            reasons: ['positioningBuyerICP named buyer identities=2'],
          },
        },
        sectionEvidence: [
          sectionEvidence({
            zone: 'positioningBuyerICP',
            verificationTier: 'insufficient',
            evidenceGap: true,
            evidenceGapReasons: ['insufficient_named_buyer_personas'],
            qualityStatus: 'research_grade_with_gaps',
            qualityReasons: ['structured evidence-gap report is present'],
          }),
        ],
      },
    });

    expect(report.buyerIcpDiagnostics.namedPersonaCount).toBe(2);
    expect(report.buyerIcpDiagnostics.actionability).toBe('usable_with_caveats');
    expect(report.gates.actionability.status).toBe('usable_with_caveats');
  });

  it('renders review coverage warnings without changing actionability', (): void => {
    const evaluatorResult = baseResult({
      warnings: ['positioningMarketCategory review coverage unavailable'],
      sectionEvidence: [
        sectionEvidence({
          zone: 'positioningMarketCategory',
          reviewTier: 'unavailable',
        }),
      ],
    });
    const report = buildReportResult({
      gateInput: baseInput(),
      result: evaluatorResult,
    });
    const markdown = renderReport(report);

    expect(report.gates.researchQuality.status).toBe('verified');
    expect(report.gates.actionability.status).toBe('verified');
    expect(report.sectionRules[0]).toEqual(
      expect.objectContaining({
        actionability: 'verified',
        reviewTier: 'unavailable',
      }),
    );
    expect(markdown).toContain(
      '- positioningMarketCategory review coverage unavailable',
    );
  });
});

describe('research quality gate backfill options', (): void => {
  it('parses dry-run, run-id, and bounded batch limit options', (): void => {
    expect(
      parseBackfillOptions(['--dry-run', '--run-id', runId, '--limit', '7']),
    ).toEqual({
      dryRun: true,
      runId,
      limit: 7,
    });
    expect(() => parseBackfillOptions(['--limit', '101'])).toThrow(
      '--limit must be <= 100',
    );
  });
});
