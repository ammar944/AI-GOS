import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLocalGtmStageConfigs, type LocalGtmStageConfig } from '../runtime/local-stage-registry';
import { validateGtmStageOutput } from '../runtime/output-validator';
import { type GtmBrief } from '../schemas/gtm/gtm-brief';
import { type GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import { GTM_STAGE_KEYS, type GtmStageKey } from '../schemas/gtm/gtm-run';
import { runStage as runEnrichBriefStage } from '../stages/enrich-brief';
import { runStage as runResearchSectionStage } from '../stages/run-research-section';

export type LocalGtmWorkflowMode = 'local-fixture' | 'local-mixed';
export type LocalGtmStageStatus = 'completed';
export type LocalGtmStageExecutionMode = 'fixture' | 'skill-invoked';

export interface RunGtmWorkflowInput {
  runId: string;
  briefSnapshot: GtmBriefSnapshot;
  outputDir?: string;
  now?: string;
  realStages?: Iterable<GtmStageKey>;
}

export interface LocalGtmStageResult {
  stage: GtmStageKey;
  status: LocalGtmStageStatus;
  command: string;
  skill: string;
  executionType: LocalGtmStageConfig['executionType'];
  executionMode: LocalGtmStageExecutionMode;
  outputFile: string;
  output: unknown;
  notes?: string;
}

export interface LocalGtmWorkflowResult {
  runId: string;
  mode: LocalGtmWorkflowMode;
  generatedAt: string;
  outputDir: string | null;
  stageCount: number;
  realStages: GtmStageKey[];
  stages: LocalGtmStageResult[];
}

const REAL_STAGE_WHITELIST = new Set<GtmStageKey>([
  'enrich-brief',
  'research-competitors',
]);

export async function runGtmWorkflow(input: RunGtmWorkflowInput): Promise<LocalGtmWorkflowResult> {
  const generatedAt = input.now ?? new Date().toISOString();
  const realStages = normalizeRealStages(input.realStages);

  const stages: LocalGtmStageResult[] = [];
  for (const config of getLocalGtmStageConfigs()) {
    const stage = await runLocalStage(config, input.briefSnapshot, generatedAt, realStages);
    stages.push(stage);
  }

  const result: LocalGtmWorkflowResult = {
    runId: input.runId,
    mode: realStages.size === 0 ? 'local-fixture' : 'local-mixed',
    generatedAt,
    outputDir: input.outputDir ?? null,
    stageCount: stages.length,
    realStages: [...realStages],
    stages,
  };

  if (input.outputDir) {
    writeLocalRunDirectory(result, input.outputDir);
  }

  return result;
}

function normalizeRealStages(real: Iterable<GtmStageKey> | undefined): Set<GtmStageKey> {
  if (!real) return new Set();
  const requested = new Set<GtmStageKey>();
  for (const stage of real) {
    if (!GTM_STAGE_KEYS.includes(stage)) {
      throw new Error(`Unknown GTM stage in realStages: ${stage}`);
    }
    if (!REAL_STAGE_WHITELIST.has(stage)) {
      throw new Error(
        `Stage "${stage}" has no real adapter in slice 1. Wired: ${[...REAL_STAGE_WHITELIST].join(', ')}`,
      );
    }
    requested.add(stage);
  }
  return requested;
}

async function runLocalStage(
  config: LocalGtmStageConfig,
  briefSnapshot: GtmBriefSnapshot,
  generatedAt: string,
  realStages: Set<GtmStageKey>,
): Promise<LocalGtmStageResult> {
  const isReal = realStages.has(config.stage);
  let notes: string | undefined;

  if (isReal) {
    try {
      notes = await invokeRealStage(config.stage, briefSnapshot);
    } catch (err) {
      throw new Error(
        `Stage "${config.stage}" real invocation failed: ${(err as Error).message}`,
      );
    }
  }

  const output = validateGtmStageOutput(
    config.stage,
    buildFixtureStageOutput(config.stage, briefSnapshot, generatedAt),
  );

  return {
    stage: config.stage,
    status: 'completed',
    command: config.command,
    skill: config.skill,
    executionType: config.executionType,
    executionMode: isReal ? 'skill-invoked' : 'fixture',
    outputFile: config.outputFile,
    output,
    notes,
  };
}

async function invokeRealStage(stage: GtmStageKey, briefSnapshot: GtmBriefSnapshot): Promise<string> {
  if (stage === 'enrich-brief') {
    const result = await runEnrichBriefStage({ briefSnapshot });
    return `ingest-identity skill invoked (exit ${result.skillExitCode}).`;
  }
  if (stage === 'research-competitors') {
    const result = await runResearchSectionStage({ section: 'research-competitors', briefSnapshot });
    return result.notes;
  }
  throw new Error(`No real adapter wired for stage: ${stage}`);
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
    realStages: result.realStages,
    stages: result.stages.map(({ stage, command, skill, executionType, executionMode, outputFile, notes }) => ({
      stage,
      command,
      skill,
      executionType,
      executionMode,
      outputFile,
      notes,
    })),
  };

  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const stage of result.stages) {
    writeFileSync(join(stageDir, stage.outputFile), `${JSON.stringify(stage, null, 2)}\n`);
  }
}
