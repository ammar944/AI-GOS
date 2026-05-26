// Pure function: converts a positioning section JSON envelope into markdown.
// No side effects.

import { formatConfidenceToTen } from '@/lib/research-v2/confidence-display';

export interface SectionKeyFinding {
  title: string;
  detail: string;
  evidence?: string;
  sourceUrl?: string;
}

export interface SectionEvidenceQuote {
  quote: string;
  source: string;
  interpretation?: string;
}

export interface SectionSource {
  title: string;
  url: string;
  whyItMatters?: string;
}

export interface PositioningSectionEnvelope {
  sectionTitle: string;
  specialistAgent?: string;
  skillUsed?: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  keyFindings?: SectionKeyFinding[];
  evidenceQuotes?: SectionEvidenceQuote[];
  risksOrGaps?: string[];
  recommendedMoves?: string[];
  sources?: SectionSource[];
}

export function sectionEnvelopeToMarkdown(
  envelope: PositioningSectionEnvelope,
): string {
  const lines: string[] = [];

  lines.push(`# ${envelope.sectionTitle}`);
  lines.push('');
  lines.push(`> **Verdict:** ${envelope.verdict}`);
  lines.push(`> **Confidence:** ${formatConfidenceToTen(envelope.confidence)}/10`);
  lines.push(`> ${envelope.statusSummary}`);

  if (envelope.keyFindings && envelope.keyFindings.length > 0) {
    lines.push('');
    lines.push('## Key Findings');
    for (const finding of envelope.keyFindings) {
      lines.push(`- **${finding.title}** — ${finding.detail}`);
      if (finding.evidence) {
        lines.push(`  Evidence: ${finding.evidence}`);
      }
      if (finding.sourceUrl) {
        lines.push(`  [Source](${finding.sourceUrl})`);
      }
    }
  }

  if (envelope.evidenceQuotes && envelope.evidenceQuotes.length > 0) {
    lines.push('');
    lines.push('## Verbatim Evidence');
    for (const q of envelope.evidenceQuotes) {
      lines.push(`> "${q.quote}"`);
      lines.push(`> — ${q.source}`);
      if (q.interpretation) {
        lines.push(`> ${q.interpretation}`);
      }
      lines.push('');
    }
  }

  if (envelope.risksOrGaps && envelope.risksOrGaps.length > 0) {
    lines.push('');
    lines.push('## Risks & Gaps');
    for (const risk of envelope.risksOrGaps) {
      lines.push(`- ${risk}`);
    }
  }

  if (envelope.recommendedMoves && envelope.recommendedMoves.length > 0) {
    lines.push('');
    lines.push('## Recommended Moves');
    for (const move of envelope.recommendedMoves) {
      lines.push(`- ${move}`);
    }
  }

  if (envelope.sources && envelope.sources.length > 0) {
    lines.push('');
    lines.push('## Sources');
    for (const src of envelope.sources) {
      const link = `[${src.title}](${src.url})`;
      const why = src.whyItMatters ? ` — ${src.whyItMatters}` : '';
      lines.push(`- ${link}${why}`);
    }
  }

  return lines.join('\n');
}
