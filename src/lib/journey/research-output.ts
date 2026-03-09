export interface ResearchCitation {
  number: number;
  url: string;
  title?: string;
}

export interface ResearchProvenance {
  status: 'sourced' | 'missing';
  citationCount: number;
}

function normalizeCitationTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCitationRecord(
  citation: unknown,
  fallbackNumber: number,
): ResearchCitation | null {
  if (typeof citation === 'string') {
    const url = citation.trim();
    if (!url) return null;
    return { number: fallbackNumber, url };
  }

  if (!citation || typeof citation !== 'object') return null;
  const record = citation as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url) return null;

  return {
    number:
      typeof record.number === 'number' && Number.isFinite(record.number)
        ? record.number
        : fallbackNumber,
    url,
    title: normalizeCitationTitle(record.title) ?? normalizeCitationTitle(record.label),
  };
}

export function parseResearchCitations(
  text: string,
): ResearchCitation[] {
  const citations: ResearchCitation[] = [];
  const refRegex = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)(?:\s+(.+))?/g;
  let match: RegExpExecArray | null;

  while ((match = refRegex.exec(text)) !== null) {
    citations.push({
      number: parseInt(match[1], 10),
      url: match[2],
      title: normalizeCitationTitle(match[3]),
    });
  }

  return citations;
}

export function getResearchCitations(
  output: Record<string, unknown> | undefined,
): ResearchCitation[] {
  const structuredCitations = Array.isArray(output?.citations)
    ? output.citations
        .map((citation, index) => normalizeCitationRecord(citation, index + 1))
        .filter((citation): citation is ResearchCitation => Boolean(citation))
    : [];

  if (structuredCitations.length > 0) return structuredCitations;

  const sourceCitations = Array.isArray(output?.sources)
    ? output.sources
        .map((citation, index) => normalizeCitationRecord(citation, index + 1))
        .filter((citation): citation is ResearchCitation => Boolean(citation))
    : [];

  if (sourceCitations.length > 0) return sourceCitations;

  const content = typeof output?.content === 'string' ? output.content : '';
  return parseResearchCitations(content);
}

export function getResearchProvenance(
  output: Record<string, unknown> | undefined,
  citations: ResearchCitation[],
): ResearchProvenance {
  const raw = output?.provenance;
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    if (record.status === 'sourced' || record.status === 'missing') {
      return {
        status: record.status,
        citationCount:
          typeof record.citationCount === 'number' && Number.isFinite(record.citationCount)
            ? record.citationCount
            : citations.length,
      };
    }
  }

  return {
    status: citations.length > 0 ? 'sourced' : 'missing',
    citationCount: citations.length,
  };
}
