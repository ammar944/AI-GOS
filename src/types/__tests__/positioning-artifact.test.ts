import { describe, expect, it } from 'vitest';

import {
  pickPositioningTypedArtifact,
  type PositioningTypedArtifact,
} from '../positioning-artifact';

const sources = [
  {
    title: 'Customer evidence',
    url: 'https://example.com/customers',
    whyItMatters: 'Shows the ICP pattern.',
  },
] as const;

const buyerIcpBody = {
  icpExistenceCheck: {
    prose: 'The ICP repeats across firmographic cuts.',
    firmographicCuts: [
      {
        cutType: 'industry',
        value: 'B2B SaaS',
        source: 'Customer evidence',
        sourceUrl: 'https://example.com/customers',
      },
    ],
  },
  personaReality: {
    prose: 'Operators own the workflow problem.',
    personas: [],
  },
  awarenessDistribution: {
    prose: 'Demand spans all awareness levels.',
    levels: [],
  },
  buyingContext: {
    prose: 'Trigger moments are operational scaling events.',
    triggers: [],
  },
  clusters: {
    prose: 'The audience congregates in operator venues.',
    venues: [],
  },
} as const;

const flatArtifact: PositioningTypedArtifact = {
  sectionTitle: 'Buyer & ICP Validation',
  verdict: 'The ICP exists.',
  statusSummary: 'Buyer evidence is repeated and specific.',
  confidence: 8,
  sources: [...sources],
  ...buyerIcpBody,
};

const labEnvelope: PositioningTypedArtifact = {
  sectionTitle: flatArtifact.sectionTitle,
  verdict: flatArtifact.verdict,
  statusSummary: flatArtifact.statusSummary,
  confidence: flatArtifact.confidence,
  sources: flatArtifact.sources,
  id: 'section-row-1',
  runId: 'run_1',
  sectionId: 'positioningBuyerICP',
  createdAt: '2026-05-26T00:00:00.000Z',
  body: buyerIcpBody,
};

describe('pickPositioningTypedArtifact', () => {
  it('flattens lab envelope body fields for typed section renderers', (): void => {
    const picked = pickPositioningTypedArtifact(
      { data: labEnvelope },
      'positioningBuyerICP',
    );

    if (!picked) {
      throw new Error('Expected lab envelope to be picked');
    }

    expect(picked.sectionTitle).toBe(labEnvelope.sectionTitle);
    expect(picked.verdict).toBe(labEnvelope.verdict);
    expect(picked.statusSummary).toBe(labEnvelope.statusSummary);
    expect(picked.confidence).toBe(labEnvelope.confidence);
    expect(picked.sources).toEqual(labEnvelope.sources);
    expect(picked.icpExistenceCheck).toEqual(buyerIcpBody.icpExistenceCheck);
    expect(picked.personaReality).toEqual(buyerIcpBody.personaReality);
    expect(picked.awarenessDistribution).toEqual(
      buyerIcpBody.awarenessDistribution,
    );
    expect(picked.buyingContext).toEqual(buyerIcpBody.buyingContext);
    expect(picked.clusters).toEqual(buyerIcpBody.clusters);
    expect(Object.hasOwn(picked, 'body')).toBe(false);
    expect(Object.hasOwn(picked, 'id')).toBe(false);
    expect(Object.hasOwn(picked, 'runId')).toBe(false);
    expect(Object.hasOwn(picked, 'sectionId')).toBe(false);
    expect(Object.hasOwn(picked, 'createdAt')).toBe(false);
  });

  it('keeps already-flat managed artifacts as the same object', (): void => {
    const picked = pickPositioningTypedArtifact(
      { data: flatArtifact },
      'positioningBuyerICP',
    );

    expect(picked).toBe(flatArtifact);
  });
});
