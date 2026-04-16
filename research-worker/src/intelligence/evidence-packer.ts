/**
 * Evidence packer — deterministic wiki → EvidencePack builder.
 *
 * Zero LLM calls. Pure filter + sort. Output is stable across runs
 * given the same input, so cache-friendly and test-friendly.
 *
 * Topic filters mirror the dispatch-route RUNNER_WIKI_TOPICS pattern
 * (glob-style with '*' prefix matching).
 */
import type { WikiEntry } from '../wiki';
import type { EvidencePack } from './types';

/**
 * Per-card wiki topic filter. '*' matches anything; 'identity_*' matches
 * any topic starting with 'identity_'; exact strings match exact topics.
 *
 * Card names use kebab-case to match the dispatcher trigger map.
 */
export const CARD_TOPIC_FILTERS: Record<string, string[]> = {
  opportunity: ['identity_*', 'market_*', 'pain_*', 'trend_*'],
  'white-space-gap': [
    'identity_*',
    'competitor_*',
    'offer_value_prop',
    'offer_pricing',
    'market_*',
  ],
  'offer-statement': [
    'identity_*',
    'offer_*',
    'icp_trigger',
    'icp_objection',
    'competitor_positioning',
  ],
  'strategic-synthesis': ['*'],
};

/**
 * Returns true if a wiki topic matches one of the card's topic patterns.
 * Supports '*' (match all) and 'prefix_*' (match prefix).
 */
export function matchesTopic(topic: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      if (topic.startsWith(pattern.slice(0, -1))) return true;
      continue;
    }
    if (topic === pattern) return true;
  }
  return false;
}

/**
 * Build a deterministic evidence pack for the given card.
 * Sort order: topic alpha → source_runner alpha → content alpha.
 * IDs: `topic#N` where N is 1-indexed across entries sharing the same topic.
 */
export function buildEvidencePack(
  cardName: string,
  section: string,
  wikiEntries: WikiEntry[],
  runId: string,
  userId: string,
  identityCard?: unknown,
): EvidencePack {
  const patterns = CARD_TOPIC_FILTERS[cardName] ?? ['*'];

  const filtered = wikiEntries.filter((e) => matchesTopic(e.topic, patterns));

  filtered.sort((a, b) => {
    const byTopic = a.topic.localeCompare(b.topic);
    if (byTopic !== 0) return byTopic;
    const byRunner = a.source_runner.localeCompare(b.source_runner);
    if (byRunner !== 0) return byRunner;
    return a.content.localeCompare(b.content);
  });

  const topicCounter = new Map<string, number>();
  const entryIds = filtered.map((e) => {
    const n = (topicCounter.get(e.topic) ?? 0) + 1;
    topicCounter.set(e.topic, n);
    return `${e.topic}#${n}`;
  });

  return {
    cardName,
    section,
    entries: filtered,
    entryIds,
    identityCard,
    runId,
    userId,
  };
}

/**
 * Format evidence pack as a plain-text block for insertion into a card
 * synthesis prompt. Each entry is rendered as:
 *   [topic#N] content (provenance) [source_url?]
 */
export function formatEvidencePack(pack: EvidencePack): string {
  if (pack.entries.length === 0) return '(no evidence available)';
  const lines = pack.entries.map((e, i) => {
    const id = pack.entryIds[i];
    const prov = e.provenance ? ` (${e.provenance})` : '';
    const url = e.source_url ? ` [${e.source_url}]` : '';
    return `[${id}] ${e.content}${prov}${url}`;
  });
  return lines.join('\n');
}
