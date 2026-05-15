import { describe, expect, it } from 'vitest';

import {
  MAX_SECTION_CONTEXT_PACK_CHARS,
  buildSectionContextPack,
  serializeSectionContextPack,
} from '../section-context-pack';
import { POSITIONING_SECTION_IDS } from '../positioning';
import type { WorkerCapabilities } from '../../capabilities';

const capabilities: WorkerCapabilities['tools'] = {
  webSearch: true,
  spyfu: false,
  firecrawl: false,
  googleAds: false,
  metaAds: false,
  ga4: false,
  charting: true,
};

const gtmBriefSnapshot = {
  companyName: 'Fellow',
  idealCustomer: 'B2B SaaS operators',
  topCompetitors: 'Otter, Fireflies, Avoma',
  activationToPaid: '18%',
  growthTrend: '+12% MoM',
};

const corpus = {
  onboardingFields: {
    companyName: {
      value: 'Fellow',
      sourceUrl: 'https://fellow.app',
      confidence: 0.95,
      reasoning: 'Homepage brand extraction.',
    },
  },
  sourceRefs: [
    {
      title: 'Fellow homepage',
      url: 'https://fellow.app',
      claim: 'AI meeting assistant for teams.',
      confidence: 0.95,
    },
  ],
  excerpts: [
    {
      title: 'Category research',
      url: 'https://example.com/category',
      snippet: 'Meeting automation software is splitting from generic note taking.',
    },
    {
      title: 'ICP research',
      url: 'https://example.com/icp',
      snippet: 'VP Product and RevOps teams run recurring meeting workflows.',
    },
    {
      title: 'Competitor research',
      url: 'https://example.com/competitors',
      snippet: 'Otter and Fireflies position around transcription and summaries.',
    },
    {
      title: 'VoC research',
      url: 'https://example.com/reviews',
      snippet: 'Buyers complain that action items disappear after meetings.',
    },
    {
      title: 'Demand research',
      url: 'https://example.com/demand',
      snippet: 'Searches include AI meeting notes and meeting action item tracker.',
    },
    {
      title: 'Offer research',
      url: 'https://example.com/offer',
      snippet: 'The first value moment is a usable recap after one meeting.',
    },
  ],
};

describe('SectionContextPack', () => {
  it('builds distinct source-addressable excerpt selections for every Section', () => {
    const serializedBySection = POSITIONING_SECTION_IDS.map((sectionId) =>
      serializeSectionContextPack(
        buildSectionContextPack({
          sectionId,
          gtmBriefSnapshot,
          gtmBriefReview: { fieldCount: 47 },
          corpus,
          capabilities,
        }),
      ),
    );

    expect(new Set(serializedBySection).size).toBe(POSITIONING_SECTION_IDS.length);
    expect(serializedBySection[0]).toContain('Category research');
    expect(serializedBySection[1]).toContain('ICP research');
    expect(serializedBySection[2]).toContain('Competitor research');
    expect(serializedBySection[3]).toContain('VoC research');
    expect(serializedBySection[4]).toContain('Demand research');
    expect(serializedBySection[5]).toContain('Offer research');
  });

  it('includes frozen onboarding answers and source refs in every pack', () => {
    for (const sectionId of POSITIONING_SECTION_IDS) {
      const pack = buildSectionContextPack({
        sectionId,
        gtmBriefSnapshot,
        gtmBriefReview: { fieldCount: 47 },
        corpus,
        capabilities,
      });
      const serialized = serializeSectionContextPack(pack);
      expect(serialized).toContain('Fellow');
      expect(serialized).toContain('B2B SaaS operators');
      expect(serialized).toContain('[src-001]');
      expect(serialized).toContain('https://fellow.app');
      expect(pack.sourceRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('clips a large corpus by selecting excerpts instead of dumping and slicing full JSON', () => {
    const largeCorpus = {
      ...corpus,
      unusedBlob: 'giantUnusedMarker '.repeat(5_000),
    };

    const pack = buildSectionContextPack({
      sectionId: 'positioningMarketCategory',
      gtmBriefSnapshot,
      gtmBriefReview: { fieldCount: 47 },
      corpus: largeCorpus,
      capabilities,
    });
    const serialized = serializeSectionContextPack(pack);

    expect(serialized.length).toBeLessThanOrEqual(MAX_SECTION_CONTEXT_PACK_CHARS);
    expect(serialized).toContain('Category research');
    expect(serialized).not.toContain('giantUnusedMarker');
  });

  it('converts unavailable tools into capability gaps', () => {
    const pack = buildSectionContextPack({
      sectionId: 'positioningCompetitorLandscape',
      gtmBriefSnapshot,
      gtmBriefReview: { fieldCount: 47 },
      corpus,
      capabilities,
    });

    expect(pack.capabilityGaps.map((gap) => gap.tool)).toEqual(
      expect.arrayContaining(['spyfu', 'firecrawl', 'googleAds', 'metaAds']),
    );
    expect(serializeSectionContextPack(pack)).toContain('Capability gaps');
  });

  it('sets maxExternalLookups to 2 for all six Sections', () => {
    for (const sectionId of POSITIONING_SECTION_IDS) {
      const pack = buildSectionContextPack({
        sectionId,
        gtmBriefSnapshot,
        gtmBriefReview: { fieldCount: 47 },
        corpus,
        capabilities,
      });
      expect(pack.toolBudget.maxExternalLookups).toBe(2);
      expect(serializeSectionContextPack(pack)).toContain('maxExternalLookups: 2');
    }
  });
});
