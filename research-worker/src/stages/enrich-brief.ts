// GTM stage: enrich-brief.
// Slice 1 Lane C — proves skill-loader plumbing via ingest-identity skill.
// Lane D will merge real identity data into the brief fields.

import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSkill } from '../runtime/skill-loader';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import type { GtmBrief } from '../schemas/gtm/gtm-brief';

export interface EnrichBriefStageInput {
  briefSnapshot: GtmBriefSnapshot;
  skillsRoot?: string;
  cleanupRunDir?: boolean;
}

export interface EnrichBriefStageResult {
  brief: GtmBrief;
  skillExitCode: number;
  skillRunDir: string;
}

export async function runStage(input: EnrichBriefStageInput): Promise<EnrichBriefStageResult> {
  const skillsRoot = input.skillsRoot ?? resolve(__dirname, '../../../skills');
  const skillFolder = join(skillsRoot, 'ingest-identity');

  if (!existsSync(skillFolder)) {
    throw new Error(`enrich-brief: skill folder missing: ${skillFolder}`);
  }

  const handle = await loadSkill(skillFolder);
  const runDir = mkdtempSync(join(tmpdir(), 'gtm-enrich-brief-'));

  const skillInput = {
    run_id: input.briefSnapshot.parentBriefId,
    url: input.briefSnapshot.fields.companyUrl?.value ?? 'https://example.com',
  };
  writeFileSync(join(runDir, 'input.json'), JSON.stringify(skillInput, null, 2));

  const invocation = await handle.invoke(runDir);
  if (invocation.exitCode !== 0) {
    if (input.cleanupRunDir !== false) {
      rmSync(runDir, { recursive: true, force: true });
    }
    throw new Error(
      `enrich-brief: ingest-identity skill exited ${invocation.exitCode}. stderr: ${invocation.stderr}`,
    );
  }

  const outputPath = join(runDir, 'output.json');
  if (!existsSync(outputPath)) {
    if (input.cleanupRunDir !== false) {
      rmSync(runDir, { recursive: true, force: true });
    }
    throw new Error(`enrich-brief: ingest-identity produced no output.json at ${outputPath}`);
  }

  // Parse + discard the scaffold output — Lane D will merge real fields into the brief.
  JSON.parse(readFileSync(outputPath, 'utf8')) as unknown;

  const brief: GtmBrief = {
    briefId: input.briefSnapshot.parentBriefId,
    clientId: null,
    fields: input.briefSnapshot.fields,
    createdAt: input.briefSnapshot.briefCreatedAt,
    updatedAt: input.briefSnapshot.briefUpdatedAt,
  };

  if (input.cleanupRunDir !== false) {
    rmSync(runDir, { recursive: true, force: true });
  }

  return {
    brief,
    skillExitCode: invocation.exitCode,
    skillRunDir: runDir,
  };
}
