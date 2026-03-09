import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const workerRoot = process.cwd();

describe('compressResearchOutput runtime loading', () => {
  it('loads under ts-node transpile-only without module resolution errors', () => {
    expect(() => {
      execFileSync(
        'node',
        ['-r', 'ts-node/register/transpile-only', '-e', "require('./src/compress.ts')"],
        {
          cwd: workerRoot,
          stdio: 'pipe',
        },
      );
    }).not.toThrow();
  });
});
