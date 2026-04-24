import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLocalGtmFixtureSnapshot } from '../../dev/local-fixture';
import { runGtmWorkflow } from '../run-gtm-workflow';

describe('runGtmWorkflow with realStages', () => {
  it('invokes ingest-identity skill for the enrich-brief stage and keeps other stages fixture-backed', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'aigos-gtm-real-test-'));

    try {
      const result = await runGtmWorkflow({
        runId: 'run_real_01',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        outputDir,
        now: '2026-04-24T13:00:00.000Z',
        realStages: ['enrich-brief'],
      });

      expect(result.mode).toBe('local-mixed');
      expect(result.realStages).toEqual(['enrich-brief']);

      const enrich = result.stages.find((stage) => stage.stage === 'enrich-brief');
      expect(enrich).toBeDefined();
      expect(enrich?.executionMode).toBe('skill-invoked');
      expect(enrich?.notes).toContain('ingest-identity skill invoked');

      const market = result.stages.find((stage) => stage.stage === 'research-market-category');
      expect(market?.executionMode).toBe('fixture');

      const manifestPath = join(outputDir, 'manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        mode: string;
        realStages: string[];
      };
      expect(manifest.mode).toBe('local-mixed');
      expect(manifest.realStages).toEqual(['enrich-brief']);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 30000);

  it('rejects unknown stage keys in realStages', async () => {
    await expect(
      runGtmWorkflow({
        runId: 'run_reject_01',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        // @ts-expect-error — intentionally invalid stage key for this test
        realStages: ['not-a-real-stage'],
      }),
    ).rejects.toThrow(/Unknown GTM stage/);
  });

  it('rejects stages that have no real adapter wired yet', async () => {
    await expect(
      runGtmWorkflow({
        runId: 'run_reject_02',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        realStages: ['synthesize-strategy'],
      }),
    ).rejects.toThrow(/has no real adapter in slice 1/);
  });
});
