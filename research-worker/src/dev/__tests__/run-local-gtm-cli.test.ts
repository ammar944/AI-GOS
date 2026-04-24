import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { GTM_STAGE_KEYS } from '../../schemas/gtm/gtm-run';

describe('run-local-gtm CLI', () => {
  it('writes a deterministic local run directory from the built-in fixture', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'aigos-gtm-local-cli-test-'));

    try {
      const result = spawnSync(
        'node',
        ['-r', 'ts-node/register', 'src/dev/run-local-gtm.ts', '--out', outputDir, '--run-id', 'run_cli_01'],
        {
          cwd: join(__dirname, '..', '..', '..'),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('run_cli_01');
      expect(existsSync(join(outputDir, 'manifest.json'))).toBe(true);

      const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8')) as { stageCount: number };
      expect(manifest.stageCount).toBe(GTM_STAGE_KEYS.length);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
