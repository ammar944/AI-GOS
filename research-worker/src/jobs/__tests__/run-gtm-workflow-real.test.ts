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
        agentFragments: {
          identity: {
            run_id: 'run_real_01',
            company_name: 'Fixture Inc.',
            domain: 'fixture.example',
            category: 'B2B SaaS',
            sources: [
              {
                source_url: 'https://fixture.example',
                retrieved_at: '2026-04-24T12:15:00.000Z',
                describes: 'company_name',
              },
            ],
          },
        },
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

  it('merges agent-supplied identity fragment into the enriched brief fields', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'aigos-gtm-real-merge-'));

    try {
      const result = await runGtmWorkflow({
        runId: 'run_real_merge',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        outputDir,
        now: '2026-04-24T13:00:00.000Z',
        realStages: ['enrich-brief'],
        agentFragments: {
          identity: {
            run_id: 'run_real_merge',
            company_name: 'Acme Corp',
            domain: 'acme.io',
            category: 'B2B Fintech',
            core_keywords: ['acme fintech platform', 'payment ops automation'],
            negative_keywords: ['acme products inc (industrial)'],
            sources: [
              {
                source_url: 'https://acme.io',
                retrieved_at: '2026-04-24T12:30:00.000Z',
                describes: 'company_name',
              },
              {
                source_url: 'https://acme.io/about',
                retrieved_at: '2026-04-24T12:30:00.000Z',
                describes: 'category',
              },
            ],
          },
        },
      });

      const enrich = result.stages.find((stage) => stage.stage === 'enrich-brief');
      expect(enrich).toBeDefined();
      expect(enrich?.executionMode).toBe('skill-invoked');
      expect(enrich?.notes).toMatch(/merged fields: companyName, companyUrl, category/);

      const enrichedBrief = enrich?.output as {
        fields: Record<string, { value: string; status: string; updatedBy: string; sources: unknown[] }>;
      };
      expect(enrichedBrief.fields.companyName.value).toBe('Acme Corp');
      expect(enrichedBrief.fields.companyUrl.value).toBe('acme.io');
      expect(enrichedBrief.fields.category.value).toBe('B2B Fintech');
      expect(enrichedBrief.fields.companyName.status).toBe('suggested');
      expect(enrichedBrief.fields.companyName.updatedBy).toBe('ai');
      expect(enrichedBrief.fields.companyName.sources.length).toBeGreaterThan(0);

      // Unrelated fields should remain untouched from the fixture snapshot
      expect(enrichedBrief.fields.productDescription.value).toContain('AI-powered');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 30000);

  it('rejects stages that have no real adapter wired yet', async () => {
    await expect(
      runGtmWorkflow({
        runId: 'run_reject_02',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        realStages: ['synthesize-strategy'],
      }),
    ).rejects.toThrow(/has no real adapter in slice 1/);
  });

  it('rejects scaffold output when no identity fragment is supplied (sanity-check gate)', async () => {
    const prev = process.env.ALLOW_SUSPECT;
    delete process.env.ALLOW_SUSPECT;
    try {
      await expect(
        runGtmWorkflow({
          runId: 'run_sanity_reject',
          briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
          now: '2026-04-24T13:00:00.000Z',
          realStages: ['enrich-brief'],
        }),
      ).rejects.toThrow(/ingest-identity skill exited/);
    } finally {
      if (prev !== undefined) process.env.ALLOW_SUSPECT = prev;
    }
  }, 30000);

  it('allows scaffold output when ALLOW_SUSPECT=1 is set (dev escape hatch)', async () => {
    const prev = process.env.ALLOW_SUSPECT;
    process.env.ALLOW_SUSPECT = '1';
    try {
      const result = await runGtmWorkflow({
        runId: 'run_sanity_bypass',
        briefSnapshot: buildLocalGtmFixtureSnapshot('2026-04-24T12:00:00.000Z'),
        now: '2026-04-24T13:00:00.000Z',
        realStages: ['enrich-brief'],
      });

      const enrich = result.stages.find((stage) => stage.stage === 'enrich-brief');
      expect(enrich?.executionMode).toBe('skill-invoked');
      // Scaffold output has category="unknown" and domain-as-company_name, so
      // all three mapped fields get merged when the gate is bypassed.
      expect(enrich?.notes).toMatch(/merged fields:/);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_SUSPECT;
      else process.env.ALLOW_SUSPECT = prev;
    }
  }, 30000);
});
