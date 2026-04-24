import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLocalGtmStageConfigs, type LocalGtmStageConfig } from '../runtime/local-stage-registry';
import { validateGtmStageOutput } from '../runtime/output-validator';
import { type GtmBrief } from '../schemas/gtm/gtm-brief';
import { type GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import { type GtmStageKey } from '../schemas/gtm/gtm-run';

export type LocalGtmWorkflowMode = 'local-fixture';
export type LocalGtmStageStatus = 'completed';

export interface RunGtmWorkflowInput {
  runId: string;
  briefSnapshot: GtmBriefSnapshot;
  outputDir?: string;
  now?: string;
}

export interface LocalGtmStageResult {
  stage: GtmStageKey;
  status: LocalGtmStageStatus;
  command: string;
  skill: string;
  executionType: LocalGtmStageConfig['executionType'];
  outputFile: string;
  output: unknown;
}

export interface LocalGtmWorkflowResult {
  runId: string;
  mode: LocalGtmWorkflowMode;
  generatedAt: string;
  outputDir: string | null;
  stageCount: number;
  stages: LocalGtmStageResult[];
}

export async function runGtmWorkflow(input: RunGtmWorkflowInput): Promise<LocalGtmWorkflowResult> {
  const generatedAt = input.now ?? new Date().toISOString();
  const stages = getLocalGtmStageConfigs().map((config) => runLocalStage(config, input.briefSnapshot, generatedAt));
  const result: LocalGtmWorkflowResult = {
    runId: input.runId,
    mode: 'local-fixture',
    generatedAt,
    outputDir: input.outputDir ?? null,
    stageCount: stages.length,
    stages,
  };

  if (input.outputDir) {
    writeLocalRunDirectory(result, input.outputDir);
  }

  return result;
}

function runLocalStage(
  config: LocalGtmStageConfig,
  briefSnapshot: GtmBriefSnapshot,
  generatedAt: string,
): LocalGtmStageResult {
  const output = validateGtmStageOutput(config.stage, buildFixtureStageOutput(config.stage, briefSnapshot, generatedAt));

  return {
    stage: config.stage,
    status: 'completed',
    command: config.command,
    skill: config.skill,
    executionType: config.executionType,
    outputFile: config.outputFile,
    output,
  };
}

function buildFixtureStageOutput(stage: GtmStageKey, briefSnapshot: GtmBriefSnapshot, generatedAt: string): unknown {
  if (stage === 'lock-brief') {
    return briefSnapshot;
  }

  if (stage === 'discover-url' || stage === 'enrich-brief' || stage === 'review-brief') {
    return briefFromSnapshot(briefSnapshot);
  }

  return {
    summary: `Local fixture output for ${stage}. Replace this with ${stage} command output when the skill is implemented.`,
    keyFindings: [`${stage} is wired into the command-first GTM workflow.`],
    evidenceIds: [],
    assumptions: [`Generated locally at ${generatedAt}; no external research was performed.`],
  };
}

function briefFromSnapshot(snapshot: GtmBriefSnapshot): GtmBrief {
  return {
    briefId: snapshot.parentBriefId,
    clientId: null,
    fields: snapshot.fields,
    createdAt: snapshot.briefCreatedAt,
    updatedAt: snapshot.briefUpdatedAt,
  };
}

function writeLocalRunDirectory(result: LocalGtmWorkflowResult, outputDir: string): void {
  const stageDir = join(outputDir, 'stages');
  mkdirSync(stageDir, { recursive: true });

  const manifest = {
    runId: result.runId,
    mode: result.mode,
    generatedAt: result.generatedAt,
    stageCount: result.stageCount,
    stages: result.stages.map(({ stage, command, skill, executionType, outputFile }) => ({
      stage,
      command,
      skill,
      executionType,
      outputFile,
    })),
  };

  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const stage of result.stages) {
    writeFileSync(join(stageDir, stage.outputFile), `${JSON.stringify(stage, null, 2)}\n`);
  }
}
