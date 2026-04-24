import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLocalGtmFixtureSnapshot } from '../../dev/local-fixture';
import { GTM_STAGE_KEYS } from '../../schemas/gtm/gtm-run';
import { runGtmWorkflow } from '../run-gtm-workflow';

describe('runGtmWorkflow', () => {
  it('runs the full GTM workflow locally with deterministic fixture outputs', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'aigos-gtm-local-test-'));

    try {
      const result = await runGtmWorkflow({
        runId: 'run_local_01',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        outputDir,
        now: '2026-04-24T13:00:00.000Z',
      });

      expect(result.runId).toBe('run_local_01');
      expect(result.mode).toBe('local-fixture');
      expect(result.stages.map((stage) => stage.stage)).toEqual([...GTM_STAGE_KEYS]);
      expect(result.stages.every((stage) => stage.status === 'completed')).toBe(true);
      expect(result.stages.find((stage) => stage.stage === 'research-competitors')?.command).toBe('/research-competitor');

      const manifestPath = join(outputDir, 'manifest.json');
      const competitorStagePath = join(outputDir, 'stages', '07-research-competitors.json');
      expect(existsSync(manifestPath)).toBe(true);
      expect(existsSync(competitorStagePath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { stageCount: number };
      expect(manifest.stageCount).toBe(GTM_STAGE_KEYS.length);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
