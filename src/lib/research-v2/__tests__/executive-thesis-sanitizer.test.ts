import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findInternalVocabularyToken } from '../client-surface-sanitizer';
import {
  buildIncompleteExecutiveThesis,
  findMemoBlockingToken,
  MEMO_BLOCKING_TOKENS,
  sanitizeExecutiveThesis,
} from '../executive-thesis-sanitizer';

function gateTokens(name: string): string[] {
  const src = readFileSync(join(process.cwd(), 'scripts/zz-buyer-eval.mjs'), 'utf8');
  const match = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`${name} not found in scripts/zz-buyer-eval.mjs`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
}

function gateSkipKey(key: string): boolean {
  return (
    key === 'verifierSummary' ||
    key === 'decodeRepairs' ||
    key === 'verification' ||
    key === 'review' ||
    key.startsWith('blockGap')
  );
}

// Mirrors evaluateMemo (no skip) + evaluateDenyList (skip) scans of the thesis.
function memoHits(value: unknown): string[] {
  const hits: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (findMemoBlockingToken(node) !== null) hits.push(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node !== null && typeof node === 'object') {
      for (const child of Object.values(node as Record<string, unknown>)) walk(child);
    }
  };
  walk(value);
  return hits;
}

function denyHits(value: unknown): string[] {
  const hits: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (findInternalVocabularyToken(node) !== null) hits.push(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
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

describe('executive-thesis-sanitizer', () => {
  it('stays in parity with the buyer-eval MEMO_BLOCKING_TOKENS', () => {
    expect([...MEMO_BLOCKING_TOKENS].sort()).toEqual(gateTokens('MEMO_BLOCKING_TOKENS').sort());
  });

  it('scrubs blocking + internal vocabulary across nested leaves and preserves status', () => {
    const dirty = {
      status: 'complete',
      executiveThesis: 'Pricing TBD; resolve contradiction before launch.',
      decisions: [{ decision: 'Lead with speed [unverified]; placeholder pending corpus.' }],
      appendix: { contradictions: ['Two readings; contradictions remain.'] },
      rankedMoves: [
        { rank: 1, move: 'Ship the trial flow' },
        { rank: 2, move: 'Ship the trial flow' },
        { rank: 3, move: 'Cut CAC' },
      ],
    };
    const clean = sanitizeExecutiveThesis(dirty);

    expect(clean.status).toBe('complete');
    expect(memoHits(clean)).toEqual([]);
    expect(denyHits(clean)).toEqual([]);
    // duplicate rankedMove dropped + ranks resequenced.
    expect(Array.isArray(clean.rankedMoves)).toBe(true);
    const moves = clean.rankedMoves as { rank: number; move: string }[];
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.rank)).toEqual([1, 2]);
  });

  it('composes a buyer-facing incomplete memo that passes both gate scans', () => {
    const thesis = buildIncompleteExecutiveThesis({
      companyName: 'Airtable',
      generatedAt: '2026-06-15T00:00:00.000Z',
      sections: [
        { sectionId: 'positioningVoiceOfCustomer', label: 'Voice of Customer', verificationTier: 'insufficient' },
        { sectionId: 'positioningMarketCategory', label: 'Market & Category', verificationTier: 'needs_review' },
      ],
    });

    expect(thesis.status).toBe('complete');
    expect(typeof thesis.executiveThesis).toBe('string');
    expect((thesis.executiveThesis as string).length).toBeGreaterThan(0);
    expect(thesis.executiveThesis as string).toContain('Airtable');
    expect(memoHits(thesis)).toEqual([]);
    expect(denyHits(thesis)).toEqual([]);
    const moves = thesis.rankedMoves as { rank: number; move: string }[];
    expect(moves.length).toBeGreaterThanOrEqual(1);
  });

  it('composes a generic incomplete memo when no sections are available', () => {
    const thesis = buildIncompleteExecutiveThesis({
      companyName: 'Acme',
      generatedAt: '2026-06-15T00:00:00.000Z',
    });
    expect(thesis.status).toBe('complete');
    expect(thesis.executiveThesis as string).toContain('Acme');
    expect(memoHits(thesis)).toEqual([]);
  });
});
