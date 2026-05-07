import type { CardState } from '@/lib/workspace/types';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';

export interface ReportSource {
  id: string;
  url: string;
  label: string;
  detail?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function sourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function addSource(
  seen: Set<string>,
  sources: ReportSource[],
  url: string,
  detail?: string,
): void {
  const normalized = normalizeUrl(url);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  sources.push({
    id: `source-${sources.length + 1}`,
    url: normalized,
    label: sourceLabel(normalized),
    detail,
  });
}

function walkForSources(
  value: unknown,
  seen: Set<string>,
  sources: ReportSource[],
  context?: string,
): void {
  if (typeof value === 'string') {
    addSource(seen, sources, value, context);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) walkForSources(item, seen, sources, context);
    return;
  }

  if (!isRecord(value)) return;

  const possibleLabel =
    typeof value.title === 'string'
      ? value.title
      : typeof value.name === 'string'
        ? value.name
        : typeof value.label === 'string'
          ? value.label
          : context;

  for (const [key, nested] of Object.entries(value)) {
    const keyLooksLikeSource = /url|source|link|citation|website|href/i.test(key);
    walkForSources(nested, seen, sources, keyLooksLikeSource ? possibleLabel : context);
  }
}

export function extractReportSources(
  cards: CardState[],
  activity?: ResearchJobActivity,
): ReportSource[] {
  const seen = new Set<string>();
  const sources: ReportSource[] = [];

  for (const update of activity?.updates ?? []) {
    if (update.meta?.url) {
      addSource(seen, sources, update.meta.url, update.meta.pageTitle ?? update.message);
    }
  }

  for (const card of cards) {
    walkForSources(card.content, seen, sources, card.label);
  }

  return sources.slice(0, 24);
}
