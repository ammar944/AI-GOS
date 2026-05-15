import { describe, expect, it } from 'vitest';

import { projectAuditArtifact, type ArtifactSectionRow } from '../audit-artifact-view';
import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

const marketCategoryArtifactFixture = {
  sectionTitle: 'Market & Category Intelligence',
  verdict: 'The category is active but buyer language is fragmented.',
  statusSummary: 'Public evidence shows a real category with adjacent confusion.',
  confidence: 7,
  sources: [
    {
      title: 'Category source',
      url: 'https://example.com/category',
      whyItMatters: 'Shows category boundary evidence.',
    },
  ],
  categoryDefinition: {
    prose: 'Pipeline teams compare this with adjacent CRM tooling.',
    adjacentCategories: [
      {
        name: 'Legacy CRM',
        whyBuyersConfuseIt: 'Both claim to manage sales pipeline workflows.',
        disambiguatingSignal: 'The audited product focuses on automated follow-up.',
        sourceTitle: 'CRM comparison',
        sourceUrl: 'https://example.com/crm',
      },
    ],
  },
} satisfies PositioningTypedArtifact;

function normalizedMarketCategoryRow(): ArtifactSectionRow {
  return {
    zone: 'positioningMarketCategory',
    status: 'complete',
    revision: 2,
    section_run_id: 'section-run-market',
    title: 'Market & Category Intelligence',
    markdown: 'markdown fallback',
    claims: [],
    sources: [],
    error: null,
    data: marketCategoryArtifactFixture,
    artifact: null,
    typedArtifact: undefined,
    updated_at: null,
  };
}

describe('projectAuditArtifact', () => {
  it('projects typed artifacts from normalized non-BuyerICP section data', () => {
    const artifact = projectAuditArtifact({
      runId: 'run-typed',
      researchResults: null,
      jobActivity: null,
      artifactSections: {
        positioningMarketCategory: normalizedMarketCategoryRow(),
      },
    });

    const zone = artifact.zones.positioningMarketCategory;

    expect(zone.typedArtifact).toEqual(marketCategoryArtifactFixture);
    expect(zone.sources).toEqual([
      {
        id: 'src::https://example.com/category',
        url: 'https://example.com/category',
        title: 'Category source',
        fetchedAt: null,
        snippet: 'Shows category boundary evidence.',
        zoneId: 'positioningMarketCategory',
      },
    ]);
  });
});
