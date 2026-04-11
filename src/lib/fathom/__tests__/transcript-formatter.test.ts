import { describe, it, expect } from 'vitest';
import { formatTranscriptAsMarkdown, estimateTokenCount } from '../transcript-formatter';
import type { FathomTranscriptSegment } from '../types';

const SEGMENTS: FathomTranscriptSegment[] = [
  { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'We spend about 15K a month.', timestamp: '00:05:32' },
  { speaker: { display_name: 'Bob', matched_calendar_invitee_email: null }, text: 'What is your biggest challenge?', timestamp: '00:05:38' },
  { speaker: { display_name: 'Alice', matched_calendar_invitee_email: 'alice@acme.com' }, text: 'Tracking ROAS across channels.', timestamp: '00:05:45' },
];

describe('formatTranscriptAsMarkdown', () => {
  it('formats segments as speaker-labeled markdown', () => {
    const result = formatTranscriptAsMarkdown(SEGMENTS);
    expect(result).toContain('**Alice** (00:05:32): We spend about 15K a month.');
    expect(result).toContain('**Bob** (00:05:38): What is your biggest challenge?');
    expect(result).toContain('**Alice** (00:05:45): Tracking ROAS across channels.');
  });

  it('handles empty transcript', () => {
    expect(formatTranscriptAsMarkdown([])).toBe('');
  });
});

describe('estimateTokenCount', () => {
  it('estimates ~4 chars per token', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokenCount(text)).toBe(100);
  });
});
