import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { buildProspectFixtureSnapshot } from '../dev/local-fixture';
import { getLocalGtmStageConfig } from '../runtime/local-stage-registry';
import { GTM_STAGE_KEYS, type GtmStageKey } from '../schemas/gtm/gtm-run';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import type { GtmBriefFieldKey } from '../schemas/gtm/gtm-brief';
import type { SourceGap } from '../schemas/source-gap';
import {
  runLocalSkillStage,
  type LocalSkillCommandResult,
  type LocalSkillProgressEvent,
  type LocalSkillOutputContext,
} from '../stages/run-local-skill-stage';
import { getClient } from '../supabase';
import { writeGtmStageEvent, type GtmStageEventInsert } from './stage-events';

export interface GtmStageDispatchRequest {
  runId: string;
  userId: string;
  inputUrl: string;
  stage: GtmStageKey;
}

export interface GtmRunDispatchRequest {
  runId: string;
  userId: string;
  inputUrl: string;
}

interface GtmRunRow {
  run_id: string;
  user_id: string;
  input_url: string;
  status: string;
  stages: Record<string, unknown> | null;
}

interface GtmStageState {
  status?: string;
  started_at?: string;
  completed_at?: string;
  output?: unknown;
  raw_output?: unknown;
  source_gaps?: SourceGap[];
  tool_calls?: Array<Record<string, unknown>>;
  artifacts?: Record<string, string>;
  validation?: unknown;
  duration_ms?: number;
  error?: string;
}

const LIGHTHOUSE_STAGE_KEYS = [
  'discover-url',
  'discover-identity',
  'research-market-category',
  'research-competitors',
  'research-buyer-icp',
] as const satisfies readonly GtmStageKey[];

export function isDispatchableGtmStage(stage: string): stage is GtmStageKey {
  return GTM_STAGE_KEYS.includes(stage as GtmStageKey);
}

export async function runGtmRunDispatch(
  request: GtmRunDispatchRequest,
): Promise<void> {
  await writeGtmStageEvent({
    run_id: request.runId,
    user_id: request.userId,
    stage: 'discover-url',
    event_type: 'started',
    message: 'Worker accepted full Lighthouse 5 GTM run orchestration.',
    status: 'running',
    metadata: {
      input_url: request.inputUrl,
      stages: LIGHTHOUSE_STAGE_KEYS,
    },
    created_at: new Date().toISOString(),
  });

  for (const stage of LIGHTHOUSE_STAGE_KEYS) {
    const run = await loadGtmRun(request);
    const stages = normalizeStages(run.stages);
    const stageStatus = stages[stage]?.status;

    if (stageStatus === 'complete') {
      continue;
    }

    if (isTerminalRunStatus(run.status) || isTerminalStageStatus(stageStatus)) {
      break;
    }

    await runGtmStageDispatch({
      ...request,
      stage,
    });

    const updatedRun = await loadGtmRun(request);
    const updatedStages = normalizeStages(updatedRun.stages);
    const updatedStatus = updatedStages[stage]?.status;
    if (updatedStatus !== 'complete') {
      break;
    }
  }

  const finalRun = await loadGtmRun(request);
  const finalStages = normalizeStages(finalRun.stages);
  await persistRunState({
    run: finalRun,
    stages: finalStages,
    status: determineRunStatus(finalStages),
  });
}

export async function runGtmStageDispatch(
  request: GtmStageDispatchRequest,
): Promise<void> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  try {
    const run = await loadGtmRun(request);
    const currentStages = normalizeStages(run.stages);
    const runningStages = {
      ...currentStages,
      [request.stage]: {
        ...currentStages[request.stage],
        status: 'running',
        started_at: startedAt,
        error: undefined,
      },
    };

    await persistRunState({
      run,
      stages: runningStages,
      status: 'running',
    });
    await writeGtmStageEvent({
      run_id: request.runId,
      user_id: request.userId,
      stage: request.stage,
      event_type: 'started',
      message: `Worker started ${request.stage}.`,
      status: 'running',
      metadata: {
        input_url: request.inputUrl,
      },
      created_at: startedAt,
    });
    await writeGtmStageEvent({
      run_id: request.runId,
      user_id: request.userId,
      stage: request.stage,
      event_type: 'tool_call',
      message: `Invoking ${getLocalGtmStageConfig(request.stage).command} through the local skill runner.`,
      status: 'running',
      tool_name: getLocalGtmStageConfig(request.stage).command,
      created_at: new Date().toISOString(),
    });

    const config = getLocalGtmStageConfig(request.stage);
    const generatedAt = new Date().toISOString();
    const skillResult = await runLocalSkillStage({
      config,
      runId: request.runId,
      briefSnapshot: buildSnapshotFromRun(run, generatedAt),
      generatedAt,
      runDir: buildRunDir(request.runId, config.outputFile),
      skillsRoot: resolve(__dirname, '../../../skills'),
      priorSkillOutputs: buildPriorSkillOutputs(currentStages, generatedAt),
      onProgress: async (event) => {
        await writeGtmStageEvent(buildProgressStageEvent(request, event));
      },
    });
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    const stageStatus = skillResult.status === 'completed' ? 'complete' : 'blocked';
    const sourceGaps = normalizeSourceGaps(
      skillResult.rawOutput,
      skillResult.blocker,
    );
    const artifacts = normalizeArtifacts(skillResult.artifacts, {
      includeOutputFile: stageStatus === 'complete',
    });
    const toolCalls = skillResult.validation.commands.map(commandToToolCall);
    const output = normalizeOutputForApp(request.stage, skillResult.rawOutput ?? skillResult.output);
    const nextStages = {
      ...runningStages,
      [request.stage]: {
        status: stageStatus,
        started_at: startedAt,
        completed_at: completedAt,
        output,
        raw_output: skillResult.rawOutput,
        source_gaps: sourceGaps,
        tool_calls: toolCalls,
        artifacts,
        validation: skillResult.validation,
        duration_ms: durationMs,
        ...(skillResult.blocker ? { error: skillResult.blocker } : {}),
      },
    };

    await persistRunState({
      run,
      stages: nextStages,
      status: determineRunStatus(nextStages),
    });

    for (const command of skillResult.validation.commands) {
      await writeGtmStageEvent({
        run_id: request.runId,
        user_id: request.userId,
        stage: request.stage,
        event_type: command.status === 'passed' ? 'validation_passed' : 'validation_failed',
        message: `${command.label} ${command.status}.`,
        status: stageStatus,
        tool_name: command.label,
        metadata: {
          command: command.command,
          exit_code: command.exitCode,
        },
        error: command.status === 'failed' ? command.stderr || command.stdout : undefined,
        created_at: new Date().toISOString(),
      });
    }

    for (const [artifactName, artifactPath] of Object.entries(artifacts)) {
      await writeGtmStageEvent({
        run_id: request.runId,
        user_id: request.userId,
        stage: request.stage,
        event_type: 'artifact_written',
        message: `${artifactName} artifact recorded.`,
        status: stageStatus,
        artifact_path: artifactPath,
        created_at: new Date().toISOString(),
      });
    }

    await writeGtmStageEvent({
      run_id: request.runId,
      user_id: request.userId,
      stage: request.stage,
      event_type: stageStatus === 'complete' ? 'completed' : 'blocked',
      message:
        stageStatus === 'complete'
          ? `Worker completed ${request.stage}.`
          : `Worker blocked ${request.stage}: ${skillResult.blocker ?? 'no validated output'}.`,
      status: stageStatus,
      duration_ms: durationMs,
      error: skillResult.blocker,
      created_at: completedAt,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    const run = await tryLoadGtmRun(request);
    if (run) {
      const stages = normalizeStages(run.stages);
      await persistRunState({
        run,
        stages: {
          ...stages,
          [request.stage]: {
            ...stages[request.stage],
            status: 'errored',
            started_at: stages[request.stage]?.started_at ?? startedAt,
            completed_at: completedAt,
            duration_ms: Date.now() - startedAtMs,
            error: errorMessage,
          },
        },
        status: 'failed',
      });
    }

    await writeGtmStageEvent({
      run_id: request.runId,
      user_id: request.userId,
      stage: request.stage,
      event_type: 'errored',
      message: `Worker errored while running ${request.stage}.`,
      status: 'errored',
      duration_ms: Date.now() - startedAtMs,
      error: errorMessage,
      created_at: completedAt,
    });
  }
}

async function loadGtmRun(request: GtmRunDispatchRequest): Promise<GtmRunRow> {
  const { data, error } = await getClient()
    .from('gtm_runs')
    .select('run_id, user_id, input_url, status, stages')
    .eq('run_id', request.runId)
    .eq('user_id', request.userId)
    .maybeSingle<GtmRunRow>();

  if (error) {
    throw new Error(`Failed to load GTM run ${request.runId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`GTM run ${request.runId} was not found for user ${request.userId}.`);
  }

  return data;
}

async function tryLoadGtmRun(
  request: GtmStageDispatchRequest,
): Promise<GtmRunRow | null> {
  try {
    return await loadGtmRun(request);
  } catch {
    return null;
  }
}

async function persistRunState(input: {
  run: GtmRunRow;
  stages: Record<string, GtmStageState>;
  status: string;
}): Promise<void> {
  const { error } = await getClient()
    .from('gtm_runs')
    .update({
      status: input.status,
      stages: input.stages,
    })
    .eq('run_id', input.run.run_id)
    .eq('user_id', input.run.user_id);

  if (error) {
    throw new Error(`Failed to persist GTM run ${input.run.run_id}: ${error.message}`);
  }
}

function normalizeStages(stages: Record<string, unknown> | null): Record<string, GtmStageState> {
  if (!stages) return {};
  return Object.fromEntries(
    Object.entries(stages).map(([stage, state]) => [
      stage,
      isRecord(state) ? (state as GtmStageState) : {},
    ]),
  );
}

function buildSnapshotFromRun(run: GtmRunRow, now: string): GtmBriefSnapshot {
  const hostLabel = hostnameLabel(run.input_url);
  const fields: Partial<Record<GtmBriefFieldKey, string>> = {
    companyName: readIdentityField(run.stages, 'company_name') ?? hostLabel,
    companyUrl: run.input_url,
    category: readIdentityField(run.stages, 'category') ?? 'SaaS',
    productDescription: `${hostLabel} SaaS product and go-to-market context.`,
    targetCustomer: 'Business teams',
    primaryIcpDescription: 'Business teams evaluating SaaS workflow software.',
    industryVertical: 'SaaS',
  };

  return buildProspectFixtureSnapshot({
    briefId: `brief_${run.run_id}`,
    snapshotId: `snapshot_${run.run_id}`,
    fields,
    now,
  });
}

function buildPriorSkillOutputs(
  stages: Record<string, GtmStageState>,
  generatedAt: string,
): Map<GtmStageKey, LocalSkillOutputContext> {
  const outputs = new Map<GtmStageKey, LocalSkillOutputContext>();
  for (const stage of GTM_STAGE_KEYS) {
    const state = stages[stage];
    const rawOutput = state?.raw_output ?? state?.output;
    const outputFile = state?.artifacts?.output_file ?? state?.artifacts?.outputFile ?? '';
    if (rawOutput !== undefined && outputFile.length > 0) {
      outputs.set(stage, {
        stage,
        skill: getLocalGtmStageConfig(stage).skill,
        outputPath: outputFile,
        rawOutput,
        generatedAt,
      });
    }
  }
  return outputs;
}

function buildRunDir(runId: string, outputFile: string): string {
  const baseDir = process.env.AIGOS_GTM_RUNS_DIR?.trim() || '/tmp/aigos-gtm-runs';
  return join(baseDir, runId, basename(outputFile, '.json'));
}

function normalizeArtifacts(artifacts: {
  runDir: string;
  inputFile: string;
  outputFile: string;
  promptFile?: string;
  transcriptFile?: string;
  reportFile?: string;
}, options: { includeOutputFile: boolean }): Record<string, string> {
  return {
    run_dir: artifacts.runDir,
    input_file: artifacts.inputFile,
    ...(options.includeOutputFile && isReadableFile(artifacts.outputFile)
      ? { output_file: artifacts.outputFile }
      : {}),
    ...(artifacts.promptFile ? { prompt_file: artifacts.promptFile } : {}),
    ...(artifacts.transcriptFile ? { transcript_file: artifacts.transcriptFile } : {}),
    ...(artifacts.reportFile ? { report_file: artifacts.reportFile } : {}),
  };
}

function isReadableFile(pathname: string): boolean {
  if (!existsSync(pathname)) {
    return false;
  }

  if (!statSync(pathname).isFile()) {
    return false;
  }

  try {
    accessSync(pathname, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function commandToToolCall(command: LocalSkillCommandResult): Record<string, unknown> {
  return {
    name: command.label,
    status: command.status,
    exit_code: command.exitCode,
    command: command.command,
  };
}

function buildProgressStageEvent(
  request: GtmStageDispatchRequest,
  event: LocalSkillProgressEvent,
): GtmStageEventInsert {
  return {
    run_id: request.runId,
    user_id: request.userId,
    stage: request.stage,
    event_type: event.eventType,
    message: event.message,
    status: event.status,
    metadata: event.metadata ?? {},
    ...(event.durationMs !== undefined ? { duration_ms: event.durationMs } : {}),
    ...(event.toolName ? { tool_name: event.toolName } : {}),
    ...(event.artifactPath ? { artifact_path: event.artifactPath } : {}),
    ...(event.error ? { error: event.error } : {}),
    created_at: new Date().toISOString(),
  };
}

function normalizeOutputForApp(stage: GtmStageKey, rawOutput: unknown): unknown {
  if (stage !== 'research-competitors' || !isRecord(rawOutput)) {
    return rawOutput;
  }

  return {
    ...rawOutput,
    stage: 'research-competitor',
    source_gaps: normalizeSourceGaps(rawOutput, undefined),
  };
}

function normalizeSourceGaps(rawOutput: unknown, blocker: string | undefined): SourceGap[] {
  const rawGaps = isRecord(rawOutput) && Array.isArray(rawOutput.source_gaps)
    ? rawOutput.source_gaps
    : [];
  const gaps = rawGaps.flatMap((entry) => {
    if (isSourceGap(entry)) {
      return [entry];
    }

    if (typeof entry === 'string' && entry.trim().length > 0) {
      return [
        {
          field: 'research',
          reason: entry.trim(),
          remediation: 'Review the skill artifact and rerun with the missing source or provider available.',
          severity: 'warn' as const,
          confidence: 7,
        },
      ];
    }

    return [];
  });

  if (gaps.length > 0 || !blocker) {
    return gaps;
  }

  return [
    {
      field: 'worker',
      reason: blocker,
      remediation: 'Inspect the worker event log and rerun the stage after resolving the blocker.',
      severity: 'blocker',
      confidence: 10,
    },
  ];
}

function determineRunStatus(stages: Record<string, GtmStageState>): string {
  if (
    LIGHTHOUSE_STAGE_KEYS.some((stage) => {
      const status = stages[stage]?.status;
      return status === 'errored' || status === 'timed_out';
    })
  ) {
    return 'failed';
  }

  if (
    LIGHTHOUSE_STAGE_KEYS.some((stage) => {
      const state = stages[stage];
      return state?.status === 'blocked' || hasBlockerSourceGap(state?.source_gaps);
    })
  ) {
    return 'awaiting_user';
  }

  if (
    LIGHTHOUSE_STAGE_KEYS.some((stage) => {
      const status = stages[stage]?.status;
      return status === 'queued' || status === 'running';
    })
  ) {
    return 'running';
  }

  const completedCount = LIGHTHOUSE_STAGE_KEYS.filter((stage) => {
    return stages[stage]?.status === 'complete';
  }).length;

  if (completedCount === LIGHTHOUSE_STAGE_KEYS.length) {
    return 'completed';
  }

  if (completedCount > 0) {
    return 'partial';
  }

  return 'queued';
}

function isTerminalRunStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'awaiting_user';
}

function isTerminalStageStatus(status: string | undefined): boolean {
  return status === 'blocked' || status === 'timed_out' || status === 'errored';
}

function hasBlockerSourceGap(sourceGaps: SourceGap[] | undefined): boolean {
  return (sourceGaps ?? []).some((gap) => gap.severity === 'blocker');
}

function readIdentityField(stages: Record<string, unknown> | null, field: string): string | null {
  const normalizedStages = normalizeStages(stages);
  const identityOutput = normalizedStages['discover-identity']?.output;
  if (!isRecord(identityOutput)) {
    return null;
  }
  const value = identityOutput[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function hostnameLabel(inputUrl: string): string {
  try {
    const url = new URL(inputUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return inputUrl;
  }
}

function isSourceGap(value: unknown): value is SourceGap {
  return (
    isRecord(value) &&
    typeof value.field === 'string' &&
    typeof value.reason === 'string' &&
    typeof value.remediation === 'string' &&
    (value.severity === 'info' || value.severity === 'warn' || value.severity === 'blocker') &&
    typeof value.confidence === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
