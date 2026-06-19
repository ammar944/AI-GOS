import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);

const SECTION_IDS = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
];

test('coverage output files are not read back as probe evidence', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'research-coverage-map-'));
  try {
    const bundleDir = join(cwd, 'tmp/accept/fixture-bundle');
    const probeDir = join(cwd, 'tmp/probe');
    await mkdir(bundleDir, { recursive: true });
    await mkdir(probeDir, { recursive: true });

    await writeJson(join(bundleDir, '_manifest.json'), {
      run_id: 'fixture-run',
      subjectUrl: 'https://example.com',
      briefInput: {},
    });

    for (const sectionId of SECTION_IDS) {
      await writeJson(join(bundleDir, `${sectionId}.json`), { body: {}, sources: [] });
    }

    await writeJson(join(probeDir, 'buyer-acquisition-fixture.json'), { subject: 'Fixture' });
    await writeJson(join(probeDir, 'research-coverage-fixture-bundle.json'), {
      metadata: { probesRead: ['should-not-be-read.json'] },
    });

    const scriptPath = new URL('../zz-research-coverage-map.mjs', import.meta.url);
    await execFileAsync(process.execPath, [scriptPath.pathname, '--bundle', bundleDir], { cwd });

    const output = JSON.parse(await readFile(join(probeDir, 'research-coverage-fixture-bundle.json'), 'utf8'));
    assert.deepEqual(output.metadata.probesRead, ['buyer-acquisition-fixture.json']);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
