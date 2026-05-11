import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '../keyword-intel-detail';

describe('JourneyKeywordIntelDetail', () => {
  it('renders grouped keyword plans, starting set recommendations, negatives, and confidence notes', () => {
    render(
      <JourneyKeywordIntelDetail
        data={{
          totalKeywordsFound: 42,
          competitorGapCount: 9,
          campaignGroups: [
            {
              campaign: 'Competitor Alternatives',
              intent: 'bottom-of-funnel',
              recommendedMonthlyBudget: 1800,
              adGroups: [
                {
                  name: 'Hey Digital Alternatives',
                  recommendedMatchTypes: ['phrase', 'exact'],
                  keywords: [
                    {
                      keyword: 'hey digital alternative',
                      searchVolume: 480,
                      difficulty: 'medium',
                      estimatedCpc: '$18.40',
                      priorityScore: 89,
                      confidence: 'high',
                    },
                  ],
                  negativeKeywords: ['jobs', 'salary'],
                },
              ],
            },
          ],
          topOpportunities: [
            {
              keyword: 'b2b saas demand generation agency',
              searchVolume: 1900,
              difficulty: 'medium',
              estimatedCpc: '$18.40',
              priorityScore: 86,
              confidence: 'high',
            },
          ],
          recommendedStartingSet: [
            {
              keyword: 'hey digital alternative',
              campaign: 'Competitor Alternatives',
              adGroup: 'Hey Digital Alternatives',
              recommendedMonthlyBudget: 700,
              reason: 'High-intent comparison term with clear switching signal.',
              priorityScore: 89,
            },
          ],
          competitorGaps: [
            {
              keyword: 'hey digital alternative',
              competitorName: 'Hey Digital',
              searchVolume: 480,
              estimatedCpc: '$18.40',
              priorityScore: 89,
            },
            {
              keyword: 'sales captain alternative',
              competitorName: 'Sales Captain',
              searchVolume: 210,
              estimatedCpc: '$14.20',
              priorityScore: 71,
            },
          ],
          negativeKeywords: [
            {
              keyword: 'jobs',
              reason: 'Employment intent, not buyer intent.',
            },
          ],
          confidenceNotes: [
            'Competitor-gap volume is directional because SpyFu coverage is sparse in this niche.',
          ],
          quickWins: [
            'Launch competitor alternative campaigns immediately.',
            'Own the outsourced demand gen intent cluster.',
          ],
        }}
      />,
    );

    // Hero stats (inline row)
    expect(screen.getByText('Keywords Found')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    // Section headings
    expect(screen.getByText('Campaign groups')).toBeInTheDocument();
    expect(screen.getByText('Recommended starting set')).toBeInTheDocument();
    expect(screen.getAllByText(/Negative keywords/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confidence notes/)).toBeInTheDocument();
    expect(screen.getByText('Competitor gaps')).toBeInTheDocument();
    expect(screen.getByText('Quick wins')).toBeInTheDocument();
    // Data content
    expect(screen.getByText('Competitor Alternatives')).toBeInTheDocument();
    expect(screen.getByText('Hey Digital Alternatives')).toBeInTheDocument();
    expect(screen.getByText('High-intent comparison term with clear switching signal.')).toBeInTheDocument();
    expect(screen.getByText('b2b saas demand generation agency')).toBeInTheDocument();
    expect(screen.getByText('Hey Digital')).toBeInTheDocument();
    expect(screen.getByText('Launch competitor alternative campaigns immediately.')).toBeInTheDocument();
    // Negative keyword reason is now in title attribute (tooltip)
    expect(screen.getByTitle('Employment intent, not buyer intent.')).toBeInTheDocument();
  });

  it('handles sparse payloads without throwing and shows empty-state copy', () => {
    render(
      <JourneyKeywordIntelDetail
        data={{
          totalKeywordsFound: 0,
          competitorGapCount: 0,
          campaignGroups: [],
          topOpportunities: [],
          recommendedStartingSet: [],
          competitorGaps: [],
          negativeKeywords: [],
          confidenceNotes: [],
          quickWins: [],
        }}
      />,
    );

    expect(screen.getByText('No keyword opportunities were returned.')).toBeInTheDocument();
    expect(screen.getByText('No competitor gaps were returned.')).toBeInTheDocument();
    expect(screen.getByText('No quick wins were returned.')).toBeInTheDocument();
  });

  it('coerces raw keyword records into the dedicated detail schema', () => {
    expect(
      getJourneyKeywordIntelDetailData({
        totalKeywordsFound: 42,
        competitorGapCount: 9,
        campaignGroups: [
          {
            campaign: 'Competitor Alternatives',
            intent: 'bottom-of-funnel',
            recommendedMonthlyBudget: 1800,
            adGroups: [
              {
                name: 'Hey Digital Alternatives',
                recommendedMatchTypes: ['phrase'],
                keywords: [
                  {
                    keyword: 'hey digital alternative',
                    searchVolume: 480,
                    difficulty: 'medium',
                    estimatedCpc: '$18.40',
                    priorityScore: 89,
                    confidence: 'high',
                  },
                ],
                negativeKeywords: ['jobs'],
              },
            ],
          },
        ],
        topOpportunities: [
          {
            keyword: 'b2b saas demand generation agency',
            searchVolume: 1900,
            difficulty: 'medium',
            estimatedCpc: '$18.40',
            priorityScore: 86,
            confidence: 'high',
          },
          { keyword: 123 },
        ],
        recommendedStartingSet: [
          {
            keyword: 'hey digital alternative',
            campaign: 'Competitor Alternatives',
            adGroup: 'Hey Digital Alternatives',
            recommendedMonthlyBudget: 700,
            reason: 'High-intent comparison term with clear switching signal.',
            priorityScore: 89,
          },
          { keyword: 123 },
        ],
        competitorGaps: [
          {
            keyword: 'hey digital alternative',
            competitorName: 'Hey Digital',
            searchVolume: 480,
            estimatedCpc: '$18.40',
            priorityScore: 89,
          },
          null,
        ],
        negativeKeywords: [{ keyword: 'jobs', reason: 'Employment intent' }, null],
        confidenceNotes: ['Directional', 123],
        quickWins: ['Launch competitor alternative campaigns immediately.', 123],
      }),
    ).toEqual({
      totalKeywordsFound: 42,
      competitorGapCount: 9,
      campaignGroups: [
        {
          campaign: 'Competitor Alternatives',
          intent: 'bottom-of-funnel',
          recommendedMonthlyBudget: 1800,
          adGroups: [
            {
              name: 'Hey Digital Alternatives',
              recommendedMatchTypes: ['phrase'],
              keywords: [
                {
                  keyword: 'hey digital alternative',
                  searchVolume: 480,
                  difficulty: 'medium',
                  estimatedCpc: '$18.40',
                  priorityScore: 89,
                  confidence: 'high',
                },
              ],
              negativeKeywords: ['jobs'],
            },
          ],
        },
      ],
      topOpportunities: [
        {
          keyword: 'b2b saas demand generation agency',
          searchVolume: 1900,
          difficulty: 'medium',
          estimatedCpc: '$18.40',
          priorityScore: 86,
          confidence: 'high',
        },
      ],
      recommendedStartingSet: [
        {
          keyword: 'hey digital alternative',
          campaign: 'Competitor Alternatives',
          adGroup: 'Hey Digital Alternatives',
          recommendedMonthlyBudget: 700,
          reason: 'High-intent comparison term with clear switching signal.',
          priorityScore: 89,
        },
      ],
      competitorGaps: [
        {
          keyword: 'hey digital alternative',
          competitorName: 'Hey Digital',
          searchVolume: 480,
          estimatedCpc: '$18.40',
          priorityScore: 89,
        },
      ],
      negativeKeywords: [{ keyword: 'jobs', reason: 'Employment intent' }],
      confidenceNotes: ['Directional'],
      quickWins: ['Launch competitor alternative campaigns immediately.'],
    });
  });
});
