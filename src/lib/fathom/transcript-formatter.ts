import type { FathomTranscriptSegment } from './types';

export function formatTranscriptAsMarkdown(segments: FathomTranscriptSegment[]): string {
  if (segments.length === 0) return '';
  return segments
    .map((s) => `**${s.speaker.display_name}** (${s.timestamp}): ${s.text}`)
    .join('\n\n');
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
