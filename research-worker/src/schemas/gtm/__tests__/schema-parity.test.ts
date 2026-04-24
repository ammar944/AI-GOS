import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FILES = [
  'evidence.ts',
  'gtm-brief.ts',
  'gtm-brief-snapshot.ts',
  'gtm-run.ts',
  'research-sections.ts',
  'strategy-synthesis.ts',
  'media-plan.ts',
  'script-pack.ts',
];

// __dirname = research-worker/src/schemas/gtm/__tests__
// Five levels up = repo root.
const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const frontendDir = resolve(repoRoot, 'src', 'lib', 'gtm', 'schemas');
const workerDir = resolve(repoRoot, 'research-worker', 'src', 'schemas', 'gtm');

/**
 * Normalize differences expected between the two copies:
 *   1. Strip the mirror-file comment header (worker files only).
 *   2. Rewrite `from './X'` -> `from '@/lib/gtm/schemas/X'` so the bodies match.
 */
function normalize(source: string, isWorker: boolean): string {
  let text = source;
  if (isWorker) {
    text = text.replace(/^\/\/ MIRROR[\s\S]*?parity\.test\.ts\.\n/, '');
    text = text.replace(
      /from '\.\/(evidence|gtm-brief|gtm-brief-snapshot|gtm-run|research-sections|strategy-synthesis|media-plan|script-pack)'/g,
      "from '@/lib/gtm/schemas/$1'",
    );
  }
  return text.replace(/\r\n/g, '\n').trim();
}

describe('gtm schema parity', () => {
  for (const file of FILES) {
    it(`${file} frontend vs worker content matches after normalization`, () => {
      const frontend = readFileSync(resolve(frontendDir, file), 'utf8');
      const worker = readFileSync(resolve(workerDir, file), 'utf8');
      expect(normalize(worker, true)).toBe(normalize(frontend, false));
    });
  }
});
