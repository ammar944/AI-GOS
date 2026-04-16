import { describe, expect, it, vi } from 'vitest';
import { synthesizeStrategicSynthesis } from '../cards/strategic-synthesis';
import { buildEvidencePack } from '../evidence-packer';
import type { WikiEntry } from '../../wiki';

// ---------------------------------------------------------------------------
// Minimal valid wiki entries
// ---------------------------------------------------------------------------

const makeEntry = (topic: string, content: string): WikiEntry => ({
  topic,
  content,
  source_runner: 'crossAnalysis',
  provenance: 'web_search',
  confidence: 80,
});

// Entries spanning all 5 dimension prefixes
const allSectionsEntries: WikiEntry[] = [
  makeEntry('market_size', '$12B TAM growing at 18% YoY per Gartner 2024'),
  makeEntry('market_trend', 'SMBs moving to cloud-first ops tooling in 2024'),
  makeEntry('icp_persona', 'Ops director, 50-200 person B2B SaaS, fires status meetings'),
  makeEntry('icp_pain', 'Loses 4hr/wk on manual status updates'),
  makeEntry('competitor_name', 'Monday.com'),
  makeEntry('competitor_weakness', 'Monday.com weak on native Slack integration'),
  makeEntry('offer_value_prop', 'Automated status bot that posts weekly recaps without manual input'),
  makeEntry('offer_guarantee', '90-day money-back if admin time not cut by 50%'),
  makeEntry('keyword_primary', 'project management software for ops teams'),
  makeEntry('keyword_negative', 'free project management'),
];

// Only market + icp — no competitor, offer, keyword
const partialEntries: WikiEntry[] = [
  makeEntry('market_size', '$12B TAM growing at 18% YoY per Gartner 2024'),
  makeEntry('market_trend', 'SMBs moving to cloud-first ops tooling in 2024'),
  makeEntry('icp_persona', 'Ops director, 50-200 person B2B SaaS, fires status meetings'),
  makeEntry('icp_pain', 'Loses 4hr/wk on manual status updates'),
  makeEntry('icp_objection', 'Migration complexity from existing tools'),
];

// ---------------------------------------------------------------------------
// Mock client helper
// ---------------------------------------------------------------------------

function makeMockClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  };
}

function makeThrowingClient() {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(new Error('should not be called')),
    },
  };
}

// ---------------------------------------------------------------------------
// Valid response fixture — all 5 dimensions with positive scores
// ---------------------------------------------------------------------------

const validSynthesisJson = JSON.stringify({
  readinessScorecard: {
    overallScore: 7.0,
    overallVerdict: 'green',
    dimensions: [
      {
        value: {
          dimension: 'Market Opportunity',
          score: 8,
          verdict: 'green',
          summary: '$12B TAM with 18% YoY growth and clear cloud-first macro tailwind',
          topSignals: ['18% YoY growth per Gartner', 'SMB cloud-first shift'],
        },
        evidenceIds: ['market_size#1'],
        confidence: 85,
      },
      {
        value: {
          dimension: 'Audience Clarity',
          score: 7,
          verdict: 'green',
          summary: 'Ops director persona with JTBD and pain quantified — strong signal depth',
          topSignals: ['4hr/wk pain signal', 'Ops director profile'],
        },
        evidenceIds: ['icp_persona#1', 'icp_pain#1'],
        confidence: 82,
      },
      {
        value: {
          dimension: 'Competitive Position',
          score: 6,
          verdict: 'yellow',
          summary: 'Monday.com Slack integration gap identified as exploitable attack axis',
          topSignals: ['Monday.com Slack weakness'],
        },
        evidenceIds: ['competitor_weakness#1'],
        confidence: 78,
      },
      {
        value: {
          dimension: 'Offer Strength',
          score: 7,
          verdict: 'green',
          summary: 'Automated status bot with 90-day guarantee hits Hormozi dream outcome and risk reversal',
          topSignals: ['90-day money-back', 'measurable 50% time reduction claim'],
        },
        evidenceIds: ['offer_guarantee#1'],
        confidence: 80,
      },
      {
        value: {
          dimension: 'Keyword Coverage',
          score: 6,
          verdict: 'yellow',
          summary: 'Primary campaign keyword with negative list — no awareness mapping yet',
          topSignals: ['ops-focused primary keyword', 'negative list present'],
        },
        evidenceIds: ['keyword_primary#1'],
        confidence: 72,
      },
    ],
  },
  topActions: [
    {
      value: {
        action: 'Build Slack-native integration to directly counter Monday.com weakness in ads',
        category: 'strategic',
        effort: 'high',
        impact: 'high',
        rationale: 'Monday.com Slack gap identified in competitor intel — direct attack axis',
      },
      evidenceIds: ['competitor_weakness#1'],
      confidence: 85,
    },
    {
      value: {
        action: 'Test "4 hours back per week" hook in top-of-funnel Meta ads to ops directors',
        category: 'quick_win',
        effort: 'low',
        impact: 'high',
        rationale: 'Quantified pain signal from ICP research directly translatable to ad copy',
      },
      evidenceIds: ['icp_pain#1'],
      confidence: 88,
    },
  ],
  strategicNarrative:
    'This client has strong market timing and a clearly differentiated offer but needs to close the keyword coverage gap and complete audience awareness mapping before scaling spend beyond $5k/mo. The Slack integration attack on Monday.com is the highest-leverage creative angle available given current research depth.',
});

// Partial response — all 5 dimensions claimed but only market + icp have data
const partialCoverageSynthesisJson = JSON.stringify({
  readinessScorecard: {
    overallScore: 5.6,
    overallVerdict: 'yellow',
    dimensions: [
      {
        value: {
          dimension: 'Market Opportunity',
          score: 7,
          verdict: 'green',
          summary: '$12B TAM with 18% YoY growth — clear market opportunity',
          topSignals: ['18% YoY growth'],
        },
        evidenceIds: ['market_size#1'],
        confidence: 85,
      },
      {
        value: {
          dimension: 'Audience Clarity',
          score: 8,
          verdict: 'green',
          summary: 'Ops director persona well-defined with JTBD and objection data',
          topSignals: ['4hr/wk pain', 'migration objection'],
        },
        evidenceIds: ['icp_persona#1'],
        confidence: 82,
      },
      {
        value: {
          dimension: 'Competitive Position',
          score: 6,
          verdict: 'yellow',
          summary: 'Some competitor positioning inferred from market data',
          topSignals: ['inferred from market context'],
        },
        evidenceIds: ['market_trend#1'],
        confidence: 55,
      },
      {
        value: {
          dimension: 'Offer Strength',
          score: 7,
          verdict: 'green',
          summary: 'Offer structure inferred from ICP pain — strong perceived value',
          topSignals: ['pain-to-offer mapping'],
        },
        evidenceIds: ['icp_pain#1'],
        confidence: 50,
      },
      {
        value: {
          dimension: 'Keyword Coverage',
          score: 5,
          verdict: 'yellow',
          summary: 'Keywords inferred from persona — not directly researched',
          topSignals: ['persona-implied keywords'],
        },
        evidenceIds: ['icp_persona#1'],
        confidence: 45,
      },
    ],
  },
  topActions: [
    {
      value: {
        action: 'Complete competitor research to fill the Competitive Position gap before launch',
        category: 'strategic',
        effort: 'medium',
        impact: 'high',
        rationale: 'No competitor data in evidence pack — Competitive Position scores 0 after enforcement',
      },
      evidenceIds: ['market_size#1'],
      confidence: 90,
    },
  ],
  strategicNarrative:
    'Strong market opportunity and audience clarity but significant gaps in competitive positioning, offer analysis, and keyword coverage prevent a confident launch recommendation. Prioritize completing the missing research sections before scaling paid media investment.',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('synthesizeStrategicSynthesis', () => {
  describe('gate on thin evidence', () => {
    it('returns null without calling client when pack has 0 entries', async () => {
      const pack = buildEvidencePack('strategic-synthesis', 'crossAnalysis', [], 'run-1', 'user-1');
      const client = makeThrowingClient();

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(result).toBeNull();
      expect(client.messages.create).not.toHaveBeenCalled();
    });

    it('returns null without calling client when pack has 4 entries (below 5 threshold)', async () => {
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        allSectionsEntries.slice(0, 4),
        'run-1',
        'user-1',
      );
      const client = makeThrowingClient();

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(result).toBeNull();
      expect(client.messages.create).not.toHaveBeenCalled();
    });
  });

  describe('valid synthesis', () => {
    it('calls Sonnet and returns parsed card with all 5 dimensions when pack spans all sections', async () => {
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        allSectionsEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient(validSynthesisJson);

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(client.messages.create).toHaveBeenCalledOnce();
      expect(result).not.toBeNull();

      const callArgs = client.messages.create.mock.calls[0][0] as { model: string };
      // Must use STANDARD (Sonnet), not FAST (Haiku)
      expect(callArgs.model).toContain('sonnet');

      const dims = result!.readinessScorecard.dimensions;
      expect(dims).toHaveLength(5);
      const dimNames = dims.map((d) => d.value.dimension);
      expect(dimNames).toContain('Market Opportunity');
      expect(dimNames).toContain('Audience Clarity');
      expect(dimNames).toContain('Competitive Position');
      expect(dimNames).toContain('Offer Strength');
      expect(dimNames).toContain('Keyword Coverage');

      // All dimensions present — none should be forced to 0
      for (const d of dims) {
        expect(d.value.score).toBeGreaterThan(0);
      }

      expect(result!.topActions.length).toBeGreaterThanOrEqual(1);
      expect(result!.strategicNarrative.length).toBeGreaterThan(50);
    });
  });

  describe('DIMENSION_SOURCE_MAP enforcement', () => {
    it('forces score=0/verdict=red for dimensions with no matching wiki entries', async () => {
      // partialEntries has only market_ and icp_ — no competitor_, offer_, keyword_
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        partialEntries,
        'run-1',
        'user-1',
      );
      // Mock returns all 5 dimensions with scores 7, 8, 6, 7, 5
      const client = makeMockClient(partialCoverageSynthesisJson);

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(result).not.toBeNull();

      const dims = result!.readinessScorecard.dimensions;
      const byName = Object.fromEntries(dims.map((d) => [d.value.dimension, d.value]));

      // Preserved — market_ entries present
      expect(byName['Market Opportunity'].score).toBe(7);
      expect(byName['Market Opportunity'].verdict).toBe('green');

      // Preserved — icp_ entries present
      expect(byName['Audience Clarity'].score).toBe(8);
      expect(byName['Audience Clarity'].verdict).toBe('green');

      // Forced — no competitor_ entries
      expect(byName['Competitive Position'].score).toBe(0);
      expect(byName['Competitive Position'].verdict).toBe('red');
      expect(byName['Competitive Position'].summary).toContain('Insufficient data');

      // Forced — no offer_ entries
      expect(byName['Offer Strength'].score).toBe(0);
      expect(byName['Offer Strength'].verdict).toBe('red');

      // Forced — no keyword_ entries
      expect(byName['Keyword Coverage'].score).toBe(0);
      expect(byName['Keyword Coverage'].verdict).toBe('red');

      // overallScore = mean(7, 8, 0, 0, 0) = 3
      expect(result!.readinessScorecard.overallScore).toBe(3);

      // overallVerdict = red (3 < 4)
      expect(result!.readinessScorecard.overallVerdict).toBe('red');
    });
  });

  describe('graceful null on parse failure', () => {
    it('returns null when client returns non-JSON prose', async () => {
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        allSectionsEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient(
        'I am unable to produce a readiness scorecard at this time. Please try again later.',
      );

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(result).toBeNull();
    });

    it('returns null when JSON is missing required schema fields', async () => {
      const invalidJson = JSON.stringify({
        readinessScorecard: {
          overallScore: 5,
          overallVerdict: 'yellow',
          dimensions: [
            {
              value: {
                dimension: 'Market Opportunity',
                score: 5,
                // verdict missing — schema requires it
                summary: 'Some summary that is long enough to pass validation',
                topSignals: [],
              },
              evidenceIds: ['market_size#1'],
              confidence: 70,
            },
          ],
        },
        topActions: [],
        // strategicNarrative missing — schema requires it
      });
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        allSectionsEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient(invalidJson);

      const result = await synthesizeStrategicSynthesis(pack, { client: client as never });

      expect(result).toBeNull();
    });
  });

  describe('identityCard injection', () => {
    it('includes IDENTITY block in user prompt when identityCard is present', async () => {
      const identityCard = { coreKeywords: ['ops', 'automation'], companyName: 'Acme Corp' };
      const pack = buildEvidencePack(
        'strategic-synthesis',
        'crossAnalysis',
        allSectionsEntries,
        'run-1',
        'user-1',
        identityCard,
      );
      const client = makeMockClient(validSynthesisJson);

      await synthesizeStrategicSynthesis(pack, { client: client as never });

      const callArgs = client.messages.create.mock.calls[0][0] as {
        messages: { content: string }[];
      };
      expect(callArgs.messages[0].content).toContain('IDENTITY');
      expect(callArgs.messages[0].content).toContain('coreKeywords');
    });
  });
});
