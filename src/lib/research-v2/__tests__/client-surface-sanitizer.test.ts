import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CLIENT_SURFACE_DENY_TOKENS,
  findInternalVocabularyToken,
  sanitizeArtifactForClientSurface,
  scrubClientSurfaceText,
} from '../client-surface-sanitizer';

function gateDenyList(): string[] {
  const src = readFileSync(join(process.cwd(), 'scripts/zz-buyer-eval.mjs'), 'utf8');
  const match = src.match(/const DENY_LIST = \[([\s\S]*?)\];/);
  if (!match) throw new Error('DENY_LIST not found in scripts/zz-buyer-eval.mjs');
  return [...match[1].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
}

// Mirrors the gate's collectStringLeaves + denyListSkipKey so the test asserts
// against the exact production check.
function gateSkipKey(key: string): boolean {
  return (
    key === 'verifierSummary' ||
    key === 'decodeRepairs' ||
    key === 'verification' ||
    key === 'review' ||
    key.startsWith('blockGap')
  );
}

function scanForDenyHits(value: unknown): string[] {
  const hits: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (findInternalVocabularyToken(node) !== null) hits.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (gateSkipKey(key)) continue;
        walk(child);
      }
    }
  };
  walk(value);
  return hits;
}

describe('client-surface-sanitizer', () => {
  it('stays in parity with the buyer-eval gate DENY_LIST', () => {
    expect([...CLIENT_SURFACE_DENY_TOKENS].sort()).toEqual(gateDenyList().sort());
  });

  it('removes every deny token from a string so the gate would accept it', () => {
    for (const token of CLIENT_SURFACE_DENY_TOKENS) {
      const sample = `The ${token} was noted in this point about the buyer.`;
      expect(findInternalVocabularyToken(scrubClientSurfaceText(sample))).toBeNull();
    }
  });

  it('re-expresses a leading "evidence gap:" marker in buyer-facing language', () => {
    const cleaned = scrubClientSurfaceText('evidence gap: no third-party reviews found');
    expect(cleaned.toLowerCase().startsWith('evidence gap:')).toBe(false);
    expect(cleaned).toContain('Not enough public evidence');
    expect(findInternalVocabularyToken(cleaned)).toBeNull();
  });

  it('strips bracketed verification markers', () => {
    expect(scrubClientSurfaceText('Pricing is $40/seat [unverified]')).toBe('Pricing is $40/seat');
    expect(findInternalVocabularyToken(scrubClientSurfaceText('Claim [verified by source]'))).toBeNull();
  });

  it('preserves URLs untouched', () => {
    const url = 'https://spyfu.com/overview/corpus?x=web_search';
    expect(scrubClientSurfaceText(url)).toBe(url);
  });

  it('cleans the four observed run-09f694d7 leak shapes and passes the gate scan', () => {
    const artifact = {
      sectionId: 'positioningCompetitorLandscape',
      verdict: 'Competitors run displayable creatives across the corpus.',
      body: {
        clusters: { prose: 'Filed under blockGap until the next prepass.' },
        awarenessDistribution: {
          levels: [{ level: 'unaware', evidence: 'Synthesized from corpus and web_search.' }],
        },
        adEvidence: {
          advertiserGroups: [
            {
              advertiserName: 'Acme',
              verifiedCount: 12,
              quarantinedCount: 3,
              dataGaps: [
                { internalDetail: 'only displayable creatives counted', reason: 'No active ads in region.' },
              ],
            },
          ],
        },
        adPresence: {
          signals: [
            {
              competitor: 'Acme',
              evidence: 'verifiedCount was 0 for this advertiser.',
              sourceUrl: 'https://example.com/x',
            },
          ],
        },
        // Internal subtrees the gate skips — must be preserved verbatim.
        blockGap: { summary: 'evidence gap: pricing not public' },
        verification: { note: 'corpus liveness prepass details' },
      },
    };

    const cleaned = sanitizeArtifactForClientSurface(artifact);

    // Whole sanitized artifact passes the gate's deny-list scan.
    expect(scanForDenyHits(cleaned)).toEqual([]);

    const body = (cleaned as { body: Record<string, unknown> }).body;
    const group = (
      (body.adEvidence as { advertiserGroups: Record<string, unknown>[] }).advertiserGroups[0]
    );
    // internalDetail dropped; numeric verifiedCount preserved (numbers unscanned).
    expect((group.dataGaps as Record<string, unknown>[])[0]).not.toHaveProperty('internalDetail');
    expect((group.dataGaps as Record<string, unknown>[])[0].reason).toBe('No active ads in region.');
    expect(group.verifiedCount).toBe(12);
    expect(group.quarantinedCount).toBe(3);

    // Skip-key subtrees preserved verbatim (gate skips them too).
    expect((body.blockGap as { summary: string }).summary).toBe('evidence gap: pricing not public');
    expect((body.verification as { note: string }).note).toBe('corpus liveness prepass details');

    // URL preserved.
    expect((body.adPresence as { signals: { sourceUrl: string }[] }).signals[0].sourceUrl).toBe(
      'https://example.com/x',
    );
  });

  it('never empties a required string field (falls back to a neutral phrase)', () => {
    expect(scrubClientSurfaceText('[unverified]')).toBe('Not available.');
  });
});
