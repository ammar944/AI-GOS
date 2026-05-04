import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GtmStageKey } from '../../schemas/gtm/gtm-run';

const maybeSingle = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const runLocalSkillStage = vi.fn();
const originalAgentLogs = process.env.AIGOS_GTM_AGENT_LOGS;
let tempRoot: string;

vi.mock('../../supabase', () => ({
  getClient: () => ({
    from(table: string) {
      if (table === 'gtm_runs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle }),
            }),
          }),
          update: (payload: unknown) => {
            update(payload);
            return { eq: () => ({ eq: () => ({ error: null }) }) };
          },
        };
      }

      return {
        insert: (payload: unknown) => {
          insert(payload);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

vi.mock('../../stages/run-local-skill-stage', () => ({
  runLocalSkillStage: (...args: unknown[]) => runLocalSkillStage(...args),
}));

vi.mock('../../runtime/local-stage-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../runtime/local-stage-registry')>();
  return {
    ...actual,
    getLocalGtmStageConfig: (stage: GtmStageKey) => ({
      stage,
      command: `/${stage}`,
      skill: stage,
      outputFile: `${stage}.json`,
      executionType: 'skill' as const,
    }),
  };
});

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'aigos-dispatch-runner-'));
  process.env.AIGOS_GTM_AGENT_LOGS = 'off';
  maybeSingle.mockReset();
  update.mockReset();
  insert.mockReset();
  runLocalSkillStage.mockReset();
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  if (originalAgentLogs === undefined) {
    delete process.env.AIGOS_GTM_AGENT_LOGS;
    return;
  }

  process.env.AIGOS_GTM_AGENT_LOGS = originalAgentLogs;
});

describe('runGtmRunDispatch', () => {
  it('runs the Lighthouse 5 stages sequentially inside the worker', async () => {
    const stageOrder: string[] = [];
    const stageState: Record<string, unknown> = {};

    maybeSingle.mockImplementation(async () => ({
      data: {
        run_id: 'run_1',
        user_id: 'user_1',
        input_url: 'https://airtable.com/',
        status: 'running',
        stages: { ...stageState },
      },
      error: null,
    }));

    runLocalSkillStage.mockImplementation(async ({ config }: { config: { stage: string } }) => {
      stageOrder.push(config.stage);
      stageState[config.stage] = { status: 'complete', output: { stage: config.stage } };
      return {
        status: 'completed',
        rawOutput: { stage: config.stage },
        output: { stage: config.stage },
        artifacts: {
          runDir: `/tmp/${config.stage}`,
          inputFile: `/tmp/${config.stage}/input.json`,
          outputFile: `/tmp/${config.stage}/output.json`,
        },
        validation: { commands: [] },
      };
    });

    const { runGtmRunDispatch } = await import('../dispatch-runner');

    await runGtmRunDispatch({
      runId: 'run_1',
      userId: 'user_1',
      inputUrl: 'https://airtable.com/',
    });

    expect(stageOrder).toEqual([
      'discover-url',
      'discover-identity',
      'research-market-category',
      'research-competitors',
      'research-buyer-icp',
    ]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('passes a progress callback so local skill commands stream stage events', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        run_id: 'run_1',
        user_id: 'user_1',
        input_url: 'https://airtable.com/',
        status: 'running',
        stages: {},
      },
      error: null,
    });

    runLocalSkillStage.mockImplementation(async (input: {
      config: { stage: string };
      onProgress?: (event: {
        eventType: 'tool_call';
        message: string;
        status: 'running';
        toolName: string;
        metadata: Record<string, unknown>;
      }) => Promise<void>;
    }) => {
      expect(typeof input.onProgress).toBe('function');
      await input.onProgress?.({
        eventType: 'tool_call',
        message: 'Starting local skill command.',
        status: 'running',
        toolName: 'codex',
        metadata: { command: 'codex exec' },
      });
      return {
        status: 'completed',
        rawOutput: { stage: input.config.stage },
        output: { stage: input.config.stage },
        artifacts: {
          runDir: `/tmp/${input.config.stage}`,
          inputFile: `/tmp/${input.config.stage}/input.json`,
          outputFile: `/tmp/${input.config.stage}/output.json`,
        },
        validation: { status: 'passed', commands: [] },
      };
    });

    const { runGtmStageDispatch } = await import('../dispatch-runner');

    await runGtmStageDispatch({
      runId: 'run_1',
      userId: 'user_1',
      inputUrl: 'https://airtable.com/',
      stage: 'discover-url',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: 'run_1',
        stage: 'discover-url',
        event_type: 'tool_call',
        message: 'Starting local skill command.',
        status: 'running',
        tool_name: 'codex',
        metadata: { command: 'codex exec' },
      }),
    );
  });

  it('blocks missing output without recording a nonexistent output_file artifact', async () => {
    const runDir = join(tempRoot, 'run_missing_output', '06-research-buyer-icp');
    const outputFile = join(runDir, 'output.json');
    const blocker = [
      'Agent command completed with exit_code=0 but no usable output was produced.',
      'run_id=run_missing_output',
      'stage=research-buyer-icp',
      `run_dir=${runDir}`,
      `expected_output=${outputFile}`,
      `expected_fragments=${join(runDir, 'fragments')}`,
      'Next action: fix the agent-owned collection step to write output.json or fragments/*.json, then rerun this stage through the existing dispatch path.',
    ].join(' ');

    maybeSingle.mockResolvedValue({
      data: {
        run_id: 'run_missing_output',
        user_id: 'user_1',
        input_url: 'https://airtable.com/',
        status: 'running',
        stages: {},
      },
      error: null,
    });

    runLocalSkillStage.mockResolvedValue({
      status: 'blocked',
      blocker,
      rawOutput: undefined,
      output: undefined,
      artifacts: {
        runDir,
        inputFile: join(runDir, 'input.json'),
        outputFile,
      },
      validation: {
        status: 'failed',
        commands: [
          {
            label: 'agent:codex-cli',
            command: 'codex exec',
            status: 'passed',
            exitCode: 0,
            stdout: 'No artifact was written.',
            stderr: '',
          },
        ],
      },
    });

    const { runGtmStageDispatch } = await import('../dispatch-runner');

    await runGtmStageDispatch({
      runId: 'run_missing_output',
      userId: 'user_1',
      inputUrl: 'https://airtable.com/',
      stage: 'research-buyer-icp',
    });

    const finalUpdate = lastUpdatePayload();
    expect(finalUpdate.status).toBe('awaiting_user');
    expect(finalUpdate.stages['research-buyer-icp']).toMatchObject({
      status: 'blocked',
      error: blocker,
    });
    expect(finalUpdate.stages['research-buyer-icp']?.artifacts).not.toHaveProperty(
      'output_file',
    );
    expect(findInsertedEvent('artifact_written', 'output_file artifact recorded.')).toBeNull();
    expect(findInsertedEvent('blocked', expect.stringContaining('Worker blocked research-buyer-icp'))).toMatchObject({
      error: blocker,
    });
  });

  it('records output_file artifacts for completed stages when the output file exists and is readable', async () => {
    const runDir = join(tempRoot, 'run_complete', '06-research-buyer-icp');
    const outputFile = join(runDir, 'output.json');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(outputFile, '{"stage":"research-buyer-icp"}\n', {
      flag: 'w',
    });

    maybeSingle.mockResolvedValue({
      data: {
        run_id: 'run_complete',
        user_id: 'user_1',
        input_url: 'https://airtable.com/',
        status: 'running',
        stages: {},
      },
      error: null,
    });

    runLocalSkillStage.mockResolvedValue({
      status: 'completed',
      rawOutput: { stage: 'research-buyer-icp' },
      output: { stage: 'research-buyer-icp' },
      artifacts: {
        runDir,
        inputFile: join(runDir, 'input.json'),
        outputFile,
      },
      validation: { status: 'passed', commands: [] },
    });

    const { runGtmStageDispatch } = await import('../dispatch-runner');

    await runGtmStageDispatch({
      runId: 'run_complete',
      userId: 'user_1',
      inputUrl: 'https://airtable.com/',
      stage: 'research-buyer-icp',
    });

    expect(lastUpdatePayload().stages['research-buyer-icp']?.artifacts).toMatchObject({
      output_file: outputFile,
    });
    expect(findInsertedEvent('artifact_written', 'output_file artifact recorded.')).toMatchObject({
      artifact_path: outputFile,
      status: 'complete',
    });
  });
});

interface StageUpdatePayload {
  status: string;
  stages: Record<
    string,
    {
      status?: string;
      error?: string;
      artifacts?: Record<string, string>;
    }
  >;
}

interface InsertedEventPayload {
  event_type?: string;
  message?: string;
  status?: string;
  artifact_path?: string;
  error?: string;
}

function lastUpdatePayload(): StageUpdatePayload {
  const payload = update.mock.calls.at(-1)?.[0] as StageUpdatePayload | undefined;
  if (!payload) {
    throw new Error('Expected at least one gtm_runs update payload.');
  }
  return payload;
}

function findInsertedEvent(
  eventType: string,
  message: string | AsymmetricStringMatcher,
): InsertedEventPayload | null {
  const calls = insert.mock.calls as Array<[InsertedEventPayload]>;
  return (
    calls
      .map(([payload]) => payload)
      .find((payload) => {
        const messageMatches =
          typeof message === 'string'
            ? payload.message === message
            : message.asymmetricMatch(payload.message);
        return payload.event_type === eventType && messageMatches !== false;
      }) ?? null
  );
}

interface AsymmetricStringMatcher {
  asymmetricMatch(value: unknown): boolean;
}
