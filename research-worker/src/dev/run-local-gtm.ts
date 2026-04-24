import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLocalGtmFixtureSnapshot } from './local-fixture';
import { runGtmWorkflow } from '../jobs/run-gtm-workflow';
import {
  gtmBriefSnapshotSchema,
  type GtmBriefSnapshot,
} from '../schemas/gtm/gtm-brief-snapshot';
import { GTM_STAGE_KEYS, type GtmStageKey } from '../schemas/gtm/gtm-run';

interface CliArgs {
  outputDir: string;
  runId: string;
  snapshotPath?: string;
  realStages: GtmStageKey[];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const briefSnapshot = args.snapshotPath ? readSnapshot(args.snapshotPath) : buildLocalGtmFixtureSnapshot();

  const result = await runGtmWorkflow({
    runId: args.runId,
    briefSnapshot,
    outputDir: args.outputDir,
    realStages: args.realStages,
  });

  const realSummary = result.realStages.length === 0
    ? 'fixture (all stages)'
    : `skill-invoked: ${result.realStages.join(', ')}`;

  process.stdout.write(
    `GTM local run complete\n` +
      `run_id: ${result.runId}\n` +
      `mode: ${result.mode}\n` +
      `stage_count: ${result.stageCount}\n` +
      `real_stages: ${realSummary}\n` +
      `output_dir: ${result.outputDir ?? args.outputDir}\n`,
  );
}

function parseCliArgs(rawArgs: readonly string[]): CliArgs {
  const outputDir = readOption(rawArgs, '--out') ?? join('/tmp', `aigos-gtm-local-${Date.now()}`);
  const runId = readOption(rawArgs, '--run-id') ?? `run_local_${Date.now()}`;
  const snapshotPath = readOption(rawArgs, '--snapshot');
  const realStages = parseRealStages(readOption(rawArgs, '--real'));

  return {
    outputDir,
    runId,
    snapshotPath,
    realStages,
  };
}

function parseRealStages(raw: string | undefined): GtmStageKey[] {
  if (!raw) return [];
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const invalid = tokens.filter((token): token is string => !GTM_STAGE_KEYS.includes(token as GtmStageKey));
  if (invalid.length > 0) {
    throw new Error(
      `--real contains unknown stage key(s): ${invalid.join(', ')}. Valid keys: ${GTM_STAGE_KEYS.join(', ')}`,
    );
  }
  return tokens as GtmStageKey[];
}

function readOption(rawArgs: readonly string[], option: string): string | undefined {
  const index = rawArgs.indexOf(option);
  if (index === -1) return undefined;

  const value = rawArgs[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function readSnapshot(snapshotPath: string): GtmBriefSnapshot {
  const raw = readFileSync(snapshotPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return gtmBriefSnapshotSchema.parse(parsed);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`run-local-gtm failed: ${message}\n`);
  process.exit(1);
});
