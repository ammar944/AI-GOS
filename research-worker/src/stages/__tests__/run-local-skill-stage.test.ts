import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalGtmStageConfig } from '../../runtime/local-stage-registry';
import { buildEmptyGtmBrief, type GtmBrief } from '../../schemas/gtm/gtm-brief';
import { freezeBriefAsSnapshot } from '../../schemas/gtm/gtm-brief-snapshot';
import { runLocalSkillStage } from '../run-local-skill-stage';

const originalPath = process.env.PATH;
const originalExecutor = process.env.AIGOS_LOCAL_SKILL_EXECUTOR;
const originalAgentLogs = process.env.AIGOS_GTM_AGENT_LOGS;

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'aigos-local-skill-'));
  process.env.AIGOS_LOCAL_SKILL_EXECUTOR = 'codex-cli';
  process.env.AIGOS_GTM_AGENT_LOGS = 'off';
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  restoreEnv('PATH', originalPath);
  restoreEnv('AIGOS_LOCAL_SKILL_EXECUTOR', originalExecutor);
  restoreEnv('AIGOS_GTM_AGENT_LOGS', originalAgentLogs);
});

describe('runLocalSkillStage', () => {
  it('blocks an agent-owned stage with actionable diagnostics when the agent exits 0 without output.json or fragments', async () => {
    const binDir = join(tempRoot, 'bin');
    const workspaceRoot = join(tempRoot, 'workspace');
    const skillsRoot = join(workspaceRoot, 'skills');
    const skillFolder = join(skillsRoot, 'research-icp');
    const runDir = join(tempRoot, 'runs', 'run_missing_output', '06-research-buyer-icp');
    const outputPath = join(runDir, 'output.json');
    const fragmentsPath = join(runDir, 'fragments');

    mkdirSync(binDir, { recursive: true });
    mkdirSync(skillFolder, { recursive: true });
    writeFileSync(
      join(binDir, 'codex'),
      '#!/bin/sh\nwhile IFS= read -r _line; do :; done\nexit 0\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(skillFolder, 'package.json'),
      JSON.stringify({ name: 'research-icp', private: true, scripts: {} }),
    );
    process.env.PATH = `${binDir}:${originalPath ?? ''}`;

    const result = await runLocalSkillStage({
      config: researchIcpConfig,
      runId: 'run_missing_output',
      briefSnapshot: makeBriefSnapshot(),
      generatedAt: '2026-05-04T05:00:00.000Z',
      runDir,
      skillsRoot,
      priorSkillOutputs: new Map(),
    });

    expect(result.status).toBe('blocked');
    expect(result.skillExitCode).toBe(0);
    expect(result.blocker).toContain('run_id=run_missing_output');
    expect(result.blocker).toContain('stage=research-buyer-icp');
    expect(result.blocker).toContain(`run_dir=${runDir}`);
    expect(result.blocker).toContain(outputPath);
    expect(result.blocker).toContain(fragmentsPath);
    expect(result.blocker).toContain('Next action:');
  });
});

const researchIcpConfig: LocalGtmStageConfig = {
  stage: 'research-buyer-icp',
  command: '/research-icp',
  skill: 'research-icp',
  executionType: 'agent-command',
  outputFile: '06-research-buyer-icp.json',
};

function makeBriefSnapshot(): ReturnType<typeof freezeBriefAsSnapshot> {
  const now = '2026-05-04T05:00:00.000Z';
  const brief = buildEmptyGtmBrief({
    briefId: 'brief_run_missing_output',
    createdAt: now,
    updatedAt: now,
  });
  const fields: GtmBrief['fields'] = {
    ...brief.fields,
    companyName: {
      ...brief.fields.companyName,
      value: 'Airtable',
      status: 'confirmed',
      confidence: 'high',
    },
    companyUrl: {
      ...brief.fields.companyUrl,
      value: 'https://www.airtable.com/',
      status: 'confirmed',
      confidence: 'high',
    },
    category: {
      ...brief.fields.category,
      value: 'No-code database',
      status: 'confirmed',
      confidence: 'high',
    },
  };

  return freezeBriefAsSnapshot(
    {
      ...brief,
      fields,
    },
    {
      snapshotId: 'snapshot_run_missing_output',
      now,
    },
  );
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
