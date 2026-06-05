import { describe, expect, it } from 'vitest';

import {
  READER_SECTION_IDS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import type {
  ArtifactEnvelope,
  StrategicCritique,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import { SECTION_REGISTRY } from '@/lib/lab-engine/sections/section-registry';
import { buildV3ShareSnapshot } from '@/lib/research-v2/share-snapshot';
import {
  evaluateLiveQualityGate,
  type LiveQualityGateInput,
  type LiveQualityGateProfileSnapshot,
  type LiveQualityGateSectionRow,
  type LiveQualityGateShareSnapshot,
} from '@/lib/research-v3/live-quality-gate';

const runId = '00000000-0000-4000-8000-0000000000aa';
const parentArtifactId = '11111111-1111-4111-8111-111111111111';

const profileBackedZones = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningSynthesis',
] as const satisfies readonly ReaderSectionId[];

const passingCritique: StrategicCritique = {
  checkedAt: '2026-06-05T12:00:00.000Z',
  items: [
    {
      action: 'kept',
      path: 'body.crossSectionThreads[0].claim',
      rationale: 'Names a non-obvious cross-section implication.',
      text: 'The speed wedge beats the broad platform story because buyer anxiety is operational, not categorical.',
      verdict: 'passes',
    },
    {
      action: 'deepened',
      path: 'body.namedTension.side',
      rationale: 'Chooses a side and names the accepted cost.',
      text: 'Take the narrower proof loop even though it delays platform authority.',
      verdict: 'passes',
    },
    {
      action: 'kept',
      path: 'body.secondOrderRisk.claim',
      rationale: 'Explains what can happen after the first move.',
      text: 'If the speed wedge works, proof depth becomes the next bottleneck.',
      verdict: 'passes',
    },
    {
      action: 'cut',
      path: 'body.crossSectionThreads[1].claim',
      rationale: 'This line reads like a summary.',
      text: 'The company should improve marketing with evidence.',
      verdict: 'summary',
    },
  ],
  modelId: 'claude-opus-4-5',
  summary: 'Three of four strategic claims passed the knew-that sweep.',
  target: 'cross_section_reasoning',
};

function artifactForZone(zone: ReaderSectionId): ArtifactEnvelope {
  return SECTION_REGISTRY[zone].fixtureArtifact;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function withIndependentVocSources(artifact: ArtifactEnvelope): ArtifactEnvelope {
  const painLanguage = isRecord(artifact.body.painLanguage)
    ? artifact.body.painLanguage
    : {};
  const quotes = Array.isArray(painLanguage.quotes)
    ? painLanguage.quotes.filter(isRecord)
    : [];
  const domains = [
    'g2.com',
    'reddit.com',
    'news.ycombinator.com',
    'capterra.com',
    'trustpilot.com',
  ] as const;

  return {
    ...artifact,
    body: {
      ...artifact.body,
      painLanguage: {
        ...painLanguage,
        quotes: quotes.map((quote, index) => ({
          ...quote,
          sourceUrl: `https://${domains[index % domains.length]}/reviews/${index + 1}`,
        })),
      },
    },
  };
}

function defaultArtifactForZone(zone: ReaderSectionId): ArtifactEnvelope {
  const artifact = artifactForZone(zone);
  return zone === 'positioningVoiceOfCustomer'
    ? withIndependentVocSources(artifact)
    : artifact;
}

function verifiedFlag(): Record<string, unknown> {
  return {
    tier: 'verified',
    verifiedCount: 8,
    unsupportedCount: 0,
    totalClaims: 8,
    confidence: 1,
    needsReviewThreshold: 0.75,
    insufficientThreshold: 0.5,
    evidenceGap: false,
  };
}

function createSectionRow(input: {
  zone: ReaderSectionId;
  artifact?: ArtifactEnvelope;
  tier?: string;
}): LiveQualityGateSectionRow {
  return {
    id: `section-${input.zone}`,
    zone: input.zone,
    sectionRunId: `run-${input.zone}`,
    status: 'complete',
    title: input.artifact?.sectionTitle ?? input.zone,
    data: input.artifact ?? defaultArtifactForZone(input.zone),
    verificationTier: input.tier ?? 'verified',
    verificationFlag:
      input.tier === 'needs_review'
        ? { ...verifiedFlag(), tier: 'needs_review', unsupportedCount: 1 }
        : verifiedFlag(),
    countsTowardRollup: ![
      'positioningCrossSectionReasoning',
      'positioningSynthesis',
      'positioningPaidMediaPlan',
    ].includes(input.zone),
    updatedAt: '2026-06-05T12:00:00.000Z',
  };
}

function createProfile(
  sections: readonly LiveQualityGateSectionRow[],
): LiveQualityGateProfileSnapshot {
  const sectionsByZone = new Map(
    sections.map((section) => [section.zone, section]),
  );
  const aiInsights: Record<string, unknown> = {};

  for (const zone of profileBackedZones) {
    const tier = sectionsByZone.get(zone)?.verificationTier;
    if (tier !== undefined) {
      aiInsights[zone] = { verificationTier: tier };
    }
  }

  return {
    id: 'profile-123',
    aiInsights,
    offerScore: {
      verificationTier:
        sectionsByZone.get('positioningOfferDiagnostic')?.verificationTier ??
        null,
    },
    positioningStrategy: {
      verificationTier:
        sectionsByZone.get('positioningSynthesis')?.verificationTier ?? null,
    },
    updatedAt: '2026-06-05T12:05:00.000Z',
  };
}

function createShare(
  sections: readonly LiveQualityGateSectionRow[],
): LiveQualityGateShareSnapshot {
  return {
    shareToken: 'share-token-123',
    researchSnapshot: buildV3ShareSnapshot({
      runId,
      title: 'SaaSLaunch Positioning Audit',
      sections: sections.map((section) => ({
        zone: section.zone,
        title: section.title ?? section.zone ?? 'Untitled',
        markdown: null,
        data: section.data,
        status: section.status,
        verification_tier: section.verificationTier,
        verification_flag: section.verificationFlag,
        updated_at: section.updatedAt ?? null,
      })),
    }),
    createdAt: '2026-06-05T12:06:00.000Z',
  };
}

function createCompleteInput(input?: {
  sections?: readonly LiveQualityGateSectionRow[];
  includePassingCritique?: boolean;
}): LiveQualityGateInput {
  const sections =
    input?.sections ??
    READER_SECTION_IDS.map((zone) => {
      const artifact =
        zone === 'positioningCrossSectionReasoning' &&
        input?.includePassingCritique === true
          ? {
              ...artifactForZone(zone),
              strategicCritique: passingCritique,
            }
        : defaultArtifactForZone(zone);

      return createSectionRow({ zone, artifact });
    });

  return {
    runId,
    artifact: {
      id: parentArtifactId,
      runId,
      status: 'complete',
      childrenComplete: 6,
      childrenTotal: 6,
      profilePersistedAt: '2026-06-05T12:05:00.000Z',
    },
    sections: [...sections],
    sectionRuns: sections.map((section) => ({
      id: section.sectionRunId ?? `run-${section.zone}`,
      zone: section.zone,
      status: 'complete',
      startedAt: '2026-06-05T12:00:00.000Z',
      completedAt: '2026-06-05T12:04:00.000Z',
    })),
    journeySession: {
      id: 'session-123',
      profileId: 'profile-123',
      metadata: { websiteUrl: 'https://saaslaunch.example' },
      onboardingData: null,
      updatedAt: '2026-06-05T12:05:00.000Z',
    },
    profile: createProfile(sections),
    share: createShare(sections),
    subjectDomain: 'https://saaslaunch.example',
  };
}

describe('live quality gate', (): void => {
  it('returns pipeline_not_recovered before the parent and six core sections complete', (): void => {
    const input = createCompleteInput({ includePassingCritique: true });
    const result = evaluateLiveQualityGate({
      ...input,
      artifact: {
        ...input.artifact!,
        status: 'running',
        childrenComplete: 4,
      },
    });

    expect(result.verdict).toBe('pipeline_not_recovered');
    expect(result.failures).toContain(
      'parent children_complete=4 is below children_total=6',
    );
  });

  it('keeps a recovered six-section pipeline quality-limited when post-six reader artifacts are missing', (): void => {
    const coreSections = READER_SECTION_IDS.filter((zone) =>
      zone.startsWith('positioning') &&
      ![
        'positioningCrossSectionReasoning',
        'positioningSynthesis',
        'positioningPaidMediaPlan',
      ].includes(zone),
    ).map((zone) => createSectionRow({ zone }));
    const result = evaluateLiveQualityGate(
      createCompleteInput({ sections: coreSections }),
    );

    expect(result.verdict).toBe('pipeline_recovered_quality_limited');
    expect(result.failures).toContain(
      'positioningCrossSectionReasoning artifact row is missing',
    );
  });

  it('keeps insufficient or evidence-gap VoC output out of the 9/10 gate', (): void => {
    const sections = READER_SECTION_IDS.map((zone) => {
      if (zone !== 'positioningVoiceOfCustomer') {
        return createSectionRow({ zone });
      }

      return createSectionRow({
        zone,
        tier: 'insufficient',
        artifact: {
          ...artifactForZone(zone),
          body: {
            ...defaultArtifactForZone(zone).body,
            evidenceGap: true,
            evidenceGapReport: {
              reason: 'insufficient_voice_of_customer_sources',
              summary: 'Could not capture enough independent review bodies.',
              foundPainQuoteCount: 0,
              requiredPainQuoteCount: 10,
              foundDistinctPainSourceCount: 0,
              requiredDistinctPainSourceCount: 3,
              observedPainSourceDomains: [],
              sourcingPlan: ['Retry body acquisition from approved sources.'],
            },
          },
        },
      });
    });
    const result = evaluateLiveQualityGate(
      createCompleteInput({ sections, includePassingCritique: true }),
    );

    expect(result.verdict).toBe('pipeline_recovered_quality_limited');
    expect(result.failures).toContain(
      'positioningVoiceOfCustomer verification_tier is insufficient',
    );
    expect(result.failures).toContain(
      'positioningVoiceOfCustomer has body.evidenceGap=true',
    );
  });

  it('reports VoC evidence-gap acquisition attempts without changing failure semantics', (): void => {
    const sections = READER_SECTION_IDS.map((zone) => {
      if (zone !== 'positioningVoiceOfCustomer') {
        return createSectionRow({ zone });
      }

      return createSectionRow({
        zone,
        tier: 'insufficient',
        artifact: {
          ...artifactForZone(zone),
          body: {
            ...defaultArtifactForZone(zone).body,
            evidenceGap: true,
            evidenceGapReport: {
              reason: 'insufficient_voice_of_customer_sources',
              summary: 'Could not capture enough independent review bodies.',
              foundPainQuoteCount: 0,
              requiredPainQuoteCount: 10,
              foundDistinctPainSourceCount: 0,
              requiredDistinctPainSourceCount: 3,
              observedPainSourceDomains: [],
              acquisitionAttempts: [
                {
                  url: 'https://www.g2.com/products/saaslaunch/reviews',
                  domain: 'g2.com',
                  source: 'reviews',
                  acquisitionMode: 'review_body',
                  status: 'failed',
                  gapReason: 'blocked_js_challenge',
                  message: 'Review bodies blocked by source anti-bot controls.',
                },
                {
                  url: 'https://community.example.com/t/saaslaunch-handoffs',
                  domain: 'community.example.com',
                  source: 'web_search',
                  acquisitionMode: 'forum_comment',
                  status: 'failed',
                  gapReason: 'parser_no_match',
                  message:
                    'Public forum snippets did not expose stable quote URLs.',
                },
              ],
              sourcingPlan: ['Retry body acquisition from approved sources.'],
            },
          },
        },
      });
    });

    const result = evaluateLiveQualityGate(
      createCompleteInput({ sections, includePassingCritique: true }),
    );

    expect(result.verdict).toBe('pipeline_recovered_quality_limited');
    expect(result.failures).toContain(
      'positioningVoiceOfCustomer verification_tier is insufficient',
    );
    expect(result.failures).toContain(
      'positioningVoiceOfCustomer has body.evidenceGap=true',
    );
    expect(
      result.sectionEvidence.find(
        (evidence) => evidence.zone === 'positioningVoiceOfCustomer',
      )?.schemaValid,
    ).toBe(true);
    expect(result.vocAudit.acquisitionModes).toEqual([
      'review_body',
      'forum_comment',
    ]);
    expect(result.vocAudit.gapReasons).toEqual([
      'insufficient_voice_of_customer_sources',
      'blocked_js_challenge',
      'parser_no_match',
    ]);
  });

  it('returns below_9_of_10_gate when evidence and trust pass but rubric score is below nine', (): void => {
    const result = evaluateLiveQualityGate(createCompleteInput());

    expect(result.verdict).toBe('below_9_of_10_gate');
    expect(result.rubricScore.score).toBe(8);
    expect(result.failures).toEqual([]);
  });

  it('returns quality-limited when profile trust tiers diverge from committed section tiers', (): void => {
    const sections = READER_SECTION_IDS.map((zone) =>
      createSectionRow({
        zone,
        tier: zone === 'positioningSynthesis' ? 'needs_review' : 'verified',
      }),
    );
    const input = createCompleteInput({ sections, includePassingCritique: true });
    const profile = createProfile(sections);
    profile.aiInsights = {
      ...profile.aiInsights,
      positioningSynthesis: { verificationTier: 'verified' },
    };

    const result = evaluateLiveQualityGate({
      ...input,
      profile,
    });

    expect(result.verdict).toBe('pipeline_recovered_quality_limited');
    expect(result.failures).toContain(
      'profile ai_insights.positioningSynthesis.verificationTier=verified does not match committed needs_review',
    );
  });

  it('passes only when completion, evidence, rubric, profile, and share gates all pass', (): void => {
    const result = evaluateLiveQualityGate(
      createCompleteInput({ includePassingCritique: true }),
    );

    expect(result.verdict).toBe('nine_of_ten_research_achieved');
    expect(result.failures).toEqual([]);
    expect(result.profileTrust.matched).toBe(true);
    expect(result.shareTrust.matched).toBe(true);
    expect(result.vocAudit.passesQuoteFloor).toBe(true);
    expect(result.rubricScore.score).toBe(10);
  });
});
