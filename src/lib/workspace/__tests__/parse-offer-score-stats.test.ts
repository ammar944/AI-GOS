import { describe, it, expect } from 'vitest';
import { parseOfferScoreFromStats } from '../parse-offer-score-stats';

describe('parseOfferScoreFromStats', () => {
  it('extracts overall and dimensions; skips recommendation text', () => {
    const stats = [
      { label: 'Overall Score', value: '7/10' },
      { label: 'Recommendation', value: 'ready to scale' },
      { label: 'Pain Relevance', value: '8/10' },
      { label: 'Urgency', value: '6/10' },
    ];
    const r = parseOfferScoreFromStats(stats);
    expect(r).not.toBeNull();
    expect(r!.overall).toBe(7);
    expect(r!.dimensions).toEqual([
      { label: 'Pain Relevance', value: 8 },
      { label: 'Urgency', value: 6 },
    ]);
  });

  it('returns null when overall missing', () => {
    expect(parseOfferScoreFromStats([{ label: 'Pain Relevance', value: '8/10' }])).toBeNull();
  });
});
